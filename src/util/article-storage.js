/**
 * Article Storage Manager for LexFlow
 * Handles local storage of articles using IndexedDB
 */

const DB_NAME = 'LexFlowArticles';
const DB_VERSION = 1;
const STORE_NAME = 'articles';

/**
 * Initialize IndexedDB
 * @returns {Promise<IDBDatabase>} Database instance
 */
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create articles store
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'documentId' });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

/**
 * Store articles for a document
 * @param {string} documentId - Document ID
 * @param {Array} articles - Array of articles
 * @param {string} source - Source of articles ('remote' or 'mock')
 */
export async function storeArticles(documentId, articles, source = 'remote') {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const data = {
            documentId,
            articles,
            source,
            timestamp: Date.now()
        };
        
        await new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        console.log(`[LexFlow] Stored ${articles.length} articles for ${documentId} (${source})`);
    } catch (error) {
        console.error('Error storing articles:', error);
        // Fallback to localStorage
        const cacheKey = `lexflow-articles-${documentId}`;
        localStorage.setItem(cacheKey, JSON.stringify({
            articles,
            source,
            timestamp: Date.now()
        }));
    }
}

/**
 * Get stored articles for a document
 * @param {string} documentId - Document ID
 * @param {number} maxAge - Maximum age in milliseconds (default: 1 hour)
 * @returns {Promise<Array|null>} Articles array or null if not found/expired
 */
export async function getStoredArticles(documentId, maxAge = 3600000) {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        const data = await new Promise((resolve, reject) => {
            const request = store.get(documentId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        if (data && (Date.now() - data.timestamp < maxAge)) {
            console.log(`[LexFlow] Retrieved ${data.articles.length} cached articles for ${documentId} (${data.source})`);
            return data.articles;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting stored articles:', error);
        // Fallback to localStorage
        try {
            const cacheKey = `lexflow-articles-${documentId}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                if (Date.now() - data.timestamp < maxAge) {
                    return data.articles;
                }
            }
        } catch (fallbackError) {
            console.error('Fallback storage error:', fallbackError);
        }
        
        return null;
    }
}

/**
 * Clear all stored articles
 */
export async function clearStoredArticles() {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        await new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        console.log('[LexFlow] Cleared all stored articles');
    } catch (error) {
        console.error('Error clearing stored articles:', error);
        // Fallback: clear localStorage cache
        const keys = Object.keys(localStorage).filter(key => key.startsWith('lexflow-articles-'));
        keys.forEach(key => localStorage.removeItem(key));
    }
}

/**
 * Get storage statistics
 * @returns {Promise<Object>} Storage statistics
 */
export async function getStorageStats() {
    try {
        const db = await initDB();
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        
        const count = await new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        return {
            documentsStored: count,
            storageType: 'IndexedDB'
        };
    } catch (error) {
        console.error('Error getting storage stats:', error);
        const keys = Object.keys(localStorage).filter(key => key.startsWith('lexflow-articles-'));
        return {
            documentsStored: keys.length,
            storageType: 'localStorage (fallback)'
        };
    }
}