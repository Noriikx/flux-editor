/* =====================================================================
   Flux — a simple, friendly video editor
   Everything that happens inside the window lives in this file:
   media library, timeline, preview player, inspector and export.
   ===================================================================== */
'use strict';

const api = window.flux || null;           // bridge to the computer (see preload.js)
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 10);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
let FPS = 30; // follows the project's frame rate (Quality settings)
const MIN_DUR = 0.1;

const ASPECTS = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350] };

const EXT = {
  video: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'ogv'],
  audio: ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
};

const ICON = {
  video: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>',
  image: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  audio: '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>',
  text: '<svg viewBox="0 0 24 24"><path d="M5 6V4h14v2"/><path d="M12 4v16"/><path d="M9 20h6"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeOff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  vol: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>',
  volOff: '<svg viewBox="0 0 24 24"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/></svg>'
};
const CROWN = '<svg class="crown-i" viewBox="0 0 24 24"><defs><linearGradient id="crownG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6eaff"/><stop offset=".5" stop-color="#a59cff"/><stop offset="1" stop-color="#6c4bff"/></linearGradient></defs><path d="M3 7.5l4.6 4.2L12 4.5l4.4 7.2L21 7.5l-1.9 11H4.9L3 7.5z" fill="url(#crownG)" stroke="none"/><path d="M5.2 20.5h13.6" stroke="#a59cff" stroke-width="1.8" stroke-linecap="round"/></svg>';
const KIND_COLOR = { video: 'var(--c-video)', image: 'var(--c-image)', audio: 'var(--c-audio)', text: 'var(--c-text)' };

const FILTERS = [
  { id: 'none', name: 'Original', css: '' },
  { id: 'vivid', name: 'Vivid', css: 'saturate(1.55) contrast(1.12)' },
  { id: 'warm', name: 'Warm', css: 'saturate(1.15) contrast(1.03)', tint: 'rgba(255,145,40,0.35)' },
  { id: 'cool', name: 'Cool', css: 'saturate(0.95) brightness(1.03)', tint: 'rgba(50,130,255,0.35)' },
  { id: 'bw', name: 'B & W', css: 'grayscale(1) contrast(1.05)' },
  { id: 'noir', name: 'Noir', css: 'grayscale(1) contrast(1.5) brightness(0.9)' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.55) contrast(0.9) brightness(1.06) saturate(0.9)' },
  { id: 'faded', name: 'Faded', css: 'contrast(0.78) brightness(1.12) saturate(0.72)' },
  { id: 'dreamy', name: 'Dreamy', css: 'brightness(1.1) saturate(1.3) contrast(0.92)', tint: 'rgba(255,150,230,0.25)' },
  { id: 'drama', name: 'Drama', css: 'contrast(1.4) saturate(0.8) brightness(0.93)' },
  { id: 'pop', name: 'Pop', css: 'saturate(2) contrast(1.08)' },
  { id: 'sunset', name: 'Sunset', css: 'saturate(1.35) contrast(1.05)', tint: 'rgba(255,80,60,0.35)' }
];
const filterById = (id) => FILTERS.find((f) => f.id === id) || FILTERS[0];

const FONTS = ['Segoe UI', 'Arial', 'Arial Black', 'Impact', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Courier New', 'Comic Sans MS', 'Tahoma'];
const TEXT_COLORS = ['#ffffff', '#000000', '#ffd23f', '#ff5c7a', '#8d7dff', '#4fd6a0', '#4cc3ff', '#ff9f43'];

const DEFAULT_TEXT = {
  content: 'Your text', font: 'Segoe UI', size: 96, color: '#ffffff', bold: true, italic: false, align: 'center',
  x: 0.5, y: 0.5, bg: false, bgColor: '#000000', bgOpacity: 0.6, outline: false, outlineColor: '#000000',
  shadow: true, glow: false, anim: 'fade'
};

const TEXT_PRESETS = [
  { name: 'Title', t: { content: 'Your Title', size: 130, bold: true, shadow: true, anim: 'pop' } },
  { name: 'Subtitle', t: { content: 'A short subtitle', size: 64, bold: false, color: '#e6e6ff', y: 0.62, anim: 'fade' } },
  { name: 'Caption', t: { content: 'Caption text goes here', size: 54, bold: true, bg: true, bgOpacity: 0.65, shadow: false, y: 0.86, anim: 'none' } },
  { name: 'Lower third', t: { content: 'Your Name\nWhat you do', size: 52, bold: true, align: 'left', x: 0.07, y: 0.8, bg: true, bgColor: '#6c4bff', bgOpacity: 0.92, shadow: false, anim: 'slide' } },
  { name: 'Meme', t: { content: 'WHEN THE EDIT HITS', font: 'Impact', size: 110, bold: false, outline: true, shadow: false, y: 0.14, anim: 'none' } },
  { name: 'Neon', t: { content: 'NEON', size: 160, bold: true, color: '#c9b8ff', glow: true, shadow: false, anim: 'pop' } },
  { name: 'Typewriter', t: { content: 'Once upon a time...', font: 'Courier New', size: 72, bold: true, anim: 'type' } },
  { name: 'Highlight', t: { content: 'BIG NEWS', font: 'Arial Black', size: 100, bold: false, color: '#111111', bg: true, bgColor: '#ffd23f', bgOpacity: 1, shadow: false, anim: 'pop' } }
];

/* ============================ STATE ============================ */
function defaultTracks() {
  return [
    { id: 't1', type: 'text', name: 'Text', hidden: false, muted: false },
    { id: 'v2', type: 'video', name: 'Overlay', hidden: false, muted: false },
    { id: 'v1', type: 'video', name: 'Main video', hidden: false, muted: false },
    { id: 'av', type: 'audio', name: 'Video sound', hidden: false, muted: false },
    { id: 'a1', type: 'audio', name: 'Music', hidden: false, muted: false },
    { id: 'a2', type: 'audio', name: 'Sound FX', hidden: false, muted: false }
  ];
}
function newProject() {
  return {
    version: 2, id: uid() + uid(), name: 'Untitled project', aspect: '16:9', background: '#000000',
    tracks: defaultTracks(), clips: [], media: [], markers: [], output: { res: 1080, fps: 30 }, createdAt: Date.now(), updatedAt: Date.now()
  };
}

let P = newProject();
const state = {
  time: 0, playing: false, selectedId: null, zoom: 46, snap: true, ripple: false, loop: false,
  dirty: false, exporting: false, recording: false, inEditor: false
};
const rt = {
  players: new Map(),   // clipId -> { el, node, gain }
  images: new Map(),    // mediaId -> HTMLImageElement
  thumbs: new Map(),    // mediaId -> blob URL
  peaks: new Map(),     // mediaId -> Float32Array (0..1, for drawing)
  peaksAbs: new Map(),  // mediaId -> Float32Array (real loudness, for auto-balance)
  hitBoxes: [],
  needsDraw: true
};

const getMedia = (id) => P.media.find((m) => m.id === id);
const getTrack = (id) => P.tracks.find((t) => t.id === id);
const getClip = (id) => P.clips.find((c) => c.id === id);
const dur = (c) => (c.out - c.in) / c.speed;
const endOf = (c) => c.start + dur(c);
const projectDuration = () => P.clips.reduce((m, c) => Math.max(m, endOf(c)), 0);
const refSize = () => ASPECTS[P.aspect] || ASPECTS['16:9'];
const mediaUrl = (m) => (api ? api.mediaUrl(m.path) : m.path);
const trackTypeFor = (kind) => (kind === 'audio' ? 'audio' : kind === 'text' ? 'text' : 'video');
const isVisual = (c) => c && (c.kind === 'video' || c.kind === 'image');
const hasAudio = (c) => c && (c.kind === 'video' || c.kind === 'audio');

function fmt(t, withFrames = true) {
  t = Math.max(0, t || 0);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
  const f = Math.floor((t % 1) * FPS);
  const p = (n) => String(n).padStart(2, '0');
  const base = (h ? h + ':' + p(m) : p(m)) + ':' + p(s);
  return withFrames ? base + '.' + p(f) : base;
}
function fmtShort(t) {
  if (t < 60) return (Math.round(t * 10) / 10).toFixed(1) + 's';
  return fmt(t, false);
}

/* ============================ HISTORY ============================ */
const hist = { undo: [], redo: [], when: [] };
let pendingSnap = null;
const snapshot = () => JSON.stringify({ tracks: P.tracks, clips: P.clips, aspect: P.aspect, background: P.background, markers: P.markers, output: P.output });

function pushHistory(snap) {
  hist.undo.push(snap);
  hist.when.push(Date.now());
  if (hist.undo.length > 150) { hist.undo.shift(); hist.when.shift(); }
  hist.redo = [];
  markDirty();
  updateUndoButtons();
}
function commit(fn) {
  const s = snapshot();
  fn();
  if (snapshot() !== s) pushHistory(s);
  refreshAll();
}
function beginEdit() { if (!pendingSnap) pendingSnap = snapshot(); }
function endEdit() {
  if (pendingSnap && snapshot() !== pendingSnap) pushHistory(pendingSnap);
  pendingSnap = null;
  renderTimeline();
}
function restoreSnap(s) {
  const o = JSON.parse(s);
  const aspectChanged = o.aspect !== P.aspect;
  Object.assign(P, o);
  if (state.selectedId && !getClip(state.selectedId)) state.selectedId = null;
  if (aspectChanged) layoutStage();
  markDirty();
  refreshAll();
}
function undo() {
  if (!hist.undo.length) return toast('Nothing to undo');
  hist.redo.push(snapshot());
  hist.when.pop();
  restoreSnap(hist.undo.pop());
  updateUndoButtons();
}
function redo() {
  if (!hist.redo.length) return toast('Nothing to redo');
  hist.undo.push(snapshot());
  hist.when.push(Date.now());
  restoreSnap(hist.redo.pop());
  updateUndoButtons();
}
function updateUndoButtons() {
  $('#btnUndo').disabled = !hist.undo.length;
  $('#btnRedo').disabled = !hist.redo.length;
}

// Projects save themselves: every change is written to the project manager shortly after.
let autosaveTimer = null;
function markDirty() {
  if (!state.inEditor) return;
  state.dirty = true;
  setSaveStatus('saving');
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => saveNow(), 700);
}
function markClean() {
  state.dirty = false;
  setSaveStatus('saved');
}
function setSaveStatus(s) {
  const elx = $('#saveStatus');
  if (!elx) return;
  elx.dataset.state = s;
  elx.lastChild.textContent = s === 'saving' ? 'Saving…' : s === 'error' ? 'Not saved' : 'Saved';
}
function projectThumb() {
  if (!P.clips.length) return null;
  try {
    const c = document.createElement('canvas');
    const [W, H] = refSize();
    c.width = 360; c.height = Math.round(360 * (H / W));
    c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.75);
  } catch { return null; }
}
async function saveNow({ sync = false } = {}) {
  clearTimeout(autosaveTimer);
  if (!state.inEditor) return;
  P.updatedAt = Date.now();
  const data = serializeProject();
  try {
    if (sync) { projectStore.saveSync(P.id, data); }
    else {
      const thumb = projectThumb();
      await projectStore.save(P.id, data, thumb);
      if (typeof maybeSaveVersion === 'function') maybeSaveVersion(data, thumb);
    }
    markClean();
  } catch (e) {
    console.error(e);
    setSaveStatus('error');
  }
}

/* ============================ UI HELPERS ============================ */
function toast(msg, opts = {}) {
  const el = document.createElement('div');
  el.className = 'toast' + (opts.error ? ' error' : '');
  el.innerHTML = `<span></span>`;
  el.firstChild.textContent = msg;
  if (opts.action) {
    const b = document.createElement('button');
    b.textContent = opts.action;
    b.onclick = () => { opts.onAction && opts.onAction(); el.remove(); };
    el.appendChild(b);
  }
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), opts.duration || (opts.action ? 9000 : 2600));
}

function modal(html, { wide = false, onClose } = {}) {
  closeModal();
  const bd = document.createElement('div');
  bd.className = 'backdrop';
  bd.innerHTML = `<div class="modal ${wide ? 'wide' : ''}">${html}</div>`;
  bd.addEventListener('pointerdown', (e) => { if (e.target === bd && !state.exporting) closeModal(); });
  $('#modalRoot').appendChild(bd);
  bd._onClose = onClose;
  return bd.firstChild;
}
function closeModal() {
  const bd = $('#modalRoot .backdrop');
  if (bd) { if (bd._onClose) bd._onClose(); bd.remove(); }
}
const modalOpen = () => !!$('#modalRoot .backdrop');

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

// Tooltips
(function setupTooltips() {
  const tip = $('#tooltip');
  let timer = null;
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('[data-tip]');
    clearTimeout(timer);
    tip.classList.remove('show');
    if (!t) return;
    timer = setTimeout(() => {
      tip.textContent = t.dataset.tip;
      const r = t.getBoundingClientRect();
      tip.classList.add('show');
      const tw = tip.offsetWidth;
      let x = r.left + r.width / 2 - tw / 2;
      x = clamp(x, 6, window.innerWidth - tw - 6);
      let y = r.bottom + 8;
      if (y + 30 > window.innerHeight) y = r.top - 34;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    }, 450);
  });
  document.addEventListener('pointerdown', () => { clearTimeout(timer); tip.classList.remove('show'); });
})();

/* ============================ MEDIA LIBRARY ============================ */
function kindFromName(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  for (const k of Object.keys(EXT)) if (EXT[k].includes(ext)) return k;
  return null;
}

async function importFiles(files) {
  // files: [{ path, name }]
  const added = [];
  const skipped = [];
  for (const f of files) {
    const kind = f.kind || kindFromName(f.name);
    if (!kind) { skipped.push(f.name); continue; }
    const existing = P.media.find((m) => m.path === f.path);
    if (existing) { added.push(existing); continue; }
    const m = { id: uid(), path: f.path, name: f.name, kind, duration: kind === 'image' ? 5 : (f.duration || 0), width: 0, height: 0, loading: true };
    if (f.credit) m.credit = f.credit;
    if (f.tag) m.tag = f.tag;
    P.media.push(m);
    added.push(m);
  }
  if (skipped.length) toast(`Skipped ${skipped.length} file(s) Flux can't open: ${skipped.slice(0, 3).join(', ')}`, { error: true });
  renderMedia();
  await Promise.all(added.filter((m) => m.loading).map(probeMedia));
  renderMedia();
  updateEmptyState();
  if (added.length) markDirty();
  return added.filter((m) => !m.error);
}

function probeMedia(m) {
  m.loading = true;
  m.error = false;
  return new Promise((resolve) => {
    const done = (ok) => {
      m.loading = false;
      if (!ok) m.error = true;
      renderMedia();
      requestDraw();
      resolve(m);
    };
    const timeout = setTimeout(() => done(false), 20000);
    const finish = (ok) => { clearTimeout(timeout); done(ok); };
    const url = mediaUrl(m);

    if (m.kind === 'image') {
      const img = new Image();
      img.onload = () => {
        m.width = img.naturalWidth; m.height = img.naturalHeight;
        rt.images.set(m.id, img);
        makeThumb(img, img.naturalWidth, img.naturalHeight, m).then(() => finish(true));
      };
      img.onerror = () => finish(false);
      img.src = url;
    } else if (m.kind === 'video') {
      const v = document.createElement('video');
      v.muted = true; v.preload = 'auto';
      v.onloadedmetadata = () => {
        m.duration = isFinite(v.duration) ? v.duration : m.duration;
        m.width = v.videoWidth; m.height = v.videoHeight;
        m.hasAudio = v.audioTracks ? v.audioTracks.length > 0 : true;
        if (!m.width) {
          // a .webm/.mp4 with sound only: treat it as audio
          clearTimeout(timeout);
          v.onerror = null; v.onseeked = null; v.removeAttribute('src'); v.load();
          m.kind = 'audio';
          probeMedia(m).then(resolve);
          return;
        }
        v.currentTime = Math.min(1, (m.duration || 1) * 0.15);
      };
      v.onseeked = () => {
        v.onseeked = null;
        makeThumb(v, v.videoWidth, v.videoHeight, m).then(() => { v.onerror = null; v.removeAttribute('src'); v.load(); finish(true); });
      };
      v.onerror = () => finish(false);
      v.src = url;
    } else {
      const a = document.createElement('audio');
      a.preload = 'metadata';
      const got = () => {
        a.ondurationchange = null; a.ontimeupdate = null;
        finish(m.duration > 0);
        loadPeaks(m);
      };
      a.onloadedmetadata = () => {
        if (isFinite(a.duration) && a.duration > 0) { m.duration = a.duration; return got(); }
        if (m.duration > 0) return got();
        // Recorded files sometimes don't report their length - ask the browser to find the end.
        a.ondurationchange = () => { if (isFinite(a.duration) && a.duration > 0) { m.duration = a.duration; got(); } };
        a.currentTime = 1e9;
      };
      a.onerror = () => finish(false);
      a.src = url;
    }
  });
}

function makeThumb(src, w, h, m) {
  return new Promise((resolve) => {
    const c = document.createElement('canvas');
    const tw = 240, th = Math.round(240 * Math.min(h / w, 1.8)) || 135;
    c.width = tw; c.height = th;
    try { c.getContext('2d').drawImage(src, 0, 0, tw, th); } catch {}
    c.toBlob((b) => {
      if (b) {
        const old = rt.thumbs.get(m.id);
        if (old) URL.revokeObjectURL(old);
        rt.thumbs.set(m.id, URL.createObjectURL(b));
      }
      resolve();
    }, 'image/jpeg', 0.8);
  });
}

const peaksLoading = new Set();
async function loadPeaks(m) {
  if (!m || peaksLoading.has(m.id)) return;
  peaksLoading.add(m.id);
  try {
    // Desktop app: read the sound with ffmpeg (fast, works for big videos too)
    if (api && api.mediaPeaks) {
      const r = await api.mediaPeaks(m.path);
      if (r && r.peaks && r.peaks.length) {
        const abs = Float32Array.from(r.peaks);
        let max = 0.0001;
        for (const v of abs) if (v > max) max = v;
        rt.peaksAbs.set(m.id, abs);
        rt.peaks.set(m.id, abs.map((v) => v / max));
        renderLanes();
        return;
      }
      if (r && r.silent) { rt.peaksAbs.set(m.id, new Float32Array(10)); rt.peaks.set(m.id, new Float32Array(10)); renderLanes(); return; }
    }
    const res = await fetch(mediaUrl(m));
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 600 * 1024 * 1024) return;
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const audio = await ctx.decodeAudioData(buf);
    const ch = audio.getChannelData(0);
    const N = Math.min(6000, Math.max(200, Math.round(audio.duration * 40)));
    const peaks = new Float32Array(N);
    const step = Math.floor(ch.length / N) || 1;
    let max = 0.0001;
    for (let i = 0; i < N; i++) {
      let p = 0;
      const s = i * step;
      for (let j = 0; j < step; j += 8) { const v = Math.abs(ch[s + j] || 0); if (v > p) p = v; }
      peaks[i] = p; if (p > max) max = p;
    }
    rt.peaksAbs.set(m.id, Float32Array.from(peaks));
    for (let i = 0; i < N; i++) peaks[i] /= max;
    rt.peaks.set(m.id, peaks);
    renderLanes();
  } catch { /* waveform is optional */ }
  finally { peaksLoading.delete(m.id); }
}

