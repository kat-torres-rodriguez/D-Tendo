import { firebaseConfig } from './config.js';
import { createStore } from './store.js';
import { RECETAS_BASE, BASICOS } from './recipes.js';

// ═══════════════ Utilidades ═══════════════
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const ls = {
  get(k, d = null) { try { const v = localStorage.getItem('cq_' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('cq_' + k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } },
};
const pad = n => String(n).padStart(2, '0');
const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t - y0) / 86400000 + 1) / 7)}`;
}
const timeAgo = ts => {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'recién';
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
};
const list = obj => Object.entries(obj || {}).map(([id, v]) => ({ id, ...v }));

// Normaliza nombres para comparar ingredientes: minúsculas, sin tildes, sin plurales.
function stem(word) {
  let w = word.replace(/s$/, '');
  if (/[lnrdzj]e$/.test(w) && w.length > 3) w = w.slice(0, -1);
  return w;
}
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9ñ ]/g, ' ').split(/\s+/).filter(Boolean).map(stem).join(' ');

// ═══════════════ Catálogos ═══════════════
const AVATARS = ['🧝', '🧙', '🧚', '🧝‍♀️', '🧙‍♀️', '🦊', '🐉', '🦉', '🐺', '🐸', '🍄', '🌙', '🦄', '🐱', '🐻', '🌟'];
const MISSION_ICONS = ['🧹', '🛏️', '🍽️', '🗑️', '🧺', '👕', '🐶', '🪴', '🛒', '📚', '🚿', '🧽', '🍳', '🧸', '🚗', '⚔️'];
const REWARD_ICONS = ['🎮', '📱', '🍕', '🍦', '🎬', '😴', '🎁', '💸', '🛹', '🎧', '🍫', '🏖️'];
const PANTRY_EMOJI = ['🥚', '🥛', '🧈', '🧀', '🍞', '🍚', '🍝', '🥔', '🍅', '🧅', '🧄', '🥕', '🍗', '🥩', '🐟', '🍎', '🍌', '🍓', '🥑', '🍋', '🥬', '🫘', '🌽', '🍫', '🧂', '🫙', '🥫', '🧃', '🧻', '🧼', '📦'];
const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'paq', 'lata', 'caja', 'bolsa', 'frasco'];
const NOTE_COLORS = ['yellow', 'pink', 'green', 'blue', 'violet', 'peach'];
const REACTIONS = ['❤️', '😂', '👍', '🔥', '😮'];
const GEMS = ['gem-teal', 'gem-rose', 'gem-violet', 'gem-amber', 'gem-sky', 'gem-moss'];
const gemFor = s => GEMS[[...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) % GEMS.length];

const TITLES = ['Aprendiz', 'Explorador', 'Guardabosques', 'Alquimista', 'Druida', 'Hechicero', 'Caballero del Bosque', 'Archimago', 'Guardián Ancestral', 'Leyenda'];
function levelInfo(xp = 0) {
  let lvl = 1, need = 100, rest = xp;
  while (rest >= need) { rest -= need; lvl++; need += 50; }
  return { lvl, cur: rest, need, title: TITLES[Math.min(lvl - 1, TITLES.length - 1)] };
}

const MEDALS = [
  { id: 'm1', icon: '🌱', name: 'Primer paso', desc: 'Completa tu primera misión', test: m => (m.done || 0) >= 1 },
  { id: 'm5', icon: '🍀', name: 'Ayudante', desc: '5 misiones completadas', test: m => (m.done || 0) >= 5 },
  { id: 'm10', icon: '⚔️', name: 'Aventurero', desc: '10 misiones completadas', test: m => (m.done || 0) >= 10 },
  { id: 'm25', icon: '🛡️', name: 'Héroe del hogar', desc: '25 misiones completadas', test: m => (m.done || 0) >= 25 },
  { id: 'm50', icon: '👑', name: 'Rey/Reina del bosque', desc: '50 misiones completadas', test: m => (m.done || 0) >= 50 },
  { id: 's3', icon: '🔥', name: 'En llamas', desc: 'Racha de 3 días', test: m => (m.best || 0) >= 3 },
  { id: 's7', icon: '🌟', name: 'Semana estelar', desc: 'Racha de 7 días', test: m => (m.best || 0) >= 7 },
  { id: 's30', icon: '🌙', name: 'Leyenda lunar', desc: 'Racha de 30 días', test: m => (m.best || 0) >= 30 },
  { id: 'p1', icon: '🧺', name: 'Recolector', desc: 'Registra una compra del súper', test: m => (m.stats?.purchases || 0) >= 1 },
  { id: 'p10', icon: '💰', name: 'Mercader', desc: 'Registra 10 compras', test: m => (m.stats?.purchases || 0) >= 10 },
  { id: 'c1', icon: '🍳', name: 'Aprendiz de cocina', desc: 'Cocina una receta', test: m => (m.stats?.cooked || 0) >= 1 },
  { id: 'c10', icon: '🧑‍🍳', name: 'Chef del reino', desc: 'Cocina 10 recetas', test: m => (m.stats?.cooked || 0) >= 10 },
  { id: 'n5', icon: '📜', name: 'Escriba', desc: 'Deja 5 notas en el muro', test: m => (m.stats?.notes || 0) >= 5 },
  { id: 'l5', icon: '✨', name: 'Mago nivel 5', desc: 'Llega al nivel 5', test: m => levelInfo(m.xp).lvl >= 5 },
];

const XP_PURCHASE = 25;
const XP_COOK = 30;

// ═══════════════ Estado ═══════════════
let store;
let S = {};               // estado compartido
let ready = false;
let me = ls.get('me');    // id del miembro en este dispositivo
let tab = ls.get('tab', 'missions');
let unlocked = ls.get('unlocked', false); // modo guardián desboqueado con PIN
const ui = { missionFilter: null, recipeFilter: 'can', recipeCat: 'Todas', recipeQuery: '', pantryQuery: '' };
let pendingRender = false;
let familyKey = null;
let online = true;

const members = () => list(S.members).sort((a, b) => (a.created || 0) - (b.created || 0));
const meM = () => (S.members || {})[me];
const isGuardian = () => meM()?.role === 'guardian' && unlocked;
const memberById = id => (S.members || {})[id];

// Nombres y claves personales no se pueden repetir entre integrantes.
const nameTaken = (name, exceptId) => members().some(x => x.id !== exceptId && norm(x.name) === norm(name));
const keyTaken = (key, exceptId) => members().some(x => x.id !== exceptId && String(x.key) === String(key));

function avatarHTML(m, cls = '') {
  if (!m) return `<div class="avatar ${cls}">❔</div>`;
  return `<div class="avatar ${cls}">${m.photo ? `<img src="${esc(m.photo)}" alt="">` : esc(m.avatar || '🧝')}</div>`;
}

// ═══════════════ Arranque ═══════════════
init();

async function init() {
  spawnFireflies();
  const usingFirebase = !!(firebaseConfig && firebaseConfig.databaseURL);
  const hashKey = new URLSearchParams(location.hash.slice(1)).get('k');
  if (hashKey) ls.set('family', hashKey);
  familyKey = usingFirebase ? (hashKey || ls.get('family')) : 'demo';

  if (!familyKey) return renderNoFamily();
  if (usingFirebase && !hashKey) history.replaceState(null, '', `#k=${familyKey}`);

  try {
    store = await createStore(firebaseConfig, familyKey);
  } catch (e) {
    console.error(e);
    $('#app').innerHTML = `<div class="splash"><div class="logo">Casa Quest</div><div class="panel"><p>No se pudo conectar con Firebase. Revisa <b>js/config.js</b>.</p></div></div>`;
    return;
  }
  store.onConnection(on => { online = on; const d = $('#conn'); if (d) d.classList.toggle('on', on); });
  store.onChange(data => {
    S = data;
    ready = true;
    if (me && !memberById(me)) { me = null; ls.set('me', null); }
    render();
  });

  $('#app').addEventListener('click', onClick);
  $('#app').addEventListener('change', onChangeEvt);
  $('#app').addEventListener('input', onInputEvt);
  $('#app').addEventListener('focusout', () => setTimeout(() => { if (pendingRender && !isTyping()) render(); }, 50));
}

function renderNoFamily() {
  $('#app').innerHTML = `
    <div class="splash">
      <div class="logo">Casa Quest<small>— LA AVENTURA DEL HOGAR —</small></div>
      <div class="panel"><div class="ribbon">Bienvenido</div>
        <p>Para entrar, <b>escanea el código QR</b> que está en la casa.</p>
        <p class="muted">¿Eres quien la configura por primera vez? Crea un nuevo reino:</p>
        <button class="btn teal block" id="newFamily">✨ Crear nuevo reino</button>
      </div>
    </div>`;
  $('#newFamily').onclick = () => {
    const k = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 20);
    location.hash = `k=${k}`;
    location.reload();
  };
}

function spawnFireflies() {
  const box = $('#fireflies');
  const n = window.innerWidth < 500 ? 16 : 26;
  for (let i = 0; i < n; i++) {
    const f = document.createElement('i');
    f.className = 'firefly';
    const r = (a, b) => a + Math.random() * (b - a);
    f.style.cssText = `left:${r(3, 97)}%;top:${r(15, 90)}%;--d:${r(7, 15)}s;--b:${r(2, 5)}s;--x1:${r(-40, 40)}px;--y1:${r(-50, 10)}px;--x2:${r(-40, 40)}px;--y2:${r(-30, 30)}px;animation-delay:${r(-10, 0)}s,${r(-5, 0)}s;transform:scale(${r(.5, 1.2)})`;
    box.appendChild(f);
  }
}

