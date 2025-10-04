/**
 * LexFlow SPA Application Controller
 * Manages hash-based routing, view switching, and core functionality
 */

class LexFlowApp {
    constructor() {
        this.currentView = 'home';
        this.currentStep = 1;
        this.routes = {
            'home': () => this.showView('home'),
            'workspace': () => this.showView('workspace'),
            'collector': () => this.showView('collector'),
            'settings': () => this.showModal('settings')
        };
        
        // Initialize asynchronously
        this.init().catch(console.error);
    }

    /**
     * Initialize the application
     */
    async init() {
        this.initRouter();
        this.initEventListeners();
        this.initToastSystem();
        
        // Load settings on startup
        await this.loadSettings();
        
        this.loadInitialView();
        
        console.log('LexFlow SPA initialized');
    }

    /**
     * Initialize hash-based router
     */
    initRouter() {
        // Listen for hash changes
        window.addEventListener('hashchange', () => {
            this.handleRouteChange();
        });

        // Handle initial route
        this.handleRouteChange();
    }

    /**
     * Handle route changes
     */
    handleRouteChange() {
        const hash = window.location.hash.slice(1) || 'home';
        const route = this.routes[hash];
        
        if (route) {
            route();
            this.updateNavigationState(hash);
        } else {
            // Default to home if route not found
            this.navigate('home');
        }
    }

    /**
     * Navigate to a specific route
     * @param {string} route - The route to navigate to
     */
    navigate(route) {
        if (this.routes[route]) {
            window.location.hash = route;
        }
    }

    /**
     * Show a specific view
     * @param {string} viewName - The view to show
     */
    showView(viewName) {
        // Add loading state
        document.body.classList.add('loading');
        
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Show target view with animation
        setTimeout(() => {
            const targetView = document.getElementById(`${viewName}-view`);
            if (targetView) {
                targetView.classList.add('active');
                this.currentView = viewName;
                
                // Initialize view-specific functionality
                this.initViewFunctionality(viewName);
            }
            
            // Remove loading state
            document.body.classList.remove('loading');
        }, 100);
    }

