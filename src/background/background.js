chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadge') {
    chrome.action.setBadgeText({
      text: message.count,
      tabId: sender.tab?.id
    });
    chrome.action.setBadgeBackgroundColor({
      color: '#3b82f6',
      tabId: sender.tab?.id
    });
  }

  if (message.action === 'trackingUpdate' && sender.tab) {
    // Persist tracking stats
    chrome.storage.local.get(['trackingData'], (result) => {
      const existing = result.trackingData || {};
      chrome.storage.local.set({
        trackingData: {
          ...existing,
          charCount: message.stats.charsTyped,
          deletes: message.stats.charsDeleted,
          keystrokes: message.stats.keystrokes,
          lastUpdate: Date.now(),
          active: message.stats.active
        }
      });
    });
  }

  return true;
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log('Verifie extension installed:', details.reason);

  if (details.reason === 'install') {
    // Open welcome/dashboard on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/index.html') });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('docs.google.com/document')) {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/shared/config.js', 'src/shared/editing-tracker.js', 'src/content/content.js']
    }).catch((err) => {
      console.warn('Script injection skipped:', err.message);
    });
  }
});

// Periodic cleanup of old sessions (keep last 50)
chrome.alarms?.create('cleanup', { periodInMinutes: 60 });
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    chrome.storage.local.get(['sessions'], (result) => {
      if (result.sessions && result.sessions.length > 50) {
        chrome.storage.local.set({ sessions: result.sessions.slice(-50) });
      }
    });
  }
});