// ═══════════════ Render principal ═══════════════
const isTyping = () => {
  const a = document.activeElement;
  return a && $('#app').contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName);
};

function render() {
  if (!ready) return;
  if (isTyping()) { pendingRender = true; return; }
  pendingRender = false;
  const app = $('#app');
  const scroll = window.scrollY;

  if (!S.settings || !members().length) { app.innerHTML = setupHTML(); bindSetup(); return; }
  if (!me) { app.innerHTML = whoHTML(); return; }

  app.innerHTML = hudHTML() + `<main id="view">${viewHTML()}</main>` + navHTML();
  if (tab === 'recipes') renderRecipeList();
  if (tab === 'guild') drawQR();
  window.scrollTo(0, scroll);
}

function hudHTML() {
  const m = meM();
  const L = levelInfo(m.xp);
  return `
  <header class="hud">
    <button class="hud-avatar" data-act="profile" style="background:none;border:0;padding:0">
      ${avatarHTML(m)}<span class="lvl">Nv ${L.lvl}</span>
    </button>
    <div class="hud-mid">
      <span class="pill name">${esc(m.name)}</span>
      <div class="xpbar" title="Experiencia"><i style="width:${Math.round(L.cur / L.need * 100)}%"></i><span>${L.cur} / ${L.need} XP · ${esc(L.title)}</span></div>
    </div>
    <div class="hud-right">
      <span class="pill small">🪙 ${m.coins || 0}</span>
      <span class="pill small">🔥 ${currentStreak(m)}</span>
    </div>
  </header>`;
}

function navHTML() {
  const pendingMine = list(S.missions).filter(x => !isMissionDone(x) && (x.assignee === me || x.assignee === 'all')).length;
  const toBuy = shoppingItems().length;
  const tabs = [
    ['missions', '⚔️', 'Misiones', 'gem-teal', pendingMine],
    ['treasure', '🏆', 'Tesoro', 'gem-amber', isGuardian() ? list(S.redeems).filter(r => !r.delivered).length : 0],
    ['pantry', '🍄', 'Despensa', 'gem-moss', 0],
    ['shop', '🛒', 'Súper', 'gem-sky', toBuy],
    ['recipes', '📖', 'Recetas', 'gem-violet', 0],
    ['wall', '📜', 'Muro', 'gem-rose', 0],
  ];
  return `<nav class="nav">${tabs.map(([id, ic, lb, gem, badge]) => `
    <button class="navbtn ${tab === id ? 'active' : ''}" data-tab="${id}" aria-label="${lb}">
      <span class="bubble ${gem}">${ic}${badge ? `<span class="badge">${badge}</span>` : ''}</span>
      <span class="lbl">${lb}</span>
    </button>`).join('')}</nav>`;
}

function viewHTML() {
  switch (tab) {
    case 'missions': return missionsHTML();
    case 'treasure': return treasureHTML();
    case 'pantry': return pantryHTML();
    case 'shop': return shopHTML();
    case 'recipes': return recipesShellHTML();
    case 'wall': return wallHTML();
    case 'guild': return guildHTML();
    default: tab = 'missions'; return missionsHTML();
  }
}

// ═══════════════ Configuración inicial ═══════════════
function setupHTML() {
  return `
  <div class="splash">
    <div class="logo">Casa Quest<small>— LA AVENTURA DEL HOGAR —</small></div>
    <form class="panel" id="setupForm" style="text-align:left">
      <div class="ribbon">Funda tu reino</div>
      <div class="field"><label>Nombre del reino</label><input type="text" name="family" placeholder="Reino Torres" required maxlength="30"></div>
      <div class="field"><label>Tu nombre (guardián / adulto)</label><input type="text" name="g" placeholder="Mamá" required maxlength="20"></div>
      <div class="field"><label>Nombre del héroe (adolescente)</label><input type="text" name="h" placeholder="Tomás" required maxlength="20"></div>
      <div class="field"><label>PIN de guardián (4 dígitos, para crear misiones y premios)</label><input type="password" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" required placeholder="••••"></div>
      <p class="muted">Podrás agregar más integrantes después. Se crearán algunas misiones, premios y productos de ejemplo que puedes editar.</p>
      <button class="btn teal block" type="submit">✨ Comenzar la aventura</button>
    </form>
  </div>`;
}

function bindSetup() {
  $('#setupForm').onsubmit = e => {
    e.preventDefault();
    document.activeElement?.blur();
    const f = new FormData(e.target);
    const now = Date.now();
    if (norm(f.get('g')) === norm(f.get('h'))) { toast('El guardián y el héroe deben tener nombres distintos'); return; }
    const g = uid(), h = uid() + 'h';
    const c = {
      settings: { family: f.get('family').trim(), pin: f.get('pin'), created: now },
      [`members/${g}`]: { name: f.get('g').trim(), avatar: '🧙‍♀️', role: 'guardian', xp: 0, coins: 0, created: now },
      [`members/${h}`]: { name: f.get('h').trim(), avatar: '🧝', role: 'hero', xp: 0, coins: 0, created: now + 1 },
    };
    const missions = [
      ['Hacer la cama', '🛏️', 10, 'daily'], ['Lavar los platos de la cena', '🍽️', 20, 'daily'],
      ['Sacar la basura', '🗑️', 15, 'weekly'], ['Ordenar la pieza', '🧹', 40, 'weekly'],
      ['Doblar y guardar la ropa', '👕', 30, 'weekly'],
    ];
    missions.forEach(([title, icon, xp, freq], i) => {
      c[`missions/${uid()}${i}`] = { title, icon, xp, freq, assignee: h, createdBy: g, created: now + i };
    });
    [['30 min extra de pantalla', '🎮', 150], ['Elegir la cena del viernes', '🍕', 200], ['Postre favorito', '🍦', 120], ['Un día libre de platos', '😴', 300]]
      .forEach(([title, icon, cost], i) => { c[`rewards/${uid()}${i}`] = { title, icon, cost, created: now + i }; });
    [
      ['huevo', '🥚', 6, 'un', 6], ['leche', '🥛', 2, 'L', 2], ['pan', '🍞', 1, 'bolsa', 1], ['mantequilla', '🧈', 1, 'un', 1],
      ['queso', '🧀', 1, 'paq', 1], ['jamón', '🥩', 0, 'paq', 1], ['arroz', '🍚', 1, 'kg', 1], ['fideos', '🍝', 2, 'paq', 2],
      ['harina', '📦', 1, 'kg', 1], ['azúcar', '📦', 1, 'kg', 1], ['aceite', '🫙', 1, 'L', 1], ['papa', '🥔', 6, 'un', 5],
      ['cebolla', '🧅', 3, 'un', 3], ['ajo', '🧄', 1, 'un', 1], ['tomate', '🍅', 3, 'un', 4], ['zanahoria', '🥕', 2, 'un', 3],
      ['pollo', '🍗', 0, 'kg', 1], ['carne molida', '🥩', 0, 'kg', 1], ['atún', '🐟', 2, 'lata', 2], ['salsa de tomate', '🥫', 1, 'caja', 2],
      ['plátano', '🍌', 4, 'un', 4], ['manzana', '🍎', 3, 'un', 4], ['avena', '📦', 1, 'paq', 1], ['yogur', '🥛', 2, 'un', 4],
      ['canela', '🧂', 1, 'un', 1], ['orégano', '🧂', 1, 'un', 1], ['comino', '🧂', 1, 'un', 1], ['polvo de hornear', '📦', 1, 'un', 1],
      ['papel higiénico', '🧻', 4, 'un', 4], ['detergente', '🧼', 1, 'un', 1],
    ].forEach(([name, emoji, qty, unit, min], i) => { c[`pantry/${uid()}${i}`] = { name, emoji, qty, unit, min, created: now + i }; });
    c[`notes/${uid()}`] = { system: true, text: `🏰 ¡Se fundó el reino de ${f.get('family').trim()}! Que comience la aventura.`, ts: now };
    me = g; ls.set('me', g);
    unlocked = true; ls.set('unlocked', true);
    store.update(c);
  };
}

function whoHTML() {
  return `
  <div class="splash">
    <div class="logo">${esc(S.settings.family || 'Casa Quest')}<small>— ¿QUIÉN ENTRA AL BOSQUE? —</small></div>
    <div class="panel"><div class="ribbon">Elige tu personaje</div>
      <div class="who">${members().map(m => `
        <button data-act="pickMe" data-id="${m.id}">${avatarHTML(m, 'lg')}<span>${esc(m.name)}</span>
          <span class="pill small">${m.role === 'guardian' ? '🛡️ Guardián' : '⚔️ Héroe'}</span></button>`).join('')}
      </div>
    </div>
  </div>`;
}

// ═══════════════ Misiones ═══════════════
function isMissionDone(x) {
  if (x.freq === 'daily') return x.lastDone === dayKey();
  if (x.freq === 'weekly') return x.lastDone === weekKey();
  return !!x.doneAt;
}
const FREQ_LABEL = { once: 'Una vez', daily: 'Diaria', weekly: 'Semanal' };

