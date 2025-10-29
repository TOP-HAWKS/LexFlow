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
     * Check availability of Chrome AI APIs
     * @returns {Object} Availability status for each API
     */
    async checkAvailability() {
        if (this.available) return this.available;

        this.available = {
            ai: 'ai' in self,
            prompt: 'ai' in self && 'assistant' in self.ai,
            summarizer: 'ai' in self && 'summarizer' in self.ai,
            chromeVersion: this.getChromeVersion(),
            isCanary: this.isChromeCanary()
        };

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
            type: 'key-points', // 'key-points', 'teaser', 'headline'
            format: 'markdown', // 'plain-text'
            length: 'medium', // 'short', 'long'
            outputLanguage: 'en', // 'es', 'jp'
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
     * @returns {Object} Analysis result
     */
    async analyzeText(systemPrompt, userText, options = {}) {
        try {
            const assistant = await this.createAssistant(systemPrompt, options);
            const result = await assistant.prompt(userText);
            
            // Reset retry count on success
            this.retryCount = 0;
            
            return {
                success: true,
                result: result,
                source: 'chrome-ai',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return this.handleAIError(error, 'analyze');
        }
    }

    /**
     * Summarize text with AI
     * @param {string} text - Text to summarize
     * @param {Object} options - Summarizer options
     * @returns {Object} Summary result
     */
    async summarizeText(text, options = {}) {
        try {
            const summarizer = await this.createSummarizer(options);
            const result = await summarizer.summarize(text);
            
            this.retryCount = 0;
            
            return {
                success: true,
                result: result,
                source: 'chrome-ai',
                timestamp: new Date().toISOString()
            };
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