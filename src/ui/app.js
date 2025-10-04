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
    }

    /**
     * Save jurisdiction settings and continue to next step
     */
    async saveJurisdictionAndContinue() {
        const settings = {
            language: document.getElementById('language').value,
            country: document.getElementById('country').value,
            state: document.getElementById('state').value,
            city: document.getElementById('city').value,
            corpusUrl: document.getElementById('corpus-url').value
        };

        // Validate required fields
        if (!settings.language || !settings.country) {
            this.showToast('Por favor, preencha os campos obrigatórios', 'error');
            return;
        }

        try {
            // Save to storage (placeholder for now)
            localStorage.setItem('lexflow-jurisdiction', JSON.stringify(settings));
            
            this.showToast('Configurações salvas com sucesso!', 'success');
            
            // Continue to next step
            setTimeout(() => {
                this.goToWorkspaceStep(2);
            }, 1000);
            
        } catch (error) {
            console.error('Error saving jurisdiction settings:', error);
            this.showToast('Erro ao salvar configurações', 'error');
        }
    }

    /**
     * Load jurisdiction settings from storage
     */
    loadJurisdictionSettings() {
        try {
            const saved = localStorage.getItem('lexflow-jurisdiction');
            if (saved) {
                const settings = JSON.parse(saved);
                
                document.getElementById('language').value = settings.language || 'pt-BR';
                document.getElementById('country').value = settings.country || 'br';
                document.getElementById('state').value = settings.state || '';
                document.getElementById('city').value = settings.city || '';
                document.getElementById('corpus-url').value = settings.corpusUrl || '';
            }
        } catch (error) {
            console.error('Error loading jurisdiction settings:', error);
        }
    }

    /**
     * Initialize document search step
     */
    initDocumentSearchStep() {
        // Placeholder for document search functionality
        console.log('Document search step initialized');
    }

    /**
     * Initialize prompt studio step
     */
    initPromptStudioStep() {
        // AI execution button
        document.getElementById('execute-ai')?.addEventListener('click', () => {
            this.executeAI();
        });

        // Copy result button
        document.getElementById('copy-result')?.addEventListener('click', () => {
            this.copyAIResult();
        });
    }

    /**
     * Execute AI processing (placeholder)
     */
    async executeAI() {
        const executeBtn = document.getElementById('execute-ai');
        const outputArea = document.getElementById('ai-output');
        
        if (!executeBtn || !outputArea) return;

        try {
            executeBtn.disabled = true;
            executeBtn.textContent = '🤖 Processando...';
            
            this.showToast('Executando IA...', 'info');
            
            // Simulate AI processing
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            outputArea.value = 'Resultado simulado da IA:\n\nEste é um exemplo de saída da análise jurídica. A implementação real integrará com o Chrome AI para processar o contexto selecionado.';
            
            this.showToast('IA executada com sucesso!', 'success');
            
        } catch (error) {
            console.error('AI execution error:', error);
            this.showToast('Erro na execução da IA', 'error');
        } finally {
            executeBtn.disabled = false;
            executeBtn.textContent = '🤖 Executar IA';
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