function missionsHTML() {
  const all = list(S.missions).sort((a, b) => (a.created || 0) - (b.created || 0));
  const f = ui.missionFilter || (meM().role === 'guardian' ? 'all' : 'mine');
  const vis = all.filter(x => f === 'all' ? true : f === 'mine' ? (x.assignee === me || x.assignee === 'all') : x.assignee !== me);
  const open = vis.filter(x => !isMissionDone(x));
  const done = vis.filter(isMissionDone).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 12);
  const g = isGuardian();
  return `
  <section class="panel">
    <div class="ribbon">⚔️ Tablón de misiones</div>
    <div class="tabs">
      ${[['mine', 'Mis misiones'], ['others', 'De otros'], ['all', 'Todas']].map(([k, l]) => `<button class="tab ${f === k ? 'on' : ''}" data-act="mfilter" data-v="${k}">${l}</button>`).join('')}
    </div>
    ${open.length ? open.map(missionCard).join('') : `<div class="empty"><span class="big">🌿</span>¡No hay misiones pendientes aquí! El bosque está en paz.</div>`}
    <div class="panel-actions">
      <button class="btn ${g ? 'teal' : 'ghost'}" data-act="newMission">${g ? '➕ Nueva misión' : '🙋 Pedir ayuda a un guardián'}</button>
    </div>
    ${done.length ? `<div class="sub">✔ Completadas</div>${done.map(missionCard).join('')}` : ''}
  </section>`;
}

function missionCard(x) {
  const done = isMissionDone(x);
  const who = x.assignee === 'all' ? null : memberById(x.assignee);
  const canDo = !done && (x.assignee === me || x.assignee === 'all');
  const overdue = !done && x.freq === 'once' && x.due && x.due < dayKey();
  const doneBy = done && x.doneBy ? memberById(x.doneBy) : null;
  return `
  <div class="card ${done ? 'done' : ''}" data-mission="${x.id}">
    <span class="bubble sm ${gemFor(x.icon)}">${esc(x.icon || '⚔️')}</span>
    <div class="grow">
      <div class="title">${esc(x.title)}</div>
      <div class="meta">
        ${x.xp ? `<span class="chip xp">✦ ${x.xp} XP</span>` : `<span class="chip">🙋 petición</span>`}
        <span class="chip">${FREQ_LABEL[x.freq] || 'Una vez'}</span>
        ${x.due && x.freq === 'once' ? `<span class="chip ${overdue ? 'bad' : ''}">📅 ${esc(x.due.slice(5).split('-').reverse().join('/'))}</span>` : ''}
        ${who ? `<span class="chip">${avatarHTML(who, 'xs')} ${esc(who.name)}</span>` : `<span class="chip">👥 Cualquiera</span>`}
        ${doneBy ? `<span class="chip">✔ ${esc(doneBy.name)}</span>` : ''}
      </div>
    </div>
    ${done ? `<span class="stamp">¡HECHO!</span>${isGuardian() ? `<button class="bubble xs gem-red" data-act="undoMission" data-id="${x.id}" title="Deshacer">↺</button>` : ''}`
      : canDo ? `<button class="bubble gem-teal" data-act="complete" data-id="${x.id}" title="Marcar como realizada">✓</button>` : ''}
    ${isGuardian() && !done ? `<button class="bubble xs gem-amber" data-act="editMission" data-id="${x.id}" title="Editar">✎</button>` : ''}
  </div>`;
}

function completeMission(id, btn) {
  const x = S.missions[id];
  if (!x || isMissionDone(x)) return;
  const m = meM();
  const xp = Number(x.xp) || 0;
  const c = {
    [`missions/${id}/doneAt`]: Date.now(),
    [`missions/${id}/doneBy`]: me,
    [`missions/${id}/lastDone`]: x.freq === 'weekly' ? weekKey() : dayKey(),
  };
  const before = levelInfo(m.xp).lvl;
  const nm = structuredClone(m);
  nm.xp = (nm.xp || 0) + xp; nm.done = (nm.done || 0) + 1;
  Object.assign(c, streakChanges(nm), {
    [`members/${me}/xp`]: store.inc(xp), [`members/${me}/coins`]: store.inc(xp), [`members/${me}/done`]: store.inc(1),
  });
  const newMedals = medalChanges(nm, c);
  c[`notes/${uid()}`] = { system: true, text: `⚔️ ${m.name} completó «${x.title}»${xp ? ` (+${xp} XP)` : ''}`, ts: Date.now() };
  store.update(c);

  const r = btn?.getBoundingClientRect();
  if (r) { burst(r.left + r.width / 2, r.top + r.height / 2, 28); floatText(r.left, r.top, `+${xp} XP`); }
  chime();
  queueCelebration({ icon: x.icon || '🏅', title: '¡Misión cumplida!', text: x.title, xp });
  if (levelInfo(nm.xp).lvl > before) queueCelebration({ icon: '⭐', title: `¡Nivel ${levelInfo(nm.xp).lvl}!`, text: `Ahora eres ${levelInfo(nm.xp).title}` });
  newMedals.forEach(md => queueCelebration({ icon: md.icon, title: '¡Nueva medalla!', text: `${md.name}: ${md.desc}` }));
}

function undoMission(id) {
  const x = S.missions[id];
  if (!x || !confirm('¿Deshacer esta misión? Se le restarán los puntos a quien la completó.')) return;
  const who = x.doneBy;
  const xp = Number(x.xp) || 0;
  const c = { [`missions/${id}/doneAt`]: null, [`missions/${id}/doneBy`]: null, [`missions/${id}/lastDone`]: null };
  if (who && memberById(who)) {
    c[`members/${who}/xp`] = store.inc(-xp);
    c[`members/${who}/coins`] = store.inc(-xp);
    c[`members/${who}/done`] = store.inc(-1);
  }
  store.update(c);
}

function currentStreak(m) {
  if (!m.lastDay) return 0;
  return (m.lastDay === dayKey() || m.lastDay === yesterdayKey()) ? (m.streak || 0) : 0;
}
function streakChanges(nm) {
  const t = dayKey();
  if (nm.lastDay !== t) {
    nm.streak = nm.lastDay === yesterdayKey() ? (nm.streak || 0) + 1 : 1;
    nm.lastDay = t;
    nm.best = Math.max(nm.best || 0, nm.streak);
  }
  return { [`members/${me}/streak`]: nm.streak, [`members/${me}/lastDay`]: nm.lastDay, [`members/${me}/best`]: nm.best || nm.streak };
}
function medalChanges(nm, c) {
  const got = nm.medals || {};
  const fresh = MEDALS.filter(md => !got[md.id] && md.test(nm));
  fresh.forEach(md => { c[`members/${me}/medals/${md.id}`] = Date.now(); });
  return fresh;
}
// Para acciones fuera de misiones (compras, cocina, notas)
function awardStat(stat, xp, label) {
  const m = meM();
  const nm = structuredClone(m);
  nm.stats = { ...(nm.stats || {}), [stat]: (nm.stats?.[stat] || 0) + 1 };
  nm.xp = (nm.xp || 0) + xp;
  const before = levelInfo(m.xp).lvl;
  const c = { [`members/${me}/stats/${stat}`]: store.inc(1) };
  if (xp) { c[`members/${me}/xp`] = store.inc(xp); c[`members/${me}/coins`] = store.inc(xp); }
  const fresh = medalChanges(nm, c);
  if (xp && levelInfo(nm.xp).lvl > before) queueCelebration({ icon: '⭐', title: `¡Nivel ${levelInfo(nm.xp).lvl}!`, text: `Ahora eres ${levelInfo(nm.xp).title}` });
  fresh.forEach(md => queueCelebration({ icon: md.icon, title: '¡Nueva medalla!', text: `${md.name}: ${md.desc}` }));
  if (label) c[`notes/${uid()}`] = { system: true, text: label, ts: Date.now() };
  return c;
}

