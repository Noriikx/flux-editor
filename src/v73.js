'use strict';
/* Flux 1.7.4: a new Premium screen, and Thumbnail Studio as its own place (home → Thumbnails):
   your own pictures, text, shapes and stickers on layers - like Photoshop, but simple. */

/* ============================ Premium ============================ */
const PREM_GROUPS = [
  ['AI that edits for you', 'spark', [
    ['AI Editor', 'Tell Flux what you want - it cuts, adds titles, music and transitions', '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>'],
    ['Remove silences', 'Cuts out pauses and dead air automatically', '<path d="M3 12h3l2-6 4 12 2-6h7"/>'],
    ['Auto-bleep', 'Finds swear words and bleeps them, from slurs-only to strict', '<rect x="3" y="7" width="18" height="10" rx="3"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>'],
    ['Animated captions', 'Karaoke, Word pop, Hype and Fire caption styles', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M13 15h4M7 11h10"/>']]],
  ['Look', 'eye', [
    ['Pro transitions', '35+ extra: glitch, whip pan, heart, wave, spiral, TV switch…', '<rect x="2" y="6" width="9" height="12" rx="1.5"/><rect x="13" y="6" width="9" height="12" rx="1.5"/>'],
    ['Pro effects', 'Lens blur, Ultra sharpen, VHS, CCTV, tilt-shift, neon edges…', '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z"/>'],
    ['Film looks', 'Film grain and old-film looks', '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M16 3v18M4 8h4M4 13h4M16 8h4M16 13h4"/>'],
    ['Green screen', 'Remove a green or blue background', '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 20v-5a3 3 0 0 1 6 0v5"/><circle cx="12" cy="9" r="2.5"/>']]],
  ['Sound & export', 'wave', [
    ['Pro audio', 'Fairlight EQ, De-esser and Noise reduction', '<path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4"/>'],
    ['4K export', 'Export in Ultra HD (2160p)', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9v3h3M10 9v6M14 9v6M14 12l3-3M14 12l3 3"/>'],
    ['Time machine', 'Jump your whole edit back to any earlier point', '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
    ['Golden Hour theme', 'A warm gold theme for Flux, just for Premium', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>']]]
];
openPremium = function (feature) {
  const on = isPremium(), a = settings.account || {};
  const until = a.until ? new Date(a.until).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const box = modal(`<div class="pm">
    <div class="pm-hero"><div class="pm-glow"></div><div class="pm-stars"></div>
      <span class="pm-crown">${CROWN}</span>
      <div class="pm-title"><span class="pm-kicker">${on ? 'You have' : 'Flux'}</span><h2>Premium</h2>
        <p>${feature ? `<b>${esc72(feature)}</b> is part of Premium.` : on ? 'Every tool in Flux is unlocked for you.' : 'The pro tools for people who post a lot.'}</p></div>
      <span class="pm-status ${on ? 'on' : ''}">${on ? `<i></i>Active${until ? ' · until ' + esc72(until) : ''}` : PREMIUM_FOR_SALE ? PREMIUM_PRICE + ' / month' : '<i></i>Coming soon'}</span>
    </div>
    <div class="pm-body">${PREM_GROUPS.map(([g, , items]) => `<section><h3>${g}</h3><div class="pm-grid">${items.map(([n, d, ic]) => `<div class="pm-card${on ? ' on' : ''}"><span class="pm-ic"><svg viewBox="0 0 24 24">${ic}</svg></span><div><b>${n}</b><small>${d}</small></div>${on ? '<span class="pm-tick">✓</span>' : ''}</div>`).join('')}</div></section>`).join('')}</div>
    <div class="pm-foot">
      ${on ? '<p>Thanks for supporting Flux 💛</p>' : PREMIUM_FOR_SALE ? `<p>Secure checkout by Stripe · cancel anytime. Use the same email as your Flux account.</p>` : '<p>Premium isn’t for sale yet. Everything else in Flux is free - keep an eye on the updates.</p>'}
      <div class="pm-btns"><button class="btn ghost" data-a="close">${on ? 'Done' : 'Close'}</button>${!on && PREMIUM_FOR_SALE ? `<button class="btn primary" data-a="buy">Get Premium - ${PREMIUM_PRICE}/month</button>` : ''}</div>
    </div></div>`, { wide: true });
  box.classList.add('pm-modal');
  $('[data-a=close]', box).onclick = closeModal;
  const buy = $('[data-a=buy]', box); if (buy) buy.onclick = () => { closeModal(); openCheckout(); };
};

/* ============================ Thumbnail Studio: saved designs ============================ */
const TH_DB = 'flux-thumbs';
function thDb() { return new Promise((res, rej) => { const r = indexedDB.open(TH_DB, 1); r.onupgradeneeded = () => { r.result.createObjectStore('docs', { keyPath: 'id' }); r.result.createObjectStore('images', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function thTx(store, mode, fn) { const db = await thDb(); return new Promise((res, rej) => { const t = db.transaction(store, mode), s = t.objectStore(store); const out = fn(s); t.oncomplete = () => res(out && 'result' in out ? out.result : out); t.onerror = () => rej(t.error); }); }
const thAllDocs = () => thTx('docs', 'readonly', (s) => s.getAll());
const thPutDoc = (d) => thTx('docs', 'readwrite', (s) => s.put(d));
const thDelDoc = (id) => thTx('docs', 'readwrite', (s) => s.delete(id));
const thPutImg = (id, blob) => thTx('images', 'readwrite', (s) => s.put({ id, blob }));
const thGetImg = (id) => thTx('images', 'readonly', (s) => s.get(id));
const TH_SIZES = [['yt', 'YouTube thumbnail', 1280, 720], ['short', 'Shorts / TikTok cover', 1080, 1920], ['square', 'Square post', 1080, 1080], ['banner', 'Channel banner', 2560, 1440], ['x', 'X / Twitter header', 1500, 500]];

function renderThumbsPage(page) {
  page.innerHTML = `<div class="hp-head"><div><h1>Thumbnails</h1><p>Make thumbnails and covers from your own pictures - with layers, like a simple Photoshop.</p></div></div>
    <div class="th-new">${TH_SIZES.map(([k, n, w, h]) => `<button class="th-size" data-k="${k}"><span class="th-shape" style="aspect-ratio:${w}/${h}"></span><b>${n}</b><small>${w} × ${h}</small></button>`).join('')}</div>
    <h2 class="hp-h2">Your thumbnails</h2><div class="th-list"><p class="muted">Loading…</p></div>`;
  $$('.th-size', page).forEach((b) => (b.onclick = () => { const z = TH_SIZES.find((x) => x[0] === b.dataset.k); openThumbStudio(null, z[2], z[3]); }));
  thAllDocs().then((docs) => {
    const list = $('.th-list', page); if (!list) return;
    docs.sort((a, b) => b.updatedAt - a.updatedAt);
    if (!docs.length) { list.innerHTML = '<p class="muted">Nothing yet - pick a size above to start.</p>'; return; }
    list.innerHTML = '';
    for (const d of docs) {
      const c = el('div', 'th-card');
      c.innerHTML = `<div class="th-prev"><img src="${d.preview || ''}" alt=""></div><div class="th-meta"><b>${esc72(d.name)}</b><small>${d.W} × ${d.H} · ${new Date(d.updatedAt).toLocaleDateString()}</small></div><button class="icon-btn small th-del" data-tip="Delete"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/></svg></button>`;
      c.onclick = (e) => { if (e.target.closest('.th-del')) return; openThumbStudio(d); };
      $('.th-del', c).onclick = async () => { if (!confirm(`Delete “${d.name}”?`)) return; await thDelDoc(d.id); renderThumbsPage(page); };
      list.appendChild(c);
    }
  }).catch(() => { const l = $('.th-list', page); if (l) l.innerHTML = '<p class="muted">Couldn’t load your thumbnails.</p>'; });
}
HOME_TABS.splice(2, 0, ['thumbs', 'Thumbnails']);
const _showHomePage73 = showHomePage;
showHomePage = function (k) {
  if (k !== 'thumbs') return _showHomePage73(k);
  homePage = k;
  $$('.home-nav button').forEach((b) => b.classList.toggle('on', b.dataset.hp === k));
  $$('.home-page').forEach((p) => p.classList.toggle('on', p.dataset.hp === k));
  renderThumbsPage($('.home-page[data-hp="thumbs"]'));
};
// the home tabs may already be built - add the Thumbnails tab if so
(function addThumbsTab() {
  const nav = $('.home-nav'); if (!nav || $('[data-hp="thumbs"]', nav)) return;
  const b = el('button'); b.dataset.hp = 'thumbs'; b.textContent = 'Thumbnails'; b.onclick = () => showHomePage('thumbs');
  const after = $('[data-hp="templates"]', nav); after ? after.after(b) : nav.appendChild(b);
  const pg = el('div', 'home-page'); pg.dataset.hp = 'thumbs'; $('.home-inner').appendChild(pg);
})();

/* ============================ Thumbnail Studio: the editor ============================ */
const TH_FONTS = ['Impact', 'Arial Black', 'Bahnschrift', 'Segoe UI', 'Verdana', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Comic Sans MS', 'Segoe Script', 'Courier New'];
const TH_BLENDS = [['source-over', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay'], ['soft-light', 'Soft light'], ['lighten', 'Lighten'], ['darken', 'Darken'], ['color-dodge', 'Color dodge'], ['difference', 'Difference']];
const TH_STICKERS = ['🔥', '😱', '🤯', '😂', '😳', '💰', '👀', '✅', '❌', '⚠️', '💯', '🏆', '❤️', '⭐', '👉', '👈', '🎮', '🚀', '💀', '🤑'];
const TH_ICONS = {
  move: '<path d="M5 3l14 8-6 2-2 6z"/>', text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>', image: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="2"/>', ellipse: '<ellipse cx="12" cy="12" rx="9" ry="7"/>', arrow: '<path d="M4 12h13M13 6l6 6-6 6"/>', sticker: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
  fill: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 15l6-6 12 12"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', eyeOff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.1 6.1C3.6 7.8 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.9-2"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>'
};
const thIco = (k) => `<svg viewBox="0 0 24 24">${TH_ICONS[k]}</svg>`;
let TH = null;
const thImgs = new Map(); // image id -> HTMLImageElement
async function thLoadImg(id) {
  if (thImgs.has(id)) return thImgs.get(id);
  const rec = await thGetImg(id); if (!rec) return null;
  const im = new Image(); im.src = URL.createObjectURL(rec.blob);
  await im.decode().catch(() => {});
  thImgs.set(id, im); return im;
}
async function openThumbStudio(doc, W, H) {
  doc = doc ? JSON.parse(JSON.stringify(doc)) : { id: 'th' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: 'Untitled thumbnail', W, H, layers: [], createdAt: Date.now(), updatedAt: Date.now() };
  if (!doc.layers.length) doc.layers.push({ id: uid(), type: 'fill', name: 'Background', visible: true, locked: true, opacity: 1, blend: 'source-over', fill: '#1b1f2e', fill2: '#3b1f5e', grad: true, x: doc.W / 2, y: doc.H / 2, w: doc.W, h: doc.H, rot: 0 });
  for (const L of doc.layers) if (L.type === 'image') await thLoadImg(L.img);
  TH = { doc, sel: doc.layers.length > 1 ? null : null, tool: 'move', undo: [], redo: [], dirty: false, scale: 1 };
  const root = el('div', 'thx'); root.id = 'thumbStudio';
  root.innerHTML = `
    <header class="thx-top">
      <button class="icon-btn" data-a="back" data-tip="Back to Flux (saves)"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
      <input class="thx-name" spellcheck="false" maxlength="80">
      <span class="thx-size"></span>
      <span class="thx-saved"></span>
      <div class="thx-sp"></div>
      <button class="icon-btn" data-a="undo" data-tip="Undo (Ctrl+Z)"><svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg></button>
      <button class="icon-btn" data-a="redo" data-tip="Redo (Ctrl+Y)"><svg viewBox="0 0 24 24"><path d="m15 14 5-5-5-5"/><path d="M20 9H9a5 5 0 0 0 0 10h3"/></svg></button>
      <button class="btn primary" data-a="export"><svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Export</button>
    </header>
    <div class="thx-main">
      <nav class="thx-tools">
        <button data-t="move" data-tip="Move & resize (V)">${thIco('move')}</button>
        <button data-t="image" data-tip="Add pictures (I) - or drop / paste them">${thIco('image')}</button>
        <button data-t="text" data-tip="Text (T)">${thIco('text')}</button>
        <button data-t="rect" data-tip="Rectangle">${thIco('rect')}</button>
        <button data-t="ellipse" data-tip="Circle">${thIco('ellipse')}</button>
        <button data-t="arrow" data-tip="Arrow">${thIco('arrow')}</button>
        <button data-t="sticker" data-tip="Stickers">${thIco('sticker')}</button>
      </nav>
      <div class="thx-stage"><div class="thx-board"><canvas class="thx-cv"></canvas><div class="thx-selbox" hidden><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i><i data-h="rot" class="rot"></i></div></div>
        <div class="thx-drop">Drop pictures to add them as layers</div>
        <div class="thx-stickers" hidden>${TH_STICKERS.map((s) => `<button data-st="${s}">${s}</button>`).join('')}</div></div>
      <aside class="thx-side"><div class="thx-props"></div>
        <div class="thx-layers"><div class="thx-lh"><b>Layers</b><span></span><button class="icon-btn small" data-a="ldup" data-tip="Duplicate (Ctrl+D)"><svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg></button><button class="icon-btn small" data-a="ldel" data-tip="Delete (Del)"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/></svg></button></div><div class="thx-lrows"></div></div>
      </aside>
    </div>`;
  document.body.appendChild(root);
  const name = $('.thx-name', root); name.value = doc.name;
  name.onchange = () => { thPush(); doc.name = name.value.trim() || 'Untitled thumbnail'; thChanged(); };
  $('.thx-size', root).textContent = `${doc.W} × ${doc.H}`;
  const cv = $('.thx-cv', root); cv.width = doc.W; cv.height = doc.H;
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'back') closeThumbStudio();
    else if (a === 'undo') thUndo(); else if (a === 'redo') thRedo();
    else if (a === 'export') thExport();
    else if (a === 'ldup') thDuplicate(); else if (a === 'ldel') thDelete();
  });
  $('.thx-tools', root).onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) thTool(b.dataset.t); };
  $('.thx-stickers', root).onclick = (e) => { const b = e.target.closest('[data-st]'); if (!b) return; thAdd({ type: 'text', name: 'Sticker ' + b.dataset.st, text: b.dataset.st, font: 'Segoe UI Emoji', size: Math.round(Math.min(doc.W, doc.H) * 0.22), color: '#ffffff', strokeW: 0, glow: 0, shadow: 0.4, sticker: true }); $('.thx-stickers', root).hidden = true; thTool('move'); };
  // drop or paste pictures
  const stage = $('.thx-stage', root);
  stage.ondragover = (e) => { e.preventDefault(); stage.classList.add('drag'); };
  stage.ondragleave = () => stage.classList.remove('drag');
  stage.ondrop = (e) => { e.preventDefault(); stage.classList.remove('drag'); thAddFiles([...e.dataTransfer.files]); };
  thKeys = (e) => thKey(e);
  window.addEventListener('keydown', thKeys, true);
  window.addEventListener('paste', thPaste, true);
  window.addEventListener('resize', thFit);
  thCanvasEvents(cv);
  thFit(); thRender(); thLayersUi(); thPropsUi();
  bump('thumbStudio');
}
let thKeys = null, thSaveTmr = 0;
function closeThumbStudio() {
  const root = $('#thumbStudio'); if (!root) return;
  thSave(true);
  window.removeEventListener('keydown', thKeys, true); window.removeEventListener('paste', thPaste, true); window.removeEventListener('resize', thFit);
  root.remove(); TH = null;
  if (homePage === 'thumbs') renderThumbsPage($('.home-page[data-hp="thumbs"]'));
}
function thChanged() { TH.dirty = true; $('.thx-saved').textContent = 'Saving…'; clearTimeout(thSaveTmr); thSaveTmr = setTimeout(() => thSave(), 700); }
async function thSave(now) {
  if (!TH) return;
  clearTimeout(thSaveTmr);
  const doc = TH.doc; doc.updatedAt = Date.now();
  // a small preview for the list
  const c = document.createElement('canvas'), k = 360 / Math.max(doc.W, doc.H); c.width = Math.round(doc.W * k); c.height = Math.round(doc.H * k);
  const x = c.getContext('2d'); x.scale(k, k); thDraw(x, false);
  doc.preview = c.toDataURL('image/jpeg', 0.8);
  const saved = JSON.parse(JSON.stringify(doc)); saved.layers.forEach((L) => { delete L._bb; });
  await thPutDoc(saved).catch(() => toast('Couldn’t save the thumbnail', { error: true }));
  TH && (TH.dirty = false);
  const s = $('.thx-saved'); if (s) s.textContent = 'Saved';
  void now;
}
function thPush() { TH.undo.push(JSON.stringify(TH.doc.layers)); if (TH.undo.length > 80) TH.undo.shift(); TH.redo = []; }
function thUndo() { if (!TH.undo.length) return; TH.redo.push(JSON.stringify(TH.doc.layers)); TH.doc.layers = JSON.parse(TH.undo.pop()); if (!TH.doc.layers.some((l) => l.id === TH.sel)) TH.sel = null; thAll(); thChanged(); }
function thRedo() { if (!TH.redo.length) return; TH.undo.push(JSON.stringify(TH.doc.layers)); TH.doc.layers = JSON.parse(TH.redo.pop()); thAll(); thChanged(); }
function thAll() { thRender(); thLayersUi(); thPropsUi(); }
const thSelL = () => TH && TH.doc.layers.find((l) => l.id === TH.sel);
function thFit() {
  const st = $('.thx-stage'), b = $('.thx-board'); if (!st || !TH) return;
  const r = st.getBoundingClientRect(), d = TH.doc;
  TH.scale = Math.min((r.width - 60) / d.W, (r.height - 60) / d.H, 1);
  b.style.width = d.W * TH.scale + 'px'; b.style.height = d.H * TH.scale + 'px';
  thSelUi();
}
function thTool(t) {
  if (t === 'image') { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.multiple = true; i.onchange = () => thAddFiles([...i.files]); i.click(); return; }
  if (t === 'sticker') { const s = $('.thx-stickers'); s.hidden = !s.hidden; return; }
  const d = TH.doc, m = Math.min(d.W, d.H);
  if (t === 'text') { thAdd({ type: 'text', name: 'Text', text: 'YOUR TEXT', font: 'Impact', size: Math.round(m * 0.14), color: '#ffffff', stroke: '#000000', strokeW: Math.round(m * 0.012), glow: 0, glowColor: '#ffd23f', shadow: 0.5, bold: true, align: 'center', spacing: 0 }); setTimeout(() => { const ta = $('.thx-props textarea'); if (ta) { ta.focus(); ta.select(); } }, 30); return; }
  if (t === 'rect' || t === 'ellipse' || t === 'arrow') { thAdd({ type: 'shape', shape: t, name: { rect: 'Rectangle', ellipse: 'Circle', arrow: 'Arrow' }[t], w: t === 'arrow' ? m * 0.45 : m * 0.4, h: t === 'arrow' ? m * 0.22 : m * 0.3, fill: t === 'arrow' ? '#ff2d2d' : '', stroke: t === 'arrow' ? '#ffffff' : '#ff2d2d', strokeW: Math.round(m * 0.015), radius: 16 }); return; }
  TH.tool = t;
  $$('.thx-tools button').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
}
function thAdd(props) {
  thPush();
  const d = TH.doc;
  const L = { id: uid(), visible: true, locked: false, opacity: 1, blend: 'source-over', x: d.W / 2, y: d.H / 2, w: 100, h: 100, rot: 0, ...props };
  d.layers.push(L); TH.sel = L.id; thAll(); thChanged();
  return L;
}
async function thAddFiles(files) {
  const imgs = files.filter((f) => /^image\//.test(f.type)); if (!imgs.length) return toast('Choose a picture (PNG, JPG, WebP…)', { error: true });
  for (const f of imgs) {
    const id = uid(); await thPutImg(id, f);
    const im = await thLoadImg(id); if (!im || !im.naturalWidth) continue;
    const d = TH.doc, k = Math.min(d.W / im.naturalWidth, d.H / im.naturalHeight, 1) * (d.layers.length <= 1 ? 1 : 0.7);
    // the first picture fills the canvas like a background
    const cover = d.layers.filter((l) => l.type === 'image').length === 0 ? Math.max(d.W / im.naturalWidth, d.H / im.naturalHeight) : k;
    thAdd({ type: 'image', name: f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Picture', img: id, w: im.naturalWidth * cover, h: im.naturalHeight * cover, bright: 0, contrast: 0, sat: 0, blur: 0, flip: false, shadow: 0, outline: 0, outlineColor: '#ffffff' });
  }
  thTool('move');
}
function thPaste(e) {
  if (!TH || e.target.matches('input, textarea')) return;
  const files = [...(e.clipboardData ? e.clipboardData.files : [])];
  if (files.length) { e.preventDefault(); thAddFiles(files); }
}
function thDuplicate() { const L = thSelL(); if (!L) return; const c = JSON.parse(JSON.stringify(L)); c.id = uid(); c.name = L.name + ' copy'; c.x += 24; c.y += 24; c.locked = false; thPush(); TH.doc.layers.splice(TH.doc.layers.indexOf(L) + 1, 0, c); TH.sel = c.id; thAll(); thChanged(); }
function thDelete() { const L = thSelL(); if (!L) return; thPush(); TH.doc.layers = TH.doc.layers.filter((x) => x !== L); TH.sel = null; thAll(); thChanged(); }

/* ---------- drawing ---------- */
function thDraw(x, guides) {
  const d = TH.doc;
  x.clearRect(0, 0, d.W, d.H);
  for (const L of d.layers) {
    if (!L.visible) continue;
    x.save();
    x.globalAlpha = L.opacity == null ? 1 : L.opacity;
    x.globalCompositeOperation = L.blend || 'source-over';
    if (L.type === 'fill') {
      if (L.grad) { const g = x.createLinearGradient(0, 0, d.W, d.H); g.addColorStop(0, L.fill); g.addColorStop(1, L.fill2 || L.fill); x.fillStyle = g; } else x.fillStyle = L.fill;
      x.fillRect(0, 0, d.W, d.H); x.restore(); L._bb = null; continue;
    }
    x.translate(L.x, L.y); x.rotate(((L.rot || 0) * Math.PI) / 180);
    if (L.type === 'image') {
      const im = thImgs.get(L.img);
      if (im && im.naturalWidth) {
        if (L.flip) x.scale(-1, 1);
        if (L.shadow) { x.shadowColor = `rgba(0,0,0,${0.75 * L.shadow})`; x.shadowBlur = 40 * L.shadow; x.shadowOffsetY = 14 * L.shadow; }
        if (L.outline) {
          // a sticker-style outline around cut-out pictures (PNG with see-through parts)
          const o = L.outline, steps = 16; const tmp = thOutline(im, L.w, L.h, o, L.outlineColor);
          x.drawImage(tmp, -L.w / 2 - o, -L.h / 2 - o); void steps;
        }
        x.filter = `brightness(${100 + (L.bright || 0)}%) contrast(${100 + (L.contrast || 0)}%) saturate(${100 + (L.sat || 0)}%)${L.blur ? ` blur(${L.blur}px)` : ''}`;
        x.drawImage(im, -L.w / 2, -L.h / 2, L.w, L.h);
      }
    } else if (L.type === 'text') {
      const fam = L.sticker ? '"Segoe UI Emoji", "Apple Color Emoji", sans-serif' : `"${L.font}", Impact, sans-serif`;
      x.font = `${L.bold && !L.sticker ? 900 : 400} ${L.size}px ${fam}`;
      if ('letterSpacing' in x) x.letterSpacing = (L.spacing || 0) + 'px';
      x.textBaseline = 'middle'; x.textAlign = L.align || 'center';
      const lines = String(L.text || ' ').split('\n'), lh = L.size * 1.08;
      const tw = Math.max(1, ...lines.map((l) => x.measureText(l).width));
      L.w = tw + L.size * 0.2; L.h = lh * lines.length + L.size * 0.1;
      const ax = L.align === 'left' ? -tw / 2 : L.align === 'right' ? tw / 2 : 0;
      lines.forEach((ln, i) => {
        const y = (i - (lines.length - 1) / 2) * lh;
        x.save();
        if (L.glow) { x.shadowColor = L.glowColor || L.color; x.shadowBlur = L.glow; }
        else if (L.shadow) { x.shadowColor = `rgba(0,0,0,${0.8 * L.shadow})`; x.shadowBlur = L.size * 0.15 * L.shadow + 4; x.shadowOffsetY = L.size * 0.06 * L.shadow; }
        if (L.strokeW) { x.lineJoin = 'round'; x.miterLimit = 2; x.lineWidth = L.strokeW * 2; x.strokeStyle = L.stroke || '#000'; x.strokeText(ln, ax, y); x.shadowColor = 'transparent'; }
        x.fillStyle = L.color; x.fillText(ln, ax, y);
        x.restore();
      });
    } else if (L.type === 'shape') {
      const w = L.w, h = L.h;
      x.lineJoin = 'round'; x.lineCap = 'round';
      x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 18;
      x.beginPath();
      if (L.shape === 'ellipse') x.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      else if (L.shape === 'rect') x.roundRect(-w / 2, -h / 2, w, h, Math.min(L.radius || 0, w / 2, h / 2));
      else { const t = h * 0.36, hw = Math.min(w * 0.45, h * 0.9); x.moveTo(-w / 2, -t / 2); x.lineTo(w / 2 - hw, -t / 2); x.lineTo(w / 2 - hw, -h / 2); x.lineTo(w / 2, 0); x.lineTo(w / 2 - hw, h / 2); x.lineTo(w / 2 - hw, t / 2); x.lineTo(-w / 2, t / 2); x.closePath(); }
      if (L.fill) { x.fillStyle = L.fill; x.fill(); x.shadowColor = 'transparent'; }
      if (L.strokeW && L.stroke) { x.lineWidth = L.strokeW; x.strokeStyle = L.stroke; x.stroke(); }
    }
    x.restore();
  }
  void guides;
}
const thOutlineCache = new Map();
function thOutline(im, w, h, o, color) {
  const key = im.src + '|' + Math.round(w) + '|' + Math.round(h) + '|' + o + '|' + color;
  if (thOutlineCache.has(key)) return thOutlineCache.get(key);
  const c = document.createElement('canvas'); c.width = Math.ceil(w + o * 2); c.height = Math.ceil(h + o * 2);
  const x = c.getContext('2d');
  for (let a = 0; a < 360; a += 20) { const r = (a * Math.PI) / 180; x.drawImage(im, o + Math.cos(r) * o, o + Math.sin(r) * o, w, h); }
  x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  if (thOutlineCache.size > 30) thOutlineCache.clear();
  thOutlineCache.set(key, c); return c;
}
function thRender() { if (!TH) return; const cv = $('.thx-cv'); thDraw(cv.getContext('2d'), true); thSelUi(); }
function thSelUi() {
  const box = $('.thx-selbox'); if (!box || !TH) return;
  const L = thSelL();
  if (!L || L.type === 'fill' || !L.visible) { box.hidden = true; return; }
  const s = TH.scale;
  box.hidden = false; box.classList.toggle('locked', !!L.locked);
  box.style.width = L.w * s + 'px'; box.style.height = L.h * s + 'px';
  box.style.transform = `translate(${L.x * s - (L.w * s) / 2}px, ${L.y * s - (L.h * s) / 2}px) rotate(${L.rot || 0}deg)`;
}

/* ---------- mouse: select, move, resize, rotate ---------- */
function thToLocal(L, px, py) { const r = (-(L.rot || 0) * Math.PI) / 180, dx = px - L.x, dy = py - L.y; return [dx * Math.cos(r) - dy * Math.sin(r), dx * Math.sin(r) + dy * Math.cos(r)]; }
function thHit(px, py) {
  const ls = TH.doc.layers;
  for (let i = ls.length - 1; i >= 0; i--) { const L = ls[i]; if (!L.visible || L.type === 'fill') continue; const [lx, ly] = thToLocal(L, px, py); if (Math.abs(lx) <= L.w / 2 && Math.abs(ly) <= L.h / 2) return L; }
  return null;
}
function thCanvasEvents(cv) {
  const board = $('.thx-board');
  const docPt = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * TH.doc.W, ((e.clientY - r.top) / r.height) * TH.doc.H]; };
  board.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const handle = e.target.closest('.thx-selbox i');
    let L = thSelL();
    const [px, py] = docPt(e);
    if (!handle) {
      const hit = thHit(px, py);
      // clicking where the selected layer is keeps it selected (so you can grab things that are under others)
      if (!(L && !L.locked && L.type !== 'fill' && (() => { const [lx, ly] = thToLocal(L, px, py); return Math.abs(lx) <= L.w / 2 && Math.abs(ly) <= L.h / 2; })())) L = hit;
      TH.sel = L ? L.id : null; thLayersUi(); thPropsUi(); thSelUi();
      if (!L || L.locked) return;
    }
    if (!L || L.locked) return;
    e.preventDefault(); board.setPointerCapture(e.pointerId);
    const o = { x: L.x, y: L.y, w: L.w, h: L.h, rot: L.rot || 0, size: L.size };
    const mode = handle ? handle.dataset.h : 'move';
    let pushed = false;
    const move = (ev) => {
      if (!pushed) { thPush(); pushed = true; }
      const [qx, qy] = docPt(ev);
      if (mode === 'move') {
        let nx = o.x + qx - px, ny = o.y + qy - py;
        // snap to the middle and the edges
        const d = TH.doc, sn = 10 / TH.scale;
        for (const [v, t] of [[nx, d.W / 2], [nx - L.w / 2, 0], [nx + L.w / 2, d.W]]) if (Math.abs(v - t) < sn) nx += t - v;
        for (const [v, t] of [[ny, d.H / 2], [ny - L.h / 2, 0], [ny + L.h / 2, d.H]]) if (Math.abs(v - t) < sn) ny += t - v;
        L.x = nx; L.y = ny;
      } else if (mode === 'rot') {
        let a = (Math.atan2(qy - o.y, qx - o.x) * 180) / Math.PI + 90;
        if (ev.shiftKey) a = Math.round(a / 15) * 15; else if (Math.abs(((a % 90) + 90) % 90) < 3 || Math.abs(((a % 90) + 90) % 90) > 87) a = Math.round(a / 90) * 90;
        L.rot = ((a + 540) % 360) - 180;
      } else {
        const sx = mode.includes('e') ? 1 : -1, sy = mode.includes('s') ? 1 : -1;
        const [lx, ly] = thToLocal({ ...o }, qx, qy);
        const ox = (-sx * o.w) / 2, oy = (-sy * o.h) / 2; // the corner that stays put
        let w = Math.max(10, (lx - ox) * sx), h = Math.max(10, (ly - oy) * sy);
        const keep = L.type !== 'shape' ? !ev.shiftKey : ev.shiftKey;
        if (keep) { const k = Math.max(w / o.w, h / o.h); w = o.w * k; h = o.h * k; }
        const cx = ox + (sx * w) / 2, cy = oy + (sy * h) / 2, r = (o.rot * Math.PI) / 180;
        L.x = o.x + cx * Math.cos(r) - cy * Math.sin(r); L.y = o.y + cx * Math.sin(r) + cy * Math.cos(r);
        if (L.type === 'text') L.size = Math.max(6, Math.round(o.size * (h / o.h)));
        else { L.w = w; L.h = h; }
      }
      thRender();
    };
    const up = () => { board.removeEventListener('pointermove', move); board.removeEventListener('pointerup', up); if (pushed) { thPropsUi(); thChanged(); } };
    board.addEventListener('pointermove', move); board.addEventListener('pointerup', up);
  });
  board.addEventListener('dblclick', (e) => { const L = thSelL(); if (L && L.type === 'text') { const ta = $('.thx-props textarea'); if (ta) { ta.focus(); ta.select(); } } void e; });
}
function thKey(e) {
  if (!TH) return;
  const typing = e.target.matches('input, textarea, select');
  const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
  e.stopPropagation(); // the video editor's shortcuts stay quiet while the studio is open
  if (mod && k === 'z' && !typing) { e.preventDefault(); e.shiftKey ? thRedo() : thUndo(); return; }
  if (mod && k === 'y' && !typing) { e.preventDefault(); thRedo(); return; }
  if (mod && k === 's') { e.preventDefault(); thSave(); toast('Saved'); return; }
  if (mod && k === 'd' && !typing) { e.preventDefault(); thDuplicate(); return; }
  if (typing) { if (k === 'escape') e.target.blur(); return; }
  const L = thSelL();
  if ((k === 'delete' || k === 'backspace') && L && L.type !== 'fill') { e.preventDefault(); thDelete(); return; }
  if (k === 'escape') { if (L) { TH.sel = null; thAll(); } else closeThumbStudio(); return; }
  if (k === 'v') thTool('move'); else if (k === 't') thTool('text'); else if (k === 'i') thTool('image');
  if (L && !L.locked && L.type !== 'fill' && k.startsWith('arrow')) {
    e.preventDefault(); const st = e.shiftKey ? 10 : 1; thPush();
    if (k === 'arrowleft') L.x -= st; if (k === 'arrowright') L.x += st; if (k === 'arrowup') L.y -= st; if (k === 'arrowdown') L.y += st;
    thRender(); thChanged();
  }
}

/* ---------- layers panel ---------- */
function thLayerThumb(L) {
  if (L.type === 'image') { const im = thImgs.get(L.img); return im ? `<img src="${im.src}" alt="">` : ''; }
  if (L.type === 'fill') return `<span style="background:${L.grad ? `linear-gradient(135deg,${L.fill},${L.fill2})` : L.fill}"></span>`;
  if (L.type === 'text') return L.sticker ? `<em class="emo">${esc72(L.text)}</em>` : `<em style="color:${L.color};-webkit-text-stroke:1px ${L.stroke || 'transparent'}">T</em>`;
  return `<svg viewBox="0 0 24 24" style="color:${L.stroke || L.fill}">${TH_ICONS[L.shape]}</svg>`;
}
function thLayersUi() {
  const box = $('.thx-lrows'); if (!box || !TH) return;
  const ls = TH.doc.layers;
  $('.thx-lh span').textContent = ls.length;
  box.innerHTML = ls.slice().reverse().map((L) => `<div class="thx-lr${L.id === TH.sel ? ' on' : ''}${L.visible ? '' : ' hid'}" data-id="${L.id}" draggable="true">
    <button class="lv" data-tip="${L.visible ? 'Hide' : 'Show'}">${thIco(L.visible ? 'eye' : 'eyeOff')}</button>
    <span class="lt">${thLayerThumb(L)}</span><span class="ln">${esc72(L.name)}</span>
    <button class="lk${L.locked ? ' on' : ''}" data-tip="${L.locked ? 'Unlock' : 'Lock'}">${thIco(L.locked ? 'lock' : 'unlock')}</button></div>`).join('');
  box.onclick = (e) => {
    const r = e.target.closest('.thx-lr'); if (!r) return;
    const L = ls.find((x) => x.id === r.dataset.id); if (!L) return;
    if (e.target.closest('.lv')) { thPush(); L.visible = !L.visible; thAll(); thChanged(); return; }
    if (e.target.closest('.lk')) { thPush(); L.locked = !L.locked; thAll(); thChanged(); return; }
    TH.sel = L.id; thLayersUi(); thPropsUi(); thSelUi();
  };
  box.ondblclick = (e) => {
    const n = e.target.closest('.ln'); if (!n) return;
    const L = ls.find((x) => x.id === n.parentElement.dataset.id);
    const inp = document.createElement('input'); inp.className = 'ln-edit'; inp.value = L.name; n.replaceWith(inp); inp.focus(); inp.select();
    const done = () => { const v = inp.value.trim(); if (v && v !== L.name) { thPush(); L.name = v.slice(0, 40); thChanged(); } thLayersUi(); };
    inp.onblur = done; inp.onkeydown = (ev) => { if (ev.key === 'Enter') inp.blur(); if (ev.key === 'Escape') { inp.value = L.name; inp.blur(); } };
  };
  // drag a row up or down to change the order
  let dragId = null;
  box.ondragstart = (e) => { const r = e.target.closest('.thx-lr'); dragId = r && r.dataset.id; e.dataTransfer.effectAllowed = 'move'; };
  box.ondragover = (e) => { e.preventDefault(); $$('.thx-lr', box).forEach((r) => r.classList.remove('above', 'below')); const r = e.target.closest('.thx-lr'); if (r && r.dataset.id !== dragId) { const b = r.getBoundingClientRect(); r.classList.add(e.clientY < b.top + b.height / 2 ? 'above' : 'below'); } };
  box.ondrop = (e) => {
    e.preventDefault(); const r = e.target.closest('.thx-lr'); if (!r || !dragId || r.dataset.id === dragId) return thLayersUi();
    const b = r.getBoundingClientRect(), above = e.clientY < b.top + b.height / 2;
    thPush();
    const L = ls.find((x) => x.id === dragId); ls.splice(ls.indexOf(L), 1);
    const ti = ls.findIndex((x) => x.id === r.dataset.id);
    ls.splice(above ? ti + 1 : ti, 0, L); // the list is shown top layer first
    thAll(); thChanged();
  };
}

/* ---------- properties of the selected layer ---------- */
function thPropsUi() {
  const p = $('.thx-props'); if (!p || !TH) return;
  const L = thSelL(), d = TH.doc;
  if (!L) { p.innerHTML = `<div class="thx-ph"><b>${d.W} × ${d.H}</b><p>Add a picture (or drop / paste one), some text or a shape. Click anything to change it.</p><button class="btn primary wide" data-q="img">${thIco('image')}Add pictures</button><button class="btn wide" data-q="text">${thIco('text')}Add text</button></div>`; $('[data-q=img]', p).onclick = () => thTool('image'); $('[data-q=text]', p).onclick = () => thTool('text'); return; }
  const num = (k, n, a, b, st = 1, v = L[k] || 0) => `<label class="tp-r"><span>${n}</span><input type="range" data-k="${k}" min="${a}" max="${b}" step="${st}" value="${v}"><em>${Math.round(v * (st < 1 ? 100 : 1)) / (st < 1 ? 100 : 1)}</em></label>`;
  const col = (k, n) => `<label class="tp-c"><input type="color" data-k="${k}" value="${L[k] || '#ffffff'}"><span>${n}</span></label>`;
  let h = `<div class="tp-h">${thLayerThumb(L).replace(/<img/, '<img class="tp-ti"')}<b>${esc72(L.name)}</b></div>`;
  if (L.type === 'fill') {
    h += `<div class="tp-row">${col('fill', 'Color')}${L.grad ? col('fill2', 'Second') : ''}<label class="tp-chk"><input type="checkbox" data-k="grad" ${L.grad ? 'checked' : ''}>Gradient</label></div>`;
  } else if (L.type === 'text') {
    h += `<textarea data-k="text" rows="2" spellcheck="false"></textarea>`;
    if (!L.sticker) h += `<div class="tp-row"><select data-k="font">${TH_FONTS.map((f) => `<option${f === L.font ? ' selected' : ''} style="font-family:'${f}'">${f}</option>`).join('')}</select><button class="tp-b${L.bold ? ' on' : ''}" data-tg="bold"><b>B</b></button>${['left', 'center', 'right'].map((a) => `<button class="tp-b${(L.align || 'center') === a ? ' on' : ''}" data-al="${a}"><svg viewBox="0 0 24 24"><path d="${a === 'left' ? 'M4 6h16M4 10h10M4 14h16M4 18h10' : a === 'right' ? 'M4 6h16M10 10h10M4 14h16M10 18h10' : 'M4 6h16M7 10h10M4 14h16M7 18h10'}"/></svg></button>`).join('')}</div>
      <div class="tp-row">${col('color', 'Fill')}${col('stroke', 'Outline')}${col('glowColor', 'Glow')}</div>`;
    h += num('size', 'Size', 8, Math.round(Math.max(d.W, d.H) * 0.4)) + (L.sticker ? '' : num('strokeW', 'Outline', 0, 60) + num('glow', 'Glow', 0, 120) + num('spacing', 'Spacing', -10, 40)) + num('shadow', 'Shadow', 0, 1, 0.05);
  } else if (L.type === 'image') {
    h += num('bright', 'Brightness', -60, 60) + num('contrast', 'Contrast', -60, 80) + num('sat', 'Color', -100, 100) + num('blur', 'Blur', 0, 30) + num('shadow', 'Shadow', 0, 1, 0.05) + num('outline', 'Outline', 0, 30);
    h += `<div class="tp-row">${col('outlineColor', 'Outline color')}<button class="btn small" data-x="flip">Flip</button><button class="btn small" data-x="fit">Fill canvas</button><button class="btn small" data-x="real">Reset size</button></div>`;
  } else {
    h += `<div class="tp-row">${col('stroke', 'Line')}<label class="tp-c"><input type="color" data-k="fill" value="${L.fill || '#ff2d2d'}"><span>Fill</span></label><label class="tp-chk"><input type="checkbox" data-k="hasFill" ${L.fill ? 'checked' : ''}>Filled</label></div>`;
    h += num('strokeW', 'Line', 0, 60) + (L.shape === 'rect' ? num('radius', 'Corners', 0, 200) : '');
  }
  if (L.type !== 'fill') h += num('rot', 'Rotate', -180, 180);
  h += `<div class="tp-sep"></div>` + num('opacity', 'Opacity', 0, 1, 0.01, L.opacity == null ? 1 : L.opacity) + `<label class="tp-r"><span>Blend</span><select data-k="blend">${TH_BLENDS.map(([v, n]) => `<option value="${v}"${(L.blend || 'source-over') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`;
  if (L.type !== 'fill') h += `<div class="tp-row tp-order"><button class="btn small" data-x="top">To front</button><button class="btn small" data-x="up">Forward</button><button class="btn small" data-x="down">Backward</button><button class="btn small" data-x="center">Center</button></div>`;
  p.innerHTML = h;
  const ta = $('textarea', p); if (ta) ta.value = L.text;
  let editing = false;
  const begin = () => { if (!editing) { thPush(); editing = true; } };
  p.oninput = (e) => {
    const i = e.target, k = i.dataset.k; if (!k) return;
    begin();
    if (k === 'grad') L.grad = i.checked;
    else if (k === 'hasFill') L.fill = i.checked ? L.fill || '#ff2d2d' : '';
    else if (k === 'fill' && L.type === 'shape') L.fill = i.value;
    else L[k] = i.type === 'range' ? +i.value : i.value;
    if (i.type === 'range' && i.nextElementSibling) i.nextElementSibling.textContent = Math.round(+i.value * (i.step < 1 ? 100 : 1)) / (i.step < 1 ? 100 : 1);
    if (k === 'text') { const n = String(L.text).split('\n')[0].trim().slice(0, 24); if (!L.sticker && n) L.name = n; }
    thRender();
    if (i.type === 'checkbox') { thPropsUi(); thLayersUi(); }
  };
  p.onchange = (e) => { editing = false; if (e.target.dataset.k) { thLayersUi(); thChanged(); } };
  p.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const ls = d.layers, i = ls.indexOf(L);
    thPush();
    if (b.dataset.tg) L[b.dataset.tg] = !L[b.dataset.tg];
    else if (b.dataset.al) L.align = b.dataset.al;
    else if (b.dataset.x === 'flip') L.flip = !L.flip;
    else if (b.dataset.x === 'fit' || b.dataset.x === 'real') { const im = thImgs.get(L.img); if (im) { const k = b.dataset.x === 'fit' ? Math.max(d.W / im.naturalWidth, d.H / im.naturalHeight) : Math.min(1, d.W / im.naturalWidth, d.H / im.naturalHeight); L.w = im.naturalWidth * k; L.h = im.naturalHeight * k; L.x = d.W / 2; L.y = d.H / 2; L.rot = 0; } }
    else if (b.dataset.x === 'center') { L.x = d.W / 2; L.y = d.H / 2; }
    else if (b.dataset.x === 'top') { ls.splice(i, 1); ls.push(L); }
    else if (b.dataset.x === 'up' && i < ls.length - 1) { ls.splice(i, 1); ls.splice(i + 1, 0, L); }
    else if (b.dataset.x === 'down' && i > 1) { ls.splice(i, 1); ls.splice(i - 1, 0, L); }
    else { TH.undo.pop(); return; }
    thAll(); thChanged();
  };
}
async function thExport() {
  if (!TH) return;
  const c = document.createElement('canvas'); c.width = TH.doc.W; c.height = TH.doc.H;
  thDraw(c.getContext('2d'), false);
  const png = c.toDataURL('image/png'), jpg = c.toDataURL('image/jpeg', 0.92);
  const name = TH.doc.name.replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60);
  await thSave();
  if (api && api.saveThumbnail) { const p = await api.saveThumbnail({ png, jpg, name }); if (p) { toast('Thumbnail saved'); bump('thumbnails'); } }
  else { const a = document.createElement('a'); a.href = png; a.download = name + '.png'; a.click(); }
}
