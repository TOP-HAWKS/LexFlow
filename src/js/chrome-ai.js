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

        // Check for new Chrome AI APIs
        const hasAI = 'ai' in self;
        const hasLanguageModel = hasAI && 'languageModel' in self.ai;
        const hasSummarizer = hasAI && 'summarizer' in self.ai;
        const hasAssistant = hasAI && 'assistant' in self.ai;

        this.available = {
            ai: hasAI,
            prompt: hasLanguageModel || hasAssistant,
            summarizer: hasSummarizer,
            languageModel: hasLanguageModel,
            assistant: hasAssistant,
            chromeVersion: this.getChromeVersion(),
            isCanary: this.isChromeCanary(),
            functional: false
        };

        console.log('API Detection:', {
            hasAI,
            hasLanguageModel,
            hasSummarizer,
            hasAssistant,
            selfAI: hasAI ? Object.keys(self.ai) : 'N/A'
        });

        // Test functional availability
        if (this.available.prompt || this.available.summarizer) {
            try {
                // Check capabilities first
                let canUseLanguageModel = false;
                let canUseSummarizer = false;

                if (this.available.languageModel) {
                    try {
                        const capabilities = await self.ai.languageModel.capabilities();
                        console.log('LanguageModel capabilities:', capabilities);
                        canUseLanguageModel = capabilities.available === 'readily';
                    } catch (capError) {
                        console.warn('LanguageModel capabilities check failed:', capError);
                    }
                }

                if (this.available.summarizer) {
                    try {
                        const capabilities = await self.ai.summarizer.capabilities();
                        console.log('Summarizer capabilities:', capabilities);
                        canUseSummarizer = capabilities.available === 'readily';
                    } catch (capError) {
                        console.warn('Summarizer capabilities check failed:', capError);
                    }
                }

                // Test functional availability based on capabilities
                if (canUseLanguageModel) {
                    const session = await self.ai.languageModel.create({
                        systemPrompt: 'You are a test assistant.',
                        outputLanguage: 'en'
                    });
                    await session.prompt('Hello');
                    this.available.functional = true;
                } else if (canUseSummarizer) {
                    const testSummarizer = await self.ai.summarizer.create({
                        outputLanguage: 'en'
                    });
                    await testSummarizer.summarize('This is a test text for summarization.');
                    this.available.functional = true;
                } else if (this.available.assistant) {
                    // Fallback to legacy Assistant API
                    const testAssistant = await self.ai.assistant.create({
                        systemPrompt: 'You are a test assistant.',
                        outputLanguage: 'en'
                    });
                    await testAssistant.prompt('Hello');
                    this.available.functional = true;
                } else {
                    this.available.functional = false;
                    this.available.error = 'No AI APIs are ready for use';
                }
            } catch (error) {
                console.warn('Chrome AI functional test failed:', error);
                this.available.functional = false;
                this.available.error = error.message;
            }
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
            throw new Error('Prompt API not available. Please verify you are using Chrome Canary with the required flags enabled.');
        }

        const config = {
            systemPrompt: systemPrompt,
            outputLanguage: 'en', // Required for new API
            ...options
        };

        try {
            // Check capabilities and use appropriate API
            if (availability.languageModel) {
                const capabilities = await self.ai.languageModel.capabilities();
                if (capabilities.available === 'readily') {
                    return await self.ai.languageModel.create(config);
                }
            }

            if (availability.assistant) {
                return await self.ai.assistant.create(config);
            }

            throw new Error('No compatible AI API available or ready');
        } catch (error) {
            console.error('Error creating AI assistant:', error);
            throw new Error(`Error creating AI assistant: ${error.message}`);
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
            throw new Error('Summarizer API not available. Please verify you are using Chrome Canary with the required flags enabled.');
        }

        const config = {
            type: 'key-points', // 'key-points', 'teaser', 'headline'
            format: 'markdown', // 'plain-text'
            length: 'medium', // 'short', 'long'
            outputLanguage: 'en', // Required - 'en', 'es', 'ja'
            ...options
        };

        try {
            // Check capabilities first
            const capabilities = await self.ai.summarizer.capabilities();
            if (capabilities.available !== 'readily') {
                throw new Error(`Summarizer not ready: ${capabilities.available}`);
            }

            return await self.ai.summarizer.create(config);
        } catch (error) {
            console.error('Error creating AI summarizer:', error);
            throw new Error(`Error creating AI summarizer: ${error.message}`);
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
        console.error(`Error in ${operation} operation:`, error);

        let errorType = 'unknown';
        let message = 'Unexpected AI error. Please try again.';
        let fallback = 'retry';
        let retryable = true;

        if (error.message.includes('not available') || error.message.includes('undefined')) {
            errorType = 'ai_not_available';
            message = 'Chrome AI is not available. Please check Chrome Canary settings and experimental flags.';
            fallback = 'setup_required';
            retryable = false;
        } else if (error.message.includes('quota') || error.message.includes('limit')) {
            errorType = 'rate_limited';
            message = 'AI usage limit reached. Please try again in a few minutes.';
            fallback = 'retry_later';
            retryable = true;
        } else if (error.message.includes('model')) {
            errorType = 'model_loading';
            message = 'AI model not available. The model may still be downloading.';
            fallback = 'retry_later';
            retryable = true;
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorType = 'network_error';
            message = 'Network error. Please check your connection.';
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
                    'You are a helpful assistant.',
                    'Say hello in English.'
                );
                results.promptTest = {
                    success: promptResult.success,
                    result: promptResult.success ? promptResult.result : promptResult.message
                };
            }

            // Test Summarizer API
            if (results.availability.summarizer) {
                const summaryResult = await this.summarizeText(
                    'This is a long text that needs to be summarized to test the functionality of the AI summarizer integrated into Chrome. The text contains various important information that should be condensed into a concise and useful summary.'
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
     * Detect which AI provider to use based on prompt and preset
     * @param {string} userPrompt - User prompt text
     * @param {string} presetType - Preset type (resumo, analise, etc.)
     * @returns {Object} Provider detection result
     */
    detectAIProvider(userPrompt, presetType) {
        // Default to assistant for complex analysis
        let provider = 'assistant';
        let options = {};

        // Use summarizer for summary-related tasks
        if (presetType === 'executive-summary' ||
            presetType === 'resumo' ||
            userPrompt.toLowerCase().includes('resumo') ||
            userPrompt.toLowerCase().includes('summary')) {
            provider = 'summarizer';
            options = {
                type: 'key-points',
                format: 'markdown',
                length: 'medium'
            };
        }

        return { provider, options };
    }

    /**
     * Get setup instructions for Chrome AI
     * @returns {Object} Setup instructions
     */
    getSetupInstructions() {
        return {
            title: 'Chrome AI Setup (Gemini Nano)',
            steps: [
                {
                    step: 1,
                    title: 'Install Chrome Canary',
                    description: 'Download and install Chrome Canary from the official Google page.',
                    url: 'https://www.google.com/chrome/canary/'
                },
                {
                    step: 2,
                    title: 'Enable Experimental Flags',
                    description: 'Go to chrome://flags and enable the following flags:',
                    flags: [
                        'chrome://flags/#prompt-api-for-gemini-nano',
                        'chrome://flags/#summarization-api-for-gemini-nano',
                        'chrome://flags/#built-in-ai-api'
                    ]
                },
                {
                    step: 3,
                    title: 'Restart Browser',
                    description: 'Restart Chrome Canary after enabling the flags.'
                },
                {
                    step: 4,
                    title: 'Wait for Model Download',
                    description: 'The Gemini Nano model will be downloaded automatically on first run.'
                }
            ],
            troubleshooting: [
                {
                    problem: 'APIs not available',
                    solution: 'Verify you are using Chrome Canary version 120+ and the flags are enabled.'
                },
                {
                    problem: 'Model does not load',
                    solution: 'Wait a few minutes for the model download or restart the browser.'
                },
                {
                    problem: 'Quota errors',
                    solution: 'Wait a few minutes before trying again.'
                }
            ]
        };
    }
}