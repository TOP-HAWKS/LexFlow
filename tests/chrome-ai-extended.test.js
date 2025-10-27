import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChromeAIExtended } from '../src/js/chrome-ai-extended.js';

const originalSelf = globalThis.self;

describe('ChromeAIExtended.detectLanguage', () => {
    beforeEach(() => {
        // Garante que self aponte para o contexto global durante os testes.
        globalThis.self = globalThis;

        if (self.ai) {
            delete self.ai.languageDetector;
        }

        if (self.translation) {
            delete self.translation.languageDetector;
        }
    });

    afterEach(() => {
        if (self?.ai) {
            delete self.ai;
        }

        if (self?.translation) {
            delete self.translation;
        }

        if (originalSelf === undefined) {
            delete globalThis.self;
        } else {
            globalThis.self = originalSelf;
        }
    });

    it('retorna indisponível quando o binding não existe', async () => {
        const ai = new ChromeAIExtended({ logger: { error: vi.fn() } });

        const result = await ai.detectLanguage('Hello world!');

        expect(result.success).toBe(false);
        expect(result.error).toBe('language_detector_unavailable');
        expect(result.available).toBe('no');
    });

    it('retorna sinalização de download quando available = after-download', async () => {
        self.ai = {
            languageDetector: {
                capabilities: vi.fn(async () => ({ available: 'after-download' })),
                create: vi.fn()
            }
        };

        const ai = new ChromeAIExtended({ logger: { error: vi.fn() } });

        const result = await ai.detectLanguage('Contrato de prestação de serviço em inglês');

        expect(result.success).toBe(false);
        expect(result.available).toBe('after-download');
        expect(result.error).toBe('language_detector_model_download_required');
        expect(self.ai.languageDetector.create).not.toHaveBeenCalled();
    });

    it('detecta idioma quando o modelo está disponível', async () => {
        const detectMock = vi.fn(async () => ({
            languages: [{ language: 'en', confidence: 0.92 }]
        }));

        self.ai = {
            languageDetector: {
                capabilities: vi.fn(async () => ({ available: 'readily' })),
                create: vi.fn(async () => ({ detect: detectMock }))
            }
        };

        const ai = new ChromeAIExtended({ logger: { error: vi.fn() } });

        const result = await ai.detectLanguage('This is a sample contract in English.');

        expect(self.ai.languageDetector.capabilities).toHaveBeenCalledTimes(1);
        expect(self.ai.languageDetector.create).toHaveBeenCalledTimes(1);
        expect(detectMock).toHaveBeenCalledWith('This is a sample contract in English.', expect.any(Object));

        expect(result.success).toBe(true);
        expect(result.language).toBe('en');
        expect(result.confidence).toBeCloseTo(0.92);
        expect(result.available).toBe('readily');
    });
});

describe('ChromeAIExtended.translateText', () => {
    beforeEach(() => {
        globalThis.self = globalThis;

        if (self.ai) {
            delete self.ai.translator;
            delete self.ai.languageDetector;
            delete self.ai.createTranslator;
        }

        if (self.translation) {
            delete self.translation.translator;
            delete self.translation.createTranslator;
            delete self.translation.languageDetector;
        }
    });

    afterEach(() => {
        if (self?.ai) {
            delete self.ai;
        }

        if (self?.translation) {
            delete self.translation;
        }

        if (originalSelf === undefined) {
            delete globalThis.self;
        } else {
            globalThis.self = originalSelf;
        }
    });

    it('retorna indisponível quando o binding não existe', async () => {
        const ai = new ChromeAIExtended({ logger: { error: vi.fn() } });

        const result = await ai.translateText('Hello world', 'pt');

        expect(result.success).toBe(false);
        expect(result.error).toBe('translator_unavailable');
        expect(result.available).toBe('no');
    });

    it('solicita autorização de download quando available = after-download', async () => {
        const translatorInstance = {
            capabilities: vi.fn(),
            create: vi.fn()
        };

        self.translation = {
            translator: {
                capabilities: vi.fn(async () => ({ available: 'after-download' })),
                create: vi.fn(async () => translatorInstance)
            }
        };

        const ai = new ChromeAIExtended({ logger: { error: vi.fn() } });

        const result = await ai.translateText('Contrato em inglês', 'pt');

        expect(result.success).toBe(false);
        expect(result.available).toBe('after-download');
        expect(result.error).toBe('translator_model_download_required');
        expect(self.translation.translator.create).not.toHaveBeenCalled();
    });

    it('traduz texto quando o modelo está disponível', async () => {
        const translateMock = vi.fn(async () => ({
            text: 'Este é um contrato em inglês.',
            detectedSourceLanguage: 'en'
        }));

        self.translation = {
            translator: {
                capabilities: vi.fn(async () => ({ available: 'readily' })),
                create: vi.fn(async () => ({ translate: translateMock }))
            }
        };

        const ai = new ChromeAIExtended({ logger: { error: vi.fn() } });

        const result = await ai.translateText('This is a contract in English.', 'pt');

        expect(self.translation.translator.capabilities).toHaveBeenCalledTimes(1);
        expect(self.translation.translator.create).toHaveBeenCalledWith({
            sourceLanguage: undefined,
            targetLanguage: 'pt'
        });
        expect(translateMock).toHaveBeenLastCalledWith('This is a contract in English.', expect.any(Object));

        expect(result.success).toBe(true);
        expect(result.result).toBe('Este é um contrato em inglês.');
        expect(result.detectedLanguage).toBe('en');
        expect(result.to).toBe('pt');
        expect(result.available).toBe('readily');
    });

    it('falha quando texto excede limite permitido', async () => {
        self.translation = {
            translator: {
                capabilities: vi.fn(async () => ({ available: 'readily' })),
                create: vi.fn()
            }
        };

        const ai = new ChromeAIExtended({ logger: { error: vi.fn() } });

        const longText = 'a'.repeat(10_001);
        const result = await ai.translateText(longText, 'pt');

        expect(result.success).toBe(false);
        expect(result.error).toBe('input_too_large');
        expect(result.message).toMatch(/10000/);
        expect(self.translation.translator.create).not.toHaveBeenCalled();
    });
});
