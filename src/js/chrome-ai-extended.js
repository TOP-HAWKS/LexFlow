/**
 * Extensão das Chrome Built-in AI APIs para LexFlow.
 * Inicia com detecção de idioma utilizando Language Detector API.
 */

const NO_SELF_ENVIRONMENT = typeof self === 'undefined';
const MAX_TRANSLATE_CHARS = 10_000;

/**
 * Identifica o binding exposto pelo Chrome para a Language Detector API.
 * Pode variar entre `self.ai.languageDetector` e `self.translation.languageDetector`
 * a depender da versão/canal do navegador.
 * @returns {object|null}
 */
function resolveLanguageDetectorBinding() {
    if (NO_SELF_ENVIRONMENT) return null;

    if (self.ai?.languageDetector) return self.ai.languageDetector;

    if (self.translation?.languageDetector) return self.translation.languageDetector;

    return null;
}

/**
 * Identifica o binding exposto pelo Chrome para a Translator API.
 * @returns {object|null}
 */
function resolveTranslatorBinding() {
    if (NO_SELF_ENVIRONMENT) return null;

    if (self.translation?.translator) return self.translation.translator;

    if (self.translation?.createTranslator) return self.translation;

    if (self.ai?.translator) return self.ai.translator;

    if (self.ai?.createTranslator) return self.ai;

    return null;
}

/**
 * Obtém a função createTranslator a partir do binding detectado.
 * @param {object} binding
 * @returns {Function|null}
 */
function getCreateTranslatorFn(binding) {
    if (!binding) return null;
    if (typeof binding.createTranslator === 'function') return binding.createTranslator.bind(binding);
    if (typeof binding.create === 'function') return binding.create.bind(binding);
    if (typeof binding.translator?.create === 'function') {
        return binding.translator.create.bind(binding.translator);
    }

    return null;
}

/**
 * Normaliza o resultado retornado pela API para uma estrutura simples.
 * @param {any} detectionResult
 * @returns {{ language: string|null, confidence: number|null, raw: any }}
 */
function normalizeDetectionResult(detectionResult) {
    if (!detectionResult) {
        return { language: null, confidence: null, raw: detectionResult };
    }

    const languages = detectionResult.languages;
    if (Array.isArray(languages) && languages.length > 0) {
        const top = languages[0];
        return {
            language: top?.language ?? top?.detectedLanguage ?? null,
            confidence: typeof top?.confidence === 'number' ? top.confidence : null,
            raw: detectionResult
        };
    }

    // Fallback para formatos legados (ex.: { detectedLanguage, confidence })
    const language = detectionResult.detectedLanguage ?? detectionResult.language ?? null;
    const confidence = typeof detectionResult.confidence === 'number' ? detectionResult.confidence : null;

    return { language, confidence, raw: detectionResult };
}

/**
 * ChromeAIExtended - implementação inicial com detecção de idioma.
 */
export class ChromeAIExtended {
    /**
     * @param {{ logger?: Console }} options
     */
    constructor(options = {}) {
        this.logger = options.logger ?? console;
        this.languageDetectorBinding = resolveLanguageDetectorBinding();
        this.languageDetectorInstance = null;
        this.cachedCapabilities = null;
        this.translatorBinding = resolveTranslatorBinding();
        this.translatorInstance = null;
        this.cachedTranslatorCapabilities = null;
    }

    /**
     * Reseta instâncias e cache quando o binding muda ou por erro recuperável.
     */
    resetLanguageDetector() {
        this.languageDetectorInstance = null;
        this.cachedCapabilities = null;
        this.languageDetectorBinding = resolveLanguageDetectorBinding();
    }

    resetTranslator() {
        this.translatorInstance = null;
        this.cachedTranslatorCapabilities = null;
        this.translatorBinding = resolveTranslatorBinding();
    }

    /**
     * Obtém (ou cria) uma instância do detector de idioma.
     * @param {object} binding
     * @param {object} options
     * @returns {Promise<any>}
     */
    async getLanguageDetector(binding, options) {
        if (!options?.forceNew && this.languageDetectorInstance) {
            return this.languageDetectorInstance;
        }

        const instance = await binding.create(options?.createOptions ?? {});
        this.languageDetectorInstance = instance;
        return instance;
    }

