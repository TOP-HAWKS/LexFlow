function getSelectionText() {
  const sel = window.getSelection();
  return sel && sel.toString ? sel.toString() : "";
}

function getFullPageText() {
  // Extract full page text with 50k character limit
  const bodyText = document.body.innerText || document.body.textContent || "";
  const cleanText = bodyText.trim();
  
  // Limit to 50,000 characters as per requirements
  if (cleanText.length > 50000) {
    return cleanText.substring(0, 50000) + "\n\n[Content truncated at 50,000 characters]";
  }
  
  return cleanText;
}

function createCapturePayload(text, mode) {
  return {
    type: "LEXFLOW_CAPTURE_PAYLOAD",
    url: location.href,
    title: document.title,
    text: text.trim(),
    mode: mode, // 'selected' or 'full'
    lang: document.documentElement.lang || navigator.language,
    sourceHint: (document.querySelector('meta[name="citation_title"]')?.content || ""),
    timestamp: Date.now()
  };
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "LEXFLOW_GET_SELECTION") {
    const text = getSelectionText();
    if (!text) {
      console.warn("LexFlow: No text selected");
      return;
    }
    
    const payload = createCapturePayload(text, 'selected');
    chrome.runtime.sendMessage(payload);
  } else if (msg?.type === "LEXFLOW_GET_FULLPAGE") {
    const text = getFullPageText();
    if (!text || text.length < 10) {
      console.warn("LexFlow: No readable content found on page");
      chrome.runtime.sendMessage({
        type: "LEXFLOW_CAPTURE_ERROR",
        error: "No readable content found on this page"
      });
      return;
    }
    
    const payload = createCapturePayload(text, 'full');
    chrome.runtime.sendMessage(payload);
  }
});