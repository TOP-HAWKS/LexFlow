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
        
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.initRouter();
        this.initEventListeners();
        this.initToastSystem();
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
        // Feature card navigation
        document.querySelectorAll('.feature-card[data-navigate]').forEach(card => {
            card.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.navigate;
                this.navigate(target);
            });
        });
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
    showModal(modalName) {
        const modal = document.getElementById(`${modalName}-modal`);
        if (modal) {
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
     * Save application settings
     */
    async saveSettings() {
        const settings = {
            language: document.getElementById('settings-language').value,
            githubToken: document.getElementById('settings-github-token').value
        };

        try {
            localStorage.setItem('lexflow-settings', JSON.stringify(settings));
            this.showToast('Configurações salvas!', 'success');
            this.hideModal('settings');
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showToast('Erro ao salvar configurações', 'error');
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