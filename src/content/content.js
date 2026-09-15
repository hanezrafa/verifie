(() => {
  'use strict';

  // Prevent double injection
  if (window.__verifieLoaded) return;
  window.__verifieLoaded = true;

  const reader = window.GoogleDocsReader ? new window.GoogleDocsReader() : null;
  const state = {
    lastHash: '',
    lastSnapshot: null,
    active: true,
    panel: null,
    sessionStart: Date.now(),
    // Keystroke-based tracking (works even when Docs renders on canvas)
    typedChars: 0,
    deletedChars: 0,
    keystrokes: 0,
    wordBaseline: null
  };

  // ============================================================
  // KEYSTROKE TRACKING (primary — works regardless of rendering)
  // ============================================================
  function setupKeystrokeTracking() {
    // Capture keystrokes in the top frame AND the docs iframe
    const targets = [document];
    document.querySelectorAll('iframe').forEach(f => {
      try { if (f.contentDocument) targets.push(f.contentDocument); } catch (e) {}
    });

    targets.forEach(doc => {
      doc.addEventListener('keydown', (e) => {
        if (!state.active) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return; // ignore shortcuts

        if (e.key === 'Backspace' || e.key === 'Delete') {
          state.deletedChars++;
        } else if (e.key.length === 1) {
          state.typedChars++;
        }
        state.keystrokes++;
        updatePanelFromKeystrokes();
      }, true);

      doc.addEventListener('paste', (e) => {
        if (!state.active) return;
        const text = (e.clipboardData && e.clipboardData.getData('text')) || '';
        if (text.length > 0) {
          state.typedChars += text.length;
          updatePanelFromKeystrokes();
        }
      }, true);
    });
  }

  function updatePanelFromKeystrokes() {
    // If text extraction is failing, show keystroke-derived numbers
    const extracted = state.lastSnapshot && state.lastSnapshot.text ? state.lastSnapshot.text.length : 0;
    if (extracted > 0) return; // real text available — leave panel to snapshot

    const net = Math.max(0, state.typedChars - state.deletedChars);
    setText('v-chars', formatNumber(net));
    setText('v-words', formatNumber(Math.round(net / 5))); // ~5 chars per word
    setText('v-paras', formatNumber(state.keystrokes > 0 ? 1 : 0));
  }

  // ============================================================
  // FLOATING PANEL — always visible inside Google Docs
  // ============================================================
  function createPanel() {
    if (document.getElementById('verifie-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'verifie-panel';
    panel.innerHTML = `
      <div class="verifie-panel-header" id="verifie-panel-header">
        <div class="verifie-panel-brand">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          <span>Verifie</span>
          <span class="verifie-live-dot"></span>
        </div>
        <button class="verifie-panel-toggle" id="verifie-panel-toggle" title="Minimize">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      </div>

      <div class="verifie-panel-body" id="verifie-panel-body">
        <div class="verifie-grid">
          <div class="verifie-stat">
            <span class="verifie-stat-val" id="v-words">0</span>
            <span class="verifie-stat-lbl">Words</span>
          </div>
          <div class="verifie-stat">
            <span class="verifie-stat-val" id="v-chars">0</span>
            <span class="verifie-stat-lbl">Characters</span>
          </div>
          <div class="verifie-stat">
            <span class="verifie-stat-val" id="v-paras">0</span>
            <span class="verifie-stat-lbl">Paragraphs</span>
          </div>
          <div class="verifie-stat">
            <span class="verifie-stat-val" id="v-time">00:00</span>
            <span class="verifie-stat-lbl">Session</span>
          </div>
        </div>

        <div class="verifie-ai-row">
          <div class="verifie-ai-bar">
            <div class="verifie-ai-fill" id="v-ai-fill" style="width:0%"></div>
          </div>
          <div class="verifie-ai-labels">
            <span>AI <b id="v-ai-pct">0%</b></span>
            <span>Human <b id="v-human-pct">100%</b></span>
          </div>
        </div>

        <div class="verifie-actions">
          <button class="verifie-btn verifie-btn-primary" id="v-analyze">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="M21 21l-4.35-4.35"></path>
            </svg>
            Analyze AI
          </button>
          <button class="verifie-btn verifie-btn-ghost" id="v-dashboard">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Dashboard
          </button>
        </div>

        <div class="verifie-status" id="v-status">
          <span class="verifie-status-dot" id="v-status-dot"></span>
          <span id="v-status-text">Waiting for document…</span>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    // Minimize toggle
    const toggle = document.getElementById('verifie-panel-toggle');
    const body = document.getElementById('verifie-panel-body');
    toggle.addEventListener('click', () => {
      const minimized = panel.classList.toggle('minimized');
      toggle.innerHTML = minimized
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"></polyline></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>';
    });

    // Draggable header
    makeDraggable(panel, document.getElementById('verifie-panel-header'));

    // Buttons
    document.getElementById('v-analyze').addEventListener('click', runAnalysis);
    document.getElementById('v-dashboard').addEventListener('click', openDashboard);

    state.panel = panel;
  }

  function makeDraggable(el, handle) {
    let posX = 0, posY = 0, startX = 0, startY = 0;
    handle.style.cursor = 'grab';

    handle.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      handle.style.cursor = 'grabbing';
    });

    function onMove(e) {
      posX = startX - e.clientX;
      posY = startY - e.clientY;
      startX = e.clientX;
      startY = e.clientY;
      const top = el.offsetTop - posY;
      const left = el.offsetLeft - posX;
      el.style.top = Math.max(0, Math.min(window.innerHeight - 60, top)) + 'px';
      el.style.left = Math.max(0, Math.min(window.innerWidth - 60, left)) + 'px';
      el.style.right = 'auto';
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      handle.style.cursor = 'grab';
    }
  }

  // ============================================================
  // LIVE DATA
  // ============================================================
  function updatePanel(snapshot) {
    if (!snapshot) return;
    // Only override with extracted text if we actually got some
    if (snapshot.text && snapshot.text.length > 0) {
      setText('v-words', formatNumber(snapshot.wordCount));
      setText('v-chars', formatNumber(snapshot.charCount));
      setText('v-paras', formatNumber(snapshot.paragraphCount));
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el && el.textContent !== String(val)) el.textContent = val;
  }

  function tickSession() {
    const el = document.getElementById('v-time');
    if (!el) return;
    const elapsed = Math.floor((Date.now() - state.sessionStart) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    el.textContent = `${m}:${s}`;
  }

  // ============================================================
  // AI ANALYSIS (local heuristics, no API needed)
  // ============================================================
  function runAnalysis() {
    if (!reader) return;
    const text = reader.getText();
    if (!text || text.length < 20) {
      flashButton('v-analyze', 'Too short', true);
      return;
    }

    const btn = document.getElementById('v-analyze');
    btn.innerHTML = '<span class="verifie-spinner"></span> Analyzing...';

    setTimeout(async () => {
      let result = null;

      // Try shared service first (remote with local fallback)
      if (window.AIDetectionService) {
        try {
          const endpoints = window.VerifieSettings ? await window.VerifieSettings.getEndpoints() : {};
          result = await window.AIDetectionService.analyze(text, {
            token: endpoints.huggingFaceToken,
            preferRemote: !!endpoints.huggingFaceToken
          });
        } catch (e) { /* fall through */ }
      }

      if (!result) result = localAnalyze(text);

      applyAiResult(result);

      // Persist for dashboard
      persistAnalysis(result, text);
    }, 500);
  }

  function localAnalyze(text) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let ai = 0, human = 0;

    const aiPatterns = [
      [/\b(furthermore|moreover|additionally|consequently|therefore|thus|hence)\b/gi, 8],
      [/\b(in conclusion|to sum up|in summary|overall)\b/gi, 7],
      [/\b(it is important to note|it should be noted)\b/gi, 6],
      [/\b(has revolutionized|has transformed|has created|has enabled)\b/gi, 5],
      [/\b(unprecedented|significant|remarkable|substantial)\b/gi, 4],
      [/\b(in today.s society|in modern society|in the modern world)\b/gi, 6],
      [/\b(comprehensive|innovative|cutting.edge|groundbreaking)\b/gi, 4],
      [/\b(harness|leverage|utilize|facilitate)\b/gi, 3]
    ];
    const humanPatterns = [
      [/\b(I think|I believe|in my opinion|personally)\b/gi, 8],
      [/\b(gonna|wanna|kinda|sorta|yeah|\bok\b)\b/gi, 7],
      [/!{2,}/g, 3],
      [/\b(very|really|super|totally|absolutely)\b/gi, 4],
      [/\b(don't|can't|won't|isn't|aren't)\b/gi, 4]
    ];

    aiPatterns.forEach(([p, w]) => { const m = text.match(p); if (m) ai += m.length * w; });
    humanPatterns.forEach(([p, w]) => { const m = text.match(p); if (m) human += m.length * w; });

    const avgLen = words.length / Math.max(sentences.length, 1);
    if (avgLen > 25) ai += 15; else if (avgLen > 18) ai += 8; else human += 10;

    const diversity = new Set(words.map(w => w.toLowerCase())).size / Math.max(words.length, 1);
    if (diversity < 0.5) ai += 10; else if (diversity > 0.8) human += 8;

    const lens = sentences.map(s => s.trim().split(/\s+/).length);
    const mean = lens.reduce((a, b) => a + b, 0) / Math.max(lens.length, 1);
    const std = Math.sqrt(lens.reduce((s, l) => s + (l - mean) ** 2, 0) / Math.max(lens.length, 1));
    if (std < 4) ai += 12; else if (std > 8) human += 10;

    const total = ai + human;
    let aiPct = total > 0 ? Math.round((ai / total) * 100) : 50;
    if (words.length < 20) aiPct = Math.min(aiPct, 70);

    return { aiPercent: aiPct, humanPercent: 100 - aiPct, source: 'local' };
  }

  function applyAiResult(result) {
    const aiPct = result.aiPercent;
    const humanPct = 100 - aiPct;

    setText('v-ai-pct', `${aiPct}%`);
    setText('v-human-pct', `${humanPct}%`);

    const fill = document.getElementById('v-ai-fill');
    if (fill) {
      fill.style.width = `${aiPct}%`;
      fill.style.background = aiPct >= 70
        ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
        : aiPct >= 40
          ? 'linear-gradient(90deg,#3b82f6,#60a5fa)'
          : 'linear-gradient(90deg,#22c55e,#4ade80)';
    }

    const btn = document.getElementById('v-analyze');
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.35-4.35"></path></svg> Analyze AI`;
  }

  function persistAnalysis(result, text) {
    if (!reader) return;
    const docId = reader.getDocumentId();
    safeChrome(() => {
      chrome.storage.local.get(['analyses', 'documents'], (data) => {
        const analyses = data.analyses || [];
        analyses.push({
          document_id: docId,
          aiPercent: result.aiPercent,
          humanPercent: result.humanPercent,
          source: result.source,
          wordCount: text.split(/\s+/).filter(Boolean).length,
          timestamp: new Date().toISOString()
        });
        while (analyses.length > 200) analyses.shift();

        // Also attach to document record
        const documents = data.documents || [];
        const doc = documents.find(d => d.google_doc_id === docId);
        if (doc) doc.aiPercent = result.aiPercent;

        chrome.storage.local.set({ analyses, documents });
      });
    });
  }

  // ============================================================
  // SNAPSHOT + SYNC
  // ============================================================
  function capture() {
    if (!reader || !state.active) return;
    const snapshot = reader.getSnapshot();
    if (!snapshot) return;

    state.lastSnapshot = snapshot;
    updatePanel(snapshot);
    updateStatus(snapshot);

    // Persist if text changed OR keystrokes changed
    const textChanged = snapshot.hash !== state.lastHash;
    const keyChanged = state._lastKeystrokes !== state.keystrokes;
    if (!textChanged && !keyChanged) return;

    const prev = state.lastSnapshot;
    snapshot.delta = prev ? snapshot.charCount - prev.charCount : 0;
    state.lastHash = snapshot.hash;
    state._lastKeystrokes = state.keystrokes;
    persist(snapshot);
  }

  function updateStatus(snapshot) {
    const dot = document.getElementById('v-status-dot');
    const txt = document.getElementById('v-status-text');
    if (!dot || !txt) return;

    const extracted = snapshot && snapshot.text ? snapshot.text.length : 0;
    const net = Math.max(0, state.typedChars - state.deletedChars);

    if (extracted > 0) {
      dot.className = 'verifie-status-dot ok';
      txt.textContent = `Live • ${snapshot.wordCount} words • ${formatNumber(snapshot.charCount)} chars`;
    } else if (state.keystrokes > 0) {
      dot.className = 'verifie-status-dot ok';
      txt.textContent = `Live (keystrokes) • ~${formatNumber(net)} chars • ${state.keystrokes} keys`;
    } else {
      dot.className = 'verifie-status-dot warn';
      txt.textContent = 'Start typing to begin tracking…';
    }
  }

  function persist(snapshot) {
    const docId = snapshot.documentId;
    if (!docId) return;

    const hasText = snapshot.text && snapshot.text.length > 0;
    const netChars = Math.max(0, state.typedChars - state.deletedChars);

    // If no text extracted and no keystrokes, nothing to save
    if (!hasText && state.keystrokes === 0) return;

    safeChrome(() => {
      chrome.storage.local.get(['documents', 'revisions', 'trackingData'], (result) => {
        if (!result) return;
        const now = Date.now();
        const documents = result.documents || [];
        const revisions = result.revisions || [];

        const doc = documents.find(d => d.google_doc_id === docId);
        const rec = {
          google_doc_id: docId,
          title: snapshot.title,
          url: snapshot.url,
          // Prefer extracted text; fall back to keystroke estimate
          wordCount: hasText ? snapshot.wordCount : Math.round(netChars / 5),
          charCount: hasText ? snapshot.charCount : netChars,
          paragraphCount: hasText ? snapshot.paragraphCount : 0,
          readingTimeMinutes: hasText ? snapshot.readingTimeMinutes : Math.max(1, Math.ceil((netChars / 5) / 200)),
          typedChars: state.typedChars,
          deletedChars: state.deletedChars,
          keystrokes: state.keystrokes,
          textDetected: hasText,
          lastModified: new Date(now).toISOString(),
          firstSeen: doc ? doc.firstSeen : new Date(now).toISOString()
        };
        if (doc) Object.assign(doc, rec);
        else documents.push({ id: docId, ...rec });

        revisions.push({
          document_id: docId,
          timestamp: new Date(now).toISOString(),
          wordCount: rec.wordCount,
          charCount: rec.charCount,
          delta: snapshot.delta || 0
        });
        while (revisions.length > 500) revisions.shift();

        const tracking = result.trackingData || {};
        const sessionStart = tracking.sessionStart || now;
        chrome.storage.local.set({
          documents,
          revisions,
          trackingData: {
            ...tracking,
            active: state.active,
            charCount: documents.reduce((s, d) => s + (d.charCount || 0), 0),
            typedChars: state.typedChars,
            deletedChars: state.deletedChars,
            keystrokes: state.keystrokes,
            sessionStart,
            sessionDuration: now - sessionStart,
            lastUpdate: now,
            currentDoc: { id: docId, title: snapshot.title, wordCount: rec.wordCount, charCount: rec.charCount }
          }
        });
      });
    });
  }

  function openDashboard() {
    if (reader) persist(reader.getSnapshot());
    safeChrome(() => {
      window.open(chrome.runtime.getURL('dashboard/index.html'), '_blank');
    }, () => {
      window.open('https://hanezrafa.github.io/verifie/dashboard/', '_blank');
    });
  }

  function flashButton(id, msg, isError) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const original = btn.innerHTML;
    btn.innerHTML = msg;
    btn.style.background = isError ? '#fef2f2' : '';
    btn.style.color = isError ? '#ef4444' : '';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.style.background = '';
      btn.style.color = '';
    }, 1500);
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function safeChrome(fn, fallback) {
    try {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        if (fallback) return fallback();
        return;
      }
      return fn();
    } catch (e) {
      if (e && e.message && e.message.includes('context invalidated')) {
        clearInterval(state._interval);
        const panel = document.getElementById('verifie-panel');
        if (panel) panel.remove();
        return;
      }
      if (fallback) return fallback();
    }
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n ?? 0);
  }

  // ============================================================
  // MESSAGE LISTENER
  // ============================================================
  function setupMessages() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.onMessage) return;
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg) return;
      switch (msg.action) {
        case 'getLiveSnapshot':
          sendResponse({ snapshot: reader ? reader.getSnapshot() : null });
          break;
        case 'getContent':
          sendResponse({ content: reader ? reader.getText() : '' });
          break;
        case 'openDashboard':
          openDashboard();
          sendResponse({ success: true });
          break;
        case 'toggleTracking':
          state.active = msg.active !== false;
          sendResponse({ success: true, active: state.active });
          break;
        default:
          sendResponse({ success: false });
      }
      return true;
    });
  }

  // ============================================================
  // INIT
  // ============================================================
  function start() {
    createPanel();
    setupMessages();
    setupKeystrokeTracking();

    // Refresh iframe listeners periodically (Docs may add iframes later)
    setInterval(setupKeystrokeTracking, 10000);

    // Poll for content; also works with keystroke fallback
    let tries = 0;
    state._interval = setInterval(() => {
      tries++;
      if (reader && reader.isReady()) {
        capture();
      }
      if (tries === 5 && reader && reader.diagnose) {
        console.log('[Verifie] Diagnostics:', reader.diagnose());
      }
    }, 2000);

    // Always refresh panel from keystrokes as backup
    setInterval(() => {
      updatePanelFromKeystrokes();
      if (state.lastSnapshot) updateStatus(state.lastSnapshot);
      else updateStatus(null);
    }, 1000);

    // Session timer
    setInterval(tickSession, 1000);

    console.log('[Verifie] Panel injected');
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener('DOMContentLoaded', start);
  }
})();
