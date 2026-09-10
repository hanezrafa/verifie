chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateBadge') {
    chrome.action.setBadgeText({
      text: message.count,
      tabId: sender.tab.id
    });
    chrome.action.setBadgeBackgroundColor({
      color: '#3b82f6',
      tabId: sender.tab.id
    });
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Verifie extension installed');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('docs.google.com/document')) {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/content.js']
    });
  }
});