function missionForm(id) {
  const x = id ? S.missions[id] : null;
  const g = isGuardian();
  const st = { icon: x?.icon || (g ? '🧹' : '🙋'), freq: x?.freq || 'once' };
  const opts = (g ? members() : members().filter(m => m.role === 'guardian'))
    .map(m => `<option value="${m.id}" ${x?.assignee === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
  openModal(g ? (x ? 'Editar misión' : 'Nueva misión') : 'Pedir ayuda', `
    <form id="mf">
      <div class="field"><label>${g ? 'Misión' : '¿Qué necesitas?'}</label><input type="text" name="title" required maxlength="60" value="${esc(x?.title || '')}" placeholder="${g ? 'Lavar los platos' : 'Llevarme al entrenamiento el sábado'}"></div>
      <div class="field"><label>Ícono</label><div class="picker" data-pick="icon">${(g ? MISSION_ICONS : ['🙋', '🚗', '💸', '📚', '🍕', '🎮', '🛒', '❤️']).map(i => `<button type="button" class="${i === st.icon ? 'on' : ''}" data-v="${i}">${i}</button>`).join('')}</div></div>
      <div class="field"><label>${g ? 'Asignar a' : 'Para'}</label><select name="assignee">${g ? `<option value="all" ${x?.assignee === 'all' ? 'selected' : ''}>👥 Cualquiera</option>` : ''}${opts}</select></div>
      ${g ? `<div class="row">
        <div class="field"><label>Puntos (XP)</label><input type="number" name="xp" min="0" max="500" step="5" value="${x?.xp ?? 20}"></div>
        <div class="field"><label>Fecha límite</label><input type="date" name="due" value="${esc(x?.due || '')}"></div>
      </div>
      <div class="field"><label>Frecuencia</label><div class="picker wide" data-pick="freq">${Object.entries(FREQ_LABEL).map(([k, l]) => `<button type="button" class="${k === st.freq ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div></div>` : ''}
      <div class="panel-actions">
        ${x ? `<button type="button" class="btn danger" id="delM">🗑 Borrar</button>` : ''}
        <button type="submit" class="btn teal">${x ? 'Guardar' : g ? '⚔️ Publicar misión' : '📨 Enviar'}</button>
      </div>
    </form>`, root => {
    bindPickers(root, st);
    $('#mf', root).onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const mid = id || uid();
      const data = {
        ...(x || {}), title: f.get('title').trim(), icon: st.icon, assignee: f.get('assignee'),
        xp: g ? Number(f.get('xp')) || 0 : 0, freq: g ? st.freq : 'once', due: g ? f.get('due') : '',
        createdBy: x?.createdBy || me, created: x?.created || Date.now(),
      };
      store.update({ [`missions/${mid}`]: data });
      closeModal();
      toast(x ? 'Misión actualizada' : g ? '⚔️ ¡Misión publicada!' : '📨 Petición enviada');
    };
    const del = $('#delM', root);
    if (del) del.onclick = () => { if (confirm('¿Borrar esta misión?')) { store.update({ [`missions/${id}`]: null }); closeModal(); } };
  });
}

// ═══════════════ Tesoro: progreso, medallas, premios ═══════════════
function treasureHTML() {
  const m = meM();
  const L = levelInfo(m.xp);
  const got = m.medals || {};
  const rewards = list(S.rewards).sort((a, b) => a.cost - b.cost);
  const redeems = list(S.redeems).sort((a, b) => b.ts - a.ts);
  const pend = redeems.filter(r => !r.delivered);
  const g = isGuardian();
  const ranking = members().filter(x => x.role === 'hero' || (x.xp || 0) > 0).sort((a, b) => (b.xp || 0) - (a.xp || 0));
  return `
  <section class="panel">
    <div class="ribbon">🏆 ${esc(L.title)}</div>
    <div class="stats">
      <div class="stat"><b>${L.lvl}</b><span>NIVEL</span></div>
      <div class="stat"><b>${m.xp || 0}</b><span>XP TOTAL</span></div>
      <div class="stat"><b>${m.done || 0}</b><span>MISIONES</span></div>
      <div class="stat"><b>🔥${currentStreak(m)}</b><span>RACHA</span></div>
      <div class="stat"><b>${m.best || 0}</b><span>MEJOR RACHA</span></div>
      <div class="stat"><b>🪙${m.coins || 0}</b><span>MONEDAS</span></div>
    </div>
  </section>

  <section class="panel">
    <div class="ribbon">🎁 Tienda de premios</div>
    <p class="muted" style="margin-top:0">Canjea tus monedas 🪙 por recompensas. Un guardián te las entrega.</p>
    ${rewards.length ? rewards.map(r => `
      <div class="card">
        <span class="bubble sm ${gemFor(r.icon)}">${esc(r.icon)}</span>
        <div class="grow"><div class="title">${esc(r.title)}</div><div class="meta"><span class="chip warn">🪙 ${r.cost}</span></div></div>
        <button class="btn small ${(m.coins || 0) >= r.cost ? 'teal' : 'ghost'}" data-act="redeem" data-id="${r.id}" ${(m.coins || 0) >= r.cost ? '' : 'disabled'}>Canjear</button>
        ${g ? `<button class="bubble xs gem-red" data-act="delReward" data-id="${r.id}" title="Borrar">✕</button>` : ''}
      </div>`).join('') : `<div class="empty">Aún no hay premios.</div>`}
    ${g ? `<div class="panel-actions"><button class="btn teal" data-act="newReward">➕ Nuevo premio</button></div>` : ''}
    ${pend.length ? `<div class="sub">⏳ Canjes por entregar</div>${pend.map(r => {
      const who = memberById(r.member);
      return `<div class="card"><span class="bubble xs gem-amber">${esc(r.icon)}</span><div class="grow"><div class="title">${esc(r.title)}</div>
        <div class="meta"><span class="chip">${esc(who?.name || '¿?')}</span><span class="chip">${timeAgo(r.ts)}</span></div></div>
        ${g ? `<button class="btn small teal" data-act="deliver" data-id="${r.id}">✓ Entregado</button>` : `<span class="chip warn">pendiente</span>`}</div>`;
    }).join('')}` : ''}
  </section>

  <section class="panel">
    <div class="ribbon">🎖️ Medallas</div>
    <div class="medals">${MEDALS.map(md => `
      <div class="mini-medal ${got[md.id] ? '' : 'locked'}" title="${esc(md.desc)}"><div class="m">${md.icon}</div>${esc(md.name)}</div>`).join('')}
    </div>
  </section>

  ${ranking.length > 1 ? `<section class="panel leader"><div class="ribbon">📊 Gremio</div>${ranking.map((x, i) => `
    <div class="card">${['🥇', '🥈', '🥉'][i] || '🎖️'} ${avatarHTML(x, 'sm')}<div class="grow"><div class="title">${esc(x.name)}</div><div class="meta"><span class="chip">Nv ${levelInfo(x.xp).lvl}</span></div></div><span class="chip xp">${x.xp || 0} XP</span></div>`).join('')}
  </section>` : ''}`;
}

function rewardForm() {
  const st = { icon: '🎮' };
  openModal('Nuevo premio', `
    <form id="rf">
      <div class="field"><label>Premio</label><input type="text" name="title" required maxlength="50" placeholder="1 hora extra de consola"></div>
      <div class="field"><label>Ícono</label><div class="picker" data-pick="icon">${REWARD_ICONS.map(i => `<button type="button" class="${i === st.icon ? 'on' : ''}" data-v="${i}">${i}</button>`).join('')}</div></div>
      <div class="field"><label>Costo en monedas 🪙</label><input type="number" name="cost" min="10" step="10" value="150" required></div>
      <div class="panel-actions"><button class="btn teal" type="submit">💎 Agregar a la tienda</button></div>
    </form>`, root => {
    bindPickers(root, st);
    $('#rf', root).onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      store.update({ [`rewards/${uid()}`]: { title: f.get('title').trim(), icon: st.icon, cost: Number(f.get('cost')), created: Date.now() } });
      closeModal();
    };
  });
}

function redeem(id, btn) {
  const r = S.rewards[id], m = meM();
  if (!r || (m.coins || 0) < r.cost) return;
  if (!confirm(`¿Canjear «${r.title}» por ${r.cost} monedas?`)) return;
  store.update({
    [`members/${me}/coins`]: store.inc(-r.cost),
    [`redeems/${uid()}`]: { rewardId: id, title: r.title, icon: r.icon, cost: r.cost, member: me, ts: Date.now(), delivered: false },
    [`notes/${uid()}`]: { system: true, text: `🎁 ${m.name} canjeó «${r.title}»`, ts: Date.now() },
  });
  const b = btn.getBoundingClientRect();
  burst(b.left + b.width / 2, b.top, 20, ['🪙', '✦', '💎']);
  chime();
  queueCelebration({ icon: r.icon, title: '¡Premio canjeado!', text: `${r.title}. Avísale a un guardián para que te lo entregue.` });
}

// ═══════════════ Despensa ═══════════════
function pantryHTML() {
  const q = norm(ui.pantryQuery);
  const items = list(S.pantry).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    .filter(p => !q || norm(p.name).includes(q));
  const low = items.filter(p => (p.qty || 0) < (p.min || 0)).length;
  return `
  <section class="panel">
    <div class="ribbon">🍄 Despensa mágica</div>
    <div class="row" style="align-items:center;margin-bottom:8px">
      <input type="search" id="pantryQ" placeholder="🔎 Buscar..." value="${esc(ui.pantryQuery)}" style="flex:2">
      <button class="btn teal small" data-act="newItem" style="flex:0 0 auto">➕ Agregar</button>
    </div>
    <p class="muted" style="margin:0 0 8px">Usa ➖ ➕ cuando se usa o se compra algo. ${low ? `<b style="color:#ffd9a6">${low} producto(s) bajo el mínimo</b> ya están en la lista del súper.` : 'Todo está sobre el mínimo ✨'}</p>
    <div id="pantryList">${items.map(p => {
      const isLow = (p.qty || 0) < (p.min || 0);
      return `
      <div class="card ${isLow ? 'low' : ''}">
        <span class="bubble xs ${isLow ? 'gem-red' : 'gem-moss'}">${esc(p.emoji || '📦')}</span>
        <div class="grow" data-act="editItem" data-id="${p.id}" style="cursor:pointer">
          <div class="title">${esc(p.name)}</div>
          <div class="meta"><span class="chip ${isLow ? 'warn' : ''}">mín ${p.min || 0} ${esc(p.unit || '')}</span></div>
        </div>
        <div class="qty">
          <button class="bubble xs gem-rose" data-act="qty" data-id="${p.id}" data-d="-1" aria-label="Restar">−</button>
          <b>${fmtNum(p.qty)}</b>
          <button class="bubble xs gem-teal" data-act="qty" data-id="${p.id}" data-d="1" aria-label="Sumar">+</button>
        </div>
      </div>`;
    }).join('') || `<div class="empty"><span class="big">🫙</span>La despensa está vacía.</div>`}</div>
  </section>`;
}
const fmtNum = n => { n = Number(n) || 0; return Number.isInteger(n) ? n : n.toFixed(1); };

function itemForm(id) {
  const p = id ? S.pantry[id] : null;
  const st = { emoji: p?.emoji || '📦' };
  openModal(p ? 'Editar producto' : 'Nuevo producto', `
    <form id="pf">
      <div class="field"><label>Nombre</label><input type="text" name="name" required maxlength="40" value="${esc(p?.name || '')}" placeholder="leche"></div>
      <div class="field"><label>Ícono</label><div class="picker" data-pick="emoji">${PANTRY_EMOJI.map(i => `<button type="button" class="${i === st.emoji ? 'on' : ''}" data-v="${i}">${i}</button>`).join('')}</div></div>
      <div class="row">
        <div class="field"><label>Hay</label><input type="number" name="qty" min="0" step="any" value="${p?.qty ?? 1}"></div>
        <div class="field"><label>Mínimo</label><input type="number" name="min" min="0" step="any" value="${p?.min ?? 1}"></div>
        <div class="field"><label>Unidad</label><select name="unit">${UNITS.map(u => `<option ${u === (p?.unit || 'un') ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
      </div>
      <p class="muted">Cuando lo que hay baje del mínimo, aparece solo en la lista del súper. Pon mínimo 0 si no quieres que se agregue.</p>
      <div class="panel-actions">
        ${p ? `<button type="button" class="btn danger" id="delP">🗑 Borrar</button>` : ''}
        <button type="submit" class="btn teal">Guardar</button>
      </div>
    </form>`, root => {
    bindPickers(root, st);
    $('#pf', root).onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const name = f.get('name').trim();
      const dup = !p && list(S.pantry).find(x => norm(x.name) === norm(name));
      const pid = id || dup?.id || uid();
      store.update({ [`pantry/${pid}`]: { ...(p || dup || {}), name, emoji: st.emoji, qty: Number(f.get('qty')) || 0, min: Number(f.get('min')) || 0, unit: f.get('unit'), created: p?.created || Date.now() } });
      closeModal();
    };
    const del = $('#delP', root);
    if (del) del.onclick = () => { if (confirm('¿Borrar este producto de la despensa?')) { store.update({ [`pantry/${id}`]: null }); closeModal(); } };
  });
}

// ═══════════════ Lista del súper ═══════════════
// Ítems = productos bajo el mínimo (automáticos) + extras agregados a mano.
function shoppingItems() {
  const auto = list(S.pantry).filter(p => (p.qty || 0) < (p.min || 0)).map(p => ({
    key: 'p_' + p.id, pantryId: p.id, name: p.name, emoji: p.emoji, unit: p.unit, need: Math.max(1, Math.ceil((p.min || 0) - (p.qty || 0))), auto: true,
  }));
  const extra = list(S.shop).map(s => ({ key: 'x_' + s.id, extraId: s.id, name: s.name, emoji: s.emoji || '🛒', unit: s.unit || 'un', need: s.qty || 1, auto: false }));
  return [...auto, ...extra];
}

function shopHTML() {
  const items = shoppingItems();
  const checks = S.shopChecks || {};
  const nChecked = items.filter(i => checks[i.key] !== undefined).length;
  return `
  <section class="panel">
    <div class="ribbon">🛒 Lista del súper</div>
    <p class="muted" style="margin-top:0">Se arma sola con lo que falta en la despensa. En el súper, toca ⭘ al echar algo al carro y ajusta la cantidad. Al volver, <b>registra la compra</b> para cargarla a la despensa y ganar <b>+${XP_PURCHASE} XP</b>.</p>
    ${items.length ? items.map(i => {
      const on = checks[i.key] !== undefined;
      return `
      <div class="card ${on ? 'done' : ''}">
        <button class="check ${on ? 'on' : ''}" data-act="check" data-key="${i.key}" data-need="${i.need}" aria-label="Marcar">${on ? '✓' : ''}</button>
        <div class="grow">
          <div class="title">${esc(i.emoji || '')} ${esc(i.name)}</div>
          <div class="meta">${i.auto ? `<span class="chip warn">auto · falta ${i.need} ${esc(i.unit)}</span>` : `<span class="chip">extra</span>`}</div>
        </div>
        ${on ? `<input class="qty-in" type="number" min="0" step="any" value="${checks[i.key]}" data-act="checkQty" data-key="${i.key}" aria-label="Cantidad comprada">` : ''}
        ${!i.auto ? `<button class="bubble xs gem-red" data-act="delExtra" data-id="${i.extraId}" title="Quitar">✕</button>` : ''}
      </div>`;
    }).join('') : `<div class="empty"><span class="big">🧺</span>¡No falta nada! La despensa está llena.</div>`}
    <form id="extraForm" class="row" style="margin-top:6px">
      <input type="text" name="name" placeholder="Agregar algo más… (ej: globos)" maxlength="40" required>
      <button class="btn small ghost" style="flex:0 0 auto">➕</button>
    </form>
    <div class="panel-actions">
      <button class="btn teal block" data-act="registerPurchase" ${nChecked ? '' : 'disabled'}>🧺 Registrar compra (${nChecked})</button>
    </div>
  </section>`;
}

function registerPurchase(btn) {
  const items = shoppingItems();
  const checks = S.shopChecks || {};
  const bought = items.filter(i => checks[i.key] !== undefined && Number(checks[i.key]) > 0);
  if (!bought.length) { toast('Marca al menos un producto con cantidad'); return; }
  const c = {};
  const pantry = list(S.pantry);
  bought.forEach(i => {
    const q = Number(checks[i.key]);
    const pid = i.pantryId || pantry.find(p => norm(p.name) === norm(i.name))?.id;
    if (pid) c[`pantry/${pid}/qty`] = store.inc(q);
    else c[`pantry/${uid()}`] = { name: i.name, emoji: i.emoji === '🛒' ? '📦' : i.emoji, qty: q, min: 0, unit: i.unit || 'un', created: Date.now() };
    if (i.extraId) c[`shop/${i.extraId}`] = null;
  });
  c.shopChecks = null;
  Object.assign(c, awardStat('purchases', XP_PURCHASE, `🧺 ${meM().name} registró la compra del súper (${bought.length} productos)`));
  store.update(c);
  const r = btn.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top, 30, ['🛒', '✦', '🥕', '🍎']);
  chime();
  queueCelebration({ icon: '🧺', title: '¡Compra registrada!', text: `${bought.length} productos guardados en la despensa`, xp: XP_PURCHASE });
}

// ═══════════════ Recetas ═══════════════
function allRecipes() {
  const custom = S.recipes || {};
  const hidden = S.hiddenRecipes || {};
  const base = RECETAS_BASE.filter(r => !hidden[r.id]).map(r => custom[r.id] ? { ...custom[r.id], id: r.id, base: true } : { ...r, base: true });
  const extra = list(custom).filter(r => !RECETAS_BASE.some(b => b.id === r.id));
  return [...base, ...extra].map(r => ({ ...r, ing: r.ing || [], steps: r.steps || [] }));
}
function pantryHave() {
  const have = new Set();
  list(S.pantry).forEach(p => { if ((p.qty || 0) > 0) have.add(norm(p.name)); });
  BASICOS.forEach(b => have.add(norm(b)));
  return have;
}
function recipeMatch(r, have) {
  const needed = r.ing.filter(([n]) => !BASICOS.includes(n));
  const missing = needed.filter(([n]) => !have.has(norm(n)));
  return { total: needed.length, missing, pct: needed.length ? (needed.length - missing.length) / needed.length : 1 };
}

function recipesShellHTML() {
  const cats = ['Todas', 'Desayuno', 'Almuerzo', 'Cena', 'Snack', 'Postre'];
  return `
  <section class="panel">
    <div class="ribbon">📖 Libro de recetas</div>
    <input type="search" id="recipeQ" placeholder="🔎 Buscar receta o ingrediente..." value="${esc(ui.recipeQuery)}" style="margin-bottom:8px">
    <div class="tabs">${[['can', '✅ Puedo hacerla'], ['almost', '🟡 Me falta poco'], ['all', '📚 Todas']].map(([k, l]) => `<button class="tab ${ui.recipeFilter === k ? 'on' : ''}" data-act="rfilter" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="tabs">${cats.map(c => `<button class="tab ${ui.recipeCat === c ? 'on' : ''}" data-act="rcat" data-v="${c}">${c}</button>`).join('')}</div>
    <div id="recipeList"></div>
    <div class="panel-actions"><button class="btn teal" data-act="newRecipe">✍️ Nueva receta</button></div>
  </section>`;
}

function renderRecipeList() {
  const box = $('#recipeList');
  if (!box) return;
  const have = pantryHave();
  const q = norm(ui.recipeQuery);
  let rs = allRecipes().map(r => ({ ...r, m: recipeMatch(r, have) }));
  if (ui.recipeCat !== 'Todas') rs = rs.filter(r => r.cat === ui.recipeCat);
  if (q) rs = rs.filter(r => norm(r.name).includes(q) || r.ing.some(([n]) => norm(n).includes(q)));
  if (ui.recipeFilter === 'can') rs = rs.filter(r => r.m.missing.length === 0);
  if (ui.recipeFilter === 'almost') rs = rs.filter(r => r.m.missing.length > 0 && r.m.missing.length <= 2);
  rs.sort((a, b) => a.m.missing.length - b.m.missing.length || a.name.localeCompare(b.name, 'es'));
  box.innerHTML = rs.length ? rs.map(r => `
    <div class="card" data-act="openRecipe" data-id="${r.id}" style="cursor:pointer">
      <div class="recipe-emoji">${esc(r.emoji || '🍽️')}</div>
      <div class="grow">
        <div class="title">${esc(r.name)}</div>
        <div class="meta">
          <span class="chip">${esc(r.cat || '')}</span><span class="chip">⏱ ${esc(r.time || '?')}</span><span class="chip">${'⭐'.repeat(r.diff || 1)}</span>
          ${r.m.missing.length ? `<span class="chip warn">faltan ${r.m.missing.length}</span>` : `<span class="chip xp">¡lista!</span>`}
        </div>
        <div class="match"><i style="width:${Math.round(r.m.pct * 100)}%"></i></div>
      </div>
    </div>`).join('')
    : `<div class="empty"><span class="big">🍃</span>${ui.recipeFilter === 'can' ? 'Con lo que hay no alcanza para ninguna receta de esta categoría. Prueba "Me falta poco".' : 'No se encontraron recetas.'}</div>`;
}

function openRecipe(id) {
  const r = allRecipes().find(x => x.id === id);
  if (!r) return;
  const have = pantryHave();
  const m = recipeMatch(r, have);
  openModal(`${r.emoji || '🍽️'} ${r.name}`, `
    <div class="meta" style="justify-content:center;margin-bottom:12px"><span class="chip">${esc(r.cat || '')}</span><span class="chip">⏱ ${esc(r.time || '?')}</span><span class="chip">${'⭐'.repeat(r.diff || 1)}</span></div>
    <div class="sub">Ingredientes</div>
    <ul class="ing-list">${r.ing.map(([n, q]) => {
      const basic = BASICOS.includes(n);
      const ok = basic || have.has(norm(n));
      return `<li class="${ok ? 'have' : 'missing'}"><span>${ok ? '✓' : '✗'} ${esc(n)}</span><span>${esc(q || '')}</span></li>`;
    }).join('')}</ul>
    <div class="sub">Preparación</div>
    <ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    <div class="panel-actions">
      <button class="btn ghost small" id="editR">✎ Editar</button>
      ${m.missing.length ? `<button class="btn small" id="addMissing">🛒 Agregar ${m.missing.length} faltante(s) a la lista</button>` : ''}
      <button class="btn teal" id="cooked">🍳 ¡La cociné! +${XP_COOK} XP</button>
    </div>`, root => {
    $('#editR', root).onclick = () => { closeModal(); recipeForm(id); };
    const add = $('#addMissing', root);
    if (add) add.onclick = () => {
      const c = {};
      const extras = list(S.shop).map(s => norm(s.name));
      m.missing.forEach(([n]) => {
        const p = list(S.pantry).find(x => norm(x.name) === norm(n));
        if (p) { if ((p.min || 0) <= (p.qty || 0)) c[`pantry/${p.id}/min`] = (p.qty || 0) + 1; }
        else if (!extras.includes(norm(n))) c[`shop/${uid()}`] = { name: n, qty: 1, unit: 'un', ts: Date.now() };
      });
      store.update(c);
      toast('🛒 Agregado a la lista del súper');
      closeModal();
    };
    $('#cooked', root).onclick = e => {
      const b = e.target.getBoundingClientRect();
      store.update(awardStat('cooked', XP_COOK, `🍳 ${meM().name} cocinó ${r.name}`));
      burst(b.left + b.width / 2, b.top, 26, ['🍳', '✦', '⭐', '🔥']);
      chime();
      closeModal();
      queueCelebration({ icon: r.emoji || '🍳', title: '¡Chef en acción!', text: `Cocinaste ${r.name}. No olvides descontar en la despensa lo que usaste.`, xp: XP_COOK });
    };
  });
}

function recipeForm(id) {
  const r = id ? allRecipes().find(x => x.id === id) : null;
  const st = { cat: r?.cat || 'Almuerzo' };
  openModal(r ? 'Editar receta' : 'Nueva receta', `
    <form id="recf">
      <div class="row">
        <div class="field" style="flex:0 0 70px"><label>Emoji</label><input type="text" name="emoji" maxlength="4" value="${esc(r?.emoji || '🍲')}" style="text-align:center"></div>
        <div class="field"><label>Nombre</label><input type="text" name="name" required maxlength="50" value="${esc(r?.name || '')}" placeholder="Cazuela de la abuela"></div>
      </div>
      <div class="field"><label>Tipo</label><div class="picker wide" data-pick="cat">${['Desayuno', 'Almuerzo', 'Cena', 'Snack', 'Postre'].map(c => `<button type="button" class="${c === st.cat ? 'on' : ''}" data-v="${c}">${c}</button>`).join('')}</div></div>
      <div class="row">
        <div class="field"><label>Tiempo</label><input type="text" name="time" maxlength="15" value="${esc(r?.time || '30 min')}"></div>
        <div class="field"><label>Dificultad</label><select name="diff">${[1, 2, 3].map(d => `<option value="${d}" ${d === (r?.diff || 1) ? 'selected' : ''}>${'⭐'.repeat(d)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Ingredientes (uno por línea: nombre - cantidad)</label>
        <textarea name="ing" rows="6" required placeholder="huevo - 2&#10;leche - 1 taza&#10;harina - 200 g">${esc((r?.ing || []).map(([n, q]) => q ? `${n} - ${q}` : n).join('\n'))}</textarea></div>
      <p class="muted" style="margin-top:-6px">Usa los mismos nombres que en la despensa (ej: "huevo", "carne molida") para que la app sepa si lo tienes.</p>
      <div class="field"><label>Pasos (uno por línea)</label>
        <textarea name="steps" rows="6" required>${esc((r?.steps || []).join('\n'))}</textarea></div>
      <div class="panel-actions">
        ${r ? `<button type="button" class="btn danger" id="delR">🗑 ${r.base ? 'Ocultar' : 'Borrar'}</button>` : ''}
        <button type="submit" class="btn teal">📖 Guardar receta</button>
      </div>
    </form>`, root => {
    bindPickers(root, st);
    $('#recf', root).onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const rid = id || 'u' + uid();
      const ing = f.get('ing').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
        const [n, ...q] = l.split(/\s+-\s+|:\s*/);
        return [n.trim().toLowerCase(), q.join(' - ').trim()];
      });
      const steps = f.get('steps').split('\n').map(l => l.trim()).filter(Boolean);
      store.update({ [`recipes/${rid}`]: { name: f.get('name').trim(), emoji: f.get('emoji').trim() || '🍲', cat: st.cat, time: f.get('time').trim(), diff: Number(f.get('diff')), ing, steps, by: me, ts: Date.now() } });
      closeModal();
      toast('📖 Receta guardada');
    };
    const del = $('#delR', root);
    if (del) del.onclick = () => {
      if (!confirm(r.base ? '¿Ocultar esta receta del libro?' : '¿Borrar esta receta?')) return;
      store.update(r.base ? { [`hiddenRecipes/${id}`]: true, [`recipes/${id}`]: null } : { [`recipes/${id}`]: null });
      closeModal();
    };
  });
}

