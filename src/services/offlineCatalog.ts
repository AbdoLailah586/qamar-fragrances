import type { Product } from '../types';

const DB_NAME = 'qamar-offline-db';
const STORE_NAME = 'catalog';
const KEY = 'public-products';

export function deviceIsOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineCatalog(products: Product[]): Promise<boolean> {
  try {
    const db = await openDb();
    const publicList = products
      .filter(p => p.is_active !== false)
      .map(({ cost_price: _c, ...rest }) => rest);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ savedAt: Date.now(), products: publicList }, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

export async function readOfflineCatalog(): Promise<{ savedAt: number; products: Product[] } | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}
