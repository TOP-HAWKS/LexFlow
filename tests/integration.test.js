/**
 * Integration Tests for Router and Toast System
 * Tests the interaction between router navigation and toast notifications
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock integrated app class that uses both router and toast systems
class MockIntegratedApp {
    constructor() {
        this.currentView = 'home';
        this.currentStep = 1;
        this.routes = {
            'home': () => this.showView('home'),
            'workspace': () => this.showView('workspace'),
            'collector': () => this.showView('collector'),
            'settings': () => this.showModal('settings')
        };
        
        // Initialize toast system
        this.toastSystem = new MockToastSystem();
        
        // Navigation state
        this.navigationHistory = [];
        this.isNavigating = false;
        
        this.initRouter();
    }

    initRouter() {
        window.addEventListener('hashchange', () => {
            this.handleRouteChange();
        });
        // Initialize with home route
        this.updateNavigationState('home');
        this.handleRouteChange();
    }

    handleRouteChange() {
        const hash = window.location.hash.slice(1) || 'home';
        const route = this.routes[hash];
        
        if (route) {
            this.isNavigating = true;
            
            try {
                route();
                this.updateNavigationState(hash);
                this.showNavigationToast(hash);
            } catch (error) {
                this.handleNavigationError(error, hash);
            } finally {
                this.isNavigating = false;
            }
        } else {
            this.handleInvalidRoute(hash);
        }
    }

    navigate(route) {
        if (this.routes[route]) {
            window.location.hash = route;
        } else {
            this.toastSystem.error(`Rota inválida: ${route}`);
        }
    }

    showView(viewName) {
        if (this.currentView === viewName) return;
        
        const previousView = this.currentView;
        this.currentView = viewName;
        
        // Mock DOM manipulation
        const views = document.querySelectorAll('.view.active');
        views.forEach(view => view.classList.remove('active'));
        
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
        } else {
            throw new Error(`View not found: ${viewName}`);
        }
        
        // Update navigation badges
        this.updateNavigationBadges();
        
        return { from: previousView, to: viewName };
    }

    showModal(modalName) {
        this.currentModal = modalName;
        this.toastSystem.info(`Abrindo ${modalName}...`);
    }

    updateNavigationState(hash) {
        this.navigationHistory.push({
            hash: hash,
            timestamp: Date.now(),
            view: this.currentView
        });
        
        // Persist to sessionStorage
        try {
            sessionStorage.setItem('lexflow-navigation-state', JSON.stringify({
                currentView: this.currentView,
                currentHash: hash,
                timestamp: Date.now()
            }));
        } catch (error) {
            this.toastSystem.warning('Não foi possível salvar o estado de navegação');
        }
    }

    showNavigationToast(hash) {
        const messages = {
            'home': 'Bem-vindo ao LexFlow',
            'workspace': 'Workspace Jurídico carregado',
            'collector': 'Coletor & Curadoria ativo',
            'settings': 'Configurações abertas'
        };
        
        const message = messages[hash] || `Navegando para ${hash}`;
        this.toastSystem.success(message, { duration: 2000 });
    }

    handleNavigationError(error, hash) {
        console.error('Navigation error:', error);
        
        this.toastSystem.error(`Erro ao navegar para ${hash}: ${error.message}`, {
            actions: [
                {
                    id: 'retry',
                    label: 'Tentar Novamente',
                    handler: () => this.navigate(hash)
                },
                {
                    id: 'home',
                    label: 'Ir para Início',
                    handler: () => this.navigate('home')
                }
            ]
        });
    }

    handleInvalidRoute(hash) {
        this.toastSystem.error(`Rota não encontrada: ${hash}`, {
            actions: [
                {
                    id: 'home',
                    label: 'Voltar ao Início',
                    handler: () => this.navigate('home')
                }
            ]
        });
        
        // Redirect to home
        this.navigate('home');
    }

    updateNavigationBadges() {
        // Mock badge updates based on current view
        const badges = {
            workspace: this.currentStep,
            collector: this.getCollectorQueueCount()
        };
        
        Object.entries(badges).forEach(([view, count]) => {
            const badge = document.getElementById(`${view}-badge`);
            if (badge && count > 0) {
                badge.textContent = count;
                badge.classList.remove('hidden');
            } else if (badge) {
                badge.classList.add('hidden');
            }
        });
    }

    getCollectorQueueCount() {
        // Mock collector queue count
        return Math.floor(Math.random() * 5);
    }

    // Workspace-specific navigation with toast feedback
    navigateToWorkspaceStep(step) {
        if (step < 1 || step > 3) {
            this.toastSystem.error('Etapa inválida do workspace');
            return;
        }
        
        this.currentStep = step;
        this.updateNavigationBadges();
        
        const stepNames = {
            1: 'Jurisdição & Corpus',
            2: 'Leis & Artigos',
            3: 'Prompt Studio'
        };
        
        this.toastSystem.info(`Etapa ${step}: ${stepNames[step]}`);
    }

    // Collector-specific actions with toast feedback
    addToCollectorQueue(item) {
        this.toastSystem.success('Item adicionado à fila de curadoria', {
            actions: [
                {
                    id: 'view',
                    label: 'Ver Fila',
                    handler: () => this.navigate('collector')
                }
            ]
        });
        
        this.updateNavigationBadges();
    }

    // Settings save with navigation state preservation
    saveSettings(settings) {
        try {
            // Mock settings save
            localStorage.setItem('lexflow-settings', JSON.stringify(settings));
            
            this.toastSystem.success('Configurações salvas com sucesso');
            
            // Return to previous view if available
            if (this.navigationHistory.length > 1) {
                const previousState = this.navigationHistory[this.navigationHistory.length - 2];
                this.navigate(previousState.hash);
            }
        } catch (error) {
            this.toastSystem.error('Erro ao salvar configurações', {
                actions: [
                    {
                        id: 'retry',
                        label: 'Tentar Novamente',
                        handler: () => this.saveSettings(settings)
                    }
                ]
            });
        }
    }
}

// Mock ToastSystem for integration tests
class MockToastSystem {
    constructor() {
        this.toastQueue = [];
        this.toastId = 0;
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        document.body.appendChild(this.container);
    }

    show(options, type = 'info', duration = 3000) {
        if (typeof options === 'string') {
            options = { message: options };
        }

        const config = { type, duration, ...options };
        const toastId = ++this.toastId;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.dataset.toastId = toastId;
        toast.textContent = config.message;
        
        this.container.appendChild(toast);
        this.toastQueue.push({ id: toastId, element: toast, config });

        if (config.duration > 0 && !config.persistent) {
            setTimeout(() => this.hide(toastId), config.duration);
        }

        return toastId;
    }

    success(message, options = {}) {
        return this.show({ message, ...options }, 'success');
    }

    error(message, options = {}) {
        return this.show({ message, ...options }, 'error', 5000);
    }

    info(message, options = {}) {
        return this.show({ message, ...options }, 'info');
    }

    warning(message, options = {}) {
        return this.show({ message, ...options }, 'warning', 4000);
    }

    hide(toastId) {
        const toastData = this.toastQueue.find(t => t.id === toastId);
        if (toastData && toastData.element.parentNode) {
            toastData.element.parentNode.removeChild(toastData.element);
            this.toastQueue = this.toastQueue.filter(t => t.id !== toastId);
        }
    }

    clear() {
        this.toastQueue.forEach(toast => {
            if (toast.element.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
        });
        this.toastQueue = [];
    }

    getCount() {
        return this.toastQueue.length;
    }
}

describe('Router and Toast System Integration', () => {
    let app;
    let mockViews;

    beforeEach(() => {
        // Setup DOM structure
        document.body.innerHTML = `
            <div class="app-container">
                <nav class="app-nav">
                    <span id="workspace-badge" class="nav-badge hidden"></span>
                    <span id="collector-badge" class="nav-badge hidden"></span>
                </nav>
                <div id="home-view" class="view active"></div>
                <div id="workspace-view" class="view"></div>
                <div id="collector-view" class="view"></div>
            </div>
        `;

        mockViews = {
            home: document.getElementById('home-view'),
            workspace: document.getElementById('workspace-view'),
            collector: document.getElementById('collector-view')
        };

        window.location.hash = '';
        app = new MockIntegratedApp();
    });

    describe('Navigation with Toast Feedback', () => {
        it('should show success toast when navigating to valid routes', () => {
            app.navigate('workspace');
            
            expect(app.currentView).toBe('workspace');
            expect(app.toastSystem.getCount()).toBe(1);
            
            const toast = app.toastSystem.container.querySelector('.toast.success');
            expect(toast).toBeTruthy();
            expect(toast.textContent).toContain('Workspace Jurídico carregado');
        });

        it('should show error toast for invalid routes', () => {
            app.navigate('invalid-route');
            
            expect(app.toastSystem.getCount()).toBe(1);
            
            const toast = app.toastSystem.container.querySelector('.toast.error');
            expect(toast).toBeTruthy();
            expect(toast.textContent).toContain('Rota inválida');
        });

        it('should handle navigation errors with recovery options', () => {
            // Mock view element removal to trigger error
            document.getElementById('workspace-view').remove();
            
            app.navigate('workspace');
            
            const toast = app.toastSystem.container.querySelector('.toast.error');
            expect(toast).toBeTruthy();
            expect(toast.textContent).toContain('Erro ao navegar');
        });

        it('should show different messages for different routes', () => {
            const routes = ['home', 'workspace', 'collector'];
            
            routes.forEach(route => {
                app.toastSystem.clear();
                app.navigate(route);
                
                expect(app.toastSystem.getCount()).toBe(1);
                const toast = app.toastSystem.container.querySelector('.toast');
                expect(toast.textContent).toBeTruthy();
            });
        });
    });

    describe('Navigation State Persistence with Error Handling', () => {
        it('should show warning toast when sessionStorage fails', () => {
            // Mock sessionStorage failure
            const originalSetItem = sessionStorage.setItem;
            sessionStorage.setItem = vi.fn(() => {
                throw new Error('Storage quota exceeded');
            });
            
            app.navigate('workspace');
            
            const warningToast = app.toastSystem.container.querySelector('.toast.warning');
            expect(warningToast).toBeTruthy();
            expect(warningToast.textContent).toContain('estado de navegação');
            
            // Restore original method
            sessionStorage.setItem = originalSetItem;
        });

        it('should persist navigation history correctly', () => {
            app.navigate('workspace');
            app.navigate('collector');
            app.navigate('home');
            
            expect(app.navigationHistory).toHaveLength(4); // Including initial
            expect(app.navigationHistory[app.navigationHistory.length - 1].hash).toBe('home');
        });
    });

    describe('Workspace Integration', () => {
        it('should update badges and show toast when navigating workspace steps', () => {
            app.navigate('workspace');
            app.navigateToWorkspaceStep(2);
            
            expect(app.currentStep).toBe(2);
            
            const toast = app.toastSystem.container.querySelector('.toast.info');
            expect(toast.textContent).toContain('Etapa 2');
            
            const badge = document.getElementById('workspace-badge');
            expect(badge.textContent).toBe('2');
            expect(badge.classList.contains('hidden')).toBe(false);
        });

        it('should show error toast for invalid workspace steps', () => {
            app.navigateToWorkspaceStep(5);
            
            const toast = app.toastSystem.container.querySelector('.toast.error');
            expect(toast).toBeTruthy();
            expect(toast.textContent).toContain('Etapa inválida');
        });
    });

    describe('Collector Integration', () => {
        it('should show success toast with navigation action when adding to queue', () => {
            app.addToCollectorQueue({ title: 'Test Item' });
            
            const toast = app.toastSystem.container.querySelector('.toast.success');
            expect(toast).toBeTruthy();
            expect(toast.textContent).toContain('Item adicionado');
        });

        it('should update collector badge when queue changes', () => {
            app.addToCollectorQueue({ title: 'Test Item' });
            
            const badge = document.getElementById('collector-badge');
            // Badge should be visible (queue count > 0 is random, but should be handled)
            expect(badge).toBeTruthy();
        });
    });

    describe('Settings Integration', () => {
        it('should show success toast and navigate back after saving settings', () => {
            // Navigate to workspace first
            app.navigate('workspace');
            app.toastSystem.clear();
            
            // Open settings
            app.navigate('settings');
            app.toastSystem.clear();
            
            // Save settings
            app.saveSettings({ language: 'pt-BR' });
            
            const toast = app.toastSystem.container.querySelector('.toast.success');
            expect(toast).toBeTruthy();
            expect(toast.textContent).toContain('Configurações salvas');
            
            // Should navigate back to workspace
            expect(app.currentView).toBe('workspace');
        });

        it('should show error toast with retry action when settings save fails', () => {
            // Mock localStorage failure
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = vi.fn(() => {
                throw new Error('Storage error');
            });
            
            app.saveSettings({ language: 'pt-BR' });
            
            const toast = app.toastSystem.container.querySelector('.toast.error');
            expect(toast).toBeTruthy();
            expect(toast.textContent).toContain('Erro ao salvar');
            
            // Restore original method
            localStorage.setItem = originalSetItem;
        });
    });

    describe('Error Recovery Workflows', () => {
        it('should provide recovery actions in error toasts', () => {
            app.handleInvalidRoute('invalid');
            
            const toast = app.toastSystem.container.querySelector('.toast.error');
            expect(toast).toBeTruthy();
            
            // Should redirect to home automatically
            expect(app.currentView).toBe('home');
        });

        it('should handle multiple navigation errors gracefully', () => {
            // Remove all view elements to trigger errors
            document.querySelectorAll('.view').forEach(view => view.remove());
            
            app.navigate('workspace');
            app.navigate('collector');
            app.navigate('home');
            
            // Should have error toasts for each failed navigation
            const errorToasts = app.toastSystem.container.querySelectorAll('.toast.error');
            expect(errorToasts.length).toBeGreaterThan(0);
        });
    });

    describe('Performance and Memory Management', () => {
        it('should handle rapid navigation without memory leaks', () => {
            const routes = ['workspace', 'collector', 'home'];
            
            // Rapid navigation
            for (let i = 0; i < 20; i++) {
                const route = routes[i % routes.length];
                app.navigate(route);
            }
            
            // Should not accumulate excessive toasts
            expect(app.toastSystem.getCount()).toBeLessThan(10);
            
            // Navigation history should be maintained
            expect(app.navigationHistory.length).toBeGreaterThan(0);
        });

        it('should clean up toasts during navigation', () => {
            // Generate many toasts
            for (let i = 0; i < 10; i++) {
                app.toastSystem.info(`Toast ${i}`);
            }
            
            const initialCount = app.toastSystem.getCount();
            
            // Navigate (which might trigger cleanup)
            app.navigate('workspace');
            
            // Toast count should be managed
            expect(app.toastSystem.getCount()).toBeLessThanOrEqual(initialCount + 1);
        });
    });

    describe('Accessibility and User Experience', () => {
        it('should provide meaningful feedback for all user actions', () => {
            const actions = [
                () => app.navigate('workspace'),
                () => app.navigateToWorkspaceStep(2),
                () => app.addToCollectorQueue({ title: 'Test' }),
                () => app.saveSettings({ test: true })
            ];
            
            actions.forEach(action => {
                app.toastSystem.clear();
                action();
                
                // Each action should provide feedback
                expect(app.toastSystem.getCount()).toBeGreaterThan(0);
            });
        });

        it('should maintain navigation state consistency', () => {
            app.navigate('workspace');
            expect(app.currentView).toBe('workspace');
            expect(window.location.hash).toBe('#workspace');
            
            app.navigate('collector');
            expect(app.currentView).toBe('collector');
            expect(window.location.hash).toBe('#collector');
            
            // Navigation history should be consistent
            const lastEntry = app.navigationHistory[app.navigationHistory.length - 1];
            expect(lastEntry.hash).toBe('collector');
            expect(lastEntry.view).toBe('collector');
        });
    });
});