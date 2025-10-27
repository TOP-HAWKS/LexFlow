/**
 * Router System Unit Tests
 * Tests hash change handling, view switching logic, and navigation state persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the LexFlowApp class for testing router functionality
class MockLexFlowApp {
    constructor() {
        this.currentView = 'home';
        this.currentStep = 1;
        this.routes = {
            'home': () => this.showView('home'),
            'workspace': () => this.showView('workspace'),
            'collector': () => this.showView('collector'),
            'settings': () => this.showModal('settings')
        };
        this.navigationHistory = [];
        this.viewSwitchCount = 0;
        
        this.initRouter();
    }

    initRouter() {
        window.addEventListener('hashchange', () => {
            this.handleRouteChange();
        });
        // Set initial hash if empty
        if (!window.location.hash) {
            window.location.hash = 'home';
        }
        this.handleRouteChange();
    }

    handleRouteChange() {
        const hash = window.location.hash.slice(1) || 'home';
        const route = this.routes[hash];
        
        if (route) {
            route();
            this.updateNavigationState(hash);
        } else {
            this.navigate('home');
        }
    }

    navigate(route) {
        if (this.routes[route]) {
            window.location.hash = route;
            this.handleRouteChange();
        }
    }

    showView(viewName) {
        if (this.currentView === viewName) return;
        
        this.currentView = viewName;
        this.viewSwitchCount++;
        
        // Mock DOM manipulation
        const views = document.querySelectorAll('.view.active');
        views.forEach(view => view.classList.remove('active'));
        
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
        }
    }

    showModal(modalName) {
        // Mock modal display
        this.currentModal = modalName;
    }

    updateNavigationState(hash) {
        this.navigationHistory.push({
            hash: hash,
            timestamp: Date.now(),
            view: this.currentView
        });
        
        // Persist navigation state
        try {
            sessionStorage.setItem('lexflow-navigation-state', JSON.stringify({
                currentView: this.currentView,
                currentHash: hash,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('Could not persist navigation state:', error);
        }
    }

    restoreNavigationState() {
        try {
            const saved = sessionStorage.getItem('lexflow-navigation-state');
            if (saved) {
                const state = JSON.parse(saved);
                if (state.currentHash && this.routes[state.currentHash]) {
                    this.navigate(state.currentHash);
                    return true;
                }
            }
        } catch (error) {
            console.warn('Could not restore navigation state:', error);
        }
        return false;
    }
}

describe('Router System', () => {
    let app;
    let mockViews;

    beforeEach(() => {
        // Setup DOM structure
        document.body.innerHTML = `
            <div class="app-container">
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

        // Reset hash
        window.location.hash = '';
        
        app = new MockLexFlowApp();
    });

    describe('Route Registration and Initialization', () => {
        it('should initialize with default home route', () => {
            expect(app.currentView).toBe('home');
            expect(window.location.hash).toBe('#home');
        });

        it('should register all required routes', () => {
            expect(app.routes).toHaveProperty('home');
            expect(app.routes).toHaveProperty('workspace');
            expect(app.routes).toHaveProperty('collector');
            expect(app.routes).toHaveProperty('settings');
        });

        it('should have route handlers as functions', () => {
            Object.values(app.routes).forEach(handler => {
                expect(typeof handler).toBe('function');
            });
        });
    });

    describe('Hash Change Handling', () => {
        it('should handle hash change to workspace', () => {
            window.location.hash = 'workspace';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            
            expect(app.currentView).toBe('workspace');
            expect(mockViews.workspace.classList.contains('active')).toBe(true);
            expect(mockViews.home.classList.contains('active')).toBe(false);
        });

        it('should handle hash change to collector', () => {
            window.location.hash = 'collector';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            
            expect(app.currentView).toBe('collector');
            expect(mockViews.collector.classList.contains('active')).toBe(true);
        });

        it('should handle settings modal route', () => {
            window.location.hash = 'settings';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            
            expect(app.currentModal).toBe('settings');
        });

        it('should fallback to home for invalid routes', () => {
            window.location.hash = 'invalid-route';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            
            expect(app.currentView).toBe('home');
            expect(window.location.hash).toBe('#home');
        });

        it('should handle empty hash as home route', () => {
            window.location.hash = '';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            
            expect(app.currentView).toBe('home');
        });
    });

    describe('View Switching Logic', () => {
        it('should switch views correctly', () => {
            app.showView('workspace');
            
            expect(app.currentView).toBe('workspace');
            expect(app.viewSwitchCount).toBe(1);
        });

        it('should not switch if already on the same view', () => {
            const initialCount = app.viewSwitchCount;
            app.showView('home'); // Already on home
            
            expect(app.viewSwitchCount).toBe(initialCount);
        });

        it('should update DOM classes when switching views', () => {
            app.showView('workspace');
            
            expect(mockViews.workspace.classList.contains('active')).toBe(true);
            expect(mockViews.home.classList.contains('active')).toBe(false);
            expect(mockViews.collector.classList.contains('active')).toBe(false);
        });

        it('should handle view switching for all routes', () => {
            const views = ['home', 'workspace', 'collector'];
            
            views.forEach(view => {
                app.showView(view);
                expect(app.currentView).toBe(view);
            });
        });
    });

    describe('Navigation State Persistence', () => {
        it('should persist navigation state to sessionStorage', () => {
            app.navigate('workspace');
            
            const savedState = sessionStorage.getItem('lexflow-navigation-state');
            expect(savedState).toBeTruthy();
            
            const state = JSON.parse(savedState);
            expect(state.currentView).toBe('workspace');
            expect(state.currentHash).toBe('workspace');
            expect(state.timestamp).toBeTypeOf('number');
        });

        it('should restore navigation state from sessionStorage', () => {
            // Set up saved state
            const savedState = {
                currentView: 'collector',
                currentHash: 'collector',
                timestamp: Date.now()
            };
            sessionStorage.setItem('lexflow-navigation-state', JSON.stringify(savedState));
            
            const restored = app.restoreNavigationState();
            
            expect(restored).toBe(true);
            expect(window.location.hash).toBe('#collector');
        });

        it('should handle invalid saved state gracefully', () => {
            sessionStorage.setItem('lexflow-navigation-state', 'invalid-json');
            
            const restored = app.restoreNavigationState();
            
            expect(restored).toBe(false);
        });

        it('should handle missing saved state gracefully', () => {
            sessionStorage.removeItem('lexflow-navigation-state');
            
            const restored = app.restoreNavigationState();
            
            expect(restored).toBe(false);
        });

        it('should track navigation history', () => {
            app.navigate('workspace');
            app.navigate('collector');
            app.navigate('home');
            
            expect(app.navigationHistory).toHaveLength(4); // Including initial home
            expect(app.navigationHistory[app.navigationHistory.length - 1].hash).toBe('home');
        });
    });

    describe('Programmatic Navigation', () => {
        it('should navigate programmatically using navigate method', () => {
            app.navigate('workspace');
            
            expect(window.location.hash).toBe('#workspace');
            expect(app.currentView).toBe('workspace');
        });

        it('should ignore navigation to invalid routes', () => {
            const originalHash = window.location.hash;
            app.navigate('invalid-route');
            
            expect(window.location.hash).toBe(originalHash);
        });

        it('should update navigation state when navigating programmatically', () => {
            app.navigate('collector');
            
            expect(app.navigationHistory.some(entry => entry.hash === 'collector')).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle sessionStorage errors gracefully', () => {
            // Mock sessionStorage to throw error
            const originalSetItem = sessionStorage.setItem;
            sessionStorage.setItem = vi.fn(() => {
                throw new Error('Storage quota exceeded');
            });
            
            // Should not throw error
            expect(() => {
                app.updateNavigationState('workspace');
            }).not.toThrow();
            
            // Restore original method
            sessionStorage.setItem = originalSetItem;
        });

        it('should handle missing DOM elements gracefully', () => {
            // Remove view element
            document.getElementById('workspace-view').remove();
            
            // Should not throw error
            expect(() => {
                app.showView('workspace');
            }).not.toThrow();
            
            expect(app.currentView).toBe('workspace');
        });
    });

    describe('Performance Considerations', () => {
        it('should not perform unnecessary view switches', () => {
            const initialCount = app.viewSwitchCount;
            
            // Try to switch to same view multiple times
            app.showView('home');
            app.showView('home');
            app.showView('home');
            
            expect(app.viewSwitchCount).toBe(initialCount);
        });

        it('should handle rapid navigation changes', () => {
            const routes = ['workspace', 'collector', 'home', 'workspace', 'collector'];
            
            routes.forEach(route => {
                app.navigate(route);
            });
            
            expect(app.currentView).toBe('collector');
            expect(window.location.hash).toBe('#collector');
        });
    });

    describe('Integration with Browser History', () => {
        it('should work with browser back/forward buttons', () => {
            // Simulate navigation
            app.navigate('workspace');
            app.navigate('collector');
            
            // Simulate back button
            window.location.hash = 'workspace';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            
            expect(app.currentView).toBe('workspace');
        });

        it('should maintain hash synchronization', () => {
            const routes = ['workspace', 'collector', 'home'];
            
            routes.forEach(route => {
                app.navigate(route);
                expect(window.location.hash).toBe(`#${route}`);
            });
        });
    });
});
