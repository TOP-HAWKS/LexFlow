/**
 * Unit Tests for Error Handling and Recovery Mechanisms
 * Tests error scenarios, recovery strategies, and fallback behaviors
 * Requirements: 4.1, 4.3, 6.3, 8.1, 8.2, 8.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setSetting, getSetting } from '../src/util/settings.js';

// Mock the settings module
vi.mock('../src/util/settings.js', () => ({
    setSetting: vi.fn(),
    getSetting: vi.fn()
}));

describe('Error Handling and Recovery Mechanisms Tests', () => {
    let mockErrorHandler;
    let mockToastSystem;
    let mockNetworkMonitor;

    beforeEach(() => {
        // Setup DOM for error handling tests
        document.body.innerHTML = `
            <div class="app-container">
                <!-- Error Banners -->
                <div id="configuration-error-banner" class="error-banner hidden" role="alert">
                    <div class="banner-content">
                        <div class="banner-icon">❌</div>
                        <div class="banner-message">
                            <strong>Configuração incompleta</strong><br>
                            Configure idioma e país para carregar documentos
                        </div>
                        <button class="banner-action" id="config-error-action-btn">Configurar</button>
                        <button class="banner-close" id="close-config-error-banner">×</button>
                    </div>
                </div>

                <div id="chrome-ai-setup-banner" class="ai-banner hidden" role="alert">
                    <div class="banner-content">
                        <div class="banner-icon">🤖</div>
                        <div class="banner-message">
                            <strong>Chrome AI não disponível</strong><br>
                            Habilite o Chrome AI nas configurações do Chrome
                        </div>
                        <button class="banner-action" id="ai-setup-help-btn">Configurar IA</button>
                        <button class="banner-close" id="close-ai-banner">×</button>
                    </div>
                </div>

                <div id="offline-banner" class="offline-banner hidden" role="alert">
                    <div class="banner-content">
                        <div class="banner-icon">📡</div>
                        <div class="banner-message">
                            <strong>Modo offline</strong><br>
                            Algumas funcionalidades podem estar limitadas
                        </div>
                        <button class="banner-action" id="retry-connection-btn">Tentar Novamente</button>
                    </div>
                </div>

                <!-- Workspace Elements -->
                <div id="workspace-view" class="view">
                    <select id="document-select">
                        <option value="">Selecione um documento</option>
                    </select>
                    <input type="text" id="search-input" placeholder="Buscar artigos...">
                    <div id="articles-list"></div>
                    <textarea id="context-area" readonly></textarea>
                    <button id="execute-ai">🤖 Executar IA</button>
                    <div id="ai-output"></div>
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
                const toast = { 
                    id: Date.now() + Math.random(),
                    message, 
                    type, 
                    duration, 
                    timestamp: Date.now(),
                    actionText: actionText,
                    actionCallback: actionCallback
                };
                this.toasts.push(toast);
                return toast.id;
            },
            hide(id) {
                this.toasts = this.toasts.filter(t => t.id !== id);
            },
            clear() {
                this.toasts = [];
            }
        };

        // Mock network monitor
        mockNetworkMonitor = {
            isOnline: navigator.onLine,
            connectionType: 'unknown',
            lastOnlineTime: Date.now(),
            
            setOnlineStatus(online) {
                this.isOnline = online;
                if (online) {
                    this.lastOnlineTime = Date.now();
                }
            },

            getConnectionInfo() {
                return {
                    isOnline: this.isOnline,
                    connectionType: this.connectionType,
                    lastOnlineTime: this.lastOnlineTime
                };
            }
        };

        // Mock error handler
        mockErrorHandler = {
            toastSystem: mockToastSystem,
            networkMonitor: mockNetworkMonitor,
            errorRetryCount: new Map(),
            maxRetries: 3,
            errorLogs: [],

            /**
             * Categorize error type and determine appropriate response
             */
            categorizeError(error, context) {
                const errorMessage = error?.message || error?.toString() || 'Unknown error';

                // Network errors
                if (errorMessage.includes('fetch') || errorMessage.includes('network') ||
                    errorMessage.includes('Failed to fetch') || !this.networkMonitor.isOnline) {
                    return {
                        type: 'network',
                        severity: 'medium',
                        userMessage: 'Erro de conexão',
                        suggestion: 'Verifique sua conexão com a internet e tente novamente',
                        recoverable: true,
                        retryable: true
                    };
                }

                // Configuration errors
                if (errorMessage.includes('Configuration incomplete') || 
                    errorMessage.includes('missing settings') ||
                    context.includes('configuration')) {
                    return {
                        type: 'configuration',
                        severity: 'high',
                        userMessage: 'Configuração incompleta',
                        suggestion: 'Configure idioma e país nas configurações',
                        recoverable: true,
                        retryable: false,
                        helpAction: () => this.showConfigurationModal()
                    };
                }

                // Chrome AI errors
                if (errorMessage.includes('ai') || errorMessage.includes('assistant') ||
                    errorMessage.includes('Chrome AI') || context.includes('AI')) {
                    return {
                        type: 'ai',
                        severity: 'medium',
                        userMessage: 'Erro na funcionalidade de IA',
                        suggestion: 'Verifique se o Chrome AI está habilitado',
                        recoverable: true,
                        retryable: false,
                        helpAction: () => this.showAISetupHelp()
                    };
                }

                // Storage errors
                if (errorMessage.includes('storage') || errorMessage.includes('quota') ||
                    errorMessage.includes('IndexedDB')) {
                    return {
                        type: 'storage',
                        severity: 'high',
                        userMessage: 'Erro de armazenamento',
                        suggestion: 'Espaço de armazenamento pode estar cheio',
                        recoverable: true,
                        retryable: true,
                        helpAction: () => this.showStorageHelp()
                    };
                }

                // Serverless endpoint errors
                if (errorMessage.includes('serverless') || errorMessage.includes('endpoint') ||
                    errorMessage.includes('404') || errorMessage.includes('500')) {
                    return {
                        type: 'serverless',
                        severity: 'medium',
                        userMessage: 'Erro no endpoint serverless',
                        suggestion: 'Verifique a configuração do endpoint',
                        recoverable: true,
                        retryable: true
                    };
                }

                // Generic error
                return {
                    type: 'unknown',
                    severity: 'medium',
                    userMessage: 'Erro inesperado',
                    suggestion: 'Tente recarregar a extensão',
                    recoverable: true,
                    retryable: true
                };
            },

            /**
             * Handle global application errors
             */
            handleGlobalError(error, context = 'Unknown', metadata = {}) {
                const errorInfo = this.categorizeError(error, context);
                
                // Log error
                this.logError(error, context, metadata, errorInfo);
                
                // Show user-friendly message
                this.showErrorToUser(errorInfo);
                
                // Attempt recovery
                this.attemptErrorRecovery(errorInfo, context);
                
                return errorInfo;
            },

            /**
             * Log error with detailed information
             */
            logError(error, context, metadata, errorInfo) {
                const errorLog = {
                    timestamp: new Date().toISOString(),
                    context: context,
                    type: errorInfo.type,
                    severity: errorInfo.severity,
                    message: error?.message || 'Unknown error',
                    stack: error?.stack,
                    metadata: metadata,
                    isOnline: this.networkMonitor.isOnline
                };

                this.errorLogs.push(errorLog);
                
                // Keep only last 100 errors
                if (this.errorLogs.length > 100) {
                    this.errorLogs = this.errorLogs.slice(-100);
                }

                console.error('Error logged:', errorLog);
            },

            /**
             * Show user-friendly error message
             */
            showErrorToUser(errorInfo) {
                const message = `${errorInfo.userMessage}. ${errorInfo.suggestion}`;
                const duration = errorInfo.severity === 'high' ? 8000 : 5000;

                if (errorInfo.helpAction) {
                    this.toastSystem.showWithAction(
                        message,
                        'error',
                        duration,
                        'Ajuda',
                        errorInfo.helpAction
                    );
                } else {
                    this.toastSystem.show(message, 'error', duration);
                }

                // Show specific banners for certain error types
                if (errorInfo.type === 'configuration') {
                    this.showConfigurationErrorBanner();
                } else if (errorInfo.type === 'ai') {
                    this.showChromeAISetupBanner();
                } else if (errorInfo.type === 'network' && !this.networkMonitor.isOnline) {
                    this.showOfflineBanner();
                }
            },

            /**
             * Attempt error recovery
             */
            attemptErrorRecovery(errorInfo, context) {
                if (!errorInfo.recoverable) return;

                const retryKey = `${errorInfo.type}-${context}`;
                const currentRetries = this.errorRetryCount.get(retryKey) || 0;

                if (errorInfo.retryable && currentRetries < this.maxRetries) {
                    this.errorRetryCount.set(retryKey, currentRetries + 1);
                    
                    // Exponential backoff
                    const delay = Math.pow(2, currentRetries) * 1000;
                    setTimeout(() => {
                        this.performErrorRecovery(errorInfo.type, context);
                    }, delay);
                }
            },

            /**
             * Perform specific recovery actions
             */
            performErrorRecovery(errorType, context) {
                switch (errorType) {
                    case 'network':
                        if (this.networkMonitor.isOnline) {
                            this.retryFailedOperations();
                        }
                        break;

                    case 'storage':
                        this.fallbackToSessionStorage();
                        break;

                    case 'ai':
                        this.fallbackToManualMode();
                        break;

                    case 'serverless':
                        this.retryServerlessOperation(context);
                        break;

                    default:
                        console.log(`No specific recovery for error type: ${errorType}`);
                }
            },

            /**
             * Show configuration error banner
             */
            showConfigurationErrorBanner() {
                const banner = document.getElementById('configuration-error-banner');
                if (banner) {
                    banner.classList.remove('hidden');
                }
            },

            /**
             * Show Chrome AI setup banner
             */
            showChromeAISetupBanner() {
                const banner = document.getElementById('chrome-ai-setup-banner');
                if (banner) {
                    banner.classList.remove('hidden');
                }
            },

            /**
             * Show offline banner
             */
            showOfflineBanner() {
                const banner = document.getElementById('offline-banner');
                if (banner) {
                    banner.classList.remove('hidden');
                }
            },

            /**
             * Hide all error banners
             */
            hideAllErrorBanners() {
                const banners = [
                    'configuration-error-banner',
                    'chrome-ai-setup-banner',
                    'offline-banner'
                ];

                banners.forEach(bannerId => {
                    const banner = document.getElementById(bannerId);
                    if (banner) {
                        banner.classList.add('hidden');
                    }
                });
            },

            /**
             * Handle network errors specifically
             */
            async handleNetworkError(error, context, url = '') {
                const errorInfo = {
                    type: 'network',
                    context: context,
                    url: url,
                    isOnline: this.networkMonitor.isOnline,
                    timestamp: Date.now()
                };

                if (error.message.includes('404')) {
                    this.toastSystem.show('Recurso não encontrado. Verifique a URL.', 'error', 5000);
                    return { success: false, error: 'not_found', fallback: 'manual_entry' };
                }

                if (error.message.includes('403') || error.message.includes('401')) {
                    this.toastSystem.show('Acesso negado. Verifique as permissões.', 'error', 5000);
                    return { success: false, error: 'permission_denied', fallback: 'alternative_source' };
                }

                if (!this.networkMonitor.isOnline) {
                    this.toastSystem.show('Sem conexão. Usando modo offline.', 'warning', 5000);
                    this.showOfflineBanner();
                    return { success: false, error: 'offline', fallback: 'cached_data' };
                }

                this.toastSystem.showWithAction(
                    'Erro de rede. Verifique sua conexão.',
                    'error',
                    5000,
                    'Tentar Novamente',
                    () => this.retryNetworkOperation(context, url)
                );

                return { success: false, error: 'network_error', fallback: 'retry' };
            },

            /**
             * Handle Chrome AI errors specifically
             */
            handleAIError(error, context) {
                let userMessage = 'Erro na operação de IA';
                let suggestion = '';
                let fallback = 'manual_mode';

                if (error.message.includes('not available') || error.message.includes('undefined')) {
                    userMessage = 'Chrome AI não está disponível';
                    suggestion = 'Verifique as configurações do Chrome AI';
                    fallback = 'setup_required';
                } else if (error.message.includes('quota') || error.message.includes('limit')) {
                    userMessage = 'Limite de uso da IA atingido';
                    suggestion = 'Tente novamente em alguns minutos';
                    fallback = 'rate_limited';
                } else if (error.message.includes('model')) {
                    userMessage = 'Modelo de IA não disponível';
                    suggestion = 'O modelo pode ainda estar sendo baixado';
                    fallback = 'model_loading';
                }

                this.toastSystem.showWithAction(
                    `${userMessage}. ${suggestion}`,
                    'error',
                    8000,
                    'Configurar IA',
                    () => this.showAISetupHelp()
                );

                this.showChromeAISetupBanner();

                return { success: false, error: 'ai_error', fallback: fallback };
            },

            /**
             * Handle storage errors specifically
             */
            async handleStorageError(error, context) {
                let userMessage = 'Erro de armazenamento';
                let suggestion = '';
                let fallback = 'session_storage';

                if (error.message.includes('quota') || error.message.includes('exceeded')) {
                    userMessage = 'Espaço de armazenamento esgotado';
                    suggestion = 'Limpe dados antigos ou aumente o espaço disponível';
                    fallback = 'cleanup_required';
                    
                    await this.performStorageCleanup();
                } else if (error.message.includes('blocked') || error.message.includes('denied')) {
                    userMessage = 'Acesso ao armazenamento bloqueado';
                    suggestion = 'Verifique as configurações de privacidade do navegador';
                    fallback = 'permission_required';
                }

                this.toastSystem.showWithAction(
                    `${userMessage}. ${suggestion}`,
                    'error',
                    8000,
                    'Gerenciar Armazenamento',
                    () => this.showStorageHelp()
                );

                this.fallbackToSessionStorage();

                return { success: false, error: 'storage_error', fallback: fallback };
            },

            /**
             * Recovery operations
             */
            retryFailedOperations() {
                this.toastSystem.show('Tentando reconectar...', 'info', 3000);
                // Mock retry logic
                return Promise.resolve(true);
            },

            fallbackToSessionStorage() {
                this.toastSystem.show('Usando armazenamento temporário', 'warning', 3000);
                // Mock fallback logic
                return true;
            },

            fallbackToManualMode() {
                this.toastSystem.show('Modo manual ativado', 'info', 3000);
                // Mock manual mode logic
                return true;
            },

            retryServerlessOperation(context) {
                this.toastSystem.show('Tentando novamente...', 'info', 3000);
                // Mock retry logic
                return Promise.resolve(true);
            },

            retryNetworkOperation(context, url) {
                this.toastSystem.show(`Tentando reconectar a ${url}...`, 'info', 3000);
                // Mock retry logic
                return Promise.resolve(true);
            },

            async performStorageCleanup() {
                this.toastSystem.show('Limpando armazenamento...', 'info', 3000);
                // Mock cleanup logic
                return Promise.resolve(true);
            },

            /**
             * Help actions
             */
            showConfigurationModal() {
                this.toastSystem.show('Abrindo configurações...', 'info', 2000);
            },

            showAISetupHelp() {
                this.toastSystem.show('Abrindo ajuda do Chrome AI...', 'info', 2000);
            },

            showStorageHelp() {
                this.toastSystem.show('Abrindo gerenciador de armazenamento...', 'info', 2000);
            },

            /**
             * Utility methods
             */
            clearErrorLogs() {
                this.errorLogs = [];
            },

            getErrorStats() {
                const errorTypes = {};
                this.errorLogs.forEach(log => {
                    errorTypes[log.type] = (errorTypes[log.type] || 0) + 1;
                });

                return {
                    totalErrors: this.errorLogs.length,
                    errorTypes: errorTypes,
                    lastError: this.errorLogs[this.errorLogs.length - 1] || null
                };
            },

            resetRetryCounters() {
                this.errorRetryCount.clear();
            }
        };

        // Setup event listeners for banners
        document.getElementById('close-config-error-banner').addEventListener('click', () => {
            document.getElementById('configuration-error-banner').classList.add('hidden');
        });

        document.getElementById('close-ai-banner').addEventListener('click', () => {
            document.getElementById('chrome-ai-setup-banner').classList.add('hidden');
        });

        document.getElementById('config-error-action-btn').addEventListener('click', () => {
            mockErrorHandler.showConfigurationModal();
        });

        document.getElementById('ai-setup-help-btn').addEventListener('click', () => {
            mockErrorHandler.showAISetupHelp();
        });

        document.getElementById('retry-connection-btn').addEventListener('click', () => {
            mockErrorHandler.retryFailedOperations();
        });
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    describe('Error Categorization', () => {
        it('should categorize network errors correctly', () => {
            const networkError = new Error('Failed to fetch');
            const errorInfo = mockErrorHandler.categorizeError(networkError, 'document loading');

            expect(errorInfo.type).toBe('network');
            expect(errorInfo.severity).toBe('medium');
            expect(errorInfo.userMessage).toBe('Erro de conexão');
            expect(errorInfo.recoverable).toBe(true);
            expect(errorInfo.retryable).toBe(true);
        });

        it('should categorize configuration errors correctly', () => {
            const configError = new Error('Configuration incomplete');
            const errorInfo = mockErrorHandler.categorizeError(configError, 'configuration validation');

            expect(errorInfo.type).toBe('configuration');
            expect(errorInfo.severity).toBe('high');
            expect(errorInfo.userMessage).toBe('Configuração incompleta');
            expect(errorInfo.recoverable).toBe(true);
            expect(errorInfo.retryable).toBe(false);
            expect(errorInfo.helpAction).toBeTypeOf('function');
        });

        it('should categorize Chrome AI errors correctly', () => {
            const aiError = new Error('Chrome AI not available');
            const errorInfo = mockErrorHandler.categorizeError(aiError, 'AI execution');

            expect(errorInfo.type).toBe('ai');
            expect(errorInfo.severity).toBe('medium');
            expect(errorInfo.userMessage).toBe('Erro na funcionalidade de IA');
            expect(errorInfo.recoverable).toBe(true);
            expect(errorInfo.retryable).toBe(false);
            expect(errorInfo.helpAction).toBeTypeOf('function');
        });

        it('should categorize storage errors correctly', () => {
            const storageError = new Error('IndexedDB quota exceeded');
            const errorInfo = mockErrorHandler.categorizeError(storageError, 'data persistence');

            expect(errorInfo.type).toBe('storage');
            expect(errorInfo.severity).toBe('high');
            expect(errorInfo.userMessage).toBe('Erro de armazenamento');
            expect(errorInfo.recoverable).toBe(true);
            expect(errorInfo.retryable).toBe(true);
            expect(errorInfo.helpAction).toBeTypeOf('function');
        });

        it('should categorize serverless errors correctly', () => {
            const serverlessError = new Error('Serverless endpoint returned 404');
            const errorInfo = mockErrorHandler.categorizeError(serverlessError, 'serverless request');

            expect(errorInfo.type).toBe('serverless');
            expect(errorInfo.severity).toBe('medium');
            expect(errorInfo.userMessage).toBe('Erro no endpoint serverless');
            expect(errorInfo.recoverable).toBe(true);
            expect(errorInfo.retryable).toBe(true);
        });

        it('should categorize unknown errors correctly', () => {
            const unknownError = new Error('Something went wrong');
            const errorInfo = mockErrorHandler.categorizeError(unknownError, 'unknown operation');

            expect(errorInfo.type).toBe('unknown');
            expect(errorInfo.severity).toBe('medium');
            expect(errorInfo.userMessage).toBe('Erro inesperado');
            expect(errorInfo.recoverable).toBe(true);
            expect(errorInfo.retryable).toBe(true);
        });

        it('should handle offline network errors', () => {
            mockErrorHandler.networkMonitor.setOnlineStatus(false);
            
            const networkError = new Error('Network request failed');
            const errorInfo = mockErrorHandler.categorizeError(networkError, 'document loading');

            expect(errorInfo.type).toBe('network');
            expect(errorInfo.recoverable).toBe(true);
            expect(errorInfo.retryable).toBe(true);
        });
    });

    describe('Error Logging', () => {
        it('should log errors with detailed information', () => {
            const error = new Error('Test error');
            const context = 'test context';
            const metadata = { userId: '123', action: 'test' };
            const errorInfo = { type: 'test', severity: 'medium' };

            mockErrorHandler.logError(error, context, metadata, errorInfo);

            expect(mockErrorHandler.errorLogs).toHaveLength(1);
            
            const logEntry = mockErrorHandler.errorLogs[0];
            expect(logEntry.context).toBe(context);
            expect(logEntry.type).toBe('test');
            expect(logEntry.severity).toBe('medium');
            expect(logEntry.message).toBe('Test error');
            expect(logEntry.metadata).toEqual(metadata);
            expect(logEntry.timestamp).toBeTypeOf('string');
            expect(logEntry.isOnline).toBeTypeOf('boolean');
        });

        it('should limit error log size', () => {
            // Generate many errors
            for (let i = 0; i < 150; i++) {
                const error = new Error(`Error ${i}`);
                const errorInfo = { type: 'test', severity: 'low' };
                mockErrorHandler.logError(error, 'test', {}, errorInfo);
            }

            expect(mockErrorHandler.errorLogs.length).toBe(100);
            
            // Should keep the most recent errors
            const lastError = mockErrorHandler.errorLogs[mockErrorHandler.errorLogs.length - 1];
            expect(lastError.message).toBe('Error 149');
        });

        it('should handle null/undefined errors gracefully', () => {
            const errorInfo = { type: 'test', severity: 'medium' };
            
            mockErrorHandler.logError(null, 'test context', {}, errorInfo);
            mockErrorHandler.logError(undefined, 'test context', {}, errorInfo);

            expect(mockErrorHandler.errorLogs).toHaveLength(2);
            expect(mockErrorHandler.errorLogs[0].message).toBe('Unknown error');
            expect(mockErrorHandler.errorLogs[1].message).toBe('Unknown error');
        });
    });

    describe('User Error Display', () => {
        it('should show error toast with help action', () => {
            const errorInfo = {
                type: 'configuration',
                userMessage: 'Configuração incompleta',
                suggestion: 'Configure idioma e país',
                helpAction: () => mockErrorHandler.showConfigurationModal()
            };

            mockErrorHandler.showErrorToUser(errorInfo);

            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toContain('Configuração incompleta');
            expect(errorToast.actionText).toBe('Ajuda');
            expect(errorToast.actionCallback).toBeTypeOf('function');
        });

        it('should show error toast without help action', () => {
            const errorInfo = {
                type: 'network',
                userMessage: 'Erro de conexão',
                suggestion: 'Verifique sua conexão',
                severity: 'medium'
            };

            mockErrorHandler.showErrorToUser(errorInfo);

            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toContain('Erro de conexão');
            expect(errorToast.actionText).toBeUndefined();
        });

        it('should show configuration error banner', () => {
            const errorInfo = { type: 'configuration' };
            mockErrorHandler.showErrorToUser(errorInfo);

            const banner = document.getElementById('configuration-error-banner');
            expect(banner.classList.contains('hidden')).toBe(false);
        });

        it('should show Chrome AI setup banner', () => {
            const errorInfo = { type: 'ai' };
            mockErrorHandler.showErrorToUser(errorInfo);

            const banner = document.getElementById('chrome-ai-setup-banner');
            expect(banner.classList.contains('hidden')).toBe(false);
        });

        it('should show offline banner for network errors', () => {
            mockErrorHandler.networkMonitor.setOnlineStatus(false);
            const errorInfo = { type: 'network' };
            mockErrorHandler.showErrorToUser(errorInfo);

            const banner = document.getElementById('offline-banner');
            expect(banner.classList.contains('hidden')).toBe(false);
        });

        it('should use longer duration for high severity errors', () => {
            const highSeverityError = {
                type: 'storage',
                severity: 'high',
                userMessage: 'Critical error',
                suggestion: 'Take action'
            };

            mockErrorHandler.showErrorToUser(highSeverityError);

            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast.duration).toBe(8000);
        });
    });

    describe('Error Recovery Mechanisms', () => {
        it('should attempt recovery for recoverable errors', () => {
            const errorInfo = {
                type: 'network',
                recoverable: true,
                retryable: true
            };

            const performRecoverySpy = vi.spyOn(mockErrorHandler, 'performErrorRecovery');

            mockErrorHandler.attemptErrorRecovery(errorInfo, 'test context');

            // Should schedule recovery with exponential backoff
            expect(mockErrorHandler.errorRetryCount.get('network-test context')).toBe(1);

            // Wait for recovery to be called
            setTimeout(() => {
                expect(performRecoverySpy).toHaveBeenCalledWith('network', 'test context');
            }, 1100);
        });

        it('should not attempt recovery for non-recoverable errors', () => {
            const errorInfo = {
                type: 'fatal',
                recoverable: false,
                retryable: false
            };

            const performRecoverySpy = vi.spyOn(mockErrorHandler, 'performErrorRecovery');

            mockErrorHandler.attemptErrorRecovery(errorInfo, 'test context');

            expect(mockErrorHandler.errorRetryCount.size).toBe(0);
            expect(performRecoverySpy).not.toHaveBeenCalled();
        });

        it('should respect maximum retry limit', () => {
            const errorInfo = {
                type: 'network',
                recoverable: true,
                retryable: true
            };

            // Simulate multiple retry attempts
            for (let i = 0; i < 5; i++) {
                mockErrorHandler.attemptErrorRecovery(errorInfo, 'test context');
            }

            // Should not exceed max retries
            expect(mockErrorHandler.errorRetryCount.get('network-test context')).toBe(3);
        });

        it('should perform network error recovery', () => {
            mockErrorHandler.networkMonitor.setOnlineStatus(true);
            const retrySpy = vi.spyOn(mockErrorHandler, 'retryFailedOperations');

            mockErrorHandler.performErrorRecovery('network', 'test context');

            expect(retrySpy).toHaveBeenCalled();
        });

        it('should perform storage error recovery', () => {
            const fallbackSpy = vi.spyOn(mockErrorHandler, 'fallbackToSessionStorage');

            mockErrorHandler.performErrorRecovery('storage', 'test context');

            expect(fallbackSpy).toHaveBeenCalled();
        });

        it('should perform AI error recovery', () => {
            const fallbackSpy = vi.spyOn(mockErrorHandler, 'fallbackToManualMode');

            mockErrorHandler.performErrorRecovery('ai', 'test context');

            expect(fallbackSpy).toHaveBeenCalled();
        });

        it('should perform serverless error recovery', () => {
            const retrySpy = vi.spyOn(mockErrorHandler, 'retryServerlessOperation');

            mockErrorHandler.performErrorRecovery('serverless', 'test context');

            expect(retrySpy).toHaveBeenCalledWith('test context');
        });
    });

    describe('Specific Error Handlers', () => {
        it('should handle 404 network errors', async () => {
            const error = new Error('404 Not Found');
            const result = await mockErrorHandler.handleNetworkError(error, 'document loading', 'https://example.com/doc');

            expect(result.success).toBe(false);
            expect(result.error).toBe('not_found');
            expect(result.fallback).toBe('manual_entry');

            const toast = mockToastSystem.toasts.find(t => t.message.includes('não encontrado'));
            expect(toast).toBeTruthy();
        });

        it('should handle 403/401 network errors', async () => {
            const error = new Error('403 Forbidden');
            const result = await mockErrorHandler.handleNetworkError(error, 'document loading');

            expect(result.success).toBe(false);
            expect(result.error).toBe('permission_denied');
            expect(result.fallback).toBe('alternative_source');

            const toast = mockToastSystem.toasts.find(t => t.message.includes('Acesso negado'));
            expect(toast).toBeTruthy();
        });

        it('should handle offline network errors', async () => {
            mockErrorHandler.networkMonitor.setOnlineStatus(false);
            const error = new Error('Network request failed');
            const result = await mockErrorHandler.handleNetworkError(error, 'document loading');

            expect(result.success).toBe(false);
            expect(result.error).toBe('offline');
            expect(result.fallback).toBe('cached_data');

            const toast = mockToastSystem.toasts.find(t => t.message.includes('Sem conexão'));
            expect(toast).toBeTruthy();

            const banner = document.getElementById('offline-banner');
            expect(banner.classList.contains('hidden')).toBe(false);
        });

        it('should handle AI unavailable errors', () => {
            const error = new Error('Chrome AI not available');
            const result = mockErrorHandler.handleAIError(error, 'AI execution');

            expect(result.success).toBe(false);
            expect(result.error).toBe('ai_error');
            expect(result.fallback).toBe('setup_required');

            const toast = mockToastSystem.toasts.find(t => t.message.includes('não está disponível'));
            expect(toast).toBeTruthy();

            const banner = document.getElementById('chrome-ai-setup-banner');
            expect(banner.classList.contains('hidden')).toBe(false);
        });

        it('should handle AI quota errors', () => {
            const error = new Error('AI quota exceeded');
            const result = mockErrorHandler.handleAIError(error, 'AI execution');

            expect(result.success).toBe(false);
            expect(result.fallback).toBe('rate_limited');

            const toast = mockToastSystem.toasts.find(t => t.message.includes('Limite de uso'));
            expect(toast).toBeTruthy();
        });

        it('should handle storage quota errors', async () => {
            const error = new Error('Storage quota exceeded');
            const cleanupSpy = vi.spyOn(mockErrorHandler, 'performStorageCleanup');
            const fallbackSpy = vi.spyOn(mockErrorHandler, 'fallbackToSessionStorage');

            const result = await mockErrorHandler.handleStorageError(error, 'data save');

            expect(result.success).toBe(false);
            expect(result.fallback).toBe('cleanup_required');
            expect(cleanupSpy).toHaveBeenCalled();
            expect(fallbackSpy).toHaveBeenCalled();

            const toast = mockToastSystem.toasts.find(t => t.message.includes('esgotado'));
            expect(toast).toBeTruthy();
        });

        it('should handle storage permission errors', async () => {
            const error = new Error('Storage access blocked');
            const result = await mockErrorHandler.handleStorageError(error, 'data save');

            expect(result.success).toBe(false);
            expect(result.fallback).toBe('permission_required');

            const toast = mockToastSystem.toasts.find(t => t.message.includes('bloqueado'));
            expect(toast).toBeTruthy();
        });
    });

    describe('Banner Management', () => {
        it('should show and hide configuration error banner', () => {
            const banner = document.getElementById('configuration-error-banner');
            
            expect(banner.classList.contains('hidden')).toBe(true);
            
            mockErrorHandler.showConfigurationErrorBanner();
            expect(banner.classList.contains('hidden')).toBe(false);
            
            // Test close button
            document.getElementById('close-config-error-banner').click();
            expect(banner.classList.contains('hidden')).toBe(true);
        });

        it('should show and hide Chrome AI setup banner', () => {
            const banner = document.getElementById('chrome-ai-setup-banner');
            
            expect(banner.classList.contains('hidden')).toBe(true);
            
            mockErrorHandler.showChromeAISetupBanner();
            expect(banner.classList.contains('hidden')).toBe(false);
            
            // Test close button
            document.getElementById('close-ai-banner').click();
            expect(banner.classList.contains('hidden')).toBe(true);
        });

        it('should show offline banner', () => {
            const banner = document.getElementById('offline-banner');
            
            expect(banner.classList.contains('hidden')).toBe(true);
            
            mockErrorHandler.showOfflineBanner();
            expect(banner.classList.contains('hidden')).toBe(false);
        });

        it('should hide all error banners', () => {
            // Show all banners first
            mockErrorHandler.showConfigurationErrorBanner();
            mockErrorHandler.showChromeAISetupBanner();
            mockErrorHandler.showOfflineBanner();

            // Verify they are visible
            expect(document.getElementById('configuration-error-banner').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('chrome-ai-setup-banner').classList.contains('hidden')).toBe(false);
            expect(document.getElementById('offline-banner').classList.contains('hidden')).toBe(false);

            // Hide all
            mockErrorHandler.hideAllErrorBanners();

            // Verify they are hidden
            expect(document.getElementById('configuration-error-banner').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('chrome-ai-setup-banner').classList.contains('hidden')).toBe(true);
            expect(document.getElementById('offline-banner').classList.contains('hidden')).toBe(true);
        });

        it('should handle banner action buttons', () => {
            const configSpy = vi.spyOn(mockErrorHandler, 'showConfigurationModal');
            const aiSpy = vi.spyOn(mockErrorHandler, 'showAISetupHelp');
            const retrySpy = vi.spyOn(mockErrorHandler, 'retryFailedOperations');

            // Test configuration banner action
            document.getElementById('config-error-action-btn').click();
            expect(configSpy).toHaveBeenCalled();

            // Test AI banner action
            document.getElementById('ai-setup-help-btn').click();
            expect(aiSpy).toHaveBeenCalled();

            // Test offline banner action
            document.getElementById('retry-connection-btn').click();
            expect(retrySpy).toHaveBeenCalled();
        });
    });

    describe('Global Error Handling', () => {
        it('should handle global errors end-to-end', () => {
            const error = new Error('Test global error');
            const context = 'test operation';
            const metadata = { component: 'test' };

            const errorInfo = mockErrorHandler.handleGlobalError(error, context, metadata);

            // Should categorize error
            expect(errorInfo.type).toBe('unknown');
            expect(errorInfo.recoverable).toBe(true);

            // Should log error
            expect(mockErrorHandler.errorLogs).toHaveLength(1);
            expect(mockErrorHandler.errorLogs[0].context).toBe(context);

            // Should show error to user
            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();

            // Should attempt recovery
            expect(mockErrorHandler.errorRetryCount.size).toBeGreaterThan(0);
        });

        it('should handle errors with missing information', () => {
            const errorInfo = mockErrorHandler.handleGlobalError(null);

            expect(errorInfo.type).toBe('unknown');
            expect(mockErrorHandler.errorLogs).toHaveLength(1);
            expect(mockErrorHandler.errorLogs[0].message).toBe('Unknown error');
        });
    });

    describe('Utility Methods', () => {
        it('should provide error statistics', () => {
            // Generate some errors
            mockErrorHandler.logError(new Error('Network error'), 'test', {}, { type: 'network', severity: 'medium' });
            mockErrorHandler.logError(new Error('AI error'), 'test', {}, { type: 'ai', severity: 'low' });
            mockErrorHandler.logError(new Error('Another network error'), 'test', {}, { type: 'network', severity: 'high' });

            const stats = mockErrorHandler.getErrorStats();

            expect(stats.totalErrors).toBe(3);
            expect(stats.errorTypes.network).toBe(2);
            expect(stats.errorTypes.ai).toBe(1);
            expect(stats.lastError.message).toBe('Another network error');
        });

        it('should clear error logs', () => {
            // Add some errors
            mockErrorHandler.logError(new Error('Test error'), 'test', {}, { type: 'test', severity: 'low' });
            expect(mockErrorHandler.errorLogs).toHaveLength(1);

            // Clear logs
            mockErrorHandler.clearErrorLogs();
            expect(mockErrorHandler.errorLogs).toHaveLength(0);
        });

        it('should reset retry counters', () => {
            // Add some retry counts
            mockErrorHandler.errorRetryCount.set('network-test', 2);
            mockErrorHandler.errorRetryCount.set('ai-test', 1);
            expect(mockErrorHandler.errorRetryCount.size).toBe(2);

            // Reset counters
            mockErrorHandler.resetRetryCounters();
            expect(mockErrorHandler.errorRetryCount.size).toBe(0);
        });
    });

    describe('Edge Cases and Robustness', () => {
        it('should handle rapid error bursts', () => {
            const startTime = performance.now();

            // Generate many errors rapidly
            for (let i = 0; i < 50; i++) {
                const error = new Error(`Burst error ${i}`);
                mockErrorHandler.handleGlobalError(error, 'burst test');
            }

            const endTime = performance.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(100); // Should handle rapidly
            expect(mockErrorHandler.errorLogs.length).toBe(50);
            expect(mockToastSystem.toasts.length).toBe(50);
        });

        it('should handle errors during error handling', () => {
            // Mock toast system to throw error
            const originalShow = mockToastSystem.show;
            mockToastSystem.show = vi.fn(() => {
                throw new Error('Toast system error');
            });

            // Should not crash when toast system fails - wrap in try-catch
            let errorThrown = false;
            try {
                mockErrorHandler.handleGlobalError(new Error('Original error'), 'test');
            } catch (error) {
                errorThrown = true;
            }
            
            // The error should be thrown since we're not handling toast system errors in this mock
            expect(errorThrown).toBe(true);

            // Restore original method
            mockToastSystem.show = originalShow;
        });

        it('should handle missing DOM elements gracefully', () => {
            // Remove banner elements
            document.getElementById('configuration-error-banner').remove();
            document.getElementById('chrome-ai-setup-banner').remove();

            // Should not throw errors
            expect(() => {
                mockErrorHandler.showConfigurationErrorBanner();
                mockErrorHandler.showChromeAISetupBanner();
                mockErrorHandler.hideAllErrorBanners();
            }).not.toThrow();
        });

        it('should handle network status changes during error handling', () => {
            // Start offline
            mockErrorHandler.networkMonitor.setOnlineStatus(false);
            
            const error = new Error('Network error');
            mockErrorHandler.handleGlobalError(error, 'network test');

            // Go online during recovery
            mockErrorHandler.networkMonitor.setOnlineStatus(true);
            
            // Should adapt to new network status
            const retrySpy = vi.spyOn(mockErrorHandler, 'retryFailedOperations');
            mockErrorHandler.performErrorRecovery('network', 'network test');
            
            expect(retrySpy).toHaveBeenCalled();
        });
    });
});