function renderMedia() {
  const grid = $('#mediaGrid');
  grid.innerHTML = '';
  for (const m of P.media) {
    const item = el('div', `media-item ${m.kind}${m.loading ? ' loading' : ''}${m.missing || m.error ? ' missing' : ''}`);
    item.draggable = !m.missing && !m.error && !m.loading;
    item.dataset.id = m.id;
    const thumb = rt.thumbs.get(m.id);
    item.innerHTML = `
      <div class="thumb" ${thumb ? `style="background-image:url('${thumb}')"` : ''}>${!thumb && !m.loading ? ICON[m.kind] : ''}</div>
      <span class="kind">${m.tag || m.kind}</span>
      ${m.kind !== 'image' && m.duration ? `<span class="dur">${fmt(m.duration, false)}</span>` : ''}
      <button class="remove" data-tip="Remove from library">${ICON.x}</button>
      <button class="add" data-tip="Add to the end of the timeline">${ICON.plus}</button>
      <div class="meta"><div class="name"></div></div>`;
    $('.name', item).textContent = m.missing ? 'Missing: ' + m.name : m.error ? "Can't play: " + m.name : m.name;
    $('.name', item).title = m.path;
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/flux-media', m.id);
      e.dataTransfer.effectAllowed = 'copy';
    });
    item.addEventListener('dblclick', () => appendMediaToTimeline(m));
    $('.add', item).addEventListener('click', (e) => { e.stopPropagation(); appendMediaToTimeline(m); });
    $('.remove', item).addEventListener('click', (e) => { e.stopPropagation(); removeMedia(m); });
    item.addEventListener('click', () => { if (m.missing) relinkMedia(m); });
    grid.appendChild(item);
  }
  $('#mediaHint').style.display = P.media.length ? '' : 'none';
}

function removeMedia(m) {
  const used = P.clips.filter((c) => c.mediaId === m.id).length;
  const doIt = () => {
    commit(() => { P.clips = P.clips.filter((c) => c.mediaId !== m.id); });
    P.media = P.media.filter((x) => x.id !== m.id);
    renderMedia(); updateEmptyState(); markDirty();
  };
  if (!used) return doIt();
  const box = modal(`<h2>Remove “<span class="n"></span>”?</h2>
    <p class="sub">It's used ${used} time(s) on your timeline. Those clips will be removed too.</p>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn danger" data-a="yes">Remove</button></div>`);
  $('.n', box).textContent = m.name;
  $('[data-a=no]', box).onclick = closeModal;
  $('[data-a=yes]', box).onclick = () => { closeModal(); doIt(); };
}

async function relinkMedia(m) {
  if (!api) return;
  toast(`Find “${m.name}” on your computer`);
  const files = await api.openMedia();
  if (!files.length) return;
  m.path = files[0].path; m.missing = false;
  for (const c of P.clips) if (c.mediaId === m.id) destroyPlayer(c.id);
  await probeMedia(m);
  renderMedia(); renderTimeline(); markDirty();
}

async function promptImport() {
  if (api) {
    const files = await api.openMedia();
    if (files.length) return importFiles(files);
  } else {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true;
    inp.onchange = () => importFiles(Array.from(inp.files).map((f) => ({ path: URL.createObjectURL(f), name: f.name })));
    inp.click();
  }
  return [];
}

/* ============================ CLIPS ============================ */
function visualDefaults() {
  return {
    fit: 'contain', scale: 1, x: 0, y: 0, rotation: 0, opacity: 1, brightness: 100, contrast: 100, saturation: 100, blur: 0, filter: 'none',
    flipH: false, flipV: false, crop: { l: 0, r: 0, t: 0, b: 0 }, motion: 'none', blend: 'source-over', bgBlur: false, transition: null
  };
}
function makeMediaClip(m, trackId, start) {
  const d = m.kind === 'image' ? 5 : m.duration;
  const c = { id: uid(), trackId, mediaId: m.id, kind: m.kind, start, in: 0, out: d, speed: 1, volume: 1, muted: false, fadeIn: 0, fadeOut: 0 };
  if (m.kind !== 'audio') Object.assign(c, visualDefaults());
  return c;
}
function makeTextClip(start, textProps = {}) {
  return {
    id: uid(), trackId: firstTrack('text').id, kind: 'text', start, in: 0, out: 4, speed: 1,
    fadeIn: 0, fadeOut: 0, opacity: 1, rotation: 0, scale: 1, text: Object.assign({}, DEFAULT_TEXT, textProps)
  };
}
function firstTrack(type) {
  if (type === 'video') return getTrack('v1') && getTrack('v1').type === 'video' ? getTrack('v1') : P.tracks.filter((t) => t.type === 'video').pop();
  return P.tracks.find((t) => t.type === type);
}
function trackEnd(trackId) {
  return P.clips.filter((c) => c.trackId === trackId).reduce((m, c) => Math.max(m, endOf(c)), 0);
}
function findFreeStart(trackId, desired, d, excludeId) {
  const others = P.clips.filter((o) => o.trackId === trackId && o.id !== excludeId).map((o) => [o.start, endOf(o)]);
  const fits = (s) => s >= -1e-6 && others.every(([a, b]) => s + d <= a + 1e-4 || s >= b - 1e-4);
  if (fits(desired)) return Math.max(0, desired);
  const cands = [0, ...others.map((o) => o[1]), ...others.map((o) => o[0] - d)].filter(fits);
  cands.sort((a, b) => Math.abs(a - desired) - Math.abs(b - desired));
  return cands.length ? Math.max(0, cands[0]) : trackEnd(trackId);
}

function maybeMatchAspect(m) {
  if (typeof settings !== 'undefined' && settings.autoAspect === false) return;
  if (P.clips.some((c) => isVisual(c)) || !(m.kind === 'video' || m.kind === 'image') || !m.width) return;
  const r = m.width / m.height;
  let target = null;
  if (r < 0.7 && P.aspect !== '9:16') target = '9:16';
  else if (r > 0.9 && r < 1.1 && P.aspect !== '1:1') target = '1:1';
  if (target) {
    const prev = P.aspect;
    setAspect(target);
    toast(`Switched to ${target} to match your ${m.kind}`, { action: 'Undo', onAction: () => setAspect(prev) });
  }
}

function appendMediaToTimeline(m) {
  if (m.loading) return toast('Still loading, one moment…');
  if (m.missing || m.error) return toast("This file can't be used", { error: true });
  const track = firstTrack(trackTypeFor(m.kind));
  maybeMatchAspect(m);
  let c;
  commit(() => {
    c = makeMediaClip(m, track.id, trackEnd(track.id));
    P.clips.push(c);
    linkSoundFor(c, m);
    state.selectedId = c.id;
  });
  if (P.clips.length <= 2) seek(0);
  scrollTimelineTo(c.start);
}

function addMediaAt(m, trackId, start) {
  if (m.loading || m.missing || m.error) return null;
  const track = getTrack(trackId);
  const type = trackTypeFor(m.kind);
  const t = track && track.type === type ? track : firstTrack(type);
  maybeMatchAspect(m);
  let c;
  commit(() => {
    c = makeMediaClip(m, t.id, 0);
    c.start = findFreeStart(t.id, Math.max(0, start), dur(c), c.id);
    P.clips.push(c);
    linkSoundFor(c, m);
    state.selectedId = c.id;
  });
  return c;
}

function addText(props) {
  let c;
  commit(() => {
    const track = firstTrack('text');
    c = makeTextClip(0, props);
    c.trackId = track.id;
    c.start = findFreeStart(track.id, state.time, dur(c), c.id);
    P.clips.push(c);
    state.selectedId = c.id;
  });
  if (c.start !== state.time) seek(c.start);
  toast('Text added - drag it in the preview to move it');
}

function splitAt(t = state.time) {
  let targets = [];
  const sel = getClip(state.selectedId);
  if (sel && t > sel.start + 0.02 && t < endOf(sel) - 0.02) targets = [sel];
  else targets = P.clips.filter((c) => t > c.start + 0.02 && t < endOf(c) - 0.02);
  if (!targets.length) return toast('Move the playhead over a clip to split it');
  // linked video+sound split together
  for (const c of targets.slice()) for (const p of partners(c)) if (!targets.includes(p) && t > p.start + 0.02 && t < endOf(p) - 0.02) targets.push(p);
  const newLink = new Map();
  commit(() => {
    for (const c of targets) {
      const cut = c.in + (t - c.start) * c.speed;
      const b = JSON.parse(JSON.stringify(c));
      b.id = uid(); b.in = cut; b.start = t; b.fadeIn = 0; b.transition = null;
      if (c.linkId) { if (!newLink.has(c.linkId)) newLink.set(c.linkId, uid()); b.linkId = newLink.get(c.linkId); }
      splitKeys(c, b, t - c.start);
      c.out = cut; c.fadeOut = 0;
      P.clips.push(b);
      if (c.id === state.selectedId) state.selectedId = b.id;
    }
  });
}

function deleteSelected(ripple = state.ripple) {
  const c = getClip(state.selectedId);
  if (!c) return toast('Click a clip first to select it');
  commit(() => {
    for (const x of [c, ...partners(c)]) {
      const d = dur(x), e = endOf(x);
      P.clips = P.clips.filter((y) => y.id !== x.id);
      if (ripple) for (const o of P.clips) if (o.trackId === x.trackId && o.start >= e - 1e-4) o.start -= d;
    }
    state.selectedId = null;
  });
}

function duplicateSelected() {
  const c = getClip(state.selectedId);
  if (!c) return toast('Click a clip first to select it');
  commit(() => {
    const b = JSON.parse(JSON.stringify(c));
    b.id = uid();
    b.transition = null;
    b.start = findFreeStart(c.trackId, endOf(c), dur(c), b.id);
    P.clips.push(b);
    const ps = partners(c);
    if (ps.length) {
      b.linkId = uid();
      for (const p of ps) {
        const q = JSON.parse(JSON.stringify(p));
        q.id = uid(); q.linkId = b.linkId; q.start = b.start + (p.start - c.start);
        const tr = audioTrackFreeAt(q.start, dur(q), getTrack(p.trackId) && getTrack(p.trackId).name);
        if (tr) q.trackId = tr.id;
        P.clips.push(q);
      }
    }
    state.selectedId = b.id;
  });
}

// Change a clip's length and push later clips on the same track so nothing overlaps.
function setClipLength(c, newDur, { keepSpeed = true } = {}) {
  const oldEnd = endOf(c);
  if (keepSpeed) c.out = c.in + newDur * c.speed;
  const delta = endOf(c) - oldEnd;
  if (Math.abs(delta) < 1e-6) return;
  for (const o of P.clips) if (o.id !== c.id && o.trackId === c.trackId && o.start >= oldEnd - 1e-4) o.start = Math.max(0, o.start + delta);
}
function setSpeed(c, speed, _linked) {
  if (!_linked) for (const p of partners(c)) setSpeed(p, speed, true);
  const oldEnd = endOf(c);
  c.speed = speed;
  const delta = endOf(c) - oldEnd;
  for (const o of P.clips) if (o.id !== c.id && o.trackId === c.trackId && o.start >= oldEnd - 1e-4) o.start = Math.max(0, o.start + delta);
}

function addTrack(type, name) {
  let tr;
  commit(() => {
    const n = P.tracks.filter((t) => t.type === type).length + 1;
    const names = { video: 'Overlay ' + n, audio: 'Audio ' + n, text: 'Text ' + n };
    tr = { id: type[0] + uid().slice(0, 4), type, name: name || names[type], hidden: false, muted: false };
    if (type === 'audio') P.tracks.push(tr);
    else if (type === 'text') P.tracks.unshift(tr);
    else { const i = P.tracks.findIndex((t) => t.type === 'video'); P.tracks.splice(Math.max(0, i), 0, tr); }
  });
  return tr;
}
function removeTrack(tr) {
  if (P.clips.some((c) => c.trackId === tr.id)) return toast('Remove the clips on this track first');
  if (P.tracks.filter((t) => t.type === tr.type).length <= 1) return toast('Every project keeps at least one track of each type');
  commit(() => { P.tracks = P.tracks.filter((t) => t !== tr); });
}

/* ---------- Detach audio / freeze frame ---------- */
function audioTrackFreeAt(start, d, preferName) {
  const tracks = P.tracks.filter((t) => t.type === 'audio');
  const pref = preferName ? tracks.find((t) => t.name === preferName) : null;
  for (const tr of pref ? [pref, ...tracks] : tracks) if (findFreeStart(tr.id, start, d) === start) return tr;
  return null;
}
function detachAudio(c = getClip(state.selectedId)) {
  if (!c || c.kind !== 'video') return toast('Select a video clip to detach its sound');
  if (partners(c).length) return toast('This video\u2019s sound is already on its own track below it');
  const m0 = getMedia(c.mediaId);
  commit(() => { linkSoundFor(c, m0, true); });
  return;
  const m = getMedia(c.mediaId);
  let tr = audioTrackFreeAt(c.start, dur(c));
  if (!tr) tr = addTrack('audio', 'Detached audio');
  commit(() => {
    const a = {
      id: uid(), trackId: tr.id, mediaId: c.mediaId, kind: 'audio', start: c.start, in: c.in, out: c.out, speed: c.speed,
      volume: c.volume, muted: false, fadeIn: c.fadeIn, fadeOut: c.fadeOut
    };
    P.clips.push(a);
    c.muted = true;
    state.selectedId = a.id;
  });
  if (m && !rt.peaks.has(m.id)) loadPeaks(m);
  toast('Sound moved to its own track - the video clip is now muted');
}
async function freezeFrame() {
  const c = getClip(state.selectedId);
  const t = state.time;
  if (!c || c.kind !== 'video' || t < c.start || t >= endOf(c)) return toast('Put the playhead over a selected video clip first');
  const p = rt.players.get(c.id);
  if (!p || p.el.readyState < 2) return toast('Wait for the video to load, then try again');
  pause();
  const cv = document.createElement('canvas');
  cv.width = p.el.videoWidth; cv.height = p.el.videoHeight;
  cv.getContext('2d').drawImage(p.el, 0, 0);
  const dataUrl = cv.toDataURL('image/png');
  const name = 'Freeze ' + fmt(t).replace(/[:.]/g, '-') + '.png';
  const path = api ? await api.saveMediaFile({ folder: 'frames', name, dataUrl }) : dataUrl;
  if (!path) return;
  const [m] = await importFiles([{ path, name, tag: 'freeze' }]);
  if (!m) return;
  const FREEZE = 2;
  commit(() => {
    // cut the clip at the playhead, push everything after it, drop the still in the gap
    const cut = c.in + (t - c.start) * c.speed;
    let b = null;
    if (t > c.start + 0.02 && t < endOf(c) - 0.02) {
      b = JSON.parse(JSON.stringify(c));
      b.id = uid(); b.in = cut; b.start = t; b.fadeIn = 0; b.transition = null;
      c.out = cut; c.fadeOut = 0;
    }
    for (const o of P.clips) if (o.trackId === c.trackId && o.id !== c.id && o.start >= t - 1e-4) o.start += FREEZE;
    if (b) { b.start = t + FREEZE; P.clips.push(b); }
    const f = makeMediaClip(m, c.trackId, t);
    f.out = FREEZE;
    for (const k of ['fit', 'scale', 'x', 'y', 'rotation', 'opacity', 'brightness', 'contrast', 'saturation', 'blur', 'filter', 'flipH', 'flipV', 'crop', 'blend', 'bgBlur']) {
      if (c[k] !== undefined) f[k] = JSON.parse(JSON.stringify(c[k]));
    }
    P.clips.push(f);
    state.selectedId = f.id;
  });
  toast('Added a 2 second freeze frame');
}

/* ---------- Markers ---------- */
function toggleMarker(t = state.time) {
  commit(() => {
    P.markers = P.markers || [];
    const i = P.markers.findIndex((m) => Math.abs(m.t - t) < 0.15);
    if (i >= 0) P.markers.splice(i, 1);
    else P.markers.push({ id: uid(), t, color: '#ffd23f' });
    P.markers.sort((a, b) => a.t - b.t);
  });
}
function jumpMarker(dir) {
  const ms = (P.markers || []).map((m) => m.t);
  const pts = [0, ...ms, projectDuration()].sort((a, b) => a - b);
  const t = state.time;
  const next = dir > 0 ? pts.find((x) => x > t + 0.01) : pts.reverse().find((x) => x < t - 0.01);
  if (next !== undefined) seek(next);
}

/* ---------- Transitions ---------- */
const TRANSITIONS = [
  { id: 'none', name: 'None' },
  { id: 'fade', name: 'Crossfade' },
  { id: 'black', name: 'Fade to black' },
  { id: 'white', name: 'Flash' },
  { id: 'slide', name: 'Slide' },
  { id: 'slideUp', name: 'Slide up' },
  { id: 'push', name: 'Push' },
  { id: 'wipe', name: 'Wipe' },
  { id: 'zoom', name: 'Zoom' },
  { id: 'blur', name: 'Blur' },
  { id: 'circle', name: 'Circle' },
  { id: 'spin', name: 'Spin' }
];
const transById = (id) => TRANSITIONS.find((t) => t.id === id) || TRANSITIONS[0];
function adjPrev(c) {
  return P.clips.find((o) => o.trackId === c.trackId && o.id !== c.id && Math.abs(endOf(o) - c.start) < 0.05) || null;
}
function adjNext(c) {
  return P.clips.find((o) => o.trackId === c.trackId && o.id !== c.id && Math.abs(o.start - endOf(c)) < 0.05) || null;
}
function transDur(c) {
  const tr = c.transition;
  if (!tr || tr.type === 'none' || !isVisual(c)) return 0;
  const p = adjPrev(c);
  const lim = Math.min(dur(c), p ? dur(p) : dur(c)) * 0.9;
  return Math.max(0.05, Math.min(tr.duration || 0.6, lim, 4));
}
// For every clip: when it's visible (transitions make clips overlap a little) and any transition in/out.
function computeLayout() {
  const L = new Map();
  for (const c of P.clips) L.set(c.id, { vs: c.start, ve: endOf(c), tin: null, tout: null });
  for (const c of P.clips) {
    const td = transDur(c);
    if (!td) continue;
    const prev = adjPrev(c);
    const start = prev ? c.start - td / 2 : c.start;
    const info = { start, dur: td, type: c.transition.type };
    const lc = L.get(c.id);
    lc.tin = info;
    lc.vs = Math.min(lc.vs, start);
    if (prev) {
      const lp = L.get(prev.id);
      lp.tout = info;
      lp.ve = Math.max(lp.ve, start + td);
    }
  }
  return L;
}
function setTransition(c, type, duration) {
  if (!c || !isVisual(c)) return toast('Pick a video or photo clip for the transition');
  commit(() => {
    if (type === 'none') c.transition = null;
    else c.transition = { type, duration: duration || (c.transition && c.transition.duration) || (typeof settings !== 'undefined' ? settings.transitionDur : 0.6) || 0.6 };
  });
}
function applyTransitionToAll(type) {
  let n = 0;
  commit(() => {
    for (const c of P.clips) {
      if (!isVisual(c) || !adjPrev(c)) continue;
      c.transition = type === 'none' ? null : { type, duration: (typeof settings !== 'undefined' ? settings.transitionDur : 0.6) || 0.6 };
      n++;
    }
  });
  toast(n ? `${type === 'none' ? 'Removed transitions from' : 'Added “' + transById(type).name + '” to'} ${n} cut(s)` : 'No cuts found - put clips right next to each other first');
}
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// How each side of a transition is drawn. role "in" = the clip that's coming in, "out" = the one leaving.
function transitionFx(type, p, role, W, H) {
  const e = easeInOut(clamp(p, 0, 1));
  const fx = { alpha: 1, dx: 0, dy: 0, scale: 1, rot: 0, blur: 0, clip: null, cover: null };
  const isIn = role === 'in';
  switch (type) {
    case 'fade': if (isIn) fx.alpha = e; break;
    case 'black': case 'white':
      fx.alpha = isIn ? (p >= 0.5 ? 1 : 0) : (p < 0.5 ? 1 : 0);
      fx.cover = { color: type === 'black' ? '#000' : '#fff', alpha: 1 - Math.abs(2 * e - 1) };
      break;
    case 'slide': if (isIn) fx.dx = (1 - e) * W; break;
    case 'slideUp': if (isIn) fx.dy = (1 - e) * H; break;
    case 'push': fx.dx = isIn ? (1 - e) * W : -e * W; break;
    case 'wipe': if (isIn) fx.clip = (g) => g.rect(0, 0, e * W, H); break;
    case 'zoom': if (isIn) { fx.alpha = e; fx.scale = 1.25 - 0.25 * e; } else { fx.scale = 1 + 0.5 * e; } break;
    case 'blur': if (isIn) { fx.alpha = e; fx.blur = (1 - e) * 30; } else fx.blur = e * 30; break;
    case 'circle': if (isIn) fx.clip = (g) => g.arc(W / 2, H / 2, e * Math.hypot(W, H) / 2 + 0.01, 0, Math.PI * 2); break;
    case 'spin':
      if (isIn) { fx.alpha = e; fx.scale = 0.3 + 0.7 * e; fx.rot = -(1 - e) * Math.PI; }
      else { fx.alpha = 1 - e * 0.6; fx.scale = 1 - 0.5 * e; fx.rot = e * Math.PI; }
      break;
  }
  return fx;
}

