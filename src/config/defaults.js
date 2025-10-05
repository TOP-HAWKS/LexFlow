/**
 * Default configuration values for LexFlow
 * Contains default corpus URLs per jurisdiction and other system defaults
 */

export const DEFAULT_CONFIG = {
  // Default corpus base URLs per jurisdiction
  baseUrls: {
    'br': 'https://raw.githubusercontent.com/org/legal-corpus-br/main',
    'us': 'https://raw.githubusercontent.com/org/legal-corpus-us/main', 
    'es': 'https://raw.githubusercontent.com/org/legal-corpus-es/main'
  },
  
  // Default interface language
  language: 'pt-BR',
  
  // Fallback base URL if jurisdiction-specific URL is not available
  fallbackBaseUrl: 'https://raw.githubusercontent.com/org/legal-corpus/main',
  
  // Default country for new users
  defaultCountry: 'br'
};

/**
 * Get default base URL for a given country
 * @param {string} country - Country code (e.g., 'br', 'us', 'es')
 * @returns {string} Base URL for the country's legal corpus
 */
export function getDefaultBaseUrl(country) {
  return DEFAULT_CONFIG.baseUrls[country] || DEFAULT_CONFIG.fallbackBaseUrl;
}

/**
 * Get all default configuration values
 * @returns {object} Complete default configuration object
 */
export function getDefaultConfig() {
  return { ...DEFAULT_CONFIG };
}