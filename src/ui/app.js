/**
 * LexFlow SPA Application Controller
 * Manages hash-based routing, view switching, and core functionality
 */

// Import database functions
import { setSetting, getSetting, saveHistory, listHistory, addSubmission, listSubmissions, updateSubmission } from '../db.js';
// Import toast system
import ToastSystem from './toast.js';

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

        // Error handling state
        this.isOnline = navigator.onLine;
        this.errorRetryCount = new Map();
        this.maxRetries = 3;

        // Initialize error handling
        this.initErrorHandling();

        // Initialize performance monitoring
        this.initPerformanceMonitoring();

        // Initialize asynchronously
        this.init().catch(error => this.handleGlobalError(error, 'Application initialization'));
    }

    /**
     * Initialize performance monitoring
     */
    initPerformanceMonitoring() {
        // Monitor memory usage periodically
        if ('memory' in performance) {
            this.performanceMonitorInterval = setInterval(() => {
                this.checkMemoryUsage();
            }, 30000); // Check every 30 seconds
        }

        // Clear expired cache on startup
        this.clearExpiredCache();

        // Monitor long tasks
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.duration > 50) { // Tasks longer than 50ms
                            console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
                        }
                    }
                });
                observer.observe({ entryTypes: ['longtask'] });
            } catch (error) {
                console.warn('Performance observer not supported:', error);
            }
        }
    }

    /**
     * Check memory usage and warn if high
     */
    checkMemoryUsage() {
        if (!('memory' in performance)) return;

        const memory = performance.memory;
        const usedMB = (memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
        const limitMB = (memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2);
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100).toFixed(1);

        console.log(`Memory usage: ${usedMB}MB / ${limitMB}MB (${usagePercent}%)`);

        // Warn if memory usage is high
        if (usagePercent > 80) {
            console.warn('High memory usage detected, performing cleanup');
            this.performMemoryCleanup();

            this.showToast(
                `Uso de memória alto (${usagePercent}%). Limpeza automática realizada.`,
                'warning',
                5000
            );
        }
    }

    /**
     * Perform memory cleanup
     */
    performMemoryCleanup() {
        // Clear large data structures
        if (this.allArticles && this.allArticles.length > 0) {
            console.log(`Clearing ${this.allArticles.length} cached articles`);
            this.allArticles = [];
        }

        // Clear cached DOM references
        this.cachedElements = {};

        // Clear old toast notifications
        if (this.toastSystem && this.toastSystem.getCount() > 3) {
            this.toastSystem.clear();
        }

        // Clear expired cache entries
        this.clearExpiredCache();

        // Force garbage collection if available (Chrome DevTools)
        if (window.gc && typeof window.gc === 'function') {
            window.gc();
        }
    }

    /**
     * Initialize comprehensive error handling system
     */
    initErrorHandling() {
        // Global error handlers
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error, 'JavaScript error', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason, 'Unhandled promise rejection');
            event.preventDefault(); // Prevent console error
        });

        // Network status monitoring
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.showToast('Conexão restaurada', 'success', 3000);
            this.retryFailedOperations();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.showToast('Sem conexão com a internet. Modo offline ativado.', 'warning', 5000);
        });

        // Storage quota monitoring
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            this.monitorStorageQuota();
        }
    }

    /**
     * Handle global application errors
     * @param {Error} error - The error object
     * @param {string} context - Context where error occurred
     * @param {Object} metadata - Additional error metadata
     */
    handleGlobalError(error, context = 'Unknown', metadata = {}) {
        console.error(`Global error in ${context}:`, error, metadata);

        // Determine error type and severity
        const errorInfo = this.categorizeError(error, context);

        // Log error for debugging
        this.logError(error, context, metadata, errorInfo);

        // Show user-friendly message
        this.showErrorToUser(errorInfo);

        // Attempt recovery if possible
        this.attemptErrorRecovery(errorInfo, context);
    }

    /**
     * Categorize error type and determine appropriate response
     * @param {Error} error - The error object
     * @param {string} context - Context where error occurred
     * @returns {Object} - Error information object
     */
    categorizeError(error, context) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';

        // Network errors
        if (errorMessage.includes('fetch') || errorMessage.includes('network') ||
            errorMessage.includes('Failed to fetch') || !this.isOnline) {
            return {
                type: 'network',
                severity: 'medium',
                userMessage: 'Erro de conexão',
                suggestion: 'Verifique sua conexão com a internet e tente novamente',
                recoverable: true,
                retryable: true
            };
        }

        // AI/Chrome AI errors
        if (errorMessage.includes('ai') || errorMessage.includes('assistant') ||
            errorMessage.includes('summarizer') || context.includes('AI')) {
            return {
                type: 'ai',
                severity: 'medium',
                userMessage: 'Erro na funcionalidade de IA',
                suggestion: 'Verifique se o Chrome AI está habilitado nas configurações',
                recoverable: true,
                retryable: false,
                helpAction: () => this.showAISetupHelp()
            };
        }

        // Storage errors
        if (errorMessage.includes('storage') || errorMessage.includes('quota') ||
            errorMessage.includes('IndexedDB') || errorMessage.includes('localStorage')) {
            return {
                type: 'storage',
                severity: 'high',
                userMessage: 'Erro de armazenamento',
                suggestion: 'Espaço de armazenamento pode estar cheio. Limpe dados antigos.',
                recoverable: true,
                retryable: true,
                helpAction: () => this.showStorageHelp()
            };
        }

        // Parsing/Markdown errors
        if (errorMessage.includes('parse') || errorMessage.includes('markdown') ||
            errorMessage.includes('JSON') || context.includes('markdown')) {
            return {
                type: 'parsing',
                severity: 'medium',
                userMessage: 'Erro ao processar documento',
                suggestion: 'O formato do documento pode estar incorreto',
                recoverable: false,
                retryable: false
            };
        }

        // Permission errors
        if (errorMessage.includes('permission') || errorMessage.includes('denied') ||
            errorMessage.includes('unauthorized')) {
            return {
                type: 'permission',
                severity: 'high',
                userMessage: 'Erro de permissão',
                suggestion: 'Verifique as permissões da extensão',
                recoverable: false,
                retryable: false
            };
        }

        // Serverless endpoint errors
        if (errorMessage.includes('serverless') || errorMessage.includes('endpoint') ||
            context.includes('Serverless') || context.includes('serverless') ||
            errorMessage.includes('Configure o endpoint') || errorMessage.includes('URL do endpoint') ||
            errorMessage.includes('Endpoint não encontrado') || errorMessage.includes('Timeout na requisição')) {

            // Determine specific serverless error type
            if (errorMessage.includes('Configure o endpoint') || errorMessage.includes('não configurado')) {
                return {
                    type: 'serverless_config',
                    severity: 'high',
                    userMessage: 'Endpoint serverless não configurado',
                    suggestion: 'Configure o endpoint serverless nas configurações',
                    recoverable: true,
                    retryable: false,
                    helpAction: () => this.navigate('settings')
                };
            }

            if (errorMessage.includes('URL do endpoint') || errorMessage.includes('https://')) {
                return {
                    type: 'serverless_validation',
                    severity: 'medium',
                    userMessage: 'URL do endpoint inválida',
                    suggestion: 'Verifique se a URL começa com https://',
                    recoverable: true,
                    retryable: false,
                    helpAction: () => this.navigate('settings')
                };
            }

            if (errorMessage.includes('404') || errorMessage.includes('não encontrado')) {
                return {
                    type: 'serverless_not_found',
                    severity: 'medium',
                    userMessage: 'Endpoint não encontrado',
                    suggestion: 'Verifique se a URL do endpoint está correta',
                    recoverable: true,
                    retryable: true
                };
            }

            if (errorMessage.includes('403') || errorMessage.includes('401') || errorMessage.includes('Acesso negado')) {
                return {
                    type: 'serverless_auth',
                    severity: 'high',
                    userMessage: 'Acesso negado ao endpoint',
                    suggestion: 'Verifique a configuração de autenticação do endpoint',
                    recoverable: true,
                    retryable: false
                };
            }

            if (errorMessage.includes('500') || errorMessage.includes('servidor')) {
                return {
                    type: 'serverless_server',
                    severity: 'medium',
                    userMessage: 'Erro interno do servidor',
                    suggestion: 'Problema temporário no servidor. Tente novamente em alguns minutos.',
                    recoverable: true,
                    retryable: true
                };
            }

            if (errorMessage.includes('Timeout') || errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
                return {
                    type: 'serverless_timeout',
                    severity: 'medium',
                    userMessage: 'Timeout na requisição',
                    suggestion: 'O servidor demorou para responder. Tente novamente.',
                    recoverable: true,
                    retryable: true
                };
            }

            if (errorMessage.includes('Resposta inválida') || errorMessage.includes('JSON')) {
                return {
                    type: 'serverless_response',
                    severity: 'medium',
                    userMessage: 'Resposta inválida do servidor',
                    suggestion: 'O servidor retornou dados em formato incorreto',
                    recoverable: true,
                    retryable: true
                };
            }

            // Generic serverless error
            return {
                type: 'serverless_generic',
                severity: 'medium',
                userMessage: 'Erro no endpoint serverless',
                suggestion: 'Verifique a configuração do endpoint e tente novamente',
                recoverable: true,
                retryable: true
            };
        }

        // Generic/Unknown errors
        return {
            type: 'unknown',
            severity: 'medium',
            userMessage: 'Erro inesperado',
            suggestion: 'Tente recarregar a extensão',
            recoverable: true,
            retryable: true
        };
    }

    /**
     * Log error with detailed information
     * @param {Error} error - The error object
     * @param {string} context - Context where error occurred
     * @param {Object} metadata - Additional metadata
     * @param {Object} errorInfo - Categorized error information
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
            userAgent: navigator.userAgent,
            url: window.location.href,
            isOnline: this.isOnline,
            currentView: this.currentView
        };

        // Store error log locally for debugging
        try {
            const errorLogs = JSON.parse(localStorage.getItem('lexflow-error-logs') || '[]');
            errorLogs.push(errorLog);

            // Keep only last 50 errors
            if (errorLogs.length > 50) {
                errorLogs.splice(0, errorLogs.length - 50);
            }

            localStorage.setItem('lexflow-error-logs', JSON.stringify(errorLogs));
        } catch (storageError) {
            console.warn('Could not store error log:', storageError);
        }

        console.error('Detailed error log:', errorLog);
    }

    /**
     * Show user-friendly error message
     * @param {Object} errorInfo - Categorized error information
     */
    showErrorToUser(errorInfo) {
        const message = `${errorInfo.userMessage}. ${errorInfo.suggestion}`;
        const duration = errorInfo.severity === 'high' ? 8000 : 5000;

        // Create enhanced toast with help action if available
        if (errorInfo.helpAction) {
            this.showToastWithAction(
                message,
                'error',
                duration,
                'Ajuda',
                errorInfo.helpAction
            );
        } else {
            this.showToast(message, 'error', duration);
        }
    }

    /**
     * Attempt error recovery based on error type
     * @param {Object} errorInfo - Categorized error information
     * @param {string} context - Context where error occurred
     */
    attemptErrorRecovery(errorInfo, context) {
        if (!errorInfo.recoverable) return;

        const retryKey = `${errorInfo.type}-${context}`;
        const currentRetries = this.errorRetryCount.get(retryKey) || 0;

        if (errorInfo.retryable && currentRetries < this.maxRetries) {
            // Increment retry count
            this.errorRetryCount.set(retryKey, currentRetries + 1);

            // Attempt recovery based on error type
            setTimeout(() => {
                this.performErrorRecovery(errorInfo.type, context);
            }, Math.pow(2, currentRetries) * 1000); // Exponential backoff
        }
    }

    /**
     * Perform specific recovery actions based on error type
     * @param {string} errorType - Type of error
     * @param {string} context - Context where error occurred
     */
    performErrorRecovery(errorType, context) {
        switch (errorType) {
            case 'network':
                if (this.isOnline) {
                    this.retryFailedOperations();
                }
                break;

            case 'storage':
                this.fallbackToSessionStorage();
                break;

            case 'ai':
                this.fallbackToManualMode();
                break;

            case 'serverless_config':
            case 'serverless_validation':
                // No automatic recovery - user needs to fix configuration
                console.log('Serverless configuration error - manual intervention required');
                break;

            case 'serverless_not_found':
            case 'serverless_server':
            case 'serverless_timeout':
            case 'serverless_response':
            case 'serverless_generic':
                // These are retryable serverless errors with exponential backoff
                if (this.isOnline) {
                    // Use setTimeout to implement exponential backoff in error recovery
                    const retryKey = `serverless-${context}`;
                    const currentRetries = this.errorRetryCount.get(retryKey) || 0;

                    if (currentRetries < this.maxRetries) {
                        const delay = Math.pow(2, currentRetries) * 1000;
                        setTimeout(() => {
                            this.retryServerlessOperation(context);
                        }, delay);
                    }
                }
                break;

            case 'serverless_auth':
                // Authentication errors are not automatically retryable
                console.log('Serverless authentication error - check endpoint configuration');
                break;

            default:
                console.log(`No specific recovery for error type: ${errorType}`);
        }
    }

    /**
     * Enhanced network error handling
     * @param {Error} error - Network error
     * @param {string} context - Context of the network operation
     * @param {string} url - URL that failed
     * @returns {Object} - Error response with fallback options
     */
    async handleNetworkError(error, context = 'Network operation', url = '') {
        console.error(`Network error in ${context}:`, error);

        const errorInfo = {
            type: 'network',
            context: context,
            url: url,
            isOnline: this.isOnline,
            timestamp: Date.now()
        };

        // Determine specific network error type
        if (error.message.includes('404')) {
            this.showToast('Recurso não encontrado. Verifique a URL.', 'error', 5000);
            return { success: false, error: 'not_found', fallback: 'manual_entry' };
        }

        if (error.message.includes('403') || error.message.includes('401')) {
            this.showToast('Acesso negado. Verifique as permissões.', 'error', 5000);
            return { success: false, error: 'permission_denied', fallback: 'alternative_source' };
        }

        if (!this.isOnline) {
            this.showToast('Sem conexão. Usando modo offline.', 'warning', 5000);
            return { success: false, error: 'offline', fallback: 'cached_data' };
        }

        // Generic network error
        this.showToastWithAction(
            'Erro de rede. Verifique sua conexão.',
            'error',
            5000,
            'Tentar Novamente',
            () => this.retryNetworkOperation(context, url)
        );

        return { success: false, error: 'network_error', fallback: 'retry' };
    }

    /**
     * Enhanced AI error handling
     * @param {Error} error - AI operation error
     * @param {string} context - Context of the AI operation
     * @returns {Object} - Error response with fallback options
     */
    handleAIError(error, context = 'AI operation') {
        console.error(`AI error in ${context}:`, error);

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

        this.showToastWithAction(
            `${userMessage}. ${suggestion}`,
            'error',
            8000,
            'Configurar IA',
            () => this.showAISetupHelp()
        );

        return { success: false, error: 'ai_error', fallback: fallback };
    }

    /**
     * Enhanced storage error handling
     * @param {Error} error - Storage operation error
     * @param {string} context - Context of the storage operation
     * @returns {Object} - Error response with fallback options
     */
    async handleStorageError(error, context = 'Storage operation') {
        console.error(`Storage error in ${context}:`, error);

        let userMessage = 'Erro de armazenamento';
        let suggestion = '';
        let fallback = 'session_storage';

        if (error.message.includes('quota') || error.message.includes('exceeded')) {
            userMessage = 'Espaço de armazenamento esgotado';
            suggestion = 'Limpe dados antigos ou aumente o espaço disponível';
            fallback = 'cleanup_required';

            // Attempt automatic cleanup
            await this.performStorageCleanup();
        } else if (error.message.includes('blocked') || error.message.includes('denied')) {
            userMessage = 'Acesso ao armazenamento bloqueado';
            suggestion = 'Verifique as configurações de privacidade do navegador';
            fallback = 'permission_required';
        }

        this.showToastWithAction(
            `${userMessage}. ${suggestion}`,
            'error',
            8000,
            'Gerenciar Armazenamento',
            () => this.showStorageHelp()
        );

        // Fallback to session storage
        this.fallbackToSessionStorage();

        return { success: false, error: 'storage_error', fallback: fallback };
    }

    /**
     * Enhanced serverless endpoint error handling
     * @param {Error} error - Serverless endpoint error
     * @param {string} context - Context of the serverless operation
     * @returns {Object} - Error response with fallback options
     */
    async handleServerlessError(error, context = 'Serverless operation') {
        console.error(`Serverless error in ${context}:`, error);

        const errorInfo = this.categorizeError(error, context);
        let fallback = 'manual_retry';

        // Determine specific serverless error handling
        switch (errorInfo.type) {
            case 'serverless_config':
                this.showToastWithAction(
                    errorInfo.userMessage + '. ' + errorInfo.suggestion,
                    'error',
                    8000,
                    'Configurar',
                    () => this.navigate('settings')
                );
                fallback = 'configuration_required';
                break;

            case 'serverless_validation':
                this.showToastWithAction(
                    errorInfo.userMessage + '. ' + errorInfo.suggestion,
                    'error',
                    6000,
                    'Configurar',
                    () => this.navigate('settings')
                );
                fallback = 'validation_required';
                break;

            case 'serverless_not_found':
            case 'serverless_server':
            case 'serverless_timeout':
            case 'serverless_response':
                // Check if we should show manual retry or automatic retry
                const retryKey = `serverless-${context}`;
                const currentRetries = this.errorRetryCount.get(retryKey) || 0;

                if (currentRetries < this.maxRetries) {
                    // Show toast with both automatic retry info and manual retry option
                    this.showToastWithAction(
                        errorInfo.userMessage + '. Tentativa automática em andamento.',
                        'error',
                        6000,
                        'Tentar Agora',
                        () => {
                            // Reset retry count for immediate manual retry
                            this.errorRetryCount.delete(retryKey);
                            this.retryServerlessOperation(context);
                        }
                    );
                } else {
                    // Max retries reached, only show manual retry
                    this.showToastWithAction(
                        errorInfo.userMessage + '. ' + errorInfo.suggestion,
                        'error',
                        8000,
                        'Tentar Novamente',
                        () => {
                            // Reset retry count for manual retry
                            this.errorRetryCount.delete(retryKey);
                            this.retryServerlessOperation(context);
                        }
                    );
                }
                fallback = 'retryable';
                break;

            case 'serverless_auth':
                this.showToast(
                    errorInfo.userMessage + '. ' + errorInfo.suggestion,
                    'error',
                    8000
                );
                fallback = 'authentication_required';
                break;

            default:
                this.showToastWithAction(
                    errorInfo.userMessage + '. ' + errorInfo.suggestion,
                    'error',
                    6000,
                    'Tentar Novamente',
                    () => {
                        // Reset retry count for manual retry
                        const retryKey = `serverless-${context}`;
                        this.errorRetryCount.delete(retryKey);
                        this.retryServerlessOperation(context);
                    }
                );
                fallback = 'generic_retry';
        }

        return { success: false, error: errorInfo.type, fallback: fallback };
    }

    /**
     * Retry failed network operations
     */
    async retryFailedOperations() {
        if (!this.isOnline) return;

        // Clear retry counts for network operations
        for (const [key, count] of this.errorRetryCount.entries()) {
            if (key.includes('network')) {
                this.errorRetryCount.delete(key);
            }
        }

        // Retry loading documents if in workspace
        if (this.currentView === 'workspace' && this.currentStep === 1) {
            try {
                await this.loadAvailableDocuments();
            } catch (error) {
                console.warn('Retry failed for document loading:', error);
            }
        }
    }

    /**
     * Fallback to session storage when IndexedDB fails
     */
    fallbackToSessionStorage() {
        console.warn('Falling back to session storage');

        // Override storage methods to use sessionStorage
        this.useSessionStorageFallback = true;

        this.showToast('Usando armazenamento temporário devido a limitações', 'warning', 5000);
    }

    /**
     * Fallback to manual mode when AI fails
     */
    fallbackToManualMode() {
        console.warn('Falling back to manual mode');

        this.chromeAIAvailable = false;
        this.updateIntegrationStatus();

        this.showToast('Modo manual ativado. IA indisponível.', 'warning', 5000);
    }

    /**
     * Monitor storage quota and warn user
     */
    async monitorStorageQuota() {
        try {
            const estimate = await navigator.storage.estimate();
            const usedMB = (estimate.usage / 1024 / 1024).toFixed(2);
            const quotaMB = (estimate.quota / 1024 / 1024).toFixed(2);
            const usagePercent = (estimate.usage / estimate.quota * 100).toFixed(1);

            console.log(`Storage usage: ${usedMB}MB / ${quotaMB}MB (${usagePercent}%)`);

            // Warn if usage is high
            if (usagePercent > 80) {
                this.showToastWithAction(
                    `Armazenamento quase cheio (${usagePercent}% usado)`,
                    'warning',
                    8000,
                    'Limpar Dados',
                    () => this.showStorageHelp()
                );
            }
        } catch (error) {
            console.warn('Could not check storage quota:', error);
        }
    }

    /**
     * Perform automatic storage cleanup
     */
    async performStorageCleanup() {
        try {
            // Clean old error logs
            const errorLogs = JSON.parse(localStorage.getItem('lexflow-error-logs') || '[]');
            if (errorLogs.length > 10) {
                const recentLogs = errorLogs.slice(-10);
                localStorage.setItem('lexflow-error-logs', JSON.stringify(recentLogs));
            }

            // Clean old cached data (if any)
            const cacheKeys = Object.keys(localStorage).filter(key =>
                key.startsWith('lexflow-cache-') &&
                Date.now() - parseInt(key.split('-').pop()) > 24 * 60 * 60 * 1000 // 24 hours
            );

            cacheKeys.forEach(key => localStorage.removeItem(key));

            if (cacheKeys.length > 0) {
                this.showToast(`${cacheKeys.length} itens antigos removidos`, 'success', 3000);
            }
        } catch (error) {
            console.warn('Storage cleanup failed:', error);
        }
    }

    /**
     * Show storage management help
     */
    showStorageHelp() {
        const helpContent = `
            <h3>Gerenciamento de Armazenamento</h3>
            <p>O LexFlow usa armazenamento local para salvar suas configurações e dados.</p>
            
            <h4>Ações Disponíveis:</h4>
            <div class="storage-actions">
                <button onclick="app.clearErrorLogs()" class="secondary">
                    Limpar Logs de Erro
                </button>
                <button onclick="app.clearCachedData()" class="secondary">
                    Limpar Cache
                </button>
                <button onclick="app.exportSettings()" class="secondary">
                    Exportar Configurações
                </button>
            </div>
            
            <h4>Uso Atual:</h4>
            <div id="storage-usage">Calculando...</div>
            
            <div class="text-center mt-2">
                <button onclick="app.hideModal('storage-help')" class="primary">
                    Fechar
                </button>
            </div>
        `;

        // Create modal if it doesn't exist
        if (!document.getElementById('storage-help-modal')) {
            const modalHtml = `
                <div id="storage-help-modal" class="modal-overlay">
                    <div class="modal">
                        <div class="modal-header">
                            <h3>Gerenciamento de Armazenamento</h3>
                            <button class="modal-close" onclick="app.hideModal('storage-help')">&times;</button>
                        </div>
                        <div id="storage-help-content"></div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        // Update content and show modal
        document.getElementById('storage-help-content').innerHTML = helpContent;
        this.showModal('storage-help');

        // Update storage usage info
        this.updateStorageUsageDisplay();
    }

    /**
     * Update storage usage display in help modal
     */
    async updateStorageUsageDisplay() {
        const usageDiv = document.getElementById('storage-usage');
        if (!usageDiv) return;

        try {
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                const usedMB = (estimate.usage / 1024 / 1024).toFixed(2);
                const quotaMB = (estimate.quota / 1024 / 1024).toFixed(2);
                const usagePercent = (estimate.usage / estimate.quota * 100).toFixed(1);

                usageDiv.innerHTML = `
                    <div class="usage-bar">
                        <div class="usage-fill" style="width: ${usagePercent}%"></div>
                    </div>
                    <p>${usedMB}MB usado de ${quotaMB}MB disponível (${usagePercent}%)</p>
                `;
            } else {
                usageDiv.innerHTML = '<p>Informações de uso não disponíveis neste navegador</p>';
            }
        } catch (error) {
            usageDiv.innerHTML = '<p>Erro ao calcular uso de armazenamento</p>';
        }
    }

    /**
     * Clear error logs
     */
    clearErrorLogs() {
        try {
            localStorage.removeItem('lexflow-error-logs');
            this.showToast('Logs de erro limpos', 'success', 3000);
        } catch (error) {
            this.showToast('Erro ao limpar logs', 'error', 3000);
        }
    }

    /**
     * Clear cached data
     */
    clearCachedData() {
        try {
            const cacheKeys = Object.keys(localStorage).filter(key =>
                key.startsWith('lexflow-cache-')
            );

            cacheKeys.forEach(key => localStorage.removeItem(key));

            this.showToast(`${cacheKeys.length} itens de cache removidos`, 'success', 3000);
        } catch (error) {
            this.showToast('Erro ao limpar cache', 'error', 3000);
        }
    }

    /**
     * Retry specific network operation
     * @param {string} context - Context of the operation
     * @param {string} url - URL to retry
     */
    async retryNetworkOperation(context, url) {
        if (!this.isOnline) {
            this.showToast('Ainda sem conexão', 'warning', 3000);
            return;
        }

        this.showToast('Tentando novamente...', 'info', 2000);

        // Reset retry count for this operation
        const retryKey = `network-${context}`;
        this.errorRetryCount.delete(retryKey);

        // Retry based on context
        try {
            if (context.includes('document')) {
                await this.loadAvailableDocuments();
            } else if (context.includes('article')) {
                await this.loadDocumentArticles();
            }
        } catch (error) {
            this.handleNetworkError(error, context, url);
        }
    }

    /**
     * Retry serverless endpoint operation with exponential backoff
     * @param {string} context - Context of the serverless operation
     * @param {number} retryAttempt - Current retry attempt (for exponential backoff)
     */
    async retryServerlessOperation(context, retryAttempt = 0) {
        if (!this.isOnline) {
            this.showToast('Ainda sem conexão', 'warning', 3000);
            return;
        }

        const retryKey = `serverless-${context}`;
        const currentRetries = this.errorRetryCount.get(retryKey) || 0;

        // Check if we've exceeded max retries
        if (currentRetries >= this.maxRetries) {
            this.showToast('Máximo de tentativas atingido. Verifique a configuração.', 'error', 5000);
            this.errorRetryCount.delete(retryKey);
            return;
        }

        // Increment retry count
        this.errorRetryCount.set(retryKey, currentRetries + 1);

        // Calculate delay with exponential backoff (1s, 2s, 4s, 8s...)
        const delay = Math.pow(2, currentRetries) * 1000;
        const delaySeconds = delay / 1000;

        this.showToast(`Tentando novamente em ${delaySeconds}s... (${currentRetries + 1}/${this.maxRetries})`, 'info', delay);

        // Wait for the calculated delay
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry based on context
        try {
            if (context.includes('submission') || context.includes('Serverless')) {
                // Trigger retry of serverless submission if the form is available
                const submitButton = document.getElementById('btnOpenIssue');
                if (submitButton && typeof window.submitToServerlessEndpoint === 'function') {
                    await window.submitToServerlessEndpoint();
                    // If successful, reset retry count
                    this.errorRetryCount.delete(retryKey);
                } else {
                    this.showToast('Recarregue a página para tentar novamente', 'info', 3000);
                }
            }
        } catch (error) {
            // If retry fails, the error will be handled by the error system
            // which may trigger another retry if appropriate
            await this.handleServerlessError(error, context);
        }
    }

    /**
     * Initialize the application
     */
    async init() {
        try {
            this.initRouter();
            this.initEventListeners();
            this.initToastSystem();

            // Load settings on startup
            await this.loadSettings();

            // Load configuration defaults if needed
            await this.loadConfigurationDefaults();

            this.loadInitialView();

            console.log('LexFlow SPA initialized');
        } catch (error) {
            this.handleGlobalError(error, 'Application initialization');
        }
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
        // Performance optimization: avoid unnecessary view switches
        if (this.currentView === viewName) return;

        // Add loading state with performance timing
        const startTime = performance.now();
        document.body.classList.add('loading');

        // Cleanup previous view to free memory
        this.cleanupCurrentView();

        // Hide all views with optimized selector
        const views = document.querySelectorAll('.view.active');
        views.forEach(view => {
            view.classList.remove('active');
        });

        // Use requestAnimationFrame for smooth transitions
        requestAnimationFrame(() => {
            const targetView = document.getElementById(`${viewName}-view`);
            if (targetView) {
                targetView.classList.add('active');
                this.currentView = viewName;

                // Initialize view-specific functionality asynchronously
                this.initViewFunctionality(viewName).then(() => {
                    // Remove loading state
                    document.body.classList.remove('loading');

                    // Performance logging
                    const loadTime = performance.now() - startTime;
                    console.log(`View ${viewName} loaded in ${loadTime.toFixed(2)}ms`);

                    // Show performance warning if slow
                    if (loadTime > 500) {
                        console.warn(`Slow view load detected: ${viewName} took ${loadTime.toFixed(2)}ms`);
                    }
                }).catch(error => {
                    document.body.classList.remove('loading');
                    this.handleGlobalError(error, `View initialization: ${viewName}`);
                });
            } else {
                document.body.classList.remove('loading');
                this.handleGlobalError(new Error(`View not found: ${viewName}`), 'View switching');
            }
        });
    }

    /**
     * Cleanup current view to free memory and remove event listeners
     */
    cleanupCurrentView() {
        // Clear any running timeouts
        if (this.searchTimeout) clearTimeout(this.searchTimeout);
        if (this.autoSaveTimeout) clearTimeout(this.autoSaveTimeout);
        if (this.corpusValidationTimeout) clearTimeout(this.corpusValidationTimeout);

        // Clear any intervals
        if (this.performanceMonitorInterval) {
            clearInterval(this.performanceMonitorInterval);
            this.performanceMonitorInterval = null;
        }

        // Remove dynamic event listeners to prevent memory leaks
        this.removeDynamicEventListeners();

        // Clear large data structures
        if (this.allArticles && this.allArticles.length > 100) {
            this.allArticles = [];
        }

        // Clear cached DOM references
        this.cachedElements = {};
    }

    /**
     * Remove dynamic event listeners to prevent memory leaks
     */
    removeDynamicEventListeners() {
        // Remove article checkbox listeners
        document.querySelectorAll('.article-checkbox').forEach(checkbox => {
            checkbox.replaceWith(checkbox.cloneNode(true));
        });

        // Remove dynamic button listeners
        document.querySelectorAll('[onclick*="app."]').forEach(element => {
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
        });
    }

    /**
     * Update navigation state with enhanced features
     * @param {string} activeRoute - The currently active route
     */
    updateNavigationState(activeRoute) {
        // Update navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
            tab.removeAttribute('aria-current');
            if (tab.dataset.view === activeRoute) {
                tab.classList.add('active');
                tab.setAttribute('aria-current', 'page');
            }
        });

        // Update breadcrumb navigation
        this.updateBreadcrumb(activeRoute);

        // Update navigation badges
        this.updateNavigationBadges();

        // Announce view change to screen readers
        this.announceViewChange(activeRoute);

        // Focus management
        this.manageFocus(activeRoute);
    }

    /**
     * Update breadcrumb navigation
     * @param {string} activeView - The currently active view
     */
    updateBreadcrumb(activeView) {
        const breadcrumbNav = document.getElementById('breadcrumb-nav');
        const currentSection = document.getElementById('current-section');

        if (!breadcrumbNav || !currentSection) return;

        const viewNames = {
            'home': 'Início',
            'workspace': 'Workspace Jurídico',
            'collector': 'Coletor & Curadoria',
            'settings': 'Configurações'
        };

        if (activeView === 'home') {
            breadcrumbNav.classList.add('hidden');
        } else {
            breadcrumbNav.classList.remove('hidden');
            currentSection.textContent = viewNames[activeView] || activeView;

            // Add step information for workspace
            if (activeView === 'workspace' && this.currentStep) {
                const stepNames = {
                    1: 'Leis & Artigos',
                    2: 'Prompt Studio'
                };
                currentSection.textContent += ` › ${stepNames[this.currentStep]}`;
            }
        }
    }

    /**
     * Update navigation badges with current status
     */
    updateNavigationBadges() {
        // Workspace badge - show current step
        const workspaceBadge = document.getElementById('workspace-badge');
        if (workspaceBadge) {
            if (this.currentView === 'workspace' && this.currentStep) {
                workspaceBadge.textContent = this.currentStep;
                workspaceBadge.classList.remove('hidden');
                workspaceBadge.className = 'nav-badge';

                // Add success class if step is completed
                if (this.workspaceStepCompleted && this.workspaceStepCompleted[this.currentStep]) {
                    workspaceBadge.classList.add('success');
                }
            } else {
                workspaceBadge.classList.add('hidden');
            }
        }

        // Collector badge - show queue count
        const collectorBadge = document.getElementById('collector-badge');
        if (collectorBadge) {
            const queueCount = this.getCaptureQueueCount();
            if (queueCount > 0) {
                collectorBadge.textContent = queueCount;
                collectorBadge.classList.remove('hidden');
                collectorBadge.className = 'nav-badge';

                if (queueCount > 5) {
                    collectorBadge.classList.add('warning');
                }
            } else {
                collectorBadge.classList.add('hidden');
            }
        }
    }

    /**
     * Announce view changes to screen readers
     * @param {string} activeView - The currently active view
     */
    announceViewChange(activeView) {
        const viewNames = {
            'home': 'Página inicial carregada',
            'workspace': 'Workspace jurídico carregado',
            'collector': 'Coletor e curadoria carregado',
            'settings': 'Configurações abertas'
        };

        const announcement = viewNames[activeView] || `${activeView} carregado`;
        this.announceToScreenReader(announcement);
    }

    /**
     * Manage focus when switching views
     * @param {string} activeView - The currently active view
     */
    manageFocus(activeView) {
        // Focus the main content area for screen readers
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.focus();
        }

        // Focus first interactive element in the view
        setTimeout(() => {
            const activeViewElement = document.getElementById(`${activeView}-view`);
            if (activeViewElement) {
                const firstFocusable = activeViewElement.querySelector(
                    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
                );
                if (firstFocusable) {
                    firstFocusable.focus();
                }
            }
        }, 100);
    }

    /**
     * Announce message to screen readers
     * @param {string} message - Message to announce
     */
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;

        document.body.appendChild(announcement);

        // Remove after announcement
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    /**
     * Get current capture queue count
     * @returns {number} Number of items in capture queue
     */
    getCaptureQueueCount() {
        // This will be implemented when we have the capture queue data
        return this.captureQueue ? this.captureQueue.length : 0;
    }

    /**
     * Initialize view-specific functionality with performance optimization
     * @param {string} viewName - The view being initialized
     * @returns {Promise} - Promise that resolves when initialization is complete
     */
    async initViewFunctionality(viewName) {
        // Performance monitoring
        const initStart = performance.now();

        try {
            // Use lazy loading for heavy views
            switch (viewName) {
                case 'home':
                    await this.initHomeView();
                    break;
                case 'workspace':
                    await this.initWorkspaceView();
                    break;
                case 'collector':
                    await this.initCollectorView();
                    break;
            }

            const initTime = performance.now() - initStart;
            console.log(`${viewName} view initialized in ${initTime.toFixed(2)}ms`);

        } catch (error) {
            throw new Error(`Failed to initialize ${viewName} view: ${error.message}`);
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
     * Initialize workspace view functionality with loading states
     */
    async initWorkspaceView() {
        const loadingToastId = this.showLoadingToast('Inicializando workspace...');

        try {
            // Initialize step tracking
            this.initWorkspaceStepTracking();

            // Step navigation
            await this.initWorkspaceSteps();

            // Update loading message
            this.hideToast(loadingToastId);
            const configLoadingId = this.showLoadingToast('Carregando configurações...');

            // Validate configuration before proceeding
            const configValidation = await this.validateRequiredSettings();
            
            if (!configValidation.isValid) {
                this.hideToast(configLoadingId);
                console.log('Configuration incomplete, showing banner:', configValidation.missing);
                
                // Show configuration banner for missing settings
                this.showConfigurationBanner(configValidation.missing);
                
                // Auto-trigger settings modal if no settings exist at all
                if (!configValidation.settings) {
                    await this.triggerSettingsModalForIncompleteConfig(configValidation.missing);
                }
            } else {
                // Remove any existing configuration banner
                this.removeConfigurationBanner();
                
                this.hideToast(configLoadingId);
                console.log('Configuration valid, proceeding with workspace initialization');
            }

            // Step 1: Document search (now the first step)
            this.initDocumentSearchStep();

            // Step 2: Prompt studio (lazy load)
            this.initPromptStudioStep();

            const integrationLoadingId = this.showLoadingToast('Testando integrações...');

            // Test integrations
            await this.testIntegrations();

            this.hideToast(integrationLoadingId);
            
            if (configValidation.isValid) {
                this.showToast('Workspace pronto!', 'success', 2000);
            } else {
                this.showToast('Workspace carregado. Complete a configuração para usar todas as funcionalidades.', 'warning', 4000);
            }

        } catch (error) {
            this.hideToast(loadingToastId);
            throw error;
        }
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
                console.info('Chrome AI not available: Built-in AI requires Chrome Canary with --enable-features=BuiltInAIAPI flag');
                return false;
            }

            if (!('assistant' in self.ai) && !('summarizer' in self.ai)) {
                console.info('Chrome AI not available: No assistant or summarizer APIs found');
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
        // Step navigation buttons - updated for 2-step flow
        document.getElementById('next-step-1')?.addEventListener('click', () => {
            this.goToWorkspaceStep(2);
        });

        document.getElementById('prev-step-2')?.addEventListener('click', () => {
            this.goToWorkspaceStep(1);
        });

        // Direct step navigation with keyboard support
        document.querySelectorAll('.step[data-step]').forEach(step => {
            step.addEventListener('click', (e) => {
                const stepNumber = parseInt(e.currentTarget.dataset.step);
                this.goToWorkspaceStep(stepNumber);
            });

            // Keyboard navigation for steps
            step.addEventListener('keydown', (e) => {
                const stepNumber = parseInt(e.currentTarget.dataset.step);

                switch (e.key) {
                    case 'Enter':
                    case ' ':
                        e.preventDefault();
                        this.goToWorkspaceStep(stepNumber);
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        if (stepNumber > 1) {
                            this.goToWorkspaceStep(stepNumber - 1);
                        }
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        if (stepNumber < 2) {
                            this.goToWorkspaceStep(stepNumber + 1);
                        }
                        break;
                    case 'Home':
                        e.preventDefault();
                        this.goToWorkspaceStep(1);
                        break;
                    case 'End':
                        e.preventDefault();
                        this.goToWorkspaceStep(2);
                        break;
                }
            });
        });
    }

    /**
     * Navigate to a specific workspace step with enhanced features
     * @param {number} stepNumber - The step number to navigate to
     */
    goToWorkspaceStep(stepNumber) {
        if (stepNumber < 1 || stepNumber > 2) return;

        // Update step indicators with ARIA attributes
        document.querySelectorAll('.step').forEach((step, index) => {
            step.classList.remove('active', 'completed');
            step.setAttribute('aria-selected', 'false');
            step.setAttribute('tabindex', '-1');

            if (index + 1 === stepNumber) {
                step.classList.add('active');
                step.setAttribute('aria-selected', 'true');
                step.setAttribute('tabindex', '0');
            } else if (index + 1 < stepNumber) {
                step.classList.add('completed');
            }
        });

        // Show/hide step content with ARIA attributes
        document.querySelectorAll('.step-content').forEach((content, index) => {
            content.classList.remove('active');
            content.setAttribute('aria-hidden', 'true');

            if (index + 1 === stepNumber) {
                content.classList.add('active');
                content.setAttribute('aria-hidden', 'false');
            }
        });

        this.currentStep = stepNumber;

        // Update breadcrumb and navigation
        this.updateBreadcrumb('workspace');
        this.updateNavigationBadges();

        // Announce step change to screen readers
        const stepNames = {
            1: 'Leis & Artigos',
            2: 'Prompt Studio'
        };
        this.announceToScreenReader(`Navegou para etapa ${stepNumber}: ${stepNames[stepNumber]}`);

        // Focus management for the new step
        setTimeout(() => {
            const activeStepContent = document.querySelector('.step-content.active');
            if (activeStepContent) {
                const firstFocusable = activeStepContent.querySelector(
                    'input:not([disabled]), select:not([disabled]), button:not([disabled]), textarea:not([disabled])'
                );
                if (firstFocusable) {
                    firstFocusable.focus();
                }
            }
        }, 100);

        this.showToast(`Navegando para Etapa ${stepNumber}`, 'info', 1500);
    }

    /**
     * Initialize jurisdiction configuration step
     */
    initJurisdictionStep() {
        // Load saved settings
        this.loadJurisdictionSettings();

        // Add real-time validation with accessibility
        const step1Container = document.getElementById('step-1');
        if (step1Container) {
            this.addRealTimeValidation(step1Container);
        }

        // Add form field event listeners
        this.initJurisdictionEventListeners();
    }

    /**
     * Initialize jurisdiction form validation
     * @deprecated - Jurisdiction fields are now managed through settings modal
     */
    initJurisdictionValidation() {
        // No-op: Jurisdiction fields are now managed through settings modal
        console.debug('Jurisdiction validation initialization skipped - using settings modal');
    }

    /**
     * Initialize jurisdiction event listeners
     * @deprecated - Jurisdiction fields are now managed through settings modal
     */
    initJurisdictionEventListeners() {
        // No-op: Jurisdiction fields are now managed through settings modal
        console.debug('Jurisdiction event listeners skipped - using settings modal');
    }

    /**
     * Validate a single jurisdiction field
     * @param {string} fieldId - The field ID to validate
     */
    validateJurisdictionField(fieldId) {
        // Jurisdiction fields are now managed through settings modal
        // This function is kept for backward compatibility but does nothing
        console.debug('Jurisdiction field validation skipped - using settings modal validation');
        return true;
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
     * @deprecated - State options are now managed through settings modal
     */
    updateStateOptions() {
        // No-op: State options are now managed through settings modal
        console.debug('State options update skipped - using settings modal');
    }

    /**
     * Debounced corpus URL validation
     * @deprecated - Corpus URL validation is now handled through settings modal
     */
    debounceCorpusValidation() {
        // No-op: Corpus URL validation is now handled through settings modal
        console.debug('Debounced corpus validation skipped - using settings modal validation');
    }

    /**
     * Validate corpus URL by testing connectivity
     * @deprecated - Corpus URL validation is now handled through settings modal
     */
    async validateCorpusUrl() {
        // No-op: Corpus URL validation is now handled through settings modal
        console.debug('Corpus URL validation skipped - using settings modal validation');
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
        const settings = await this.getJurisdictionSettings();

        try {
            // Save to IndexedDB using existing db.js
            try {
                await setSetting('jurisdiction-config', settings);
            } catch (error) {
                console.warn('Failed to save to IndexedDB, using localStorage fallback:', error);
                localStorage.setItem('lexflow-jurisdiction', JSON.stringify(settings));
            }
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }

    /**
     * Get current jurisdiction settings from IndexedDB
     * @returns {Object} - Current jurisdiction settings
     */
    async getJurisdictionSettings() {
        try {
            const settings = await getSetting('app-settings');
            if (!settings) {
                return {
                    language: '',
                    country: '',
                    state: '',
                    city: '',
                    corpusUrl: '',
                    timestamp: Date.now()
                };
            }
            
            return {
                language: settings.language || '',
                country: settings.country || '',
                state: settings.state || '',
                city: settings.city || '',
                corpusUrl: settings.baseUrl || '',
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error loading jurisdiction settings:', error);
            return {
                language: '',
                country: '',
                state: '',
                city: '',
                corpusUrl: '',
                timestamp: Date.now()
            };
        }
    }

    /**
     * Save jurisdiction settings and continue to next step
     */
    async saveJurisdictionAndContinue() {
        // Jurisdiction settings are now managed through settings modal
        // This function is kept for backward compatibility
        console.debug('saveJurisdictionAndContinue called - redirecting to settings modal');
        
        // Check if settings are configured
        const config = await this.validateRequiredSettings();
        if (!config.isValid) {
            this.showToast('Configure as configurações primeiro', 'warning');
            this.showModal('settings');
            return;
        }

        const saveBtn = document.getElementById('save-jurisdiction');
        const originalText = saveBtn.textContent;

        try {
            // Show loading state
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';

            // Save to IndexedDB
            try {
                await setSetting('jurisdiction-config', settings);
            } catch (error) {
                console.warn('Failed to save to IndexedDB, using localStorage fallback:', error);
                localStorage.setItem('lexflow-jurisdiction', JSON.stringify(settings));
            }

            this.showToast('Configuração de jurisdição salva!', 'success');

            // Mark step as completed
            document.querySelector('.step[data-step="1"]').classList.add('completed');

            // Continue to document selection step after brief delay
            setTimeout(() => {
                this.goToWorkspaceStep(1);
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
            try {
                settings = await getSetting('jurisdiction-config');
            } catch (error) {
                console.warn('Failed to load from IndexedDB:', error);
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

            // Settings are now managed through the settings modal
            // No need to populate workspace form fields as they no longer exist
            console.debug('Jurisdiction settings loaded:', settings);
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
     * Load available documents from corpus with caching and performance optimization
     */
    async loadAvailableDocuments() {
        const documentSelect = document.getElementById('document-select');
        if (!documentSelect) return;

        const loadingToastId = this.showLoadingToast('Carregando documentos...');

        try {
            // Get settings from IndexedDB
            const config = await this.validateRequiredSettings();
            
            if (!config.isValid) {
                this.hideToast(loadingToastId);
                this.showConfigurationBanner(config.missing);
                return;
            }

            const corpusUrl = config.settings.baseUrl;

            // Show loading state
            documentSelect.innerHTML = '<option value="">Carregando documentos...</option>';
            documentSelect.disabled = true;

            // Check cache first for performance
            const cacheKey = `documents-${btoa(corpusUrl)}`;
            const cachedData = this.getCachedData(cacheKey, 5 * 60 * 1000); // 5 minutes cache

            let documents = [];

            if (cachedData) {
                documents = cachedData;
                console.log('Using cached documents');
            } else {
                // Fetch document list with timeout
                const documentsUrl = corpusUrl.endsWith('/') ? corpusUrl + 'documents.json' : corpusUrl + '/documents.json';

                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

                    const response = await fetch(documentsUrl, {
                        signal: controller.signal,
                        cache: 'default'
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        documents = await response.json();
                        // Cache the results
                        this.setCachedData(cacheKey, documents);
                    } else {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                } catch (error) {
                    if (error.name === 'AbortError') {
                        throw new Error('Request timeout - corpus server may be slow');
                    }
                    console.warn('Could not load documents.json, using defaults:', error);
                    documents = await this.getDefaultDocuments(settings.country);
                }
            }

            // Optimize DOM manipulation
            const fragment = document.createDocumentFragment();
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Selecione um documento...';
            fragment.appendChild(defaultOption);

            // Batch DOM updates for better performance
            documents.forEach(doc => {
                const option = document.createElement('option');
                option.value = doc.filename || doc.name;
                option.textContent = doc.title || doc.name;
                option.dataset.url = doc.url || `${corpusUrl}/${doc.filename || doc.name}`;
                fragment.appendChild(option);
            });

            // Single DOM update
            documentSelect.innerHTML = '';
            documentSelect.appendChild(fragment);
            documentSelect.disabled = false;

            this.hideToast(loadingToastId);
            this.showToast(`${documents.length} documentos carregados`, 'success', 2000);

        } catch (error) {
            this.hideToast(loadingToastId);
            this.handleNetworkError(error, 'Loading documents', config?.settings?.baseUrl);

            documentSelect.innerHTML = '<option value="">Erro ao carregar documentos</option>';
            documentSelect.disabled = false;
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
     * Load articles from selected document with caching and performance optimization
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

        const loadingToastId = this.showLoadingToast('Carregando artigos...');

        try {
            // Get document URL
            const documentUrl = selectedOption.dataset.url;

            // Check cache first
            const cacheKey = `articles-${btoa(documentUrl)}`;
            const cachedArticles = this.getCachedData(cacheKey, 10 * 60 * 1000); // 10 minutes cache

            let articles;

            if (cachedArticles) {
                articles = cachedArticles;
                console.log('Using cached articles');
                this.hideToast(loadingToastId);
                const cacheToastId = this.showLoadingToast('Renderizando artigos...');

                // Defer rendering to next frame for better UX
                await new Promise(resolve => requestAnimationFrame(resolve));

                this.allArticles = articles;
                this.renderArticles(articles);

                this.hideToast(cacheToastId);
                this.showToast(`${articles.length} artigos carregados (cache)`, 'success', 2000);
            } else {
                // Show loading state
                articlesContainer.innerHTML = '<p class="muted">Carregando artigos...</p>';

                // Dynamic import for better performance
                const { fetchMarkdown, splitByArticles } = await import('../util/markdown.js');

                // Update loading message
                this.hideToast(loadingToastId);
                const fetchToastId = this.showLoadingToast('Baixando documento...');

                // Fetch with timeout and progress
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

                const markdownText = await fetchMarkdown(documentUrl, { signal: controller.signal });
                clearTimeout(timeoutId);

                this.hideToast(fetchToastId);
                const parseToastId = this.showLoadingToast('Processando artigos...');

                // Parse articles with progress feedback
                articles = await this.parseArticlesWithProgress(markdownText, splitByArticles);

                // Cache the results
                this.setCachedData(cacheKey, articles);

                this.allArticles = articles;

                this.hideToast(parseToastId);
                const renderToastId = this.showLoadingToast('Renderizando interface...');

                // Defer rendering to prevent blocking
                await new Promise(resolve => setTimeout(resolve, 0));

                this.renderArticles(articles);

                this.hideToast(renderToastId);
                this.showToast(`${articles.length} artigos carregados`, 'success', 2000);
            }

        } catch (error) {
            this.hideToast(loadingToastId);

            if (error.name === 'AbortError') {
                this.handleNetworkError(new Error('Timeout ao carregar documento'), 'Loading document articles', selectedOption.dataset.url);
            } else {
                this.handleMarkdownError(error, 'Loading document articles');
            }

            articlesContainer.innerHTML = '<p class="error">Erro ao carregar artigos do documento</p>';
        }
    }

    /**
     * Parse articles with progress feedback for large documents
     * @param {string} markdownText - Markdown content
     * @param {Function} splitByArticles - Article splitting function
     * @returns {Promise<Array>} - Array of articles
     */
    async parseArticlesWithProgress(markdownText, splitByArticles) {
        // For very large documents, show progress
        if (markdownText.length > 100000) { // 100KB+
            return new Promise((resolve, reject) => {
                // Use setTimeout to prevent blocking the UI
                setTimeout(() => {
                    try {
                        const articles = splitByArticles(markdownText);
                        resolve(articles);
                    } catch (error) {
                        reject(error);
                    }
                }, 0);
            });
        } else {
            return splitByArticles(markdownText);
        }
    }

    /**
     * Render articles list with performance optimization and virtual scrolling
     * @param {Array} articles - Array of article objects
     */
    renderArticles(articles) {
        const articlesContainer = document.getElementById('articles-list');
        if (!articlesContainer) return;

        if (articles.length === 0) {
            articlesContainer.innerHTML = '<p class="muted">Nenhum artigo encontrado neste documento</p>';
            return;
        }

        // Performance optimization: use virtual scrolling for large lists
        const useVirtualScrolling = articles.length > 50;

        if (useVirtualScrolling) {
            this.renderArticlesVirtual(articles, articlesContainer);
        } else {
            this.renderArticlesStandard(articles, articlesContainer);
        }

        // Add CSS for articles if not already added
        this.addArticlesCSS();
    }

    /**
     * Render articles with virtual scrolling for large lists
     * @param {Array} articles - Array of article objects
     * @param {HTMLElement} container - Container element
     */
    renderArticlesVirtual(articles, container) {
        const itemHeight = 120; // Estimated height per article
        const visibleItems = Math.ceil(container.clientHeight / itemHeight) + 5; // Buffer

        let scrollTop = 0;
        let startIndex = 0;
        let endIndex = Math.min(visibleItems, articles.length);

        const renderVisibleItems = () => {
            const fragment = document.createDocumentFragment();

            for (let i = startIndex; i < endIndex; i++) {
                const article = articles[i];
                const isSelected = this.selectedArticles.has(i);
                const preview = article.text.length > 200 ?
                    article.text.substring(0, 200) + '...' :
                    article.text;

                const articleDiv = document.createElement('div');
                articleDiv.className = 'article-item';
                articleDiv.dataset.index = i;
                articleDiv.style.position = 'absolute';
                articleDiv.style.top = `${i * itemHeight}px`;
                articleDiv.style.width = '100%';
                articleDiv.innerHTML = `
                    <label class="article-label">
                        <input type="checkbox" class="article-checkbox" 
                               data-index="${i}" ${isSelected ? 'checked' : ''}>
                        <strong>${this.escapeHtml(article.title)}</strong>
                    </label>
                    <div class="article-preview">
                        ${this.escapeHtml(preview)}
                    </div>
                `;
                fragment.appendChild(articleDiv);
            }

            return fragment;
        };

        const scrollHandler = () => {
            const newScrollTop = container.scrollTop;
            const newStartIndex = Math.floor(newScrollTop / itemHeight);
            const newEndIndex = Math.min(newStartIndex + visibleItems, articles.length);

            if (newStartIndex !== startIndex || newEndIndex !== endIndex) {
                startIndex = newStartIndex;
                endIndex = newEndIndex;

                // Clear and re-render visible items
                const articlesWrapper = container.querySelector('.articles-container');
                articlesWrapper.innerHTML = '';
                articlesWrapper.appendChild(renderVisibleItems());
            }
        };

        container.innerHTML = `
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
            <div class="articles-container" style="position: relative; height: 400px; overflow-y: auto;">
                <div style="height: ${articles.length * itemHeight}px; position: relative;">
                </div>
            </div>
        `;

        const articlesWrapper = container.querySelector('.articles-container > div');
        articlesWrapper.appendChild(renderVisibleItems());

        // Add scroll listener with throttling
        let scrollTimeout;
        container.querySelector('.articles-container').addEventListener('scroll', () => {
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(scrollHandler, 16); // ~60fps
        });
    }

    /**
     * Render articles with standard method for smaller lists
     * @param {Array} articles - Array of article objects
     * @param {HTMLElement} container - Container element
     */
    renderArticlesStandard(articles, container) {
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();

        articles.forEach((article, index) => {
            const isSelected = this.selectedArticles.has(index);
            const preview = article.text.length > 200 ?
                article.text.substring(0, 200) + '...' :
                article.text;

            const articleDiv = document.createElement('div');
            articleDiv.className = 'article-item';
            articleDiv.dataset.index = index;
            articleDiv.innerHTML = `
                <label class="article-label">
                    <input type="checkbox" class="article-checkbox" 
                           data-index="${index}" ${isSelected ? 'checked' : ''}>
                    <strong>${this.escapeHtml(article.title)}</strong>
                </label>
                <div class="article-preview">
                    ${this.escapeHtml(preview)}
                </div>
            `;
            fragment.appendChild(articleDiv);
        });

        container.innerHTML = `
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
            </div>
        `;

        container.querySelector('.articles-container').appendChild(fragment);
    }

    /**
     * Escape HTML to prevent XSS attacks
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

        // Update button state - step 1 now goes to step 2 (Prompt Studio)
        const nextBtn = document.getElementById('next-step-1');
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
                    {
                        name: 'context_type', label: 'Contexto de Aplicação', type: 'select', options: [
                            { value: 'empresarial', label: 'Contexto Empresarial' },
                            { value: 'individual', label: 'Pessoa Física' },
                            { value: 'publico', label: 'Administração Pública' },
                            { value: 'judicial', label: 'Processo Judicial' }
                        ]
                    }
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
            try {
                await saveHistory(historyItem);
            } catch (error) {
                console.warn('Failed to save to IndexedDB, using localStorage fallback:', error);
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
     * Initialize collector view functionality with lazy loading
     */
    async initCollectorView() {
        const loadingToastId = this.showLoadingToast('Inicializando coletor...');

        try {
            console.log('Collector view initialized');

            // Initialize collector state
            this.selectedQueueItem = null;
            this.queueItems = [];

            // Load queue items from database with loading feedback
            this.hideToast(loadingToastId);
            const queueLoadingId = this.showLoadingToast('Carregando fila de captura...');

            await this.loadQueueItems();

            this.hideToast(queueLoadingId);

            // Set up auto-refresh for queue (lazy)
            this.setupQueueAutoRefresh();

            // Initialize event listeners (lazy)
            this.initCollectorEventListeners();

            this.showToast('Coletor pronto!', 'success', 2000);

        } catch (error) {
            this.hideToast(loadingToastId);
            throw error;
        }
    }

    /**
     * Initialize collector event listeners
     */
    initCollectorEventListeners() {
        // Refresh queue button (if exists)
        const refreshBtn = document.getElementById('refresh-queue');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadQueueItems();
            });
        }

        // Clear queue button (if exists)
        const clearBtn = document.getElementById('clear-queue');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearQueue();
            });
        }
    }

    /**
     * Setup auto-refresh for queue items
     */
    setupQueueAutoRefresh() {
        // Refresh queue every 30 seconds to catch new captures
        this.queueRefreshInterval = setInterval(() => {
            this.loadQueueItems();
        }, 30000);

        // Clear interval when leaving collector view
        const originalShowView = this.showView.bind(this);
        this.showView = (viewName) => {
            if (this.currentView === 'collector' && viewName !== 'collector') {
                if (this.queueRefreshInterval) {
                    clearInterval(this.queueRefreshInterval);
                    this.queueRefreshInterval = null;
                }
            }
            return originalShowView(viewName);
        };
    }

    /**
     * Load queue items from database
     */
    async loadQueueItems() {
        try {
            // Import database functions
            const { listSubmissions } = await import('../db.js');

            // Load all submissions (queued, editing, ready)
            const submissions = await listSubmissions();

            // Filter out deleted items and sort by timestamp (newest first)
            this.queueItems = submissions
                .filter(item => item.status !== 'deleted')
                .sort((a, b) => b.ts - a.ts);

            // Update UI
            this.renderQueueItems();
            this.updateQueueCount(this.queueItems.length);

        } catch (error) {
            console.error('Error loading queue items:', error);
            this.showToast('Erro ao carregar fila de captura', 'error');
            this.queueItems = [];
            this.renderQueueItems();
            this.updateQueueCount(0);
        }
    }

    /**
     * Render queue items in the UI
     */
    renderQueueItems() {
        const queueContainer = document.getElementById('queue-items');
        if (!queueContainer) return;

        if (this.queueItems.length === 0) {
            queueContainer.innerHTML = `
                <div class="empty-queue">
                    <p class="muted text-center">Nenhum item na fila</p>
                    <p class="text-center">
                        <small>Use o menu de contexto do navegador para capturar conteúdo</small>
                    </p>
                </div>
            `;
            return;
        }

        const itemsHtml = this.queueItems.map(item => {
            const isSelected = this.selectedQueueItem && this.selectedQueueItem.id === item.id;
            const statusIcon = this.getStatusIcon(item.status);
            const modeIcon = item.mode === 'full' ? '📄' : '📝';
            const timeAgo = this.formatTimeAgo(item.ts);

            // Truncate title and text for preview
            const title = item.title ?
                (item.title.length > 50 ? item.title.substring(0, 50) + '...' : item.title) :
                'Sem título';

            const preview = item.selectionText ?
                (item.selectionText.length > 100 ? item.selectionText.substring(0, 100) + '...' : item.selectionText) :
                'Sem conteúdo';

            return `
                <div class="queue-item ${isSelected ? 'selected' : ''}" 
                     data-id="${item.id}" onclick="app.selectQueueItem(${item.id})">
                    <div class="queue-item-header">
                        <div class="queue-item-icons">
                            <span class="mode-icon" title="${item.mode === 'full' ? 'Página completa' : 'Seleção'}">${modeIcon}</span>
                            <span class="status-icon" title="Status: ${item.status}">${statusIcon}</span>
                        </div>
                        <div class="queue-item-time">${timeAgo}</div>
                    </div>
                    <div class="queue-item-title">${title}</div>
                    <div class="queue-item-preview">${preview}</div>
                    <div class="queue-item-url">
                        <small class="muted">${this.formatUrl(item.url)}</small>
                    </div>
                </div>
            `;
        }).join('');

        queueContainer.innerHTML = `
            <div class="queue-header">
                <div class="queue-actions">
                    <button type="button" class="secondary small" onclick="app.loadQueueItems()" title="Atualizar fila">
                        🔄 Atualizar
                    </button>
                    <button type="button" class="secondary small" onclick="app.clearQueue()" title="Limpar fila">
                        🗑️ Limpar
                    </button>
                </div>
            </div>
            <div class="queue-list">
                ${itemsHtml}
            </div>
        `;

        // Add queue CSS if not already added
        this.addQueueCSS();
    }

    /**
     * Get status icon for queue item
     * @param {string} status - Item status
     * @returns {string} - Status icon
     */
    getStatusIcon(status) {
        const icons = {
            'queued': '⏳',
            'editing': '✏️',
            'ready': '✅',
            'exported': '📤',
            'error': '❌'
        };
        return icons[status] || '❓';
    }

    /**
     * Format time ago string
     * @param {number} timestamp - Timestamp in milliseconds
     * @returns {string} - Formatted time ago
     */
    formatTimeAgo(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return 'agora';
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        return `${days}d`;
    }

    /**
     * Format URL for display
     * @param {string} url - Full URL
     * @returns {string} - Formatted URL
     */
    formatUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
        } catch {
            return url.length > 50 ? url.substring(0, 50) + '...' : url;
        }
    }

    /**
     * Select a queue item for editing
     * @param {number} itemId - Item ID to select
     */
    async selectQueueItem(itemId) {
        try {
            // Find item in queue
            const item = this.queueItems.find(i => i.id === itemId);
            if (!item) {
                this.showToast('Item não encontrado', 'error');
                return;
            }

            this.selectedQueueItem = item;

            // Update UI selection
            document.querySelectorAll('.queue-item').forEach(el => {
                el.classList.remove('selected');
            });
            document.querySelector(`[data-id="${itemId}"]`)?.classList.add('selected');

            // Load item in editor
            this.loadItemInEditor(item);

            // Update item status to editing if it was queued
            if (item.status === 'queued') {
                await this.updateItemStatus(itemId, 'editing');
            }

        } catch (error) {
            console.error('Error selecting queue item:', error);
            this.showToast('Erro ao selecionar item', 'error');
        }
    }

    /**
     * Update item status in database
     * @param {number} itemId - Item ID
     * @param {string} status - New status
     */
    async updateItemStatus(itemId, status) {
        try {
            const { updateSubmission } = await import('../db.js');
            await updateSubmission(itemId, { status });

            // Update local item
            const item = this.queueItems.find(i => i.id === itemId);
            if (item) {
                item.status = status;
            }

            // Re-render queue to show updated status
            this.renderQueueItems();

        } catch (error) {
            console.error('Error updating item status:', error);
            this.showToast('Erro ao atualizar status do item', 'error');
        }
    }

    /**
     * Load item in editor panel
     * @param {Object} item - Queue item to edit
     */
    loadItemInEditor(item) {
        const editorContent = document.getElementById('editor-content');
        if (!editorContent) return;

        const editorHtml = `
            <form id="metadata-form" class="metadata-form">
                <div class="form-field mb-1">
                    <label for="edit-title">Título:</label>
                    <input type="text" id="edit-title" value="${item.title || ''}" 
                           placeholder="Digite o título do documento">
                </div>
                
                <div class="grid2">
                    <div class="form-field">
                        <label for="edit-jurisdiction">Jurisdição:</label>
                        <input type="text" id="edit-jurisdiction" value="${item.jurisdiction || ''}" 
                               placeholder="ex: Brasil, Rio Grande do Sul">
                    </div>
                    <div class="form-field">
                        <label for="edit-language">Idioma:</label>
                        <select id="edit-language">
                            <option value="pt-BR" ${item.lang === 'pt-BR' ? 'selected' : ''}>Português (Brasil)</option>
                            <option value="en-US" ${item.lang === 'en-US' ? 'selected' : ''}>English (US)</option>
                            <option value="es-ES" ${item.lang === 'es-ES' ? 'selected' : ''}>Español</option>
                        </select>
                    </div>
                </div>
                
                <div class="grid2">
                    <div class="form-field">
                        <label for="edit-source-url">URL de Origem:</label>
                        <input type="url" id="edit-source-url" value="${item.url || ''}" 
                               placeholder="https://exemplo.com/documento">
                    </div>
                    <div class="form-field">
                        <label for="edit-version-date">Data da Versão:</label>
                        <input type="date" id="edit-version-date" value="${this.formatDateForInput(item.ts)}">
                    </div>
                </div>
                
                <div class="form-field mb-1">
                    <label for="edit-content">Conteúdo:</label>
                    <textarea id="edit-content" rows="8" placeholder="Conteúdo do documento">${item.selectionText || ''}</textarea>
                    <small class="muted">
                        Modo de captura: ${item.mode === 'full' ? 'Página completa' : 'Seleção'} | 
                        Caracteres: ${(item.selectionText || '').length}
                    </small>
                </div>
                
                <div class="editor-actions">
                    <button type="button" class="primary" onclick="app.saveItemChanges()">
                        💾 Salvar Alterações
                    </button>
                    <button type="button" class="secondary" onclick="app.previewMarkdown()">
                        👁️ Visualizar Markdown
                    </button>

                    <button type="button" class="secondary" onclick="app.deleteQueueItem(${item.id})">
                        🗑️ Excluir Item
                    </button>
                </div>
            </form>
        `;

        editorContent.innerHTML = editorHtml;

        // Add form validation
        this.initEditorValidation();
    }

    /**
     * Format date for HTML date input
     * @param {number} timestamp - Timestamp in milliseconds
     * @returns {string} - Formatted date string (YYYY-MM-DD)
     */
    formatDateForInput(timestamp) {
        const date = new Date(timestamp);
        return date.toISOString().split('T')[0];
    }

    /**
     * Initialize editor form validation
     */
    initEditorValidation() {
        const form = document.getElementById('metadata-form');
        if (!form) return;

        // Add real-time validation
        const fields = ['edit-title', 'edit-jurisdiction', 'edit-source-url', 'edit-content'];

        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => {
                    this.validateEditorField(fieldId);
                });

                field.addEventListener('input', () => {
                    this.clearEditorFieldValidation(fieldId);
                });
            }
        });
    }

    /**
     * Validate editor field
     * @param {string} fieldId - Field ID to validate
     */
    validateEditorField(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return;

        const value = field.value.trim();
        let isValid = true;
        let errorMessage = '';

        // Clear previous validation
        field.classList.remove('error', 'success');
        this.clearEditorFieldError(field);

        switch (fieldId) {
            case 'edit-title':
                if (!value) {
                    isValid = false;
                    errorMessage = 'Título é obrigatório';
                } else if (value.length < 3) {
                    isValid = false;
                    errorMessage = 'Título deve ter pelo menos 3 caracteres';
                }
                break;

            case 'edit-jurisdiction':
                if (value && value.length < 2) {
                    isValid = false;
                    errorMessage = 'Jurisdição deve ter pelo menos 2 caracteres';
                }
                break;

            case 'edit-source-url':
                if (value && !this.isValidUrl(value)) {
                    isValid = false;
                    errorMessage = 'URL inválida';
                }
                break;

            case 'edit-content':
                if (!value) {
                    isValid = false;
                    errorMessage = 'Conteúdo é obrigatório';
                } else if (value.length < 10) {
                    isValid = false;
                    errorMessage = 'Conteúdo deve ter pelo menos 10 caracteres';
                }
                break;
        }

        // Apply validation state
        if (!isValid) {
            field.classList.add('error');
            this.showEditorFieldError(field, errorMessage);
        } else if (value) {
            field.classList.add('success');
        }

        return isValid;
    }

    /**
     * Clear editor field validation
     * @param {string} fieldId - Field ID to clear
     */
    clearEditorFieldValidation(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.classList.remove('error', 'success');
            this.clearEditorFieldError(field);
        }
    }

    /**
     * Show editor field error
     * @param {HTMLElement} field - Field element
     * @param {string} message - Error message
     */
    showEditorFieldError(field, message) {
        this.clearEditorFieldError(field);

        const errorDiv = document.createElement('div');
        errorDiv.className = 'editor-field-error';
        errorDiv.style.color = 'var(--pico-del-color)';
        errorDiv.style.fontSize = '0.8rem';
        errorDiv.style.marginTop = '0.25rem';
        errorDiv.textContent = message;

        field.parentNode.appendChild(errorDiv);
    }

    /**
     * Clear editor field error
     * @param {HTMLElement} field - Field element
     */
    clearEditorFieldError(field) {
        const existing = field.parentNode.querySelectorAll('.editor-field-error');
        existing.forEach(el => el.remove());
    }

    /**
     * Save changes to the selected item
     */
    async saveItemChanges() {
        if (!this.selectedQueueItem) {
            this.showToast('Nenhum item selecionado', 'error');
            return;
        }

        // Validate form
        const fields = ['edit-title', 'edit-jurisdiction', 'edit-source-url', 'edit-content'];
        let isValid = true;

        fields.forEach(fieldId => {
            if (!this.validateEditorField(fieldId)) {
                isValid = false;
            }
        });

        if (!isValid) {
            this.showToast('Por favor, corrija os erros no formulário', 'error');
            return;
        }

        try {
            // Get form data
            const formData = {
                title: document.getElementById('edit-title').value.trim(),
                jurisdiction: document.getElementById('edit-jurisdiction').value.trim(),
                lang: document.getElementById('edit-language').value,
                url: document.getElementById('edit-source-url').value.trim(),
                versionDate: document.getElementById('edit-version-date').value,
                selectionText: document.getElementById('edit-content').value.trim(),
                status: 'ready' // Mark as ready after editing
            };

            // Update in database
            const { updateSubmission } = await import('../db.js');
            await updateSubmission(this.selectedQueueItem.id, formData);

            // Update local item
            Object.assign(this.selectedQueueItem, formData);

            // Refresh queue display
            this.renderQueueItems();

            this.showToast('Alterações salvas com sucesso!', 'success');

        } catch (error) {
            console.error('Error saving item changes:', error);
            this.showToast('Erro ao salvar alterações', 'error');
        }
    }

    /**
     * Delete a queue item
     * @param {number} itemId - Item ID to delete
     */
    async deleteQueueItem(itemId) {
        if (!confirm('Tem certeza que deseja excluir este item?')) {
            return;
        }

        try {
            // Note: We need to add a delete function to db.js
            // For now, we'll update status to 'deleted'
            const { updateSubmission } = await import('../db.js');
            await updateSubmission(itemId, { status: 'deleted' });

            // Remove from local array
            this.queueItems = this.queueItems.filter(item => item.id !== itemId);

            // Clear editor if this item was selected
            if (this.selectedQueueItem && this.selectedQueueItem.id === itemId) {
                this.selectedQueueItem = null;
                document.getElementById('editor-content').innerHTML =
                    '<p class="muted text-center">Selecione um item da fila para editar</p>';
            }

            // Refresh display
            this.renderQueueItems();
            this.updateQueueCount(this.queueItems.length);

            this.showToast('Item excluído com sucesso', 'success');

        } catch (error) {
            console.error('Error deleting item:', error);
            this.showToast('Erro ao excluir item', 'error');
        }
    }

    /**
     * Clear entire queue
     */
    async clearQueue() {
        if (!confirm('Tem certeza que deseja limpar toda a fila? Esta ação não pode ser desfeita.')) {
            return;
        }

        try {
            // Mark all items as deleted
            const { updateSubmission } = await import('../db.js');

            for (const item of this.queueItems) {
                await updateSubmission(item.id, { status: 'deleted' });
            }

            // Clear local state
            this.queueItems = [];
            this.selectedQueueItem = null;

            // Update UI
            this.renderQueueItems();
            this.updateQueueCount(0);
            document.getElementById('editor-content').innerHTML =
                '<p class="muted text-center">Selecione um item da fila para editar</p>';

            this.showToast('Fila limpa com sucesso', 'success');

        } catch (error) {
            console.error('Error clearing queue:', error);
            this.showToast('Erro ao limpar fila', 'error');
        }
    }

    /**
     * Add CSS styles for queue interface
     */
    addQueueCSS() {
        if (document.getElementById('queue-css')) return;

        const style = document.createElement('style');
        style.id = 'queue-css';
        style.textContent = `
            .empty-queue {
                padding: 2rem;
                text-align: center;
                border: 2px dashed var(--pico-muted-border-color);
                border-radius: var(--pico-border-radius);
                margin: 1rem 0;
            }
            
            .queue-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid var(--pico-muted-border-color);
            }
            
            .queue-actions {
                display: flex;
                gap: 0.5rem;
            }
            
            .queue-actions .small {
                padding: 0.25rem 0.5rem;
                font-size: 0.8rem;
            }
            
            .queue-list {
                max-height: 400px;
                overflow-y: auto;
            }
            
            .queue-item {
                padding: 0.75rem;
                border: 1px solid var(--pico-muted-border-color);
                border-radius: var(--pico-border-radius);
                margin-bottom: 0.5rem;
                cursor: pointer;
                transition: all 0.2s ease;
                background: var(--pico-card-background-color);
            }
            
            .queue-item:hover {
                border-color: var(--pico-primary-color);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .queue-item.selected {
                border-color: var(--pico-primary-color);
                background: var(--pico-primary-background);
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            }
            
            .queue-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 0.5rem;
            }
            
            .queue-item-icons {
                display: flex;
                gap: 0.25rem;
            }
            
            .mode-icon, .status-icon {
                font-size: 0.9rem;
            }
            
            .queue-item-time {
                font-size: 0.8rem;
                color: var(--pico-muted-color);
            }
            
            .queue-item-title {
                font-weight: bold;
                margin-bottom: 0.25rem;
                color: var(--pico-color);
            }
            
            .queue-item-preview {
                font-size: 0.9rem;
                color: var(--pico-muted-color);
                line-height: 1.3;
                margin-bottom: 0.25rem;
            }
            
            .queue-item-url {
                font-size: 0.8rem;
            }
            
            .metadata-form .form-field {
                position: relative;
            }
            
            .metadata-form .form-field.error input,
            .metadata-form .form-field.error select,
            .metadata-form .form-field.error textarea {
                border-color: var(--pico-del-color);
            }
            
            .metadata-form .form-field.success input,
            .metadata-form .form-field.success select,
            .metadata-form .form-field.success textarea {
                border-color: var(--pico-ins-color);
            }
            
            .editor-actions {
                display: flex;
                gap: 0.5rem;
                flex-wrap: wrap;
                margin-top: 1rem;
            }
            
            .editor-actions button {
                flex: 1;
                min-width: 120px;
            }
            
            @media (max-width: 600px) {
                .editor-actions {
                    flex-direction: column;
                }
                
                .editor-actions button {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
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
     * Show toast with action button
     * @param {string} message - The message to show
     * @param {string} type - Toast type (success, error, info, warning)
     * @param {number} duration - Duration in milliseconds
     * @param {string} actionLabel - Label for action button
     * @param {Function} actionHandler - Handler for action button
     */
    showToastWithAction(message, type = 'info', duration = 5000, actionLabel = 'Action', actionHandler = null) {
        const actions = actionHandler ? [{
            id: 'primary',
            label: actionLabel,
            handler: actionHandler
        }] : [];

        return this.toastSystem.show({
            message: message,
            actions: actions,
            persistent: !!actionHandler
        }, type, actionHandler ? 0 : duration);
    }

    /**
     * Show loading toast with spinner
     * @param {string} message - Loading message
     * @returns {number} Toast ID for later dismissal
     */
    showLoadingToast(message = 'Carregando...') {
        return this.toastSystem.loading(message);
    }

    /**
     * Update loading toast with new message
     * @param {number} toastId - Toast ID to update
     * @param {string} message - New message
     */
    updateLoadingToast(toastId, message) {
        // Hide old toast and show new one
        this.hideToast(toastId);
        return this.showLoadingToast(message);
    }

    /**
     * Show offline mode toast
     */
    showOfflineToast() {
        return this.showToastWithAction(
            'Modo offline ativado. Algumas funcionalidades podem estar limitadas.',
            'warning',
            0,
            'Entendi',
            () => { } // Just dismiss
        );
    }

    /**
     * Show connection restored toast
     */
    showOnlineToast() {
        return this.showToast('Conexão restaurada! Todas as funcionalidades disponíveis.', 'success', 4000);
    }

    /**
     * Cache data with timestamp for performance optimization
     * @param {string} key - Cache key
     * @param {*} data - Data to cache
     */
    setCachedData(key, data) {
        try {
            const cacheEntry = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(`lexflow-cache-${key}`, JSON.stringify(cacheEntry));
        } catch (error) {
            console.warn('Failed to cache data:', error);
        }
    }

    /**
     * Get cached data if still valid
     * @param {string} key - Cache key
     * @param {number} maxAge - Maximum age in milliseconds
     * @returns {*} - Cached data or null if expired/not found
     */
    getCachedData(key, maxAge = 5 * 60 * 1000) {
        try {
            const cached = localStorage.getItem(`lexflow-cache-${key}`);
            if (!cached) return null;

            const cacheEntry = JSON.parse(cached);
            const age = Date.now() - cacheEntry.timestamp;

            if (age > maxAge) {
                localStorage.removeItem(`lexflow-cache-${key}`);
                return null;
            }

            return cacheEntry.data;
        } catch (error) {
            console.warn('Failed to get cached data:', error);
            return null;
        }
    }

    /**
     * Clear expired cache entries for performance
     */
    clearExpiredCache() {
        try {
            const keys = Object.keys(localStorage).filter(key => key.startsWith('lexflow-cache-'));
            const now = Date.now();
            let cleared = 0;

            keys.forEach(key => {
                try {
                    const cached = localStorage.getItem(key);
                    const cacheEntry = JSON.parse(cached);
                    const age = now - cacheEntry.timestamp;

                    // Clear entries older than 1 hour
                    if (age > 60 * 60 * 1000) {
                        localStorage.removeItem(key);
                        cleared++;
                    }
                } catch (error) {
                    // Remove corrupted cache entries
                    localStorage.removeItem(key);
                    cleared++;
                }
            });

            if (cleared > 0) {
                console.log(`Cleared ${cleared} expired cache entries`);
            }
        } catch (error) {
            console.warn('Failed to clear expired cache:', error);
        }
    }

    /**
     * Initialize event listeners with keyboard navigation support
     */
    initEventListeners() {
        // Navigation tabs with keyboard support
        document.querySelectorAll('.nav-tab[data-view]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const view = e.currentTarget.dataset.view;
                this.navigate(view);
            });

            // Keyboard navigation for tabs
            tab.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const view = e.currentTarget.dataset.view;
                    this.navigate(view);
                }
            });
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeyboard(e);
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

        // Workspace settings button
        document.getElementById('workspace-settings-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.showModal('settings');
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
        const serverlessEndpoint = document.getElementById('settings-serverless-endpoint').value;

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

        // Enhanced serverless endpoint validation
        if (serverlessEndpoint) {
            if (!serverlessEndpoint.startsWith('https://')) {
                errors.serverlessEndpoint = 'URL deve começar com "https://"';
                isValid = false;
            } else {
                try {
                    const urlObj = new URL(serverlessEndpoint);
                    // Additional validation for endpoint URLs
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
            if (field && typeof field.closest === 'function') {
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
        ['language', 'country', 'state', 'city', 'corpusUrl', 'serverlessEndpoint'].forEach(fieldName => {
            if (!errors[fieldName]) {
                const field = document.getElementById(`settings-${fieldName === 'corpusUrl' ? 'corpus-url' : fieldName === 'serverlessEndpoint' ? 'serverless-endpoint' : fieldName}`);
                if (field && field.value && typeof field.closest === 'function') {
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
            serverlessEndpoint: document.getElementById('settings-serverless-endpoint').value
        };

        // Show loading state
        const saveBtn = document.getElementById('save-settings-btn');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        try {
            // Save to IndexedDB using the existing db.js module
            try {
                // Use IndexedDB if available
                await setSetting('app-settings', settings);
            } catch (error) {
                console.warn('Failed to save to IndexedDB, using localStorage fallback:', error);
                // Fallback to localStorage
                localStorage.setItem('lexflow-settings', JSON.stringify(settings));
            }

            // Enhanced success message with serverless endpoint feedback
            let successMessage = 'Configurações salvas com sucesso!';
            const serverlessEndpoint = document.getElementById('settings-serverless-endpoint').value.trim();

            if (serverlessEndpoint) {
                successMessage += ' Integração serverless configurada e pronta para uso.';
            } else {
                successMessage += ' Para usar integração automática, configure o endpoint serverless.';
            }

            this.showToast(successMessage, 'success', 6000);
            this.hideModal('settings');

            // Update jurisdiction fields in workspace if they're empty
            this.updateWorkspaceFromSettings(settings);

            // Refresh workspace configuration if currently in workspace view
            if (this.currentView === 'workspace') {
                await this.refreshWorkspaceConfiguration(settings);
            }

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
     * 
     * Migration Note: Legacy github-token settings are intentionally ignored.
     * Existing users will need to configure the new serverless endpoint.
     * This approach ensures security by not migrating sensitive tokens.
     */
    async loadSettings() {
        try {
            let settings = null;

            // Try to load from IndexedDB first
            try {
                settings = await getSetting('app-settings');
            } catch (error) {
                console.warn('Failed to load from IndexedDB:', error);
            }

            // Fallback to localStorage
            if (!settings) {
                const saved = localStorage.getItem('lexflow-settings');
                if (saved) {
                    settings = JSON.parse(saved);

                    // Migration: Remove any legacy github-token from loaded settings
                    // This ensures old token data doesn't cause issues
                    if (settings && settings['github-token']) {
                        delete settings['github-token'];
                        console.log('Removed legacy github-token from settings during migration');
                    }
                }
            }

            if (settings) {
                // Migration: Clean up any legacy github-token from settings
                if (settings['github-token']) {
                    delete settings['github-token'];
                    console.log('Removed legacy github-token from IndexedDB settings during migration');

                    // Save cleaned settings back to storage
                    try {
                        await setSetting('app-settings', settings);
                    } catch (error) {
                        console.warn('Failed to save cleaned settings:', error);
                    }
                }

                // Populate settings form
                document.getElementById('settings-language').value = settings.language || 'pt-BR';
                document.getElementById('settings-country').value = settings.country || '';
                document.getElementById('settings-state').value = settings.state || '';
                document.getElementById('settings-city').value = settings.city || '';
                document.getElementById('settings-corpus-url').value = settings.corpusUrl || '';
                document.getElementById('settings-serverless-endpoint').value = settings.serverlessEndpoint || '';

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
     * @deprecated - Jurisdiction fields are now managed through settings modal only
     */
    updateWorkspaceFromSettings(settings) {
        // No-op: Jurisdiction fields are now managed through settings modal only
        console.debug('Workspace settings update skipped - using settings modal configuration');
    }

    /**
     * Refresh workspace configuration after settings are saved
     * @param {Object} settings - The updated settings object
     */
    async refreshWorkspaceConfiguration(settings) {
        try {
            console.log('Refreshing workspace configuration with new settings:', settings);
            
            // Re-validate configuration
            const configValidation = await this.validateRequiredSettings();
            
            if (configValidation.isValid) {
                // Remove configuration banner if it exists
                this.removeConfigurationBanner();
                
                // Show success message
                this.showToast('Configuração atualizada! Recarregando documentos...', 'success', 3000);
                
                // Reload document list if we're on step 1
                if (this.currentStep === 1) {
                    try {
                        await this.loadAvailableDocuments();
                    } catch (error) {
                        console.warn('Failed to reload documents after configuration update:', error);
                        this.showToast('Configuração salva, mas houve erro ao recarregar documentos', 'warning', 4000);
                    }
                }
            } else {
                // Still missing some configuration, show banner
                this.showConfigurationBanner(configValidation.missing);
            }
            
        } catch (error) {
            console.error('Error refreshing workspace configuration:', error);
            this.showToast('Configuração salva, mas houve erro ao atualizar o workspace', 'warning', 4000);
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
     * Validate HTTPS URL format
     * @param {string} url - URL to validate
     * @returns {boolean} - True if valid HTTPS URL
     */
    isValidHttpsUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }

    /**
     * Real-time validation for serverless endpoint URL
     * @param {HTMLElement} field - The input field element
     */
    validateServerlessEndpointRealTime(field) {
        if (!field || typeof field.closest !== 'function') return;

        const formField = field.closest('.form-field');
        if (!formField) return;

        const value = field.value.trim();

        // Clear previous states
        formField.classList.remove('error', 'success');

        // Don't validate empty field in real-time
        if (!value) return;

        let isValid = true;
        let errorMessage = '';

        // Check if URL starts with https://
        if (!value.startsWith('https://')) {
            isValid = false;
            errorMessage = 'URL deve começar com "https://"';
        } else {
            // Check if it's a valid URL format
            try {
                new URL(value);
                // Additional validation for common endpoint patterns
                if (value.length < 12) { // https:// is 8 chars, need at least domain
                    isValid = false;
                    errorMessage = 'URL muito curta. Inclua o domínio completo.';
                } else if (!value.includes('.')) {
                    isValid = false;
                    errorMessage = 'URL deve incluir um domínio válido';
                }
            } catch {
                isValid = false;
                errorMessage = 'Formato de URL inválido';
            }
        }

        // Apply validation state immediately
        if (!isValid) {
            formField.classList.add('error');
            const errorElement = formField.querySelector('.error-message');
            if (errorElement) {
                errorElement.textContent = errorMessage;
            }
        } else {
            formField.classList.add('success');
        }
    }

    /**
     * Show configuration guidance for serverless endpoint setup
     */
    showServerlessConfigurationGuidance() {
        const guidanceMessage = `
            <strong>Configuração do Endpoint Serverless</strong><br>
            Para usar a integração automática:<br>
            1. Configure um endpoint serverless (Cloudflare Worker, Vercel, etc.)<br>
            2. O endpoint deve aceitar POST requests com JSON<br>
            3. Insira a URL completa começando com https://<br>
            4. Teste a configuração enviando um extrato
        `;

        this.showToastWithAction(
            guidanceMessage,
            'info',
            12000,
            'Configurar Agora',
            () => this.navigate('settings')
        );
    }

    /**
     * Load configuration defaults from defaults.js when settings are missing
     */
    async loadConfigurationDefaults() {
        try {
            // Import defaults dynamically
            const { DEFAULT_CONFIG, getDefaultBaseUrl } = await import('../config/defaults.js');
            
            // Check if we need to load defaults
            const currentSettings = await getSetting('app-settings');
            
            if (!currentSettings || !currentSettings.language || !currentSettings.country) {
                console.log('Loading configuration defaults...');
                
                // Create default settings object
                const defaultSettings = {
                    language: DEFAULT_CONFIG.language,
                    country: DEFAULT_CONFIG.defaultCountry,
                    baseUrl: getDefaultBaseUrl(DEFAULT_CONFIG.defaultCountry),
                    ...currentSettings // Preserve any existing settings
                };
                
                // Save defaults to IndexedDB
                await setSetting('app-settings', defaultSettings);
                
                console.log('Configuration defaults loaded:', defaultSettings);
                return defaultSettings;
            }
            
            // If baseUrl is missing but country exists, set the appropriate baseUrl
            if (currentSettings && currentSettings.country && !currentSettings.baseUrl) {
                currentSettings.baseUrl = getDefaultBaseUrl(currentSettings.country);
                await setSetting('app-settings', currentSettings);
                console.log('Base URL set from defaults for country:', currentSettings.country);
            }
            
            return currentSettings;
        } catch (error) {
            console.error('Error loading configuration defaults:', error);
            this.handleGlobalError(error, 'Configuration defaults loading');
            return null;
        }
    }

    /**
     * Validate required configuration settings
     * @returns {Object} Validation result with isValid flag and missing settings
     */
    async validateRequiredSettings() {
        try {
            let settings = await getSetting('app-settings');
            
            // If no settings exist, try to load defaults
            if (!settings) {
                console.log('No settings found, loading defaults...');
                settings = await this.loadConfigurationDefaults();
            }
            
            const missing = [];
            
            // Check required settings
            if (!settings) {
                return {
                    isValid: false,
                    missing: ['language', 'country', 'baseUrl'],
                    settings: null
                };
            }
            
            if (!settings.language) {
                missing.push('language');
            }
            
            if (!settings.country) {
                missing.push('country');
            }
            
            if (!settings.baseUrl) {
                missing.push('baseUrl');
            }
            
            const isValid = missing.length === 0;
            
            console.debug('Configuration validation:', {
                isValid,
                missing,
                hasSettings: !!settings
            });
            
            return {
                isValid,
                missing,
                settings
            };
        } catch (error) {
            console.error('Error validating configuration:', error);
            return {
                isValid: false,
                missing: ['language', 'country', 'baseUrl'],
                settings: null,
                error: error.message
            };
        }
    }

    /**
     * Show configuration banner for incomplete settings
     * @param {Array} missingSettings - Array of missing setting names
     */
    showConfigurationBanner(missingSettings) {
        // Remove any existing configuration banner
        this.removeConfigurationBanner();
        
        // Create banner element
        const banner = document.createElement('div');
        banner.id = 'configuration-banner';
        banner.className = 'configuration-banner warning-banner';
        banner.setAttribute('role', 'alert');
        banner.setAttribute('aria-live', 'polite');
        
        const missingText = missingSettings.length > 1 
            ? `configurações obrigatórias (${missingSettings.join(', ')})` 
            : `configuração obrigatória (${missingSettings[0]})`;
        
        banner.innerHTML = `
            <div class="banner-content">
                <div class="banner-icon">⚠️</div>
                <div class="banner-message">
                    <strong>Configuração incompleta</strong><br>
                    Faltam ${missingText} para carregar os documentos.
                </div>
                <button class="banner-action" id="open-settings-from-banner">
                    Abrir Configurações
                </button>
                <button class="banner-close" id="close-configuration-banner" aria-label="Fechar aviso">
                    ×
                </button>
            </div>
        `;
        
        // Insert banner at the top of workspace content
        const workspaceContent = document.querySelector('#workspace-view .workspace-content');
        if (workspaceContent) {
            workspaceContent.insertBefore(banner, workspaceContent.firstChild);
        }
        
        // Add event listeners
        const openSettingsBtn = banner.querySelector('#open-settings-from-banner');
        const closeBannerBtn = banner.querySelector('#close-configuration-banner');
        
        if (openSettingsBtn) {
            openSettingsBtn.addEventListener('click', () => {
                this.showModal('settings');
            });
        }
        
        if (closeBannerBtn) {
            closeBannerBtn.addEventListener('click', () => {
                this.removeConfigurationBanner();
            });
        }
        
        // Disable document controls while configuration is incomplete
        this.disableDocumentControls();
        
        console.log('Configuration banner shown for missing settings:', missingSettings);
    }

    /**
     * Remove configuration banner
     */
    removeConfigurationBanner() {
        const banner = document.getElementById('configuration-banner');
        if (banner) {
            banner.remove();
            console.log('Configuration banner removed');
        }
        
        // Re-enable document controls
        this.enableDocumentControls();
    }

    /**
     * Disable document controls when configuration is incomplete
     */
    disableDocumentControls() {
        const documentSelect = document.getElementById('document-select');
        const searchInput = document.getElementById('search-term');
        
        if (documentSelect) {
            documentSelect.disabled = true;
            documentSelect.innerHTML = '<option value="">Configure as configurações primeiro...</option>';
        }
        
        if (searchInput) {
            searchInput.disabled = true;
            searchInput.placeholder = 'Configure as configurações primeiro...';
        }
        
        console.log('Document controls disabled due to incomplete configuration');
    }

    /**
     * Enable document controls when configuration is complete
     */
    enableDocumentControls() {
        const documentSelect = document.getElementById('document-select');
        const searchInput = document.getElementById('search-term');
        
        if (documentSelect) {
            documentSelect.disabled = false;
        }
        
        if (searchInput) {
            searchInput.disabled = false;
            searchInput.placeholder = 'Digite um termo para buscar';
        }
        
        console.log('Document controls enabled');
    }

    /**
     * Trigger settings modal automatically when configuration is incomplete
     * @param {Array} missingSettings - Array of missing setting names
     */
    async triggerSettingsModalForIncompleteConfig(missingSettings) {
        console.log('Auto-triggering settings modal for incomplete configuration:', missingSettings);
        
        // Show a toast explaining why settings modal is opening
        this.showToast(
            'Abrindo configurações para completar a configuração obrigatória...',
            'info',
            3000
        );
        
        // Wait a moment for the toast to be visible
        setTimeout(() => {
            this.showModal('settings');
        }, 500);
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
            'settings-serverless-endpoint'
        ];

        formFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                // Real-time validation for serverless endpoint (on input)
                if (fieldId === 'settings-serverless-endpoint') {
                    field.addEventListener('input', () => {
                        this.validateServerlessEndpointRealTime(field);
                    });
                }

                // Auto-set baseUrl when country changes
                if (fieldId === 'settings-country') {
                    field.addEventListener('change', async () => {
                        await this.updateBaseUrlFromCountry(field.value);
                    });
                }

                // Validate on blur (when user leaves the field)
                field.addEventListener('blur', () => {
                    this.validateSingleField(fieldId);
                });

                // Clear validation on focus (when user starts typing)
                field.addEventListener('focus', () => {
                    if (typeof field.closest === 'function') {
                        const formField = field.closest('.form-field');
                        if (formField) {
                            formField.classList.remove('error', 'success');
                        }
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
        if (!field || typeof field.closest !== 'function') return;

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

            case 'settings-serverless-endpoint':
                if (value && !this.isValidHttpsUrl(value)) {
                    isValid = false;
                    errorMessage = 'URL deve começar com "https://"';
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
     * Update base URL when country selection changes
     * @param {string} countryCode - The selected country code
     */
    async updateBaseUrlFromCountry(countryCode) {
        if (!countryCode) return;
        
        try {
            // Import defaults dynamically
            const { getDefaultBaseUrl } = await import('../config/defaults.js');
            
            // Get the default base URL for the selected country
            const baseUrl = getDefaultBaseUrl(countryCode);
            
            // Update the hidden corpus URL field
            const corpusUrlField = document.getElementById('settings-corpus-url');
            if (corpusUrlField) {
                corpusUrlField.value = baseUrl;
                console.log(`Base URL updated for country ${countryCode}:`, baseUrl);
            }
            
        } catch (error) {
            console.error('Error updating base URL from country:', error);
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
    /**
     * Preview markdown for the selected item
     */
    async previewMarkdown() {
        if (!this.selectedQueueItem) {
            this.showToast('Nenhum item selecionado', 'error');
            return;
        }

        // Validate form first
        const fields = ['edit-title', 'edit-content'];
        let isValid = true;

        fields.forEach(fieldId => {
            if (!this.validateEditorField(fieldId)) {
                isValid = false;
            }
        });

        if (!isValid) {
            this.showToast('Por favor, corrija os erros obrigatórios no formulário', 'error');
            return;
        }

        try {
            // Get current form data
            const formData = {
                title: document.getElementById('edit-title').value.trim(),
                jurisdiction: document.getElementById('edit-jurisdiction').value.trim(),
                lang: document.getElementById('edit-language').value,
                url: document.getElementById('edit-source-url').value.trim(),
                versionDate: document.getElementById('edit-version-date').value,
                content: document.getElementById('edit-content').value.trim()
            };

            // Generate markdown using md-builder utility
            const { buildMarkdown } = await import('../util/md-builder.js');

            const markdownData = {
                title: formData.title,
                jurisdiction: formData.jurisdiction,
                language: formData.lang,
                sourceUrl: formData.url,
                versionDate: formData.versionDate || new Date().toISOString().split('T')[0],
                content: formData.content
            };

            const markdown = buildMarkdown(markdownData);

            // Show markdown preview modal
            this.showMarkdownPreview(markdown, formData);

        } catch (error) {
            console.error('Error generating markdown preview:', error);
            this.showToast('Erro ao gerar preview do markdown', 'error');
        }
    }

    /**
     * Show markdown preview modal
     * @param {string} markdown - Generated markdown content
     * @param {Object} formData - Form data used to generate markdown
     */
    showMarkdownPreview(markdown, formData) {
        // Create modal if it doesn't exist
        if (!document.getElementById('markdown-preview-modal')) {
            const modalHtml = `
                <div id="markdown-preview-modal" class="modal-overlay">
                    <div class="modal" style="max-width: 800px; width: 95%;">
                        <div class="modal-header">
                            <h3>Preview do Markdown</h3>
                            <button class="modal-close" onclick="app.hideModal('markdown-preview')">&times;</button>
                        </div>
                        <div id="markdown-preview-content"></div>
                        <div class="modal-actions">
                            <button type="button" class="primary" onclick="app.copyMarkdownToClipboard()">
                                📋 Copiar Markdown
                            </button>
                            <button type="button" class="secondary" onclick="app.downloadMarkdown()">
                                💾 Baixar Arquivo
                            </button>
                            <button type="button" class="secondary" onclick="app.hideModal('markdown-preview')">
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
        }

        // Update content
        const content = document.getElementById('markdown-preview-content');
        content.innerHTML = `
            <div class="markdown-preview">
                <h4>Arquivo: ${formData.title.toLowerCase().replace(/\s+/g, '-')}.md</h4>
                <pre><code>${this.escapeHtml(markdown)}</code></pre>
            </div>
        `;

        // Store markdown for copying/downloading
        this.currentMarkdown = markdown;
        this.currentMarkdownFilename = `${formData.title.toLowerCase().replace(/\s+/g, '-')}.md`;

        // Show modal
        this.showModal('markdown-preview');

        // Add CSS for markdown preview
        this.addMarkdownPreviewCSS();
    }

    /**
     * Copy markdown to clipboard
     */
    async copyMarkdownToClipboard() {
        if (!this.currentMarkdown) {
            this.showToast('Nenhum markdown para copiar', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(this.currentMarkdown);
            this.showToast('Markdown copiado para a área de transferência!', 'success');
        } catch (error) {
            console.error('Error copying to clipboard:', error);

            // Fallback: create temporary textarea
            const textarea = document.createElement('textarea');
            textarea.value = this.currentMarkdown;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);

            this.showToast('Markdown copiado para a área de transferência!', 'success');
        }
    }

    /**
     * Download markdown as file
     */
    downloadMarkdown() {
        if (!this.currentMarkdown) {
            this.showToast('Nenhum markdown para baixar', 'error');
            return;
        }

        try {
            const blob = new Blob([this.currentMarkdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = this.currentMarkdownFilename || 'documento.md';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);

            this.showToast('Arquivo markdown baixado!', 'success');
        } catch (error) {
            console.error('Error downloading markdown:', error);
            this.showToast('Erro ao baixar arquivo', 'error');
        }
    }

    /**
     * Escape HTML characters for display
     * @param {string} text - Text to escape
     * @returns {string} - Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Add CSS for markdown preview modal
     */
    addMarkdownPreviewCSS() {
        if (document.getElementById('markdown-preview-css')) return;

        const style = document.createElement('style');
        style.id = 'markdown-preview-css';
        style.textContent = `
            .markdown-preview {
                max-height: 60vh;
                overflow-y: auto;
                border: 1px solid var(--pico-muted-border-color);
                border-radius: var(--pico-border-radius);
                padding: 1rem;
                background: var(--pico-card-background-color);
            }
            
            .markdown-preview h4 {
                margin-top: 0;
                margin-bottom: 1rem;
                color: var(--pico-primary-color);
                font-family: monospace;
            }
            
            .markdown-preview pre {
                margin: 0;
                padding: 1rem;
                background: var(--pico-code-background-color);
                border-radius: var(--pico-border-radius);
                overflow-x: auto;
                font-size: 0.9rem;
                line-height: 1.4;
            }
            
            .markdown-preview code {
                background: transparent;
                padding: 0;
                font-family: 'Courier New', Consolas, monospace;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            
            .modal-actions {
                display: flex;
                gap: 0.5rem;
                justify-content: flex-end;
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid var(--pico-muted-border-color);
            }
            
            .modal-actions button {
                min-width: 120px;
            }
            
            @media (max-width: 600px) {
                .modal-actions {
                    flex-direction: column;
                }
                
                .modal-actions button {
                    width: 100%;
                }
            }
        `;

        document.head.appendChild(style);
    }


    /**
     * Get serverless endpoint from settings
     * @returns {string|null} - Serverless endpoint URL or null
     */
    async getServerlessEndpoint() {
        try {
            // Try to load from current settings structure first
            const settings = await this.loadSettings();
            if (settings && settings.serverlessEndpoint) {
                return settings.serverlessEndpoint;
            }

            // Fallback to direct setting lookup
            try {
                return await getSetting('serverlessEndpoint');
            } catch (error) {
                console.warn('Failed to load serverless endpoint from IndexedDB:', error);
            }
        } catch (error) {
            console.error('Error getting serverless endpoint:', error);
        }
        return null;
    }

















    /**
     * Handle global keyboard shortcuts and navigation
     * @param {KeyboardEvent} e - Keyboard event
     */
    handleGlobalKeyboard(e) {
        // Skip if user is typing in an input field
        if (e.target.matches('input, textarea, select, [contenteditable]')) {
            return;
        }

        // Handle keyboard shortcuts
        if (e.ctrlKey || e.metaKey) {
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
                case ',':
                    e.preventDefault();
                    this.navigate('settings');
                    break;
            }
        }

        // Handle escape key
        if (e.key === 'Escape') {
            // Close any open modals
            const openModal = document.querySelector('.modal-overlay.active');
            if (openModal) {
                const modalName = openModal.id.replace('-modal', '');
                this.hideModal(modalName);
                return;
            }

            // Navigate to home if not already there
            if (this.currentView !== 'home') {
                this.navigate('home');
            }
        }

        // Handle arrow keys for workspace steps
        if (this.currentView === 'workspace') {
            if (e.key === 'ArrowLeft' && this.currentStep > 1) {
                e.preventDefault();
                this.goToWorkspaceStep(this.currentStep - 1);
            } else if (e.key === 'ArrowRight' && this.currentStep < 2) {
                e.preventDefault();
                this.goToWorkspaceStep(this.currentStep + 1);
            }
        }

        // Handle tab navigation with Alt key
        if (e.altKey) {
            const views = ['home', 'workspace', 'collector'];
            const currentIndex = views.indexOf(this.currentView);

            if (e.key === 'ArrowLeft' && currentIndex > 0) {
                e.preventDefault();
                this.navigate(views[currentIndex - 1]);
            } else if (e.key === 'ArrowRight' && currentIndex < views.length - 1) {
                e.preventDefault();
                this.navigate(views[currentIndex + 1]);
            }
        }
    }

    /**
     * Initialize workspace step completion tracking
     */
    initWorkspaceStepTracking() {
        if (!this.workspaceStepCompleted) {
            this.workspaceStepCompleted = {
                1: false,
                2: false
            };
        }
    }

    /**
     * Enhanced form validation with accessibility
     * @param {HTMLFormElement} form - Form to validate
     * @returns {boolean} - True if form is valid
     */
    validateFormWithAccessibility(form) {
        let isValid = true;
        const firstErrorField = null;

        // Clear previous validation states
        form.querySelectorAll('.form-field').forEach(field => {
            field.classList.remove('error', 'success');
        });

        // Validate required fields
        form.querySelectorAll('[required]').forEach(field => {
            if (typeof field.closest !== 'function') return;
            const formField = field.closest('.form-field');
            const errorMessage = formField?.querySelector('.error-message');

            if (!field.value.trim()) {
                isValid = false;
                formField?.classList.add('error');
                field.setAttribute('aria-invalid', 'true');

                if (errorMessage) {
                    errorMessage.textContent = `${field.labels[0]?.textContent || 'Campo'} é obrigatório`;
                }

                if (!firstErrorField) {
                    firstErrorField = field;
                }
            } else {
                formField?.classList.add('success');
                field.setAttribute('aria-invalid', 'false');
            }
        });

        // Validate URL fields
        form.querySelectorAll('input[type="url"]').forEach(field => {
            if (typeof field.closest !== 'function') return;
            const formField = field.closest('.form-field');
            const errorMessage = formField?.querySelector('.error-message');

            if (field.value && !this.isValidUrl(field.value)) {
                isValid = false;
                formField?.classList.add('error');
                field.setAttribute('aria-invalid', 'true');

                if (errorMessage) {
                    errorMessage.textContent = 'URL inválida';
                }

                if (!firstErrorField) {
                    firstErrorField = field;
                }
            }
        });

        // Focus first error field and announce errors
        if (!isValid && firstErrorField) {
            firstErrorField.focus();
            this.announceToScreenReader('Formulário contém erros. Verifique os campos destacados.');
        } else if (isValid) {
            this.announceToScreenReader('Formulário válido');
        }

        return isValid;
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
     * Add real-time validation to form fields
     * @param {HTMLElement} container - Container with form fields
     */
    addRealTimeValidation(container) {
        container.querySelectorAll('input, select, textarea').forEach(field => {
            // Validate on blur
            field.addEventListener('blur', () => {
                this.validateSingleField(field);
            });

            // Clear error state on input
            field.addEventListener('input', () => {
                if (typeof field.closest === 'function') {
                    const formField = field.closest('.form-field');
                    if (formField?.classList.contains('error')) {
                        formField.classList.remove('error');
                    }
                    field.setAttribute('aria-invalid', 'false');
                }
            });
        });
    }

    /**
     * Validate single form field
     * @param {HTMLElement} field - Field to validate
     */
    validateSingleField(field) {
        if (!field || typeof field.closest !== 'function') return true;

        const formField = field.closest('.form-field');
        const errorMessage = formField?.querySelector('.error-message');
        let isValid = true;
        let message = '';

        // Required field validation
        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
            message = `${field.labels[0]?.textContent || 'Campo'} é obrigatório`;
        }

        // URL validation
        if (field.type === 'url' && field.value && !this.isValidUrl(field.value)) {
            isValid = false;
            message = 'URL inválida';
        }

        // Update field state
        if (isValid) {
            formField?.classList.remove('error');
            formField?.classList.add('success');
            field.setAttribute('aria-invalid', 'false');
        } else {
            formField?.classList.remove('success');
            formField?.classList.add('error');
            field.setAttribute('aria-invalid', 'true');

            if (errorMessage) {
                errorMessage.textContent = message;
            }
        }

        return isValid;
    }

    /**
     * Mark workspace step as completed
     * @param {number} step - Step number to mark as completed
     */
    markWorkspaceStepCompleted(step) {
        this.initWorkspaceStepTracking();
        this.workspaceStepCompleted[step] = true;
        this.updateNavigationBadges();

        // Update step visual state
        const stepElement = document.querySelector(`.step[data-step="${step}"]`);
        if (stepElement) {
            stepElement.classList.add('completed');
        }
    }


}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new LexFlowApp();
});

// Export for global access
window.LexFlowApp = LexFlowApp;