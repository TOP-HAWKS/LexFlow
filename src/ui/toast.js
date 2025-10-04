/**
 * Toast Notification System
 * Provides reusable toast notifications with queue management and animations
 */

class ToastSystem {
    constructor(containerId = 'toast-container') {
        this.container = document.getElementById(containerId);
        this.toastQueue = [];
        this.toastId = 0;
        this.maxToasts = 5; // Maximum number of toasts to show at once
        
        if (!this.container) {
            console.warn('Toast container not found, creating one');
            this.createContainer();
        }
        
        this.init();
    }

    /**
     * Initialize the toast system
     */
    init() {
        this.addStyles();
        console.log('Toast system initialized');
    }

    /**
     * Create toast container if it doesn't exist
     */
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'toast-container';
        document.body.appendChild(this.container);
    }

    /**
     * Add toast-specific styles if not already present
     */
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
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                pointer-events: none;
            }
            
            .toast {
                padding: 0.75rem 1rem;
                border-radius: 0.5rem;
                color: white;
                font-size: 0.9rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                min-width: 250px;
                max-width: 400px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                animation: slideInRight 0.3s ease-out;
                pointer-events: auto;
                position: relative;
                overflow: hidden;
            }
            
            .toast::before {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: rgba(255, 255, 255, 0.3);
                animation: progressBar var(--duration, 3000ms) linear;
            }
            
            .toast.success {
                background: linear-gradient(135deg, #10b981, #059669);
            }
            
            .toast.error {
                background: linear-gradient(135deg, #ef4444, #dc2626);
            }
            
            .toast.info {
                background: linear-gradient(135deg, #3b82f6, #2563eb);
            }
            
            .toast.warning {
                background: linear-gradient(135deg, #f59e0b, #d97706);
            }
            
            .toast-icon {
                font-size: 1.1rem;
                flex-shrink: 0;
            }
            
            .toast-content {
                flex: 1;
                display: flex;
                flex-direction: column;
            }
            
            .toast-title {
                font-weight: 600;
                margin-bottom: 0.25rem;
            }
            
            .toast-message {
                opacity: 0.9;
                line-height: 1.4;
            }
            
            .toast-close {
                margin-left: auto;
                background: none;
                border: none;
                color: inherit;
                cursor: pointer;
                padding: 0.25rem;
                font-size: 1.2rem;
                opacity: 0.7;
                transition: opacity 0.2s ease;
                flex-shrink: 0;
            }
            
            .toast-close:hover {
                opacity: 1;
            }
            
            .toast-actions {
                margin-top: 0.5rem;
                display: flex;
                gap: 0.5rem;
            }
            
            .toast-action {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                color: inherit;
                padding: 0.25rem 0.5rem;
                border-radius: 0.25rem;
                cursor: pointer;
                font-size: 0.8rem;
                transition: background-color 0.2s ease;
            }
            
            .toast-action:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            
            @keyframes progressBar {
                from {
                    width: 100%;
                }
                to {
                    width: 0%;
                }
            }
            
            .toast.removing {
                animation: slideOutRight 0.3s ease-in;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show a toast notification
     * @param {string|Object} options - Message string or options object
     * @param {string} type - Toast type (success, error, info, warning)
     * @param {number} duration - Duration in milliseconds (0 = no auto-dismiss)
     * @returns {number} Toast ID
     */
    show(options, type = 'info', duration = 3000) {
        // Handle string message
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

        // Manage queue size
        if (this.toastQueue.length >= this.maxToasts) {
            this.hideOldest();
        }

        const toastId = ++this.toastId;
        const toast = this.createToastElement(toastId, config);
        
        this.container.appendChild(toast);
        this.toastQueue.push({ id: toastId, element: toast, config });

        // Auto-dismiss if duration is set
        if (config.duration > 0 && !config.persistent) {
            setTimeout(() => {
                this.hide(toastId);
            }, config.duration);
        }

        return toastId;
    }

    /**
     * Create toast DOM element
     * @param {number} toastId - Unique toast ID
     * @param {Object} config - Toast configuration
     * @returns {HTMLElement} Toast element
     */
    createToastElement(toastId, config) {
        const toast = document.createElement('div');
        toast.className = `toast ${config.type}`;
        toast.dataset.toastId = toastId;
        
        if (config.duration > 0) {
            toast.style.setProperty('--duration', `${config.duration}ms`);
        }

        // Get icon for toast type
        const icons = {
            success: '✓',
            error: '❌',
            info: 'ℹ️',
            warning: '⚠️'
        };

        const icon = config.icon || icons[config.type] || icons.info;

        // Build toast content
        let contentHTML = '';
        
        if (config.title) {
            contentHTML += `<div class="toast-title">${this.escapeHtml(config.title)}</div>`;
        }
        
        contentHTML += `<div class="toast-message">${this.escapeHtml(config.message)}</div>`;
        
        if (config.actions && config.actions.length > 0) {
            contentHTML += '<div class="toast-actions">';
            config.actions.forEach(action => {
                contentHTML += `<button class="toast-action" onclick="app.toastSystem.handleAction(${toastId}, '${action.id}')">${this.escapeHtml(action.label)}</button>`;
            });
            contentHTML += '</div>';
        }

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <div class="toast-content">${contentHTML}</div>
            <button class="toast-close" onclick="app.toastSystem.hide(${toastId})">&times;</button>
        `;

        return toast;
    }

    /**
     * Handle toast action clicks
     * @param {number} toastId - Toast ID
     * @param {string} actionId - Action ID
     */
    handleAction(toastId, actionId) {
        const toastData = this.toastQueue.find(t => t.id === toastId);
        if (!toastData) return;

        const action = toastData.config.actions.find(a => a.id === actionId);
        if (action && action.handler) {
            action.handler();
        }

        // Auto-hide toast after action unless persistent
        if (!toastData.config.persistent) {
            this.hide(toastId);
        }
    }

    /**
     * Hide specific toast
     * @param {number} toastId - Toast ID to hide
     */
    hide(toastId) {
        const toastData = this.toastQueue.find(t => t.id === toastId);
        if (!toastData) return;

        const toast = toastData.element;
        toast.classList.add('removing');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toastQueue = this.toastQueue.filter(t => t.id !== toastId);
        }, 300);
    }

    /**
     * Hide oldest toast
     */
    hideOldest() {
        if (this.toastQueue.length > 0) {
            this.hide(this.toastQueue[0].id);
        }
    }

    /**
     * Clear all toasts
     */
    clear() {
        this.toastQueue.forEach(toast => {
            if (toast.element.parentNode) {
                toast.element.parentNode.removeChild(toast.element);
            }
        });
        this.toastQueue = [];
    }

    /**
     * Show success toast
     * @param {string} message - Success message
     * @param {Object} options - Additional options
     */
    success(message, options = {}) {
        return this.show({ message, ...options }, 'success');
    }

    /**
     * Show error toast
     * @param {string} message - Error message
     * @param {Object} options - Additional options
     */
    error(message, options = {}) {
        return this.show({ message, ...options }, 'error', 5000); // Longer duration for errors
    }

    /**
     * Show info toast
     * @param {string} message - Info message
     * @param {Object} options - Additional options
     */
    info(message, options = {}) {
        return this.show({ message, ...options }, 'info');
    }

    /**
     * Show warning toast
     * @param {string} message - Warning message
     * @param {Object} options - Additional options
     */
    warning(message, options = {}) {
        return this.show({ message, ...options }, 'warning', 4000);
    }

    /**
     * Show loading toast with spinner
     * @param {string} message - Loading message
     * @param {Object} options - Additional options
     */
    loading(message, options = {}) {
        return this.show({
            message,
            icon: '⏳',
            persistent: true,
            ...options
        }, 'info', 0);
    }

    /**
     * Show toast with custom actions
     * @param {string} message - Toast message
     * @param {Array} actions - Array of action objects
     * @param {string} type - Toast type
     */
    withActions(message, actions, type = 'info') {
        return this.show({
            message,
            actions,
            persistent: true
        }, type, 0);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get current toast count
     * @returns {number} Number of active toasts
     */
    getCount() {
        return this.toastQueue.length;
    }

    /**
     * Check if toast system is available
     * @returns {boolean} True if available
     */
    isAvailable() {
        return !!this.container;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastSystem;
} else {
    window.ToastSystem = ToastSystem;
}