function select(id) {
  if (state.selectedId === id) return;
  state.selectedId = id;
  renderLanes();
  renderInspector();
  renderFilterGrid();
  requestDraw();
}

/* ============================ PLAYBACK ============================ */
let actx = null, masterGain = null, monitorGain = null, exportDest = null;
function ensureAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    actx = new AudioContext();
    masterGain = actx.createGain();
    monitorGain = actx.createGain();
    masterGain.connect(monitorGain);
    monitorGain.connect(actx.destination);
    exportDest = actx.createMediaStreamDestination();
    masterGain.connect(exportDest);
    // bleep tone for censored words (silent until needed)
    rt.beepOsc = actx.createOscillator();
    rt.beepOsc.frequency.value = 1000;
    rt.beepGain = actx.createGain();
    rt.beepGain.gain.value = 0;
    rt.beepOsc.connect(rt.beepGain); rt.beepGain.connect(masterGain);
    rt.beepOsc.start();
    for (const p of rt.players.values()) attachAudio(p);
    if (typeof settings !== 'undefined') applyOutputDevice(settings.outputDevice);
  } catch (e) { console.warn('Audio unavailable', e); }
}
// Send all of Flux's sound to the speakers/headphones picked in Settings or the Voiceover tab.
async function applyOutputDevice(id) {
  const sink = !id || id === 'default' ? '' : id;
  try { if (actx && actx.setSinkId) await actx.setSinkId(sink); } catch (e) { console.warn('Output device', e); toast("Couldn't use that output device", { error: true }); }
  for (const p of rt.players.values()) { try { if (!p.node && p.el.setSinkId) await p.el.setSinkId(sink); } catch {} }
  if (typeof musicPreview !== 'undefined' && musicPreview && musicPreview.setSinkId) { try { await musicPreview.setSinkId(sink); } catch {} }
}
function attachAudio(p) {
  if (!actx || p.node) return;
  try {
    p.node = actx.createMediaElementSource(p.el);
    p.gain = actx.createGain();
    p.pan = actx.createStereoPanner();
    p.low = actx.createBiquadFilter(); p.low.type = 'lowshelf'; p.low.frequency.value = 200;
    p.mid = actx.createBiquadFilter(); p.mid.type = 'peaking'; p.mid.frequency.value = 1500; p.mid.Q.value = 0.9;
    p.high = actx.createBiquadFilter(); p.high.type = 'highshelf'; p.high.frequency.value = 5000;
    p.node.connect(p.gain); p.gain.connect(p.pan); p.pan.connect(p.low); p.low.connect(p.mid); p.mid.connect(p.high); p.high.connect(masterGain);
    p.el.volume = 1;
  } catch (e) { /* already attached */ }
}
function getPlayer(c, m) {
  let p = rt.players.get(c.id);
  if (p) return p;
  const media = document.createElement(c.kind === 'audio' ? 'audio' : 'video');
  media.preload = 'auto';
  media.playsInline = true;
  media.src = mediaUrl(m);
  media.addEventListener('seeked', requestDraw);
  media.addEventListener('loadeddata', requestDraw);
  p = { el: media, node: null, gain: null };
  rt.players.set(c.id, p);
  attachAudio(p);
  if (!p.node && typeof settings !== 'undefined' && settings.outputDevice && settings.outputDevice !== 'default' && media.setSinkId) media.setSinkId(settings.outputDevice).catch(() => {});
  return p;
}
function destroyPlayer(id) {
  const p = rt.players.get(id);
  if (!p) return;
  try { p.el.pause(); p.el.removeAttribute('src'); p.el.load(); } catch {}
  try { p.node && p.node.disconnect(); p.gain && p.gain.disconnect(); } catch {}
  rt.players.delete(id);
}
function setGain(p, g) {
  if (p.gain) p.gain.gain.value = g;
  else p.el.volume = clamp(g, 0, 1);
}
function fadeEnv(c, local) {
  const d = dur(c);
  local = clamp(local, 0, d);
  let f = 1;
  if (c.fadeIn > 0 && local < c.fadeIn) f = Math.min(f, local / c.fadeIn);
  if (c.fadeOut > 0 && local > d - c.fadeOut) f = Math.min(f, (d - local) / c.fadeOut);
  return clamp(f, 0, 1);
}

let playStartTime = 0, playStartWall = 0;
function play() {
  const total = projectDuration();
  if (!total) return toast('Add some media to the timeline first');
  ensureAudio();
  if (state.time >= total - 0.04) state.time = 0;
  state.playing = true;
  playStartTime = state.time;
  playStartWall = performance.now();
  document.body.classList.add('playing');
}
function pause() {
  state.playing = false;
  document.body.classList.remove('playing');
  for (const p of rt.players.values()) if (!p.el.paused) p.el.pause();
  requestDraw();
}
function togglePlay() { state.playing ? pause() : play(); }
function seek(t) {
  state.time = clamp(t, 0, Math.max(projectDuration(), 0));
  if (state.playing) { playStartTime = state.time; playStartWall = performance.now(); }
  requestDraw();
  updatePlayhead();
  const sc = getClip(state.selectedId);
  if (!state.playing && sc && sc.keys && Object.keys(sc.keys).length) scheduleInspector();
}
let inspTimer = null;
function scheduleInspector() { clearTimeout(inspTimer); inspTimer = setTimeout(renderInspector, 80); }
function stepFrames(n) { if (state.playing) pause(); seek(Math.round(state.time * FPS + n) / FPS); }

function syncMedia(L = rt.layout || computeLayout()) {
  const t = state.time;
  const alive = new Set();
  let beepWant = 0;
  const voiceActive = P.clips.some((c) => {
    if (!hasAudio(c) || c.muted || t < c.start || t >= endOf(c)) return false;
    const m = getMedia(c.mediaId), tr = getTrack(c.trackId);
    return (m && m.tag === 'voice') || (tr && /voice/i.test(tr.name));
  });
  for (const c of P.clips) {
    if (!hasAudio(c)) continue;
    const m = getMedia(c.mediaId);
    if (!m || m.missing || m.error || m.loading) continue;
    const s = c.start;
    const w = L.get(c.id) || { vs: s, ve: endOf(c) };
    const active = t >= w.vs && t < w.ve;
    const soon = state.playing && t < w.vs && w.vs - t < 1.5;
    const existing = rt.players.get(c.id);
    if (!active && !soon) {
      if (existing && !existing.el.paused) existing.el.pause();
      continue;
    }
    alive.add(c.id);
    const p = getPlayer(c, m);
    const el = p.el;
    if (!active) {
      if (!el.paused) el.pause();
      setGain(p, 0);
      if (Math.abs(el.currentTime - c.in) > 0.05 && !el.seeking && el.readyState >= 1) el.currentTime = c.in;
      continue;
    }
    const track = getTrack(c.trackId);
    const maxSrc = m.duration ? m.duration - 0.03 : Infinity;
    const src = clamp(c.in + (t - s) * c.speed, 0, maxSrc);
    const silent = (track && track.muted) || c.muted;
    let tg = 1; // sound crossfades along with picture transitions
    if (w.tin && t < w.tin.start + w.tin.dur) tg *= clamp((t - w.tin.start) / w.tin.dur, 0, 1);
    if (w.tout && t >= w.tout.start) tg *= clamp(1 - (t - w.tout.start) / w.tout.dur, 0, 1);
    // ducking: music gets quieter while a voiceover plays
    let bleep = 1;
    if (c.beeps && c.beeps.length && isPremium()) {
      const b = c.beeps.find((x) => src >= x.s && src <= x.e);
      if (b && !silent) {
        bleep = c.beepSound === 'duck' ? 0.12 : 0;
        if (c.beepSound !== 'mute' && c.beepSound !== 'duck') beepWant = c.beepSound === 'low' ? 400 : 1000;
      }
    }
    const duckTarget = (c.audio && c.audio.duck && voiceActive ? 0.25 : 1) * bleep;
    p.duck = p.duck == null ? duckTarget : p.duck + (duckTarget - p.duck) * 0.12;
    setGain(p, silent ? 0 : kv(c, 'volume', t - s) * fadeEnv(c, t - s) * tg * p.duck);
    applyAudioFx(p, c);
    if (state.playing) {
      if (Math.abs(el.playbackRate - c.speed) > 0.001) el.playbackRate = c.speed;
      if (el.paused) {
        if (Math.abs(el.currentTime - src) > 0.08 && el.readyState >= 1) el.currentTime = src;
        el.play().catch(() => {});
      } else if (Math.abs(el.currentTime - src) > 0.3 && !el.seeking) {
        el.currentTime = src;
      }
    } else {
      if (!el.paused) el.pause();
      if (Math.abs(el.currentTime - src) > 0.015 && !el.seeking && el.readyState >= 1) el.currentTime = src;
    }
  }
  if (rt.beepGain) {
    if (beepWant && rt.beepOsc.frequency.value !== beepWant) rt.beepOsc.frequency.value = beepWant;
    const want = beepWant && (state.playing || state.exporting) ? 0.22 : 0;
    if (Math.abs(rt.beepGain.gain.value - want) > 0.001) rt.beepGain.gain.setTargetAtTime(want, actx.currentTime, 0.004);
  }
  // free players for deleted clips, and (to save memory) ones that haven't been needed for a while
  const nowMs = performance.now();
  for (const id of alive) { const p = rt.players.get(id); if (p) p.used = nowMs; }
  for (const [id, p] of Array.from(rt.players.entries())) {
    if (!getClip(id) || (!alive.has(id) && nowMs - (p.used || 0) > (lowEnd() ? 4000 : 12000) && p.el.paused)) destroyPlayer(id);
  }
}

