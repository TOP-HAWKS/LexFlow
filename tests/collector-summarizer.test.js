import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LexFlowApp } from '../src/js/app.js';

const summarizeTextMock = vi.fn();
const toastShowMock = vi.fn();
let confirmSpy;

vi.mock('../src/js/data-manager.js', () => ({
    DataManager: class {
        async init() {}
        async getUserData() { return {}; }
        async getHistory() { return []; }
        async getQueueItems() { return []; }
        async saveQueueItems() {}
        getDocuments() { return []; }
    }
}));

vi.mock('../src/js/toast-system.js', () => ({
    ToastSystem: class {
        constructor() {
            this.show = toastShowMock;
        }
    }
}));

vi.mock('../src/js/chrome-ai.js', () => ({
    ChromeAI: class {
        summarizeText(text, options, hooks) {
            return summarizeTextMock(text, options, hooks);
        }
    }
}));

vi.mock('../src/js/chrome-ai-extended.js', () => ({
    ChromeAIExtended: class {
        async detectLanguage() {
            return { success: false };
        }
        async translateText() {
            return { success: false };
        }
    }
}));

vi.spyOn(LexFlowApp.prototype, 'init').mockImplementation(() => Promise.resolve());

describe('Collector automatic summary (Summarizer API)', () => {
    let app;

    beforeEach(() => {
        summarizeTextMock.mockReset();
        toastShowMock.mockReset();

        document.body.innerHTML = `
            <textarea id="edit-text"></textarea>
            <small id="edit-text-char-count"></small>
            <div id="ai-summary-block" class="ai-summary-block hidden">
                <textarea id="ai-summary-text" readonly></textarea>
                <div class="ai-language-row">
                    <span id="ai-summary-status" class="badge secondary"></span>
                    <button id="generate-ai-summary-btn" type="button">Gerar resumo</button>
                </div>
            </div>
        `;

        app = new LexFlowApp();
        app.updateCapturedContentMetadata = vi.fn();
        app.summarizerModelReady = true;
        app.summarizerDownloadDeclined = false;

        confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    it('mantém bloco escondido para textos curtos', () => {
        const item = { id: 1, text: 'Conteúdo breve', metadata: {} };
        app.currentCollectorItem = item;

        const textArea = document.getElementById('edit-text');
        textArea.value = item.text;

        app.configureSummaryUI(item, { skipAuto: true });
        const summaryBlock = document.getElementById('ai-summary-block');
        const summaryBtn = document.getElementById('generate-ai-summary-btn');
        const summaryStatus = document.getElementById('ai-summary-status');

        expect(summaryBlock.classList.contains('hidden')).toBe(true);
        expect(summaryBtn.disabled).toBe(true);
        expect(summaryStatus.textContent).toContain('Texto curto');
        expect(summarizeTextMock).not.toHaveBeenCalled();
    });

    it('gera resumo automaticamente para textos longos', async () => {
        const item = { id: 2, text: 'a'.repeat(1200), metadata: {} };
        app.currentCollectorItem = item;

        summarizeTextMock.mockResolvedValue({
            success: true,
            result: 'Resumo automático gerado.',
            source: 'chrome-ai'
        });

        const textArea = document.getElementById('edit-text');
        textArea.value = item.text;

        // Configura UI sem gerar automaticamente para controlar teste
        app.configureSummaryUI(item, { skipAuto: true });
        const summaryBlock = document.getElementById('ai-summary-block');
        expect(summaryBlock.classList.contains('hidden')).toBe(false);
        await app.generateSummaryForCurrentItem({ auto: false });

        expect(summarizeTextMock).toHaveBeenCalledTimes(1);
        expect(summarizeTextMock).toHaveBeenCalledWith(
            item.text,
            expect.objectContaining({ format: 'markdown' }),
            expect.any(Object)
        );
        const summaryText = document.getElementById('ai-summary-text');
        const summaryBtn = document.getElementById('generate-ai-summary-btn');

        expect(summaryText.value).toBe('Resumo automático gerado.');
        expect(summaryBtn.disabled).toBe(false);
        expect(summaryBtn.textContent).toBe('Regenerar resumo');
        expect(item.metadata.ai.summary.text).toBe('Resumo automático gerado.');
        expect(app.updateCapturedContentMetadata).toHaveBeenCalledWith(2, expect.objectContaining({
            ai: expect.objectContaining({
                summary: expect.objectContaining({ text: 'Resumo automático gerado.' })
            })
        }));
    });

    it('exibe erro e mantém botão disponível quando a IA falha', async () => {
        const item = { id: 3, text: 'b'.repeat(1500), metadata: {} };
        app.currentCollectorItem = item;

        summarizeTextMock.mockResolvedValue({
            success: false,
            message: 'Modelo indisponível'
        });

        const textArea = document.getElementById('edit-text');
        textArea.value = item.text;

        app.configureSummaryUI(item, { skipAuto: true });
        await app.generateSummaryForCurrentItem({ auto: false });

        expect(summarizeTextMock).toHaveBeenCalledTimes(1);
        expect(toastShowMock).toHaveBeenCalledWith('Modelo indisponível', 'error');

        const summaryStatus = document.getElementById('ai-summary-status');
        const summaryBtn = document.getElementById('generate-ai-summary-btn');

        expect(summaryStatus.textContent).toContain('Modelo indisponível');
        expect(summaryBtn.disabled).toBe(false);
        expect(summaryBtn.textContent).toBe('Gerar resumo');
        expect(item.metadata.ai?.summary).toBeUndefined();
    });
});
    afterEach(() => {
        confirmSpy?.mockRestore();
    });
