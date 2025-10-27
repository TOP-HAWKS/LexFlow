/**
 * Stubbed persistence layer for LexFlow settings during tests/dev.
 * In produção será substituído por implementação real (IndexedDB/Chrome storage).
 */

const STORAGE_PREFIX = 'lexflow-setting:';

/**
 * Persiste um valor assíncronamente.
 * @param {string} key
 * @param {any} value
 * @returns {Promise<boolean>}
 */
export async function setSetting(key, value) {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(
                `${STORAGE_PREFIX}${key}`,
                JSON.stringify(value)
            );
        }
        return true;
    } catch (error) {
        return Promise.reject(error);
    }
}

/**
 * Recupera um valor previamente salvo.
 * @param {string} key
 * @param {any} defaultValue
 * @returns {Promise<any>}
 */
export async function getSetting(key, defaultValue = null) {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`);
            if (raw !== null) {
                return JSON.parse(raw);
            }
        }
        return defaultValue;
    } catch (error) {
        return Promise.reject(error);
    }
}
