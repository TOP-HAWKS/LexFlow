/**
 * Unit Tests for Settings Validation
 * Tests URL format validation logic, settings persistence and retrieval,
 * and error handling for invalid URLs
 * 
 * Requirements: 1.3, 4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setSetting, getSetting } from '../src/db.js';

// Mock the database module
vi.mock('../src/db.js', () => ({
    setSetting: vi.fn(),
    getSetting: vi.fn()
}));

describe('Settings Validation Unit Tests', () => {
    let mockApp;
    let mockToastSystem;

    beforeEach(() => {
        // Setup DOM structure for settings form
        document.body.innerHTML = `
            <form id="settings-form">
                <div class="form-field">
                    <label for="settings-language">Idioma:</label>
                    <select id="settings-language" name="language">
                        <option value="pt-BR">Português (Brasil)</option>
                        <option value="en-US">English (US)</option>
                    </select>
                </div>
                <div class="form-field">
                    <label for="settings-country">País:</label>
                    <select id="settings-country" name="country">
                        <option value="br">Brasil</option>
                        <option value="us">Estados Unidos</option>
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
                    <div class="error-message"></div>
                </div>
                <div class="form-field">
                    <label for="settings-serverless-endpoint">Endpoint Serverless:</label>
                    <input type="url" id="settings-serverless-endpoint" name="serverlessEndpoint" 
                           placeholder="https://api.lexflow.cloudflare.workers.dev/pr"
                           title="Endpoint para criação automática de Pull Requests no repositório público">
                    <div class="error-message"></div>
                </div>
                <button type="submit" id="save-settings-btn">Salvar Configurações</button>
            </form>
            <div id="toast-container"></div>
        `;

        // Mock toast system
        mockToastSystem = {
            toasts: [],
            show(message, type = 'info', duration = 3000) {
                const toast = { message, type, duration, timestamp: Date.now() };
                this.toasts.push(toast);
                return this.toasts.length;
            },
            clear() {
                this.toasts = [];
            }
        };

        // Mock App class with validation methods
        mockApp = {
            toastSystem: mockToastSystem,
            
            /**
             * Validate if a string is a valid URL
             */
            isValidUrl(string) {
                try {
                    new URL(string);
                    return true;
                } catch (_) {
                    return false;
                }
            },

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
                    // Map field names to actual element IDs
                    const fieldId = fieldName === 'corpusUrl' ? 'settings-corpus-url' : 
                                   fieldName === 'serverlessEndpoint' ? 'settings-serverless-endpoint' : 
                                   `settings-${fieldName}`;
                    
                    const field = document.getElementById(fieldId);
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
            },

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
            },

            /**
             * Save application settings
             */
            async saveSettings() {
                // Validate form first
                const validation = this.validateSettingsForm();
                if (!validation.isValid) {
                    this.toastSystem.show('Por favor, corrija os erros no formulário', 'error');
                    return false;
                }

                const settings = {
                    language: document.getElementById('settings-language').value,
                    country: document.getElementById('settings-country').value,
                    state: document.getElementById('settings-state').value,
                    city: document.getElementById('settings-city').value,
                    corpusUrl: document.getElementById('settings-corpus-url').value,
                    serverlessEndpoint: document.getElementById('settings-serverless-endpoint').value
                };

                try {
                    // Use IndexedDB if available
                    await setSetting('app-settings', settings);
                    
                    // Enhanced success message with serverless endpoint feedback
                    let successMessage = 'Configurações salvas com sucesso!';
                    const serverlessEndpoint = document.getElementById('settings-serverless-endpoint').value.trim();
                    
                    if (serverlessEndpoint) {
                        successMessage += ' Integração serverless configurada e pronta para uso.';
                    } else {
                        successMessage += ' Para usar integração automática, configure o endpoint serverless.';
                    }
                    
                    this.toastSystem.show(successMessage, 'success', 6000);
                    return true;
                    
                } catch (error) {
                    console.error('Error saving settings:', error);
                    this.toastSystem.show('Erro ao salvar configurações', 'error');
                    return false;
                }
            },

            /**
             * Load application settings
             */
            async loadSettings() {
                try {
                    const settings = await getSetting('app-settings');
                    return settings || {};
                } catch (error) {
                    console.error('Error loading settings:', error);
                    this.toastSystem.show('Erro ao carregar configurações', 'error');
                    return {};
                }
            },

            showToast(message, type, duration) {
                return this.toastSystem.show(message, type, duration);
            }
        };

        // Make globally available for tests
        window.mockApp = mockApp;
    });

    afterEach(() => {
        // Clean up
        document.body.innerHTML = '';
        delete window.mockApp;
        vi.clearAllMocks();
    });

    describe('URL Format Validation Logic (Requirement 1.3)', () => {
        it('should validate correct HTTPS URLs', () => {
            const validUrls = [
                'https://api.lexflow.cloudflare.workers.dev/pr',
                'https://example.com/endpoint',
                'https://subdomain.example.com/api/v1',
                'https://api.vercel.app/webhook',
                'https://my-worker.username.workers.dev'
            ];

            validUrls.forEach(url => {
                expect(mockApp.isValidUrl(url)).toBe(true);
            });
        });

        it('should reject HTTP URLs (non-HTTPS)', () => {
            const httpUrls = [
                'http://example.com/endpoint',
                'http://api.example.com',
                'http://localhost:3000/api'
            ];

            httpUrls.forEach(url => {
                expect(mockApp.isValidUrl(url)).toBe(true); // URL constructor accepts HTTP
                
                // But serverless endpoint validation should reject it
                document.getElementById('settings-serverless-endpoint').value = url;
                const validation = mockApp.validateSettingsForm();
                expect(validation.isValid).toBe(false);
                expect(validation.errors.serverlessEndpoint).toBe('URL deve começar com "https://"');
            });
        });

        it('should reject invalid URL formats', () => {
            // Set required fields first
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';

            const invalidUrls = [
                'not-a-url',
                'ftp://example.com',
                'https://',
                'https://.',
                'https:// ',
                'javascript:alert(1)'
            ];

            invalidUrls.forEach(url => {
                document.getElementById('settings-serverless-endpoint').value = url;
                const validation = mockApp.validateSettingsForm();
                expect(validation.isValid).toBe(false);
                expect(validation.errors.serverlessEndpoint).toBeTruthy();
            });

            // Test empty URL (should be valid as it's optional)
            document.getElementById('settings-serverless-endpoint').value = '';
            const validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(true);
            expect(validation.errors.serverlessEndpoint).toBeUndefined();
        });

        it('should validate URL length requirements', () => {
            // Too short URL (less than 12 characters)
            document.getElementById('settings-serverless-endpoint').value = 'https://a';
            let validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(false);
            expect(validation.errors.serverlessEndpoint).toBe('URL muito curta. Inclua o domínio completo.');

            // Valid length URL
            document.getElementById('settings-serverless-endpoint').value = 'https://example.com';
            validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(true);
            expect(validation.errors.serverlessEndpoint).toBeUndefined();
        });

        it('should require domain with dot notation', () => {
            // URL without dot in domain
            document.getElementById('settings-serverless-endpoint').value = 'https://localhost';
            let validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(false);
            expect(validation.errors.serverlessEndpoint).toBe('URL deve incluir um domínio válido');

            // Valid domain with dot
            document.getElementById('settings-serverless-endpoint').value = 'https://api.example.com';
            validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(true);
            expect(validation.errors.serverlessEndpoint).toBeUndefined();
        });

        it('should handle real-time validation correctly', () => {
            const field = document.getElementById('settings-serverless-endpoint');
            const formField = field.closest('.form-field');

            // Test invalid URL
            field.value = 'http://example.com';
            mockApp.validateServerlessEndpointRealTime(field);
            
            expect(formField.classList.contains('error')).toBe(true);
            expect(formField.classList.contains('success')).toBe(false);
            
            const errorElement = formField.querySelector('.error-message');
            expect(errorElement.textContent).toBe('URL deve começar com "https://"');

            // Test valid URL
            field.value = 'https://api.example.com/webhook';
            mockApp.validateServerlessEndpointRealTime(field);
            
            expect(formField.classList.contains('error')).toBe(false);
            expect(formField.classList.contains('success')).toBe(true);

            // Test empty field (should not show error in real-time)
            field.value = '';
            mockApp.validateServerlessEndpointRealTime(field);
            
            expect(formField.classList.contains('error')).toBe(false);
            expect(formField.classList.contains('success')).toBe(false);
        });
    });

    describe('Settings Persistence and Retrieval (Requirement 4.5)', () => {
        it('should save settings to IndexedDB successfully', async () => {
            // Mock successful save
            setSetting.mockResolvedValue(true);

            // Fill form with valid data
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';
            document.getElementById('settings-state').value = 'RS';
            document.getElementById('settings-city').value = 'Porto Alegre';
            document.getElementById('settings-corpus-url').value = 'https://example.com/corpus';
            document.getElementById('settings-serverless-endpoint').value = 'https://api.example.com/webhook';

            const result = await mockApp.saveSettings();

            expect(result).toBe(true);
            expect(setSetting).toHaveBeenCalledWith('app-settings', {
                language: 'pt-BR',
                country: 'br',
                state: 'RS',
                city: 'Porto Alegre',
                corpusUrl: 'https://example.com/corpus',
                serverlessEndpoint: 'https://api.example.com/webhook'
            });

            // Check success toast
            const successToast = mockToastSystem.toasts.find(t => t.type === 'success');
            expect(successToast).toBeTruthy();
            expect(successToast.message).toContain('Configurações salvas com sucesso!');
            expect(successToast.message).toContain('Integração serverless configurada e pronta para uso.');
        });

        it('should handle IndexedDB save errors gracefully', async () => {
            // Mock save failure
            setSetting.mockRejectedValue(new Error('IndexedDB error'));

            // Fill form with valid data
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';

            const result = await mockApp.saveSettings();

            expect(result).toBe(false);
            expect(setSetting).toHaveBeenCalled();

            // Check error toast
            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toBe('Erro ao salvar configurações');
        });

        it('should load settings from IndexedDB successfully', async () => {
            const mockSettings = {
                language: 'en-US',
                country: 'us',
                state: 'California',
                city: 'San Francisco',
                corpusUrl: 'https://corpus.example.com',
                serverlessEndpoint: 'https://api.example.com/endpoint'
            };

            getSetting.mockResolvedValue(mockSettings);

            const result = await mockApp.loadSettings();

            expect(result).toEqual(mockSettings);
            expect(getSetting).toHaveBeenCalledWith('app-settings');
        });

        it('should handle IndexedDB load errors gracefully', async () => {
            // Mock load failure
            getSetting.mockRejectedValue(new Error('IndexedDB error'));

            const result = await mockApp.loadSettings();

            expect(result).toEqual({});
            expect(getSetting).toHaveBeenCalledWith('app-settings');

            // Check error toast
            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toBe('Erro ao carregar configurações');
        });

        it('should return empty object when no settings exist', async () => {
            // Mock no settings found
            getSetting.mockResolvedValue(null);

            const result = await mockApp.loadSettings();

            expect(result).toEqual({});
            expect(getSetting).toHaveBeenCalledWith('app-settings');
        });

        it('should provide different success messages based on serverless endpoint configuration', async () => {
            setSetting.mockResolvedValue(true);

            // Test with serverless endpoint configured
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';
            document.getElementById('settings-serverless-endpoint').value = 'https://api.example.com/webhook';

            await mockApp.saveSettings();

            let successToast = mockToastSystem.toasts.find(t => t.type === 'success');
            expect(successToast.message).toContain('Integração serverless configurada e pronta para uso.');

            // Clear toasts and test without serverless endpoint
            mockToastSystem.clear();
            document.getElementById('settings-serverless-endpoint').value = '';

            await mockApp.saveSettings();

            successToast = mockToastSystem.toasts.find(t => t.type === 'success');
            expect(successToast.message).toContain('Para usar integração automática, configure o endpoint serverless.');
        });
    });

    describe('Error Handling for Invalid URLs (Requirement 4.5)', () => {
        it('should prevent form submission with invalid serverless endpoint URLs', async () => {
            // Set invalid serverless endpoint
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';
            document.getElementById('settings-serverless-endpoint').value = 'http://invalid-url';

            const result = await mockApp.saveSettings();

            expect(result).toBe(false);
            expect(setSetting).not.toHaveBeenCalled();

            // Check validation error toast
            const errorToast = mockToastSystem.toasts.find(t => t.type === 'error');
            expect(errorToast).toBeTruthy();
            expect(errorToast.message).toBe('Por favor, corrija os erros no formulário');
        });

        it('should show specific error messages for different URL validation failures', () => {
            // Set required fields first
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';

            const testCases = [
                {
                    url: 'http://example.com',
                    expectedError: 'URL deve começar com "https://"'
                },
                {
                    url: 'https://a',
                    expectedError: 'URL muito curta. Inclua o domínio completo.'
                },
                {
                    url: 'https://localhost',
                    expectedError: 'URL deve incluir um domínio válido'
                }
            ];

            testCases.forEach(({ url, expectedError }) => {
                document.getElementById('settings-serverless-endpoint').value = url;
                const validation = mockApp.validateSettingsForm();
                
                expect(validation.isValid).toBe(false);
                expect(validation.errors.serverlessEndpoint).toBe(expectedError);
            });

            // Test invalid URL format that doesn't start with https://
            document.getElementById('settings-serverless-endpoint').value = 'not-a-url';
            const validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(false);
            expect(validation.errors.serverlessEndpoint).toBe('URL deve começar com "https://"');
        });

        it('should apply error styling to form fields with validation errors', () => {
            // Set required fields first
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';
            
            // Set invalid URL
            document.getElementById('settings-serverless-endpoint').value = 'http://invalid';
            
            const validation = mockApp.validateSettingsForm();
            
            expect(validation.isValid).toBe(false);
            expect(validation.errors.serverlessEndpoint).toBe('URL deve começar com "https://"');
            
            // Check that error class is applied
            const formField = document.getElementById('settings-serverless-endpoint').closest('.form-field');
            expect(formField).toBeTruthy(); // Make sure we found the form field
            expect(formField.classList.contains('error')).toBe(true);
            
            // Check that error message is displayed
            const errorElement = formField.querySelector('.error-message');
            expect(errorElement).toBeTruthy(); // Make sure we found the error element
            expect(errorElement.textContent).toBe('URL deve começar com "https://"');
        });

        it('should apply success styling to valid form fields', () => {
            // Set valid values
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';
            document.getElementById('settings-serverless-endpoint').value = 'https://api.example.com/webhook';
            
            const validation = mockApp.validateSettingsForm();
            
            expect(validation.isValid).toBe(true);
            
            // Check that success class is applied to valid fields
            const serverlessField = document.getElementById('settings-serverless-endpoint').closest('.form-field');
            expect(serverlessField.classList.contains('success')).toBe(true);
            expect(serverlessField.classList.contains('error')).toBe(false);
        });

        it('should validate corpus URL with same URL validation logic', () => {
            // Test invalid corpus URL
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';
            document.getElementById('settings-corpus-url').value = 'not-a-url';

            const validation = mockApp.validateSettingsForm();

            expect(validation.isValid).toBe(false);
            expect(validation.errors.corpusUrl).toBe('URL inválida. Use formato: https://exemplo.com');

            // Test valid corpus URL
            document.getElementById('settings-corpus-url').value = 'https://example.com/corpus';
            
            const validValidation = mockApp.validateSettingsForm();
            expect(validValidation.isValid).toBe(true);
            expect(validValidation.errors.corpusUrl).toBeUndefined();
        });

        it('should handle edge cases in real-time validation', () => {
            const field = document.getElementById('settings-serverless-endpoint');
            
            // Test with null field
            expect(() => mockApp.validateServerlessEndpointRealTime(null)).not.toThrow();
            
            // Test with field that doesn't have closest method
            const mockField = { value: 'test', closest: undefined };
            expect(() => mockApp.validateServerlessEndpointRealTime(mockField)).not.toThrow();
            
            // Test with field that has no parent form-field
            const isolatedField = document.createElement('input');
            isolatedField.value = 'https://example.com';
            expect(() => mockApp.validateServerlessEndpointRealTime(isolatedField)).not.toThrow();
        });
    });

    describe('Form Validation Integration', () => {
        it('should validate all required fields together', () => {
            // Clear all fields first
            document.getElementById('settings-language').value = '';
            document.getElementById('settings-country').value = '';
            document.getElementById('settings-state').value = '';
            document.getElementById('settings-city').value = '';
            document.getElementById('settings-corpus-url').value = '';
            document.getElementById('settings-serverless-endpoint').value = '';

            // Test with all fields empty
            let validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(false);
            expect(validation.errors.language).toBeTruthy();
            expect(validation.errors.country).toBeTruthy();

            // Fill required fields
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';

            validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(true);
            expect(validation.errors.language).toBeUndefined();
            expect(validation.errors.country).toBeUndefined();
        });

        it('should validate optional fields when provided', () => {
            // Set required fields
            document.getElementById('settings-language').value = 'pt-BR';
            document.getElementById('settings-country').value = 'br';

            // Test with invalid optional fields
            document.getElementById('settings-state').value = 'A'; // Too short
            document.getElementById('settings-city').value = 'B'; // Too short

            const validation = mockApp.validateSettingsForm();
            expect(validation.isValid).toBe(false);
            expect(validation.errors.state).toBe('Estado deve ter pelo menos 2 caracteres');
            expect(validation.errors.city).toBe('Cidade deve ter pelo menos 2 caracteres');
        });

        it('should clear previous validation states before new validation', () => {
            const formFields = document.querySelectorAll('.form-field');
            
            // Add some classes manually
            formFields.forEach(field => {
                field.classList.add('error', 'success');
            });

            // Run validation
            mockApp.validateSettingsForm();

            // Check that classes were cleared and reapplied appropriately
            formFields.forEach(field => {
                // Should not have both error and success classes
                expect(field.classList.contains('error') && field.classList.contains('success')).toBe(false);
            });
        });
    });
});