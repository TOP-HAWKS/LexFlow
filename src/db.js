const DB_NAME = 'lexflow_db';
const DB_VERSION = 2;
let dbp;

function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'k' });
      }
      if (!db.objectStoreNames.contains('submissions')) {
        const s = db.createObjectStore('submissions', { keyPath: 'id', autoIncrement: true });
        s.createIndex('status', 'status');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

// History (AI runs)
export async function saveHistory(item){
  const db = await openDB();
  return new Promise((res,rej)=>{
    const tx = db.transaction('history','readwrite');
    tx.objectStore('history').add(item);
    tx.oncomplete = ()=>res(true);
    tx.onerror = ()=>rej(tx.error);
  });
}
export async function listHistory(limit=20){
  const db = await openDB();
  return new Promise((res, rej)=>{
    const tx = db.transaction('history','readonly');
    const req = tx.objectStore('history').getAll();
    req.onsuccess = ()=> {
      const rows = (req.result||[]).sort((a,b)=>b.ts-a.ts).slice(0,limit);
      res(rows);
    };
    req.onerror = ()=>rej(req.error);
  });
}

// Settings
export async function setSetting(k, v){
  const db = await openDB();
  return new Promise((res,rej)=>{
    const tx = db.transaction('settings','readwrite');
    tx.objectStore('settings').put({ k, v });
    tx.oncomplete = ()=>res(true);
    tx.onerror = ()=>rej(tx.error);
  });
}
export async function getSetting(k){
  const db = await openDB();
  return new Promise((res,rej)=>{
    const tx = db.transaction('settings','readonly');
    const req = tx.objectStore('settings').get(k);
    req.onsuccess = ()=>res(req.result?.v);
    req.onerror = ()=>rej(req.error);
  });
}

// Make functions available globally for non-module usage
window.setSetting = setSetting;
window.getSetting = getSetting;

// Submissions queue (collector)
export async function addSubmission(item){
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('submissions','readwrite');
    tx.objectStore('submissions').add(item);
    tx.oncomplete = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}
export async function listSubmissions(status=null){
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('submissions','readonly');
    const store = tx.objectStore('submissions');
    const req = status ? store.index('status').getAll(status) : store.getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => rej(req.error);
  });
}
export async function updateSubmission(id, patch){
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction('submissions','readwrite');
    const store = tx.objectStore('submissions');
    const get = store.get(id);
    get.onsuccess = ()=>{
      const cur = get.result; if(!cur) return rej(new Error('not found'));
      Object.assign(cur, patch);
      store.put(cur);
    };
    tx.oncomplete = ()=>res(true);
    tx.onerror = ()=>rej(tx.error);
  });
}