// ═══════════════ Muro de notas ═══════════════
function wallHTML() {
  const notes = list(S.notes).sort((a, b) => b.ts - a.ts).slice(0, 60);
  return `
  <section class="panel">
    <div class="ribbon">📜 Muro del reino</div>
    <form id="noteForm">
      <textarea name="text" maxlength="200" placeholder="Deja un mensaje... 💌" required style="min-height:64px"></textarea>
      <div class="row" style="align-items:center;margin-top:8px">
        <div class="picker" data-pick="color" style="flex:2">${NOTE_COLORS.map((c, i) => `<button type="button" class="n-${c} ${i === 0 ? 'on' : ''}" data-v="${c}" style="width:30px;height:30px" aria-label="${c}"></button>`).join('')}</div>
        <button class="btn teal small" style="flex:0 0 auto">📌 Pegar</button>
      </div>
    </form>
  </section>
  <div class="notes" style="margin-top:18px">${notes.map(n => {
    if (n.system) return `<div class="note system">${esc(n.text)} <span class="muted">· ${timeAgo(n.ts)}</span></div>`;
    const a = memberById(n.author);
    const r = Math.round(((n.ts % 7) - 3) * .8);
    const canDel = n.author === me || isGuardian();
    return `<div class="note n-${esc(n.color || 'yellow')}" style="--r:${r}deg">
      ${canDel ? `<button class="del" data-act="delNote" data-id="${n.id}" aria-label="Borrar">✕</button>` : ''}
      ${esc(n.text)}
      <div class="reacts">${REACTIONS.map(e => {
        const who = Object.keys(n.reactions?.[e] || {});
        return `<button class="${who.includes(me) ? 'mine' : ''}" data-act="react" data-id="${n.id}" data-e="${e}">${e}${who.length ? ' ' + who.length : ''}</button>`;
      }).join('')}</div>
      <div class="by">${avatarHTML(a, 'xs')} ${esc(a?.name || n.authorName || 'Visita')} · ${timeAgo(n.ts)}</div>
    </div>`;
  }).join('')}</div>`;
}

