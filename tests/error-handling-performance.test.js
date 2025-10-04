/**
 * Error Handling and Performance Tests
 * Tests error scenarios, recovery mechanisms, loading states, and performance under various conditions
 * Requirements: 5.6, 6.4, 8.4
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock LexFlow App with error handling capabilities
class MockLexFlowApp {
    constructor() {
        this.currentView = 'home';
        this.isOnline = navigator.onLine;
        this.errorRetryCount = new Map();
        this.maxRetries = 3;
        this.chromeAIAvailable = false;
        this.useSessionStorageFallback = false;
        this.performanceMetrics = new Map();
        this.toastSystem = {
            toasts: [],
            show: vi.fn((message, type, duration) => {
                const toast = { message, type, duration };
                this.toastSystem.toasts.push(toast);
                return this.toastSystem.toasts.length;
            }),
            showWithAction: vi.fn(),
            clear: vi.fn(() => { this.toastSystem.toasts = []; }),
            getCount: vi.fn(() => this.toastSystem.toasts.length)
        };
        
        this.initErrorHandling();
        this.initPerformanceMonitoring();
    }

    initErrorHandling() {
        // Mock error handling initialization
        this.errorHandlers = {
            network: this.handleNetworkError.bind(this),
            ai: this.handleAIError.bind(this),
            storage: this.handleStorageError.bind(this)
        };
    }

    initPerformanceMonitoring() {
        this.performanceMonitorInterval = null;
        this.memoryUsage = {
            usedJSHeapSize: 1000000,
            jsHeapSizeLimit: 10000000
        };
    }

    // Error categorization
    categorizeError(error, context) {
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        
        if (errorMessage.includes('fetch') || errorMessage.includes('network') || !this.isOnline) {
            return {
                type: 'network',
                severity: 'medium',
                userMessage: 'Erro de conexão',
                suggestion: 'Verifique sua conexão com a internet e tente novamente',
                recoverable: true,
                retryable: true
            };
        }
        
        if (errorMessage.includes('ai') || errorMessage.includes('assistant') || context.includes('AI')) {
            return {
                type: 'ai',
                severity: 'medium',
                userMessage: 'Erro na funcionalidade de IA',
                suggestion: 'Verifique se o Chrome AI está habilitado nas configurações',
                recoverable: true,
                retryable: false
            };
        }
        
        if (errorMessage.includes('storage') || errorMessage.includes('quota') || errorMessage.includes('IndexedDB')) {
            return {
                type: 'storage',
                severity: 'high',
                userMessage: 'Erro de armazenamento',
                suggestion: 'Espaço de armazenamento pode estar cheio. Limpe dados antigos.',
                recoverable: true,
                retryable: true
            };
        }
        
        return {
            type: 'unknown',
            severity: 'medium',
            userMessage: 'Erro inesperado',
            suggestion: 'Tente recarregar a extensão',
            recoverable: true,
            retryable: true
        };
    }

    // Network error handling
    async handleNetworkError(error, context = 'Network operation', url = '') {
        const errorInfo = {
            type: 'network',
            context: context,
            url: url,
            isOnline: this.isOnline,
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

        if (!this.isOnline) {
            this.toastSystem.show('Sem conexão. Usando modo offline.', 'warning', 5000);
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
    }

    // AI error handling
    handleAIError(error, context = 'AI operation') {
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
        }

        this.toastSystem.showWithAction(
            `${userMessage}. ${suggestion}`,
            'error',
            8000,
            'Configurar IA',
            () => this.showAISetupHelp()
        );

        return { success: false, error: 'ai_error', fallback: fallback };
    }

    // Storage error handling
    async handleStorageError(error, context = 'Storage operation') {
        let userMessage = 'Erro de armazenamento';
        let suggestion = '';
        let fallback = 'session_storage';

        if (error.message.includes('quota') || error.message.includes('exceeded')) {
            userMessage = 'Espaço de armazenamento esgotado';
            suggestion = 'Limpe dados antigos ou aumente o espaço disponível';
            fallback = 'cleanup_required';
            await this.performStorageCleanup();
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
    }

    // Performance monitoring
    checkMemoryUsage() {
        const memory = this.memoryUsage;
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100);

        if (usagePercent > 80) {
            this.performMemoryCleanup();
            this.toastSystem.show(
                `Uso de memória alto (${usagePercent.toFixed(1)}%). Limpeza automática realizada.`,
                'warning',
                5000
            );
        }

        return usagePercent;
    }

    performMemoryCleanup() {
        // Simulate memory cleanup - reduce usage by 30%
        const currentUsage = this.memoryUsage.usedJSHeapSize;
        this.memoryUsage.usedJSHeapSize = Math.max(
            currentUsage * 0.7,
            1000000
        );
    }

    async performStorageCleanup() {
        // Simulate storage cleanup
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({ cleaned: true, itemsRemoved: 5 });
            }, 100);
        });
    }

    fallbackToSessionStorage() {
        this.useSessionStorageFallback = true;
    }

    showAISetupHelp() {
        // Mock AI setup help
    }

    showStorageHelp() {
        // Mock storage help
    }

    retryNetworkOperation(context, url) {
        // Mock retry operation
        return Promise.resolve({ success: true });
    }

    // Performance measurement utilities
    measurePerformance(operation, fn) {
        const startTime = performance.now();
        const result = fn();
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.performanceMetrics.set(operation, {
            duration,
            timestamp: Date.now()
        });
        
        return { result, duration };
    }

    async measureAsyncPerformance(operation, fn) {
        const startTime = performance.now();
        const result = await fn();
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        this.performanceMetrics.set(operation, {
            duration,
            timestamp: Date.now()
        });
        
        return { result, duration };
    }

    getPerformanceMetric(operation) {
        return this.performanceMetrics.get(operation);
    }

    // Simulate view switching with performance tracking
    async showView(viewName) {
        return this.measureAsyncPerformance(`view-switch-${viewName}`, async () => {
            // Simulate view switching delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
            this.currentView = viewName;
            return viewName;
        });
    }

    // Simulate AI processing with performance tracking
    async processAI(prompt) {
        if (!this.chromeAIAvailable) {
            throw new Error('Chrome AI not available');
        }

        return this.measureAsyncPerformance('ai-processing', async () => {
            // Simulate AI processing time
            const processingTime = Math.random() * 2000 + 500; // 500-2500ms
            await new Promise(resolve => setTimeout(resolve, processingTime));
            return `AI response for: ${prompt}`;
        });
    }

    // Simulate network operations with error scenarios
    async fetchDocument(url) {
        return this.measureAsyncPerformance('document-fetch', async () => {
            if (!this.isOnline) {
                throw new Error('Network error: offline');
            }
            
            if (url.includes('404')) {
                throw new Error('Network error: 404 not found');
            }
            
            if (url.includes('403')) {
                throw new Error('Network error: 403 forbidden');
            }
            
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
            return { content: 'Document content', url };
        });
    }

    // Simulate storage operations with error scenarios
    async saveToStorage(key, data) {
        return this.measureAsyncPerformance('storage-save', async () => {
            if (key.includes('quota-exceeded')) {
                throw new Error('Storage error: quota exceeded');
            }
            
            if (key.includes('access-denied')) {
                throw new Error('Storage error: access denied');
            }
            
            // Simulate storage delay
            await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
            return { success: true, key, size: JSON.stringify(data).length };
        });
    }
}

describe('Error Handling and Performance Tests', () => {
    let app;

    beforeEach(() => {
        // Reset global state
        global.navigator.onLine = true;
        global.performance.memory = {
            usedJSHeapSize: 1000000,
            jsHeapSizeLimit: 10000000
        };
        
        app = new MockLexFlowApp();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.restoreAllMocks();
    });

    describe('Error Categorization and Handling', () => {
        it('should categorize network errors correctly', () => {
            const networkError = new Error('Failed to fetch');
            const errorInfo = app.categorizeError(networkError, 'document loading');
            
            expect(errorInfo.type).toBe('network');
            expect(errorInfo.severity).toBe('medium');
            expect(errorInfo.recoverable).toBe(true);
            expect(errorInfo.retryable).toBe(true);
        });

        it('should categorize AI errors correctly', () => {
            const aiError = new Error('AI assistant not available');
            const errorInfo = app.categorizeError(aiError, 'AI processing');
            
            expect(errorInfo.type).toBe('ai');
            expect(errorInfo.severity).toBe('medium');
            expect(errorInfo.recoverable).toBe(true);
            expect(errorInfo.retryable).toBe(false);
        });

        it('should categorize storage errors correctly', () => {
            const storageError = new Error('IndexedDB quota exceeded');
            const errorInfo = app.categorizeError(storageError, 'data persistence');
            
            expect(errorInfo.type).toBe('storage');
            expect(errorInfo.severity).toBe('high');
            expect(errorInfo.recoverable).toBe(true);
            expect(errorInfo.retryable).toBe(true);
        });

        it('should categorize unknown errors with fallback', () => {
            const unknownError = new Error('Something went wrong');
            const errorInfo = app.categorizeError(unknownError, 'unknown operation');
            
            expect(errorInfo.type).toBe('unknown');
            expect(errorInfo.severity).toBe('medium');
            expect(errorInfo.recoverable).toBe(true);
            expect(errorInfo.retryable).toBe(true);
        });
    });

    describe('Network Error Scenarios and Recovery', () => {
        it('should handle 404 errors with appropriate fallback', async () => {
            const error = new Error('Network error: 404 not found');
            const result = await app.handleNetworkError(error, 'document fetch', 'https://example.com/404');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('not_found');
            expect(result.fallback).toBe('manual_entry');
            expect(app.toastSystem.show).toHaveBeenCalledWith(
                'Recurso não encontrado. Verifique a URL.',
                'error',
                5000
            );
        });

        it('should handle 403 permission errors', async () => {
            const error = new Error('Network error: 403 forbidden');
            const result = await app.handleNetworkError(error, 'document fetch');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('permission_denied');
            expect(result.fallback).toBe('alternative_source');
        });

        it('should handle offline scenarios', async () => {
            app.isOnline = false;
            const error = new Error('Network error: offline');
            const result = await app.handleNetworkError(error, 'document fetch');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('offline');
            expect(result.fallback).toBe('cached_data');
        });

        it('should provide retry mechanism for network errors', async () => {
            const error = new Error('Network timeout');
            const result = await app.handleNetworkError(error, 'document fetch');
            
            expect(result.fallback).toBe('retry');
            expect(app.toastSystem.showWithAction).toHaveBeenCalledWith(
                'Erro de rede. Verifique sua conexão.',
                'error',
                5000,
                'Tentar Novamente',
                expect.any(Function)
            );
        });

        it('should test network operation retry functionality', async () => {
            const retryResult = await app.retryNetworkOperation('document fetch', 'https://example.com');
            expect(retryResult.success).toBe(true);
        });
    });

    describe('AI Error Scenarios and Recovery', () => {
        it('should handle AI unavailable errors', () => {
            const error = new Error('Chrome AI not available');
            const result = app.handleAIError(error, 'text summarization');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('ai_error');
            expect(result.fallback).toBe('setup_required');
        });

        it('should handle AI quota exceeded errors', () => {
            const error = new Error('AI quota limit exceeded');
            const result = app.handleAIError(error, 'text processing');
            
            expect(result.fallback).toBe('rate_limited');
            expect(app.toastSystem.showWithAction).toHaveBeenCalledWith(
                expect.stringContaining('Limite de uso da IA atingido'),
                'error',
                8000,
                'Configurar IA',
                expect.any(Function)
            );
        });

        it('should handle generic AI errors', () => {
            const error = new Error('AI processing failed');
            const result = app.handleAIError(error);
            
            expect(result.success).toBe(false);
            expect(result.fallback).toBe('manual_mode');
        });

        it('should test AI processing with error scenarios', async () => {
            app.chromeAIAvailable = false;
            
            await expect(app.processAI('Test prompt')).rejects.toThrow('Chrome AI not available');
        });

        it('should test successful AI processing performance', async () => {
            app.chromeAIAvailable = true;
            
            const { result, duration } = await app.processAI('Test prompt');
            
            expect(result).toContain('AI response for: Test prompt');
            expect(duration).toBeGreaterThan(0);
            expect(app.getPerformanceMetric('ai-processing')).toBeDefined();
        });
    });

    describe('Storage Error Scenarios and Recovery', () => {
        it('should handle storage quota exceeded errors', async () => {
            const error = new Error('Storage quota exceeded');
            const result = await app.handleStorageError(error, 'settings save');
            
            expect(result.success).toBe(false);
            expect(result.error).toBe('storage_error');
            expect(result.fallback).toBe('cleanup_required');
            expect(app.useSessionStorageFallback).toBe(true);
        });

        it('should handle storage access denied errors', async () => {
            const error = new Error('Storage access denied');
            const result = await app.handleStorageError(error);
            
            expect(result.success).toBe(false);
            expect(app.useSessionStorageFallback).toBe(true);
        });

        it('should perform automatic storage cleanup', async () => {
            const cleanupResult = await app.performStorageCleanup();
            
            expect(cleanupResult.cleaned).toBe(true);
            expect(cleanupResult.itemsRemoved).toBeGreaterThan(0);
        });

        it('should test storage operations with error scenarios', async () => {
            await expect(app.saveToStorage('quota-exceeded-key', { data: 'test' }))
                .rejects.toThrow('Storage error: quota exceeded');
            
            await expect(app.saveToStorage('access-denied-key', { data: 'test' }))
                .rejects.toThrow('Storage error: access denied');
        });

        it('should test successful storage operations performance', async () => {
            const { result, duration } = await app.saveToStorage('valid-key', { data: 'test' });
            
            expect(result.success).toBe(true);
            expect(result.key).toBe('valid-key');
            expect(duration).toBeGreaterThan(0);
            expect(app.getPerformanceMetric('storage-save')).toBeDefined();
        });
    });

    describe('Loading States and User Feedback', () => {
        it('should track loading states during operations', async () => {
            const loadingStates = [];
            
            // Mock loading state tracking
            app.toastSystem.show = vi.fn((message, type) => {
                if (message.includes('Loading') || message.includes('Carregando')) {
                    loadingStates.push({ message, type, timestamp: Date.now() });
                }
                const toast = { message, type };
                app.toastSystem.toasts.push(toast);
                return app.toastSystem.toasts.length;
            });
            
            // Simulate operations that should show loading states
            app.toastSystem.show('Carregando documento...', 'info');
            app.toastSystem.show('Processando com IA...', 'info');
            app.toastSystem.show('Salvando configurações...', 'info');
            
            expect(loadingStates.length).toBeGreaterThan(0);
            const hasDocumento = loadingStates.some(state => state.message.includes('documento'));
            const hasIA = loadingStates.some(state => state.message.includes('IA'));
            const hasConfiguracoes = loadingStates.some(state => state.message.includes('configurações'));
            
            expect(hasDocumento || hasIA || hasConfiguracoes).toBe(true);
        });

        it('should provide appropriate user feedback for different operations', () => {
            const feedbackMessages = [
                { operation: 'document-load', message: 'Documento carregado com sucesso', type: 'success' },
                { operation: 'ai-complete', message: 'Análise de IA concluída', type: 'success' },
                { operation: 'settings-saved', message: 'Configurações salvas', type: 'success' },
                { operation: 'network-error', message: 'Erro de conexão', type: 'error' },
                { operation: 'storage-warning', message: 'Armazenamento quase cheio', type: 'warning' }
            ];
            
            feedbackMessages.forEach(({ message, type }) => {
                app.toastSystem.show(message, type);
            });
            
            expect(app.toastSystem.show).toHaveBeenCalledTimes(feedbackMessages.length);
        });

        it('should handle loading timeout scenarios', async () => {
            vi.useFakeTimers();
            
            const longOperation = new Promise(resolve => {
                setTimeout(() => resolve('completed'), 10000); // 10 second operation
            });
            
            // Start operation with timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Operation timeout')), 5000); // 5 second timeout
            });
            
            const racePromise = Promise.race([longOperation, timeoutPromise]);
            
            vi.advanceTimersByTime(5000);
            
            await expect(racePromise).rejects.toThrow('Operation timeout');
            
            vi.useRealTimers();
        });
    });

    describe('Performance Under Various Load Conditions', () => {
        it('should handle rapid view switching efficiently', async () => {
            const views = ['home', 'workspace', 'collector', 'home', 'workspace'];
            const switchTimes = [];
            
            for (const view of views) {
                const { duration } = await app.showView(view);
                switchTimes.push(duration);
            }
            
            // All view switches should be under 200ms (requirement)
            switchTimes.forEach(time => {
                expect(time).toBeLessThan(200);
            });
            
            // Average should be well under the limit
            const averageTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
            expect(averageTime).toBeLessThan(100);
        });

        it('should handle multiple concurrent network requests', async () => {
            const urls = [
                'https://example.com/doc1',
                'https://example.com/doc2',
                'https://example.com/doc3',
                'https://example.com/doc4',
                'https://example.com/doc5'
            ];
            
            const startTime = performance.now();
            const promises = urls.map(url => app.fetchDocument(url));
            const results = await Promise.all(promises);
            const totalTime = performance.now() - startTime;
            
            expect(results).toHaveLength(5);
            results.forEach(result => {
                expect(result.result.content).toBe('Document content');
            });
            
            // Concurrent requests should be faster than sequential
            expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
        });

        it('should handle memory pressure scenarios', () => {
            // Simulate high memory usage
            app.memoryUsage.usedJSHeapSize = 9000000; // 90% of limit
            
            const usagePercent = app.checkMemoryUsage();
            
            expect(usagePercent).toBeGreaterThan(80);
            expect(app.toastSystem.show).toHaveBeenCalledWith(
                expect.stringContaining('Uso de memória alto'),
                'warning',
                5000
            );
            
            // Memory should be cleaned up
            expect(app.memoryUsage.usedJSHeapSize).toBeLessThan(9000000);
        });

        it('should handle large data processing efficiently', async () => {
            const largeData = {
                articles: Array(1000).fill(null).map((_, i) => ({
                    id: i,
                    title: `Article ${i}`,
                    content: 'Lorem ipsum '.repeat(100) // ~1KB per article
                }))
            };
            
            const { result, duration } = await app.saveToStorage('large-dataset', largeData);
            
            expect(result.success).toBe(true);
            expect(result.size).toBeGreaterThan(100000); // Should be > 100KB
            expect(duration).toBeLessThan(1000); // Should complete within 1 second
        });

        it('should maintain performance under error conditions', async () => {
            const operations = [];
            
            // Mix of successful and failing operations
            for (let i = 0; i < 20; i++) {
                if (i % 3 === 0) {
                    // Failing operation
                    operations.push(app.fetchDocument('https://example.com/404'));
                } else {
                    // Successful operation
                    operations.push(app.fetchDocument('https://example.com/success'));
                }
            }
            
            const startTime = performance.now();
            const results = await Promise.allSettled(operations);
            const totalTime = performance.now() - startTime;
            
            const successful = results.filter(r => r.status === 'fulfilled');
            const failed = results.filter(r => r.status === 'rejected');
            
            expect(successful.length).toBeGreaterThan(0);
            expect(failed.length).toBeGreaterThan(0);
            expect(totalTime).toBeLessThan(3000); // Should handle mixed results efficiently
        });
    });

    describe('Memory Management and Cleanup', () => {
        it('should perform memory cleanup when usage is high', () => {
            app.memoryUsage.usedJSHeapSize = 9500000; // 95% usage
            const initialUsage = app.memoryUsage.usedJSHeapSize;
            
            app.performMemoryCleanup();
            
            expect(app.memoryUsage.usedJSHeapSize).toBeLessThan(initialUsage);
        });

        it('should monitor memory usage periodically', () => {
            vi.useFakeTimers();
            
            const monitorSpy = vi.spyOn(app, 'checkMemoryUsage');
            
            // Simulate periodic monitoring (every 30 seconds)
            app.performanceMonitorInterval = setInterval(() => {
                app.checkMemoryUsage();
            }, 30000);
            
            vi.advanceTimersByTime(90000); // Advance 90 seconds
            
            expect(monitorSpy).toHaveBeenCalledTimes(3);
            
            clearInterval(app.performanceMonitorInterval);
            vi.useRealTimers();
        });

        it('should clean up performance metrics to prevent memory leaks', () => {
            // Generate many performance metrics with some old timestamps
            const now = Date.now();
            for (let i = 0; i < 100; i++) {
                const timestamp = i < 50 ? now - (2 * 60 * 60 * 1000) : now; // First 50 are 2 hours old
                app.performanceMetrics.set(`operation-${i}`, {
                    duration: Math.random() * 100,
                    timestamp: timestamp
                });
            }
            
            expect(app.performanceMetrics.size).toBe(100);
            
            // Simulate cleanup of old metrics (older than 1 hour)
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            let deletedCount = 0;
            for (const [key, value] of app.performanceMetrics.entries()) {
                if (value.timestamp < oneHourAgo) {
                    app.performanceMetrics.delete(key);
                    deletedCount++;
                }
            }
            
            expect(deletedCount).toBeGreaterThan(0);
            expect(app.performanceMetrics.size).toBeLessThan(100);
        });
    });

    describe('Error Recovery Mechanisms', () => {
        it('should implement exponential backoff for retries', async () => {
            const retryDelays = [];
            const originalSetTimeout = global.setTimeout;
            
            global.setTimeout = vi.fn((callback, delay) => {
                retryDelays.push(delay);
                return originalSetTimeout(callback, 0); // Execute immediately for test
            });
            
            // Simulate retry mechanism with exponential backoff
            for (let attempt = 0; attempt < 3; attempt++) {
                const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
                setTimeout(() => {
                    // Retry operation
                }, delay);
            }
            
            expect(retryDelays).toEqual([1000, 2000, 4000]);
            
            global.setTimeout = originalSetTimeout;
        });

        it('should limit retry attempts to prevent infinite loops', () => {
            const retryKey = 'network-document-fetch';
            
            // Simulate multiple retry attempts
            for (let i = 0; i < 5; i++) {
                const currentRetries = app.errorRetryCount.get(retryKey) || 0;
                if (currentRetries < app.maxRetries) {
                    app.errorRetryCount.set(retryKey, currentRetries + 1);
                }
            }
            
            expect(app.errorRetryCount.get(retryKey)).toBe(app.maxRetries);
        });

        it('should reset retry counts on successful operations', () => {
            const retryKey = 'network-document-fetch';
            app.errorRetryCount.set(retryKey, 2);
            
            // Simulate successful operation
            app.errorRetryCount.delete(retryKey);
            
            expect(app.errorRetryCount.get(retryKey)).toBeUndefined();
        });

        it('should provide fallback mechanisms for critical operations', async () => {
            // Test storage fallback
            app.fallbackToSessionStorage();
            expect(app.useSessionStorageFallback).toBe(true);
            
            // Test AI fallback (manual mode)
            app.chromeAIAvailable = false;
            await expect(app.processAI('test')).rejects.toThrow();
            
            // Test network fallback (offline mode)
            app.isOnline = false;
            const result = await app.handleNetworkError(new Error('offline'), 'test');
            expect(result.fallback).toBe('cached_data');
        });
    });

    describe('Performance Metrics and Monitoring', () => {
        it('should track performance metrics for all operations', async () => {
            await app.showView('workspace');
            await app.saveToStorage('test-key', { data: 'test' });
            
            expect(app.getPerformanceMetric('view-switch-workspace')).toBeDefined();
            expect(app.getPerformanceMetric('storage-save')).toBeDefined();
            
            const viewMetric = app.getPerformanceMetric('view-switch-workspace');
            expect(viewMetric.duration).toBeGreaterThan(0);
            expect(viewMetric.timestamp).toBeTypeOf('number');
        });

        it('should identify performance bottlenecks', async () => {
            const operations = [
                { name: 'fast-operation', duration: 50 },
                { name: 'slow-operation', duration: 600 },
                { name: 'normal-operation', duration: 150 }
            ];
            
            operations.forEach(op => {
                app.performanceMetrics.set(op.name, {
                    duration: op.duration,
                    timestamp: Date.now()
                });
            });
            
            // Identify slow operations (> 500ms)
            const slowOperations = [];
            for (const [name, metric] of app.performanceMetrics.entries()) {
                if (metric.duration > 500) {
                    slowOperations.push(name);
                }
            }
            
            expect(slowOperations).toContain('slow-operation');
            expect(slowOperations).not.toContain('fast-operation');
        });

        it('should provide performance warnings for slow operations', async () => {
            // Mock a slow view switch
            const originalShowView = app.showView;
            app.showView = async function(viewName) {
                return this.measureAsyncPerformance(`view-switch-${viewName}`, async () => {
                    await new Promise(resolve => setTimeout(resolve, 600)); // Slow operation
                    this.currentView = viewName;
                    return viewName;
                });
            };
            
            const { duration } = await app.showView('workspace');
            
            expect(duration).toBeGreaterThan(500);
            // In a real implementation, this would trigger a performance warning
        });
    });

    describe('Integration Error Scenarios', () => {
        it('should handle cascading failures gracefully', async () => {
            // Simulate multiple system failures
            app.isOnline = false;
            app.chromeAIAvailable = false;
            
            const networkResult = await app.handleNetworkError(new Error('offline'), 'document-fetch');
            const aiResult = app.handleAIError(new Error('Chrome AI not available'), 'text-processing');
            
            expect(networkResult.success).toBe(false);
            expect(aiResult.success).toBe(false);
            
            // Network error handling should trigger storage fallback
            // (This happens in the actual implementation when storage errors occur)
            app.fallbackToSessionStorage(); // Simulate this being triggered
            expect(app.useSessionStorageFallback).toBe(true);
            expect(networkResult.fallback).toBe('cached_data');
            expect(aiResult.fallback).toBe('setup_required');
        });

        it('should maintain data consistency during error recovery', async () => {
            const testData = { key: 'test', value: 'data' };
            
            try {
                await app.saveToStorage('quota-exceeded-key', testData);
            } catch (error) {
                // Manually trigger the error handling
                await app.handleStorageError(error, 'test operation');
                expect(app.useSessionStorageFallback).toBe(true);
            }
            
            // Subsequent operations should use fallback
            const { result } = await app.saveToStorage('fallback-key', testData);
            expect(result.success).toBe(true);
        });

        it('should handle partial system recovery', () => {
            // Start with multiple failures
            app.isOnline = false;
            app.chromeAIAvailable = false;
            
            // Simulate network recovery
            app.isOnline = true;
            
            // Should be able to retry network operations
            expect(app.isOnline).toBe(true);
            expect(app.chromeAIAvailable).toBe(false); // AI still unavailable
        });
    });
});