    async getTranslator(binding, createOptions) {
        if (this.translatorInstance && !createOptions?.forceNew) {
            return this.translatorInstance;
        }

        const createTranslator = getCreateTranslatorFn(binding);
        if (!createTranslator) {
            throw new Error('Translator API: createTranslator não disponível neste binding.');
        }

        const translator = await createTranslator(createOptions?.createOptions ?? {});
        this.translatorInstance = translator;
        return translator;
    }

    /**
     * Detecta o idioma de um texto utilizando a API nativa do Chrome.
     * @param {string} text
     * @param {{ allowModelDownload?: boolean, signal?: AbortSignal, detectOptions?: object, createOptions?: object, forceNew?: boolean }} options
     * @returns {Promise<{ success: boolean, language?: string|null, confidence?: number|null, available?: string|null, message?: string, error?: string, raw?: any }>}
     */
    async detectLanguage(text, options = {}) {
        const binding = this.languageDetectorBinding ?? resolveLanguageDetectorBinding();
        this.languageDetectorBinding = binding;

        if (!binding) {
            return {
                success: false,
                available: 'no',
                error: 'language_detector_unavailable',
                message: 'Language Detector API não disponível neste navegador. Habilite as flags necessárias no Chrome Canary.'
            };
        }

        if (typeof text !== 'string' || text.trim().length === 0) {
            return {
                success: false,
                available: this.cachedCapabilities?.available ?? null,
                error: 'invalid_input',
                message: 'Forneça um texto não vazio para detecção de idioma.'
            };
        }

        const trimmed = text.trim();

        try {
            let capabilities = this.cachedCapabilities;
            if (!capabilities && typeof binding.capabilities === 'function') {
                capabilities = await binding.capabilities();
                this.cachedCapabilities = capabilities;
            }

            const availability = capabilities?.available ?? null;

            if (availability === 'no') {
                return {
                    success: false,
                    available: 'no',
                    error: 'language_detector_unavailable',
                    message: 'Language Detector API indisponível. Verifique se as flags experimentais estão habilitadas.'
                };
            }

            if (availability === 'after-download' && options.allowModelDownload !== true) {
                return {
                    success: false,
                    available: 'after-download',
                    error: 'language_detector_model_download_required',
                    message: 'O modelo de detecção precisa ser baixado. Autorize o download para continuar.'
                };
            }

            const detector = await this.getLanguageDetector(binding, {
                createOptions: options.createOptions,
                forceNew: options.forceNew === true
            });

            const detectOptions = { signal: options.signal, ...(options.detectOptions ?? {}) };
            const detectionResult = await detector.detect(trimmed, detectOptions);
            const normalized = normalizeDetectionResult(detectionResult);

            if (!normalized.language) {
                return {
                    success: false,
                    available: availability ?? 'unknown',
                    error: 'language_detection_failed',
                    message: 'Não foi possível identificar o idioma do conteúdo.',
                    raw: detectionResult
                };
            }

            return {
                success: true,
                language: normalized.language.toLowerCase(),
                confidence: normalized.confidence,
                available: availability ?? 'readily',
                raw: detectionResult
            };
        } catch (error) {
            this.logger?.error?.('[ChromeAIExtended] detectLanguage falhou', error);

            // Reseta instância para próxima tentativa, evitando ficar preso em estado inválido.
            if (options?.forceNew !== false) {
                this.resetLanguageDetector();
            }

            return {
                success: false,
                available: this.cachedCapabilities?.available ?? null,
                error: 'language_detector_error',
                message: error?.message ?? 'Falha inesperada ao detectar idioma. Tente novamente.',
                cause: error
            };
        }
    }