// ═══════════════ Gremio (ajustes, perfil, QR) ═══════════════
function guildHTML() {
  const m = meM();
  const g = isGuardian();
  return `
  <section class="panel">
    <div class="ribbon">🧝 Mi personaje</div>
    <div style="display:flex;gap:14px;align-items:center">
      ${avatarHTML(m, 'lg')}
      <div class="grow" style="flex:1">
        <div class="field"><label>Mi nombre</label>
          <div class="row"><input type="text" id="myName" value="${esc(m.name)}" maxlength="20"><button class="btn small teal" data-act="saveName" style="flex:0 0 auto">✓</button></div></div>
      </div>
    </div>
    <div class="field" style="margin-top:10px"><label>Avatar</label>
      <div class="picker">${AVATARS.map(a => `<button type="button" class="${!m.photo && m.avatar === a ? 'on' : ''}" data-act="setAvatar" data-v="${a}">${a}</button>`).join('')}</div>
    </div>
    <div class="panel-actions">
      <label class="btn ghost small" style="cursor:pointer">🖼️ Subir imagen<input type="file" accept="image/*" id="photoIn" hidden></label>
      ${m.photo ? `<button class="btn ghost small" data-act="clearPhoto">Quitar imagen</button>` : ''}
      <button class="btn ghost small" data-act="changeKey">🔢 Cambiar mi clave</button>
      <button class="btn small" data-act="switchUser">🔄 Cambiar de personaje</button>
    </div>
    <div class="panel-actions" style="justify-content:space-between;align-items:center">
      <span class="muted">🔊 Sonidos</span>
      <button class="btn small ${ls.get('sound', true) ? 'teal' : 'ghost'}" data-act="toggleSound">${ls.get('sound', true) ? 'Activados' : 'Silencio'}</button>
    </div>
  </section>

  <section class="panel">
    <div class="ribbon">📱 Código QR</div>
    <p class="muted" style="margin-top:0;text-align:center">Escanéalo para entrar al reino. Imprímelo y pégalo en el refri 🧲</p>
    <div class="print-area">
      <h2 style="font-family:var(--font-deco);margin:0 0 6px;color:var(--gold)">${esc(S.settings.family || 'Casa Quest')}</h2>
      <div class="qr-box" id="qr"></div>
    </div>
    <div class="link-box">${esc(shareURL())}</div>
    <div class="panel-actions">
      <button class="btn ghost small" data-act="copyLink">📋 Copiar enlace</button>
      <button class="btn small" data-act="printQR">🖨️ Imprimir</button>
    </div>
    ${store.mode === 'local' ? `<p class="muted" style="color:#ffd9a6">⚠️ Modo demo: los datos se guardan solo en este dispositivo. Conecta Firebase (ver README) para compartir entre celulares.</p>` : ''}
  </section>

  <section class="panel">
    <div class="ribbon">🛡️ Guardianes</div>
    ${g ? `
      <div class="field"><label>Nombre del reino</label><input type="text" id="familyName" value="${esc(S.settings.family || '')}" maxlength="30"></div>
      <div class="sub">Integrantes</div>
      ${members().map(x => `<div class="card">${avatarHTML(x, 'sm')}<div class="grow"><div class="title">${esc(x.name)}</div><div class="meta"><span class="chip">${x.role === 'guardian' ? '🛡️ Guardián' : '⚔️ Héroe'}</span><span class="chip">${x.xp || 0} XP</span></div></div>
        ${x.key !== undefined && x.key !== null ? `<button class="bubble xs gem-amber" data-act="resetKey" data-id="${x.id}" title="Reiniciar clave">🔢</button>` : ''}
        ${x.id !== me ? `<button class="bubble xs gem-red" data-act="delMember" data-id="${x.id}" title="Quitar">✕</button>` : ''}</div>`).join('')}
      <div class="panel-actions"><button class="btn teal small" data-act="newMember">➕ Agregar integrante</button></div>
      <div class="sub">Seguridad</div>
      <div class="panel-actions" style="justify-content:flex-start">
        <button class="btn ghost small" data-act="changePin">🔑 Cambiar PIN</button>
        <button class="btn ghost small" data-act="lock">🔒 Bloquear modo guardián</button>
      </div>
    ` : m.role === 'guardian' ? `
      <p class="muted">El modo guardián está bloqueado en este dispositivo.</p>
      <button class="btn teal" data-act="unlock">🔑 Desbloquear con PIN</button>
    ` : `<p class="muted">Solo los guardianes pueden agregar integrantes, crear misiones con puntos y premios.</p>`}
    <p class="muted" style="margin-bottom:0">Conexión: <span id="conn" class="conn ${online ? 'on' : ''}"></span> ${store.mode === 'firebase' ? 'Firebase' : 'local (demo)'}</p>
  </section>`;
}

