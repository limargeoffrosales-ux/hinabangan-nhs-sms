// Client-side advanced offline storage & queuing for teacher actions (attendance & grading) using IndexedDB
const DB_NAME = 'hinabangan_offline_db';
const STORE_NAME = 'pending_actions';
const DB_VERSION = 2;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

export async function queueOfflineAction(actionType, payload) {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add({
        actionType,
        payload,
        timestamp: Date.now(),
        retries: 0,
        conflictStrategy: 'last_write_wins',
      });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('IndexedDB unavailable, falling back to localStorage queue:', err);
    const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    queue.push({ id: Date.now(), actionType, payload, timestamp: Date.now(), retries: 0 });
    localStorage.setItem('offline_queue', JSON.stringify(queue));
    return true;
  }
}

export async function getPendingActions() {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result || [];
        // Sort by timestamp for chronological conflict resolution
        results.sort((a, b) => a.timestamp - b.timestamp);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    const queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    queue.sort((a, b) => a.timestamp - b.timestamp);
    return queue;
  }
}

export async function clearPendingAction(id) {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    let queue = JSON.parse(localStorage.getItem('offline_queue') || '[]');
    queue = queue.filter(item => item.id !== id);
    localStorage.setItem('offline_queue', JSON.stringify(queue));
    return true;
  }
}

export async function syncOfflineQueue(apiClient) {
  if (!navigator.onLine) return;
  const pending = await getPendingActions();
  for (const item of pending) {
    try {
      if (item.actionType === 'attendance') {
        await apiClient('/attendance/bulk', { method: 'POST', body: item.payload });
      } else if (item.actionType === 'grades') {
        await apiClient('/grades/class', { method: 'POST', body: item.payload });
      } else if (item.actionType === 'submission') {
        await apiClient('/submissions', { method: 'POST', body: item.payload });
      }
      await clearPendingAction(item.id);
    } catch (e) {
      console.error('Failed to sync offline action with conflict resolution retry:', item, e);
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    import('./api').then(({ api }) => {
      syncOfflineQueue(api);
    }).catch(() => {});
  });
}
