/**
 * Chrome AI Integration for LexFlow
 * Handles Gemini Nano API calls with proper error handling
 */

export class ChromeAI {
    constructor() {
        this.available = null;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    /**
     * Progress logger for AI model downloads
     * @param {string} prefix - Prefix for logging
     * @returns {Function} Monitor function
     */
    progressLogger(prefix) {
        let lastProgress = 0;
        let isCompleted = false;

        return (m) => {
            console.debug(`[progressLogger] Registrando monitor para ${prefix}`, m);
            
            m.addEventListener('downloadprogress', (e) => {
                if (isCompleted) return; // Evita eventos de progresso após completar
                
                let pct = null;
                try {
                    if (typeof e.loaded === 'number' && typeof e.total === 'number' && e.total > 0) {
                        pct = Math.round((e.loaded / e.total) * 100);
                    } else if (typeof e.loaded === 'number') {
                        pct = Math.round(e.loaded * 100);
                    }
                } catch (err) {
                    console.warn(`[progressLogger] Erro ao calcular progresso:`, err);
                    pct = null;
                }

                // Evita atualizações desnecessárias
                if (pct === lastProgress) return;
                lastProgress = pct;

                console.debug(`[${prefix}] Download progresso: ${pct ?? '?'}%`);
                
                try {
                    window.dispatchEvent(new CustomEvent('ai-download-progress', { 
                        detail: { 
                            source: prefix, 
                            percent: pct,
                            loaded: e.loaded,
                            total: e.total
                        }
                    }));
                } catch (ex) {
                    console.error(`[progressLogger] Erro ao disparar evento de progresso:`, ex);
                }
            });

            m.addEventListener('downloadcomplete', () => {
                if (isCompleted) return;
                isCompleted = true;
                
                console.debug(`[${prefix}] Download completo`);
                try {
                    window.dispatchEvent(new CustomEvent('ai-download-complete', { 
                        detail: { source: prefix }
                    }));
                } catch (ex) {
                    console.error(`[progressLogger] Erro ao disparar evento de conclusão:`, ex);
                }
            });

            m.addEventListener('error', (err) => {
                console.error(`[${prefix}] Erro no download:`, err);
                try {
                    window.dispatchEvent(new CustomEvent('ai-download-error', { 
                        detail: { 
                            source: prefix, 
                            error: err?.message || String(err)
                        }
                    }));
                } catch (ex) {
                    console.error(`[progressLogger] Erro ao disparar evento de erro:`, ex);
                }
            });
        };
    }

    /**
     * Create model with timeout to avoid indefinite hangs
     * @param {Function} createFn - Function that creates the model
     * @param {Object} options - Options for model creation
     * @param {number} timeoutMs - Timeout in milliseconds (default: 60000)
     * @returns {Promise} Model creation result
     */
    async createWithTimeout(createFn, options, timeoutMs = 60000) {
        console.debug('[createWithTimeout] Iniciando criação do modelo com timeout de', timeoutMs, 'ms');
        const p = createFn(options);
        let timer = null;
        const timeout = new Promise((_, rej) => { 
            timer = setTimeout(() => {
                console.warn('[createWithTimeout] Timeout atingido após', timeoutMs, 'ms');
                rej(new Error('Timeout ao criar o modelo. Por favor, tente novamente.'));
            }, timeoutMs);
        });
        
        try {
            const res = await Promise.race([p, timeout]);
            console.debug('[createWithTimeout] Modelo criado com sucesso');
            clearTimeout(timer);
            return res;
        } catch (err) {
            console.error('[createWithTimeout] Erro ao criar modelo:', err);
            clearTimeout(timer);
            throw err;
        }
    }

    /**
     * Check availability of Chrome AI APIs
     * @returns {Object} Availability status for each API
     */
    async checkAvailability() {
        if (this.available) return this.available;

        // Verificação básica de existência - tentar ambas as APIs
        const basicCheck = {
            // APIs novas (self.ai.*)
            ai: 'ai' in self,
            prompt: 'ai' in self && 'assistant' in self.ai,
            summarizer: 'ai' in self && 'summarizer' in self.ai,
            // APIs antigas (diretas)
            oldSummarizer: 'Summarizer' in self,
            oldLanguageModel: 'LanguageModel' in self,
            chromeVersion: this.getChromeVersion(),
            isCanary: this.isChromeCanary()
        };

        // Se não tem nenhuma API, retorna imediatamente
        if (!basicCheck.ai && !basicCheck.oldSummarizer && !basicCheck.oldLanguageModel) {
            this.available = { ...basicCheck, functional: false };
            console.log('Chrome AI Availability:', this.available);
            return this.available;
        }

        // Teste funcional real para verificar se as APIs estão operacionais
        try {
            let promptFunctional = false;
            let summarizerFunctional = false;

            console.log('🔍 Iniciando teste funcional das APIs...');
            console.log('self.ai:', self.ai);
            console.log('self.ai.assistant:', self.ai?.assistant);
            console.log('self.ai.summarizer:', self.ai?.summarizer);

            // Teste da Prompt API (tentar APIs novas primeiro, depois antigas)
            if (basicCheck.prompt) {
                try {
                    console.log('🧪 Testando Prompt API (nova)...');
                    const testAssistant = await self.ai.assistant.create({ 
                        systemPrompt: "Você é um assistente útil." 
                    });
                    console.log('✅ Assistant criado:', testAssistant);
                    
                    const testResult = await testAssistant.prompt("Responda apenas 'OK'");
                    console.log('✅ Prompt resultado:', testResult);
                    
                    promptFunctional = testResult && testResult.length > 0;
                    console.log('✅ Prompt API funcional:', promptFunctional);
                } catch (error) {
                    console.warn('❌ Prompt API nova falhou, tentando antiga...', error.message);
                    promptFunctional = false;
                }
            }
            
            // Tentar API antiga se a nova não funcionou
            if (!promptFunctional && basicCheck.oldLanguageModel) {
                try {
                    console.log('🧪 Testando LanguageModel API (antiga)...');
                    const modelOpts = {
                        expectedInputs: [{ type: "text", languages: ["en", "es"] }],
                        expectedOutputs: [{ type: "text", languages: ["en", "es"] }]
                    };
                    const availability = await LanguageModel.availability(modelOpts);
                    if (availability !== 'unavailable') {
                        const session = await LanguageModel.create({
                            ...modelOpts,
                            initialPrompts: [{ role: 'system', content: "Você é um assistente útil." }]
                        });
                        const testResult = await session.prompt("Responda apenas 'OK'");
                        console.log('✅ LanguageModel resultado:', testResult);
                        promptFunctional = testResult && testResult.length > 0;
                        console.log('✅ LanguageModel API funcional:', promptFunctional);
                    }
                } catch (error) {
                    console.error('❌ LanguageModel API functional test failed:', error);
                    promptFunctional = false;
                }
            }

            // Teste da Summarizer API (tentar APIs novas primeiro, depois antigas)
            if (basicCheck.summarizer) {
                try {
                    console.log('🧪 Testando Summarizer API (nova)...');
                    const testSummarizer = await self.ai.summarizer.create();
                    console.log('✅ Summarizer criado:', testSummarizer);
                    
                    const testResult = await testSummarizer.summarize("Este é um texto de teste para verificar se o resumidor funciona corretamente.");
                    console.log('✅ Summarizer resultado:', testResult);
                    
                    summarizerFunctional = testResult && testResult.length > 0;
                    console.log('✅ Summarizer API funcional:', summarizerFunctional);
                } catch (error) {
                    console.warn('❌ Summarizer API nova falhou, tentando antiga...', error.message);
                    summarizerFunctional = false;
                }
            }
            
            // Tentar API antiga se a nova não funcionou
            if (!summarizerFunctional && basicCheck.oldSummarizer) {
                try {
                    console.log('🧪 Testando Summarizer API...');
                    const options = {
                        type: 'key-points',
                        format: 'markdown',
                        length: 'medium',
                        outputLanguage: 'en'
                    };
                    const availability = await Summarizer.availability(options);
                    if (availability !== 'unavailable') {
                        const summarizer = await Summarizer.create(options);
                        const testResult = await summarizer.summarize("Este é um texto de teste para verificar se o resumidor funciona corretamente.");
                        console.log('✅ Summarizer resultado:', testResult);
                        summarizerFunctional = testResult && testResult.length > 0;
                        console.log('✅ Summarizer API funcional:', summarizerFunctional);
                    }
                } catch (error) {
                    console.error('❌ Summarizer API functional test failed:', error);
                    summarizerFunctional = false;
                }
            }

            this.available = {
                ...basicCheck,
                prompt: promptFunctional,
                summarizer: summarizerFunctional,
                functional: promptFunctional || summarizerFunctional
            };

        } catch (error) {
            console.warn('Chrome AI functional test failed:', error);
            this.available = {
                ...basicCheck,
                functional: false
            };
        }

        console.log('Chrome AI Availability:', this.available);
        return this.available;
    }

    /**
     * Get Chrome version
     * @returns {string} Chrome version or 'unknown'
     */
    getChromeVersion() {
        const match = navigator.userAgent.match(/Chrome\/(\d+)/);
        return match ? match[1] : 'unknown';
    }

    /**
     * Check if running Chrome Canary
     * @returns {boolean} True if Chrome Canary
     */
    isChromeCanary() {
        return navigator.userAgent.includes('Chrome') && 
               (navigator.userAgent.includes('Canary') || 
                navigator.userAgent.includes('Dev') ||
                parseInt(this.getChromeVersion()) >= 120);
    }

    /**
     * Create AI assistant with system prompt
     * @param {string} systemPrompt - System prompt for the assistant
     * @param {Object} options - Additional options
     * @returns {Object} AI assistant instance
     */
    async createAssistant(systemPrompt, options = {}) {
        const availability = await this.checkAvailability();
        
        if (!availability.prompt) {
            throw new Error('Prompt API não disponível. Verifique se você está usando Chrome Canary com as flags habilitadas.');
        }

        const config = {
            systemPrompt: systemPrompt,
            ...options
        };

        try {
            return await self.ai.assistant.create(config);
        } catch (error) {
            console.error('Error creating AI assistant:', error);
            throw new Error(`Erro ao criar assistente de IA: ${error.message}`);
        }
    }

    /**
     * Create AI summarizer
     * @param {Object} options - Summarizer options
     * @returns {Object} AI summarizer instance
     */
    async createSummarizer(options = {}) {
        const availability = await this.checkAvailability();
        
        if (!availability.summarizer) {
            throw new Error('Summarizer API não disponível. Verifique se você está usando Chrome Canary com as flags habilitadas.');
        }

        const config = {
            type: 'tl;dr', // 'key-points', 'teaser', 'headline'
            format: 'markdown', // 'plain-text'
            length: 'medium', // 'short', 'long'
            ...options
        };

        try {
            return await self.ai.summarizer.create(config);
        } catch (error) {
            console.error('Error creating AI summarizer:', error);
            throw new Error(`Erro ao criar resumidor de IA: ${error.message}`);
        }
    }

    /**
     * Analyze text with AI using custom prompt
     * @param {string} systemPrompt - System prompt
     * @param {string} userText - User text to analyze
     * @param {Object} options - Additional options
     * @param {string} options.outputLang - Output language (default: 'en')
     * @param {boolean} options.forceReal - Force real AI even if availability != 'available'
     * @returns {Object} Analysis result
     */
    async analyzeText(systemPrompt, userText, options = {}) {
        const { outputLang = 'en', forceReal = false, ...otherOptions } = options;
        try {
            // Check availability first
            const availability = await this.checkAvailability();
            if (!availability.prompt) {
                throw new Error("Prompt API não disponível. Verifique as configurações do Chrome.");
            }

            // Add explicit language instruction to system prompt
            const systemWithLang = `${systemPrompt}\nRespond in the following language: ${outputLang}.`;

            // Try new API first, then fallback to old API
            if (availability.prompt && 'ai' in self && 'assistant' in self.ai) {
                // Use new API
                const defaultOptions = {
                    expectedInputs: [{ type: "text", languages: ["en", "es"] }],
                    expectedOutputs: [{ type: "text", languages: [outputLang] }],
                    monitor: this.progressLogger("Assistant"),
                    ...otherOptions
                };

                const assistant = await self.ai.assistant.create({
                    systemPrompt: systemWithLang,
                    ...defaultOptions
                });
                const result = await assistant.prompt(userText);
                
                this.retryCount = 0;
                
                return {
                    success: true,
                    result: result,
                    source: 'chrome-ai-assistant',
                    timestamp: new Date().toISOString()
                };
            } else if ('LanguageModel' in self) {
                // Use old API (like in your working example)
                const modelOpts = {
                    expectedInputs: [{ type: "text", languages: ["en", "es"] }],
                    expectedOutputs: [{ type: "text", languages: [outputLang] }],
                    monitor: this.progressLogger("LanguageModel"),
                    ...otherOptions
                };
                
                const availability = await LanguageModel.availability(modelOpts);
                
                // Fallback inteligente: tentar forçar criação se forceReal = true
                if (availability !== 'available') {
                    if (forceReal && navigator.userActivation.isActive) {
                        try {
                            console.debug('[analyzeText] Forçando uso real apesar de availability=', availability);
                            const session = await this.createWithTimeout(
                                (opts) => LanguageModel.create({
                                    ...opts,
                                    initialPrompts: [{ role: 'system', content: systemWithLang }]
                                }),
                                modelOpts
                            );
                            const result = await session.prompt(userText);
                            
                            this.retryCount = 0;
                            
                            return {
                                success: true,
                                result: result,
                                source: 'chrome-ai-language-model-forced',
                                timestamp: new Date().toISOString()
                            };
                        } catch (e) {
                            console.warn('[analyzeText] Falha ao criar session forçada:', e);
                            throw new Error(`LanguageModel indisponível. Tentativa forçada falhou: ${e.message}`);
                        }
                    } else {
                        throw new Error("LanguageModel indisponível no dispositivo.");
                    }
                }

                // Handle large text by chunking (like in working example)
                const CHUNK_LIMIT = 1500;
                
                if (userText.length <= CHUNK_LIMIT) {
                    const session = await this.createWithTimeout(
                        (opts) => LanguageModel.create({
                            ...opts,
                            initialPrompts: [{ role: 'system', content: systemWithLang }]
                        }),
                        modelOpts
                    );
                    const result = await session.prompt(userText);
                    
                    this.retryCount = 0;
                    
                    return {
                        success: true,
                        result: result,
                        source: 'chrome-ai-language-model',
                        timestamp: new Date().toISOString()
                    };
                } else {
                    // Handle large text with chunking
                    const parts = [];
                    for (let i = 0; i < userText.length; i += CHUNK_LIMIT) {
                        const sub = userText.slice(i, i + CHUNK_LIMIT);
                        const session = await this.createWithTimeout(
                            (opts) => LanguageModel.create({
                                ...opts,
                                initialPrompts: [{ role: 'system', content: systemWithLang }]
                            }),
                            modelOpts
                        );
                        const partial = await session.prompt(sub);
                        parts.push(partial);
                    }
                    
                    // Synthesize results with language instruction
                    const reduceSystemPrompt = [
                        "Você é um assistente jurídico. Sintetize as seguintes respostas parciais em uma resposta coerente.",
                        "Preserve citações no formato (LEI, ARTIGO).",
                        `Respond in the following language: ${outputLang}.`
                    ].join("\n");
                    
                    const reduceSession = await this.createWithTimeout(
                        (opts) => LanguageModel.create({
                            ...opts,
                            initialPrompts: [{ role: "system", content: reduceSystemPrompt }]
                        }),
                        modelOpts
                    );
                    const result = await reduceSession.prompt(parts.join("\n\n"));
                    
                    this.retryCount = 0;
                    
                    return {
                        success: true,
                        result: result,
                        source: 'chrome-ai-language-model-chunked',
                        timestamp: new Date().toISOString()
                    };
                }
            } else {
                throw new Error("Nenhuma API de prompt disponível.");
            }
        } catch (error) {
            return this.handleAIError(error, 'analyze');
        }
    }

    /**
     * Summarize text with AI
     * @param {string} text - Text to summarize
     * @param {Object} options - Summarizer options
     * @param {string} options.outputLang - Output language (default: 'en')
     * @param {boolean} options.forceReal - Force real AI even if availability != 'available'
     * @returns {Object} Summary result
     */
    async summarizeText(text, options = {}) {
        const { outputLang = 'en', forceReal = false, ...otherOptions } = options;
        try {
            // Check availability first
            const availability = await this.checkAvailability();
            if (!availability.summarizer) {
                throw new Error("Summarizer API não disponível. Verifique as configurações do Chrome.");
            }

            // Try new API first, then fallback to old API
            if (availability.summarizer && 'ai' in self && 'summarizer' in self.ai) {
                // Use new API
                const defaultOptions = {
                    type: 'key-points',
                    format: 'markdown',
                    length: 'medium',
                    outputLanguage: outputLang,
                    monitor: this.progressLogger("Summarizer"),
                    ...otherOptions
                };

                const summarizer = await self.ai.summarizer.create(defaultOptions);
                const result = await summarizer.summarize(text);
                
                this.retryCount = 0;
                
                return {
                    success: true,
                    result: result,
                    source: 'chrome-ai-summarizer',
                    timestamp: new Date().toISOString()
                };
            } else if ('Summarizer' in self) {
                // Use old API (like in your working example)
                const defaultOptions = {
                    type: 'key-points',
                    format: 'markdown',
                    length: 'medium',
                    outputLanguage: outputLang,
                    monitor: this.progressLogger("Summarizer"),
                    ...otherOptions
                };

                const availability = await Summarizer.availability(defaultOptions);
                
                // Fallback inteligente: tentar forçar criação se forceReal = true
                if (availability !== 'available') {
                    if (forceReal && navigator.userActivation.isActive) {
                        try {
                            console.debug('[summarizeText] Forçando uso real apesar de availability=', availability);
                            const summarizer = await this.createWithTimeout(
                                (opts) => Summarizer.create(opts),
                                defaultOptions
                            );
                            const result = await summarizer.summarize(text);
                            
                            this.retryCount = 0;
                            
                            return {
                                success: true,
                                result: result,
                                source: 'chrome-ai-summarizer-forced',
                                timestamp: new Date().toISOString()
                            };
                        } catch (e) {
                            console.warn('[summarizeText] Falha ao criar summarizer forçado:', e);
                            throw new Error(`Summarizer indisponível. Tentativa forçada falhou: ${e.message}`);
                        }
                    } else {
                        throw new Error("Summarizer indisponível no dispositivo.");
                    }
                }

                const summarizer = await this.createWithTimeout(
                    (opts) => Summarizer.create(opts),
                    defaultOptions
                );
                const result = await summarizer.summarize(text);
                
                this.retryCount = 0;
                
                return {
                    success: true,
                    result: result,
                    source: 'chrome-ai-summarizer-old',
                    timestamp: new Date().toISOString()
                };
            } else {
                throw new Error("Nenhuma API de resumo disponível.");
            }
        } catch (error) {
            return this.handleAIError(error, 'summarize');
        }
    }

    /**
     * Handle AI operation errors
     * @param {Error} error - The error object
     * @param {string} operation - The operation that failed
     * @returns {Object} Error response
     */
    handleAIError(error, operation) {
        console.error(`Erro na operação ${operation}:`, error);

        let errorType = 'unknown';
        let message = 'Erro inesperado na IA. Tente novamente.';
        let fallback = 'retry';
        let retryable = true;

        if (error.message.includes('not available') || error.message.includes('undefined')) {
            errorType = 'ai_not_available';
            message = 'Chrome AI não está disponível. Verifique as configurações do Chrome Canary e as flags experimentais.';
            fallback = 'setup_required';
            retryable = false;
        } else if (error.message.includes('quota') || error.message.includes('limit')) {
            errorType = 'rate_limited';
            message = 'Limite de uso da IA atingido. Tente novamente em alguns minutos.';
            fallback = 'retry_later';
            retryable = true;
        } else if (error.message.includes('model')) {
            errorType = 'model_loading';
            message = 'Modelo de IA não disponível. O modelo pode ainda estar sendo baixado.';
            fallback = 'retry_later';
            retryable = true;
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorType = 'network_error';
            message = 'Erro de rede. Verifique sua conexão.';
            fallback = 'retry';
            retryable = true;
        }

        return {
            success: false,
            error: errorType,
            message: message,
            fallback: fallback,
            retryable: retryable,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Test AI functionality
     * @returns {Object} Test results
     */
    async testAI() {
        const results = {
            availability: await this.checkAvailability(),
            promptTest: null,
            summarizerTest: null
        };

        try {
            // Test Prompt API
            if (results.availability.prompt) {
                const promptResult = await this.analyzeText(
                    'Você é um assistente útil.',
                    'Diga olá em português.'
                );
                results.promptTest = {
                    success: promptResult.success,
                    result: promptResult.success ? promptResult.result : promptResult.message
                };
            }

            // Test Summarizer API
            if (results.availability.summarizer) {
                const summaryResult = await this.summarizeText(
                    'Este é um texto longo que precisa ser resumido para testar a funcionalidade do resumidor de IA integrado ao Chrome. O texto contém várias informações importantes que devem ser condensadas em um resumo conciso e útil.'
                );
                results.summarizerTest = {
                    success: summaryResult.success,
                    result: summaryResult.success ? summaryResult.result : summaryResult.message
                };
            }

        } catch (error) {
            console.error('Error testing AI:', error);
        }

        return results;
    }

    /**
     * Detect which AI provider to use based on prompt content and preset
     * @param {string} promptText - User prompt text
     * @param {string} presetType - Selected preset type
     * @returns {Object} { provider: 'summarizer'|'assistant', options: Object }
     */
    detectAIProvider(promptText, presetType) {
        const text = promptText.toLowerCase();
        
        // Detect language preference
        let outputLang = 'en';
        if (text.includes('português') || text.includes('portugues') || text.includes('pt-br')) {
            outputLang = 'pt';
        } else if (text.includes('espanhol') || text.includes('español')) {
            outputLang = 'es';
        }
        
        // Summarizer for summaries
        if (presetType === 'resumo' || 
            text.includes('resumo') || 
            text.includes('resumir') || 
            text.includes('síntese') ||
            text.includes('sintese') ||
            text.includes('pontos-chave') ||
            text.includes('pontos chave') ||
            text.includes('resumir') ||
            text.includes('sintetizar')) {
            return {
                provider: 'summarizer',
                options: {
                    outputLang: outputLang,
                    forceReal: false
                }
            };
        }
        
        // Assistant for complex analysis
        if (presetType === 'analise' || 
            presetType === 'comparacao' || 
            presetType === 'clausulas' ||
            text.includes('análise') || 
            text.includes('analise') ||
            text.includes('compare') || 
            text.includes('comparação') ||
            text.includes('comparacao') ||
            text.includes('cláusulas') ||
            text.includes('clausulas') ||
            text.includes('contrato') ||
            text.includes('interpretação') ||
            text.includes('interpretacao')) {
            return {
                provider: 'assistant',
                options: {
                    outputLang: outputLang,
                    forceReal: false
                }
            };
        }
        
        // Default to assistant (more versatile)
        return {
            provider: 'assistant',
            options: {
                outputLang: outputLang,
                forceReal: false
            }
        };
    }

    /**
     * Debug method to test Chrome AI APIs directly
     * Can be called from console: window.lexflowApp.chromeAI.debugTest()
     */
    async debugTest() {
        console.log('🔍 === DEBUG TESTE CHROME AI ===');
        
        // 1. Verificar se self.ai existe
        console.log('1. self.ai existe?', 'ai' in self);
        console.log('   self.ai:', self.ai);
        
        if (!('ai' in self)) {
            console.log('❌ self.ai não existe - Chrome AI não disponível');
            return;
        }

        // 2. Verificar assistant
        console.log('2. self.ai.assistant existe?', 'assistant' in self.ai);
        console.log('   self.ai.assistant:', self.ai.assistant);
        
        if ('assistant' in self.ai) {
            try {
                console.log('3. Testando criação de assistant...');
                const assistant = await self.ai.assistant.create({
                    systemPrompt: "Você é um assistente jurídico."
                });
                console.log('✅ Assistant criado:', assistant);
                
                console.log('4. Testando prompt...');
                const result = await assistant.prompt("Diga 'Teste OK'");
                console.log('✅ Resultado do prompt:', result);
                
            } catch (error) {
                console.error('❌ Erro no teste de assistant:', error);
            }
        }

        // 3. Verificar summarizer
        console.log('5. self.ai.summarizer existe?', 'summarizer' in self.ai);
        console.log('   self.ai.summarizer:', self.ai.summarizer);
        
        if ('summarizer' in self.ai) {
            try {
                console.log('6. Testando criação de summarizer...');
                const summarizer = await self.ai.summarizer.create();
                console.log('✅ Summarizer criado:', summarizer);
                
                console.log('7. Testando resumo...');
                const summary = await summarizer.summarize("Este é um texto de teste para verificar se o resumidor funciona.");
                console.log('✅ Resultado do resumo:', summary);
                
            } catch (error) {
                console.error('❌ Erro no teste de summarizer:', error);
            }
        }

        console.log('🔍 === FIM DEBUG TESTE ===');
    }

    /**
     * Get setup instructions for Chrome AI
     * @returns {Object} Setup instructions
     */
    getSetupInstructions() {
        return {
            title: 'Configuração do Chrome AI (Gemini Nano)',
            steps: [
                {
                    step: 1,
                    title: 'Instalar Chrome Canary',
                    description: 'Baixe e instale o Chrome Canary da página oficial do Google.',
                    url: 'https://www.google.com/chrome/canary/'
                },
                {
                    step: 2,
                    title: 'Habilitar Flags Experimentais',
                    description: 'Acesse chrome://flags e habilite as seguintes flags:',
                    flags: [
                        'chrome://flags/#prompt-api-for-gemini-nano',
                        'chrome://flags/#summarization-api-for-gemini-nano',
                        'chrome://flags/#built-in-ai-api'
                    ]
                },
                {
                    step: 3,
                    title: 'Reiniciar o Navegador',
                    description: 'Reinicie o Chrome Canary após habilitar as flags.'
                },
                {
                    step: 4,
                    title: 'Aguardar Download do Modelo',
                    description: 'O modelo Gemini Nano será baixado automaticamente na primeira execução.'
                }
            ],
            troubleshooting: [
                {
                    problem: 'APIs não disponíveis',
                    solution: 'Verifique se está usando Chrome Canary versão 120+ e se as flags estão habilitadas.'
                },
                {
                    problem: 'Modelo não carrega',
                    solution: 'Aguarde alguns minutos para o download do modelo ou reinicie o navegador.'
                },
                {
                    problem: 'Erros de quota',
                    solution: 'Aguarde alguns minutos antes de tentar novamente.'
                }
            ]
        };
    }
}