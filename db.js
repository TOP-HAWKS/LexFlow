// IndexedDB simples: history + config
const DB_NAME = "LexFlowDB";
const STORE_HISTORY = "history";
const STORE_CONFIG = "config";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_CONFIG)) {
        db.createObjectStore(STORE_CONFIG);
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e);
  });
}

async function saveHistory(item) {
  const db = await openDB();
  const tx = db.transaction(STORE_HISTORY, "readwrite");
  const store = tx.objectStore(STORE_HISTORY);
  item.id = crypto.randomUUID();
  item.data = new Date().toISOString();
  store.add(item);
  return new Promise((resolve) => tx.oncomplete = () => resolve(true));
}

async function getHistory() {
  const db = await openDB();
  const tx = db.transaction(STORE_HISTORY, "readonly");
  const store = tx.objectStore(STORE_HISTORY);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result || []).sort((a,b)=>b.data.localeCompare(a.data)));
    req.onerror = () => reject(req.error);
  });
}

async function clearHistory() {
  const db = await openDB();
  const tx = db.transaction(STORE_HISTORY, "readwrite");
  tx.objectStore(STORE_HISTORY).clear();
  return new Promise((resolve) => tx.oncomplete = () => resolve(true));
}

async function saveConfig(key, value) {
  const db = await openDB();
  const tx = db.transaction(STORE_CONFIG, "readwrite");
  tx.objectStore(STORE_CONFIG).put(value, key);
  return new Promise((resolve) => tx.oncomplete = () => resolve(true));
}

async function getConfig(key) {
  const db = await openDB();
  const tx = db.transaction(STORE_CONFIG, "readonly");
  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_CONFIG).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
