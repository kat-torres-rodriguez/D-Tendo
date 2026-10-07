// Capa de datos: Firebase Realtime Database si hay configuración, si no localStorage (modo demo).
// API común:
//   store.onChange(cb)       → cb(estadoCompleto) cada vez que algo cambia
//   store.update({ 'ruta/a/campo': valor, ... })  → escritura multi-ruta (null borra)
//   store.inc(n)             → valor especial para sumar n a un número
//   store.onConnection(cb)   → cb(true|false)

const FB_VERSION = '10.12.2';

export async function createStore(config, familyKey) {
  const hasFirebase = config && config.databaseURL && config.apiKey;
  return hasFirebase ? firebaseStore(config, familyKey) : localStore(familyKey);
}

async function firebaseStore(config, familyKey) {
  const appMod = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`);
  const dbMod = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-database.js`);
  const app = appMod.initializeApp(config);
  const db = dbMod.getDatabase(app);
  const rootPath = `familias/${familyKey}`;
  const root = dbMod.ref(db, rootPath);

  return {
    mode: 'firebase',
    onChange(cb) {
      dbMod.onValue(root, snap => cb(snap.val() || {}), err => {
        console.error(err);
        alert('No se pudo leer la base de datos. Revisa las reglas de Firebase (README).');
      });
    },
    onConnection(cb) {
      dbMod.onValue(dbMod.ref(db, '.info/connected'), s => cb(!!s.val()));
    },
    update(changes) {
      return dbMod.update(root, changes);
    },
    inc(n) {
      return dbMod.increment(n);
    },
  };
}

function localStore(familyKey) {
  const KEY = `casaquest:${familyKey}`;
  const listeners = [];
  let state = load();

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn(e); }
  }
  function emit() {
    const snapshot = structuredClone(state);
    listeners.forEach(cb => cb(snapshot));
  }

  window.addEventListener('storage', e => {
    if (e.key === KEY) { state = load(); emit(); }
  });

  return {
    mode: 'local',
    onChange(cb) { listeners.push(cb); queueMicrotask(() => cb(structuredClone(state))); },
    onConnection(cb) { cb(true); },
    update(changes) {
      for (const [path, value] of Object.entries(changes)) {
        const parts = path.split('/').filter(Boolean);
        const last = parts.pop();
        let node = state;
        for (const p of parts) {
          if (typeof node[p] !== 'object' || node[p] === null) node[p] = {};
          node = node[p];
        }
        if (value === null || value === undefined) delete node[last];
        else if (value && value.__inc !== undefined) node[last] = (Number(node[last]) || 0) + value.__inc;
        else node[last] = structuredClone(value);
      }
      save();
      queueMicrotask(emit);
      return Promise.resolve();
    },
    inc(n) { return { __inc: n }; },
  };
}