/* ============================ RENDERING ============================ */
const canvas = $('#previewCanvas');
const ctx = canvas.getContext('2d');
const overlay = $('#overlayCanvas');
const octx = overlay.getContext('2d');
function requestDraw() { rt.needsDraw = true; }
// Low-end computers: fewer pixels in the preview (export is always full quality)
function lowEnd() {
  const q = typeof settings !== 'undefined' ? settings.previewQuality : 'auto';
  if (q === 'low') return true;
  if (q === 'high' || q === 'medium') return false;
  return (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
}
function previewCap() {
  const q = typeof settings !== 'undefined' ? settings.previewQuality : 'auto';
  if (q === 'high') return 4000;
  if (q === 'medium') return 1280;
  if (q === 'low') return 640;
  return lowEnd() ? 854 : 1920;
}

function layoutStage() {
  if (state.exporting) return;
  const stage = $('#stage');
  const [W, H] = refSize();
  const aw = stage.clientWidth - 32, ah = stage.clientHeight - 32;
  const s = Math.min(aw / W, ah / H);
  const w = Math.max(50, Math.floor(W * s)), h = Math.max(50, Math.floor(H * s));
  const wrap = $('#canvasWrap');
  wrap.style.width = w + 'px';
  wrap.style.height = h + 'px';
  const dpr = window.devicePixelRatio || 1;
  const cap = previewCap();
  const k = Math.min(1, (w * dpr) / W, cap / Math.max(W, H));
  canvas.width = Math.round(W * k);
  canvas.height = Math.round(H * k);
  overlay.width = Math.round(w * dpr);
  overlay.height = Math.round(h * dpr);
  requestDraw();
}

function buildFilter(c, k) {
  const f = filterById(c.filter);
  let s = '';
  if (c.hue) s += ` hue-rotate(${c.hue}deg)`;
  if (c.brightness !== 100) s += ` brightness(${c.brightness / 100})`;
  if (c.contrast !== 100) s += ` contrast(${c.contrast / 100})`;
  if (c.saturation !== 100) s += ` saturate(${c.saturation / 100})`;
  if (c.blur > 0) s += ` blur(${(c.blur * k).toFixed(2)}px)`;
  if (f.css) s += ' ' + f.css;
  return s.trim() || 'none';
}

function render(target = ctx, cw = canvas.width) {
  const [W, H] = refSize();
  const k = cw / W;
  const g = target;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.filter = 'none';
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = P.background || '#000';
  g.fillRect(0, 0, g.canvas.width, g.canvas.height);
  g.setTransform(k, 0, 0, k, 0, 0);
  rt.hitBoxes = [];
  const t = state.time;
  const L = rt.layout || computeLayout();
  // bottom track first, top track last
  for (let i = P.tracks.length - 1; i >= 0; i--) {
    const tr = P.tracks[i];
    if (tr.hidden || tr.type === 'audio') continue;
    const clips = P.clips.filter((c) => {
      if (c.trackId !== tr.id) return false;
      const w = L.get(c.id);
      return w ? t >= w.vs && t < w.ve : t >= c.start && t < endOf(c);
    }).sort((a, b) => a.start - b.start);
    let cover = null;
    for (const c of clips) {
      const local = t - c.start;
      if (c.kind === 'text') { drawText(g, c, local, W, H, k); continue; }
      const w = L.get(c.id);
      let fx = null;
      if (w && w.tin && t < w.tin.start + w.tin.dur) fx = transitionFx(w.tin.type, (t - w.tin.start) / w.tin.dur, 'in', W, H);
      else if (w && w.tout && t >= w.tout.start) fx = transitionFx(w.tout.type, (t - w.tout.start) / w.tout.dur, 'out', W, H);
      if (fx && fx.cover) cover = fx.cover;
      drawMedia(g, c, local, W, H, k, fx);
    }
    if (cover && cover.alpha > 0.001) {
      g.save();
      g.globalAlpha = clamp(cover.alpha, 0, 1);
      g.fillStyle = cover.color;
      g.fillRect(0, 0, W, H);
      g.restore();
    }
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

function motionAt(c, local) {
  const q = clamp(local / Math.max(0.01, dur(c)), 0, 1);
  switch (c.motion) {
    case 'zoomIn': return { s: 1 + 0.18 * q, dx: 0, dy: 0 };
    case 'zoomOut': return { s: 1.18 - 0.18 * q, dx: 0, dy: 0 };
    case 'panLeft': return { s: 1.15, dx: (0.5 - q) * 0.12, dy: 0 };
    case 'panRight': return { s: 1.15, dx: (q - 0.5) * 0.12, dy: 0 };
    case 'panUp': return { s: 1.15, dx: 0, dy: (0.5 - q) * 0.12 };
    case 'shake': return { s: 1.06, dx: Math.sin(local * 37) * 0.008, dy: Math.cos(local * 29) * 0.008 };
    default: return { s: 1, dx: 0, dy: 0 };
  }
}

function drawMedia(g, c, local, W, H, k, fx) {
  const m = getMedia(c.mediaId);
  if (!m || m.missing || m.error) return;
  let src, sw, sh;
  if (c.kind === 'image') {
    src = rt.images.get(m.id);
    if (!src) return;
    sw = src.naturalWidth; sh = src.naturalHeight;
  } else {
    const p = rt.players.get(c.id);
    if (!p || p.el.readyState < 2) return;
    src = p.el; sw = src.videoWidth; sh = src.videoHeight;
  }
  if (!sw || !sh) return;
  fx = fx || { alpha: 1, dx: 0, dy: 0, scale: 1, rot: 0, blur: 0, clip: null };
  const cr = c.crop || { l: 0, r: 0, t: 0, b: 0 };
  let sx = sw * cr.l, sy = sh * cr.t;
  let cw = Math.max(1, sw * (1 - cr.l - cr.r)), ch = Math.max(1, sh * (1 - cr.t - cr.b));
  const mo = motionAt(c, local);
  const s = c.fit === 'cover' ? Math.max(W / cw, H / ch) : Math.min(W / cw, H / ch);
  const scl = kv(c, 'scale', local);
  const dw = cw * s * scl, dh = ch * s * scl;
  const cx = W / 2 + kv(c, 'x', local) * W, cy = H / 2 + kv(c, 'y', local) * H;
  const rot = (kv(c, 'rotation', local) * Math.PI) / 180;
  const alpha = clamp(kv(c, 'opacity', local) * fadeEnv(c, local) * fx.alpha, 0, 1);
  if (c.chroma && c.chroma.on && isPremium()) {
    const keyed = chromaKey(src, sx, sy, cw, ch, c.chroma, Math.min(state.exporting ? 1920 : lowEnd() ? 480 : 960, Math.max(64, dw * k)));
    if (keyed) { src = keyed; sx = 0; sy = 0; cw = keyed.width; ch = keyed.height; }
  }
  if (alpha <= 0.001) { rt.hitBoxes.push({ id: c.id, cx, cy, w: dw, h: dh, rot }); return; }
  g.save();
  if (fx.clip) { g.beginPath(); fx.clip(g); g.clip(); }
  g.globalAlpha = alpha;
  // Blurred background: fills empty bars around a picture that doesn't match the video shape
  if (c.bgBlur && c.fit !== 'cover') {
    const bs = Math.max(W / cw, H / ch) * 1.1;
    g.save();
    g.translate(W / 2 + fx.dx, H / 2 + fx.dy);
    g.filter = `blur(${(40 * k).toFixed(1)}px) brightness(0.7) saturate(1.2)`;
    try { g.drawImage(src, sx, sy, cw, ch, (-cw * bs) / 2, (-ch * bs) / 2, cw * bs, ch * bs); } catch {}
    g.filter = 'none';
    g.restore();
  }
  g.globalCompositeOperation = c.blend || 'source-over';
  g.translate(cx + fx.dx + mo.dx * W, cy + fx.dy + mo.dy * H);
  g.rotate(rot + fx.rot);
  g.scale((c.flipH ? -1 : 1) * fx.scale * mo.s, (c.flipV ? -1 : 1) * fx.scale * mo.s);
  let filt = buildFilter(c, k);
  if (fx.blur > 0.05) filt = (filt === 'none' ? '' : filt + ' ') + `blur(${(fx.blur * k).toFixed(2)}px)`;
  g.filter = filt;
  if (fx.flipX != null) g.scale(Math.max(0.001, fx.flipX), 1);
  try {
    if (fx.pixel > 1) drawPixelated(g, src, sx, sy, cw, ch, dw, dh, fx.pixel);
    else if (fx.glitch > 0) drawGlitched(g, src, sx, sy, cw, ch, dw, dh, fx.glitch);
    else g.drawImage(src, sx, sy, cw, ch, -dw / 2, -dh / 2, dw, dh);
  } catch {}
  g.filter = 'none';
  const f = filterById(c.filter);
  if (f.tint) {
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = f.tint;
    g.fillRect(-dw / 2, -dh / 2, dw, dh);
  }
  drawEffects(g, c, dw, dh, local);
  g.restore();
  rt.hitBoxes.push({ id: c.id, cx, cy, w: dw, h: dh, rot });
}

const easeOutBack = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);

function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function hexToRgba(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawText(g, c, local, W, H, k) {
  const t = c.text;
  const d = dur(c);
  let alpha = kv(c, 'opacity', local) * fadeEnv(c, local);
  let sc = kv(c, 'scale', local) || 1;
  let dy = 0;
  let content = t.content || '';
  // While paused on a selected title, show it fully so it's easy to edit
  const editing = !state.playing && !state.exporting && c.id === state.selectedId;
  const ai = clamp(local / 0.45, 0, 1);
  const ao = clamp((d - local) / 0.35, 0, 1);
  if (editing) { /* no animation */ }
  else if (t.anim === 'fade') alpha *= Math.min(ai, ao);
  else if (t.anim === 'pop') { sc *= 0.55 + 0.45 * easeOutBack(clamp(local / 0.4, 0, 1)); alpha *= Math.min(clamp(local / 0.15, 0, 1), ao); }
  else if (t.anim === 'slide') { dy = (1 - easeOutCubic(ai)) * 70; alpha *= Math.min(ai, ao); }
  else if (t.anim === 'type') content = content.slice(0, Math.floor(local * 20));
  let activeWord = -1;
  if (t.words && t.words.length) {
    for (let i = 0; i < t.words.length; i++) if (local >= t.words[i].t0 - 0.02) activeWord = i;
    if (t.wordByWord) {
      const wi = Math.max(0, activeWord);
      content = t.words[wi].w;
      if (!editing) sc *= 0.8 + 0.2 * easeOutBack(clamp((local - t.words[wi].t0) / 0.18, 0, 1));
    }
  }
  const size = t.size;
  const lines = content.split('\n');
  const lineH = size * 1.18;
  g.save();
  g.font = `${t.italic ? 'italic ' : ''}${t.bold ? '700' : '500'} ${size}px "${t.font}", "Segoe UI", Arial, sans-serif`;
  g.textBaseline = 'middle';
  const widths = lines.map((l) => g.measureText(l).width);
  // measure full text so a typewriter box doesn't jump around
  const fullLines = (t.wordByWord ? content : (t.content || '')).split('\n');
  const blockW = Math.max(10, ...fullLines.map((l) => g.measureText(l).width));
  const blockH = fullLines.length * lineH;
  const ax = t.x * W, ay = t.y * H;
  const left = t.align === 'left' ? 0 : t.align === 'right' ? -blockW : -blockW / 2;
  g.translate(ax, ay + dy);
  g.rotate(((kv(c, 'rotation', local) || 0) * Math.PI) / 180);
  g.scale(sc, sc);
  g.globalAlpha = clamp(alpha, 0, 1);

  const padX = size * 0.38, padY = size * 0.2;
  if (t.bg) {
    g.fillStyle = hexToRgba(t.bgColor || '#000000', t.bgOpacity ?? 0.6);
    roundRect(g, left - padX, -blockH / 2 - padY, blockW + padX * 2, blockH + padY * 2, size * 0.22);
    g.fill();
  }
  g.textAlign = 'left';
  lines.forEach((line, i) => {
    const lw = widths[i];
    const fw = g.measureText(fullLines[i] || '').width;
    const lx = t.align === 'left' ? left : t.align === 'right' ? left + blockW - fw : left + (blockW - fw) / 2;
    const ly = -blockH / 2 + lineH * (i + 0.5);
    if (t.outline) {
      g.lineJoin = 'round';
      g.lineWidth = size * 0.12;
      g.strokeStyle = t.outlineColor || '#000';
      g.strokeText(line, lx, ly);
    }
    if (t.glow) { g.shadowColor = t.color; g.shadowBlur = size * 0.45 * k * sc; }
    else if (t.shadow) { g.shadowColor = 'rgba(0,0,0,0.65)'; g.shadowBlur = size * 0.14 * k * sc; g.shadowOffsetY = size * 0.04 * k * sc; }
    if (t.karaoke && t.words && lines.length === 1) {
      // karaoke: the word being said lights up
      let x = lx;
      t.words.forEach((wd, wi) => {
        const piece = wd.w + (wi < t.words.length - 1 ? ' ' : '');
        g.fillStyle = wi === activeWord ? (t.hl || '#8d7dff') : wi < activeWord ? t.color : (t.dim || t.color);
        g.fillText(piece, x, ly);
        x += g.measureText(piece).width;
      });
    } else {
      g.fillStyle = t.color;
      g.fillText(line, lx, ly);
    }
    if (t.glow) { g.shadowBlur = size * 0.15 * k * sc; g.fillText(line, lx, ly); }
    g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
    void lw;
  });
  g.restore();
  const bw = (blockW + (t.bg ? padX * 2 : size * 0.2)) * sc, bh = (blockH + padY * 2) * sc;
  const bcx = ax + (left + blockW / 2) * sc;
  rt.hitBoxes.push({ id: c.id, cx: bcx, cy: ay + dy, w: bw, h: bh, rot: ((c.rotation || 0) * Math.PI) / 180, text: true });
}

function drawOverlay() {
  const [W] = refSize();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  if (state.exporting) return;
  const box = rt.hitBoxes.find((b) => b.id === state.selectedId);
  if (!box) return;
  const k = overlay.width / W;
  octx.setTransform(k, 0, 0, k, 0, 0);
  octx.translate(box.cx, box.cy);
  octx.rotate(box.rot);
  const lw = 1.5 / k * (window.devicePixelRatio || 1);
  octx.lineWidth = lw;
  octx.strokeStyle = 'rgba(255,255,255,0.95)';
  octx.setLineDash([6 / k * (window.devicePixelRatio || 1), 4 / k * (window.devicePixelRatio || 1)]);
  octx.strokeRect(-box.w / 2, -box.h / 2, box.w, box.h);
  octx.setLineDash([]);
  const hs = 9 / k * (window.devicePixelRatio || 1);
  octx.fillStyle = '#fff';
  octx.strokeStyle = '#6c4bff';
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    octx.beginPath();
    octx.arc((sx * box.w) / 2, (sy * box.h) / 2, hs / 2, 0, Math.PI * 2);
    octx.fill(); octx.stroke();
  }
}

/* ============================ PREVIEW INTERACTION ============================ */
(function setupPreviewDrag() {
  let drag = null;
  const toRef = (e) => {
    const r = overlay.getBoundingClientRect();
    const [W, H] = refSize();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, px: r.width / W };
  };
  const local = (b, p) => {
    const dx = p.x - b.cx, dy = p.y - b.cy;
    const cs = Math.cos(-b.rot), sn = Math.sin(-b.rot);
    return { x: dx * cs - dy * sn, y: dx * sn + dy * cs };
  };
  overlay.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const p = toRef(e);
    // corner handle of selected item → resize
    const selBox = rt.hitBoxes.find((b) => b.id === state.selectedId);
    if (selBox) {
      const l = local(selBox, p);
      const tol = 12 / p.px;
      const nearCorner = Math.abs(Math.abs(l.x) - selBox.w / 2) < tol && Math.abs(Math.abs(l.y) - selBox.h / 2) < tol;
      if (nearCorner) {
        const c = getClip(state.selectedId);
        drag = { mode: 'scale', c, snap: snapshot(), base: kv(c, 'scale', state.time - c.start) || 1, d0: Math.hypot(p.x - selBox.cx, p.y - selBox.cy), box: selBox };
        overlay.setPointerCapture(e.pointerId);
        return;
      }
    }
    let hit = null;
    for (let i = rt.hitBoxes.length - 1; i >= 0; i--) {
      const b = rt.hitBoxes[i];
      const l = local(b, p);
      if (Math.abs(l.x) <= b.w / 2 && Math.abs(l.y) <= b.h / 2) { hit = b; break; }
    }
    if (!hit) { select(null); return; }
    const c = getClip(hit.id);
    select(c.id);
    const lt = state.time - c.start;
    drag = { mode: 'move', c, snap: snapshot(), p0: p, x0: c.kind === 'text' ? c.text.x : kv(c, 'x', lt), y0: c.kind === 'text' ? c.text.y : kv(c, 'y', lt) };
    overlay.setPointerCapture(e.pointerId);
    overlay.classList.add('grab');
  });
  overlay.addEventListener('pointermove', (e) => {
    const p = toRef(e);
    if (!drag) {
      const over = rt.hitBoxes.some((b) => { const l = local(b, p); return Math.abs(l.x) <= b.w / 2 && Math.abs(l.y) <= b.h / 2; });
      overlay.classList.toggle('grab', over);
      return;
    }
    const [W, H] = refSize();
    if (drag.mode === 'move') {
      let nx = drag.x0 + (p.x - drag.p0.x) / W;
      let ny = drag.y0 + (p.y - drag.p0.y) / H;
      const snapTol = 10 / p.px / W;
      const centerX = drag.c.kind === 'text' ? 0.5 : 0, centerY = drag.c.kind === 'text' ? 0.5 : 0;
      if (Math.abs(nx - centerX) < snapTol && !(drag.c.kind === 'text' && drag.c.text.align !== 'center')) nx = centerX;
      if (Math.abs(ny - centerY) < snapTol * (W / H)) ny = centerY;
      if (drag.c.kind === 'text') { drag.c.text.x = nx; drag.c.text.y = ny; }
      else { setProp(drag.c, 'x', nx); setProp(drag.c, 'y', ny); }
    } else {
      const d = Math.hypot(p.x - drag.box.cx, p.y - drag.box.cy);
      setProp(drag.c, 'scale', clamp(drag.base * (d / Math.max(1, drag.d0)), 0.1, 6));
    }
    requestDraw();
  });
  const up = () => {
    if (!drag) return;
    if (snapshot() !== drag.snap) pushHistory(drag.snap);
    drag = null;
    overlay.classList.remove('grab');
    renderInspector();
  };
  overlay.addEventListener('pointerup', up);
  overlay.addEventListener('pointercancel', up);
})();

/* ============================ TIMELINE ============================ */
const tlScroll = $('#tlScroll');
const tlContent = $('#tlContent');
const tlLanes = $('#tlLanes');
const tlRuler = $('#tlRuler');
const zoomFromSlider = (v) => 8 * Math.pow(50, v / 100);
const sliderFromZoom = (z) => (Math.log(z / 8) / Math.log(50)) * 100;

function timelineWidth() {
  return Math.max(tlScroll.clientWidth, (projectDuration() + 30) * state.zoom);
}
function renderTimeline() {
  renderTrackHeaders();
  renderRuler();
  renderLanes();
  updatePlayhead();
  updateTimes();
}
function renderTrackHeaders() {
  const box = $('#trackHeaders');
  box.innerHTML = '';
  for (const tr of P.tracks) {
    const h = el('div', 'track-header t-' + tr.type);
    h.innerHTML = `<span class="t-icon" style="background:${KIND_COLOR[tr.type === 'video' ? 'video' : tr.type]}">${ICON[tr.type]}</span><span class="t-name"></span>`;
    $('.t-name', h).textContent = tr.name;
    $('.t-name', h).title = 'Double-click to rename';
    $('.t-name', h).addEventListener('dblclick', () => renameTrack(tr));
    if (tr.type !== 'audio') {
      const b = el('button', 'icon-btn' + (tr.hidden ? ' off' : ''), tr.hidden ? ICON.eyeOff : ICON.eye);
      b.dataset.tip = tr.hidden ? 'Show track' : 'Hide track';
      b.onclick = () => commit(() => { tr.hidden = !tr.hidden; });
      h.appendChild(b);
    }
    if (tr.type !== 'text') {
      const b = el('button', 'icon-btn' + (tr.muted ? ' off' : ''), tr.muted ? ICON.volOff : ICON.vol);
      b.dataset.tip = tr.muted ? 'Unmute track' : 'Mute track';
      b.onclick = () => commit(() => { tr.muted = !tr.muted; });
      h.appendChild(b);
    }
    h.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextMenu(e.clientX, e.clientY, [
        { label: 'Rename track', fn: () => renameTrack(tr) },
        { label: 'Add video track', fn: () => addTrack('video') },
        { label: 'Add audio track', fn: () => addTrack('audio') },
        { label: 'Add text track', fn: () => addTrack('text') },
        { label: 'Remove this track', fn: () => removeTrack(tr), danger: true }
      ]);
    });
    box.appendChild(h);
  }
  const add = el('div', 'track-header');
  add.style.borderBottom = 'none';
  add.innerHTML = `<button class="tool-btn" style="width:100%;justify-content:center">${ICON.plus}Add track</button>`;
  $('button', add).onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    contextMenu(r.left, r.bottom + 4, [
      { label: 'Video / overlay track', fn: () => addTrack('video') },
      { label: 'Audio track', fn: () => addTrack('audio') },
      { label: 'Text track', fn: () => addTrack('text') }
    ]);
  };
  box.appendChild(add);
  box.scrollTop = tlScroll.scrollTop;
}
function renameTrack(tr) {
  const box = modal(`<h2>Rename track</h2><div class="row" style="margin-top:14px"><input class="num-input" style="font-family:var(--font);font-size:13px;height:36px" maxlength="30"></div>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn primary" data-a="ok">Rename</button></div>`);
  const inp = $('input', box);
  inp.value = tr.name;
  setTimeout(() => { inp.focus(); inp.select(); }, 30);
  const ok = () => { const v = inp.value.trim(); closeModal(); if (v) commit(() => { tr.name = v; }); };
  inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') closeModal(); };
  $('[data-a=ok]', box).onclick = ok;
  $('[data-a=no]', box).onclick = closeModal;
}

function renderRuler() {
  const w = timelineWidth();
  tlContent.style.width = w + 'px';
  tlRuler.innerHTML = '';
  const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  const step = steps.find((s) => s * state.zoom >= 90) || 600;
  const minor = step / (step === 15 || step === 30 ? 3 : 5);
  const total = w / state.zoom;
  const frag = document.createDocumentFragment();
  for (let i = 0; i * minor <= total; i++) {
    const t = i * minor;
    const major = Math.abs(t / step - Math.round(t / step)) < 1e-6;
    const tick = el('div', 'tick' + (major ? '' : ' minor'));
    tick.style.left = t * state.zoom + 'px';
    if (major) tick.innerHTML = `<span>${step < 1 ? fmt(t) : fmt(t, false)}</span>`;
    frag.appendChild(tick);
  }
  for (const mk of P.markers || []) {
    const d = el('div', 'marker');
    d.style.left = mk.t * state.zoom + 'px';
    d.dataset.tip = `Marker at ${fmt(mk.t)} · right-click to remove`;
    d.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (state.playing) pause(); seek(mk.t); });
    d.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); commit(() => { P.markers = P.markers.filter((x) => x !== mk); }); });
    frag.appendChild(d);
  }
  tlRuler.appendChild(frag);
}

const waveCache = new Map();
// Loudness -> bar height. 0 dB (the loudest a file can be) reaches the top of the clip.
const WAVE_FLOOR_DB = -42;
const waveLevel = (a) => (a <= 0.0001 ? 0 : clamp((20 * Math.log10(a) - WAVE_FLOOR_DB) / -WAVE_FLOOR_DB, 0, 1));
function waveCanvas(c, widthPx, volOverride) {
  const peaks = rt.peaks.get(c.mediaId);
  const m = getMedia(c.mediaId);
  if (!peaks || !m || !m.duration) return null;
  const w = Math.max(1, Math.min(6000, Math.round(widthPx)));
  const vol = Math.max(0, volOverride != null ? volOverride : (c.volume == null ? 1 : c.volume));
  const key = `${c.mediaId}|${c.in.toFixed(3)}|${c.out.toFixed(3)}|${w}|${vol.toFixed(2)}`;
  if (waveCache.has(key)) return cloneCanvas(waveCache.get(key));
  const abs = rt.peaksAbs.get(c.mediaId) || peaks;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const H = 120, W = Math.min(8000, Math.round(w * dpr));
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const top = 4, room = H - top; // a little space so red "too loud" tips still show
  const grad = g.createLinearGradient(0, top, 0, H);
  grad.addColorStop(0, 'rgba(255,255,255,0.98)');
  grad.addColorStop(0.55, 'rgba(196,255,226,0.95)');
  grad.addColorStop(1, 'rgba(120,230,175,0.9)');
  const step = 3 * dpr, bw = Math.max(1, 2 * dpr);
  for (let x = 0; x < W; x += step) {
    let v = 0;
    const t0 = c.in + (x / W) * (c.out - c.in), t1 = c.in + ((x + step) / W) * (c.out - c.in);
    const i0 = clamp(Math.floor((t0 / m.duration) * abs.length), 0, abs.length - 1);
    const i1 = clamp(Math.ceil((t1 / m.duration) * abs.length), i0 + 1, abs.length);
    for (let i = i0; i < i1; i++) if (abs[i] > v) v = abs[i];
    const amp = v * vol;
    const h = Math.max(2, waveLevel(Math.min(amp, 1)) * room);
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect ? g.roundRect(x, H - h, bw, h, [Math.min(bw / 2, 2), Math.min(bw / 2, 2), 0, 0]) : g.rect(x, H - h, bw, h);
    g.fill();
    if (amp > 1.06) { // too loud: it will distort
      g.fillStyle = 'rgba(255,82,82,0.98)';
      g.fillRect(x, H - h, bw, Math.min(h, 6 + Math.min(1, amp - 1) * 18));
    }
  }
  if (waveCache.size > 300) waveCache.clear();
  waveCache.set(key, cv);
  return cloneCanvas(cv);
}

// ---------- video frames on the timeline ----------
rt.strips = rt.strips || new Map();
const stripLoading = new Set();
function loadStrip(m) {
  if (!m || !api || !api.mediaStrip || stripLoading.has(m.id) || rt.strips.has(m.id) || !m.duration) return;
  stripLoading.add(m.id);
  const count = clamp(Math.round(m.duration / (lowEnd() ? 2 : 1)), 8, lowEnd() ? 80 : 160);
  api.mediaStrip({ file: m.path, duration: m.duration, count }).then((r) => {
    if (!r) return;
    const img = new Image();
    img.onload = () => { rt.strips.set(m.id, { url: api.mediaUrl(r.file), n: r.n, cols: r.cols, rows: r.rows, ar: (img.naturalWidth / r.cols) / (img.naturalHeight / r.rows) }); fillFilmstrips(); };
    img.src = api.mediaUrl(r.file);
  }).finally(() => stripLoading.delete(m.id));
}
// Fill each video clip with frames from its own part of the video.
function fillFilmstrips() {
  for (const ce of $$('.clip.kind-video', tlLanes)) {
    const c = getClip(ce.dataset.id), m = c && getMedia(c.mediaId);
    if (!c || !m) continue;
    const st = rt.strips.get(m.id);
    if (!st) { loadStrip(m); continue; }
    let film = $('.film', ce);
    if (!film) { film = el('div', 'film'); ce.insertBefore(film, ce.firstChild); }
    film.className = 'film frames';
    film.style.backgroundImage = '';
    const h = ce.clientHeight || 40, w = ce.clientWidth;
    const tw = Math.max(16, h * st.ar);
    const n = Math.min(400, Math.ceil(w / tw) + 1);
    if (film._sig === `${n}|${tw}|${c.in}|${c.out}|${w}`) continue;
    film._sig = `${n}|${tw}|${c.in}|${c.out}|${w}`;
    film.innerHTML = '';
    for (let k = 0; k < n; k++) {
      const t = c.in + Math.min(1, ((k + 0.5) * tw) / Math.max(1, w)) * (c.out - c.in);
      const idx = clamp(Math.floor((t / m.duration) * st.n), 0, st.n - 1);
      const f = el('i');
      f.style.width = tw + 'px';
      f.style.backgroundImage = `url("${st.url}")`;
      f.style.backgroundSize = `${st.cols * 100}% ${st.rows * 100}%`;
      f.style.backgroundPosition = `${st.cols > 1 ? ((idx % st.cols) / (st.cols - 1)) * 100 : 0}% ${st.rows > 1 ? (Math.floor(idx / st.cols) / (st.rows - 1)) * 100 : 0}%`;
      film.appendChild(f);
    }
  }
}
function cloneCanvas(src) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

