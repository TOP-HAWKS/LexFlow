// LexFlow Service Worker (MV3)

chrome.runtime.onInstalled.addListener(() => {
  console.log('LexFlow installed.');
  
  // Context menu for capturing selected text
  chrome.contextMenus.create({
    id: "lexflow_capture_selection",
    title: "LexFlow: capture selected law/article",
    contexts: ["selection"]
  });
  
  // Context menu for capturing full page
  chrome.contextMenus.create({
    id: "lexflow_capture_fullpage",
    title: "LexFlow: capture FULL page",
    contexts: ["page"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "lexflow_capture_selection") {
    chrome.tabs.sendMessage(tab.id, { type: "LEXFLOW_GET_SELECTION" });
  } else if (info.menuItemId === "lexflow_capture_fullpage") {
    chrome.tabs.sendMessage(tab.id, { type: "LEXFLOW_GET_FULLPAGE" });
  }
});

// Receive capture payload from content script and store locally
import { addSubmission } from "./db.js";
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "LEXFLOW_CAPTURE_PAYLOAD") {
    addSubmission({
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
    
    // Show success notification
    chrome.notifications?.create({
      type: 'basic',
      iconUrl: '/assets/icon-48.png',
      title: 'LexFlow',
      message: `Content captured (${msg.mode === 'full' ? 'full page' : 'selection'})`
    });
    
    sendResponse?.({ ok: true });
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
  
  // Legacy support for old message type
  if (msg?.type === "LEXFLOW_SELECTION_PAYLOAD") {
    addSubmission({
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
  }
});