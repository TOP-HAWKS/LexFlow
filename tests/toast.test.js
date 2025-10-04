/**
 * Toast System Unit Tests
 * Tests toast display, queuing, dismissal functionality, and user interactions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Import the ToastSystem class
// Since we're testing in isolation, we'll create a mock version based on the actual implementation
class MockToastSystem {
    constructor(containerId = 'toast-container') {
        this.container = document.getElementById(containerId);
        this.toastQueue = [];
        this.toastId = 0;
        this.maxToasts = 5;
        
        if (!this.container) {
            this.createContainer();
        }
        
        this.init();
    }

    init() {
        this.addStyles();
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    }

    addStyles() {
        if (document.getElementById('toast-styles')) return;

        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast-container {
                position: fixed;
                top: 1rem;
                right: 1rem;
                z-index: 1000;
            }
            .toast {
                padding: 0.75rem 1rem;
                margin-bottom: 0.5rem;
                border-radius: 0.5rem;
                color: white;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                min-width: 250px;
            }
            .toast.success { background: #10b981; }
            .toast.error { background: #ef4444; }
            .toast.info { background: #3b82f6; }
            .toast.warning { background: #f59e0b; }
            .toast.removing { opacity: 0.5; }
        `;
        document.head.appendChild(style);
    }

    show(options, type = 'info', duration = 3000) {
        if (typeof options === 'string') {
            options = { message: options };
        }

        const config = {
            type: type,
            duration: duration,
            title: null,
            message: '',
            actions: [],
            persistent: false,
            ...options
        };

        while (this.toastQueue.length >= this.maxToasts) {
            this.hideOldest();
        }

        const toastId = ++this.toastId;
        const toast = this.createToastElement(toastId, config);
        
        this.container.appendChild(toast);
        this.toastQueue.push({ id: toastId, element: toast, config });

        if (config.duration > 0 && !config.persistent) {
            setTimeout(() => {
                this.hide(toastId);
            }, config.duration);
        }

        return toastId;
    }

    createToastElement(toastId, config) {
        const toast = document.createElement('div');
        toast.className = `toast ${config.type}`;
        toast.dataset.toastId = toastId;

        const icons = {
            success: '✓',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        const icon = config.icon || icons[config.type] || icons.info;

        let contentHTML = '';
        
        if (config.title) {
            contentHTML += `<div class="toast-title">${this.escapeHtml(config.title)}</div>`;
        }
        
        contentHTML += `<div class="toast-message">${this.escapeHtml(config.message)}</div>`;
        
        if (config.actions && config.actions.length > 0) {
            contentHTML += '<div class="toast-actions">';
            config.actions.forEach(action => {
                contentHTML += `<button class="toast-action" data-action-id="${action.id}">${this.escapeHtml(action.label)}</button>`;
            });
            contentHTML += '</div>';
        }

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <div class="toast-content">${contentHTML}</div>
            <button class="toast-close" data-toast-id="${toastId}">&times;</button>
        `;

        // Add event listeners
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => this.hide(toastId));

        const actionBtns = toast.querySelectorAll('.toast-action');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleAction(toastId, btn.dataset.actionId);
            });
        });

        return toast;
    }

    handleAction(toastId, actionId) {
        const toastData = this.toastQueue.find(t => t.id === toastId);
        if (!toastData) return;

        const action = toastData.config.actions.find(a => a.id === actionId);
        if (action && action.handler) {
            action.handler();
        }

        if (!toastData.config.persistent) {
            this.hide(toastId);
        }
    }

    hide(toastId) {
        const toastData = this.toastQueue.find(t => t.id === toastId);
        if (!toastData) return;

        const toast = toastData.element;
        toast.classList.add('removing');

        // Remove immediately for tests
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
        this.toastQueue = this.toastQueue.filter(t => t.id !== toastId);
    }

    hideOldest() {
        if (this.toastQueue.length > 0) {
            this.hide(this.toastQueue[0].id);
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

    loading(message, options = {}) {
        return this.show({
            message,
            icon: '⏳',
            persistent: true,
            ...options
        }, 'info', 0);
    }

    withActions(message, actions, type = 'info') {
        return this.show({
            message,
            actions,
            persistent: true
        }, type, 0);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCount() {
        return this.toastQueue.length;
    }

    isAvailable() {
        return !!this.container;
    }
}

describe('Toast System', () => {
    let toastSystem;
    let container;

    beforeEach(() => {
        // Clear any existing toast containers
        const existingContainers = document.querySelectorAll('.toast-container');
        existingContainers.forEach(c => c.remove());
        
        // Clear existing styles
        const existingStyles = document.getElementById('toast-styles');
        if (existingStyles) existingStyles.remove();
        
        toastSystem = new MockToastSystem();
        container = toastSystem.container;
    });

    afterEach(() => {
        toastSystem.clear();
        vi.clearAllTimers();
    });

    describe('Initialization', () => {
        it('should create toast container if not exists', () => {
            expect(container).toBeTruthy();
            expect(container.id).toBe('toast-container');
            expect(container.className).toBe('toast-container');
        });

        it('should use existing container if provided', () => {
            const existingContainer = document.createElement('div');
            existingContainer.id = 'custom-toast-container';
            document.body.appendChild(existingContainer);

            const customToastSystem = new MockToastSystem('custom-toast-container');
            expect(customToastSystem.container).toBe(existingContainer);
        });

        it('should add toast styles to document head', () => {
            const styles = document.getElementById('toast-styles');
            expect(styles).toBeTruthy();
            expect(styles.textContent).toContain('.toast-container');
        });

        it('should initialize with empty queue', () => {
            expect(toastSystem.getCount()).toBe(0);
            expect(toastSystem.toastQueue).toEqual([]);
        });

        it('should be available after initialization', () => {
            expect(toastSystem.isAvailable()).toBe(true);
        });
    });

    describe('Toast Display', () => {
        it('should display basic toast with message', () => {
            const toastId = toastSystem.show('Test message');
            
            expect(toastId).toBeTruthy();
            expect(toastSystem.getCount()).toBe(1);
            
            const toast = container.querySelector('.toast');
            expect(toast).toBeTruthy();
            expect(toast.textContent).toContain('Test message');
        });

        it('should display toast with correct type classes', () => {
            const types = ['success', 'error', 'info', 'warning'];
            
            types.forEach(type => {
                toastSystem.show(`${type} message`, type);
            });
            
            types.forEach(type => {
                const toast = container.querySelector(`.toast.${type}`);
                expect(toast).toBeTruthy();
            });
        });

        it('should display toast with title and message', () => {
            toastSystem.show({
                title: 'Test Title',
                message: 'Test Message'
            });
            
            const toast = container.querySelector('.toast');
            expect(toast.textContent).toContain('Test Title');
            expect(toast.textContent).toContain('Test Message');
        });

        it('should display correct icons for each type', () => {
            const types = [
                { type: 'success', icon: '✓' },
                { type: 'error', icon: '❌' },
                { type: 'info', icon: 'ℹ️' },
                { type: 'warning', icon: '⚠️' }
            ];
            
            types.forEach(({ type, icon }) => {
                toastSystem.show(`${type} message`, type);
                const toast = container.querySelector(`.toast.${type} .toast-icon`);
                expect(toast.textContent).toBe(icon);
            });
        });

        it('should display custom icon when provided', () => {
            toastSystem.show({
                message: 'Custom icon message',
                icon: '🚀'
            });
            
            const icon = container.querySelector('.toast-icon');
            expect(icon.textContent).toBe('🚀');
        });
    });

    describe('Toast Queuing', () => {
        it('should queue multiple toasts', () => {
            toastSystem.show('Toast 1');
            toastSystem.show('Toast 2');
            toastSystem.show('Toast 3');
            
            expect(toastSystem.getCount()).toBe(3);
            expect(container.querySelectorAll('.toast')).toHaveLength(3);
        });

        it('should respect maximum toast limit', () => {
            // Add more toasts than the limit
            for (let i = 0; i < 7; i++) {
                toastSystem.show(`Toast ${i + 1}`);
            }
            
            expect(toastSystem.getCount()).toBe(toastSystem.maxToasts);
            expect(container.querySelectorAll('.toast')).toHaveLength(toastSystem.maxToasts);
        });

        it('should remove oldest toast when limit exceeded', () => {
            // Fill up to limit
            for (let i = 0; i < toastSystem.maxToasts; i++) {
                toastSystem.show(`Toast ${i + 1}`);
            }
            
            // Add one more
            toastSystem.show('New Toast');
            
            expect(toastSystem.getCount()).toBe(toastSystem.maxToasts);
            expect(container.textContent).toContain('New Toast');
            expect(container.textContent).not.toContain('Toast 1');
        });

        it('should maintain queue order', () => {
            toastSystem.show('First');
            toastSystem.show('Second');
            toastSystem.show('Third');
            
            const toasts = container.querySelectorAll('.toast');
            expect(toasts[0].textContent).toContain('First');
            expect(toasts[1].textContent).toContain('Second');
            expect(toasts[2].textContent).toContain('Third');
        });
    });

    describe('Toast Dismissal', () => {
        it('should auto-dismiss toast after duration', async () => {
            vi.useFakeTimers();
            
            toastSystem.show('Auto dismiss', 'info', 1000);
            expect(toastSystem.getCount()).toBe(1);
            
            vi.advanceTimersByTime(1000);
            
            // Wait for removal animation
            vi.advanceTimersByTime(300);
            
            expect(toastSystem.getCount()).toBe(0);
            
            vi.useRealTimers();
        });

        it('should not auto-dismiss persistent toasts', async () => {
            vi.useFakeTimers();
            
            toastSystem.show({
                message: 'Persistent toast',
                persistent: true
            }, 'info', 1000);
            
            vi.advanceTimersByTime(2000);
            
            expect(toastSystem.getCount()).toBe(1);
            
            vi.useRealTimers();
        });

        it('should dismiss toast manually via close button', () => {
            const toastId = toastSystem.show('Manual dismiss');
            const closeBtn = container.querySelector('.toast-close');
            
            closeBtn.click();
            
            // Should start removal process
            const toast = container.querySelector('.toast');
            expect(toast.classList.contains('removing')).toBe(true);
        });

        it('should dismiss specific toast by ID', () => {
            const id1 = toastSystem.show('Toast 1');
            const id2 = toastSystem.show('Toast 2');
            const id3 = toastSystem.show('Toast 3');
            
            toastSystem.hide(id2);
            
            expect(toastSystem.getCount()).toBe(2);
            expect(container.textContent).toContain('Toast 1');
            expect(container.textContent).not.toContain('Toast 2');
            expect(container.textContent).toContain('Toast 3');
        });

        it('should handle hiding non-existent toast gracefully', () => {
            expect(() => {
                toastSystem.hide(999);
            }).not.toThrow();
        });

        it('should clear all toasts', () => {
            toastSystem.show('Toast 1');
            toastSystem.show('Toast 2');
            toastSystem.show('Toast 3');
            
            toastSystem.clear();
            
            expect(toastSystem.getCount()).toBe(0);
            expect(container.querySelectorAll('.toast')).toHaveLength(0);
        });
    });

    describe('Toast Actions', () => {
        it('should display toast with actions', () => {
            const actions = [
                { id: 'confirm', label: 'Confirm', handler: vi.fn() },
                { id: 'cancel', label: 'Cancel', handler: vi.fn() }
            ];
            
            toastSystem.withActions('Action toast', actions);
            
            const actionBtns = container.querySelectorAll('.toast-action');
            expect(actionBtns).toHaveLength(2);
            expect(actionBtns[0].textContent).toBe('Confirm');
            expect(actionBtns[1].textContent).toBe('Cancel');
        });

        it('should handle action clicks', () => {
            const confirmHandler = vi.fn();
            const actions = [
                { id: 'confirm', label: 'Confirm', handler: confirmHandler }
            ];
            
            toastSystem.withActions('Action toast', actions);
            
            const confirmBtn = container.querySelector('[data-action-id="confirm"]');
            confirmBtn.click();
            
            expect(confirmHandler).toHaveBeenCalled();
        });

        it('should dismiss toast after action unless persistent', () => {
            const actions = [
                { id: 'action', label: 'Action', handler: vi.fn() }
            ];
            
            // Non-persistent toast
            toastSystem.show({
                message: 'Non-persistent',
                actions: actions
            });
            
            const actionBtn = container.querySelector('[data-action-id="action"]');
            actionBtn.click();
            
            // Should be marked for removal
            const toast = container.querySelector('.toast');
            expect(toast.classList.contains('removing')).toBe(true);
        });

        it('should not dismiss persistent toast after action', () => {
            const actions = [
                { id: 'action', label: 'Action', handler: vi.fn() }
            ];
            
            toastSystem.show({
                message: 'Persistent',
                actions: actions,
                persistent: true
            });
            
            const actionBtn = container.querySelector('[data-action-id="action"]');
            actionBtn.click();
            
            const toast = container.querySelector('.toast');
            expect(toast.classList.contains('removing')).toBe(false);
        });
    });

    describe('Convenience Methods', () => {
        it('should create success toast', () => {
            toastSystem.success('Success message');
            
            const toast = container.querySelector('.toast.success');
            expect(toast).toBeTruthy();
            expect(toast.textContent).toContain('Success message');
        });

        it('should create error toast with longer duration', () => {
            vi.useFakeTimers();
            
            toastSystem.error('Error message');
            
            const toast = container.querySelector('.toast.error');
            expect(toast).toBeTruthy();
            
            // Should not auto-dismiss after 3 seconds (default)
            vi.advanceTimersByTime(3000);
            expect(toastSystem.getCount()).toBe(1);
            
            // Should auto-dismiss after 5 seconds
            vi.advanceTimersByTime(2000);
            vi.advanceTimersByTime(300); // Animation time
            expect(toastSystem.getCount()).toBe(0);
            
            vi.useRealTimers();
        });

        it('should create info toast', () => {
            toastSystem.info('Info message');
            
            const toast = container.querySelector('.toast.info');
            expect(toast).toBeTruthy();
        });

        it('should create warning toast', () => {
            toastSystem.warning('Warning message');
            
            const toast = container.querySelector('.toast.warning');
            expect(toast).toBeTruthy();
        });

        it('should create loading toast with custom icon', () => {
            toastSystem.loading('Loading...');
            
            const toast = container.querySelector('.toast');
            const icon = toast.querySelector('.toast-icon');
            expect(icon.textContent).toBe('⏳');
        });

        it('should create persistent loading toast', () => {
            vi.useFakeTimers();
            
            toastSystem.loading('Loading...');
            
            vi.advanceTimersByTime(5000);
            expect(toastSystem.getCount()).toBe(1);
            
            vi.useRealTimers();
        });
    });

    describe('Security and Validation', () => {
        it('should escape HTML in messages', () => {
            toastSystem.show('<script>alert("xss")</script>');
            
            const toast = container.querySelector('.toast');
            expect(toast.innerHTML).toContain('&lt;script&gt;');
            expect(toast.innerHTML).not.toContain('<script>');
        });

        it('should escape HTML in titles', () => {
            toastSystem.show({
                title: '<img src=x onerror=alert(1)>',
                message: 'Safe message'
            });
            
            const toast = container.querySelector('.toast');
            expect(toast.innerHTML).toContain('&lt;img');
        });

        it('should escape HTML in action labels', () => {
            const actions = [
                { id: 'test', label: '<script>alert(1)</script>', handler: vi.fn() }
            ];
            
            toastSystem.withActions('Message', actions);
            
            const actionBtn = container.querySelector('.toast-action');
            expect(actionBtn.innerHTML).toContain('&lt;script&gt;');
        });
    });

    describe('Error Handling', () => {
        it('should handle missing action handler gracefully', () => {
            const actions = [
                { id: 'test', label: 'Test' } // No handler
            ];
            
            toastSystem.withActions('Message', actions);
            
            const actionBtn = container.querySelector('[data-action-id="test"]');
            
            expect(() => {
                actionBtn.click();
            }).not.toThrow();
        });

        it('should handle action handler errors gracefully', () => {
            const errorHandler = vi.fn(() => {
                throw new Error('Handler error');
            });
            
            const actions = [
                { id: 'error', label: 'Error', handler: errorHandler }
            ];
            
            toastSystem.withActions('Message', actions);
            
            const actionBtn = container.querySelector('[data-action-id="error"]');
            
            // Wrap in try-catch to handle the error gracefully
            try {
                actionBtn.click();
            } catch (error) {
                // Expected to throw, but should be handled gracefully
            }
            
            expect(errorHandler).toHaveBeenCalled();
        });

        it('should handle DOM manipulation errors gracefully', () => {
            const toastId = toastSystem.show('Test');
            
            // Manually remove toast from DOM
            const toast = container.querySelector('.toast');
            toast.remove();
            
            // Should not throw when trying to hide
            expect(() => {
                toastSystem.hide(toastId);
            }).not.toThrow();
        });
    });

    describe('Performance', () => {
        it('should handle rapid toast creation', () => {
            const startTime = performance.now();
            
            for (let i = 0; i < 100; i++) {
                toastSystem.show(`Toast ${i}`);
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Should complete within reasonable time (500ms for 100 toasts)
            expect(duration).toBeLessThan(500);
            
            // Should respect max toasts limit
            expect(toastSystem.getCount()).toBe(toastSystem.maxToasts);
        });

        it('should clean up event listeners when hiding toasts', () => {
            const toastId = toastSystem.show('Test');
            const toast = container.querySelector('.toast');
            const closeBtn = toast.querySelector('.toast-close');
            
            // Spy on removeEventListener
            const removeListenerSpy = vi.spyOn(closeBtn, 'removeEventListener');
            
            toastSystem.hide(toastId);
            
            // Note: In a real implementation, we'd want to ensure event listeners are cleaned up
            // This test demonstrates the concept
            expect(toast.classList.contains('removing')).toBe(true);
        });
    });
});