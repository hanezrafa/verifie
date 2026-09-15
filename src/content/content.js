(() => {
  'use strict';

  const reader = new GoogleDocsReader();

  // === Document Replay State ===
  const replay = {
    history: [],
    index: 0,
    playing: false,
    speed: 1
  };

  // === Real-time Sync ===
  const sync = {
    lastHash: '',
    lastSnapshot: null,
    trackingActive: true,
    intervalId: null,
    syncInterval: 2000
  };

  // === Init ===
  function init() {
    injectVerifieButtons();
    loadTrackingState();
    startRealTimeSync();
    setupMessageListener();
    setupTrackersIfAvailable();
    logStartup();
  }

  function logStartup() {
    console.log('[Verifie] Content script loaded for:', reader.getTitle());
    console.log('[Verifie] Document ID:', reader.getDocumentId());
  }

  // === Buttons injected into Google Docs toolbar ===
  function injectVerifieButtons() {
    if (document.getElementById('verifie-toolbar')) return;

    const toolbar = document.querySelector('.kix-toolbar') ||
                    document.querySelector('[role="toolbar"]');

    if (!toolbar) {
      setTimeout(injectVerifieButtons, 1000);
      return;
    }

    const container = document.createElement('div');
    container.id = 'verifie-toolbar';
    container.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:8px;z-index:9999;';

    // Live counter badge
    const counter = document.createElement('div');
    counter.id = 'verifie-counter';
    counter.style.cssText = `
      display:inline-flex;align-items:center;gap:6px;padding:5px 10px;
      background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;
      color:#1e40af;font-size:11px;font-weight:600;
      font-family:'Google Sans',Roboto,Arial,sans-serif;
    `;
    counter.innerHTML = `
      <span style="width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block;"></span>
      <span id="verifie-live-chars">0</span> chars
      <span style="color:#93c5fd;">•</span>
      <span id="verifie-live-time">00:00</span>
    `;

    // Dashboard button
    const dashBtn = document.createElement('button');
    dashBtn.id = 'verifie-dashboard-btn';
    dashBtn.style.cssText = `
      display:inline-flex;align-items:center;gap:6px;padding:6px 14px;
      background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);
      border:none;border-radius:6px;color:white;font-size:12px;font-weight:600;
      font-family:'Google Sans',Roboto,Arial,sans-serif;cursor:pointer;
      box-shadow:0 2px 8px rgba(59,130,246,0.35);transition:all .2s;
    `;
    dashBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"></rect>
        <rect x="14" y="3" width="7" height="7"></rect>
        <rect x="14" y="14" width="7" height="7"></rect>
        <rect x="3" y="14" width="7" height="7"></rect>
      </svg>
      Open Dashboard
    `;
    dashBtn.addEventListener('mouseenter', () => {
      dashBtn.style.transform = 'translateY(-1px)';
      dashBtn.style.boxShadow = '0 4px 14px rgba(59,130,246,0.5)';
    });
    dashBtn.addEventListener('mouseleave', () => {
      dashBtn.style.transform = 'translateY(0)';
      dashBtn.style.boxShadow = '0 2px 8px rgba(59,130,246,0.35)';
    });
    dashBtn.addEventListener('click', () => {
      // Sync latest snapshot immediately before opening dashboard
      const snapshot = reader.getSnapshot();
      persistSnapshot(snapshot);
      const dashUrl = chrome.runtime.getURL('dashboard/index.html');
      window.open(dashUrl, '_blank');
    });

    container.appendChild(counter);
    container.appendChild(dashBtn);
    toolbar.appendChild(container);
  }

  // === Real-time content sync ===
  function startRealTimeSync() {
    // Wait for docs to load
    const waitForReady = setInterval(() => {
      if (reader.isReady()) {
        clearInterval(waitForReady);
        captureSnapshot(); // initial
        sync.intervalId = setInterval(tick, sync.syncInterval);
      }
    }, 500);

    // Hard timeout after 30s
    setTimeout(() => clearInterval(waitForReady), 30000);
  }

  function tick() {
    if (!sync.trackingActive) return;
    captureSnapshot();
  }

  function captureSnapshot() {
    const snapshot = reader.getSnapshot();

    // Only record if content changed
    if (snapshot.hash === sync.lastHash) {
      updateLiveUI(snapshot);
      return;
    }

    const previous = sync.lastSnapshot;
    snapshot.delta = previous ? snapshot.charCount - previous.charCount : 0;

    sync.lastHash = snapshot.hash;
    sync.lastSnapshot = snapshot;

    persistSnapshot(snapshot);
    updateLiveUI(snapshot);

    // Notify popup if open
    notifyPopup(snapshot);
  }

  /**
   * Persist snapshot + derived stats into chrome.storage
   * This is what the dashboard reads.
   */
  function persistSnapshot(snapshot) {
    const docId = snapshot.documentId;
    if (!docId) return;

    chrome.storage.local.get(
      ['documents', 'revisions', 'trackingData', 'analyses'],
      (result) => {
        const now = Date.now();
        const documents = result.documents || [];
        const revisions = result.revisions || [];

        // Upsert document record
        let doc = documents.find(d => d.google_doc_id === docId);
        const docRecord = {
          google_doc_id: docId,
          title: snapshot.title,
          url: snapshot.url,
          wordCount: snapshot.wordCount,
          charCount: snapshot.charCount,
          charCountNoSpaces: snapshot.charCountNoSpaces,
          paragraphCount: snapshot.paragraphCount,
          sentenceCount: snapshot.sentenceCount,
          readingTimeMinutes: snapshot.readingTimeMinutes,
          lastModified: new Date(now).toISOString(),
          firstSeen: doc ? doc.firstSeen : new Date(now).toISOString()
        };

        if (doc) {
          Object.assign(doc, docRecord);
        } else {
          documents.push({ id: docId, ...docRecord });
        }

        // Append revision (cap at 500 to stay under quota)
        revisions.push({
          document_id: docId,
          timestamp: new Date(now).toISOString(),
          wordCount: snapshot.wordCount,
          charCount: snapshot.charCount,
          delta: snapshot.delta || 0,
          hash: snapshot.hash
        });
        while (revisions.length > 500) revisions.shift();

        // Update aggregate tracking data
        const tracking = result.trackingData || {};
        const sessionStart = tracking.sessionStart || now;
        const totalChars = documents.reduce((s, d) => s + (d.charCount || 0), 0);

        const trackingData = {
          ...tracking,
          active: sync.trackingActive,
          charCount: totalChars,
          keystrokes: tracking.keystrokes || 0,
          sessionStart,
          sessionDuration: now - sessionStart,
          lastUpdate: now,
          currentDoc: {
            id: docId,
            title: snapshot.title,
            wordCount: snapshot.wordCount,
            charCount: snapshot.charCount
          }
        };

        chrome.storage.local.set({ documents, revisions, trackingData });
      }
    );
  }

  function updateLiveUI(snapshot) {
    const charsEl = document.getElementById('verifie-live-chars');
    const timeEl = document.getElementById('verifie-live-time');
    if (charsEl) charsEl.textContent = formatNumber(snapshot.charCount);

    if (timeEl && sync.lastSnapshot) {
      // session timer handled by interval below
    }
  }

  // Update the live session timer every second
  setInterval(() => {
    const timeEl = document.getElementById('verifie-live-time');
    if (!timeEl) return;
    chrome.storage.local.get(['trackingData'], (result) => {
      const start = result.trackingData?.sessionStart || Date.now();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const s = (elapsed % 60).toString().padStart(2, '0');
      timeEl.textContent = `${m}:${s}`;
    });
  }, 1000);

  function notifyPopup(snapshot) {
    chrome.runtime.sendMessage({
      action: 'liveUpdate',
      snapshot: {
        title: snapshot.title,
        wordCount: snapshot.wordCount,
        charCount: snapshot.charCount,
        documentId: snapshot.documentId,
        lastModified: new Date().toISOString()
      }
    }).catch(() => {});
  }

  // === Optional advanced tracker (keystrokes/velocity) ===
  function setupTrackersIfAvailable() {
    if (typeof EditingTracker === 'undefined') return;

    window.verifieTracker = new EditingTracker({
      interval: 2000,
      onUpdate: (stats) => {
        chrome.storage.local.get(['trackingData'], (result) => {
          chrome.storage.local.set({
            trackingData: {
              ...(result.trackingData || {}),
              keystrokes: stats.keystrokes,
              charsTyped: stats.charsTyped,
              charsDeleted: stats.charsDeleted,
              velocity: stats.velocity,
              isIdle: stats.isIdle,
              active: stats.active
            }
          });
        });
      }
    });
  }

  function loadTrackingState() {
    chrome.storage.local.get(['trackingData'], (result) => {
      if (result.trackingData && result.trackingData.active === false) {
        sync.trackingActive = false;
        if (window.verifieTracker) window.verifieTracker.pause();
      }
    });
  }

  // === Messaging with popup ===
  function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.action) {
        case 'loadHistory': {
          const snapshot = reader.getSnapshot();
          sendResponse({
            title: snapshot.title,
            url: snapshot.url,
            documentId: snapshot.documentId,
            snapshot,
            stats: getStats(snapshot)
          });
          break;
        }

        case 'getContent': {
          sendResponse({ content: reader.getText(), snapshot: reader.getSnapshot() });
          break;
        }

        case 'getLiveSnapshot': {
          sendResponse({ snapshot: reader.getSnapshot() });
          break;
        }

        case 'toggleTracking': {
          sync.trackingActive = message.active;
          if (window.verifieTracker) {
            sync.trackingActive ? window.verifieTracker.resume() : window.verifieTracker.pause();
          }
          chrome.storage.local.get(['trackingData'], (result) => {
            chrome.storage.local.set({
              trackingData: { ...(result.trackingData || {}), active: sync.trackingActive }
            });
          });
          sendResponse({ success: true, active: sync.trackingActive });
          break;
        }

        case 'openDashboard': {
          const snapshot = reader.getSnapshot();
          persistSnapshot(snapshot);
          const dashUrl = chrome.runtime.getURL('dashboard/index.html');
          window.open(dashUrl, '_blank');
          sendResponse({ success: true });
          break;
        }

        case 'captureSnapshot': {
          captureSnapshot();
          sendResponse({ success: true, count: sync.history?.length || 0 });
          break;
        }

        case 'startReplay': {
          startReplay();
          sendResponse({ success: true });
          break;
        }

        case 'stopReplay': {
          replay.playing = false;
          sendResponse({ success: true });
          break;
        }

        case 'setSpeed': {
          replay.speed = message.speed;
          sendResponse({ success: true });
          break;
        }
      }
      return true;
    });
  }

  function getStats(snapshot) {
    return {
      words: snapshot.wordCount,
      chars: snapshot.charCount,
      deletes: 0,
      time: '0h 0m',
      edits: sync.history?.length || 0
    };
  }

  function startReplay() {
    replay.playing = true;
    replay.index = 0;
    const step = () => {
      if (!replay.playing || replay.index >= (sync.history?.length || 0) - 1) {
        replay.playing = false;
        return;
      }
      replay.index++;
      setTimeout(step, 1000 / replay.speed);
    };
    step();
  }

  // === Helpers ===
  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return String(num);
  }

  // Save session on unload
  window.addEventListener('beforeunload', () => {
    chrome.storage.local.get(['sessions', 'trackingData'], (result) => {
      const sessions = result.sessions || [];
      const t = result.trackingData || {};
      if (t.sessionStart) {
        sessions.push({
          id: Date.now(),
          documentTitle: reader.getTitle(),
          startTime: t.sessionStart,
          endTime: Date.now(),
          duration: Date.now() - t.sessionStart,
          charCount: t.charCount || 0
        });
        chrome.storage.local.set({ sessions: sessions.slice(-50) });
      }
    });
  });

  init();
})();