    /**
     * Traduz texto utilizando a API nativa do Chrome.
     * @param {string} text
     * @param {string} targetLanguage
     * @param {{ sourceLanguage?: string|null, allowModelDownload?: boolean, signal?: AbortSignal, createOptions?: object, translateOptions?: object, forceNew?: boolean }} options
     * @returns {Promise<{ success: boolean, result?: string, detectedLanguage?: string|null, from?: string|null, to?: string, available?: string|null, error?: string, message?: string, raw?: any }>}
     */
    async translateText(text, targetLanguage, options = {}) {
        const binding = this.translatorBinding ?? resolveTranslatorBinding();
        this.translatorBinding = binding;

        if (!binding) {
            return {
                success: false,
                available: 'no',
                error: 'translator_unavailable',
                message: 'Translator API não disponível neste navegador. Habilite as flags necessárias no Chrome Canary.'
            };
        }

        if (!targetLanguage || typeof targetLanguage !== 'string') {
            return {
                success: false,
                available: this.cachedTranslatorCapabilities?.available ?? null,
                error: 'invalid_target_language',
                message: 'Informe o idioma de destino (por exemplo, "pt").'
            };
        }

        if (typeof text !== 'string' || text.trim().length === 0) {
            return {
                success: false,
                available: this.cachedTranslatorCapabilities?.available ?? null,
                error: 'invalid_input',
                message: 'Forneça um texto não vazio para tradução.'
            };
        }

        const trimmed = text.trim();

        if (trimmed.length > MAX_TRANSLATE_CHARS) {
            return {
                success: false,
                available: this.cachedTranslatorCapabilities?.available ?? null,
                error: 'input_too_large',
                message: `Texto muito extenso para tradução nesta etapa (>${MAX_TRANSLATE_CHARS} caracteres).`
            };
        }

        try {
            let capabilities = this.cachedTranslatorCapabilities;
            if (!capabilities && typeof binding.capabilities === 'function') {
                capabilities = await binding.capabilities();
                this.cachedTranslatorCapabilities = capabilities;
            }

            const availability = capabilities?.available ?? null;

            if (availability === 'no') {
                return {
                    success: false,
                    available: 'no',
                    error: 'translator_unavailable',
                    message: 'Translator API indisponível. Verifique se as flags experimentais estão habilitadas.'
                };
            }

            if (availability === 'after-download' && options.allowModelDownload !== true) {
                return {
                    success: false,
                    available: 'after-download',
                    error: 'translator_model_download_required',
                    message: 'O modelo de tradução precisa ser baixado. Autorize o download para continuar.'
                };
            }

            const translator = await this.getTranslator(binding, {
                createOptions: {
                    sourceLanguage: options.sourceLanguage ?? undefined,
                    targetLanguage,
                    ...(options.createOptions ?? {})
                },
                forceNew: options.forceNew === true
            });

            const translateOptions = {
                signal: options.signal,
                ...(options.translateOptions ?? {})
            };

            if (typeof translator.translate !== 'function') {
                throw new Error('Translator API: método translate não encontrado na instância.');
            }

            const translationResult = await translator.translate(trimmed, translateOptions);

            const translatedText = typeof translationResult === 'string'
                ? translationResult
                : translationResult?.text ?? translationResult?.translatedText ?? null;

            if (!translatedText) {
                return {
                    success: false,
                    available: availability ?? 'readily',
                    error: 'translator_no_output',
                    message: 'Tradução não retornou resultado utilizável.',
                    raw: translationResult
                };
            }

            const detectedLanguage = translationResult?.detectedSourceLanguage
                ?? translationResult?.sourceLanguage
                ?? null;

            return {
                success: true,
                result: translatedText,
                detectedLanguage,
                from: detectedLanguage ?? (options.sourceLanguage ?? null),
                to: targetLanguage,
                available: availability ?? 'readily',
                raw: translationResult
            };
        } catch (error) {
            this.logger?.error?.('[ChromeAIExtended] translateText falhou', error);

            if (options?.forceNew !== false) {
                this.resetTranslator();
            }

            return {
                success: false,
                available: this.cachedTranslatorCapabilities?.available ?? null,
                error: 'translator_error',
                message: error?.message ?? 'Falha inesperada ao traduzir texto. Tente novamente.',
                cause: error
            };
        }
    }
}

export default ChromeAIExtended;