function clipLabel(c) {
  if (c.kind === 'text') return (c.text.content || 'Text').split('\n')[0];
  const m = getMedia(c.mediaId);
  return m ? m.name : 'Missing media';
}

function renderLanes() {
  tlLanes.innerHTML = '';
  const z = state.zoom;
  for (const tr of P.tracks) {
    const lane = el('div', 'lane t-' + tr.type + (tr.hidden ? ' hidden-track' : ''));
    lane.dataset.track = tr.id;
    for (const c of P.clips.filter((x) => x.trackId === tr.id)) {
      const m = getMedia(c.mediaId);
      const w = dur(c) * z;
      const sel = getClip(state.selectedId);
      const ce = el('div', `clip kind-${c.kind}${c.id === state.selectedId ? ' selected' : ''}${sel && sel.linkId && c.linkId === sel.linkId && c.id !== sel.id ? ' linked' : ''}${c.kind !== 'text' && (!m || m.missing || m.error) ? ' missing' : ''}`);
      ce.dataset.id = c.id;
      ce.style.left = c.start * z + 'px';
      ce.style.width = Math.max(4, w) + 'px';
      if (c.kind === 'video' || c.kind === 'image') {
        const th = rt.thumbs.get(c.mediaId);
        if (th) { const f = el('div', 'film'); f.style.backgroundImage = `url('${th}')`; ce.appendChild(f); }
      }
      if (c.kind === 'audio') {
        const vol = kv(c, 'volume', clamp(state.time - c.start, 0, dur(c)));
        const wc = waveCanvas(c, w, vol);
        if (wc) { wc.className = 'wave'; wc.style.width = w + 'px'; ce.appendChild(wc); }
        else {
          const m0 = getMedia(c.mediaId);
          if (m0 && !m0.missing && !m0.error) { loadPeaks(m0); ce.appendChild(el('div', 'wave-loading', 'Reading sound…')); }
        }
        // level marks: 200% at the top, 100% in the middle
        const grid = el('div', 'vol-grid');
        grid.innerHTML = [2, 1.5, 1, 0.5].map((v) => `<i style="top:${volLineTop(v)}%"><b>${Math.round(v * 100)}%</b></i>`).join('');
        ce.appendChild(grid);
        // volume line: drag it up or down to change the loudness
        const vl = el('div', 'vol-line' + (c.keys && c.keys.volume && c.keys.volume.length ? ' keyed' : ''));
        vl.style.top = volLineTop(vol) + '%';
        vl.innerHTML = `<span class="vol-tag">${Math.round(vol * 100)}%</span>`;
        vl.dataset.tip = 'Drag up or down to change volume · double-click to reset';
        ce.appendChild(vl);
      }
      if (c.fadeIn > 0) { const f = el('div', 'fade in'); f.style.width = c.fadeIn * z + 'px'; ce.appendChild(f); }
      if (c.fadeOut > 0) { const f = el('div', 'fade out'); f.style.width = c.fadeOut * z + 'px'; ce.appendChild(f); }
      const label = el('div', 'label');
      label.textContent = clipLabel(c);
      ce.appendChild(label);
      const badges = [];
      if (c.speed !== 1) badges.push(c.speed + 'x');
      if (c.muted && !(c.kind === 'video' && c.linkId)) badges.push('MUTED');
      if (c.filter && c.filter !== 'none') badges.push(filterById(c.filter).name.toUpperCase());
      if (badges.length && w > 60) {
        const b = el('div', 'badges');
        b.innerHTML = badges.map((x) => `<span>${x}</span>`).join('');
        ce.appendChild(b);
      }
      if (c.linkId) { const li = el('span', 'link-ico', '🔗'); ce.appendChild(li); }
      if (c.keys) {
        const times = new Set();
        for (const arr of Object.values(c.keys)) for (const kf of arr || []) times.add(kf.t.toFixed(3));
        for (const tt of times) { const d = el('div', 'kf'); d.style.left = (+tt) * z + 'px'; ce.appendChild(d); }
      }
      ce.appendChild(el('div', 'handle l'));
      ce.appendChild(el('div', 'handle r'));
      lane.appendChild(ce);
    }
    // Cuts between clips: click to add a transition
    if (tr.type === 'video') {
      for (const c of P.clips.filter((x) => x.trackId === tr.id && isVisual(x))) {
        const prev = adjPrev(c);
        const td = transDur(c);
        if (td) {
          const span = el('div', 'trans-span');
          const st = prev ? c.start - td / 2 : c.start;
          span.style.left = st * z + 'px';
          span.style.width = Math.max(6, td * z) + 'px';
          lane.appendChild(span);
        }
        if (!prev && !td) continue;
        const j = el('button', 'junction' + (td ? ' has' : ''));
        j.style.left = c.start * z + 'px';
        j.dataset.id = c.id;
        j.dataset.tip = td ? `${transById(c.transition.type).name} · click to change` : 'Add a transition here';
        j.innerHTML = td ? '<svg viewBox="0 0 24 24"><path d="M4 4l16 16M20 4 4 20"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';
        lane.appendChild(j);
      }
    }
    tlLanes.appendChild(lane);
  }
  fillFilmstrips();
}
// 200% at the top of the clip, 100% in the middle, silent at the bottom
function volLineTop(v) { return clamp(92 - (v / 2) * 84, 8, 92); }
tlLanes.addEventListener('dblclick', (e) => {
  const vl = e.target.closest('.vol-line');
  if (!vl) return;
  const c = getClip(vl.closest('.clip').dataset.id);
  if (c) commit(() => { if (c.keys && c.keys.volume) delete c.keys.volume; c.volume = 1; });
});
function openTransitionsFor(c) {
  select(c.id);
  showLibTab('transitions');
}

function updatePlayhead() {
  $('#playhead').style.transform = `translateX(${state.time * state.zoom}px)`;
  $('#timeNow').textContent = fmt(state.time);
}
function updateTimes() {
  $('#timeTotal').textContent = fmt(projectDuration());
}
function scrollTimelineTo(t) {
  const x = t * state.zoom;
  if (x < tlScroll.scrollLeft || x > tlScroll.scrollLeft + tlScroll.clientWidth - 60) tlScroll.scrollLeft = Math.max(0, x - 120);
}
function setZoom(z, anchorTime) {
  const old = state.zoom;
  state.zoom = clamp(z, 8, 400);
  if (old === state.zoom) return;
  const at = anchorTime ?? state.time;
  const screenX = at * old - tlScroll.scrollLeft;
  $('#zoomSlider').value = sliderFromZoom(state.zoom);
  setRangeFill($('#zoomSlider'));
  renderTimeline();
  tlScroll.scrollLeft = Math.max(0, at * state.zoom - screenX);
}
function fitZoom() {
  const d = Math.max(projectDuration(), 5);
  setZoom((tlScroll.clientWidth - 60) / d, 0);
  tlScroll.scrollLeft = 0;
}

function timeAtClientX(x) {
  const r = tlContent.getBoundingClientRect();
  return Math.max(0, (x - r.left) / state.zoom);
}
function laneAtClientY(y) {
  for (const l of $$('.lane', tlLanes)) {
    const r = l.getBoundingClientRect();
    if (y >= r.top && y < r.bottom) return getTrack(l.dataset.track);
  }
  return null;
}
function snapPoints(excludeId) {
  const pts = [0, state.time];
  for (const c of P.clips) if (c.id !== excludeId) pts.push(c.start, endOf(c));
  return pts;
}
function showSnap(t) {
  const s = $('#snapLine');
  if (t == null) { s.style.display = 'none'; return; }
  s.style.display = 'block';
  s.style.left = t * state.zoom + 'px';
}
function trySnap(values, excludeId) {
  if (!state.snap) return null;
  const tol = 9 / state.zoom;
  let best = null;
  for (const p of snapPoints(excludeId)) {
    values.forEach((v, i) => {
      const d = Math.abs(p - v);
      if (d < tol && (!best || d < best.d)) best = { d, delta: p - v, point: p, i };
    });
  }
  return best;
}

(function setupTimelineMouse() {
  let drag = null;

  const scrub = (e) => { seek(timeAtClientX(e.clientX)); };
  tlRuler.addEventListener('pointerdown', (e) => {
    if (state.playing) pause();
    tlRuler.setPointerCapture(e.pointerId);
    scrub(e);
    const mv = (ev) => scrub(ev);
    const up = () => { tlRuler.removeEventListener('pointermove', mv); tlRuler.removeEventListener('pointerup', up); };
    tlRuler.addEventListener('pointermove', mv);
    tlRuler.addEventListener('pointerup', up);
  });
  $('.ph-head').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (state.playing) pause();
    const h = e.currentTarget;
    h.setPointerCapture(e.pointerId);
    const mv = (ev) => scrub(ev);
    const up = () => { h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); };
    h.addEventListener('pointermove', mv);
    h.addEventListener('pointerup', up);
  });

  tlLanes.addEventListener('pointerdown', (e) => {
    if (e.button === 2) return;
    const vline = e.target.closest('.vol-line');
    if (vline) {
      e.stopPropagation();
      const c = getClip(vline.closest('.clip').dataset.id);
      if (!c) return;
      if (state.selectedId !== c.id) { state.selectedId = c.id; renderInspector(); }
      const v0 = kv(c, 'volume', clamp(state.time - c.start, 0, dur(c)));
      drag = { mode: 'vol', c, snap: snapshot(), y0: e.clientY, v0, line: vline, h: vline.closest('.clip').clientHeight, moved: false };
      vline.classList.add('active');
      tlLanes.setPointerCapture(e.pointerId);
      return;
    }
    const junc = e.target.closest('.junction');
    if (junc) { e.stopPropagation(); const c = getClip(junc.dataset.id); if (c) openTransitionsFor(c); return; }
    const clipEl = e.target.closest('.clip');
    if (!clipEl) {
      // click on empty space: move playhead there
      select(null);
      if (state.playing) pause();
      scrub(e);
      tlLanes.setPointerCapture(e.pointerId);
      drag = { mode: 'scrub' };
      return;
    }
    const c = getClip(clipEl.dataset.id);
    if (!c) return;
    select(c.id);
    const handle = e.target.closest('.handle');
    const t0 = timeAtClientX(e.clientX);
    drag = {
      mode: handle ? (handle.classList.contains('l') ? 'trimL' : 'trimR') : 'move',
      c, snap: snapshot(), t0, x0: e.clientX, moved: false,
      orig: { start: c.start, in: c.in, out: c.out, trackId: c.trackId },
      grab: t0 - c.start,
      linked: (e.altKey ? [] : partners(c)).map((p) => ({ p, start: p.start, in: p.in, out: p.out }))
    };
    tlLanes.setPointerCapture(e.pointerId);
  });

  tlLanes.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.mode === 'scrub') { scrub(e); return; }
    if (drag.mode === 'vol') {
      drag.moved = true;
      let v = clamp(drag.v0 - ((e.clientY - drag.y0) / Math.max(20, drag.h - 10)) * 2, 0, 2);
      if (Math.abs(v - 1) < 0.04) v = 1; // gently snap to 100%
      setProp(drag.c, 'volume', v);
      drag.line.style.top = volLineTop(v) + '%';
      drag.line.firstChild.textContent = Math.round(v * 100) + '%';
      const wv = drag.line.parentElement.querySelector('.wave');
      if (wv) { const nw = waveCanvas(drag.c, parseFloat(wv.style.width) || wv.clientWidth, v); if (nw) { nw.className = 'wave'; nw.style.width = wv.style.width; wv.replaceWith(nw); } }
      return;
    }
    if (!drag.moved && Math.abs(e.clientX - drag.x0) < 3 && drag.mode === 'move' && !laneChanged(e)) return;
    drag.moved = true;
    const c = drag.c, o = drag.orig;
    const t = timeAtClientX(e.clientX);
    const unbounded = c.kind === 'image' || c.kind === 'text';
    const m = getMedia(c.mediaId);
    const siblings = P.clips.filter((x) => x.trackId === c.trackId && x.id !== c.id);

    if (drag.mode === 'move') {
      let ns = Math.max(0, t - drag.grab);
      const d = dur(c);
      const s = trySnap([ns, ns + d], c.id);
      if (s) { ns += s.delta; showSnap(s.point); } else showSnap(null);
      c.start = Math.max(0, ns);
      const tr = laneAtClientY(e.clientY);
      if (tr && tr.type === trackTypeFor(c.kind)) c.trackId = tr.id;
    } else if (drag.mode === 'trimL') {
      const prevEnd = siblings.filter((x) => endOf(x) <= o.start + 1e-4).reduce((mx, x) => Math.max(mx, endOf(x)), 0);
      let ns = t;
      const s = trySnap([ns], c.id);
      if (s) { ns += s.delta; showSnap(s.point); } else showSnap(null);
      const origEnd = o.start + (o.out - o.in) / c.speed;
      ns = clamp(ns, prevEnd, origEnd - MIN_DUR);
      if (unbounded) {
        c.start = ns;
        c.in = 0;
        c.out = (origEnd - ns) * c.speed;
      } else {
        let nIn = o.in + (ns - o.start) * c.speed;
        nIn = clamp(nIn, 0, o.out - MIN_DUR * c.speed);
        c.in = nIn;
        c.start = o.start + (nIn - o.in) / c.speed;
      }
    } else if (drag.mode === 'trimR') {
      const nextStart = siblings.filter((x) => x.start >= o.start + (o.out - o.in) / c.speed - 1e-4).reduce((mn, x) => Math.min(mn, x.start), Infinity);
      let ne = t;
      const s = trySnap([ne], c.id);
      if (s) { ne += s.delta; showSnap(s.point); } else showSnap(null);
      ne = Math.min(ne, nextStart);
      let nOut = c.in + (ne - c.start) * c.speed;
      const maxOut = unbounded ? Infinity : (m ? m.duration : c.out);
      c.out = clamp(nOut, c.in + MIN_DUR * c.speed, maxOut);
    }
    // keep the linked sound (or video) in step
    for (const l of drag.linked) {
      const pm = getMedia(l.p.mediaId);
      l.p.start = Math.max(0, l.start + (c.start - o.start));
      l.p.in = clamp(l.in + (c.in - o.in), 0, pm && pm.duration ? pm.duration : Infinity);
      l.p.out = clamp(l.out + (c.out - o.out), l.p.in + MIN_DUR, pm && pm.duration ? pm.duration : Infinity);
    }
    renderLanes();
    requestDraw();
  });

  function laneChanged(e) {
    const tr = laneAtClientY(e.clientY);
    return tr && drag && drag.c && tr.id !== drag.c.trackId && tr.type === trackTypeFor(drag.c.kind);
  }

  const end = () => {
    if (!drag) return;
    showSnap(null);
    if (drag.mode === 'vol') {
      drag.line.classList.remove('active');
      if (snapshot() !== drag.snap) pushHistory(drag.snap);
      const c = drag.c;
      drag = null;
      renderLanes(); renderInspector();
      if (c) toast(`Volume ${Math.round(kv(c, 'volume', clamp(state.time - c.start, 0, dur(c))) * 100)}%`, { duration: 1200 });
      return;
    }
    if (drag.mode !== 'scrub' && drag.moved) {
      const c = drag.c;
      if (drag.mode === 'move') {
        c.start = findFreeStart(c.trackId, c.start, dur(c), c.id);
        for (const l of drag.linked) {
          l.p.start = Math.max(0, l.start + (c.start - drag.orig.start));
          const cur = getTrack(l.p.trackId);
          if (Math.abs(findFreeStart(l.p.trackId, l.p.start, dur(l.p), l.p.id) - l.p.start) > 1e-6) {
            const tr = P.tracks.find((x) => x.type === cur.type && x.id !== cur.id && Math.abs(findFreeStart(x.id, l.p.start, dur(l.p), l.p.id) - l.p.start) < 1e-6);
            if (tr) l.p.trackId = tr.id;
          }
        }
      }
      if (snapshot() !== drag.snap) pushHistory(drag.snap);
      renderTimeline();
      renderInspector();
    }
    drag = null;
  };
  tlLanes.addEventListener('pointerup', end);
  tlLanes.addEventListener('pointercancel', end);

  tlLanes.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const clipEl = e.target.closest('.clip');
    const t = timeAtClientX(e.clientX);
    if (!clipEl) {
      contextMenu(e.clientX, e.clientY, [
        { label: 'Add text here', fn: () => { seek(t); addText(); } },
        { label: 'Paste', fn: paste, disabled: !clipboard }
      ]);
      return;
    }
    const c = getClip(clipEl.dataset.id);
    select(c.id);
    contextMenu(e.clientX, e.clientY, [
      { label: 'Split here', fn: () => { seek(t); splitAt(t); } },
      { label: 'Duplicate', fn: duplicateSelected },
      { label: 'Copy', fn: copySel },
      { label: 'Quality & frame rate…', fn: () => openQualityDialog(c) },
      hasAudio(c) && !(c.kind === 'video' && partners(c).length) ? { label: 'Balance sound…', fn: () => openBalanceDialog(c) } : null,
      soundSource(c) ? { label: 'Auto captions…', fn: () => openCaptionsDialog(c) } : null,
      soundSource(c) ? { label: 'Bleep swear words…', pro: true, fn: () => openBleepDialog(c) } : null,
      soundSource(c) ? { label: 'Remove silences', pro: true, fn: () => removeSilences(c) } : null,
      hasAudio(c) ? { label: c.muted ? 'Unmute' : 'Mute', fn: () => commit(() => { c.muted = !c.muted; }) } : null,
      c.kind === 'video' && !partners(c).length ? { label: 'Separate sound', fn: () => detachAudio(c) } : null,
      partners(c).length ? { label: 'Unlink video & sound', fn: () => commit(() => { for (const p of partners(c)) p.linkId = null; c.linkId = null; }) } : null,
      isVisual(c) ? { label: 'Add keyframe here', fn: () => { seek(clamp(t, c.start, endOf(c))); addKeyframeAll(c); } } : null,
      c.kind === 'video' ? { label: 'Freeze frame here', fn: () => { seek(clamp(t, c.start, endOf(c) - 0.05)); freezeFrame(); } } : null,
      isVisual(c) ? { label: 'Add transition…', fn: () => openTransitionsFor(c) } : null,
      { label: 'Delete', fn: () => deleteSelected(false), danger: true },
      { label: 'Delete & close gap', fn: () => deleteSelected(true), danger: true }
    ].filter(Boolean));
  });

  // Mouse wheel: Ctrl = zoom, otherwise scroll sideways
  tlScroll.addEventListener('wheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      setZoom(state.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), timeAtClientX(e.clientX));
    } else if (!e.shiftKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) && tlScroll.scrollHeight <= tlScroll.clientHeight + 2) {
      e.preventDefault();
      tlScroll.scrollLeft += e.deltaY;
    }
  }, { passive: false });
  tlScroll.addEventListener('scroll', () => { $('#trackHeaders').scrollTop = tlScroll.scrollTop; });

  // Drop media from the library onto the timeline
  tlLanes.addEventListener('dragover', (e) => {
    const lane = e.target.closest('.lane');
    $$('.lane.drop-ok').forEach((l) => l !== lane && l.classList.remove('drop-ok'));
    const types = e.dataTransfer.types;
    if (types.some((x) => /^text\/flux-|^Files$/.test(x))) {
      e.preventDefault();
      e.stopPropagation();
      $('#dropOverlay').classList.remove('show');
      if (lane) lane.classList.add('drop-ok');
    }
  });
  tlLanes.addEventListener('dragleave', (e) => { const l = e.target.closest('.lane'); if (l) l.classList.remove('drop-ok'); });
  tlLanes.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    $$('.lane.drop-ok').forEach((l) => l.classList.remove('drop-ok'));
    $('#dropOverlay').classList.remove('show');
    dragDepth = 0;
    const lane = e.target.closest('.lane');
    const track = lane ? getTrack(lane.dataset.track) : null;
    let t = timeAtClientX(e.clientX);
    const s = trySnap([t]);
    if (s) t += s.delta;
    const trType = e.dataTransfer.getData('text/flux-transition');
    if (trType) {
      // find the cut closest to where it was dropped
      const t0 = timeAtClientX(e.clientX);
      const onTrack = P.clips.filter((c) => isVisual(c) && (!track || c.trackId === track.id));
      let best = null, bd = Infinity;
      for (const c of onTrack) {
        const d = Math.abs(c.start - t0) * (adjPrev(c) ? 1 : 2);
        if (d < bd) { bd = d; best = c; }
      }
      if (best && bd < Math.max(1, 60 / state.zoom)) { setTransition(best, trType); select(best.id); }
      else toast('Drop the transition on a cut between two clips');
      return;
    }
    const look = e.dataTransfer.getData('text/flux-filter') || e.dataTransfer.getData('text/flux-effect');
    if (look) {
      const t0 = timeAtClientX(e.clientX);
      const target = P.clips.find((c) => isVisual(c) && (!track || c.trackId === track.id) && t0 >= c.start && t0 < endOf(c))
        || P.clips.find((c) => isVisual(c) && t0 >= c.start && t0 < endOf(c));
      if (!target) return toast('Drop it onto a video or photo clip');
      applyLook(target, e.dataTransfer.getData('text/flux-filter') ? { filter: look } : JSON.parse(look));
      return;
    }
    const textData = e.dataTransfer.getData('text/flux-text');
    if (textData) { seek(timeAtClientX(e.clientX)); addText(JSON.parse(textData)); return; }
    const music = e.dataTransfer.getData('text/flux-music');
    if (music) { if (typeof dropMusicOnTimeline === 'function') dropMusicOnTimeline(JSON.parse(music), track, t); return; }
    const id = e.dataTransfer.getData('text/flux-media');
    if (id) {
      const m = getMedia(id);
      if (m) addMediaAt(m, track ? track.id : null, t);
      return;
    }
    const files = filesFromDrop(e);
    if (!files.length) return;
    const media = await importFiles(files);
    for (const m of media) {
      const c = addMediaAt(m, track ? track.id : null, t);
      if (c) t = endOf(c);
    }
  });
})();

