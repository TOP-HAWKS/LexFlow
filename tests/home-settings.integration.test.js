/**
 * Integration Tests for Home View and Settings
 * Tests navigation from home cards to respective views, settings modal functionality,
 * and settings persistence and retrieval
 * 
 * Requirements: 2.1, 2.5, 8.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Home View and Settings Integration Tests', () => {
    let mockApp;
    let mockDB;
    let mockToastSystem;

    beforeEach(() => {
        // Setup DOM structure matching the actual SPA
        document.body.innerHTML = `
            <div class="app-container">
                <header class="app-header">
                    <nav class="app-nav">
                        <button class="nav-tab active" data-view="home">Início</button>
                        <button class="nav-tab" data-view="workspace">Workspace Jurídico</button>
                        <button class="nav-tab" data-view="collector">Coletor & Curadoria</button>
                        <button class="nav-tab" data-view="settings">⚙️</button>
                    </nav>
                </header>
                
                <main class="app-main">
                    <!-- Home View -->
                    <section id="home-view" class="view active">
                        <div class="feature-cards">
                            <div class="feature-card" data-navigate="workspace">
                                <div class="feature-title">Workspace Jurídico</div>
                            </div>
                            <div class="feature-card" data-navigate="collector">
                                <div class="feature-title">Coletor & Curadoria</div>
                            </div>
                        </div>
                        <button id="settings-button" class="secondary">⚙️ Configurações</button>
                    </section>
                    
                    <!-- Workspace View -->
                    <section id="workspace-view" class="view">
                        <h2>Workspace Jurídico</h2>
                    </section>
                    
                    <!-- Collector View -->
                    <section id="collector-view" class="view">
                        <h2>Coletor & Curadoria</h2>
                    </section>
                </main>
            </div>
            
            <!-- Settings Modal -->
            <div id="settings-modal" class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h3>Configurações</h3>
                        <button class="modal-close" id="close-settings">&times;</button>
                    </div>
                    <form id="settings-form">
                        <div class="form-field">
                            <label for="settings-language">Idioma:</label>
                            <select id="settings-language" name="language">
                                <option value="pt-BR">Português (Brasil)</option>
                                <option value="en-US">English (US)</option>
                                <option value="es-ES">Español</option>
                            </select>
                        </div>
                        <div class="form-field">
                            <label for="settings-country">País:</label>
                            <select id="settings-country" name="country">
                                <option value="br">Brasil</option>
                                <option value="us">Estados Unidos</option>
                                <option value="es">Espanha</option>
                            </select>
                        </div>
                        <div class="form-field">
                            <label for="settings-state">Estado:</label>
                            <input type="text" id="settings-state" name="state" placeholder="ex: Rio Grande do Sul">
                        </div>
                        <div class="form-field">
                            <label for="settings-city">Cidade:</label>
                            <input type="text" id="settings-city" name="city" placeholder="ex: Porto Alegre">
                        </div>
                        <div class="form-field">
                            <label for="settings-corpus-url">URL Base do Corpus:</label>
                            <input type="url" id="settings-corpus-url" name="corpusUrl" 
                                   placeholder="https://raw.githubusercontent.com/org/legal-corpus/main">
                        </div>
                        <div class="text-center">
                            <button type="submit" id="save-settings" class="primary">Salvar</button>
                            <button type="button" id="cancel-settings" class="secondary">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
            
            <!-- Toast Container -->
            <div id="toast-container" class="toast-container"></div>
        `;

        // Reset hash
        window.location.hash = '';

        // Mock IndexedDB operations
        mockDB = {
            settings: {
                language: 'pt-BR',
                country: 'br',
                state: 'RS',
                city: 'porto-alegre',
                corpusUrl: 'https://raw.githubusercontent.com/example/legal-corpus/main'
            },
            
            async getSettings() {
                return { ...this.settings };
            },
            
            async saveSettings(newSettings) {
                this.settings = { ...this.settings, ...newSettings };
                return true;
            },
            
            async clearSettings() {
                this.settings = {};
                return true;
            }
        };

        // Mock toast system
        mockToastSystem = {
            toasts: [],
            _idCounter: 0,
            
            show(message, type = 'info', duration = 3000) {
                const toast = { 
                    id: ++this._idCounter, 
                    message, 
                    type, 
                    duration,
                    timestamp: Date.now()
                };
                this.toasts.push(toast);
                
                // Create DOM element
                const toastElement = document.createElement('div');
                toastElement.className = `toast ${type}`;
                toastElement.id = `toast-${toast.id}`;
                toastElement.innerHTML = `
                    <span class="toast-icon">${this.getIcon(type)}</span>
                    <span class="toast-message">${message}</span>
                    <button class="toast-close" onclick="mockToastSystem.hide(${toast.id})">&times;</button>
                `;
                
                document.getElementById('toast-container').appendChild(toastElement);
                
                // Auto-hide after duration
                if (duration > 0) {
                    setTimeout(() => this.hide(toast.id), duration);
                }
                
                return toast.id;
            },
            
            hide(id) {
                this.toasts = this.toasts.filter(t => t.id !== id);
                const element = document.getElementById(`toast-${id}`);
                if (element) {
                    element.remove();
                }
            },
            
            clear() {
                this.toasts = [];
                document.getElementById('toast-container').innerHTML = '';
            },
            
            getCount() {
                return this.toasts.length;
            },
            
            getIcon(type) {
                const icons = {
                    success: '✓',
                    error: '❌',
                    warning: '⚠️',
                    info: 'ℹ️'
                };
                return icons[type] || icons.info;
            }
        };

        // Mock App with enhanced functionality
        mockApp = {
            currentView: 'home',
            settings: {},
            db: mockDB,
            toastSystem: mockToastSystem,
            
            // Navigation functionality
            navigate(route) {
                window.location.hash = route;
                this.handleRouteChange();
            },
            
            handleRouteChange() {
                const hash = window.location.hash.slice(1) || 'home';
                const validRoutes = ['home', 'workspace', 'collector', 'settings'];
                
                if (validRoutes.includes(hash)) {
                    this.showView(hash);
                } else {
                    this.toastSystem.show(`Rota inválida: ${hash}`, 'error');
                    this.navigate('home');
                }
            },
            
            showView(viewName) {
                if (this.currentView === viewName) return;
                
                // Hide all views
                document.querySelectorAll('.view.active').forEach(view => {
                    view.classList.remove('active');
                });
                
                // Update navigation tabs
                document.querySelectorAll('.nav-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                
                // Show target view
                if (viewName === 'settings') {
                    this.showModal('settings');
                } else {
                    const targetView = document.getElementById(`${viewName}-view`);
                    if (targetView) {
                        targetView.classList.add('active');
                        this.currentView = viewName;
                        
                        // Update active tab
                        const activeTab = document.querySelector(`[data-view="${viewName}"]`);
                        if (activeTab) {
                            activeTab.classList.add('active');
                        }
                    }
                }
            },
            
            // Modal functionality
            showModal(modalName) {
                const modal = document.getElementById(`${modalName}-modal`);
                if (modal) {
                    modal.classList.add('active');
                    
                    // Load current settings into form
                    if (modalName === 'settings') {
                        this.loadSettingsIntoForm();
                    }
                    
                    // Focus management
                    const firstInput = modal.querySelector('input, select, button');
                    if (firstInput) {
                        firstInput.focus();
                    }
                }
            },
            
            hideModal(modalName) {
                const modal = document.getElementById(`${modalName}-modal`);
                if (modal) {
                    modal.classList.remove('active');
                    
                    // Return focus to trigger element
                    const settingsButton = document.getElementById('settings-button');
                    if (settingsButton && modalName === 'settings') {
                        settingsButton.focus();
                    }
                }
            },
            
            // Settings functionality
            async loadSettings() {
                try {
                    this.settings = await this.db.getSettings();
                    return this.settings;
                } catch (error) {
                    this.toastSystem.show('Erro ao carregar configurações', 'error');
                    return {};
                }
            },
            
            async saveSettings(newSettings) {
                try {
                    await this.db.saveSettings(newSettings);
                    this.settings = { ...this.settings, ...newSettings };
                    this.toastSystem.show('Configurações salvas com sucesso', 'success');
                    return true;
                } catch (error) {
                    this.toastSystem.show('Erro ao salvar configurações', 'error');
                    return false;
                }
            },
            
            loadSettingsIntoForm() {
                const form = document.getElementById('settings-form');
                if (!form) return;
                
                Object.keys(this.settings).forEach(key => {
                    const input = form.querySelector(`[name="${key}"]`);
                    if (input) {
                        input.value = this.settings[key] || '';
                    }
                });
            },
            
            async handleSettingsSubmit(event) {
                event.preventDefault();
                
                const form = event.target || document.getElementById('settings-form');
                const formData = new FormData(form);
                const newSettings = {};
                
                for (const [key, value] of formData.entries()) {
                    newSettings[key] = value;
                }
                
                // Validate required fields
                if (!newSettings.language || !newSettings.country) {
                    this.toastSystem.show('Idioma e país são obrigatórios', 'error');
                    return false;
                }
                
                // Validate URL format
                if (newSettings.corpusUrl && !this.isValidUrl(newSettings.corpusUrl)) {
                    this.toastSystem.show('URL do corpus inválida', 'error');
                    return false;
                }
                
                const success = await this.saveSettings(newSettings);
                if (success) {
                    this.hideModal('settings');
                }
                
                return success;
            },
            
            isValidUrl(string) {
                try {
                    new URL(string);
                    return true;
                } catch (_) {
                    return false;
                }
            },
            
            // Initialize event listeners
            initEventListeners() {
                // Home navigation cards
                document.querySelectorAll('.feature-card[data-navigate]').forEach(card => {
                    card.addEventListener('click', (e) => {
                        const target = e.currentTarget.dataset.navigate;
                        this.navigate(target);
                    });
                    
                    // Keyboard support
                    card.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            const target = e.currentTarget.dataset.navigate;
                            this.navigate(target);
                        }
                    });
                });
                
                // Settings button
                const settingsButton = document.getElementById('settings-button');
                if (settingsButton) {
                    settingsButton.addEventListener('click', () => {
                        this.showModal('settings');
                    });
                }
                
                // Navigation tabs
                document.querySelectorAll('.nav-tab[data-view]').forEach(tab => {
                    tab.addEventListener('click', (e) => {
                        const view = e.currentTarget.dataset.view;
                        this.navigate(view);
                    });
                });
                
                // Settings modal events
                const settingsForm = document.getElementById('settings-form');
                if (settingsForm) {
                    settingsForm.addEventListener('submit', (e) => {
                        this.handleSettingsSubmit(e);
                    });
                }
                
                const closeSettings = document.getElementById('close-settings');
                if (closeSettings) {
                    closeSettings.addEventListener('click', () => {
                        this.hideModal('settings');
                    });
                }
                
                const cancelSettings = document.getElementById('cancel-settings');
                if (cancelSettings) {
                    cancelSettings.addEventListener('click', () => {
                        this.hideModal('settings');
                    });
                }
                
                // Modal overlay click to close
                const settingsModal = document.getElementById('settings-modal');
                if (settingsModal) {
                    settingsModal.addEventListener('click', (e) => {
                        if (e.target === settingsModal) {
                            this.hideModal('settings');
                        }
                    });
                }
                
                // Escape key to close modal
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Escape') {
                        const activeModal = document.querySelector('.modal-overlay.active');
                        if (activeModal) {
                            const modalId = activeModal.id.replace('-modal', '');
                            this.hideModal(modalId);
                        }
                    }
                });
            }
        };

        // Initialize the app
        mockApp.initEventListeners();
        
        // Make globally available for tests
        window.mockApp = mockApp;
        window.mockToastSystem = mockToastSystem;
    });

    afterEach(() => {
        // Clean up
        document.body.innerHTML = '';
        window.location.hash = '';
        delete window.mockApp;
        delete window.mockToastSystem;
        vi.clearAllMocks();
    });

    describe('Home View Navigation Tests (Requirement 2.1)', () => {
        it('should navigate to workspace when workspace card is clicked', async () => {
            const workspaceCard = document.querySelector('.feature-card[data-navigate="workspace"]');
            expect(workspaceCard).toBeTruthy();
            
            // Click the workspace card
            workspaceCard.click();
            
            // Verify navigation occurred
            expect(window.location.hash).toBe('#workspace');
            expect(mockApp.currentView).toBe('workspace');
            
            // Verify view is active
            const workspaceView = document.getElementById('workspace-view');
            expect(workspaceView.classList.contains('active')).toBe(true);
            
            // Verify home view is hidden
            const homeView = document.getElementById('home-view');
            expect(homeView.classList.contains('active')).toBe(false);
            
            // Verify navigation tab is updated
            const workspaceTab = document.querySelector('[data-view="workspace"]');
            expect(workspaceTab.classList.contains('active')).toBe(true);
        });

        it('should navigate to collector when collector card is clicked', async () => {
            const collectorCard = document.querySelector('.feature-card[data-navigate="collector"]');
            expect(collectorCard).toBeTruthy();
            
            // Click the collector card
            collectorCard.click();
            
            // Verify navigation occurred
            expect(window.location.hash).toBe('#collector');
            expect(mockApp.currentView).toBe('collector');
            
            // Verify view is active
            const collectorView = document.getElementById('collector-view');
            expect(collectorView.classList.contains('active')).toBe(true);
            
            // Verify home view is hidden
            const homeView = document.getElementById('home-view');
            expect(homeView.classList.contains('active')).toBe(false);
        });

        it('should support keyboard navigation for feature cards', async () => {
            const workspaceCard = document.querySelector('.feature-card[data-navigate="workspace"]');
            
            // Simulate Enter key press
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            workspaceCard.dispatchEvent(enterEvent);
            
            expect(window.location.hash).toBe('#workspace');
            expect(mockApp.currentView).toBe('workspace');
            
            // Test space key
            mockApp.navigate('home');
            const collectorCard = document.querySelector('.feature-card[data-navigate="collector"]');
            const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
            collectorCard.dispatchEvent(spaceEvent);
            
            expect(window.location.hash).toBe('#collector');
            expect(mockApp.currentView).toBe('collector');
        });

        it('should handle navigation between multiple views correctly', async () => {
            // Start at home
            expect(mockApp.currentView).toBe('home');
            
            // Navigate to workspace
            mockApp.navigate('workspace');
            expect(mockApp.currentView).toBe('workspace');
            expect(document.getElementById('workspace-view').classList.contains('active')).toBe(true);
            
            // Navigate to collector
            mockApp.navigate('collector');
            expect(mockApp.currentView).toBe('collector');
            expect(document.getElementById('collector-view').classList.contains('active')).toBe(true);
            expect(document.getElementById('workspace-view').classList.contains('active')).toBe(false);
            
            // Navigate back to home
            mockApp.navigate('home');
            expect(mockApp.currentView).toBe('home');
            expect(document.getElementById('home-view').classList.contains('active')).toBe(true);
            expect(document.getElementById('collector-view').classList.contains('active')).toBe(false);
        });

        it('should handle invalid navigation gracefully', async () => {
            const initialToastCount = mockToastSystem.getCount();
            
            // Try to navigate to invalid route
            mockApp.navigate('invalid-route');
            
            // Should show error toast and redirect to home
            expect(mockToastSystem.getCount()).toBe(initialToastCount + 1);
            expect(mockToastSystem.toasts[mockToastSystem.toasts.length - 1].type).toBe('error');
            expect(mockApp.currentView).toBe('home');
        });
    });

    describe('Settings Modal Tests (Requirement 2.5)', () => {
        it('should open settings modal when settings button is clicked', async () => {
            const settingsButton = document.getElementById('settings-button');
            expect(settingsButton).toBeTruthy();
            
            // Click settings button
            settingsButton.click();
            
            // Verify modal is shown
            const settingsModal = document.getElementById('settings-modal');
            expect(settingsModal.classList.contains('active')).toBe(true);
            
            // Verify form is populated with current settings
            const languageSelect = document.getElementById('settings-language');
            expect(languageSelect.value).toBe(mockDB.settings.language);
        });

        it('should close settings modal when close button is clicked', async () => {
            // Open modal first
            mockApp.showModal('settings');
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(true);
            
            // Click close button
            const closeButton = document.getElementById('close-settings');
            closeButton.click();
            
            // Verify modal is hidden
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(false);
        });

        it('should close settings modal when cancel button is clicked', async () => {
            // Open modal first
            mockApp.showModal('settings');
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(true);
            
            // Click cancel button
            const cancelButton = document.getElementById('cancel-settings');
            cancelButton.click();
            
            // Verify modal is hidden
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(false);
        });

        it('should close settings modal when escape key is pressed', async () => {
            // Open modal first
            mockApp.showModal('settings');
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(true);
            
            // Press escape key
            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(escapeEvent);
            
            // Verify modal is hidden
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(false);
        });

        it('should close settings modal when clicking outside modal content', async () => {
            // Open modal first
            mockApp.showModal('settings');
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(true);
            
            // Click on modal overlay (outside content)
            const modalOverlay = document.getElementById('settings-modal');
            const clickEvent = new MouseEvent('click', { target: modalOverlay });
            Object.defineProperty(clickEvent, 'target', { value: modalOverlay });
            modalOverlay.dispatchEvent(clickEvent);
            
            // Verify modal is hidden
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(false);
        });

        it('should load current settings into form when modal opens', async () => {
            // Set specific settings
            mockDB.settings = {
                language: 'en-US',
                country: 'us',
                state: 'california',
                city: 'san-francisco',
                corpusUrl: 'https://example.com/corpus'
            };
            
            // Load settings and open modal
            await mockApp.loadSettings();
            mockApp.showModal('settings');
            
            // Verify form fields are populated
            expect(document.getElementById('settings-language').value).toBe('en-US');
            expect(document.getElementById('settings-country').value).toBe('us');
            expect(document.getElementById('settings-state').value).toBe('california');
            expect(document.getElementById('settings-city').value).toBe('san-francisco');
            expect(document.getElementById('settings-corpus-url').value).toBe('https://example.com/corpus');
        });
    });

    describe('Settings Form Submission Tests (Requirement 2.5)', () => {
        beforeEach(async () => {
            // Load initial settings
            await mockApp.loadSettings();
            mockApp.showModal('settings');
        });

        it('should save settings when form is submitted with valid data', async () => {
            const form = document.getElementById('settings-form');
            
            // Fill form with new values
            document.getElementById('settings-language').value = 'es-ES';
            document.getElementById('settings-country').value = 'es';
            document.getElementById('settings-state').value = 'madrid';
            document.getElementById('settings-city').value = 'madrid-city';
            document.getElementById('settings-corpus-url').value = 'https://new-corpus.com/legal';
            
            // Submit form
            const submitEvent = new Event('submit');
            Object.defineProperty(submitEvent, 'target', { value: form });
            const result = await mockApp.handleSettingsSubmit(submitEvent);
            
            // Verify submission was successful
            expect(result).toBe(true);
            
            // Verify settings were saved
            expect(mockApp.settings.language).toBe('es-ES');
            expect(mockApp.settings.country).toBe('es');
            expect(mockApp.settings.state).toBe('madrid');
            expect(mockApp.settings.city).toBe('madrid-city');
            expect(mockApp.settings.corpusUrl).toBe('https://new-corpus.com/legal');
            
            // Verify success toast was shown
            const successToast = mockToastSystem.toasts.find(t => t.type === 'success');
            expect(successToast).toBeTruthy();
            expect(successToast.message).toContain('sucesso');
            
            // Verify modal was closed
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(false);
        });

        it('should show error when required fields are missing', async () => {
            const form = document.getElementById('settings-form');
            
            // Clear required fields
            document.getElementById('settings-language').value = '';
            document.getElementById('settings-country').value = '';
            
            // Submit form
            const submitEvent = new Event('submit');
            Object.defineProperty(submitEvent, 'target', { value: form });
            const result = await mockApp.handleSettingsSubmit(submitEvent);
            
            // Verify submission failed
            expect(result).toBe(false);
            
            // Verify error toast was shown
            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toContain('obrigatórios');
            
            // Verify modal remains open
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(true);
        });

        it('should validate URL format for corpus URL', async () => {
            const form = document.getElementById('settings-form');
            
            // Set invalid URL
            document.getElementById('settings-corpus-url').value = 'invalid-url';
            
            // Submit form
            const submitEvent = new Event('submit');
            Object.defineProperty(submitEvent, 'target', { value: form });
            const result = await mockApp.handleSettingsSubmit(submitEvent);
            
            // Verify submission failed
            expect(result).toBe(false);
            
            // Verify error toast was shown
            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toContain('URL');
        });

        it('should handle database save errors gracefully', async () => {
            // Mock database error
            const originalSaveSettings = mockDB.saveSettings;
            mockDB.saveSettings = vi.fn().mockRejectedValue(new Error('Database error'));
            
            const form = document.getElementById('settings-form');
            
            // Fill form with valid data
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';
            
            // Submit form
            const submitEvent = new Event('submit');
            Object.defineProperty(submitEvent, 'target', { value: form });
            const result = await mockApp.handleSettingsSubmit(submitEvent);
            
            // Verify submission failed
            expect(result).toBe(false);
            
            // Verify error toast was shown
            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toContain('Erro ao salvar');
            
            // Restore original method
            mockDB.saveSettings = originalSaveSettings;
        });
    });

    describe('Settings Persistence Tests (Requirement 8.1)', () => {
        it('should load settings from database on initialization', async () => {
            // Set specific settings in mock database
            mockDB.settings = {
                language: 'en-US',
                country: 'us',
                state: 'texas',
                city: 'austin',
                corpusUrl: 'https://texas-legal.com/corpus'
            };
            
            // Load settings
            const loadedSettings = await mockApp.loadSettings();
            
            // Verify settings were loaded correctly
            expect(loadedSettings.language).toBe('en-US');
            expect(loadedSettings.country).toBe('us');
            expect(loadedSettings.state).toBe('texas');
            expect(loadedSettings.city).toBe('austin');
            expect(loadedSettings.corpusUrl).toBe('https://texas-legal.com/corpus');
            
            // Verify app settings were updated
            expect(mockApp.settings).toEqual(loadedSettings);
        });

        it('should persist settings to database when saved', async () => {
            const newSettings = {
                language: 'pt-BR',
                country: 'br',
                state: 'SP',
                city: 'sao-paulo-city',
                corpusUrl: 'https://brasil-legal.com/corpus'
            };
            
            // Save settings
            const success = await mockApp.saveSettings(newSettings);
            
            // Verify save was successful
            expect(success).toBe(true);
            
            // Verify settings were persisted to database
            const persistedSettings = await mockDB.getSettings();
            expect(persistedSettings.language).toBe('pt-BR');
            expect(persistedSettings.country).toBe('br');
            expect(persistedSettings.state).toBe('SP');
            expect(persistedSettings.city).toBe('sao-paulo-city');
            expect(persistedSettings.corpusUrl).toBe('https://brasil-legal.com/corpus');
        });

        it('should handle database load errors gracefully', async () => {
            // Mock database error
            mockDB.getSettings = vi.fn().mockRejectedValue(new Error('Database error'));
            
            // Attempt to load settings
            const loadedSettings = await mockApp.loadSettings();
            
            // Verify empty settings returned
            expect(loadedSettings).toEqual({});
            
            // Verify error toast was shown
            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toContain('Erro ao carregar');
        });

        it('should maintain settings consistency across operations', async () => {
            // Initial settings
            const initialSettings = {
                language: 'pt-BR',
                country: 'br',
                state: 'RS',
                city: 'porto-alegre'
            };
            
            // Save initial settings
            await mockApp.saveSettings(initialSettings);
            
            // Load settings
            await mockApp.loadSettings();
            
            // Verify consistency
            expect(mockApp.settings).toEqual(expect.objectContaining(initialSettings));
            
            // Update partial settings
            const partialUpdate = {
                state: 'santa-catarina',
                city: 'florianopolis'
            };
            
            await mockApp.saveSettings(partialUpdate);
            
            // Verify partial update maintained other settings
            expect(mockApp.settings.language).toBe('pt-BR');
            expect(mockApp.settings.country).toBe('br');
            expect(mockApp.settings.state).toBe('santa-catarina');
            expect(mockApp.settings.city).toBe('florianopolis');
        });

        it('should handle empty or missing settings gracefully', async () => {
            // Clear database settings
            mockDB.settings = {};
            
            // Load settings
            const loadedSettings = await mockApp.loadSettings();
            
            // Verify empty settings handled gracefully
            expect(loadedSettings).toEqual({});
            expect(mockApp.settings).toEqual({});
            
            // Open settings modal with empty settings
            mockApp.showModal('settings');
            
            // Verify form handles empty values (should show default option values)
            const languageSelect = document.getElementById('settings-language');
            const countrySelect = document.getElementById('settings-country');
            expect(languageSelect.value).toBe('pt-BR'); // Default option value
            expect(countrySelect.value).toBe('br'); // Default option value
        });
    });

    describe('Integration Workflow Tests', () => {
        it('should complete full settings workflow from home to save', async () => {
            // Start at home view
            expect(mockApp.currentView).toBe('home');
            
            // Click settings button
            document.getElementById('settings-button').click();
            
            // Verify modal opened
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(true);
            
            // Fill form
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';
            document.getElementById('settings-state').value = 'minas-gerais';
            document.getElementById('settings-city').value = 'belo-horizonte';
            document.getElementById('settings-corpus-url').value = 'https://mg-legal.com/corpus';
            
            // Submit form
            const form = document.getElementById('settings-form');
            const submitEvent = new Event('submit');
            Object.defineProperty(submitEvent, 'target', { value: form });
            await mockApp.handleSettingsSubmit(submitEvent);
            
            // Verify complete workflow
            expect(mockApp.settings.language).toBe('pt-BR');
            expect(mockApp.settings.state).toBe('minas-gerais');
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(false);
            
            // Verify success feedback
            const successToast = mockToastSystem.toasts.find(t => t.type === 'success');
            expect(successToast).toBeTruthy();
        });

        it('should maintain navigation state during settings operations', async () => {
            // Navigate to workspace
            mockApp.navigate('workspace');
            expect(mockApp.currentView).toBe('workspace');
            
            // Open settings modal
            mockApp.showModal('settings');
            
            // Verify workspace view is still current (modal is overlay)
            expect(mockApp.currentView).toBe('workspace');
            
            // Close modal
            mockApp.hideModal('settings');
            
            // Verify still on workspace
            expect(mockApp.currentView).toBe('workspace');
            expect(document.getElementById('workspace-view').classList.contains('active')).toBe(true);
        });

        it('should handle rapid navigation and settings operations', async () => {
            // Rapid navigation sequence
            mockApp.navigate('workspace');
            mockApp.navigate('collector');
            mockApp.navigate('home');
            
            // Open and close settings rapidly
            mockApp.showModal('settings');
            mockApp.hideModal('settings');
            mockApp.showModal('settings');
            
            // Verify final state is consistent
            expect(mockApp.currentView).toBe('home');
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(true);
            
            // Complete settings operation
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';
            
            const form = document.getElementById('settings-form');
            const submitEvent = new Event('submit');
            Object.defineProperty(submitEvent, 'target', { value: form });
            await mockApp.handleSettingsSubmit(submitEvent);
            
            // Verify everything is in correct final state
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(false);
            expect(mockApp.currentView).toBe('home');
            expect(mockApp.settings.language).toBe('pt-BR');
        });
    });

    describe('Accessibility and User Experience Tests', () => {
        it('should manage focus correctly when opening and closing settings modal', async () => {
            const settingsButton = document.getElementById('settings-button');
            
            // Focus settings button and open modal
            settingsButton.focus();
            settingsButton.click();
            
            // Verify focus moved to modal
            const activeElement = document.activeElement;
            const modal = document.getElementById('settings-modal');
            expect(modal.contains(activeElement)).toBe(true);
            
            // Close modal
            mockApp.hideModal('settings');
            
            // Verify focus returned to settings button
            expect(document.activeElement).toBe(settingsButton);
        });

        it('should provide appropriate feedback for all user actions', async () => {
            const initialToastCount = mockToastSystem.getCount();
            
            // Open settings and save valid data
            mockApp.showModal('settings');
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';
            
            const form = document.getElementById('settings-form');
            const submitEvent = new Event('submit');
            Object.defineProperty(submitEvent, 'target', { value: form });
            await mockApp.handleSettingsSubmit(submitEvent);
            
            // Verify success feedback
            expect(mockToastSystem.getCount()).toBe(initialToastCount + 1);
            const successToast = mockToastSystem.toasts[mockToastSystem.toasts.length - 1];
            expect(successToast.type).toBe('success');
            expect(successToast.message).toContain('sucesso');
        });

        it('should handle keyboard navigation for all interactive elements', async () => {
            // Test feature card keyboard navigation
            const workspaceCard = document.querySelector('.feature-card[data-navigate="workspace"]');
            workspaceCard.focus();
            
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            workspaceCard.dispatchEvent(enterEvent);
            
            expect(mockApp.currentView).toBe('workspace');
            
            // Test settings modal keyboard navigation
            mockApp.navigate('home');
            mockApp.showModal('settings');
            
            const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
            document.dispatchEvent(escapeEvent);
            
            expect(document.getElementById('settings-modal').classList.contains('active')).toBe(false);
        });
    });
});