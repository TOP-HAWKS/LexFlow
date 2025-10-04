// LexFlow Service Worker (MV3)
import { addSubmission } from "./db.js";

chrome.runtime.onInstalled.addListener(() => {
  console.log('LexFlow installed.');
  
  // Remove existing context menus to avoid duplicates
  chrome.contextMenus.removeAll(() => {
    // Context menu for capturing selected text
    chrome.contextMenus.create({
      id: "lexflow_capture_selection",
      title: "LexFlow: capture selected law/article",
      contexts: ["selection"]
    });
    
    // Context menu for capturing full page (enhanced with character limit info)
    chrome.contextMenus.create({
      id: "lexflow_capture_fullpage",
      title: "LexFlow: capture FULL page (max 50k chars)",
      contexts: ["page"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "lexflow_capture_selection") {
      await chrome.tabs.sendMessage(tab.id, { type: "LEXFLOW_GET_SELECTION" });
    } else if (info.menuItemId === "lexflow_capture_fullpage") {
      await chrome.tabs.sendMessage(tab.id, { type: "LEXFLOW_GET_FULLPAGE" });
    }
  } catch (error) {
    console.error('Failed to send message to content script:', error);
    
    // Show error notification if content script is not available
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: '/assets/icon-48.png',
      title: 'LexFlow Error',
      message: 'Cannot capture content from this page. Try refreshing the page.'
    });
  }
});

// Receive capture payload from content script and store locally
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg?.type === "LEXFLOW_CAPTURE_PAYLOAD") {
    try {
      await addSubmission({
        ts: msg.timestamp || Date.now(),
        url: msg.url,
        title: msg.title,
        selectionText: msg.text,
        mode: msg.mode || 'selected', // 'selected' or 'full'
        lang: msg.lang || "pt-BR",
        jurisdiction: null,
        sourceHint: msg.sourceHint || "",
        status: "queued"
      });
      
      // Show success notification with mode-specific message
      const modeText = msg.mode === 'full' ? 'full page' : 'selection';
      const charCount = msg.text ? msg.text.length : 0;
      const message = `Content captured (${modeText}${charCount > 0 ? `, ${charCount} chars` : ''})`;
      
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: '/assets/icon-48.png',
        title: 'LexFlow',
        message: message
      });
      
      sendResponse?.({ ok: true, mode: msg.mode, charCount });
    } catch (error) {
      console.error('Failed to save captured content:', error);
      
      chrome.notifications?.create({
        type: 'basic',
        iconUrl: '/assets/icon-48.png',
        title: 'LexFlow Error',
        message: 'Failed to save captured content'
      });
      
      sendResponse?.({ ok: false, error: error.message });
    }
  } else if (msg?.type === "LEXFLOW_CAPTURE_ERROR") {
    // Show error notification
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: '/assets/icon-48.png',
      title: 'LexFlow Error',
      message: msg.error || 'Failed to capture content'
    });
    
    sendResponse?.({ ok: false, error: msg.error });
  }
  
  // Legacy support for old message type - will be deprecated
  if (msg?.type === "LEXFLOW_SELECTION_PAYLOAD") {
    try {
      await addSubmission({
        ts: Date.now(),
        url: msg.url,
        title: msg.title,
        selectionText: msg.text,
        mode: 'selected',
        lang: msg.lang || "pt-BR",
        jurisdiction: null,
        sourceHint: msg.sourceHint || "",
        status: "queued"
      });
      sendResponse?.({ ok: true });
    } catch (error) {
      console.error('Legacy capture failed:', error);
      sendResponse?.({ ok: false, error: error.message });
    }
  }
  
  // Return true to indicate we will respond asynchronously
  return true;
});