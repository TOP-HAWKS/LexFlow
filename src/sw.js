// LexFlow Service Worker (MV3)

chrome.runtime.onInstalled.addListener(() => {
  console.log('LexFlow installed.');
  // Context menu for capturing selected text
  chrome.contextMenus.create({
    id: "lexflow_capture_selection",
    title: "LexFlow: capture selected law/article",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "lexflow_capture_selection") {
    chrome.tabs.sendMessage(tab.id, { type: "LEXFLOW_GET_SELECTION" });
  }
});

// Receive selection payload from content script and store locally
import { addSubmission } from "./db.js";
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "LEXFLOW_SELECTION_PAYLOAD") {
    addSubmission({
      ts: Date.now(),
      url: msg.url,
      title: msg.title,
      selectionText: msg.text,
      lang: msg.lang || "pt-BR",
      jurisdiction: null,
      sourceHint: msg.sourceHint || "",
      status: "queued"
    });
    sendResponse?.({ ok: true });
  }
});