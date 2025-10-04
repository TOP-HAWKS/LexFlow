function getSelectionText() {
  const sel = window.getSelection();
  return sel && sel.toString ? sel.toString() : "";
}
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "LEXFLOW_GET_SELECTION") {
    const text = getSelectionText().trim();
    const payload = {
      type: "LEXFLOW_SELECTION_PAYLOAD",
      url: location.href,
      title: document.title,
      text,
      lang: document.documentElement.lang || navigator.language,
      sourceHint: (document.querySelector('meta[name="citation_title"]')?.content || "")
    };
    chrome.runtime.sendMessage(payload);
  }
});