/**
 * Configuration Loader for LexFlow
 * Loads configuration from config.json with fallback to config.example.json
 */

/**
 * Load application configuration dynamically at runtime
 * @returns {Promise<Object>} Configuration object
 */
export async function loadAppConfig() {
  // Determine base URL based on context (extension vs web app)
  let base;
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
    // Chrome extension context
    base = chrome.runtime.getURL('src/config/');
  } else {
    // Web application context
    base = './src/config/';
  }
  
  async function fetchConfig(file) {
    const res = await fetch(base + file);
    if (!res.ok) throw new Error(`Missing config: ${file}`);
    return res.json();
  }
  
  try {
    return await fetchConfig('config.json');
  } catch {
    console.warn('[LexFlow] config.json not found, using fallback.');
    return await fetchConfig('config.example.json');
  }
}

/**
 * Initialize configuration and store in settings
 * @returns {Promise<Object>} Loaded configuration
 */
export async function initializeConfig() {
  try {
    const config = await loadAppConfig();
    
    // Store configuration in localStorage for quick access
    localStorage.setItem('lexflow-app-config', JSON.stringify(config));
    
    console.log('[LexFlow] Configuration loaded successfully');
    return config;
  } catch (error) {
    console.error('[LexFlow] Failed to load configuration:', error);
    throw new Error('[LexFlow] Missing configuration');
  }
}

/**
 * Get cached configuration from localStorage
 * @returns {Object|null} Cached configuration or null if not found
 */
export function getCachedConfig() {
  try {
    const cached = localStorage.getItem('lexflow-app-config');
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('[LexFlow] Error reading cached config:', error);
    return null;
  }
}