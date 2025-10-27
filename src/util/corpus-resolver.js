/**
 * Corpus URL Resolver for LexFlow
 * Automatically resolves corpus base URL by language/region
 */

import { getCachedConfig } from './config-loader.js';

/**
 * Resolve corpus base URL based on user language settings
 * @returns {Promise<string>} Resolved corpus base URL
 */
export async function resolveCorpusBaseUrl() {
  const config = getCachedConfig();
  if (!config) {
    console.warn('[LexFlow] No configuration available, using fallback corpus URL');
    const fallbackUrl = 'https://raw.githubusercontent.com/org/legal-corpus/main';
    localStorage.setItem('lexflow-corpus-base-url', fallbackUrl);
    return fallbackUrl;
  }
  
  // Get user language settings (fallback to config default)
  const settings = JSON.parse(localStorage.getItem('lexflow-settings') || '{}');
  const lang = (settings?.language || config?.ui?.defaultLanguage || 'en-US').toLowerCase();
  
  // Map language to country key
  const key = lang.startsWith('pt') ? 'br'
            : lang.startsWith('es') ? 'es'
            : lang.startsWith('en') ? 'us'
            : null;
  
  // Resolve URL from configuration
  const url = (key && config?.corpus?.baseUrls?.[key]) ||
              config?.corpus?.fallbackUrl ||
              config?.corpusBaseUrl;
  
  if (!url) {
    throw new Error('[LexFlow] No valid corpus base URL found.');
  }
  
  // Store resolved URL for quick access
  localStorage.setItem('lexflow-corpus-base-url', url);
  
  console.log(`[LexFlow] Corpus URL resolved: ${url} (language: ${lang})`);
  return url;
}

/**
 * Get cached corpus base URL
 * @returns {string|null} Cached corpus URL or null if not found
 */
export function getCachedCorpusUrl() {
  return localStorage.getItem('lexflow-corpus-base-url');
}

/**
 * Load documents from corpus based on resolved URL
 * @param {string} corpusBaseUrl - Base URL for corpus
 * @returns {Promise<Array>} Array of available documents
 */
export async function loadDocumentsFromCorpus(corpusBaseUrl) {
  try {
    // Try to fetch document index from corpus
    const indexUrl = `${corpusBaseUrl}/index.json`;
    const response = await fetch(indexUrl);
    
    if (response.ok) {
      const documents = await response.json();
      console.log(`[LexFlow] Loaded ${documents.length} documents from corpus`);
      return documents;
    } else {
      console.warn('[LexFlow] Corpus index not found, using fallback documents');
      return getFallbackDocuments();
    }
  } catch (error) {
    console.warn('[LexFlow] Error loading corpus documents:', error);
    return getFallbackDocuments();
  }
}

/**
 * Get fallback documents when corpus is not available
 * @returns {Array} Fallback document list
 */
function getFallbackDocuments() {
  return [
    {
      id: 'constitution',
      title: 'Constitution',
      scope: 'Federal',
      articles: 250,
      year: 1988
    },
    {
      id: 'civil-code',
      title: 'Civil Code',
      scope: 'Federal',
      articles: 2046,
      year: 2002
    }
  ];
}