function shareURL() {
  const base = location.href.split('#')[0];
  return store.mode === 'firebase' ? `${base}#k=${familyKey}` : base;
}

function drawQR() {
  const box = $('#qr');
  if (!box) return;
  if (typeof window.qrcode !== 'function') { box.textContent = 'No se pudo cargar el generador de QR.'; return; }
  const qr = window.qrcode(0, 'M');
  qr.addData(shareURL());
  qr.make();
  box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

function memberForm() {
  const st = { avatar: '🧝', role: 'hero' };
  openModal('Nuevo integrante', `
    <form id="nm">
      <div class="field"><label>Nombre</label><input type="text" name="name" required maxlength="20"></div>
      <div class="field"><label>Rol</label><div class="picker wide" data-pick="role">
        <button type="button" class="on" data-v="hero">⚔️ Héroe (gana XP)</button><button type="button" data-v="guardian">🛡️ Guardián (adulto)</button></div></div>
      <div class="field"><label>Avatar</label><div class="picker" data-pick="avatar">${AVATARS.map(a => `<button type="button" class="${a === st.avatar ? 'on' : ''}" data-v="${a}">${a}</button>`).join('')}</div></div>
      <div class="panel-actions"><button class="btn teal" type="submit">Agregar</button></div>
    </form>`, root => {
    bindPickers(root, st);
    $('#nm', root).onsubmit = e => {
      e.preventDefault();
      const f = new FormData(e.target);
      if (nameTaken(f.get('name'))) { toast('Ya hay alguien con ese nombre'); return; }
      store.update({ [`members/${uid()}`]: { name: f.get('name').trim(), avatar: st.avatar, role: st.role, xp: 0, coins: 0, created: Date.now() } });
      closeModal();
    };
  });
}

// Teclado de burbujas para la clave personal de 1 dígito.
function keypad(title, text, onDigit) {
  openModal(title, `
    <p style="text-align:center;margin:0 0 14px">${text}</p>
    <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<button type="button" class="bubble lg ${GEMS[d % GEMS.length]}" data-d="${d}">${d}</button>`).join('')}</div>
    <p class="muted" id="keyErr" style="text-align:center;min-height:20px;margin:12px 0 0"></p>`, root => {
    $('.keypad', root).addEventListener('click', e => {
      const b = e.target.closest('[data-d]');
      if (!b) return;
      const err = onDigit(b.dataset.d);
      if (err) {
        $('#keyErr', root).textContent = err;
        const k = $('.keypad', root);
        k.classList.remove('shake'); void k.offsetWidth; k.classList.add('shake');
      }
    });
  });
}

// Crear la clave (la primera vez o al cambiarla). Devuelve un mensaje de error o nada.
function createKey(m, then) {
  keypad('🔢 Crea tu clave', `Hola <b>${esc(m.name)}</b>, elige un número secreto.<br><span class="muted">Lo usarás para entrar con tu personaje.</span>`, d => {
    if (keyTaken(d, m.id)) return '❌ Ese número ya lo usa otra persona. Elige otro.';
    store.update({ [`members/${m.id}/key`]: d });
    closeModal();
    toast(`🔢 Clave guardada: recuerda tu número`);
    then?.();
  });
}

function askKey(m, then) {
  keypad(`${m.avatar || '🧝'} ${m.name}`, 'Toca tu número secreto', d => {
    if (String(m.key) !== d) return '❌ Ese no es tu número';
    closeModal();
    then();
  });
}

function askPin(onOk) {
  openModal('🔑 PIN de guardián', `
    <form id="pinf">
      <div class="field"><input type="password" name="pin" inputmode="numeric" maxlength="4" autofocus required placeholder="••••" style="text-align:center;font-size:26px;letter-spacing:10px"></div>
      <p class="muted" id="pinErr"></p>
      <div class="panel-actions"><button class="btn ghost" type="button" id="pinCancel">Entrar sin modo guardián</button><button class="btn teal" type="submit">Entrar</button></div>
    </form>`, root => {
    $('#pinCancel', root).onclick = () => { closeModal(); onOk(false); };
    $('#pinf', root).onsubmit = e => {
      e.preventDefault();
      if (new FormData(e.target).get('pin') === String(S.settings.pin)) { closeModal(); onOk(true); }
      else { $('#pinErr', root).textContent = '❌ PIN incorrecto'; e.target.reset(); }
    };
  });
}

function resizeImage(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = 160, c = document.createElement('canvas');
      c.width = c.height = s;
      const k = Math.max(s / img.width, s / img.height);
      const w = img.width * k, h = img.height * k;
      c.getContext('2d').drawImage(img, (s - w) / 2, (s - h) / 2, w, h);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', .82));
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}

// ═══════════════ Eventos ═══════════════
function onClick(e) {
  const t = e.target.closest('[data-tab],[data-act]');
  if (!t) return;
  if (t.dataset.tab) {
    tab = t.dataset.tab; ls.set('tab', tab);
    render(); window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const id = t.dataset.id;
  switch (t.dataset.act) {
    case 'pickMe': {
      const m = { ...memberById(id), id };
      const go = ok => { me = id; ls.set('me', id); unlocked = ok; ls.set('unlocked', ok); render(); toast(`¡Bienvenido/a, ${m.name}! ✨`); };
      const next = () => (m.role === 'guardian' ? askPin(go) : go(false));
      if (m.key === undefined || m.key === null) createKey(m, next); else askKey(m, next);
      break;
    }
    case 'profile': tab = 'guild'; ls.set('tab', tab); render(); window.scrollTo({ top: 0 }); break;
    case 'mfilter': ui.missionFilter = t.dataset.v; render(); break;
    case 'complete': completeMission(id, t); break;
    case 'undoMission': undoMission(id); break;
    case 'newMission': missionForm(); break;
    case 'editMission': missionForm(id); break;
    case 'redeem': redeem(id, t); break;
    case 'newReward': rewardForm(); break;
    case 'delReward': if (confirm('¿Quitar este premio de la tienda?')) store.update({ [`rewards/${id}`]: null }); break;
    case 'deliver': store.update({ [`redeems/${id}/delivered`]: true, [`redeems/${id}/deliveredAt`]: Date.now() }); toast('🎁 Premio entregado'); break;
    case 'qty': {
      const p = S.pantry[id];
      const d = Number(t.dataset.d);
      if (!p || ((p.qty || 0) + d) < 0) return;
      store.update({ [`pantry/${id}/qty`]: store.inc(d) });
      if (d > 0) { const r = t.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 6); }
      break;
    }
    case 'newItem': itemForm(); break;
    case 'editItem': itemForm(id); break;
    case 'check': {
      const key = t.dataset.key;
      const on = (S.shopChecks || {})[key] !== undefined;
      store.update({ [`shopChecks/${key}`]: on ? null : Number(t.dataset.need) || 1 });
      if (!on) { const r = t.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 8); pop(); }
      break;
    }
    case 'delExtra': store.update({ [`shop/${id}`]: null, [`shopChecks/x_${id}`]: null }); break;
    case 'registerPurchase': registerPurchase(t); break;
    case 'rfilter': ui.recipeFilter = t.dataset.v; $$('[data-act=rfilter]').forEach(b => b.classList.toggle('on', b === t)); renderRecipeList(); break;
    case 'rcat': ui.recipeCat = t.dataset.v; $$('[data-act=rcat]').forEach(b => b.classList.toggle('on', b === t)); renderRecipeList(); break;
    case 'openRecipe': openRecipe(id); break;
    case 'newRecipe': recipeForm(); break;
    case 'react': {
      const n = S.notes[id]; const em = t.dataset.e;
      const mine = !!n?.reactions?.[em]?.[me];
      store.update({ [`notes/${id}/reactions/${em}/${me}`]: mine ? null : true });
      if (!mine) { const r = t.getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 6, [em]); }
      break;
    }
    case 'delNote': if (confirm('¿Borrar esta nota?')) store.update({ [`notes/${id}`]: null }); break;
    case 'setAvatar': store.update({ [`members/${me}/avatar`]: t.dataset.v, [`members/${me}/photo`]: null }); break;
    case 'clearPhoto': store.update({ [`members/${me}/photo`]: null }); break;
    case 'switchUser': me = null; ls.set('me', null); unlocked = false; ls.set('unlocked', false); tab = 'missions'; ls.set('tab', tab); render(); break;
    case 'toggleSound': ls.set('sound', !ls.get('sound', true)); render(); break;
    case 'copyLink': navigator.clipboard?.writeText(shareURL()).then(() => toast('📋 Enlace copiado'), () => toast('No se pudo copiar')); break;
    case 'printQR': window.print(); break;
    case 'newMember': memberForm(); break;
    case 'delMember': {
      const m = memberById(id);
      if (m && confirm(`¿Quitar a ${m.name}? Se perderán sus puntos y medallas.`)) store.update({ [`members/${id}`]: null });
      break;
    }
    case 'changePin': {
      const p = prompt('Nuevo PIN de 4 dígitos:');
      if (p && /^\d{4}$/.test(p)) { store.update({ 'settings/pin': p }); toast('🔑 PIN actualizado'); }
      else if (p) toast('El PIN debe tener 4 números');
      break;
    }
    case 'saveName': saveMyName(); break;
    case 'changeKey': {
      const m = meM();
      askKey(m, () => setTimeout(() => createKey({ ...m, id: me }), 50));
      break;
    }
    case 'resetKey': {
      const m = memberById(id);
      if (m && confirm(`¿Borrar la clave de ${m.name}? La próxima vez que entre creará una nueva.`)) { store.update({ [`members/${id}/key`]: null }); toast('🔢 Clave reiniciada'); }
      break;
    }
    case 'lock': unlocked = false; ls.set('unlocked', false); render(); break;
    case 'unlock': askPin(ok => { unlocked = ok; ls.set('unlocked', ok); render(); }); break;
  }
}

function saveMyName() {
  const input = $('#myName');
  const name = input?.value.trim().slice(0, 20);
  const m = meM();
  if (!input || !name || name === m.name) return;
  if (nameTaken(name, me)) { toast('Ya hay alguien con ese nombre'); input.value = m.name; return; }
  store.update({ [`members/${me}/name`]: name });
  toast('✏️ Nombre actualizado');
}

function onChangeEvt(e) {
  const t = e.target;
  if (t.id === 'myName') saveMyName();
  if (t.id === 'familyName' && t.value.trim() && isGuardian()) { store.update({ 'settings/family': t.value.trim().slice(0, 30) }); toast('🏰 Nombre del reino actualizado'); }
  if (t.dataset.act === 'checkQty') store.update({ [`shopChecks/${t.dataset.key}`]: Math.max(0, Number(t.value) || 0) });
  if (t.id === 'photoIn' && t.files[0]) {
    resizeImage(t.files[0]).then(url => store.update({ [`members/${me}/photo`]: url })).catch(() => toast('No se pudo leer la imagen'));
  }
}

function onInputEvt(e) {
  const t = e.target;
  if (t.id === 'recipeQ') { ui.recipeQuery = t.value; renderRecipeList(); }
  if (t.id === 'pantryQ') {
    ui.pantryQuery = t.value;
    const q = norm(t.value);
    $$('#pantryList .card').forEach(c => { c.style.display = !q || norm($('.title', c).textContent).includes(q) ? '' : 'none'; });
  }
}

// Formularios que viven en la vista (muro, extras del súper)
document.addEventListener('submit', e => {
  if (e.target.id === 'noteForm') {
    e.preventDefault();
    const f = new FormData(e.target);
    const text = f.get('text').trim();
    if (!text) return;
    const color = $('[data-pick=color] .on', e.target)?.dataset.v || 'yellow';
    const c = { [`notes/${uid()}`]: { author: me, authorName: meM().name, text, color, ts: Date.now() } };
    Object.assign(c, awardStat('notes', 0));
    e.target.reset();
    document.activeElement?.blur();
    store.update(c);
    const r = e.target.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + 30, 14, ['💌', '✦', '💖']);
    pop();
  }
  if (e.target.id === 'extraForm') {
    e.preventDefault();
    const name = new FormData(e.target).get('name').trim();
    if (!name) return;
    e.target.reset();
    document.activeElement?.blur();
    store.update({ [`shop/${uid()}`]: { name, qty: 1, unit: 'un', ts: Date.now() } });
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pick=color] button');
  if (b) { $$('button', b.parentElement).forEach(x => x.classList.toggle('on', x === b)); }
});

// ═══════════════ Modales y avisos ═══════════════
function openModal(title, html, onMount) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-back"><div class="modal" role="dialog" aria-modal="true"><h2>${esc(title)}</h2>${html}</div></div>`;
  const back = $('.modal-back', root);
  back.addEventListener('click', e => { if (e.target === back) closeModal(); });
  onMount?.($('.modal', root));
  const first = $('input:not([type=hidden]):not([type=file])', root);
  if (first && window.innerWidth > 600) first.focus();
}
function closeModal() {
  $('#modal-root').innerHTML = '';
  if (pendingRender) render();
}
function bindPickers(root, st) {
  $$('[data-pick]', root).forEach(p => p.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    st[p.dataset.pick] = b.dataset.v;
    $$('button', p).forEach(x => x.classList.toggle('on', x === b));
  }));
}
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.innerHTML = `<span class="pill">${esc(msg)}</span>`;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// ═══════════════ Efectos: brillitos, medallas, sonido ═══════════════
function burst(x, y, n = 20, chars = ['✦', '✧', '⭐', '✨', '•']) {
  const fx = $('#fx');
  const colors = ['#f1cf7a', '#5ff2d0', '#fff6cf', '#f3a6ae', '#c2adf2'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'spark';
    s.textContent = chars[i % chars.length];
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.style.color = colors[i % colors.length];
    s.style.fontSize = (10 + Math.random() * 16) + 'px';
    fx.appendChild(s);
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 110;
    s.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 30}px)) scale(1) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: .6 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.2}px), calc(-50% + ${Math.sin(a) * d + 40}px)) scale(.4)`, opacity: 0 },
    ], { duration: 900 + Math.random() * 500, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => s.remove();
  }
}
function floatText(x, y, text) {
  const f = document.createElement('div');
  f.className = 'floaty'; f.textContent = text;
  f.style.left = x + 'px'; f.style.top = y + 'px';
  $('#fx').appendChild(f);
  setTimeout(() => f.remove(), 1400);
}

const celebQueue = [];
let celebrating = false;
function queueCelebration(c) { celebQueue.push(c); if (!celebrating) nextCelebration(); }
function nextCelebration() {
  const c = celebQueue.shift();
  if (!c) { celebrating = false; return; }
  celebrating = true;
  const el = document.createElement('div');
  el.className = 'celebrate';
  el.innerHTML = `<div class="rays"></div><div class="medal">${esc(c.icon)}</div><h3>${esc(c.title)}</h3><p>${esc(c.text || '')}</p>${c.xp ? `<div class="xp-big">+${c.xp} XP</div>` : ''}<div class="tap">toca para continuar</div>`;
  document.body.appendChild(el);
  setTimeout(() => { const r = $('.medal', el).getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 40); fanfare(); }, 450);
  const close = () => { el.remove(); setTimeout(nextCelebration, 150); };
  el.addEventListener('click', close, { once: true });
}

let actx;
function tone(freq, start, dur, type = 'sine', vol = .15) {
  if (!ls.get('sound', true)) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, actx.currentTime + start);
    g.gain.linearRampToValueAtTime(vol, actx.currentTime + start + .02);
    g.gain.exponentialRampToValueAtTime(.001, actx.currentTime + start + dur);
    o.connect(g).connect(actx.destination);
    o.start(actx.currentTime + start); o.stop(actx.currentTime + start + dur + .05);
  } catch { /* sin audio */ }
}
const chime = () => [880, 1175, 1568].forEach((f, i) => tone(f, i * .08, .35, 'triangle', .12));
const pop = () => tone(660, 0, .12, 'sine', .1);
const fanfare = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .11, .5, 'triangle', .13));