    /**
     * Update navigation tab states
     * @param {string} activeRoute - The currently active route
     */
    updateNavigationState(activeRoute) {
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.view === activeRoute) {
                tab.classList.add('active');
            }
        });
    }

    /**
     * Initialize view-specific functionality
     * @param {string} viewName - The view being initialized
     */
    initViewFunctionality(viewName) {
        switch (viewName) {
            case 'home':
                this.initHomeView();
                break;
            case 'workspace':
                this.initWorkspaceView();
                break;
            case 'collector':
                this.initCollectorView();
                break;
        }
    }

    /**
     * Initialize home view functionality
     */
    initHomeView() {
        // Feature card navigation with enhanced feedback
        document.querySelectorAll('.feature-card[data-navigate]').forEach(card => {
            card.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.navigate;
                const title = e.currentTarget.querySelector('.feature-title').textContent;
                
                // Add visual feedback
                card.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    card.style.transform = '';
                }, 150);
                
                // Show navigation toast
                this.showToast(`Navegando para ${title}`, 'info', 1500);
                
                // Navigate after brief delay for better UX
                setTimeout(() => {
                    this.navigate(target);
                }, 200);
            });
        });

        // Settings button functionality
        const settingsButton = document.getElementById('settings-button');
        if (settingsButton) {
            settingsButton.addEventListener('click', () => {
                this.showModal('settings');
            });
        }
    }

    /**
     * Initialize workspace view functionality
     */
    initWorkspaceView() {
        // Step navigation
        this.initWorkspaceSteps();
        
        // Step 1: Jurisdiction configuration
        this.initJurisdictionStep();
        
        // Step 2: Document search
        this.initDocumentSearchStep();
        
        // Step 3: Prompt studio
        this.initPromptStudioStep();
        
        // Test integrations
        this.testIntegrations();
    }

    /**
     * Test AI and markdown utility integrations
     */
    async testIntegrations() {
        try {
            // Test Chrome AI availability
            this.chromeAIAvailable = await this.testChromeAI();
            
            // Test markdown utilities
            this.markdownUtilsAvailable = await this.testMarkdownUtils();
            
            // Update UI based on availability
            this.updateIntegrationStatus();
            
        } catch (error) {
            console.error('Integration test failed:', error);
        }
    }

    /**
     * Test Chrome AI availability
     * @returns {boolean} - True if Chrome AI is available
     */
    async testChromeAI() {
        try {
            // Check if AI APIs are available
            if (!('ai' in self)) {
                console.warn('Chrome AI not available: ai not in self');
                return false;
            }

            if (!('assistant' in self.ai) && !('summarizer' in self.ai)) {
                console.warn('Chrome AI not available: no assistant or summarizer');
                return false;
            }

            // Try to create a test assistant
            if ('assistant' in self.ai) {
                const testAssistant = await self.ai.assistant.create({
                    systemPrompt: 'Test prompt'
                });
                if (testAssistant) {
                    console.log('Chrome AI Assistant available');
                    return true;
                }
            }

            // Try to create a test summarizer
            if ('summarizer' in self.ai) {
                const testSummarizer = await self.ai.summarizer.create();
                if (testSummarizer) {
                    console.log('Chrome AI Summarizer available');
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.warn('Chrome AI test failed:', error);
            return false;
        }
    }

    /**
     * Test markdown utilities availability
     * @returns {boolean} - True if markdown utilities are available
     */
    async testMarkdownUtils() {
        try {
            // Test if we can import markdown utilities
            const { fetchMarkdown, splitByArticles } = await import('../util/markdown.js');
            
            if (typeof fetchMarkdown === 'function' && typeof splitByArticles === 'function') {
                console.log('Markdown utilities available');
                return true;
            }
            
            return false;
        } catch (error) {
            console.warn('Markdown utilities test failed:', error);
            return false;
        }
    }

    /**
     * Update UI based on integration status
     */
    updateIntegrationStatus() {
        // Add status indicators to the workspace
        this.addIntegrationStatusIndicators();
        
        // Update AI button state
        const executeBtn = document.getElementById('execute-ai');
        if (executeBtn) {
            if (this.chromeAIAvailable) {
                executeBtn.title = 'Chrome AI disponível - Análise completa';
                executeBtn.innerHTML = '🤖 Executar IA';
            } else {
                executeBtn.title = 'Chrome AI indisponível - Modo simulado';
                executeBtn.innerHTML = '🤖 Executar IA (Simulado)';
            }
        }
    }

    /**
     * Add integration status indicators to the UI
     */
    addIntegrationStatusIndicators() {
        // Check if indicators already exist
        if (document.getElementById('integration-status')) return;

        const workspaceContent = document.querySelector('.workspace-content');
        if (!workspaceContent) return;

        const statusHtml = `
            <div id="integration-status" class="integration-status mb-2">
                <div class="status-item">
                    <span class="status-icon ${this.chromeAIAvailable ? 'success' : 'warning'}">
                        ${this.chromeAIAvailable ? '✅' : '⚠️'}
                    </span>
                    <span class="status-text">
                        Chrome AI: ${this.chromeAIAvailable ? 'Disponível' : 'Indisponível'}
                    </span>
                    ${!this.chromeAIAvailable ? '<a href="#" onclick="app.showAISetupHelp()" class="status-help">Ajuda</a>' : ''}
                </div>
                <div class="status-item">
                    <span class="status-icon ${this.markdownUtilsAvailable ? 'success' : 'error'}">
                        ${this.markdownUtilsAvailable ? '✅' : '❌'}
                    </span>
                    <span class="status-text">
                        Utilitários Markdown: ${this.markdownUtilsAvailable ? 'Disponível' : 'Erro'}
                    </span>
                </div>
            </div>
        `;

        workspaceContent.insertAdjacentHTML('afterbegin', statusHtml);

        // Add CSS for status indicators
        this.addIntegrationStatusCSS();
    }

    /**
     * Add CSS for integration status indicators
     */
    addIntegrationStatusCSS() {
        if (document.getElementById('integration-status-css')) return;

        const style = document.createElement('style');
        style.id = 'integration-status-css';
        style.textContent = `
            .integration-status {
                background: var(--pico-card-background-color);
                border: 1px solid var(--pico-muted-border-color);
                border-radius: var(--pico-border-radius);
                padding: 0.75rem;
                font-size: 0.9rem;
            }
            
            .status-item {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 0.25rem;
            }
            
            .status-item:last-child {
                margin-bottom: 0;
            }
            
            .status-icon.success {
                color: var(--pico-ins-color);
            }
            
            .status-icon.warning {
                color: #f39c12;
            }
            
            .status-icon.error {
                color: var(--pico-del-color);
            }
            
            .status-help {
                margin-left: auto;
                font-size: 0.8rem;
                text-decoration: none;
                color: var(--pico-primary-color);
            }
            
            .status-help:hover {
                text-decoration: underline;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Show AI setup help modal
     */
    showAISetupHelp() {
        const helpContent = `
            <h3>Configuração do Chrome AI</h3>
            <p>Para usar a funcionalidade completa de IA, você precisa habilitar o Chrome AI:</p>
            
            <h4>Passos para Configuração:</h4>
            <ol>
                <li>Abra uma nova aba e vá para: <code>chrome://flags/</code></li>
                <li>Procure por "Optimization Guide On Device Model"</li>
                <li>Defina como "Enabled BypassPerfRequirement"</li>
                <li>Procure por "Prompt API for Gemini Nano"</li>
                <li>Defina como "Enabled"</li>
                <li>Reinicie o Chrome</li>
                <li>Aguarde o download do modelo (pode levar alguns minutos)</li>
            </ol>
            
            <h4>Verificação:</h4>
            <p>Após reiniciar, volte ao LexFlow e teste a funcionalidade de IA.</p>
            
            <div class="text-center mt-2">
                <button onclick="app.testIntegrations(); app.hideModal('ai-help')" class="primary">
                    Testar Novamente
                </button>
                <button onclick="app.hideModal('ai-help')" class="secondary">
                    Fechar
                </button>
            </div>
        `;

        // Create modal if it doesn't exist
        if (!document.getElementById('ai-help-modal')) {
            const modalHtml = `
                <div id="ai-help-modal" class="modal-overlay">
                    <div class="modal">
                        <div class="modal-header">
                            <h3>Ajuda - Chrome AI</h3>
                            <button class="modal-close" onclick="app.hideModal('ai-help')">&times;</button>
                        </div>
                        <div id="ai-help-content"></div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        // Update content and show modal
        document.getElementById('ai-help-content').innerHTML = helpContent;
        this.showModal('ai-help');
    }

    /**
     * Enhanced error handling for AI operations
     * @param {Error} error - The error to handle
     * @param {string} context - Context where error occurred
     */
    handleAIError(error, context = 'AI operation') {
        console.error(`${context} error:`, error);
        
        let userMessage = 'Erro na operação de IA';
        let suggestion = '';

        if (error.message.includes('not available')) {
            userMessage = 'Chrome AI não está disponível';
            suggestion = 'Verifique as configurações do Chrome AI';
        } else if (error.message.includes('quota')) {
            userMessage = 'Limite de uso da IA atingido';
            suggestion = 'Tente novamente em alguns minutos';
        } else if (error.message.includes('network')) {
            userMessage = 'Erro de conectividade';
            suggestion = 'Verifique sua conexão com a internet';
        }

        this.showToast(`${userMessage}. ${suggestion}`, 'error', 5000);
        
        // Log detailed error for debugging
        console.error('Detailed AI error:', {
            message: error.message,
            stack: error.stack,
            context: context,
            chromeAIAvailable: this.chromeAIAvailable
        });
    }

    /**
     * Enhanced error handling for markdown operations
     * @param {Error} error - The error to handle
     * @param {string} context - Context where error occurred
     */
    handleMarkdownError(error, context = 'Markdown operation') {
        console.error(`${context} error:`, error);
        
        let userMessage = 'Erro ao processar documento';
        let suggestion = '';

        if (error.message.includes('fetch')) {
            userMessage = 'Erro ao carregar documento';
            suggestion = 'Verifique a URL do corpus';
        } else if (error.message.includes('parse')) {
            userMessage = 'Erro ao analisar documento';
            suggestion = 'O formato do documento pode estar incorreto';
        } else if (error.message.includes('404')) {
            userMessage = 'Documento não encontrado';
            suggestion = 'Verifique se o arquivo existe no repositório';
        }

        this.showToast(`${userMessage}. ${suggestion}`, 'error', 5000);
    }

    /**
     * Initialize workspace step navigation
     */
    initWorkspaceSteps() {
        // Step navigation buttons
        document.getElementById('save-jurisdiction')?.addEventListener('click', () => {
            this.saveJurisdictionAndContinue();
        });

        document.getElementById('prev-step-2')?.addEventListener('click', () => {
            this.goToWorkspaceStep(1);
        });

        document.getElementById('next-step-2')?.addEventListener('click', () => {
            this.goToWorkspaceStep(3);
        });

        document.getElementById('prev-step-3')?.addEventListener('click', () => {
            this.goToWorkspaceStep(2);
        });

        // Direct step navigation
        document.querySelectorAll('.step[data-step]').forEach(step => {
            step.addEventListener('click', (e) => {
                const stepNumber = parseInt(e.currentTarget.dataset.step);
                this.goToWorkspaceStep(stepNumber);
            });
        });
    }

    /**
     * Navigate to a specific workspace step
     * @param {number} stepNumber - The step number to navigate to
     */
    goToWorkspaceStep(stepNumber) {
        // Update step indicators
        document.querySelectorAll('.step').forEach((step, index) => {
            step.classList.remove('active', 'completed');
            if (index + 1 === stepNumber) {
                step.classList.add('active');
            } else if (index + 1 < stepNumber) {
                step.classList.add('completed');
            }
        });

        // Show/hide step content
        document.querySelectorAll('.step-content').forEach((content, index) => {
            content.classList.remove('active');
            if (index + 1 === stepNumber) {
                content.classList.add('active');
            }
        });

        this.currentStep = stepNumber;
        this.showToast(`Navegando para Etapa ${stepNumber}`, 'info', 1500);
    }

    /**
     * Initialize jurisdiction configuration step
     */
    initJurisdictionStep() {
        // Load saved settings
        this.loadJurisdictionSettings();
        
        // Add real-time validation
        this.initJurisdictionValidation();
        
        // Add form field event listeners
        this.initJurisdictionEventListeners();
    }

    /**
     * Initialize jurisdiction form validation
     */
    initJurisdictionValidation() {
        const fields = ['language', 'country', 'state', 'city', 'corpus-url'];
        
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Validate on blur
                field.addEventListener('blur', () => {
                    this.validateJurisdictionField(fieldId);
                });
                
                // Clear validation on focus
                field.addEventListener('focus', () => {
                    this.clearJurisdictionFieldValidation(fieldId);
                });
                
                // Auto-save on change for better UX
                field.addEventListener('change', () => {
                    this.autoSaveJurisdictionSettings();
                });
            }
        });
    }

    /**
     * Initialize jurisdiction event listeners
     */
    initJurisdictionEventListeners() {
        // Country change updates state options
        const countryField = document.getElementById('country');
        if (countryField) {
            countryField.addEventListener('change', () => {
                this.updateStateOptions();
            });
        }
        
        // Corpus URL validation and testing
        const corpusField = document.getElementById('corpus-url');
        if (corpusField) {
            corpusField.addEventListener('input', () => {
                this.debounceCorpusValidation();
            });
        }
    }

    /**
     * Validate a single jurisdiction field
     * @param {string} fieldId - The field ID to validate
     */
    validateJurisdictionField(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        // Clear previous validation
        field.classList.remove('error', 'success');
        this.clearFieldError(field);

        switch (fieldId) {
            case 'language':
                if (!value) {
                    isValid = false;
                    errorMessage = 'Idioma é obrigatório';
                }
                break;

            case 'country':
                if (!value) {
                    isValid = false;
                    errorMessage = 'País é obrigatório';
                }
                break;

            case 'state':
                if (value && value.length < 2) {
                    isValid = false;
                    errorMessage = 'Estado deve ter pelo menos 2 caracteres';
                }
                break;

            case 'city':
                if (value && value.length < 2) {
                    isValid = false;
                    errorMessage = 'Cidade deve ter pelo menos 2 caracteres';
                }
                break;

            case 'corpus-url':
                if (value && !this.isValidUrl(value)) {
                    isValid = false;
                    errorMessage = 'URL inválida. Use formato: https://exemplo.com';
                } else if (value && !value.includes('github')) {
                    // Warning for non-GitHub URLs
                    this.showFieldWarning(field, 'Recomendado usar repositório GitHub');
                }
                break;
        }

        // Apply validation state
        if (!isValid) {
            field.classList.add('error');
            this.showFieldError(field, errorMessage);
        } else if (value) {
            field.classList.add('success');
        }

        return isValid;
    }

    /**
     * Clear jurisdiction field validation
     * @param {string} fieldId - The field ID to clear
     */
    clearJurisdictionFieldValidation(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.remove('error', 'success');
            this.clearFieldError(field);
        }
    }

    /**
     * Show field error message
     * @param {HTMLElement} field - The field element
     * @param {string} message - Error message
     */
    showFieldError(field, message) {
        this.clearFieldError(field);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.style.color = 'var(--pico-del-color)';
        errorDiv.style.fontSize = '0.8rem';
        errorDiv.style.marginTop = '0.25rem';
        errorDiv.textContent = message;
        
        field.parentNode.appendChild(errorDiv);
    }

    /**
     * Show field warning message
     * @param {HTMLElement} field - The field element
     * @param {string} message - Warning message
     */
    showFieldWarning(field, message) {
        this.clearFieldError(field);
        
        const warningDiv = document.createElement('div');
        warningDiv.className = 'field-warning';
        warningDiv.style.color = 'var(--pico-color)';
        warningDiv.style.fontSize = '0.8rem';
        warningDiv.style.marginTop = '0.25rem';
        warningDiv.textContent = message;
        
        field.parentNode.appendChild(warningDiv);
    }

    /**
     * Clear field error/warning messages
     * @param {HTMLElement} field - The field element
     */
    clearFieldError(field) {
        const existing = field.parentNode.querySelectorAll('.field-error, .field-warning');
        existing.forEach(el => el.remove());
    }

    /**
     * Update state options based on selected country
     */
    updateStateOptions() {
        const countryField = document.getElementById('country');
        const stateField = document.getElementById('state');
        
        if (!countryField || !stateField) return;
        
        const country = countryField.value;
        
        // Clear current state value
        stateField.value = '';
        
        // Update placeholder based on country
        switch (country) {
            case 'br':
                stateField.placeholder = 'ex: Rio Grande do Sul, São Paulo';
                break;
            case 'us':
                stateField.placeholder = 'ex: California, New York';
                break;
            case 'es':
                stateField.placeholder = 'ex: Madrid, Cataluña';
                break;
            default:
                stateField.placeholder = 'Digite o estado/província';
        }
    }

    /**
     * Debounced corpus URL validation
     */
    debounceCorpusValidation() {
        clearTimeout(this.corpusValidationTimeout);
        this.corpusValidationTimeout = setTimeout(() => {
            this.validateCorpusUrl();
        }, 1000);
    }

    /**
     * Validate corpus URL by testing connectivity
     */
    async validateCorpusUrl() {
        const corpusField = document.getElementById('corpus-url');
        if (!corpusField || !corpusField.value) return;

        const url = corpusField.value.trim();
        if (!this.isValidUrl(url)) return;

        try {
            // Test if URL is accessible
            const testUrl = url.endsWith('/') ? url + 'README.md' : url + '/README.md';
            const response = await fetch(testUrl, { method: 'HEAD' });
            
            if (response.ok) {
                corpusField.classList.remove('error');
                corpusField.classList.add('success');
                this.clearFieldError(corpusField);
            } else {
                this.showFieldWarning(corpusField, 'URL pode não estar acessível');
            }
        } catch (error) {
            this.showFieldWarning(corpusField, 'Não foi possível verificar a URL');
        }
    }

    /**
     * Auto-save jurisdiction settings (debounced)
     */
    autoSaveJurisdictionSettings() {
        clearTimeout(this.autoSaveTimeout);
        this.autoSaveTimeout = setTimeout(() => {
            this.saveJurisdictionSettingsQuietly();
        }, 2000);
    }

    /**
     * Save jurisdiction settings without user feedback
     */
    async saveJurisdictionSettingsQuietly() {
        const settings = this.getJurisdictionSettings();
        
        try {
            // Save to IndexedDB using existing db.js
            if (typeof window.setSetting !== 'undefined') {
                await window.setSetting('jurisdiction-config', settings);
            } else {
                localStorage.setItem('lexflow-jurisdiction', JSON.stringify(settings));
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }

    /**
     * Get current jurisdiction settings from form
     * @returns {Object} - Current jurisdiction settings
     */
    getJurisdictionSettings() {
        return {
            language: document.getElementById('language')?.value || '',
            country: document.getElementById('country')?.value || '',
            state: document.getElementById('state')?.value || '',
            city: document.getElementById('city')?.value || '',
            corpusUrl: document.getElementById('corpus-url')?.value || '',
            timestamp: Date.now()
        };
    }

    /**
     * Save jurisdiction settings and continue to next step
     */
    async saveJurisdictionAndContinue() {
        // Validate all fields first
        const fields = ['language', 'country', 'state', 'city', 'corpus-url'];
        let isValid = true;
        
        fields.forEach(fieldId => {
            if (!this.validateJurisdictionField(fieldId)) {
                isValid = false;
            }
        });

        // Check required fields
        const settings = this.getJurisdictionSettings();
        if (!settings.language || !settings.country) {
            this.showToast('Por favor, preencha os campos obrigatórios (Idioma e País)', 'error');
            return;
        }

        if (!isValid) {
            this.showToast('Por favor, corrija os erros no formulário', 'error');
            return;
        }

        const saveBtn = document.getElementById('save-jurisdiction');
        const originalText = saveBtn.textContent;
        
        try {
            // Show loading state
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';
            
            // Save to IndexedDB
            if (typeof window.setSetting !== 'undefined') {
                await window.setSetting('jurisdiction-config', settings);
            } else {
                localStorage.setItem('lexflow-jurisdiction', JSON.stringify(settings));
            }
            
            this.showToast('Configuração de jurisdição salva!', 'success');
            
            // Mark step as completed
            document.querySelector('.step[data-step="1"]').classList.add('completed');
            
            // Continue to next step after brief delay
            setTimeout(() => {
                this.goToWorkspaceStep(2);
            }, 1000);
            
        } catch (error) {
            console.error('Error saving jurisdiction settings:', error);
            this.showToast('Erro ao salvar configurações', 'error');
        } finally {
            // Restore button state
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    /**
     * Load jurisdiction settings from storage
     */
    async loadJurisdictionSettings() {
        try {
            let settings = null;
            
            // Try IndexedDB first
            if (typeof window.getSetting !== 'undefined') {
                settings = await window.getSetting('jurisdiction-config');
            }
            
            // Fallback to localStorage
            if (!settings) {
                const saved = localStorage.getItem('lexflow-jurisdiction');
                if (saved) {
                    settings = JSON.parse(saved);
                }
            }
            
            // Load from app settings if jurisdiction config doesn't exist
            if (!settings) {
                const appSettings = await this.loadSettings();
                if (appSettings) {
                    settings = {
                        language: appSettings.language,
                        country: appSettings.country,
                        state: appSettings.state,
                        city: appSettings.city,
                        corpusUrl: appSettings.corpusUrl
                    };
                }
            }
            
            if (settings) {
                // Populate form fields
                document.getElementById('language').value = settings.language || 'pt-BR';
                document.getElementById('country').value = settings.country || 'br';
                document.getElementById('state').value = settings.state || '';
                document.getElementById('city').value = settings.city || '';
                document.getElementById('corpus-url').value = settings.corpusUrl || '';
                
                // Update state options based on country
                this.updateStateOptions();
                
                // Mark step as completed if all required fields are filled
                if (settings.language && settings.country) {
                    document.querySelector('.step[data-step="1"]').classList.add('completed');
                }
            }
        } catch (error) {
            console.error('Error loading jurisdiction settings:', error);
        }
    }

    /**
     * Initialize document search step
     */
    initDocumentSearchStep() {
        this.initDocumentDropdown();
        this.initArticleSearch();
        this.initArticleSelection();
        
        // Load available documents when step is accessed
        this.loadAvailableDocuments();
    }

    /**
     * Initialize document dropdown functionality
     */
    initDocumentDropdown() {
        const documentSelect = document.getElementById('document-select');
        if (documentSelect) {
            documentSelect.addEventListener('change', () => {
                this.loadDocumentArticles();
            });
        }
    }

    /**
     * Initialize article search functionality
     */
    initArticleSearch() {
        const searchTerm = document.getElementById('search-term');
        if (searchTerm) {
            // Debounced search
            searchTerm.addEventListener('input', () => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.filterArticles();
                }, 300);
            });
        }
    }

    /**
     * Initialize article selection functionality
     */
    initArticleSelection() {
        this.selectedArticles = new Set();
        this.allArticles = [];
        
        // Update context when articles are selected/deselected
        document.addEventListener('change', (e) => {
            if (e.target.matches('.article-checkbox')) {
                this.updateSelectedContext();
            }
        });
    }

    /**
     * Load available documents from corpus
     */
    async loadAvailableDocuments() {
        const documentSelect = document.getElementById('document-select');
        if (!documentSelect) return;

        try {
            // Get corpus URL from jurisdiction settings
            const settings = await this.getJurisdictionSettings();
            const corpusUrl = settings.corpusUrl;
            
            if (!corpusUrl) {
                this.showToast('Configure a URL do corpus na Etapa 1', 'error');
                return;
            }

            // Show loading state
            documentSelect.innerHTML = '<option value="">Carregando documentos...</option>';
            documentSelect.disabled = true;

            // Fetch document list (assuming a documents.json or similar index file)
            const documentsUrl = corpusUrl.endsWith('/') ? corpusUrl + 'documents.json' : corpusUrl + '/documents.json';
            
            let documents = [];
            try {
                const response = await fetch(documentsUrl);
                if (response.ok) {
                    documents = await response.json();
                } else {
                    // Fallback: try to load common document names
                    documents = await this.getDefaultDocuments(settings.country);
                }
            } catch (error) {
                console.warn('Could not load documents.json, using defaults:', error);
                documents = await this.getDefaultDocuments(settings.country);
            }

            // Populate dropdown
            documentSelect.innerHTML = '<option value="">Selecione um documento...</option>';
            documents.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.filename || doc.name;
                option.textContent = doc.title || doc.name;
                option.dataset.url = doc.url || `${corpusUrl}/${doc.filename || doc.name}`;
                documentSelect.appendChild(option);
            });

            documentSelect.disabled = false;
            this.showToast(`${documents.length} documentos carregados`, 'success');

        } catch (error) {
            console.error('Error loading documents:', error);
            documentSelect.innerHTML = '<option value="">Erro ao carregar documentos</option>';
            this.showToast('Erro ao carregar lista de documentos', 'error');
        }
    }

    /**
     * Get default documents based on country
     * @param {string} country - Country code
     * @returns {Array} - Array of default documents
     */
    async getDefaultDocuments(country) {
        const defaults = {
            'br': [
                { name: 'constituicao.md', title: 'Constituição Federal', filename: 'constituicao.md' },
                { name: 'codigo-civil.md', title: 'Código Civil', filename: 'codigo-civil.md' },
                { name: 'codigo-penal.md', title: 'Código Penal', filename: 'codigo-penal.md' },
                { name: 'clt.md', title: 'Consolidação das Leis do Trabalho', filename: 'clt.md' }
            ],
            'us': [
                { name: 'constitution.md', title: 'US Constitution', filename: 'constitution.md' },
                { name: 'bill-of-rights.md', title: 'Bill of Rights', filename: 'bill-of-rights.md' }
            ],
            'es': [
                { name: 'constitucion.md', title: 'Constitución Española', filename: 'constitucion.md' },
                { name: 'codigo-civil.md', title: 'Código Civil', filename: 'codigo-civil.md' }
            ]
        };

        return defaults[country] || defaults['br'];
    }

    /**
     * Load articles from selected document
     */
    async loadDocumentArticles() {
        const documentSelect = document.getElementById('document-select');
        const articlesContainer = document.getElementById('articles-list');
        
        if (!documentSelect || !articlesContainer) return;

        const selectedOption = documentSelect.selectedOptions[0];
        if (!selectedOption || !selectedOption.value) {
            articlesContainer.innerHTML = '<p class="muted">Selecione um documento para ver os artigos</p>';
            return;
        }

        try {
            // Show loading state
            articlesContainer.innerHTML = '<p class="muted">Carregando artigos...</p>';

            // Get document URL
            const documentUrl = selectedOption.dataset.url;
            
            // Import markdown utility
            const { fetchMarkdown, splitByArticles } = await import('../util/markdown.js');
            
            // Fetch and parse document
            const markdownText = await fetchMarkdown(documentUrl);
            const articles = splitByArticles(markdownText);
            
            this.allArticles = articles;
            this.renderArticles(articles);
            
            this.showToast(`${articles.length} artigos carregados`, 'success');

        } catch (error) {
            this.handleMarkdownError(error, 'Loading document articles');
            articlesContainer.innerHTML = '<p class="error">Erro ao carregar artigos do documento</p>';
        }
    }

    /**
     * Render articles list with checkboxes
     * @param {Array} articles - Array of article objects
     */
    renderArticles(articles) {
        const articlesContainer = document.getElementById('articles-list');
        if (!articlesContainer) return;

        if (articles.length === 0) {
            articlesContainer.innerHTML = '<p class="muted">Nenhum artigo encontrado neste documento</p>';
            return;
        }

        const articlesHtml = articles.map((article, index) => {
            const isSelected = this.selectedArticles.has(index);
            const preview = article.text.length > 200 ? 
                article.text.substring(0, 200) + '...' : 
                article.text;

            return `
                <div class="article-item" data-index="${index}">
                    <label class="article-label">
                        <input type="checkbox" class="article-checkbox" 
                               data-index="${index}" ${isSelected ? 'checked' : ''}>
                        <strong>${article.title}</strong>
                    </label>
                    <div class="article-preview">
                        ${preview}
                    </div>
                </div>
            `;
        }).join('');

        articlesContainer.innerHTML = `
            <div class="articles-header">
                <h4>Artigos Disponíveis (${articles.length})</h4>
                <div class="articles-actions">
                    <button type="button" class="secondary small" onclick="app.selectAllArticles()">
                        Selecionar Todos
                    </button>
                    <button type="button" class="secondary small" onclick="app.clearAllArticles()">
                        Limpar Seleção
                    </button>
                </div>
            </div>
            <div class="articles-container">
                ${articlesHtml}
            </div>
        `;

        // Add CSS for articles if not already added
        this.addArticlesCSS();
    }

    /**
     * Add CSS styles for articles display
     */
    addArticlesCSS() {
        if (document.getElementById('articles-css')) return;

        const style = document.createElement('style');
        style.id = 'articles-css';
        style.textContent = `
            .articles-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid var(--pico-muted-border-color);
            }
            
            .articles-actions {
                display: flex;
                gap: 0.5rem;
            }
            
            .articles-actions .small {
                padding: 0.25rem 0.5rem;
                font-size: 0.8rem;
            }
            
            .articles-container {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid var(--pico-muted-border-color);
                border-radius: var(--pico-border-radius);
                padding: 0.5rem;
            }
            
            .article-item {
                margin-bottom: 1rem;
                padding: 0.75rem;
                border: 1px solid var(--pico-muted-border-color);
                border-radius: var(--pico-border-radius);
                transition: border-color 0.2s ease;
            }
            
            .article-item:hover {
                border-color: var(--pico-primary-color);
            }
            
            .article-item:has(.article-checkbox:checked) {
                border-color: var(--pico-primary-color);
                background: var(--pico-primary-background);
            }
            
            .article-label {
                display: flex;
                align-items: flex-start;
                gap: 0.5rem;
                margin-bottom: 0.5rem;
                cursor: pointer;
            }
            
            .article-checkbox {
                margin: 0;
                flex-shrink: 0;
            }
            
            .article-preview {
                font-size: 0.9rem;
                color: var(--pico-muted-color);
                line-height: 1.4;
                margin-left: 1.5rem;
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Filter articles based on search term
     */
    filterArticles() {
        const searchTerm = document.getElementById('search-term')?.value.toLowerCase() || '';
        
        if (!searchTerm) {
            this.renderArticles(this.allArticles);
            return;
        }

        const filteredArticles = this.allArticles.filter(article => 
            article.title.toLowerCase().includes(searchTerm) ||
            article.text.toLowerCase().includes(searchTerm)
        );

        this.renderArticles(filteredArticles);
        
        if (filteredArticles.length === 0) {
            document.getElementById('articles-list').innerHTML = 
                '<p class="muted">Nenhum artigo encontrado para o termo de busca</p>';
        }
    }

    /**
     * Select all visible articles
     */
    selectAllArticles() {
        const checkboxes = document.querySelectorAll('.article-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.selectedArticles.add(parseInt(checkbox.dataset.index));
        });
        this.updateSelectedContext();
        this.showToast(`${checkboxes.length} artigos selecionados`, 'success');
    }

    /**
     * Clear all article selections
     */
    clearAllArticles() {
        const checkboxes = document.querySelectorAll('.article-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        this.selectedArticles.clear();
        this.updateSelectedContext();
        this.showToast('Seleção limpa', 'info');
    }

    /**
     * Update selected context textarea
     */
    updateSelectedContext() {
        const contextArea = document.getElementById('selected-context');
        if (!contextArea) return;

        // Update selected articles set based on checkboxes
        this.selectedArticles.clear();
        document.querySelectorAll('.article-checkbox:checked').forEach(checkbox => {
            this.selectedArticles.add(parseInt(checkbox.dataset.index));
        });

        if (this.selectedArticles.size === 0) {
            contextArea.value = '';
            contextArea.placeholder = 'Os artigos selecionados aparecerão aqui...';
            return;
        }

        // Build context from selected articles
        const selectedTexts = Array.from(this.selectedArticles)
            .sort((a, b) => a - b)
            .map(index => {
                const article = this.allArticles[index];
                return `${article.title}\n\n${article.text}`;
            });

        contextArea.value = selectedTexts.join('\n\n---\n\n');
        contextArea.placeholder = '';

        // Update button state
        const nextBtn = document.getElementById('next-step-2');
        if (nextBtn) {
            nextBtn.disabled = this.selectedArticles.size === 0;
        }

        // Show selection count
        this.showToast(`${this.selectedArticles.size} artigos selecionados`, 'info', 1500);
    }

    /**
     * Initialize prompt studio step
     */
    initPromptStudioStep() {
        this.initPresetSelection();
        this.initPromptParameters();
        this.initAIExecution();
        this.loadPromptPresets();
    }

    /**
     * Initialize preset selection functionality
     */
    initPresetSelection() {
        const presetSelect = document.getElementById('preset-select');
        if (presetSelect) {
            presetSelect.addEventListener('change', () => {
                this.loadPresetTemplate();
            });
        }
    }

    /**
     * Initialize prompt parameters functionality
     */
    initPromptParameters() {
        // Add parameters container if it doesn't exist
        this.createParametersContainer();
        
        // Custom prompt textarea
        const customPrompt = document.getElementById('custom-prompt');
        if (customPrompt) {
            customPrompt.addEventListener('input', () => {
                this.updatePromptPreview();
            });
        }
    }

    /**
     * Create parameters container in the HTML
     */
    createParametersContainer() {
        const presetSelect = document.getElementById('preset-select');
        if (!presetSelect) return;

        // Check if parameters container already exists
        if (document.getElementById('prompt-parameters')) return;

        const parametersHtml = `
            <div id="prompt-parameters" class="mb-1" style="display: none;">
                <label>Parâmetros do Preset:</label>
                <div id="parameters-container"></div>
            </div>
        `;

        // Insert after preset select
        presetSelect.parentNode.insertAdjacentHTML('afterend', parametersHtml);
    }

    /**
     * Initialize AI execution functionality
     */
    initAIExecution() {
        // AI execution button
        document.getElementById('execute-ai')?.addEventListener('click', () => {
            this.executeAI();
        });

        // Copy result button
        document.getElementById('copy-result')?.addEventListener('click', () => {
            this.copyAIResult();
        });

        // Add export functionality
        this.addExportButtons();
    }

    /**
     * Add export buttons to the prompt studio
     */
    addExportButtons() {
        const copyBtn = document.getElementById('copy-result');
        if (!copyBtn || document.getElementById('export-buttons')) return;

        const exportHtml = `
            <div id="export-buttons" class="text-center mt-1" style="display: none;">
                <button type="button" class="secondary" onclick="app.exportAsMarkdown()">
                    📄 Exportar como Markdown
                </button>
                <button type="button" class="secondary" onclick="app.saveToHistory()">
                    💾 Salvar no Histórico
                </button>
            </div>
        `;

        copyBtn.parentNode.insertAdjacentHTML('afterend', exportHtml);
    }

    /**
     * Load available prompt presets
     */
    loadPromptPresets() {
        const presets = {
            'summary': {
                name: 'Resumo Legal',
                description: 'Gera um resumo conciso dos artigos selecionados',
                template: 'Faça um resumo dos seguintes artigos legais, destacando os pontos principais e implicações práticas:\n\n{context}',
                parameters: []
            },
            'analysis': {
                name: 'Análise Jurídica',
                description: 'Análise detalhada com interpretação jurídica',
                template: 'Analise juridicamente os seguintes artigos, considerando:\n1. Interpretação literal\n2. Aplicação prática\n3. Precedentes relevantes\n4. Possíveis conflitos ou ambiguidades\n\nFoco: {focus}\n\nArtigos:\n{context}',
                parameters: [
                    { name: 'focus', label: 'Foco da Análise', type: 'text', placeholder: 'ex: direitos trabalhistas, responsabilidade civil' }
                ]
            },
            'comparison': {
                name: 'Comparação de Artigos',
                description: 'Compara diferentes artigos e identifica relações',
                template: 'Compare os seguintes artigos legais, identificando:\n1. Semelhanças e diferenças\n2. Hierarquia normativa\n3. Possíveis conflitos\n4. Complementaridade\n\nCritério de comparação: {criteria}\n\nArtigos:\n{context}',
                parameters: [
                    { name: 'criteria', label: 'Critério de Comparação', type: 'text', placeholder: 'ex: aplicabilidade, sanções, procedimentos' }
                ]
            },
            'practical': {
                name: 'Aplicação Prática',
                description: 'Foca na aplicação prática e casos de uso',
                template: 'Explique a aplicação prática dos seguintes artigos legais:\n1. Quando se aplicam\n2. Procedimentos necessários\n3. Documentação exigida\n4. Prazos e requisitos\n5. Exemplos práticos\n\nContexto específico: {context_type}\n\nArtigos:\n{context}',
                parameters: [
                    { name: 'context_type', label: 'Contexto de Aplicação', type: 'select', options: [
                        { value: 'empresarial', label: 'Contexto Empresarial' },
                        { value: 'individual', label: 'Pessoa Física' },
                        { value: 'publico', label: 'Administração Pública' },
                        { value: 'judicial', label: 'Processo Judicial' }
                    ]}
                ]
            },
            'custom': {
                name: 'Prompt Personalizado',
                description: 'Use o campo de prompt personalizado abaixo',
                template: '',
                parameters: []
            }
        };

        this.promptPresets = presets;
        
        // Update preset select options
        const presetSelect = document.getElementById('preset-select');
        if (presetSelect) {
            // Clear existing options except the first one
            presetSelect.innerHTML = '<option value="">Selecione um preset...</option>';
            
            Object.keys(presets).forEach(key => {
                const preset = presets[key];
                const option = document.createElement('option');
                option.value = key;
                option.textContent = preset.name;
                option.title = preset.description;
                presetSelect.appendChild(option);
            });
        }
    }

    /**
     * Load preset template and parameters
     */
    loadPresetTemplate() {
        const presetSelect = document.getElementById('preset-select');
        const customPrompt = document.getElementById('custom-prompt');
        const parametersContainer = document.getElementById('parameters-container');
        const parametersDiv = document.getElementById('prompt-parameters');
        
        if (!presetSelect || !customPrompt) return;

        const selectedPreset = presetSelect.value;
        
        if (!selectedPreset || selectedPreset === 'custom') {
            // Hide parameters for custom preset
            if (parametersDiv) parametersDiv.style.display = 'none';
            if (selectedPreset === 'custom') {
                customPrompt.placeholder = 'Digite seu prompt personalizado aqui. Use {context} para inserir os artigos selecionados.';
                customPrompt.focus();
            }
            return;
        }

        const preset = this.promptPresets[selectedPreset];
        if (!preset) return;

        // Load template into custom prompt
        customPrompt.value = preset.template;
        customPrompt.placeholder = 'Prompt baseado no preset selecionado. Você pode modificá-lo conforme necessário.';

        // Show/hide parameters
        if (preset.parameters && preset.parameters.length > 0) {
            this.renderParameters(preset.parameters);
            if (parametersDiv) parametersDiv.style.display = 'block';
        } else {
            if (parametersDiv) parametersDiv.style.display = 'none';
        }

        // Update prompt preview
        this.updatePromptPreview();
    }

    /**
     * Render parameter inputs
     * @param {Array} parameters - Array of parameter definitions
     */
    renderParameters(parameters) {
        const container = document.getElementById('parameters-container');
        if (!container) return;

        const parametersHtml = parameters.map(param => {
            if (param.type === 'select') {
                const options = param.options.map(opt => 
                    `<option value="${opt.value}">${opt.label}</option>`
                ).join('');
                
                return `
                    <div class="parameter-field mb-1">
                        <label for="param-${param.name}">${param.label}:</label>
                        <select id="param-${param.name}" data-param="${param.name}">
                            <option value="">Selecione...</option>
                            ${options}
                        </select>
                    </div>
                `;
            } else {
                return `
                    <div class="parameter-field mb-1">
                        <label for="param-${param.name}">${param.label}:</label>
                        <input type="${param.type}" id="param-${param.name}" 
                               data-param="${param.name}" placeholder="${param.placeholder || ''}">
                    </div>
                `;
            }
        }).join('');

        container.innerHTML = parametersHtml;

        // Add event listeners to parameters
        container.querySelectorAll('[data-param]').forEach(input => {
            input.addEventListener('input', () => {
                this.updatePromptPreview();
            });
            input.addEventListener('change', () => {
                this.updatePromptPreview();
            });
        });
    }

    /**
     * Update prompt preview with parameter values
     */
    updatePromptPreview() {
        const customPrompt = document.getElementById('custom-prompt');
        if (!customPrompt) return;

        let promptText = customPrompt.value;
        
        // Replace parameter placeholders
        const paramInputs = document.querySelectorAll('[data-param]');
        paramInputs.forEach(input => {
            const paramName = input.dataset.param;
            const paramValue = input.value || `{${paramName}}`;
            promptText = promptText.replace(new RegExp(`\\{${paramName}\\}`, 'g'), paramValue);
        });

        // Store the processed prompt for AI execution
        this.processedPrompt = promptText;
    }

    /**
     * Get the final prompt with context
     * @returns {string} - The complete prompt ready for AI
     */
    getFinalPrompt() {
        const contextArea = document.getElementById('selected-context');
        const context = contextArea ? contextArea.value : '';
        
        if (!context) {
            throw new Error('Nenhum contexto selecionado. Volte à Etapa 2 e selecione artigos.');
        }

        let prompt = this.processedPrompt || document.getElementById('custom-prompt')?.value || '';
        
        if (!prompt) {
            throw new Error('Nenhum prompt definido. Selecione um preset ou digite um prompt personalizado.');
        }

        // Replace context placeholder
        prompt = prompt.replace(/\{context\}/g, context);
        
        return prompt;
    }

    /**
     * Execute AI processing
     */
    async executeAI() {
        const executeBtn = document.getElementById('execute-ai');
        const outputArea = document.getElementById('ai-output');
        
        if (!executeBtn || !outputArea) return;

        try {
            // Validate inputs
            const finalPrompt = this.getFinalPrompt();
            
            // Show loading state
            executeBtn.disabled = true;
            executeBtn.textContent = '🤖 Processando...';
            outputArea.value = 'Processando com IA...';
            
            this.showToast('Executando IA...', 'info');
            
            // Try to use Chrome AI
            let result;
            try {
                // Import Chrome AI utilities
                const { promptOnDevice, summarizeOnDevice } = await import('../ai/chrome-ai.js');
                
                // Determine if this is a summarization or general prompt
                const presetSelect = document.getElementById('preset-select');
                const selectedPreset = presetSelect?.value;
                
                if (selectedPreset === 'summary') {
                    // Use summarizer for summary preset
                    const contextArea = document.getElementById('selected-context');
                    const context = contextArea ? contextArea.value : '';
                    result = await summarizeOnDevice(context);
                } else {
                    // Use general prompt API
                    const systemPrompt = 'Você é um assistente jurídico especializado em análise de legislação brasileira. Forneça respostas precisas, bem estruturadas e baseadas no contexto fornecido.';
                    result = await promptOnDevice(systemPrompt, finalPrompt);
                }
                
                this.showToast('IA executada com sucesso!', 'success');
                
            } catch (aiError) {
                this.handleAIError(aiError, 'Chrome AI execution');
                
                // Fallback: simulate AI response based on prompt type
                result = this.generateFallbackResponse(finalPrompt);
                
                this.showToast('Usando modo simulado', 'info');
            }
            
            // Display result
            outputArea.value = result;
            
            // Show export buttons
            const exportButtons = document.getElementById('export-buttons');
            if (exportButtons) {
                exportButtons.style.display = 'block';
            }
            
            // Save to history
            this.saveExecutionToHistory(finalPrompt, result);
            
        } catch (error) {
            this.handleAIError(error, 'AI execution');
            outputArea.value = `Erro na execução: ${error.message}`;
        } finally {
            executeBtn.disabled = false;
            executeBtn.textContent = '🤖 Executar IA';
        }
    }

    /**
     * Generate fallback response when Chrome AI is not available
     * @param {string} prompt - The prompt to analyze
     * @returns {string} - Simulated AI response
     */
    generateFallbackResponse(prompt) {
        const presetSelect = document.getElementById('preset-select');
        const selectedPreset = presetSelect?.value;
        
        const fallbackResponses = {
            'summary': `RESUMO LEGAL (Simulado)

📋 PONTOS PRINCIPAIS:
• Este é um resumo simulado dos artigos selecionados
• A implementação real usará o Chrome AI para análise detalhada
• Os artigos foram processados e organizados por relevância

⚖️ IMPLICAÇÕES PRÁTICAS:
• Aplicação direta na prática jurídica
• Considerações para casos específicos
• Recomendações para implementação

🔍 OBSERVAÇÕES:
Para obter análises reais, certifique-se de que o Chrome AI esteja habilitado nas configurações do navegador.`,

            'analysis': `ANÁLISE JURÍDICA DETALHADA (Simulado)

📖 1. INTERPRETAÇÃO LITERAL:
• Análise do texto legal conforme redação original
• Identificação de termos técnicos e definições

⚖️ 2. APLICAÇÃO PRÁTICA:
• Cenários de aplicação na prática jurídica
• Procedimentos e requisitos necessários

📚 3. PRECEDENTES RELEVANTES:
• Jurisprudência aplicável (simulado)
• Orientações dos tribunais superiores

⚠️ 4. CONFLITOS E AMBIGUIDADES:
• Possíveis interpretações divergentes
• Recomendações para resolução

NOTA: Esta é uma análise simulada. Para análises reais, habilite o Chrome AI.`,

            'comparison': `COMPARAÇÃO DE ARTIGOS (Simulado)

🔄 SEMELHANÇAS E DIFERENÇAS:
• Pontos em comum entre os artigos analisados
• Distinções importantes na aplicação

📊 HIERARQUIA NORMATIVA:
• Ordem de precedência entre as normas
• Relação com outras legislações

⚠️ POSSÍVEIS CONFLITOS:
• Identificação de contradições aparentes
• Sugestões para harmonização

🤝 COMPLEMENTARIDADE:
• Como os artigos se complementam
• Aplicação conjunta recomendada

NOTA: Comparação simulada. Use Chrome AI para análise real.`,

            'practical': `APLICAÇÃO PRÁTICA (Simulado)

📋 QUANDO SE APLICAM:
• Situações específicas de aplicação
• Condições e requisitos necessários

📝 PROCEDIMENTOS:
• Passos para implementação
• Fluxo de trabalho recomendado

📄 DOCUMENTAÇÃO EXIGIDA:
• Documentos necessários
• Formulários e comprovantes

⏰ PRAZOS E REQUISITOS:
• Cronograma de cumprimento
• Deadlines importantes

💡 EXEMPLOS PRÁTICOS:
• Casos de uso comuns
• Situações do dia a dia

NOTA: Guia simulado. Para orientações precisas, use Chrome AI.`
        };

        return fallbackResponses[selectedPreset] || `ANÁLISE PERSONALIZADA (Simulado)

Esta é uma resposta simulada para seu prompt personalizado.

📝 PROMPT ANALISADO:
${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}

🤖 RESPOSTA SIMULADA:
Com base no contexto fornecido, esta seria uma análise detalhada dos artigos selecionados. A implementação real utilizará o Chrome AI para fornecer insights jurídicos precisos e contextualmente relevantes.

Para obter análises reais e detalhadas, certifique-se de que o Chrome AI esteja habilitado em chrome://flags/#optimization-guide-on-device-model

NOTA: Esta é uma demonstração. A funcionalidade completa requer Chrome AI ativo.`;
    }

    /**
     * Save execution to history
     * @param {string} prompt - The executed prompt
     * @param {string} result - The AI result
     */
    async saveExecutionToHistory(prompt, result) {
        try {
            const historyItem = {
                prompt: prompt,
                result: result,
                timestamp: Date.now(),
                preset: document.getElementById('preset-select')?.value || 'custom',
                articlesCount: this.selectedArticles ? this.selectedArticles.size : 0
            };

            // Save using db.js if available
            if (typeof window.saveHistory !== 'undefined') {
                await window.saveHistory(historyItem);
            } else {
                // Fallback to localStorage
                const history = JSON.parse(localStorage.getItem('lexflow-history') || '[]');
                history.unshift(historyItem);
                // Keep only last 50 items
                history.splice(50);
                localStorage.setItem('lexflow-history', JSON.stringify(history));
            }
        } catch (error) {
            console.error('Error saving to history:', error);
        }
    }

    /**
     * Export result as markdown
     */
    exportAsMarkdown() {
        const outputArea = document.getElementById('ai-output');
        const presetSelect = document.getElementById('preset-select');
        
        if (!outputArea || !outputArea.value) {
            this.showToast('Nenhum resultado para exportar', 'error');
            return;
        }

        const preset = presetSelect?.value || 'custom';
        const presetName = this.promptPresets[preset]?.name || 'Análise Personalizada';
        const timestamp = new Date().toLocaleString('pt-BR');
        
        const markdown = `# ${presetName}

**Data:** ${timestamp}
**Preset:** ${presetName}
**Artigos Analisados:** ${this.selectedArticles ? this.selectedArticles.size : 0}

---

## Resultado da Análise

${outputArea.value}

---

*Gerado pelo LexFlow - Legal AI Assistant*
`;

        // Create download
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lexflow-analise-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Markdown exportado!', 'success');
    }

    /**
     * Save current result to history manually
     */
    async saveToHistory() {
        const outputArea = document.getElementById('ai-output');
        const customPrompt = document.getElementById('custom-prompt');
        
        if (!outputArea || !outputArea.value) {
            this.showToast('Nenhum resultado para salvar', 'error');
            return;
        }

        try {
            await this.saveExecutionToHistory(
                customPrompt?.value || 'Prompt não disponível',
                outputArea.value
            );
            this.showToast('Salvo no histórico!', 'success');
        } catch (error) {
            this.showToast('Erro ao salvar no histórico', 'error');
        }
    }

    /**
     * Copy AI result to clipboard
     */
    async copyAIResult() {
        const outputArea = document.getElementById('ai-output');
        if (!outputArea || !outputArea.value) {
            this.showToast('Nenhum resultado para copiar', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(outputArea.value);
            this.showToast('Resultado copiado!', 'success');
        } catch (error) {
            console.error('Copy error:', error);
            this.showToast('Erro ao copiar resultado', 'error');
        }
    }

    /**
     * Initialize collector view functionality
     */
    initCollectorView() {
        // Placeholder for collector functionality
        console.log('Collector view initialized');
        this.updateQueueCount(0);
    }

    /**
     * Update capture queue count
     * @param {number} count - Number of items in queue
     */
    updateQueueCount(count) {
        const countElement = document.getElementById('queue-count');
        if (countElement) {
            countElement.textContent = `(${count})`;
        }
    }

    /**
     * Show modal
     * @param {string} modalName - The modal to show
     */
    async showModal(modalName) {
        const modal = document.getElementById(`${modalName}-modal`);
        if (modal) {
            // Load settings before showing settings modal
            if (modalName === 'settings') {
                await this.loadSettings();
            }
            
            modal.classList.add('active');
            
            // Focus first input
            const firstInput = modal.querySelector('input, select, textarea');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    /**
     * Hide modal
     * @param {string} modalName - The modal to hide
     */
    hideModal(modalName) {
        const modal = document.getElementById(`${modalName}-modal`);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Initialize toast notification system
     */
    initToastSystem() {
        // Initialize enhanced toast system
        this.toastSystem = new ToastSystem();
    }

    /**
     * Show toast notification (legacy method for compatibility)
     * @param {string} message - The message to show
     * @param {string} type - Toast type (success, error, info)
     * @param {number} duration - Duration in milliseconds (default: 3000)
     */
    showToast(message, type = 'info', duration = 3000) {
        return this.toastSystem.show(message, type, duration);
    }

    /**
     * Hide specific toast (legacy method for compatibility)
     * @param {number} toastId - The toast ID to hide
     */
    hideToast(toastId) {
        return this.toastSystem.hide(toastId);
    }

    /**
     * Clear all toasts (legacy method for compatibility)
     */
    clearToasts() {
        return this.toastSystem.clear();
    }

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        // Navigation tabs
        document.querySelectorAll('.nav-tab[data-view]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.dataset.view;
                this.navigate(view);
            });
        });

        // Modal close buttons
        document.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalName = e.currentTarget.dataset.closeModal;
                this.hideModal(modalName);
            });
        });

        // Modal overlay clicks (close on outside click)
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    const modalName = overlay.id.replace('-modal', '');
                    this.hideModal(modalName);
                }
            });
        });

        // Settings form
        document.getElementById('settings-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });

        // Real-time validation for settings form
        this.initSettingsFormValidation();

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    /**
     * Handle keyboard shortcuts
     * @param {KeyboardEvent} e - The keyboard event
     */
    handleKeyboardShortcuts(e) {
        // Escape key closes modals
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                const modalName = modal.id.replace('-modal', '');
                this.hideModal(modalName);
            });
        }

        // Alt + number keys for quick navigation
        if (e.altKey && !e.ctrlKey && !e.shiftKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    this.navigate('home');
                    break;
                case '2':
                    e.preventDefault();
                    this.navigate('workspace');
                    break;
                case '3':
                    e.preventDefault();
                    this.navigate('collector');
                    break;
            }
        }
    }

    /**
     * Validate settings form
     * @returns {Object} - Validation result with isValid flag and errors
     */
    validateSettingsForm() {
        const errors = {};
        let isValid = true;

        // Get form values
        const language = document.getElementById('settings-language').value;
        const country = document.getElementById('settings-country').value;
        const state = document.getElementById('settings-state').value;
        const city = document.getElementById('settings-city').value;
        const corpusUrl = document.getElementById('settings-corpus-url').value;
        const githubToken = document.getElementById('settings-github-token').value;

        // Clear previous validation states
        document.querySelectorAll('.form-field').forEach(field => {
            field.classList.remove('error', 'success');
        });

        // Validate required fields
        if (!language) {
            errors.language = 'Por favor, selecione um idioma';
            isValid = false;
        }

        if (!country) {
            errors.country = 'Por favor, selecione um país';
            isValid = false;
        }

        // Validate corpus URL if provided
        if (corpusUrl && !this.isValidUrl(corpusUrl)) {
            errors.corpusUrl = 'URL inválida. Use formato: https://exemplo.com';
            isValid = false;
        }

        // Validate GitHub token format if provided
        if (githubToken && !this.isValidGitHubToken(githubToken)) {
            errors.githubToken = 'Token deve começar com "ghp_" ou "github_pat_"';
            isValid = false;
        }

        // Validate state and city (basic length check)
        if (state && state.length < 2) {
            errors.state = 'Estado deve ter pelo menos 2 caracteres';
            isValid = false;
        }

        if (city && city.length < 2) {
            errors.city = 'Cidade deve ter pelo menos 2 caracteres';
            isValid = false;
        }

        // Apply validation states to form fields
        Object.keys(errors).forEach(fieldName => {
            const field = document.getElementById(`settings-${fieldName}`);
            if (field) {
                const formField = field.closest('.form-field');
                if (formField) {
                    formField.classList.add('error');
                    const errorMsg = formField.querySelector('.error-message');
                    if (errorMsg) {
                        errorMsg.textContent = errors[fieldName];
                    }
                }
            }
        });

        // Mark valid fields as success
        ['language', 'country', 'state', 'city', 'corpusUrl', 'githubToken'].forEach(fieldName => {
            if (!errors[fieldName]) {
                const field = document.getElementById(`settings-${fieldName === 'corpusUrl' ? 'corpus-url' : fieldName === 'githubToken' ? 'github-token' : fieldName}`);
                if (field && field.value) {
                    const formField = field.closest('.form-field');
                    if (formField) {
                        formField.classList.add('success');
                    }
                }
            }
        });

        return { isValid, errors };
    }

    /**
     * Save application settings
     */
    async saveSettings() {
        // Validate form first
        const validation = this.validateSettingsForm();
        if (!validation.isValid) {
            this.showToast('Por favor, corrija os erros no formulário', 'error');
            return;
        }

        const settings = {
            language: document.getElementById('settings-language').value,
            country: document.getElementById('settings-country').value,
            state: document.getElementById('settings-state').value,
            city: document.getElementById('settings-city').value,
            corpusUrl: document.getElementById('settings-corpus-url').value,
            githubToken: document.getElementById('settings-github-token').value
        };

        // Show loading state
        const saveBtn = document.getElementById('save-settings-btn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
            // Save to IndexedDB using the existing db.js module
            if (typeof window.setSetting !== 'undefined') {
                // Use IndexedDB if available
                await window.setSetting('app-settings', settings);
            } else {
                // Fallback to localStorage
                localStorage.setItem('lexflow-settings', JSON.stringify(settings));
            }
            
            this.showToast('Configurações salvas com sucesso!', 'success');
            this.hideModal('settings');
            
            // Update jurisdiction fields in workspace if they're empty
            this.updateWorkspaceFromSettings(settings);
            
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showToast('Erro ao salvar configurações', 'error');
        } finally {
            // Restore button state
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    /**
     * Load application settings
     */
    async loadSettings() {
        try {
            let settings = null;
            
            // Try to load from IndexedDB first
            if (typeof window.getSetting !== 'undefined') {
                settings = await window.getSetting('app-settings');
            }
            
            // Fallback to localStorage
            if (!settings) {
                const saved = localStorage.getItem('lexflow-settings');
                if (saved) {
                    settings = JSON.parse(saved);
                }
            }
            
            if (settings) {
                // Populate settings form
                document.getElementById('settings-language').value = settings.language || 'pt-BR';
                document.getElementById('settings-country').value = settings.country || '';
                document.getElementById('settings-state').value = settings.state || '';
                document.getElementById('settings-city').value = settings.city || '';
                document.getElementById('settings-corpus-url').value = settings.corpusUrl || '';
                document.getElementById('settings-github-token').value = settings.githubToken || '';
                
                return settings;
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        
        return null;
    }

    /**
     * Update workspace jurisdiction fields from settings if they're empty
     * @param {Object} settings - The settings object
     */
    updateWorkspaceFromSettings(settings) {
        // Only update if workspace fields are empty
        const languageField = document.getElementById('language');
        const countryField = document.getElementById('country');
        const stateField = document.getElementById('state');
        const cityField = document.getElementById('city');
        const corpusField = document.getElementById('corpus-url');
        
        if (languageField && !languageField.value && settings.language) {
            languageField.value = settings.language;
        }
        if (countryField && !countryField.value && settings.country) {
            countryField.value = settings.country;
        }
        if (stateField && !stateField.value && settings.state) {
            stateField.value = settings.state;
        }
        if (cityField && !cityField.value && settings.city) {
            cityField.value = settings.city;
        }
        if (corpusField && !corpusField.value && settings.corpusUrl) {
            corpusField.value = settings.corpusUrl;
        }
    }

    /**
     * Validate URL format
     * @param {string} url - URL to validate
     * @returns {boolean} - True if valid URL
     */
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate GitHub token format
     * @param {string} token - GitHub token to validate
     * @returns {boolean} - True if valid GitHub token format
     */
    isValidGitHubToken(token) {
        // GitHub tokens start with ghp_ (personal access tokens) or github_pat_ (fine-grained tokens)
        return token.startsWith('ghp_') || token.startsWith('github_pat_');
    }

    /**
     * Initialize real-time validation for settings form
     */
    initSettingsFormValidation() {
        const formFields = [
            'settings-language',
            'settings-country', 
            'settings-state',
            'settings-city',
            'settings-corpus-url',
            'settings-github-token'
        ];

        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Validate on blur (when user leaves the field)
                field.addEventListener('blur', () => {
                    this.validateSingleField(fieldId);
                });

                // Clear validation on focus (when user starts typing)
                field.addEventListener('focus', () => {
                    const formField = field.closest('.form-field');
                    if (formField) {
                        formField.classList.remove('error', 'success');
                    }
                });
            }
        });
    }

    /**
     * Validate a single form field
     * @param {string} fieldId - The field ID to validate
     */
    validateSingleField(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        const formField = field.closest('.form-field');
        if (!formField) return;

        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        // Clear previous states
        formField.classList.remove('error', 'success');

        // Validate based on field type
        switch (fieldId) {
            case 'settings-language':
                if (!value) {
                    isValid = false;
                    errorMessage = 'Por favor, selecione um idioma';
                }
                break;

            case 'settings-country':
                if (!value) {
                    isValid = false;
                    errorMessage = 'Por favor, selecione um país';
                }
                break;

            case 'settings-state':
                if (value && value.length < 2) {
                    isValid = false;
                    errorMessage = 'Estado deve ter pelo menos 2 caracteres';
                }
                break;

            case 'settings-city':
                if (value && value.length < 2) {
                    isValid = false;
                    errorMessage = 'Cidade deve ter pelo menos 2 caracteres';
                }
                break;

            case 'settings-corpus-url':
                if (value && !this.isValidUrl(value)) {
                    isValid = false;
                    errorMessage = 'URL inválida. Use formato: https://exemplo.com';
                }
                break;

            case 'settings-github-token':
                if (value && !this.isValidGitHubToken(value)) {
                    isValid = false;
                    errorMessage = 'Token deve começar com "ghp_" ou "github_pat_"';
                }
                break;
        }

        // Apply validation state
        if (!isValid) {
            formField.classList.add('error');
            const errorElement = formField.querySelector('.error-message');
            if (errorElement) {
                errorElement.textContent = errorMessage;
            }
        } else if (value) {
            // Only show success for non-empty fields
            formField.classList.add('success');
        }
    }

    /**
     * Load initial view based on hash or default to home
     */
    loadInitialView() {
        const hash = window.location.hash.slice(1);
        if (!hash) {
            this.navigate('home');
        }
    }

    /**
     * Show advanced toast demo with various features
     */
    showAdvancedToastDemo() {
        // Loading toast
        const loadingId = this.toastSystem.loading('Processando dados...');
        
        setTimeout(() => {
            this.toastSystem.hide(loadingId);
            
            // Toast with title and actions
            this.toastSystem.withActions(
                'Deseja salvar as alterações?',
                [
                    {
                        id: 'save',
                        label: 'Salvar',
                        handler: () => {
                            this.toastSystem.success('Alterações salvas!');
                        }
                    },
                    {
                        id: 'discard',
                        label: 'Descartar',
                        handler: () => {
                            this.toastSystem.info('Alterações descartadas');
                        }
                    }
                ],
                'warning'
            );
        }, 2000);

        // Toast with custom title
        setTimeout(() => {
            this.toastSystem.show({
                title: 'Nova Funcionalidade',
                message: 'O sistema de notificações foi atualizado com novas funcionalidades!',
                icon: '🎉'
            }, 'success', 5000);
        }, 3000);
    }
}

// Initialize the application when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new LexFlowApp();
});

// Export for global access
window.LexFlowApp = LexFlowApp;