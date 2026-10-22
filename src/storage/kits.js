// Kits sauvegardés dans IndexedDB (base `makeitdrum`, store `kits`).
// Interface minimale injectée dans la bibliothèque : list, get, put, remove.
// Renvoie null si IndexedDB est indisponible (navigation privée, vieux navigateur).

const DB_NAME = 'makeitdrum';
const STORE = 'kits';

function request(req) {
  return new Promise(function (resolve, reject) {
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { reject(req.error); };
  });
}

export function createKitStore(indexedDB) {
  if (!indexedDB) return null;
  let dbPromise = null;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise(function (resolve, reject) {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = function () {
          req.result.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { reject(req.error); };
        req.onblocked = function () { reject(new Error('IndexedDB bloquée')); };
      });
    }
    return dbPromise;
  }

  async function withStore(mode, fn) {
    const db = await open();
    const tx = db.transaction(STORE, mode);
    const result = await fn(tx.objectStore(STORE));
    await new Promise(function (resolve, reject) {
      tx.oncomplete = resolve;
      tx.onerror = function () { reject(tx.error); };
      tx.onabort = function () { reject(tx.error); };
    });
    return result;
  }

  return {
    list: function () {
      return withStore('readonly', async function (store) {
        const all = await request(store.getAll());
        return all
          .map(function (k) { return { id: k.id, name: k.name, createdAt: k.createdAt }; })
          .sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); });
      });
    },
    get: function (id) {
      return withStore('readonly', function (store) { return request(store.get(id)); }).then(function (k) { return k || null; });
    },
    put: function (kit) {
      return withStore('readwrite', function (store) { return request(store.put(kit)); }).then(function () {});
    },
    remove: function (id) {
      return withStore('readwrite', function (store) { return request(store.delete(id)); }).then(function () {});
    },
  };
}
