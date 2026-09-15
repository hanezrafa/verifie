/**
 * Advanced Editing Tracker
 * Tracks keystrokes, velocity, sessions, and patterns
 * Idempotent — safe to load multiple times.
 */
(function (global) {
  'use strict';

  if (global.EditingTracker) return; // already loaded

class EditingTracker {
  constructor(options = {}) {
    this.interval = options.interval || 2000;
    this.onUpdate = options.onUpdate || (() => {});
    this.onSessionChange = options.onSessionChange || (() => {});

    this.stats = {
      charsTyped: 0,
      charsDeleted: 0,
      keystrokes: 0,
      wordsTyped: 0,
      sessionStart: Date.now(),
      lastActivity: Date.now(),
      velocity: [], // chars per interval
      active: true
    };

    this.lastContent = '';
    this.lastContentLength = 0;
    this.observer = null;
    this.intervalId = null;
    this.idleThreshold = 60000; // 1 minute
    this.isIdle = false;

    this.init();
  }

  init() {
    this.findContentElement().then(el => {
      if (!el) return;
      this.contentEl = el;
      this.lastContent = this.getContent(el);
      this.lastContentLength = this.lastContent.length;

      this.attachObserver(el);
      this.startInterval();
      this.attachInputListeners();
    });
  }

  async findContentElement() {
    const selectors = [
      '.kix-page-content-wrapper',
      '[role="document"]',
      '.docs-texteventtarget-iframe'
    ];

    for (let attempt = 0; attempt < 20; attempt++) {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return el;
      }
      await new Promise(r => setTimeout(r, 500));
    }
    return null;
  }

  getContent(el) {
    return el.innerText || el.textContent || '';
  }

  attachObserver(el) {
    this.observer = new MutationObserver(() => {
      this.checkForChanges();
    });

    this.observer.observe(el, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  attachInputListeners() {
    // Listen for keystrokes in the docs iframe
    document.addEventListener('keydown', (e) => {
      if (!this.stats.active) return;
      this.stats.keystrokes++;
      this.stats.lastActivity = Date.now();
      this.wakeUp();
    }, true);

    // Detect paste events (potential AI content)
    document.addEventListener('paste', (e) => {
      if (!this.stats.active) return;
      const text = e.clipboardData?.getData('text') || '';
      if (text.length > 100) {
        // Large paste = likely pasted from AI
        this.onLargePaste?.(text.length);
      }
    }, true);
  }

  checkForChanges() {
    if (!this.contentEl || !this.stats.active) return;

    const content = this.getContent(this.contentEl);
    const currentLength = content.length;
    const delta = currentLength - this.lastContentLength;

    if (delta > 0) {
      this.stats.charsTyped += delta;
      this.stats.wordsTyped += this.countNewWords(content, this.lastContent);
    } else if (delta < 0) {
      this.stats.charsDeleted += Math.abs(delta);
    }

    if (delta !== 0) {
      this.stats.lastActivity = Date.now();
      this.wakeUp();
    }

    this.lastContent = content;
    this.lastContentLength = currentLength;
  }

  countNewWords(current, previous) {
    const currentWords = current.split(/\s+/).filter(w => w.length > 0).length;
    const prevWords = previous.split(/\s+/).filter(w => w.length > 0).length;
    return Math.max(0, currentWords - prevWords);
  }

  startInterval() {
    this.intervalId = setInterval(() => {
      this.tick();
    }, this.interval);
  }

  tick() {
    if (!this.stats.active) return;

    // Check idle
    const idleTime = Date.now() - this.stats.lastActivity;
    const wasIdle = this.isIdle;
    this.isIdle = idleTime > this.idleThreshold;

    // Track velocity
    const charsThisInterval = this.pendingChars || 0;
    this.stats.velocity.push({
      timestamp: Date.now(),
      chars: charsThisInterval
    });

    // Keep last 60 data points (2 minutes at 2s interval)
    if (this.stats.velocity.length > 60) {
      this.stats.velocity.shift();
    }

    this.pendingChars = 0;

    // Notify update
    this.onUpdate({
      charsTyped: this.stats.charsTyped,
      charsDeleted: this.stats.charsDeleted,
      keystrokes: this.stats.keystrokes,
      wordsTyped: this.stats.wordsTyped,
      sessionDuration: Date.now() - this.stats.sessionStart,
      velocity: this.stats.velocity,
      isIdle: this.isIdle,
      active: this.stats.active
    });
  }

  wakeUp() {
    this.isIdle = false;
  }

  addChars(count) {
    this.pendingChars = (this.pendingChars || 0) + count;
  }

  pause() {
    this.stats.active = false;
  }

  resume() {
    this.stats.active = true;
    this.stats.lastActivity = Date.now();
  }

  stop() {
    if (this.observer) this.observer.disconnect();
    if (this.intervalId) clearInterval(this.intervalId);
    this.stats.active = false;
    this.stats.sessionEnd = Date.now();
    this.onSessionChange({
      duration: this.stats.sessionEnd - this.stats.sessionStart,
      charsTyped: this.stats.charsTyped,
      charsDeleted: this.stats.charsDeleted,
      keystrokes: this.stats.keystrokes
    });
  }

  getSession() {
    return {
      startTime: this.stats.sessionStart,
      endTime: Date.now(),
      duration: Date.now() - this.stats.sessionStart,
      charsTyped: this.stats.charsTyped,
      charsDeleted: this.stats.charsDeleted,
      keystrokes: this.stats.keystrokes,
      wordsTyped: this.stats.wordsTyped,
      active: this.stats.active
    };
  }

  getSummary() {
    const charsTyped = this.stats.charsTyped;
    const charsDeleted = this.stats.charsDeleted;
    const totalChars = charsTyped + charsDeleted;
    const accuracy = totalChars > 0 ? Math.round((charsTyped / totalChars) * 100) : 100;

    // Calculate average velocity (chars per minute)
    const startTime = this.stats.velocity[0]?.timestamp || Date.now();
    const durationMin = Math.max((Date.now() - startTime) / 60000, 0.1);
    const totalInWindow = this.stats.velocity.reduce((sum, v) => sum + v.chars, 0);
    const avgVelocity = Math.round(totalInWindow / durationMin);

    // Burstiness - variation in typing speed
    const velocities = this.stats.velocity.map(v => v.chars);
    const avg = velocities.reduce((a, b) => a + b, 0) / (velocities.length || 1);
    const variance = velocities.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / (velocities.length || 1);
    const burstiness = Math.round(Math.sqrt(variance));

    return {
      charsTyped,
      charsDeleted,
      keystrokes: this.stats.keystrokes,
      wordsTyped: this.stats.wordsTyped,
      sessionDuration: Date.now() - this.stats.sessionStart,
      accuracy,
      avgVelocity,
      burstiness,
      isIdle: this.isIdle,
      active: this.stats.active
    };
  }
}

  global.EditingTracker = EditingTracker;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EditingTracker };
  }
})(typeof window !== 'undefined' ? window : self);
