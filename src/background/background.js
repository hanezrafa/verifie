// Verifie - Background Service Worker (MV3)

// Ensure the periodic alarm exists (idempotent)
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Verifie installed:', details.reason);

  chrome.alarms.create('verifie-cleanup', { periodInMinutes: 60 });

  if (details.reason === 'install') {
    // Open the dashboard on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
  }
});

// Also create the alarm on startup (service workers are ephemeral)
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('verifie-cleanup', { periodInMinutes: 60 });
});

// Periodic cleanup of old sessions (keep last 50)
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'verifie-cleanup') return;
  chrome.storage.local.get(['sessions'], (result) => {
    if (result.sessions && result.sessions.length > 50) {
      chrome.storage.local.set({ sessions: result.sessions.slice(-50) });
    }
  });
});

// Message handling from popup / content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'updateBadge': {
      const tabId = sender.tab?.id;
      if (typeof tabId === 'number') {
        chrome.action.setBadgeText({ text: String(message.count ?? ''), tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#3b82f6', tabId });
      }
      sendResponse({ ok: true });
      break;
    }

    case 'trackingUpdate': {
      if (sender.tab) {
        chrome.storage.local.get(['trackingData'], (result) => {
          const existing = result.trackingData || {};
          chrome.storage.local.set({
            trackingData: {
              ...existing,
              charCount: message.stats?.charsTyped ?? existing.charCount ?? 0,
              deletes: message.stats?.charsDeleted ?? existing.deletes ?? 0,
              keystrokes: message.stats?.keystrokes ?? existing.keystrokes ?? 0,
              lastUpdate: Date.now(),
              active: message.stats?.active ?? existing.active ?? true
            }
          });
        });
      }
      sendResponse({ ok: true });
      break;
    }

    case 'openDashboard': {
      chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
      sendResponse({ ok: true });
      break;
    }

    default:
      sendResponse({ ok: false, reason: 'unknown-action' });
  }

  return true; // keep channel open for async responses
});
