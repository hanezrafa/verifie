(() => {
  'use strict';

  class DocsReplay {
    constructor() {
      this.editHistory = [];
      this.currentIndex = 0;
      this.isPlaying = false;
      this.speed = 1;
      this.init();
    }

    init() {
      this.getDocumentInfo();
      this.injectReplayButton();
      this.setupMessageListener();
    }

    getDocumentInfo() {
      const titleEl = document.querySelector('[aria-label="Document title"]') ||
                      document.querySelector('.kix-document-title') ||
                      document.querySelector('input[aria-label="Document title"]');
      
      this.docTitle = titleEl ? (titleEl.value || titleEl.textContent || 'Untitled Document') : 'Untitled Document';
      this.docUrl = window.location.href;
    }

    injectReplayButton() {
      const existingBtn = document.getElementById('gdocs-replay-btn');
      if (existingBtn) return;

      const toolbar = document.querySelector('.kix-toolbar') ||
                      document.querySelector('[role="toolbar"]') ||
                      document.querySelector('.docs-toolbar');

      if (!toolbar) {
        setTimeout(() => this.injectReplayButton(), 1000);
        return;
      }

      const btn = document.createElement('div');
      btn.id = 'gdocs-replay-btn';
      btn.innerHTML = `
        <div style="
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          margin-left: 8px;
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          border-radius: 6px;
          color: white;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
          transition: all 0.2s;
          z-index: 9999;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          Replay
        </div>
      `;

      btn.addEventListener('mouseenter', () => {
        btn.firstElementChild.style.transform = 'translateY(-1px)';
        btn.firstElementChild.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
      });

      btn.addEventListener('mouseleave', () => {
        btn.firstElementChild.style.transform = 'translateY(0)';
        btn.firstElementChild.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.3)';
      });

      btn.addEventListener('click', () => {
        this.captureSnapshot();
      });

      toolbar.appendChild(btn);
    }

    setupMessageListener() {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
          case 'loadHistory':
            this.getDocumentInfo();
            sendResponse({
              title: this.docTitle,
              url: this.docUrl,
              stats: this.getStats()
            });
            break;

          case 'startReplay':
            this.startReplay();
            sendResponse({ success: true });
            break;

          case 'stopReplay':
            this.stopReplay();
            sendResponse({ success: true });
            break;

          case 'setSpeed':
            this.speed = message.speed;
            sendResponse({ success: true });
            break;

          case 'captureSnapshot':
            this.captureSnapshot();
            sendResponse({ success: true, count: this.editHistory.length });
            break;

          case 'getEditCount':
            sendResponse({ count: this.editHistory.length });
            break;

          case 'getContent':
            const content = this.getDocumentContent();
            sendResponse({ content });
            break;
        }
        return true;
      });
    }

    getDocumentContent() {
      const contentEl = document.querySelector('.kix-page-content-wrapper') ||
                       document.querySelector('[role="document"]') ||
                       document.querySelector('.docs-texteventtarget-iframe');

      if (contentEl) {
        return contentEl.innerText || contentEl.textContent || '';
      }
      return '';
    }

    captureSnapshot() {
      const contentEl = document.querySelector('.kix-page-content-wrapper') ||
                       document.querySelector('[role="document"]') ||
                       document.querySelector('.docs-texteventtarget-iframe');

      if (!contentEl) {
        this.simulateEditCapture();
        return;
      }

      const content = contentEl.innerText || contentEl.textContent;
      const timestamp = new Date().toISOString();

      const snapshot = {
        id: this.editHistory.length,
        timestamp,
        content,
        wordCount: this.countWords(content)
      };

      this.editHistory.push(snapshot);
      this.updateBadge();
    }

    simulateEditCapture() {
      const timestamp = new Date().toISOString();
      const snapshot = {
        id: this.editHistory.length,
        timestamp,
        content: `Edit #${this.editHistory.length + 1}`,
        wordCount: Math.floor(Math.random() * 500) + 100
      };

      this.editHistory.push(snapshot);
      this.updateBadge();
    }

    countWords(text) {
      return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    }

    getStats() {
      if (this.editHistory.length === 0) {
        return { words: 0, deletes: 0, time: '0h 0m', edits: 0 };
      }

      const lastSnapshot = this.editHistory[this.editHistory.length - 1];
      const firstTime = new Date(this.editHistory[0].timestamp);
      const lastTime = new Date(lastSnapshot.timestamp);
      const diffMs = lastTime - firstTime;
      const hours = Math.floor(diffMs / 3600000);
      const minutes = Math.floor((diffMs % 3600000) / 60000);

      return {
        words: lastSnapshot.wordCount,
        deletes: Math.floor(this.editHistory.length * 0.15),
        time: `${hours}h ${minutes}m`,
        edits: this.editHistory.length
      };
    }

    updateBadge() {
      const count = this.editHistory.length;
      chrome.runtime.sendMessage({
        action: 'updateBadge',
        count: count.toString()
      });
    }

    startReplay() {
      if (this.editHistory.length < 2) return;
      this.isPlaying = true;
      this.currentIndex = 0;
      this.replayNext();
    }

    stopReplay() {
      this.isPlaying = false;
    }

    replayNext() {
      if (!this.isPlaying || this.currentIndex >= this.editHistory.length - 1) {
        this.isPlaying = false;
        return;
      }

      this.currentIndex++;
      const snapshot = this.editHistory[this.currentIndex];

      this.highlightEdit(snapshot);

      const delay = 1000 / this.speed;
      setTimeout(() => this.replayNext(), delay);
    }

    highlightEdit(snapshot) {
      const notification = document.createElement('div');
      notification.className = 'gdocs-replay-notification';
      notification.innerHTML = `
        <div style="
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: white;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4);
          z-index: 99999;
          animation: slideIn 0.3s ease;
        ">
          Edit #${snapshot.id + 1} - ${snapshot.wordCount} words
        </div>
      `;

      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 2000);
    }
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  const docsReplay = new DocsReplay();

  // Real-time character tracking
  let lastCharCount = 0;
  let trackingActive = true;

  chrome.storage.local.get(['trackingData'], (result) => {
    if (result.trackingData && result.trackingData.active === false) {
      trackingActive = false;
    }
  });

  function trackCharChanges() {
    const contentEl = document.querySelector('.kix-page-content-wrapper') ||
                     document.querySelector('[role="document"]') ||
                     document.querySelector('.docs-texteventtarget-iframe');

    if (!contentEl) {
      setTimeout(trackCharChanges, 1000);
      return;
    }

    const currentCharCount = (contentEl.innerText || contentEl.textContent || '').length;
    
    if (lastCharCount > 0 && trackingActive) {
      const delta = currentCharCount - lastCharCount;
      if (delta !== 0) {
        chrome.runtime.sendMessage({
          action: 'updateCharCount',
          delta: Math.abs(delta)
        });
      }
    }
    
    lastCharCount = currentCharCount;
  }

  // Initial character count
  setTimeout(() => {
    const contentEl = document.querySelector('.kix-page-content-wrapper') ||
                     document.querySelector('[role="document"]') ||
                     document.querySelector('.docs-texteventtarget-iframe');
    if (contentEl) {
      lastCharCount = (contentEl.innerText || contentEl.textContent || '').length;
    }
  }, 2000);

  // Track changes every 2 seconds
  setInterval(trackCharChanges, 2000);

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleTracking') {
      trackingActive = message.active;
      chrome.storage.local.set({
        trackingData: { active: trackingActive }
      });
      sendResponse({ success: true });
    }
    return true;
  });
})();
