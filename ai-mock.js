// Local AI mock used only for testing. Exposes `_localMock` on window.
// This file is loaded separately so production `ai.js` doesn't embed test logic.
console.log('ai-mock.js carregado (mock separado) ✅');

window._localMock = {
  async summarize(text, lang = 'en') {
    const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
    return `--MOCK SUMMARIZER (${lang})--\n` + sentences.slice(0, 3).join(' ');
  },
  async prompt(text, lang = 'en') {
    return `--MOCK RESPONSE (${lang})--\n${text.slice(0, 200)}${text.length > 200 ? '…' : ''}`;
  }
};
