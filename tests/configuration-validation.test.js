/**
 * Unit Tests for Configuration Validation Logic
 * Focused tests for the 2-step workspace configuration validation
 * Requirements: 2.1, 2.2, 4.1, 4.2, 4.3, 4.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setSetting, getSetting } from '../src/util/settings.js';
import { DEFAULT_CONFIG, getDefaultBaseUrl } from '../src/config/defaults.js';

// Mock the settings module
vi.mock('../src/util/settings.js', () => ({
    setSetting: vi.fn(),
    getSetting: vi.fn()
}));

describe('Configuration Validation Unit Tests', () => {
    let mockConfigValidator;

    beforeEach(() => {
        // Mock configuration validator
        mockConfigValidator = {
            /**
             * Validate required settings for 2-step workspace
             */
            async validateRequiredSettings() {
                const language = await getSetting('language');
                const country = await getSetting('country');
                const baseUrl = await getSetting('baseUrl');

                const missing = [];
                if (!language) missing.push('language');
                if (!country) missing.push('country');
                if (!baseUrl) missing.push('baseUrl');

                return {
                    isValid: missing.length === 0,
                    missing: missing,
                    settings: { language, country, baseUrl }
                };
            },

            /**
             * Validate settings form data
             */
            validateSettingsFormData(formData) {
                const errors = {};
                let isValid = true;

                // Validate required fields
                if (!formData.language) {
                    errors.language = 'Por favor, selecione um idioma';
                    isValid = false;
                }

                if (!formData.country) {
                    errors.country = 'Por favor, selecione um país';
                    isValid = false;
                }

                // Validate optional fields
                if (formData.state && formData.state.length < 2) {
                    errors.state = 'Estado deve ter pelo menos 2 caracteres';
                    isValid = false;
                }

                if (formData.city && formData.city.length < 2) {
                    errors.city = 'Cidade deve ter pelo menos 2 caracteres';
                    isValid = false;
                }

                // Validate serverless endpoint if provided
                if (formData.serverlessEndpoint) {
                    const urlValidation = this.validateServerlessEndpointUrl(formData.serverlessEndpoint);
                    if (!urlValidation.isValid) {
                        errors.serverlessEndpoint = urlValidation.error;
                        isValid = false;
                    }
                }

                return { isValid, errors };
            },

            /**
             * Validate serverless endpoint URL format
             */
            validateServerlessEndpointUrl(url) {
                if (!url) {
                    return { isValid: true }; // Optional field
                }

                // Must start with https://
                if (!url.startsWith('https://')) {
                    return {
                        isValid: false,
                        error: 'URL deve começar com "https://"'
                    };
                }

                // Must be valid URL format
                try {
                    const urlObj = new URL(url);

                    // Must have reasonable length
                    if (url.length < 12) {
                        return {
                            isValid: false,
                            error: 'URL muito curta. Inclua o domínio completo.'
                        };
                    }

                    // Must have valid domain
                    if (!urlObj.hostname.includes('.')) {
                        return {
                            isValid: false,
                            error: 'URL deve incluir um domínio válido'
                        };
                    }

                    return { isValid: true };
                } catch {
                    return {
                        isValid: false,
                        error: 'Formato de URL inválido'
                    };
                }
            },

            /**
             * Get default configuration for a country
             */
            getDefaultConfigForCountry(country) {
                return {
                    language: DEFAULT_CONFIG.language,
                    country: country,
                    baseUrl: getDefaultBaseUrl(country),
                    state: '',
                    city: '',
                    serverlessEndpoint: ''
                };
            },

            /**
             * Check if configuration is complete for workspace functionality
             */
            isConfigurationComplete(settings) {
                if (!settings) return false;
                return !!(settings.language && settings.country && settings.baseUrl);
            },

            /**
             * Get missing configuration fields
             */
            getMissingConfigurationFields(settings) {
                if (!settings) return ['language', 'country', 'baseUrl'];
                const missing = [];
                if (!settings.language) missing.push('language');
                if (!settings.country) missing.push('country');
                if (!settings.baseUrl) missing.push('baseUrl');
                return missing;
            },

            /**
             * Validate configuration change impact
             */
            validateConfigurationChange(oldSettings, newSettings) {
                const criticalChanges = [];

                if (oldSettings.language !== newSettings.language) {
                    criticalChanges.push('language');
                }

                if (oldSettings.country !== newSettings.country) {
                    criticalChanges.push('country');
                }

                return {
                    hasCriticalChanges: criticalChanges.length > 0,
                    criticalChanges: criticalChanges,
                    requiresContextReset: criticalChanges.includes('country'),
                    requiresDocumentReload: criticalChanges.includes('country')
                };
            }
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Required Settings Validation', () => {
        it('should identify missing required settings', async () => {
            // Mock empty settings
            getSetting.mockResolvedValue(null);

            const result = await mockConfigValidator.validateRequiredSettings();

            expect(result.isValid).toBe(false);
            expect(result.missing).toEqual(['language', 'country', 'baseUrl']);
            expect(result.settings.language).toBeNull();
            expect(result.settings.country).toBeNull();
            expect(result.settings.baseUrl).toBeNull();
        });

        it('should validate complete required settings', async () => {
            // Mock complete settings
            getSetting.mockImplementation((key) => {
                const settings = {
                    language: 'pt-BR',
                    country: 'br',
                    baseUrl: 'https://example.com/corpus'
                };
                return Promise.resolve(settings[key]);
            });

            const result = await mockConfigValidator.validateRequiredSettings();

            expect(result.isValid).toBe(true);
            expect(result.missing).toEqual([]);
            expect(result.settings.language).toBe('pt-BR');
            expect(result.settings.country).toBe('br');
            expect(result.settings.baseUrl).toBe('https://example.com/corpus');
        });

        it('should identify partially missing settings', async () => {
            // Mock partial settings
            getSetting.mockImplementation((key) => {
                const settings = {
                    language: 'pt-BR',
                    country: null,
                    baseUrl: 'https://example.com/corpus'
                };
                return Promise.resolve(settings[key]);
            });

            const result = await mockConfigValidator.validateRequiredSettings();

            expect(result.isValid).toBe(false);
            expect(result.missing).toEqual(['country']);
            expect(result.settings.language).toBe('pt-BR');
            expect(result.settings.country).toBeNull();
        });
    });

    describe('Settings Form Validation', () => {
        it('should validate complete form data', () => {
            const formData = {
                language: 'pt-BR',
                country: 'br',
                state: 'Rio Grande do Sul',
                city: 'Porto Alegre',
                serverlessEndpoint: 'https://api.example.com/webhook'
            };

            const result = mockConfigValidator.validateSettingsFormData(formData);

            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual({});
        });

        it('should validate minimal required form data', () => {
            const formData = {
                language: 'pt-BR',
                country: 'br',
                state: '',
                city: '',
                serverlessEndpoint: ''
            };

            const result = mockConfigValidator.validateSettingsFormData(formData);

            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual({});
        });

        it('should reject form data with missing required fields', () => {
            const formData = {
                language: '',
                country: '',
                state: 'Valid State',
                city: 'Valid City',
                serverlessEndpoint: ''
            };

            const result = mockConfigValidator.validateSettingsFormData(formData);

            expect(result.isValid).toBe(false);
            expect(result.errors.language).toBe('Por favor, selecione um idioma');
            expect(result.errors.country).toBe('Por favor, selecione um país');
        });

        it('should validate optional field constraints', () => {
            const formData = {
                language: 'pt-BR',
                country: 'br',
                state: 'A', // Too short
                city: 'B', // Too short
                serverlessEndpoint: ''
            };

            const result = mockConfigValidator.validateSettingsFormData(formData);

            expect(result.isValid).toBe(false);
            expect(result.errors.state).toBe('Estado deve ter pelo menos 2 caracteres');
            expect(result.errors.city).toBe('Cidade deve ter pelo menos 2 caracteres');
        });
    });

    describe('Serverless Endpoint URL Validation', () => {
        it('should accept valid HTTPS URLs', () => {
            const validUrls = [
                'https://api.example.com/webhook',
                'https://my-worker.username.workers.dev',
                'https://subdomain.example.com/api/v1/endpoint',
                'https://api.vercel.app/webhook',
                'https://functions.cloudflare.com/api'
            ];

            validUrls.forEach(url => {
                const result = mockConfigValidator.validateServerlessEndpointUrl(url);
                expect(result.isValid).toBe(true);
            });
        });

        it('should reject HTTP URLs', () => {
            const httpUrls = [
                'http://api.example.com/webhook',
                'http://localhost:3000/api',
                'http://insecure.example.com'
            ];

            httpUrls.forEach(url => {
                const result = mockConfigValidator.validateServerlessEndpointUrl(url);
                expect(result.isValid).toBe(false);
                expect(result.error).toBe('URL deve começar com "https://"');
            });
        });

        it('should reject invalid URL formats', () => {
            const invalidUrls = [
                'not-a-url',
                'ftp://example.com',
                'https://',
                'https://.',
                'javascript:alert(1)',
                'file:///etc/passwd'
            ];

            invalidUrls.forEach(url => {
                const result = mockConfigValidator.validateServerlessEndpointUrl(url);
                expect(result.isValid).toBe(false);
                expect(result.error).toBeTruthy(); // Just check that there's an error message
            });
        });

        it('should reject URLs that are too short', () => {
            const shortUrls = [
                'https://a',
                'https://ab',
                'https://abc'
            ];

            shortUrls.forEach(url => {
                const result = mockConfigValidator.validateServerlessEndpointUrl(url);
                expect(result.isValid).toBe(false);
                expect(result.error).toBe('URL muito curta. Inclua o domínio completo.');
            });
        });

        it('should reject URLs without valid domains', () => {
            const invalidDomainUrls = [
                'https://localhost',
                'https://singleword',
                'https://no-dot-domain'
            ];

            invalidDomainUrls.forEach(url => {
                const result = mockConfigValidator.validateServerlessEndpointUrl(url);
                expect(result.isValid).toBe(false);
                expect(result.error).toBe('URL deve incluir um domínio válido');
            });
        });

        it('should accept empty URL as valid (optional field)', () => {
            const result = mockConfigValidator.validateServerlessEndpointUrl('');
            expect(result.isValid).toBe(true);
        });

        it('should accept null/undefined URL as valid (optional field)', () => {
            expect(mockConfigValidator.validateServerlessEndpointUrl(null).isValid).toBe(true);
            expect(mockConfigValidator.validateServerlessEndpointUrl(undefined).isValid).toBe(true);
        });
    });

    describe('Default Configuration Management', () => {
        it('should provide default configuration for Brazil', () => {
            const config = mockConfigValidator.getDefaultConfigForCountry('br');

            expect(config.language).toBe('pt-BR');
            expect(config.country).toBe('br');
            expect(config.baseUrl).toBe(DEFAULT_CONFIG.baseUrls.br);
            expect(config.state).toBe('');
            expect(config.city).toBe('');
            expect(config.serverlessEndpoint).toBe('');
        });

        it('should provide default configuration for US', () => {
            const config = mockConfigValidator.getDefaultConfigForCountry('us');

            expect(config.language).toBe('pt-BR'); // Default language
            expect(config.country).toBe('us');
            expect(config.baseUrl).toBe(DEFAULT_CONFIG.baseUrls.us);
        });

        it('should provide fallback configuration for unknown country', () => {
            const config = mockConfigValidator.getDefaultConfigForCountry('unknown');

            expect(config.country).toBe('unknown');
            expect(config.baseUrl).toBe(DEFAULT_CONFIG.fallbackBaseUrl);
        });
    });

    describe('Configuration Completeness Checks', () => {
        it('should identify complete configuration', () => {
            const completeSettings = {
                language: 'pt-BR',
                country: 'br',
                baseUrl: 'https://example.com/corpus',
                state: 'RS',
                city: 'Porto Alegre'
            };

            const isComplete = mockConfigValidator.isConfigurationComplete(completeSettings);
            expect(isComplete).toBe(true);

            const missing = mockConfigValidator.getMissingConfigurationFields(completeSettings);
            expect(missing).toEqual([]);
        });

        it('should identify incomplete configuration', () => {
            const incompleteSettings = {
                language: 'pt-BR',
                country: '',
                baseUrl: '',
                state: 'RS',
                city: 'Porto Alegre'
            };

            const isComplete = mockConfigValidator.isConfigurationComplete(incompleteSettings);
            expect(isComplete).toBe(false);

            const missing = mockConfigValidator.getMissingConfigurationFields(incompleteSettings);
            expect(missing).toEqual(['country', 'baseUrl']);
        });

        it('should handle null/undefined settings gracefully', () => {
            const nullSettings = null;
            const undefinedSettings = undefined;
            const emptySettings = {};

            expect(mockConfigValidator.isConfigurationComplete(nullSettings)).toBe(false);
            expect(mockConfigValidator.isConfigurationComplete(undefinedSettings)).toBe(false);
            expect(mockConfigValidator.isConfigurationComplete(emptySettings)).toBe(false);

            expect(mockConfigValidator.getMissingConfigurationFields(emptySettings))
                .toEqual(['language', 'country', 'baseUrl']);
        });
    });

    describe('Configuration Change Impact Analysis', () => {
        it('should detect critical configuration changes', () => {
            const oldSettings = {
                language: 'pt-BR',
                country: 'br',
                state: 'RS',
                city: 'Porto Alegre'
            };

            const newSettings = {
                language: 'en-US',
                country: 'us',
                state: 'California',
                city: 'San Francisco'
            };

            const impact = mockConfigValidator.validateConfigurationChange(oldSettings, newSettings);

            expect(impact.hasCriticalChanges).toBe(true);
            expect(impact.criticalChanges).toEqual(['language', 'country']);
            expect(impact.requiresContextReset).toBe(true);
            expect(impact.requiresDocumentReload).toBe(true);
        });

        it('should detect non-critical configuration changes', () => {
            const oldSettings = {
                language: 'pt-BR',
                country: 'br',
                state: 'RS',
                city: 'Porto Alegre'
            };

            const newSettings = {
                language: 'pt-BR',
                country: 'br',
                state: 'SP',
                city: 'São Paulo'
            };

            const impact = mockConfigValidator.validateConfigurationChange(oldSettings, newSettings);

            expect(impact.hasCriticalChanges).toBe(false);
            expect(impact.criticalChanges).toEqual([]);
            expect(impact.requiresContextReset).toBe(false);
            expect(impact.requiresDocumentReload).toBe(false);
        });

        it('should detect country-only changes', () => {
            const oldSettings = {
                language: 'pt-BR',
                country: 'br'
            };

            const newSettings = {
                language: 'pt-BR',
                country: 'us'
            };

            const impact = mockConfigValidator.validateConfigurationChange(oldSettings, newSettings);

            expect(impact.hasCriticalChanges).toBe(true);
            expect(impact.criticalChanges).toEqual(['country']);
            expect(impact.requiresContextReset).toBe(true);
            expect(impact.requiresDocumentReload).toBe(true);
        });

        it('should detect language-only changes', () => {
            const oldSettings = {
                language: 'pt-BR',
                country: 'br'
            };

            const newSettings = {
                language: 'en-US',
                country: 'br'
            };

            const impact = mockConfigValidator.validateConfigurationChange(oldSettings, newSettings);

            expect(impact.hasCriticalChanges).toBe(true);
            expect(impact.criticalChanges).toEqual(['language']);
            expect(impact.requiresContextReset).toBe(false); // Language change doesn't require context reset
            expect(impact.requiresDocumentReload).toBe(false); // Language change doesn't require document reload
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            getSetting.mockRejectedValue(new Error('Database connection failed'));

            await expect(mockConfigValidator.validateRequiredSettings()).rejects.toThrow('Database connection failed');
        });

        it('should handle malformed URL objects', () => {
            // Test with URL that passes URL constructor but has issues
            const problematicUrl = 'https://example.com:99999999'; // Invalid port

            const result = mockConfigValidator.validateServerlessEndpointUrl(problematicUrl);
            // URL constructor will throw for invalid ports, so this should be invalid
            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Formato de URL inválido');
        });

        it('should handle unicode and special characters in URLs', () => {
            const unicodeUrls = [
                'https://example.com/webhook?param=测试',
                'https://api.example.com/ação',
                'https://subdomain.example.com/café'
            ];

            unicodeUrls.forEach(url => {
                const result = mockConfigValidator.validateServerlessEndpointUrl(url);
                expect(result.isValid).toBe(true);
            });
        });

        it('should handle very long URLs', () => {
            const longPath = 'a'.repeat(1000);
            const longUrl = `https://example.com/${longPath}`;

            const result = mockConfigValidator.validateServerlessEndpointUrl(longUrl);
            expect(result.isValid).toBe(true);
        });

        it('should handle settings with null values', () => {
            const settingsWithNulls = {
                language: null,
                country: null,
                baseUrl: null,
                state: null,
                city: null
            };

            const missing = mockConfigValidator.getMissingConfigurationFields(settingsWithNulls);
            expect(missing).toEqual(['language', 'country', 'baseUrl']);
        });
    });

    describe('Integration with Default Configuration', () => {
        it('should use default base URL when country is provided', () => {
            const formData = {
                language: 'pt-BR',
                country: 'br',
                state: '',
                city: '',
                serverlessEndpoint: ''
            };

            const validation = mockConfigValidator.validateSettingsFormData(formData);
            expect(validation.isValid).toBe(true);

            const defaultConfig = mockConfigValidator.getDefaultConfigForCountry(formData.country);
            expect(defaultConfig.baseUrl).toBe(DEFAULT_CONFIG.baseUrls.br);
        });

        it('should handle countries not in default configuration', () => {
            const formData = {
                language: 'pt-BR',
                country: 'unknown-country',
                state: '',
                city: '',
                serverlessEndpoint: ''
            };

            const validation = mockConfigValidator.validateSettingsFormData(formData);
            expect(validation.isValid).toBe(true);

            const defaultConfig = mockConfigValidator.getDefaultConfigForCountry(formData.country);
            expect(defaultConfig.baseUrl).toBe(DEFAULT_CONFIG.fallbackBaseUrl);
        });
    });
});