/* ============================ CONTEXT MENU ============================ */
let clipboard = null;
function copySel() {
  const c = getClip(state.selectedId);
  if (!c) return;
  clipboard = JSON.parse(JSON.stringify(c));
  toast('Copied clip');
}
function paste() {
  if (!clipboard) return;
  commit(() => {
    const b = JSON.parse(JSON.stringify(clipboard));
    b.id = uid();
    if (!getTrack(b.trackId)) b.trackId = firstTrack(trackTypeFor(b.kind)).id;
    b.start = findFreeStart(b.trackId, state.time, dur(b), b.id);
    P.clips.push(b);
    state.selectedId = b.id;
  });
}
function contextMenu(x, y, items) {
  closeContextMenu();
  const menu = el('div', 'ctx-menu');
  Object.assign(menu.style, {
    position: 'fixed', zIndex: 90, background: '#1a1a25', border: '1px solid var(--line-2)', borderRadius: '10px',
    padding: '5px', minWidth: '190px', boxShadow: '0 16px 40px rgba(0,0,0,.55)'
  });
  for (const it of items) {
    const b = el('button');
    b.innerHTML = '<span></span>' + (it.key ? '<kbd class="ctx-key"></kbd>' : '');
    b.firstChild.textContent = it.label;
    if (it.pro) b.firstChild.insertAdjacentHTML('beforeend', ' ' + CROWN);
    if (it.key) b.lastChild.textContent = it.key;
    Object.assign(b.style, {
      display: 'flex', justifyContent: 'space-between', gap: '24px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', padding: '7px 10px',
      borderRadius: '6px', fontSize: '12.5px', color: it.danger ? 'var(--danger)' : 'var(--text)', opacity: it.disabled ? 0.4 : 1
    });
    b.onmouseenter = () => (b.style.background = 'var(--panel-3)');
    b.onmouseleave = () => (b.style.background = 'transparent');
    b.onclick = () => { closeContextMenu(); if (!it.disabled) it.fn(); };
    menu.appendChild(b);
  }
  document.body.appendChild(menu);
  const r = menu.getBoundingClientRect();
  menu.style.left = clamp(x, 4, window.innerWidth - r.width - 4) + 'px';
  menu.style.top = clamp(y, 4, window.innerHeight - r.height - 4) + 'px';
  setTimeout(() => document.addEventListener('pointerdown', onCtxOutside), 0);
}
function onCtxOutside(e) { if (!e.target.closest('.ctx-menu')) closeContextMenu(); }
function closeContextMenu() {
  $$('.ctx-menu').forEach((m) => m.remove());
  document.removeEventListener('pointerdown', onCtxOutside);
}

/* ============================ INSPECTOR ============================ */
function setRangeFill(r) {
  const p = ((r.value - r.min) / (r.max - r.min)) * 100;
  r.style.setProperty('--p', p + '%');
}

function slider(parent, label, { min, max, step = 1, get, set, fmt: f = (v) => v, parse = parseFloat, def, live = true, kf }) {
  const row = el('div', 'field');
  row.innerHTML = `<label></label><input type="range"><input class="val">`;
  const lab = $('label', row), r = $('input[type=range]', row), val = $('.val', row);
  lab.textContent = label;
  if (kf) {
    const [kc, prop] = kf;
    const on = hasKeyAt(kc, prop);
    const b = el('button', 'kf-btn' + (on ? ' on' : '') + (kc.keys && kc.keys[prop] && kc.keys[prop].length ? ' has' : ''), '◆');
    b.dataset.tip = on ? 'Remove keyframe here' : 'Add keyframe here (animate this)';
    b.onclick = (e) => { e.preventDefault(); toggleKeyframe(kc, prop); };
    lab.prepend(b);
  }
  if (def != null) { lab.title = 'Double-click to reset'; lab.style.cursor = 'pointer'; }
  r.min = min; r.max = max; r.step = step; r.value = get();
  val.value = f(get());
  setRangeFill(r);
  r.addEventListener('pointerdown', beginEdit);
  r.addEventListener('input', () => {
    beginEdit();
    set(parseFloat(r.value));
    val.value = f(get());
    setRangeFill(r);
    requestDraw();
    if (live) renderLanes();
  });
  r.addEventListener('change', endEdit);
  val.addEventListener('change', () => {
    const v = parse(val.value);
    if (!isNaN(v)) {
      beginEdit(); set(clamp(v, min, max)); endEdit();
      r.value = get(); setRangeFill(r); requestDraw();
    }
    val.value = f(get());
  });
  val.addEventListener('keydown', (e) => { if (e.key === 'Enter') val.blur(); });
  lab.addEventListener('dblclick', () => {
    if (def == null) return;
    beginEdit(); set(def); endEdit();
    r.value = get(); val.value = f(get()); setRangeFill(r); requestDraw();
  });
  parent.appendChild(row);
  return row;
}

function chips(parent, options, current, onPick, cls = 'chips') {
  const box = el('div', cls);
  for (const o of options) {
    const b = el('button', 'chip' + (o.value === current ? ' active' : ''));
    b.textContent = o.label;
    if (o.tip) b.dataset.tip = o.tip;
    b.onclick = () => { onPick(o.value); };
    box.appendChild(b);
  }
  parent.appendChild(box);
  return box;
}

function section(parent, title, resetFn) {
  const s = el('div', 'section');
  const h = el('div', 'section-title');
  h.innerHTML = `<span></span>`;
  h.firstChild.textContent = title.replace(' 👑', '');
  if (title.includes('👑')) h.firstChild.insertAdjacentHTML('beforeend', ' ' + CROWN);
  if (resetFn) {
    const b = el('button');
    b.textContent = 'Reset';
    b.onclick = () => { commit(resetFn); };
    h.appendChild(b);
  }
  s.appendChild(h);
  parent.appendChild(s);
  return s;
}

function renderInspector() {
  const body = $('#inspectorBody');
  const scroll = $('#inspector').scrollTop;
  body.innerHTML = '';
  const c = getClip(state.selectedId);
  if (!c) { renderProjectPanel(body); return; }
  const m = getMedia(c.mediaId);
  const head = el('div', 'insp-head');
  head.innerHTML = `<span class="badge" style="background:${KIND_COLOR[c.kind]}">${ICON[c.kind]}</span><div><h3></h3><small></small></div>`;
  $('h3', head).textContent = clipLabel(c);
  $('small', head).textContent = `${c.kind[0].toUpperCase() + c.kind.slice(1)} · starts ${fmt(c.start)} · ${fmtShort(dur(c))}`;
  body.appendChild(head);

  const actions = el('div', 'insp-actions');
  actions.innerHTML = `<button class="btn" data-a="split">Split</button><button class="btn" data-a="dup">Duplicate</button><button class="btn danger" data-a="del">Delete</button>`;
  $('[data-a=split]', actions).onclick = () => splitAt();
  $('[data-a=dup]', actions).onclick = duplicateSelected;
  $('[data-a=del]', actions).onclick = () => deleteSelected();
  body.appendChild(actions);

  if (c.kind === 'text') textInspector(body, c);

  if (isVisual(c)) {
    const s = section(body, 'Position & size', () => Object.assign(c, { fit: 'contain', scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 }));
    chips(s, [{ label: 'Fit', value: 'contain', tip: 'Show the whole picture' }, { label: 'Fill', value: 'cover', tip: 'Fill the frame (crops edges)' }], c.fit,
      (v) => commit(() => { c.fit = v; }), 'toggle-row');
    slider(s, 'Size', { min: 10, max: 400, get: () => Math.round(kvNow(c, 'scale') * 100), set: (v) => setProp(c, 'scale', v / 100), fmt: (v) => v + '%', def: 100, live: false, kf: [c, 'scale'] });
    slider(s, 'Left / right', { min: -100, max: 100, get: () => Math.round(kvNow(c, 'x') * 100), set: (v) => setProp(c, 'x', v / 100), fmt: (v) => v, def: 0, live: false, kf: [c, 'x'] });
    slider(s, 'Up / down', { min: -100, max: 100, get: () => Math.round(kvNow(c, 'y') * 100), set: (v) => setProp(c, 'y', v / 100), fmt: (v) => v, def: 0, live: false, kf: [c, 'y'] });
    slider(s, 'Rotate', { min: -180, max: 180, get: () => Math.round(kvNow(c, 'rotation')), set: (v) => setProp(c, 'rotation', v), fmt: (v) => v + '°', def: 0, live: false, kf: [c, 'rotation'] });
    slider(s, 'Opacity', { min: 0, max: 100, get: () => Math.round(kvNow(c, 'opacity') * 100), set: (v) => setProp(c, 'opacity', v / 100), fmt: (v) => v + '%', def: 100, live: false, kf: [c, 'opacity'] });
    const tg = el('div', 'chips');
    for (const [k, label, tip] of [['flipH', 'Flip ↔', 'Mirror left/right'], ['flipV', 'Flip ↕', 'Flip upside down'], ['bgBlur', 'Blurred background', 'Fill empty bars with a blurred copy']]) {
      const b = el('button', 'chip' + (c[k] ? ' active' : ''));
      b.textContent = label; b.dataset.tip = tip;
      b.onclick = () => commit(() => { c[k] = !c[k]; });
      tg.appendChild(b);
    }
    s.appendChild(tg);
    const bl = el('div', 'field wide');
    bl.innerHTML = `<label>Blend</label><select></select>`;
    const bsel = $('select', bl);
    for (const [v, n] of [['source-over', 'Normal'], ['screen', 'Screen (lighten)'], ['multiply', 'Multiply (darken)'], ['overlay', 'Overlay'], ['lighter', 'Add / glow'], ['difference', 'Difference'], ['color-dodge', 'Dodge'], ['luminosity', 'Luminosity']]) {
      const o = el('option'); o.value = v; o.textContent = n; bsel.appendChild(o);
    }
    bsel.value = c.blend || 'source-over';
    bsel.onchange = () => commit(() => { c.blend = bsel.value; });
    s.appendChild(bl);

    // Transition from the clip before
    const prev = adjPrev(c);
    const ts = section(body, 'Transition in');
    const tsel = el('div', 'field wide');
    tsel.innerHTML = `<label>Type</label><select></select>`;
    const tse = $('select', tsel);
    for (const t of TRANSITIONS) { const o = el('option'); o.value = t.id; o.textContent = t.name; tse.appendChild(o); }
    tse.value = c.transition ? c.transition.type : 'none';
    tse.onchange = () => setTransition(c, tse.value);
    ts.appendChild(tsel);
    if (c.transition && c.transition.type !== 'none') {
      slider(ts, 'Length', { min: 0.1, max: 3, step: 0.1, get: () => c.transition.duration, set: (v) => (c.transition.duration = v), fmt: (v) => v.toFixed(1) + 's', def: 0.6 });
    }
    const note = el('p', 'hint');
    note.style.margin = '0 0 6px';
    note.textContent = prev ? 'Plays between the clip before and this one.' : 'No clip right before this one, so it transitions in from the background.';
    ts.appendChild(note);

    const mo = section(body, 'Motion', () => { c.motion = 'none'; });
    chips(mo, [
      { label: 'None', value: 'none' }, { label: 'Zoom in', value: 'zoomIn' }, { label: 'Zoom out', value: 'zoomOut' },
      { label: 'Pan left', value: 'panLeft' }, { label: 'Pan right', value: 'panRight' }, { label: 'Pan up', value: 'panUp' }, { label: 'Shake', value: 'shake' }
    ], c.motion || 'none', (v) => commit(() => { c.motion = v; }));

    const cr = section(body, 'Crop', () => { c.crop = { l: 0, r: 0, t: 0, b: 0 }; });
    if (!c.crop) c.crop = { l: 0, r: 0, t: 0, b: 0 };
    for (const [k, label] of [['l', 'Left'], ['r', 'Right'], ['t', 'Top'], ['b', 'Bottom']]) {
      slider(cr, label, { min: 0, max: 45, get: () => Math.round(c.crop[k] * 100), set: (v) => (c.crop[k] = v / 100), fmt: (v) => v + '%', def: 0, live: false });
    }

    const col = section(body, 'Color', () => Object.assign(c, { brightness: 100, contrast: 100, saturation: 100, blur: 0, filter: 'none' }));
    const fsel = el('div', 'field wide');
    fsel.innerHTML = `<label>Look</label><select></select>`;
    const sel = $('select', fsel);
    for (const f of FILTERS) { const o = el('option'); o.value = f.id; o.textContent = f.name; sel.appendChild(o); }
    sel.value = c.filter || 'none';
    sel.onchange = () => commit(() => { c.filter = sel.value; });
    col.appendChild(fsel);
    slider(col, 'Brightness', { min: 0, max: 200, get: () => c.brightness, set: (v) => (c.brightness = v), fmt: (v) => v, def: 100, live: false });
    slider(col, 'Contrast', { min: 0, max: 200, get: () => c.contrast, set: (v) => (c.contrast = v), fmt: (v) => v, def: 100, live: false });
    slider(col, 'Saturation', { min: 0, max: 200, get: () => c.saturation, set: (v) => (c.saturation = v), fmt: (v) => v, def: 100, live: false });
    slider(col, 'Blur', { min: 0, max: 30, get: () => c.blur, set: (v) => (c.blur = v), fmt: (v) => v, def: 0, live: false });
    slider(col, 'Warmth', { min: -100, max: 100, get: () => c.temp || 0, set: (v) => (c.temp = v), fmt: (v) => v, def: 0, live: false });
    slider(col, 'Hue', { min: -180, max: 180, get: () => c.hue || 0, set: (v) => (c.hue = v), fmt: (v) => v + '°', def: 0, live: false });
    effectsInspector(body, c);
  }

  if (c.kind === 'video' || c.kind === 'audio') {
    const s = section(body, 'Speed', () => setSpeed(c, 1));
    if (partners(c).length) s.insertAdjacentHTML('beforeend', '<p class="hint" style="margin:0 0 8px">🔗 Linked with its sound - speed, trims and cuts apply to both. Hold <kbd>Alt</kbd> while dragging to move just one.</p>');
    chips(s, [0.25, 0.5, 1, 2, 4, 10].map((v) => ({ label: v + 'x', value: v })), c.speed, (v) => commit(() => setSpeed(c, v)));
    slider(s, 'Custom', { min: 0.1, max: 10, step: 0.05, get: () => c.speed, set: (v) => setSpeed(c, v), fmt: (v) => v.toFixed(2) + 'x', def: 1 });

    if (c.kind === 'video' && partners(c).length) {
      const a0 = section(body, 'Sound');
      const b0 = el('button', 'btn', 'Edit the sound clip below ↓');
      b0.style.cssText = 'width:100%;justify-content:center';
      b0.onclick = () => select(partners(c)[0].id);
      a0.appendChild(b0);
    } else {
    const a = section(body, 'Sound', () => Object.assign(c, { volume: 1, muted: false }));
    slider(a, 'Volume', { min: 0, max: 200, get: () => Math.round(kvNow(c, 'volume') * 100), set: (v) => setProp(c, 'volume', v / 100), fmt: (v) => v + '%', def: 100, live: false, kf: [c, 'volume'] });
    chips(a, [{ label: c.muted ? 'Muted - click to unmute' : 'Mute this clip', value: 'm' }], c.muted ? 'm' : null, () => commit(() => { c.muted = !c.muted; }), 'toggle-row');
    if (c.kind === 'video') {
      const tools = el('div', 'insp-actions');
      tools.style.gridTemplateColumns = '1fr 1fr';
      tools.innerHTML = `<button class="btn" data-a="detach">Detach audio</button><button class="btn" data-a="freeze">Freeze frame</button>`;
      $('[data-a=detach]', tools).onclick = () => detachAudio(c);
      $('[data-a=freeze]', tools).onclick = freezeFrame;
      a.appendChild(tools);
    }
    const bal = el('div', 'insp-actions');
    bal.style.gridTemplateColumns = '1fr';
    bal.innerHTML = '<button class="btn">Balance, EQ & ducking…</button>';
    $('button', bal).onclick = () => openBalanceDialog(c);
    a.appendChild(bal);
    }
  }

  if (c.kind === 'image') {
    const s = section(body, 'Duration');
    lengthField(s, c);
  }

  const maxFade = Math.max(0.1, Math.min(5, dur(c) / 2));
  const fd = section(body, 'Fade in & out', () => Object.assign(c, { fadeIn: 0, fadeOut: 0 }));
  slider(fd, 'Fade in', { min: 0, max: maxFade, step: 0.1, get: () => Math.min(c.fadeIn, maxFade), set: (v) => (c.fadeIn = v), fmt: (v) => v.toFixed(1) + 's', def: 0 });
  slider(fd, 'Fade out', { min: 0, max: maxFade, step: 0.1, get: () => Math.min(c.fadeOut, maxFade), set: (v) => (c.fadeOut = v), fmt: (v) => v.toFixed(1) + 's', def: 0 });

  $('#inspector').scrollTop = scroll;
}

