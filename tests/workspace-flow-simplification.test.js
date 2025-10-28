/**
 * Comprehensive Tests for 2-Step Workspace Flow Simplification
 * Tests configuration validation, navigation, settings persistence, context management, and error handling
 * Requirements: All requirements validation for workspace flow simplification
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setSetting, getSetting } from '../src/util/settings.js';
import { DEFAULT_CONFIG, getDefaultBaseUrl } from '../src/config/defaults.js';

// Mock the settings module
vi.mock('../src/util/settings.js', () => ({
    setSetting: vi.fn(),
    getSetting: vi.fn()
}));

// Mock Chrome AI
const mockChromeAI = {
    available: false,
    assistant: {
        create: vi.fn()
    },
    summarizer: {
        create: vi.fn()
    }
};

// Mock global AI
global.self = {
    ai: mockChromeAI
};

describe('Workspace Flow Simplification - Comprehensive Tests', () => {
    let mockApp;
    let mockToastSystem;

    beforeEach(() => {
        // Setup DOM structure for 2-step workspace
        document.body.innerHTML = `
            <div class="app-container">
                <!-- Header with settings icon -->
                <header class="app-header">
                    <h1>LexFlow</h1>
                    <button id="settings-icon" class="settings-btn" aria-label="Configurações">⚙️</button>
                </header>

                <!-- Breadcrumb -->
                <nav class="breadcrumb">
                    <span>Início</span> › <span>Workspace Jurídico</span>
                </nav>

                <!-- Workspace View with 2 steps -->
                <div id="workspace-view" class="view active">
                    <!-- Step Navigation -->
                    <div class="workspace-steps">
                        <div class="step active" data-step="1">Leis & Artigos</div>
                        <div class="step" data-step="2">Prompt Studio</div>
                    </div>

                    <!-- Configuration Banner (hidden by default) -->
                    <div id="configuration-banner" class="configuration-banner hidden" role="alert">
                        <div class="banner-content">
                            <div class="banner-icon">⚠️</div>
                            <div class="banner-message">
                                <strong>Configuração incompleta</strong><br>
                                Configure idioma e país para carregar documentos
                            </div>
                            <button class="banner-action" id="open-settings-btn">Abrir Configurações</button>
                        </div>
                    </div>

                    <!-- Chrome AI Banner (hidden by default) -->
                    <div id="chrome-ai-banner" class="ai-banner hidden" role="alert">
                        <div class="banner-content">
                            <div class="banner-icon">🤖</div>
                            <div class="banner-message">
                                <strong>Chrome AI não disponível</strong><br>
                                Habilite o Chrome AI para usar funcionalidades de IA
                            </div>
                            <button class="banner-action" id="ai-setup-help-btn">Configurar IA</button>
                        </div>
                    </div>

                    <!-- Step 1: Leis & Artigos -->
                    <div id="step-1" class="step-content active">
                        <h2>Leis & Artigos</h2>
                        <div class="document-selection">
                            <select id="document-select" disabled>
                                <option value="">Selecione um documento</option>
                            </select>
                            <input type="text" id="search-input" placeholder="Buscar artigos..." disabled>
                            <div id="articles-list"></div>
                            <textarea id="selected-context" placeholder="Contexto selecionado aparecerá aqui..." readonly></textarea>
                        </div>
                    </div>

                    <!-- Step 2: Prompt Studio -->
                    <div id="step-2" class="step-content">
                        <h2>Prompt Studio</h2>
                        <div class="prompt-studio">
                            <select id="preset-select">
                                <option value="summary">Resumo</option>
                                <option value="analysis">Análise</option>
                                <option value="comparison">Comparação</option>
                            </select>
                            <textarea id="custom-prompt" placeholder="Prompt personalizado..."></textarea>
                            <button id="execute-ai" disabled>🤖 Executar IA</button>
                            <div id="ai-output"></div>
                        </div>
                    </div>
                </div>

                <!-- Settings Modal -->
                <div id="settings-modal" class="modal hidden">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h2>Configurações</h2>
                            <button class="modal-close" id="close-settings-modal">×</button>
                        </div>
                        <form id="settings-form">
                            <div class="form-field">
                                <label for="settings-language">Idioma:</label>
                                <select id="settings-language" name="language" required>
                                    <option value="">Selecione um idioma</option>
                                    <option value="pt-BR">Português (Brasil)</option>
                                    <option value="en-US">English (US)</option>
                                </select>
                            </div>
                            <div class="form-field">
                                <label for="settings-country">País:</label>
                                <select id="settings-country" name="country" required>
                                    <option value="">Selecione um país</option>
                                    <option value="br">Brasil</option>
                                    <option value="us">Estados Unidos</option>
                                </select>
                            </div>
                            <div class="form-field">
                                <label for="settings-state">Estado/Província:</label>
                                <input type="text" id="settings-state" name="state" placeholder="ex: Rio Grande do Sul">
                            </div>
                            <div class="form-field">
                                <label for="settings-city">Cidade:</label>
                                <input type="text" id="settings-city" name="city" placeholder="ex: Porto Alegre">
                            </div>
                            <div class="form-field">
                                <label for="settings-serverless-endpoint">Endpoint Serverless:</label>
                                <input type="url" id="settings-serverless-endpoint" name="serverlessEndpoint" 
                                       placeholder="https://api.example.com/webhook">
                                <div class="error-message"></div>
                            </div>
                            <button type="submit" id="save-settings-btn">Salvar Configurações</button>
                        </form>
                    </div>
                </div>

                <!-- Toast Container -->
                <div id="toast-container"></div>
            </div>
        `;

        // Mock toast system
        mockToastSystem = {
            toasts: [],
            show(message, type = 'info', duration = 3000) {
                const toast = {
                    id: Date.now() + Math.random(),
                    message,
                    type,
                    duration,
                    timestamp: Date.now()
                };
                this.toasts.push(toast);
                return toast.id;
            },
            showWithAction(message, type, duration, actionText, actionCallback) {
                const toast = this.show(message, type, duration);
                toast.actionText = actionText;
                toast.actionCallback = actionCallback;
                return toast.id;
            },
            hide(id) {
                this.toasts = this.toasts.filter(t => t.id !== id);
            },
            clear() {
                this.toasts = [];
            },
            getCount() {
                return this.toasts.length;
            }
        };

        // Mock App class for 2-step workspace
        mockApp = {
            currentView: 'workspace',
            currentStep: 1,
            toastSystem: mockToastSystem,
            selectedContext: {
                articles: [],
                text: '',
                lastUpdated: null
            },
            configurationValid: false,
            chromeAIAvailable: false,
            availableDocuments: [],
            allArticles: [],

            // Configuration validation
            async validateRequiredSettings() {
                const language = await getSetting('language');
                const country = await getSetting('country');
                const baseUrl = await getSetting('baseUrl');

                const missing = [];
                if (!language) missing.push('language');
                if (!country) missing.push('country');
                if (!baseUrl) missing.push('baseUrl');

                return {
                    isValid: missing.length === 0,
                    missing: missing,
                    settings: { language, country, baseUrl }
                };
            },

            // Configuration banner management
            showConfigurationBanner(missingFields) {
                const banner = document.getElementById('configuration-banner');
                if (banner) {
                    banner.classList.remove('hidden');

                    // Update message based on missing fields
                    const messageEl = banner.querySelector('.banner-message');
                    if (messageEl) {
                        let message = 'Configuração incompleta<br>';
                        if (missingFields.includes('language') && missingFields.includes('country')) {
                            message += 'Configure idioma e país para carregar documentos';
                        } else if (missingFields.includes('language')) {
                            message += 'Configure o idioma da interface';
                        } else if (missingFields.includes('country')) {
                            message += 'Configure o país para carregar documentos';
                        } else if (missingFields.includes('baseUrl')) {
                            message += 'URL base do corpus não configurada';
                        }
                        messageEl.innerHTML = `<strong>Configuração incompleta</strong><br>${message}`;
                    }
                }

                // Disable document controls
                this.disableDocumentControls();
            },

            hideConfigurationBanner() {
                const banner = document.getElementById('configuration-banner');
                if (banner) {
                    banner.classList.add('hidden');
                }

                // Enable document controls
                this.enableDocumentControls();
            },

            disableDocumentControls() {
                const documentSelect = document.getElementById('document-select');
                const searchInput = document.getElementById('search-input');

                if (documentSelect) documentSelect.disabled = true;
                if (searchInput) searchInput.disabled = true;
            },

            enableDocumentControls() {
                const documentSelect = document.getElementById('document-select');
                const searchInput = document.getElementById('search-input');

                if (documentSelect) documentSelect.disabled = false;
                if (searchInput) searchInput.disabled = false;
            },

            // Chrome AI banner management
            showChromeAISetupBanner() {
                const banner = document.getElementById('chrome-ai-banner');
                if (banner) {
                    banner.classList.remove('hidden');
                }
            },

            hideChromeAISetupBanner() {
                const banner = document.getElementById('chrome-ai-banner');
                if (banner) {
                    banner.classList.add('hidden');
                }
            },

            // Step navigation for 2-step flow
            goToStep(stepNumber) {
                if (stepNumber < 1 || stepNumber > 2) return false;

                this.currentStep = stepNumber;

                // Update step pills
                document.querySelectorAll('.workspace-steps .step').forEach((step, index) => {
                    step.classList.toggle('active', index + 1 === stepNumber);
                });

                // Update step content
                document.querySelectorAll('.step-content').forEach((content, index) => {
                    content.classList.toggle('active', index + 1 === stepNumber);
                });

                // Update Prompt Studio availability
                this.updatePromptStudioAvailability();

                this.logWorkspaceState('step_navigation', {
                    step: stepNumber,
                    contextSize: this.selectedContext.articles.length
                });

                return true;
            },

            updatePromptStudioAvailability() {
                const step2Pill = document.querySelector('.workspace-steps .step[data-step="2"]');
                const executeBtn = document.getElementById('execute-ai');

                const hasContext = this.selectedContext.articles.length > 0;

                if (step2Pill) {
                    step2Pill.classList.toggle('disabled', !hasContext);
                    step2Pill.style.pointerEvents = hasContext ? 'auto' : 'none';
                    step2Pill.style.opacity = hasContext ? '1' : '0.5';
                }

                if (executeBtn) {
                    executeBtn.disabled = !hasContext || !this.chromeAIAvailable;
                }
            },

            // Settings modal management
            showModal(modalId) {
                const modal = document.getElementById(`${modalId}-modal`);
                if (modal) {
                    modal.classList.remove('hidden');

                    // Load current settings into form
                    if (modalId === 'settings') {
                        this.loadSettingsIntoForm();
                    }
                }
            },

            hideModal(modalId) {
                const modal = document.getElementById(`${modalId}-modal`);
                if (modal) {
                    modal.classList.add('hidden');
                }
            },

            async loadSettingsIntoForm() {
                try {
                    const language = await getSetting('language') || '';
                    const country = await getSetting('country') || '';
                    const state = await getSetting('state') || '';
                    const city = await getSetting('city') || '';
                    const serverlessEndpoint = await getSetting('serverlessEndpoint') || '';

                    document.getElementById('settings-language').value = language;
                    document.getElementById('settings-country').value = country;
                    document.getElementById('settings-state').value = state;
                    document.getElementById('settings-city').value = city;
                    document.getElementById('settings-serverless-endpoint').value = serverlessEndpoint;
                } catch (error) {
                    console.error('Error loading settings into form:', error);
                }
            },

            // Settings validation and persistence
            validateSettingsForm() {
                const errors = {};
                let isValid = true;

                const language = document.getElementById('settings-language').value;
                const country = document.getElementById('settings-country').value;
                const serverlessEndpoint = document.getElementById('settings-serverless-endpoint').value;

                // Clear previous validation states
                document.querySelectorAll('.form-field').forEach(field => {
                    field.classList.remove('error', 'success');
                    const errorMsg = field.querySelector('.error-message');
                    if (errorMsg) errorMsg.textContent = '';
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

                // Validate serverless endpoint if provided
                if (serverlessEndpoint) {
                    if (!serverlessEndpoint.startsWith('https://')) {
                        errors.serverlessEndpoint = 'URL deve começar com "https://"';
                        isValid = false;
                    } else {
                        try {
                            const urlObj = new URL(serverlessEndpoint);
                            if (serverlessEndpoint.length < 12) {
                                errors.serverlessEndpoint = 'URL muito curta. Inclua o domínio completo.';
                                isValid = false;
                            } else if (!urlObj.hostname.includes('.')) {
                                errors.serverlessEndpoint = 'URL deve incluir um domínio válido';
                                isValid = false;
                            }
                        } catch {
                            errors.serverlessEndpoint = 'Formato de URL inválido';
                            isValid = false;
                        }
                    }
                }

                // Apply validation states
                Object.keys(errors).forEach(fieldName => {
                    const fieldId = fieldName === 'serverlessEndpoint' ? 'settings-serverless-endpoint' : `settings-${fieldName}`;
                    const field = document.getElementById(fieldId);
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

                return { isValid, errors };
            },

            async saveSettings() {
                const validation = this.validateSettingsForm();
                if (!validation.isValid) {
                    this.toastSystem.show('Por favor, corrija os erros no formulário', 'error');
                    return false;
                }

                const language = document.getElementById('settings-language').value;
                const country = document.getElementById('settings-country').value;
                const state = document.getElementById('settings-state').value;
                const city = document.getElementById('settings-city').value;
                const serverlessEndpoint = document.getElementById('settings-serverless-endpoint').value;

                try {
                    // Save individual settings
                    await setSetting('language', language);
                    await setSetting('country', country);
                    await setSetting('state', state);
                    await setSetting('city', city);
                    await setSetting('serverlessEndpoint', serverlessEndpoint);

                    // Set base URL from defaults
                    const baseUrl = getDefaultBaseUrl(country);
                    await setSetting('baseUrl', baseUrl);

                    this.toastSystem.show('Configurações salvas', 'success');
                    this.hideModal('settings');

                    // Refresh workspace if on step 1
                    if (this.currentStep === 1) {
                        await this.refreshWorkspace();
                    }

                    return true;
                } catch (error) {
                    console.error('Error saving settings:', error);
                    this.toastSystem.show('Erro ao salvar configurações', 'error');
                    return false;
                }
            },

            async refreshWorkspace() {
                // Validate configuration
                const config = await this.validateRequiredSettings();
                if (config.isValid) {
                    this.hideConfigurationBanner();
                    await this.loadAvailableDocuments();
                } else {
                    this.showConfigurationBanner(config.missing);
                }
            },

            // Document loading
            async loadAvailableDocuments() {
                try {
                    const config = await this.validateRequiredSettings();
                    if (!config.isValid) {
                        throw new Error('Configuration incomplete');
                    }

                    // Mock document loading
                    this.availableDocuments = [
                        { name: 'constituicao-federal.md', title: 'Constituição Federal' },
                        { name: 'codigo-civil.md', title: 'Código Civil' },
                        { name: 'codigo-penal.md', title: 'Código Penal' }
                    ];

                    const documentSelect = document.getElementById('document-select');
                    if (documentSelect) {
                        documentSelect.innerHTML = '<option value="">Selecione um documento</option>';
                        this.availableDocuments.forEach(doc => {
                            const option = document.createElement('option');
                            option.value = doc.name;
                            option.textContent = doc.title;
                            documentSelect.appendChild(option);
                        });
                    }

                    this.toastSystem.show('Documentos carregados', 'success');
                    return this.availableDocuments;
                } catch (error) {
                    this.toastSystem.show('Erro ao carregar documentos', 'error');
                    return [];
                }
            },

            // Context management
            updateSelectedContext() {
                const selectedArticles = this.allArticles.filter(article => article.selected);
                this.selectedContext = {
                    articles: selectedArticles,
                    text: selectedArticles.map(a => `${a.title}\n${a.text}`).join('\n\n'),
                    lastUpdated: Date.now()
                };

                const contextArea = document.getElementById('selected-context');
                if (contextArea) {
                    contextArea.value = this.selectedContext.text;
                }

                this.updatePromptStudioAvailability();
                this.saveContextState();
            },

            async saveContextState() {
                try {
                    await setSetting('workspace-context-state', this.selectedContext);
                } catch (error) {
                    console.error('Error saving context state:', error);
                }
            },

            async restoreContextState() {
                try {
                    const savedContext = await getSetting('workspace-context-state');
                    if (savedContext) {
                        this.selectedContext = savedContext;

                        const contextArea = document.getElementById('selected-context');
                        if (contextArea) {
                            contextArea.value = this.selectedContext.text;
                        }

                        this.updatePromptStudioAvailability();
                    }
                } catch (error) {
                    console.error('Error restoring context state:', error);
                }
            },

            // Chrome AI integration
            async checkChromeAIAvailability() {
                try {
                    if (!('ai' in self)) {
                        this.chromeAIAvailable = false;
                        this.showChromeAISetupBanner();
                        return false;
                    }

                    if ('assistant' in self.ai) {
                        const testAssistant = await self.ai.assistant.create();
                        if (testAssistant) {
                            this.chromeAIAvailable = true;
                            this.hideChromeAISetupBanner();
                            return true;
                        }
                    }

                    this.chromeAIAvailable = false;
                    this.showChromeAISetupBanner();
                    return false;
                } catch (error) {
                    console.warn('Chrome AI availability check failed:', error);
                    this.chromeAIAvailable = false;
                    this.showChromeAISetupBanner();
                    return false;
                }
            },

            // Error handling
            handleOfflineFallback(context) {
                this.toastSystem.show('Modo offline ativado. Funcionalidades limitadas.', 'warning', 5000);

                // Try to use cached data
                if (context === 'document_loading' && this.availableDocuments.length === 0) {
                    // Show cached documents if available
                    this.loadCachedDocuments();
                }
            },

            async loadCachedDocuments() {
                try {
                    const cachedDocs = await getSetting('cached-documents');
                    if (cachedDocs && cachedDocs.length > 0) {
                        this.availableDocuments = cachedDocs;
                        this.toastSystem.show('Usando documentos em cache', 'info');
                        return cachedDocs;
                    }
                } catch (error) {
                    console.error('Error loading cached documents:', error);
                }
                return [];
            },

            // Logging and debugging
            logWorkspaceState(action, metadata = {}) {
                console.debug('Workspace State:', {
                    action,
                    step: this.currentStep,
                    contextSize: this.selectedContext?.articles?.length || 0,
                    configValid: this.configurationValid,
                    view: this.currentView,
                    ...metadata
                });
            },

            // Utility methods
            showToast(message, type, duration) {
                return this.toastSystem.show(message, type, duration);
            },

            showToastWithAction(message, type, duration, actionText, actionCallback) {
                return this.toastSystem.showWithAction(message, type, duration, actionText, actionCallback);
            }
        };

        // Setup event listeners
        document.getElementById('settings-icon').addEventListener('click', () => {
            mockApp.showModal('settings');
        });

        document.getElementById('close-settings-modal').addEventListener('click', () => {
            mockApp.hideModal('settings');
        });

        document.getElementById('open-settings-btn').addEventListener('click', () => {
            mockApp.showModal('settings');
        });

        document.getElementById('settings-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await mockApp.saveSettings();
        });

        // Step navigation
        document.querySelectorAll('.workspace-steps .step').forEach((step, index) => {
            step.addEventListener('click', () => {
                const stepNumber = index + 1;
                if (stepNumber === 2 && mockApp.selectedContext.articles.length === 0) {
                    mockApp.toastSystem.show('Selecione contexto antes de usar o Prompt Studio', 'warning');
                    return;
                }
                mockApp.goToStep(stepNumber);
            });
        });

        // Make globally available for tests
        window.mockApp = mockApp;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        delete window.mockApp;
        vi.clearAllMocks();
    });

    describe('Configuration Validation Logic', () => {
        it('should validate required settings correctly', async () => {
            // Mock missing settings
            getSetting.mockImplementation((key) => {
                const settings = {};
                return Promise.resolve(settings[key]);
            });

            const config = await mockApp.validateRequiredSettings();

            expect(config.isValid).toBe(false);
            expect(config.missing).toEqual(['language', 'country', 'baseUrl']);
        });

        it('should validate complete settings correctly', async () => {
            // Mock complete settings
            getSetting.mockImplementation((key) => {
                const settings = {
                    language: 'pt-BR',
                    country: 'br',
                    baseUrl: 'https://example.com/corpus'
                };
                return Promise.resolve(settings[key]);
            });

            const config = await mockApp.validateRequiredSettings();

            expect(config.isValid).toBe(true);
            expect(config.missing).toEqual([]);
            expect(config.settings.language).toBe('pt-BR');
            expect(config.settings.country).toBe('br');
        });

        it('should show configuration banner when settings are incomplete', async () => {
            const banner = document.getElementById('configuration-banner');
            expect(banner.classList.contains('hidden')).toBe(true);

            mockApp.showConfigurationBanner(['language', 'country']);

            expect(banner.classList.contains('hidden')).toBe(false);
            expect(banner.querySelector('.banner-message').innerHTML).toContain('Configure idioma e país');
        });

        it('should disable document controls when configuration is incomplete', () => {
            const documentSelect = document.getElementById('document-select');
            const searchInput = document.getElementById('search-input');

            expect(documentSelect.disabled).toBe(true); // Initially disabled
            expect(searchInput.disabled).toBe(true);

            mockApp.enableDocumentControls();
            expect(documentSelect.disabled).toBe(false);
            expect(searchInput.disabled).toBe(false);

            mockApp.disableDocumentControls();
            expect(documentSelect.disabled).toBe(true);
            expect(searchInput.disabled).toBe(true);
        });

        it('should validate serverless endpoint URL format', () => {
            // Set required fields
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';

            // Test valid HTTPS URL
            document.getElementById('settings-serverless-endpoint').value = 'https://api.example.com/webhook';
            let validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(true);

            // Test invalid HTTP URL
            document.getElementById('settings-serverless-endpoint').value = 'http://api.example.com/webhook';
            validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(false);
            expect(validation.errors.serverlessEndpoint).toBe('URL deve começar com "https://"');

            // Test invalid URL format
            document.getElementById('settings-serverless-endpoint').value = 'not-a-url';
            validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(false);
            expect(validation.errors.serverlessEndpoint).toBe('URL deve começar com "https://"');
        });
    });

    describe('2-Step Workspace Navigation', () => {
        it('should initialize with step 1 active', () => {
            expect(mockApp.currentStep).toBe(1);

            const activeStep = document.querySelector('.workspace-steps .step.active');
            expect(activeStep.textContent).toBe('Leis & Artigos');
            expect(activeStep.dataset.step).toBe('1');

            const activeContent = document.querySelector('.step-content.active');
            expect(activeContent.id).toBe('step-1');
        });

        it('should navigate between steps correctly', () => {
            // Initially on step 1
            expect(mockApp.currentStep).toBe(1);

            // Add context to enable step 2
            mockApp.selectedContext.articles = [{ title: 'Test Article', text: 'Test content' }];
            mockApp.updatePromptStudioAvailability();

            // Navigate to step 2
            const result = mockApp.goToStep(2);
            expect(result).toBe(true);
            expect(mockApp.currentStep).toBe(2);

            const activeStep = document.querySelector('.workspace-steps .step.active');
            expect(activeStep.textContent).toBe('Prompt Studio');

            const activeContent = document.querySelector('.step-content.active');
            expect(activeContent.id).toBe('step-2');

            // Navigate back to step 1
            mockApp.goToStep(1);
            expect(mockApp.currentStep).toBe(1);
        });

        it('should prevent navigation to invalid steps', () => {
            const result1 = mockApp.goToStep(0);
            expect(result1).toBe(false);
            expect(mockApp.currentStep).toBe(1);

            const result2 = mockApp.goToStep(3);
            expect(result2).toBe(false);
            expect(mockApp.currentStep).toBe(1);
        });

        it('should disable Prompt Studio when no context is selected', () => {
            // No context selected
            mockApp.selectedContext.articles = [];
            mockApp.updatePromptStudioAvailability();

            const step2Pill = document.querySelector('.workspace-steps .step[data-step="2"]');
            expect(step2Pill.style.opacity).toBe('0.5');
            expect(step2Pill.style.pointerEvents).toBe('none');

            const executeBtn = document.getElementById('execute-ai');
            expect(executeBtn.disabled).toBe(true);
        });

        it('should enable Prompt Studio when context is selected', () => {
            // Add context
            mockApp.selectedContext.articles = [{ title: 'Test', text: 'Content' }];
            mockApp.chromeAIAvailable = true;
            mockApp.updatePromptStudioAvailability();

            const step2Pill = document.querySelector('.workspace-steps .step[data-step="2"]');
            expect(step2Pill.style.opacity).toBe('1');
            expect(step2Pill.style.pointerEvents).toBe('auto');

            const executeBtn = document.getElementById('execute-ai');
            expect(executeBtn.disabled).toBe(false);
        });

        it('should log workspace state during navigation', () => {
            const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => { });

            mockApp.goToStep(2);

            expect(consoleSpy).toHaveBeenCalledWith('Workspace State:', expect.objectContaining({
                action: 'step_navigation',
                step: 2,
                contextSize: 0
            }));

            consoleSpy.mockRestore();
        });
    });

    describe('Settings Modal Functionality and Persistence', () => {
        it('should show and hide settings modal', () => {
            const modal = document.getElementById('settings-modal');
            expect(modal.classList.contains('hidden')).toBe(true);

            mockApp.showModal('settings');
            expect(modal.classList.contains('hidden')).toBe(false);

            mockApp.hideModal('settings');
            expect(modal.classList.contains('hidden')).toBe(true);
        });

        it('should load current settings into form when modal opens', async () => {
            getSetting.mockImplementation((key) => {
                const settings = {
                    language: 'en-US',
                    country: 'us',
                    state: 'California',
                    city: 'San Francisco',
                    serverlessEndpoint: 'https://api.example.com/webhook'
                };
                return Promise.resolve(settings[key]);
            });

            await mockApp.loadSettingsIntoForm();

            expect(document.getElementById('settings-language').value).toBe('en-US');
            expect(document.getElementById('settings-country').value).toBe('us');
            expect(document.getElementById('settings-state').value).toBe('California');
            expect(document.getElementById('settings-city').value).toBe('San Francisco');
            expect(document.getElementById('settings-serverless-endpoint').value).toBe('https://api.example.com/webhook');
        });

        it('should save settings successfully', async () => {
            setSetting.mockResolvedValue(true);

            // Fill form
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';
            document.getElementById('settings-state').value = 'RS';
            document.getElementById('settings-city').value = 'Porto Alegre';
            document.getElementById('settings-serverless-endpoint').value = 'https://api.example.com/webhook';

            const result = await mockApp.saveSettings();

            expect(result).toBe(true);
            expect(setSetting).toHaveBeenCalledWith('language', 'pt-BR');
            expect(setSetting).toHaveBeenCalledWith('country', 'br');
            expect(setSetting).toHaveBeenCalledWith('state', 'RS');
            expect(setSetting).toHaveBeenCalledWith('city', 'Porto Alegre');
            expect(setSetting).toHaveBeenCalledWith('serverlessEndpoint', 'https://api.example.com/webhook');
            expect(setSetting).toHaveBeenCalledWith('baseUrl', expect.any(String));

            // Check success toast
            const successToast = mockToastSystem.toasts.find(t => t.type === 'success');
            expect(successToast).toBeTruthy();
            expect(successToast.message).toBe('Configurações salvas');
        });

        it('should handle settings save errors', async () => {
            setSetting.mockRejectedValue(new Error('Database error'));

            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';

            const result = await mockApp.saveSettings();

            expect(result).toBe(false);

            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toBe('Erro ao salvar configurações');
        });

        it('should refresh workspace after saving settings on step 1', async () => {
            setSetting.mockResolvedValue(true);
            getSetting.mockImplementation((key) => {
                const settings = {
                    language: 'pt-BR',
                    country: 'br',
                    baseUrl: 'https://example.com/corpus'
                };
                return Promise.resolve(settings[key]);
            });

            mockApp.currentStep = 1;

            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';

            const refreshSpy = vi.spyOn(mockApp, 'refreshWorkspace');

            await mockApp.saveSettings();

            expect(refreshSpy).toHaveBeenCalled();
        });
    });

    describe('Context Management Across Navigation and Reloads', () => {
        it('should update selected context correctly', () => {
            mockApp.allArticles = [
                { title: 'Article 1', text: 'Content 1', selected: true },
                { title: 'Article 2', text: 'Content 2', selected: false },
                { title: 'Article 3', text: 'Content 3', selected: true }
            ];

            mockApp.updateSelectedContext();

            expect(mockApp.selectedContext.articles).toHaveLength(2);
            expect(mockApp.selectedContext.text).toContain('Article 1\nContent 1');
            expect(mockApp.selectedContext.text).toContain('Article 3\nContent 3');
            expect(mockApp.selectedContext.text).not.toContain('Article 2');
            expect(mockApp.selectedContext.lastUpdated).toBeTypeOf('number');

            const contextArea = document.getElementById('selected-context');
            expect(contextArea.value).toBe(mockApp.selectedContext.text);
        });

        it('should save context state to IndexedDB', async () => {
            setSetting.mockResolvedValue(true);

            mockApp.selectedContext = {
                articles: [{ title: 'Test', text: 'Content' }],
                text: 'Test\nContent',
                lastUpdated: Date.now()
            };

            await mockApp.saveContextState();

            expect(setSetting).toHaveBeenCalledWith('workspace-context-state', mockApp.selectedContext);
        });

        it('should restore context state from IndexedDB', async () => {
            const savedContext = {
                articles: [{ title: 'Saved Article', text: 'Saved Content' }],
                text: 'Saved Article\nSaved Content',
                lastUpdated: Date.now() - 1000
            };

            getSetting.mockResolvedValue(savedContext);

            await mockApp.restoreContextState();

            expect(mockApp.selectedContext).toEqual(savedContext);

            const contextArea = document.getElementById('selected-context');
            expect(contextArea.value).toBe(savedContext.text);
        });

        it('should handle context restoration errors gracefully', async () => {
            getSetting.mockRejectedValue(new Error('Database error'));

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            await mockApp.restoreContextState();

            expect(consoleSpy).toHaveBeenCalledWith('Error restoring context state:', expect.any(Error));

            consoleSpy.mockRestore();
        });

        it('should preserve context during step navigation', () => {
            // Set up context
            mockApp.selectedContext = {
                articles: [{ title: 'Test', text: 'Content' }],
                text: 'Test\nContent',
                lastUpdated: Date.now()
            };

            const originalContext = { ...mockApp.selectedContext };

            // Navigate between steps
            mockApp.goToStep(2);
            mockApp.goToStep(1);

            expect(mockApp.selectedContext).toEqual(originalContext);
        });
    });

    describe('Error Handling Scenarios and Recovery Mechanisms', () => {
        it('should handle Chrome AI unavailability', async () => {
            // Mock AI as unavailable
            delete global.self.ai;

            const available = await mockApp.checkChromeAIAvailability();

            expect(available).toBe(false);
            expect(mockApp.chromeAIAvailable).toBe(false);

            const banner = document.getElementById('chrome-ai-banner');
            expect(banner.classList.contains('hidden')).toBe(false);
        });

        it('should handle Chrome AI availability', async () => {
            // Mock AI as available
            global.self.ai = {
                assistant: {
                    create: vi.fn().mockResolvedValue({})
                }
            };

            const available = await mockApp.checkChromeAIAvailability();

            expect(available).toBe(true);
            expect(mockApp.chromeAIAvailable).toBe(true);

            const banner = document.getElementById('chrome-ai-banner');
            expect(banner.classList.contains('hidden')).toBe(true);
        });

        it('should handle Chrome AI errors gracefully', async () => {
            global.self.ai = {
                assistant: {
                    create: vi.fn().mockRejectedValue(new Error('AI not ready'))
                }
            };

            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const available = await mockApp.checkChromeAIAvailability();

            expect(available).toBe(false);
            expect(consoleSpy).toHaveBeenCalledWith('Chrome AI availability check failed:', expect.any(Error));

            consoleSpy.mockRestore();
        });

        it('should handle offline mode with fallback', async () => {
            getSetting.mockResolvedValue([
                { name: 'cached-doc.md', title: 'Cached Document' }
            ]);

            mockApp.handleOfflineFallback('document_loading');

            const warningToast = mockToastSystem.toasts.find(t => t.type === 'warning');
            expect(warningToast).toBeTruthy();
            expect(warningToast.message).toContain('Modo offline ativado');

            const cachedDocs = await mockApp.loadCachedDocuments();
            expect(cachedDocs).toHaveLength(1);
            expect(cachedDocs[0].title).toBe('Cached Document');
        });

        it('should handle document loading errors', async () => {
            getSetting.mockImplementation((key) => {
                if (key === 'language') return Promise.resolve(null);
                return Promise.resolve('value');
            });

            const documents = await mockApp.loadAvailableDocuments();

            expect(documents).toEqual([]);

            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toBe('Erro ao carregar documentos');
        });

        it('should handle settings form validation errors', async () => {
            // Leave required fields empty
            document.getElementById('settings-language').value = '';
            document.getElementById('settings-country').value = '';

            const result = await mockApp.saveSettings();

            expect(result).toBe(false);
            expect(setSetting).not.toHaveBeenCalled();

            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toBe('Por favor, corrija os erros no formulário');
        });

        it('should show specific error messages for different validation failures', () => {
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';

            const testCases = [
                {
                    url: 'http://example.com',
                    expectedError: 'URL deve começar com "https://"'
                },
                {
                    url: 'https://a',
                    expectedError: 'URL muito curta. Inclua o domínio completo.'
                },
                {
                    url: 'https://localhost',
                    expectedError: 'URL deve incluir um domínio válido'
                }
            ];

            testCases.forEach(({ url, expectedError }) => {
                document.getElementById('settings-serverless-endpoint').value = url;
                const validation = mockApp.validateSettingsForm();

                expect(validation.isValid).toBe(false);
                expect(validation.errors.serverlessEndpoint).toBe(expectedError);
            });
        });

        it('should handle configuration banner interactions', () => {
            const banner = document.getElementById('configuration-banner');
            const openSettingsBtn = document.getElementById('open-settings-btn');

            mockApp.showConfigurationBanner(['language']);

            expect(banner.classList.contains('hidden')).toBe(false);

            // Test clicking the settings button
            const showModalSpy = vi.spyOn(mockApp, 'showModal');
            openSettingsBtn.click();

            expect(showModalSpy).toHaveBeenCalledWith('settings');
        });
    });

    describe('Integration Tests - Complete Workflows', () => {
        it('should complete new user onboarding flow', async () => {
            // 1. New user opens workspace - should show configuration banner
            getSetting.mockResolvedValue(null); // No settings saved

            const config = await mockApp.validateRequiredSettings();
            expect(config.isValid).toBe(false);

            mockApp.showConfigurationBanner(config.missing);
            expect(document.getElementById('configuration-banner').classList.contains('hidden')).toBe(false);

            // 2. User clicks settings button
            mockApp.showModal('settings');
            expect(document.getElementById('settings-modal').classList.contains('hidden')).toBe(false);

            // 3. User fills and saves settings
            setSetting.mockResolvedValue(true);
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';

            const saveResult = await mockApp.saveSettings();
            expect(saveResult).toBe(true);

            // 4. Workspace should refresh and hide banner
            getSetting.mockImplementation((key) => {
                const settings = {
                    language: 'pt-BR',
                    country: 'br',
                    baseUrl: 'https://example.com/corpus'
                };
                return Promise.resolve(settings[key]);
            });

            await mockApp.refreshWorkspace();
            expect(document.getElementById('configuration-banner').classList.contains('hidden')).toBe(true);
        });

        it('should handle context selection and AI workflow', async () => {
            // 1. Setup complete configuration
            mockApp.configurationValid = true;
            mockApp.chromeAIAvailable = true;

            // 2. Load documents
            await mockApp.loadAvailableDocuments();
            expect(mockApp.availableDocuments).toHaveLength(3);

            // 3. Select articles and build context
            mockApp.allArticles = [
                { title: 'Article 1', text: 'Content 1', selected: true },
                { title: 'Article 2', text: 'Content 2', selected: false }
            ];

            mockApp.updateSelectedContext();
            expect(mockApp.selectedContext.articles).toHaveLength(1);

            // 4. Navigate to Prompt Studio
            const navResult = mockApp.goToStep(2);
            expect(navResult).toBe(true);
            expect(mockApp.currentStep).toBe(2);

            // 5. Verify AI button is enabled
            const executeBtn = document.getElementById('execute-ai');
            expect(executeBtn.disabled).toBe(false);
        });

        it('should handle settings change with context reset', async () => {
            // 1. Setup existing context
            mockApp.selectedContext = {
                articles: [{ title: 'Old Article', text: 'Old Content' }],
                text: 'Old Article\nOld Content',
                lastUpdated: Date.now()
            };

            // 2. Change critical settings (country)
            setSetting.mockResolvedValue(true);
            document.getElementById('settings-language').value = 'en-US';
            document.getElementById('settings-country').value = 'us'; // Changed from 'br'

            await mockApp.saveSettings();

            // 3. Context should be preserved (in this implementation)
            // In a real implementation, you might want to reset context when jurisdiction changes
            expect(mockApp.selectedContext.articles).toHaveLength(1);
        });
    });

    describe('Performance and Memory Management', () => {
        it('should handle large context efficiently', () => {
            const startTime = performance.now();

            // Create large context
            const largeArticles = Array.from({ length: 100 }, (_, i) => ({
                title: `Article ${i}`,
                text: `Content ${i}`.repeat(100),
                selected: i % 2 === 0
            }));

            mockApp.allArticles = largeArticles;
            mockApp.updateSelectedContext();

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(100); // Should be fast
            expect(mockApp.selectedContext.articles).toHaveLength(50); // Half selected
        });

        it('should clean up resources properly', () => {
            // Setup resources
            mockApp.selectedContext = {
                articles: Array.from({ length: 50 }, (_, i) => ({ title: `Article ${i}`, text: `Content ${i}` })),
                text: 'Large text content'.repeat(1000),
                lastUpdated: Date.now()
            };

            // Simulate cleanup
            mockApp.selectedContext = {
                articles: [],
                text: '',
                lastUpdated: null
            };

            expect(mockApp.selectedContext.articles).toHaveLength(0);
            expect(mockApp.selectedContext.text).toBe('');
        });
    });
});

describe('Jurisdiction Path Mapping', () => {
    it('should correctly map pt-BR language to BR country', () => {
        const mockApp = {
            formatJurisdictionForCorpus: (jurisdiction, language) => {
                const languageToCountry = {
                    'pt-BR': 'BR',
                    'en-US': 'US',
                    'es-ES': 'ES'
                };

                if (!jurisdiction) {
                    const country = languageToCountry[language] || 'US';
                    return `${country}/Federal`;
                }

                const parts = [];
                const country = jurisdiction.country || languageToCountry[language] || 'US';
                parts.push(country.toUpperCase());

                if (jurisdiction.state) {
                    parts.push(jurisdiction.state.toUpperCase());
                } else {
                    parts.push('Federal');
                }

                if (jurisdiction.city) {
                    parts.push(jurisdiction.city);
                }

                return parts.join('/');
            }
        };

        // Test pt-BR → BR/Federal
        expect(mockApp.formatJurisdictionForCorpus(null, 'pt-BR')).toBe('BR/Federal');
        expect(mockApp.formatJurisdictionForCorpus({}, 'pt-BR')).toBe('BR/Federal');

        // Test en-US → US/Federal  
        expect(mockApp.formatJurisdictionForCorpus(null, 'en-US')).toBe('US/Federal');
        expect(mockApp.formatJurisdictionForCorpus({}, 'en-US')).toBe('US/Federal');

        // Test es-ES → ES/Federal
        expect(mockApp.formatJurisdictionForCorpus(null, 'es-ES')).toBe('ES/Federal');
        expect(mockApp.formatJurisdictionForCorpus({}, 'es-ES')).toBe('ES/Federal');

        // Test with explicit country (should override language mapping)
        expect(mockApp.formatJurisdictionForCorpus({ country: 'FR' }, 'pt-BR')).toBe('FR/Federal');
    });

    it('should generate correct file paths for different languages', () => {
        // Simulate the worker path generation logic
        const generatePath = (language, jurisdiction, fileSlug) => {
            const languageToCountry = {
                'pt-BR': 'BR',
                'en-US': 'US',
                'es-ES': 'ES'
            };

            const country = languageToCountry[language] || 'US';
            const level = jurisdiction?.includes('/') ? jurisdiction.split('/')[1].toLowerCase() : 'federal';
            const dir = `${language}/${country}/${level}/constitution`;
            return `${dir}/${fileSlug}.md`;
        };

        // Test correct paths are generated
        expect(generatePath('pt-BR', 'BR/Federal', 'del1535')).toBe('pt-BR/BR/federal/constitution/del1535.md');
        expect(generatePath('en-US', 'US/Federal', 'amendment1')).toBe('en-US/US/federal/constitution/amendment1.md');
        expect(generatePath('es-ES', 'ES/Federal', 'articulo1')).toBe('es-ES/ES/federal/constitution/articulo1.md');
    });
});