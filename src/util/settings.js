/**
 * Settings utility for LexFlow
 * Handles getting and setting application settings
 */

const SETTINGS_KEY = 'lexflow-settings';

/**
 * Get a setting value
 * @param {string} key - Setting key
 * @returns {Promise<any>} Setting value
 */
export async function getSetting(key) {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return settings[key];
  } catch (error) {
    console.error('[LexFlow] Error reading setting:', key, error);
    return null;
  }
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 * @returns {Promise<void>}
 */
export async function setSetting(key, value) {
  try {
    const settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    settings[key] = value;
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    console.log(`[LexFlow] Setting updated: ${key}`);
  } catch (error) {
    console.error('[LexFlow] Error saving setting:', key, error);
  }
}

/**
 * Get all settings
 * @returns {Promise<Object>} All settings
 */
export async function getAllSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
  } catch (error) {
    console.error('[LexFlow] Error reading settings:', error);
    return {};
  }
}

/**
 * Set multiple settings at once
 * @param {Object} settings - Settings object
 * @returns {Promise<void>}
 */
export async function setSettings(settings) {
  try {
    const current = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    const updated = { ...current, ...settings };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    console.log('[LexFlow] Multiple settings updated');
  } catch (error) {
    console.error('[LexFlow] Error saving settings:', error);
  }
}