function lengthField(parent, c) {
  const row = el('div', 'field wide');
  row.innerHTML = `<label>Length (sec)</label><input class="num-input" type="number" min="0.1" step="0.5">`;
  const inp = $('input', row);
  inp.value = (Math.round(dur(c) * 100) / 100).toString();
  inp.onchange = () => {
    const v = parseFloat(inp.value);
    if (!(v > 0)) return;
    commit(() => setClipLength(c, Math.max(MIN_DUR, v)));
  };
  parent.appendChild(row);
}

function textInspector(body, c) {
  const t = c.text;
  if (c.caption) {
    const cs = section(body, 'Captions');
    const b = el('button', 'btn', 'Change style of all captions…');
    b.style.cssText = 'width:100%;justify-content:center';
    b.onclick = () => openCaptionsDialog(P.clips.find((x) => (x.linkId || x.id) === c.capFor) || null);
    cs.appendChild(b);
  }
  const s = section(body, 'Text');
  const ta = el('textarea', 'text-input');
  ta.value = t.content;
  ta.placeholder = 'Type your text…';
  ta.addEventListener('focus', beginEdit);
  ta.addEventListener('input', () => {
    beginEdit(); t.content = ta.value;
    if (t.words) { // keep caption word timing roughly in step with edited text
      const parts = ta.value.split(/\s+/).filter(Boolean), d = dur(c);
      t.words = parts.map((w, i) => ({ w, t0: (d * i) / parts.length, t1: (d * (i + 1)) / parts.length }));
    }
    requestDraw();
  });
  ta.addEventListener('blur', () => { endEdit(); renderInspectorHeadOnly(c); });
  s.appendChild(ta);
  const ff = el('div', 'field wide');
  ff.innerHTML = `<label>Font</label>`;
  ff.appendChild(fontPicker(t.font, (name) => commit(() => { t.font = name; })));
  s.appendChild(ff);
  slider(s, 'Size', { min: 16, max: 320, get: () => t.size, set: (v) => (t.size = v), fmt: (v) => v, def: 96, live: false });
  lengthField(s, c);

  const st = section(body, 'Style');
  const colors = el('div', 'color-row');
  colors.style.marginBottom = '12px';
  for (const col of TEXT_COLORS) {
    const b = el('button', 'swatch-btn' + (t.color.toLowerCase() === col ? ' active' : ''));
    b.style.background = col;
    b.onclick = () => commit(() => { t.color = col; });
    colors.appendChild(b);
  }
  const ci = el('input'); ci.type = 'color'; ci.value = t.color; ci.dataset.tip = 'Any color';
  ci.addEventListener('input', () => { beginEdit(); t.color = ci.value; requestDraw(); });
  ci.addEventListener('change', () => { endEdit(); renderInspector(); });
  colors.appendChild(ci);
  st.appendChild(colors);

  const tg = el('div', 'chips');
  const toggles = [['bold', 'Bold'], ['italic', 'Italic'], ['outline', 'Outline'], ['shadow', 'Shadow'], ['glow', 'Glow'], ['bg', 'Background']];
  for (const [k, label] of toggles) {
    const b = el('button', 'chip' + (t[k] ? ' active' : ''));
    b.textContent = label;
    b.onclick = () => commit(() => { t[k] = !t[k]; });
    tg.appendChild(b);
  }
  st.appendChild(tg);
  if (t.bg) {
    const bgRow = el('div', 'field');
    bgRow.innerHTML = `<label>Box color</label><div></div><input type="color">`;
    const bci = $('input', bgRow);
    bci.value = t.bgColor;
    bci.addEventListener('input', () => { beginEdit(); t.bgColor = bci.value; requestDraw(); });
    bci.addEventListener('change', endEdit);
    st.appendChild(bgRow);
    slider(st, 'Box opacity', { min: 0, max: 100, get: () => Math.round(t.bgOpacity * 100), set: (v) => (t.bgOpacity = v / 100), fmt: (v) => v + '%', def: 60, live: false });
  }
  if (t.outline) {
    const oRow = el('div', 'field');
    oRow.innerHTML = `<label>Outline color</label><div></div><input type="color">`;
    const oci = $('input', oRow);
    oci.value = t.outlineColor;
    oci.addEventListener('input', () => { beginEdit(); t.outlineColor = oci.value; requestDraw(); });
    oci.addEventListener('change', endEdit);
    st.appendChild(oRow);
  }
  chips(st, [{ label: 'Left', value: 'left' }, { label: 'Center', value: 'center' }, { label: 'Right', value: 'right' }], t.align, (v) => commit(() => { t.align = v; }), 'toggle-row');

  const an = section(body, 'Animation');
  chips(an, [
    { label: 'None', value: 'none' }, { label: 'Fade', value: 'fade' }, { label: 'Pop', value: 'pop' },
    { label: 'Slide up', value: 'slide' }, { label: 'Typewriter', value: 'type' }
  ], t.anim, (v) => { commit(() => { t.anim = v; }); seek(c.start); play(); });

  const pos = section(body, 'Position', () => { t.x = 0.5; t.y = 0.5; c.rotation = 0; c.scale = 1; });
  chips(pos, [{ label: 'Top', value: 0.15 }, { label: 'Middle', value: 0.5 }, { label: 'Bottom', value: 0.85 }],
    [0.15, 0.5, 0.85].find((v) => Math.abs(v - t.y) < 0.01), (v) => commit(() => { t.y = v; }), 'toggle-row');
  slider(pos, 'Left / right', { min: 0, max: 100, get: () => Math.round(t.x * 100), set: (v) => (t.x = v / 100), fmt: (v) => v, def: 50, live: false });
  slider(pos, 'Up / down', { min: 0, max: 100, get: () => Math.round(t.y * 100), set: (v) => (t.y = v / 100), fmt: (v) => v, def: 50, live: false });
  slider(pos, 'Size', { min: 10, max: 400, get: () => Math.round(kvNow(c, 'scale') * 100), set: (v) => setProp(c, 'scale', v / 100), fmt: (v) => v + '%', def: 100, live: false, kf: [c, 'scale'] });
  slider(pos, 'Rotate', { min: -180, max: 180, get: () => Math.round(kvNow(c, 'rotation') || 0), set: (v) => setProp(c, 'rotation', v), fmt: (v) => v + '°', def: 0, live: false, kf: [c, 'rotation'] });
  slider(pos, 'Opacity', { min: 0, max: 100, get: () => Math.round(kvNow(c, 'opacity') * 100), set: (v) => setProp(c, 'opacity', v / 100), fmt: (v) => v + '%', def: 100, live: false, kf: [c, 'opacity'] });
}
function renderInspectorHeadOnly(c) {
  const h3 = $('#inspectorBody .insp-head h3');
  if (h3) h3.textContent = clipLabel(c);
}

function renderProjectPanel(body) {
  const total = projectDuration();
  body.innerHTML = `
    <div class="insp-head"><span class="badge" style="background:var(--grad);color:#120e2c"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18"/></svg></span>
      <div><h3>Project</h3><small>Nothing selected - click a clip to edit it</small></div></div>`;
  const s = section(body, 'Video shape');
  const seg = el('div', 'seg tall');
  for (const [k, label] of [['16:9', 'Wide'], ['9:16', 'Vertical'], ['1:1', 'Square'], ['4:5', 'Portrait']]) {
    const b = el('button', P.aspect === k ? 'active' : '');
    b.innerHTML = `${k}<small>${label}</small>`;
    b.onclick = () => setAspect(k);
    seg.appendChild(b);
  }
  s.appendChild(seg);

  const bg = section(body, 'Background color');
  const row = el('div', 'color-row');
  for (const col of ['#000000', '#ffffff', '#16161f', '#2b1f5c', '#0f3d3a', '#5c1f2e']) {
    const b = el('button', 'swatch-btn' + (P.background === col ? ' active' : ''));
    b.style.background = col;
    b.onclick = () => commit(() => { P.background = col; });
    row.appendChild(b);
  }
  const ci = el('input'); ci.type = 'color'; ci.value = P.background;
  ci.addEventListener('input', () => { beginEdit(); P.background = ci.value; requestDraw(); });
  ci.addEventListener('change', () => { endEdit(); renderInspector(); });
  row.appendChild(ci);
  bg.appendChild(row);

  const info = section(body, 'Summary');
  const [W, H] = refSize();
  info.insertAdjacentHTML('beforeend', `
    <div class="stat-row">Length <b>${fmt(total)}</b></div>
    <div class="stat-row">Clips <b>${P.clips.length}</b></div>
    <div class="stat-row">Media files <b>${P.media.length}</b></div>
    <div class="stat-row">Export size <b>${W} × ${H}</b></div>`);

  const tips = section(body, 'Quick tips');
  const tipRows = [['play', 'Play or pause'], ['split', 'Split the clip under the playhead'], ['delete', 'Delete the selected clip'], ['marker', 'Add a marker'], ['addText', 'Add a text title']];
  tips.insertAdjacentHTML('beforeend', `<ul class="tips" style="margin:0">${tipRows.map(([a, label]) => `<li><kbd>${keyLabel(a) || '—'}</kbd><span>${label}</span></li>`).join('')}</ul>`);
  const ed = el('button', 'btn ghost');
  ed.style.cssText = 'margin-top:12px;width:100%;justify-content:center';
  ed.textContent = 'Change keyboard shortcuts';
  ed.onclick = () => openSettings('keys');
  body.appendChild(ed);
}

function setAspect(k) {
  if (P.aspect === k) return;
  commit(() => { P.aspect = k; });
  $('#aspectSelect').value = k;
  layoutStage();
}

/* ============================ LIBRARY TABS ============================ */
function renderTextPresets() {
  const box = $('#textPresets');
  box.innerHTML = '';
  for (const p of TEXT_PRESETS) {
    const t = Object.assign({}, DEFAULT_TEXT, p.t);
    const b = el('button', 'text-preset');
    b.dataset.tip = p.name;
    const span = el('span');
    span.textContent = p.name === 'Lower third' ? 'Your Name' : p.name === 'Caption' ? 'Caption text' : p.name === 'Typewriter' ? 'Once upon a time…' : t.content.split('\n')[0];
    Object.assign(span.style, {
      fontFamily: `"${t.font}", "Segoe UI", sans-serif`, fontWeight: t.bold ? 700 : 500, color: t.color, fontSize: '19px',
      padding: t.bg ? '3px 10px' : '0', borderRadius: '5px', background: t.bg ? hexToRgba(t.bgColor, t.bgOpacity) : 'none',
      textShadow: t.glow ? `0 0 10px ${t.color}, 0 0 3px ${t.color}` : t.outline ? '-1.5px -1.5px 0 #000,1.5px -1.5px 0 #000,-1.5px 1.5px 0 #000,1.5px 1.5px 0 #000' : t.shadow ? '0 2px 6px rgba(0,0,0,.7)' : 'none',
      whiteSpace: 'nowrap', maxWidth: '92%', overflow: 'hidden', textOverflow: 'ellipsis'
    });
    b.appendChild(span);
    b.onclick = () => addText(JSON.parse(JSON.stringify(p.t)));
    b.draggable = true;
    b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/flux-text', JSON.stringify(p.t)); e.dataTransfer.effectAllowed = 'copy'; });
    box.appendChild(b);
  }
  const em = $('#emojiGrid');
  if (em && !em.childElementCount) {
    for (const e of ['😂', '🔥', '❤️', '😍', '👍', '🎉', '✨', '😎', '🤯', '💯', '👀', '😭', '🙌', '⭐', '➡️', '⚡', '🎵', '📍']) {
      const b = el('button', 'emoji-btn');
      b.textContent = e;
      const props = { content: e, font: 'Segoe UI Emoji', size: 220, shadow: false, bold: false, anim: 'pop' };
      b.onclick = () => addText(props);
      b.draggable = true;
      b.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/flux-text', JSON.stringify(props)); ev.dataTransfer.effectAllowed = 'copy'; });
      em.appendChild(b);
    }
  }
}

function renderFilterGrid() {
  const box = $('#filterGrid');
  if (!box) return;
  box.innerHTML = '';
  const c = getClip(state.selectedId);
  const thumb = c && isVisual(c) ? rt.thumbs.get(c.mediaId) : null;
  for (const f of FILTERS) {
    const b = el('button', 'filter-chip' + (c && isVisual(c) && (c.filter || 'none') === f.id ? ' active' : ''));
    const sw = el('div', 'swatch');
    if (thumb) sw.style.backgroundImage = `url('${thumb}')`;
    sw.style.filter = f.css || 'none';
    sw.style.position = 'relative';
    if (f.tint) {
      const tint = el('div');
      Object.assign(tint.style, { position: 'absolute', inset: 0, background: f.tint, mixBlendMode: 'soft-light' });
      sw.appendChild(tint);
    }
    b.appendChild(sw);
    b.appendChild(document.createTextNode(f.name));
    b.draggable = true;
    b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/flux-filter', f.id); e.dataTransfer.effectAllowed = 'copy'; });
    b.onclick = () => {
      const cc = getClip(state.selectedId);
      if (!cc || !isVisual(cc)) return toast('Select a video or photo clip on the timeline first');
      commit(() => { cc.filter = f.id; });
      renderFilterGrid();
    };
    box.appendChild(b);
  }
}

