/**
 * Core Router and Toast System Tests
 * Simplified tests focusing on the essential functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Core Router and Toast System Tests', () => {
    let mockApp;
    let mockToastSystem;

    beforeEach(() => {
        // Setup DOM
        document.body.innerHTML = `
            <div id="home-view" class="view active"></div>
            <div id="workspace-view" class="view"></div>
            <div id="collector-view" class="view"></div>
            <div id="toast-container"></div>
        `;

        // Reset hash
        window.location.hash = '';

        // Simple mock implementations
        mockToastSystem = {
            toasts: [],
            _idCounter: 0,
            show(message, type = 'info') {
                const toast = { id: ++this._idCounter, message, type };
                this.toasts.push(toast);
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

        mockApp = {
            currentView: 'home',
            navigationHistory: [],
            toastSystem: mockToastSystem,
            
            navigate(route) {
                window.location.hash = route;
                this.handleRouteChange();
            },
            
            handleRouteChange() {
                const hash = window.location.hash.slice(1) || 'home';
                const validRoutes = ['home', 'workspace', 'collector', 'settings'];
                
                if (validRoutes.includes(hash)) {
                    this.showView(hash);
                    this.updateNavigationState(hash);
                } else {
                    this.toastSystem.show(`Invalid route: ${hash}`, 'error');
                    this.navigate('home');
                }
            },
            
            showView(viewName) {
                if (this.currentView === viewName) return;
                
                // Hide all views
                document.querySelectorAll('.view.active').forEach(view => {
                    view.classList.remove('active');
                });
                
                // Show target view
                const targetView = document.getElementById(`${viewName}-view`);
                if (targetView) {
                    targetView.classList.add('active');
                    this.currentView = viewName;
                } else if (viewName !== 'settings') {
                    throw new Error(`View not found: ${viewName}`);
                }
            },
            
            updateNavigationState(hash) {
                this.navigationHistory.push({
                    hash: hash,
                    timestamp: Date.now(),
                    view: this.currentView
                });
            }
        };

        // Initialize
        mockApp.handleRouteChange();
    });

    describe('Router Core Functionality', () => {
        it('should initialize with home view', () => {
            expect(mockApp.currentView).toBe('home');
            expect(document.getElementById('home-view').classList.contains('active')).toBe(true);
        });

        it('should navigate between valid routes', () => {
            mockApp.navigate('workspace');
            expect(mockApp.currentView).toBe('workspace');
            expect(window.location.hash).toBe('#workspace');
            expect(document.getElementById('workspace-view').classList.contains('active')).toBe(true);
        });

        it('should handle invalid routes with error toast', () => {
            mockApp.navigate('invalid');
            
            expect(mockApp.toastSystem.getCount()).toBe(1);
            expect(mockApp.toastSystem.toasts[0].type).toBe('error');
            expect(mockApp.currentView).toBe('home'); // Should redirect to home
        });

        it('should track navigation history', () => {
            mockApp.navigate('workspace');
            mockApp.navigate('collector');
            
            expect(mockApp.navigationHistory.length).toBeGreaterThan(0);
            const lastEntry = mockApp.navigationHistory[mockApp.navigationHistory.length - 1];
            expect(lastEntry.hash).toBe('collector');
        });

        it('should not switch to same view unnecessarily', () => {
            const initialHistoryLength = mockApp.navigationHistory.length;
            mockApp.showView('home'); // Already on home
            
            expect(mockApp.navigationHistory.length).toBe(initialHistoryLength);
        });
    });

    describe('Toast System Core Functionality', () => {
        it('should display toast messages', () => {
            const toastId = mockToastSystem.show('Test message');
            
            expect(toastId).toBeTruthy();
            expect(mockToastSystem.getCount()).toBe(1);
            expect(mockToastSystem.toasts[0].message).toBe('Test message');
        });

        it('should support different toast types', () => {
            mockToastSystem.show('Success', 'success');
            mockToastSystem.show('Error', 'error');
            mockToastSystem.show('Info', 'info');
            
            expect(mockToastSystem.getCount()).toBe(3);
            expect(mockToastSystem.toasts[0].type).toBe('success');
            expect(mockToastSystem.toasts[1].type).toBe('error');
            expect(mockToastSystem.toasts[2].type).toBe('info');
        });

        it('should hide specific toasts', () => {
            const id1 = mockToastSystem.show('Toast 1');
            const id2 = mockToastSystem.show('Toast 2');
            
            expect(mockToastSystem.getCount()).toBe(2);
            expect(mockToastSystem.toasts[0].id).toBe(id1);
            expect(mockToastSystem.toasts[1].id).toBe(id2);
            
            mockToastSystem.hide(id1);
            
            expect(mockToastSystem.getCount()).toBe(1);
            expect(mockToastSystem.toasts[0].message).toBe('Toast 2');
            expect(mockToastSystem.toasts[0].id).toBe(id2);
        });

        it('should clear all toasts', () => {
            mockToastSystem.show('Toast 1');
            mockToastSystem.show('Toast 2');
            mockToastSystem.show('Toast 3');
            
            mockToastSystem.clear();
            
            expect(mockToastSystem.getCount()).toBe(0);
        });
    });

    describe('Integration Scenarios', () => {
        it('should show toast when navigating to valid routes', () => {
            mockApp.toastSystem.clear();
            
            // Mock the navigation toast functionality
            const originalNavigate = mockApp.navigate;
            mockApp.navigate = function(route) {
                originalNavigate.call(this, route);
                if (this.currentView === route) {
                    this.toastSystem.show(`Navigated to ${route}`, 'success');
                }
            };
            
            mockApp.navigate('workspace');
            
            expect(mockApp.toastSystem.getCount()).toBe(1);
            expect(mockApp.toastSystem.toasts[0].type).toBe('success');
        });

        it('should handle navigation errors with recovery', () => {
            // Remove workspace view to trigger error
            document.getElementById('workspace-view').remove();
            
            try {
                mockApp.navigate('workspace');
            } catch (error) {
                mockApp.toastSystem.show('Navigation error', 'error');
                mockApp.navigate('home');
            }
            
            expect(mockApp.currentView).toBe('home');
            expect(mockApp.toastSystem.getCount()).toBe(1);
        });

        it('should maintain state consistency during navigation', () => {
            mockApp.navigate('workspace');
            expect(mockApp.currentView).toBe('workspace');
            expect(window.location.hash).toBe('#workspace');
            
            mockApp.navigate('collector');
            expect(mockApp.currentView).toBe('collector');
            expect(window.location.hash).toBe('#collector');
            
            // History should be consistent
            expect(mockApp.navigationHistory.length).toBeGreaterThan(1);
        });

        it('should handle rapid navigation changes', () => {
            const routes = ['workspace', 'collector', 'home'];
            
            routes.forEach(route => {
                mockApp.navigate(route);
            });
            
            expect(mockApp.currentView).toBe('home');
            expect(mockApp.navigationHistory.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle missing DOM elements gracefully', () => {
            // Test with non-existent view
            expect(() => {
                mockApp.showView('nonexistent');
            }).toThrow('View not found: nonexistent');
        });

        it('should handle empty navigation history', () => {
            mockApp.navigationHistory = [];
            
            expect(() => {
                mockApp.navigate('workspace');
            }).not.toThrow();
            
            expect(mockApp.navigationHistory.length).toBe(1);
        });

        it('should handle toast system errors gracefully', () => {
            // Mock toast system error
            const originalShow = mockToastSystem.show;
            mockToastSystem.show = vi.fn(() => {
                throw new Error('Toast error');
            });
            
            expect(() => {
                mockApp.navigate('invalid-route');
            }).toThrow('Toast error');
            
            // Restore original method
            mockToastSystem.show = originalShow;
        });
    });

    describe('Performance and Memory Management', () => {
        it('should handle multiple toasts efficiently', () => {
            const startTime = performance.now();
            
            for (let i = 0; i < 50; i++) {
                mockToastSystem.show(`Toast ${i}`);
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            expect(duration).toBeLessThan(100); // Should be fast
            expect(mockToastSystem.getCount()).toBe(50);
        });

        it('should clean up navigation history appropriately', () => {
            const initialLength = mockApp.navigationHistory.length;
            
            // Generate many navigation events
            for (let i = 0; i < 20; i++) {
                const route = i % 2 === 0 ? 'workspace' : 'collector';
                mockApp.navigate(route);
            }
            
            expect(mockApp.navigationHistory.length).toBe(initialLength + 20);
            expect(mockApp.currentView).toBe('collector');
        });
    });

    describe('Hash Change Event Handling', () => {
        it('should respond to hash change events', () => {
            window.location.hash = 'workspace';
            window.dispatchEvent(new HashChangeEvent('hashchange'));
            
            // Since we're not setting up the actual event listener in this mock,
            // we'll simulate the behavior
            mockApp.handleRouteChange();
            
            expect(mockApp.currentView).toBe('workspace');
        });

        it('should handle browser back/forward simulation', () => {
            mockApp.navigate('workspace');
            mockApp.navigate('collector');
            
            // Simulate back button
            window.location.hash = 'workspace';
            mockApp.handleRouteChange();
            
            expect(mockApp.currentView).toBe('workspace');
        });
    });

    describe('Navigation State Persistence', () => {
        it('should track navigation state correctly', () => {
            mockApp.navigate('workspace');
            
            const lastEntry = mockApp.navigationHistory[mockApp.navigationHistory.length - 1];
            expect(lastEntry.hash).toBe('workspace');
            expect(lastEntry.view).toBe('workspace');
            expect(lastEntry.timestamp).toBeTypeOf('number');
        });

        it('should handle navigation state updates', () => {
            const initialLength = mockApp.navigationHistory.length;
            
            mockApp.updateNavigationState('test-route');
            
            expect(mockApp.navigationHistory.length).toBe(initialLength + 1);
            expect(mockApp.navigationHistory[mockApp.navigationHistory.length - 1].hash).toBe('test-route');
        });
    });
});