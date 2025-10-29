/**
 * Toast System for LexFlow
 * Handles user notifications and feedback
 */

export class ToastSystem {
    constructor() {
        this.container = null;
        this.toasts = [];
        this.maxToasts = 5;
        this.init();
    }

    /**
     * Initialize toast system
     */
    init() {
        // Create container if it doesn't exist
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    /**
     * Show a toast notification
     * @param {string} message - Message to display
     * @param {string} type - Toast type (success, error, warning, info)
     * @param {number} duration - Duration in milliseconds (default: 4000)
     * @param {string} actionText - Optional action button text
     * @param {Function} actionCallback - Optional action callback
     */
    show(message, type = 'success', duration = 4000, actionText = null, actionCallback = null) {
        // Remove oldest toast if we have too many
        if (this.toasts.length >= this.maxToasts) {
            this.remove(this.toasts[0]);
        }

        const toast = this.createToast(message, type, duration, actionText, actionCallback);
        this.toasts.push(toast);
        this.container.appendChild(toast);

        // Trigger animation
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);

        // Auto-remove after duration (unless it has an action)
        if (!actionText && duration > 0) {
            setTimeout(() => {
                this.remove(toast);
            }, duration);
        }

        return toast;
    }

    /**
     * Create toast element
     * @param {string} message - Toast message
     * @param {string} type - Toast type
     * @param {number} duration - Duration
     * @param {string} actionText - Action button text
     * @param {Function} actionCallback - Action callback
     * @returns {HTMLElement} Toast element
     */
    createToast(message, type, duration, actionText, actionCallback) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');

        const content = document.createElement('div');
        content.className = 'toast-content';

        const messageEl = document.createElement('div');
        messageEl.className = 'toast-message';
        messageEl.textContent = message;
        content.appendChild(messageEl);

        // Add action button if provided
        if (actionText && actionCallback) {
            const actionBtn = document.createElement('button');
            actionBtn.className = 'toast-action';
            actionBtn.textContent = actionText;
            actionBtn.addEventListener('click', () => {
                actionCallback();
                this.remove(toast);
            });
            content.appendChild(actionBtn);
        }

        // Add close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.innerHTML = '×';
        closeBtn.setAttribute('aria-label', 'Close notification');
        closeBtn.addEventListener('click', () => {
            this.remove(toast);
        });
        content.appendChild(closeBtn);

        toast.appendChild(content);

        // Add progress bar for timed toasts
        if (duration > 0 && !actionText) {
            const progressBar = document.createElement('div');
            progressBar.className = 'toast-progress';
            progressBar.style.animationDuration = `${duration}ms`;
            toast.appendChild(progressBar);
        }

        return toast;
    }

    /**
     * Remove a toast
     * @param {HTMLElement} toast - Toast element to remove
     */
    remove(toast) {
        if (!toast || !toast.parentNode) return;

        toast.classList.remove('show');
        toast.classList.add('hide');

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            this.toasts = this.toasts.filter(t => t !== toast);
        }, 300);
    }

    /**
     * Clear all toasts
     */
    clear() {
        this.toasts.forEach(toast => {
            this.remove(toast);
        });
    }

    /**
     * Show success toast
     * @param {string} message - Success message
     * @param {number} duration - Duration in milliseconds
     */
    success(message, duration = 4000) {
        return this.show(message, 'success', duration);
    }

    /**
     * Show error toast
     * @param {string} message - Error message
     * @param {number} duration - Duration in milliseconds
     */
    error(message, duration = 6000) {
        return this.show(message, 'error', duration);
    }

    /**
     * Show warning toast
     * @param {string} message - Warning message
     * @param {number} duration - Duration in milliseconds
     */
    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    /**
     * Show info toast
     * @param {string} message - Info message
     * @param {number} duration - Duration in milliseconds
     */
    info(message, duration = 4000) {
        return this.show(message, 'info', duration);
    }

    /**
     * Show toast with action button
     * @param {string} message - Toast message
     * @param {string} type - Toast type
     * @param {string} actionText - Action button text
     * @param {Function} actionCallback - Action callback
     * @param {number} duration - Duration (0 for persistent)
     */
    showWithAction(message, type, actionText, actionCallback, duration = 0) {
        return this.show(message, type, duration, actionText, actionCallback);
    }

    /**
     * Get number of active toasts
     * @returns {number} Number of active toasts
     */
    getCount() {
        return this.toasts.length;
    }
}