let currentLibTab = 'media';
function showLibTab(name) {
  const prev = currentLibTab;
  currentLibTab = name;
  $$('#libTabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('#library .tab-page').forEach((p) => p.classList.toggle('active', p.dataset.page === name));
  if (name === 'filters') renderFilterGrid();
  if (name === 'transitions') renderTransitionGrid();
  if (name === 'music' && typeof musicTabShown === 'function') musicTabShown();
  if (prev === 'voice' && name !== 'voice' && typeof voiceTabHidden === 'function') voiceTabHidden();
  if (name === 'voice' && typeof voiceTabShown === 'function') voiceTabShown();
}
$$('#libTabs .tab').forEach((tab) => tab.addEventListener('click', () => showLibTab(tab.dataset.tab)));

function renderTransitionGrid() {
  const box = $('#transitionGrid');
  if (!box) return;
  box.innerHTML = '';
  const c = getClip(state.selectedId);
  const cur = c && isVisual(c) && c.transition ? c.transition.type : null;
  for (const t of TRANSITIONS.slice(1)) {
    const b = el('button', 'trans-chip' + (cur === t.id ? ' active' : '') + (t.pro ? ' pro' : ''));
    b.draggable = true;
    b.innerHTML = `<div class="trans-demo t-${t.id}"><i class="a"></i><i class="b"></i></div><span></span>`;
    $('span', b).innerHTML = (t.pro ? CROWN : '');
    $('span', b).appendChild(document.createTextNode(t.name));
    b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/flux-transition', t.id); e.dataTransfer.effectAllowed = 'copy'; });
    b.onclick = () => {
      const cc = getClip(state.selectedId);
      if (!cc || !isVisual(cc)) return toast('Click a video/photo clip (or a ＋ between clips) first, or drag this onto a cut');
      setTransition(cc, t.id);
      renderTransitionGrid();
      seek(Math.max(0, cc.start - 1));
      play();
    };
    box.appendChild(b);
  }
  const durRow = $('#transDefault');
  if (durRow && typeof settings !== 'undefined') {
    durRow.value = settings.transitionDur;
    $('#transDefaultVal').textContent = Number(settings.transitionDur).toFixed(1) + 's';
    setRangeFill(durRow);
  }
}

/* ============================ PROJECT DATA ============================ */
function serializeProject() {
  return {
    version: 2, id: P.id, name: P.name, aspect: P.aspect, background: P.background, tracks: P.tracks, clips: P.clips,
    markers: P.markers || [], output: P.output, createdAt: P.createdAt, updatedAt: P.updatedAt, duration: projectDuration(),
    media: P.media.map(({ id, path, name, kind, duration, width, height, credit, tag, hasAudio, words, wordsKey }) => ({ id, path, name, kind, duration, width, height, credit, tag, hasAudio, words, wordsKey }))
  };
}
// Opens a project's data in the editor.
async function loadProjectData(data) {
  pause();
  state.inEditor = false;
  for (const id of Array.from(rt.players.keys())) destroyPlayer(id);
  rt.images.clear(); rt.peaks.clear(); waveCache.clear();
  for (const u of rt.thumbs.values()) URL.revokeObjectURL(u);
  rt.thumbs.clear();
  const fresh = newProject();
  P = Object.assign(fresh, data);
  if (!Array.isArray(P.tracks) || !P.tracks.length) P.tracks = defaultTracks();
  P.clips = Array.isArray(P.clips) ? P.clips : [];
  P.media = Array.isArray(P.media) ? P.media : [];
  P.markers = Array.isArray(P.markers) ? P.markers : [];
  P.output = P.output || { res: 1080, fps: 30 };
  FPS = P.output.fps || 30;
  ensureSoundTrack();
  if (typeof ensureProjectFonts === 'function') ensureProjectFonts();
  state.selectedId = null;
  state.time = 0;
  hist.undo = []; hist.redo = []; hist.when = [];
  pendingSnap = null;
  updateUndoButtons();
  $('#projectName').value = P.name;
  $('#aspectSelect').value = P.aspect;
  layoutStage();
  renderMedia();
  refreshAll();
  for (const m of P.media) {
    m.missing = api ? !(await api.fileExists(m.path)) : false;
  }
  renderMedia();
  state.inEditor = true;
  markClean();
  await Promise.all(P.media.filter((m) => !m.missing).map(probeMedia));
  const missing = P.media.filter((m) => m.missing).length;
  if (missing) toast(`${missing} file(s) were moved or deleted. Click them in the library to find them.`, { error: true, duration: 6000 });
  refreshAll();
  if (typeof renderCredits === 'function') renderCredits();
}

/* ============================ EXPORT ============================ */
let exportJob = null;
function openExportDialog() {
  const total = projectDuration();
  if (!total) return toast('Your timeline is empty - add some media first');
  pause();
  const opts = { res: (P.output && P.output.res) || 1080, fps: (P.output && P.output.fps) || 30, format: 'mp4', quality: 'standard' };
  const box = modal(`
    <h2>Export video</h2>
    <p class="sub">Your video is <b>${fmt(total)}</b> long. Exporting plays it through once, so it takes about that long.</p>
    <div class="row"><label>Resolution</label><div class="seg tall" data-k="res">
      <button data-v="720">720p<small>Smaller file</small></button><button data-v="1080">1080p<small>Full HD</small></button><button data-v="1440">1440p<small>Sharper</small></button><button data-v="2160" data-pro="1">4K ${CROWN}<small>Ultra HD</small></button></div></div>
    <div class="row"><label>Frame rate</label><div class="seg" data-k="fps">
      <button data-v="24">24 fps</button><button data-v="30">30 fps</button><button data-v="60">60 fps</button></div></div>
    <div class="row"><label>Format</label><div class="seg tall" data-k="format">
      <button data-v="mp4">MP4<small>Works everywhere</small></button><button data-v="webm">WebM<small>For the web</small></button></div></div>
    <div class="row"><label>Quality</label><div class="seg" data-k="quality">
      <button data-v="small">Small file</button><button data-v="standard">Standard</button><button data-v="high">Best</button></div></div>
    <div class="size-est"><span>Estimated file size</span><b id="sizeEst"></b><small id="sizeDims"></small></div>
    <div class="footer"><button class="btn ghost" data-a="cancel">Cancel</button><button class="btn primary" data-a="go">Export</button></div>`);
  const sync = () => {
    $$('.seg', box).forEach((s) => $$('button', s).forEach((b) => b.classList.toggle('active', String(opts[s.dataset.k]) === b.dataset.v)));
    const e = estimateExport(opts, total);
    $('#sizeEst', box).textContent = '≈ ' + formatBytes(e.bytes);
    $('#sizeDims', box).textContent = `${e.w} × ${e.h} · ${opts.fps} fps · ${fmt(total, false)}`;
  };
  $$('.seg', box).forEach((s) => $$('button', s).forEach((b) => (b.onclick = () => {
    if (b.dataset.pro && !requirePremium(b.textContent.replace('👑', '').trim() + ' export')) return;
    opts[s.dataset.k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v; sync();
  })));
  sync();
  $('[data-a=cancel]', box).onclick = closeModal;
  $('[data-a=go]', box).onclick = () => runExport(opts);
}

function exportDims(res) {
  const [W, H] = refSize();
  const f = res / Math.min(W, H);
  return [Math.round((W * f) / 2) * 2, Math.round((H * f) / 2) * 2];
}
// Rough size: MP4 bits per pixel per frame for each quality, plus 192 kbps sound
function estimateExport(opts, total) {
  const [w, h] = exportDims(opts.res);
  const fpsF = opts.fps > 30 ? 0.7 : 1; // later frames compress better at 60 fps
  const bpp = opts.format === 'webm' ? { small: 0.07, standard: 0.12, high: 0.2 }[opts.quality] : { small: 0.035, standard: 0.06, high: 0.11 }[opts.quality];
  const videoBits = w * h * opts.fps * bpp * fpsF * total;
  const audioBits = 192000 * total;
  return { w, h, bytes: (videoBits + audioBits) / 8 };
}
function formatBytes(b) {
  if (b < 1024 * 1024) return Math.max(1, Math.round(b / 1024)) + ' KB';
  if (b < 1024 * 1024 * 1024) return (b / 1048576).toFixed(b < 100 * 1048576 ? 1 : 0) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}
function pickMime() {
  const list = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

async function runExport(opts) {
  const total = projectDuration();
  const target = api ? await api.exportChoose({ format: opts.format, name: P.name }) : 'browser-test.' + opts.format;
  if (!target) return;
  if (typeof ensureProjectFonts === 'function') await ensureProjectFonts();
  const [W, H] = refSize();
  const factor = opts.res / Math.min(W, H);
  const outW = Math.round((W * factor) / 2) * 2, outH = Math.round((H * factor) / 2) * 2;

  const box = modal(`
    <h2>Exporting…</h2><p class="sub" id="exSub">Recording your video. Please keep Flux open.</p>
    <canvas class="export-preview" id="exPreview"></canvas>
    <div class="progress"><div id="exBar"></div></div>
    <div class="progress-label"><span id="exLabel">0%</span><span id="exTime"></span></div>
    <div class="footer"><button class="btn ghost" id="exCancel">Cancel</button></div>`);
  const pv = $('#exPreview', box);
  pv.width = 400; pv.height = Math.round(400 * (H / W));
  if (H > W) { pv.style.width = '50%'; pv.style.margin = '0 auto'; pv.style.display = 'block'; }

  state.exporting = true;
  document.body.classList.add('exporting');
  ensureAudio();
  if (monitorGain) monitorGain.gain.value = 0;
  canvas.width = outW; canvas.height = outH;
  state.selectedId = state.selectedId; // keep
  seek(0);
  syncMedia();
  // Wait (up to 3s) for the first frames to be ready
  const t0 = performance.now();
  await new Promise((res) => {
    const check = () => {
      syncMedia();
      const busy = Array.from(rt.players.values()).some((p) => p.el.seeking || p.el.readyState < 2);
      if (!busy || performance.now() - t0 > 3000) res(); else setTimeout(check, 60);
    };
    check();
  });
  render();

  const mime = pickMime();
  const vStream = canvas.captureStream(opts.fps || FPS);
  const tracks = [...vStream.getVideoTracks()];
  if (exportDest) tracks.push(...exportDest.stream.getAudioTracks());
  const stream = new MediaStream(tracks);
  const qMul = { small: 0.07, standard: 0.12, high: 0.2 }[opts.quality] || 0.12;
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: Math.round(outW * outH * (opts.fps || FPS) * qMul), audioBitsPerSecond: 192000 });
  let chain = Promise.resolve();
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (!e.data || !e.data.size) return;
    chain = chain.then(async () => {
      const buf = await e.data.arrayBuffer();
      if (api) await api.exportChunk(buf); else chunks.push(buf);
    });
  };
  if (api) await api.exportBegin();
  exportJob = { rec, opts, target, total, chain: () => chain, chunks, box, pv, cancelled: false, start: performance.now() };
  $('#exCancel', box).onclick = cancelExport;
  rec.start(1000);
  play();
}

function exportTick() {
  if (!exportJob) return;
  const p = clamp(state.time / exportJob.total, 0, 1);
  const bar = $('#exBar'); if (bar) bar.style.width = (p * 90).toFixed(1) + '%';
  const lab = $('#exLabel'); if (lab) lab.textContent = Math.round(p * 90) + '%';
  const tt = $('#exTime'); if (tt) tt.textContent = `${fmt(state.time, false)} / ${fmt(exportJob.total, false)}`;
  const pv = exportJob.pv;
  if (pv && pv.isConnected) { const g = pv.getContext('2d'); try { g.drawImage(canvas, 0, 0, pv.width, pv.height); } catch {} }
}

async function finishExport() {
  const job = exportJob;
  if (!job || job.finishing) return;
  job.finishing = true;
  await new Promise((r) => { job.rec.onstop = r; job.rec.stop(); });
  await job.chain();
  endExportMode();
  if (job.cancelled) return;
  $('#exSub').textContent = job.opts.format === 'mp4' ? 'Converting to MP4…' : 'Finishing up…';
  $('#exCancel').disabled = true;
  if (!api) {
    const blob = new Blob(job.chunks, { type: 'video/webm' });
    window.__lastExport = { size: blob.size, url: URL.createObjectURL(blob) };
    exportDone({ ok: true, path: job.target });
    return;
  }
  const res = await api.exportFinish({ target: job.target, format: job.opts.format, duration: job.total, quality: job.opts.quality, fps: job.opts.fps });
  exportDone(res);
}
function exportDone(res) {
  exportJob = null;
  if (!res.ok) {
    const box = modal(`<h2>Export failed</h2><p class="sub" style="white-space:pre-wrap"></p><div class="footer"><button class="btn primary">OK</button></div>`);
    $('.sub', box).textContent = res.error || 'Something went wrong.';
    $('button', box).onclick = closeModal;
    return;
  }
  const box = modal(`<div class="success-icon">${ICON.check}</div><h2>Your video is ready</h2><p class="sub" id="donePath"></p>
    <div class="footer"><button class="btn ghost" data-a="close">Close</button><button class="btn primary" data-a="show">Show in folder</button></div>`);
  $('#donePath', box).textContent = res.path + (res.note ? '\n' + res.note : '');
  $('[data-a=close]', box).onclick = closeModal;
  $('[data-a=show]', box).onclick = () => { if (api) api.showInFolder(res.path); closeModal(); };
}
function endExportMode() {
  state.exporting = false;
  document.body.classList.remove('exporting');
  if (monitorGain) monitorGain.gain.value = 1;
  pause();
  layoutStage();
}
async function cancelExport() {
  if (!exportJob) return closeModal();
  exportJob.cancelled = true;
  pause();
  await finishExport();
  if (api) await api.exportCancel();
  exportJob = null;
  closeModal();
  toast('Export cancelled');
}

if (api) api.onConvertProgress((v) => {
  const bar = $('#exBar'); if (bar) bar.style.width = (90 + v * 10).toFixed(1) + '%';
  const lab = $('#exLabel'); if (lab) lab.textContent = Math.round(90 + v * 10) + '%';
});

/* ============================ SNAPSHOT ============================ */
async function saveSnapshot() {
  if (!projectDuration()) return toast('Nothing to capture yet');
  const [W, H] = refSize();
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const saveSel = state.selectedId;
  render(c.getContext('2d'), W);
  state.selectedId = saveSel;
  const url = c.toDataURL('image/png');
  requestDraw();
  if (api) { const p = await api.saveSnapshot(url); if (p) toast('Frame saved'); }
  else { const a = document.createElement('a'); a.href = url; a.download = 'Flux frame.png'; a.click(); }
}

/* ============================ HELP ============================ */
function showHelp() {
  const groups = typeof ACTIONS !== 'undefined' ? ACTIONS : [];
  const box = modal(`
    <h2>How Flux works</h2>
    <p class="sub">Three steps: <b>import</b> your clips, <b>arrange</b> them on the timeline, then <b>export</b>. Your project saves itself as you work.</p>
    <ul class="tips help">
      <li>1. Drag videos, photos and music into the window, or grab free songs from the <b>Music</b> tab.</li>
      <li>2. Drag them onto the timeline. Drag a clip's edges to trim it, and drag the middle to move it.</li>
      <li>3. Move the white playhead and press <kbd>${keyLabel('split') || 'S'}</kbd> to cut. Click the <b>＋</b> between two clips to add a transition.</li>
      <li>4. Click any clip to change its look, motion, speed and sound on the right. Add titles from the <b>Text</b> tab.</li>
      <li>5. Record your voice in the <b>Voice</b> tab, then press <b>Export</b> to save an MP4.</li>
    </ul>
    <div class="help-title">Keyboard shortcuts <button class="btn ghost" id="helpEditKeys" style="height:26px;font-size:11.5px;margin-left:8px">Change</button></div>
    <div class="help-grid">${groups.filter((a) => (settings.keybinds[a.id] || []).length).map((a) => `<div><span>${a.label}</span><kbd>${keyLabel(a.id)}</kbd></div>`).join('')}</div>
    <div class="footer"><button class="btn primary">Got it</button></div>`, { wide: true });
  $('.footer button', box).onclick = closeModal;
  $('#helpEditKeys', box).onclick = () => openSettings('keys');
}

/* ============================ GLOBAL WIRING ============================ */
function updateEmptyState() {
  $('#emptyState').classList.toggle('hidden', P.clips.length > 0);
  const es = $('#emptyState');
  if (P.media.length && !P.clips.length) {
    $('h2', es).textContent = 'Now drag something onto the timeline';
    $('p', es).textContent = 'Or double-click a file in your library to add it.';
    $('button', es).style.display = 'none';
  } else {
    $('h2', es).textContent = "Let's make something";
    $('p', es).textContent = 'Drop videos, photos or music anywhere in this window.';
    $('button', es).style.display = '';
  }
}
function refreshAll() {
  renderTimeline();
  renderInspector();
  updateEmptyState();
  requestDraw();
  updateUndoButtons();
  if (currentLibTab === 'transitions') renderTransitionGrid();
  if (typeof renderCredits === 'function') renderCredits();
}

function filesFromDrop(e) {
  return Array.from(e.dataTransfer.files || []).map((f) => ({
    path: api ? api.pathForFile(f) : URL.createObjectURL(f),
    name: f.name
  })).filter((f) => f.path);
}

// Drag files from your computer anywhere into the window
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (!e.dataTransfer.types.includes('Files')) return;
  dragDepth++;
  $('#dropOverlay').classList.add('show');
});
window.addEventListener('dragleave', (e) => {
  if (!e.dataTransfer.types.includes('Files')) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) $('#dropOverlay').classList.remove('show');
});
window.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
window.addEventListener('drop', (e) => {
  dragDepth = 0;
  $('#dropOverlay').classList.remove('show');
  if (!e.dataTransfer.types.includes('Files')) return;
  e.preventDefault();
  const files = filesFromDrop(e);
  if (files.length) importFiles(files);
});

$('#btnImport').onclick = promptImport;
$('#btnImport2').onclick = promptImport;
$('#btnPlay').onclick = togglePlay;
$('#btnStart').onclick = () => seek(0);
$('#btnEnd').onclick = () => seek(projectDuration());
$('#btnPrevFrame').onclick = () => stepFrames(-1);
$('#btnNextFrame').onclick = () => stepFrames(1);
$('#btnLoop').onclick = (e) => { state.loop = !state.loop; e.currentTarget.classList.toggle('on', state.loop); toast(state.loop ? 'Loop on' : 'Loop off'); };
$('#btnSnapshot').onclick = saveSnapshot;
$('#btnFullscreen').onclick = toggleFullscreen;
$('#btnSplit').onclick = () => splitAt();
$('#btnDelete').onclick = () => deleteSelected();
$('#btnDuplicate').onclick = duplicateSelected;
$('#btnAddText').onclick = () => addText();
$('#btnSnap').onclick = (e) => { state.snap = !state.snap; e.currentTarget.classList.toggle('on', state.snap); };
$('#btnRipple').onclick = (e) => { state.ripple = !state.ripple; e.currentTarget.classList.toggle('on', state.ripple); toast(state.ripple ? 'Deleting a clip will now close the gap' : 'Deleting a clip will leave a gap'); };
$('#btnZoomIn').onclick = () => setZoom(state.zoom * 1.4);
$('#btnZoomOut').onclick = () => setZoom(state.zoom / 1.4);
$('#btnFit').onclick = fitZoom;
$('#zoomSlider').addEventListener('input', (e) => setZoom(zoomFromSlider(+e.target.value)));
$('#btnUndo').onclick = undo;
$('#btnRedo').onclick = redo;
$('#btnExport').onclick = openExportDialog;
$('#btnHelp').onclick = showHelp;
$('#aspectSelect').onchange = (e) => setAspect(e.target.value);
$('#projectName').addEventListener('change', (e) => { P.name = e.target.value.trim() || 'Untitled project'; e.target.value = P.name; markDirty(); });
$('#btnMarker').onclick = () => toggleMarker();
$('#projectName').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else $('#viewer').requestFullscreen().catch(() => {});
}
document.addEventListener('fullscreenchange', () => setTimeout(layoutStage, 50));

// Resizable timeline (drag its top edge)
(function setupTimelineResize() {
  const handle = el('div');
  Object.assign(handle.style, { position: 'absolute', top: '-4px', left: 0, right: 0, height: '8px', cursor: 'ns-resize', zIndex: 10 });
  $('#timelinePanel').appendChild(handle);
  let saved = 330;
  try { saved = +localStorage.getItem('flux.tlHeight') || 330; } catch {}
  document.body.style.setProperty('--tl-height', clamp(saved, 200, window.innerHeight - 300) + 'px');
  handle.addEventListener('pointerdown', (e) => {
    handle.setPointerCapture(e.pointerId);
    const mv = (ev) => {
      const h = clamp(window.innerHeight - ev.clientY, 180, window.innerHeight - 280);
      document.body.style.setProperty('--tl-height', h + 'px');
      layoutStage();
    };
    const up = () => {
      handle.removeEventListener('pointermove', mv);
      handle.removeEventListener('pointerup', up);
      try { localStorage.setItem('flux.tlHeight', parseInt(getComputedStyle(document.body).getPropertyValue('--tl-height'))); } catch {}
    };
    handle.addEventListener('pointermove', mv);
    handle.addEventListener('pointerup', up);
  });
})();

// Keyboard: every shortcut can be changed in Settings → Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (typeof keyCapture !== 'undefined' && keyCapture) return; // settings is recording a new shortcut
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'textarea' || (tag === 'input' && !['range', 'button', 'checkbox', 'color', 'radio'].includes(e.target.type)) || tag === 'select';
  if (e.key === 'Escape') {
    closeContextMenu();
    if (modalOpen() && !state.exporting) closeModal();
    else if (!typing && state.inEditor) select(null);
    return;
  }
  if (state.exporting) return;
  const combo = comboFromEvent(e);
  if (!combo) return;
  const action = actionForCombo(combo);
  if (!action) return;
  // While typing, only allow shortcuts that use Ctrl (and never steal Ctrl+C/V/Z from text boxes)
  if (typing && (!/Ctrl\+/.test(combo) || ['copy', 'paste', 'undo', 'redo'].includes(action.id))) return;
  if (modalOpen() && !action.global) return;
  if (!state.inEditor && !action.global) return;
  e.preventDefault();
  action.run(e);
});

window.addEventListener('resize', () => { layoutStage(); renderRuler(); });

// Save right away when the window closes
window.addEventListener('beforeunload', () => { if (state.inEditor && state.dirty) saveNow({ sync: true }); });

/* ============================ MAIN LOOP ============================ */
let lastTimelineFollow = 0;
function frame(now) {
  if (state.playing) {
    const total = projectDuration();
    let t = playStartTime + ((now - playStartWall) / 1000);
    if (t >= total) {
      if (state.loop && !state.exporting) { t = 0; playStartTime = 0; playStartWall = now; }
      else {
        state.time = total;
        pause();
        if (state.exporting) finishExport();
        t = total;
      }
    }
    state.time = t;
    updatePlayhead();
    if (now - lastTimelineFollow > 250) {
      lastTimelineFollow = now;
      const x = state.time * state.zoom;
      if (x > tlScroll.scrollLeft + tlScroll.clientWidth - 40) tlScroll.scrollLeft = x - 80;
    }
  }
  if (state.inEditor) {
    rt.layout = computeLayout();
    syncMedia(rt.layout);
    // on slow computers draw at most ~30 times a second while playing
    const minGap = state.exporting ? 0 : lowEnd() ? 32 : 0;
    if ((state.playing || rt.needsDraw || anyVideoActive()) && now - (rt.lastRender || 0) >= minGap) {
      rt.needsDraw = false;
      rt.lastRender = now;
      render();
      drawOverlay();
    }
    if (state.exporting) exportTick();
    if (state.recording && typeof voiceTick === 'function') voiceTick();
  }
  requestAnimationFrame(frame);
}
function anyVideoActive() {
  // keep redrawing while a paused video is still loading its frame
  for (const p of rt.players.values()) if (p.el.seeking) return true;
  return false;
}

/* ============================ START ============================ */
// Called once from boot.js after every part of Flux has loaded.
function initEditor() {
  $('#zoomSlider').value = sliderFromZoom(state.zoom);
  setRangeFill($('#zoomSlider'));
  renderTextPresets();
  renderFilterGrid();
  renderTransitionGrid();
  renderMedia();
  layoutStage();
  refreshAll();
  requestAnimationFrame(frame);
  new ResizeObserver(() => layoutStage()).observe($('#stage'));
}

// expose a little for testing / debugging in DevTools (F12)
window.__flux = {
  get P() { return P; }, state, rt, importFiles, addMediaAt, appendMediaToTimeline, splitAt, seek, play, pause, addText, select,
  runExport, getClip, projectDuration, undo, redo, setAspect, deleteSelected, setTransition, toggleMarker, detachAudio, freezeFrame, saveNow
};
