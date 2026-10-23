/* =====================================================================
   Flux — smart tools:
   auto captions, swear bleeping, remove silences, time machine,
   AI Editor agent, effects grid and drag & drop onto the preview.
   ===================================================================== */
'use strict';

/* ============================ EFFECTS (drag or click) ============================ */
const EFFECTS = [
  { id: 'zoomIn', name: 'Slow zoom in', look: { motion: 'zoomIn' } },
  { id: 'zoomOut', name: 'Slow zoom out', look: { motion: 'zoomOut' } },
  { id: 'panLeft', name: 'Pan left', look: { motion: 'panLeft' } },
  { id: 'panRight', name: 'Pan right', look: { motion: 'panRight' } },
  { id: 'shake', name: 'Shake', look: { motion: 'shake' } },
  { id: 'bgBlur', name: 'Blurred background', look: { bgBlur: true } },
  { id: 'soft', name: 'Soft blur', look: { blur: 4 } },
  { id: 'mirror', name: 'Mirror', look: { flipH: true } },
  { id: 'vignette', name: 'Vignette', look: { vignette: 60 }, pro: true },
  { id: 'grain', name: 'Film grain', look: { grain: 50 }, pro: true },
  { id: 'oldFilm', name: 'Old film', look: { grain: 60, vignette: 50, filter: 'vintage' }, pro: true },
  { id: 'clear', name: 'Remove effects', look: { motion: 'none', bgBlur: false, blur: 0, flipH: false, vignette: 0, grain: 0 } }
];
function applyLook(c, look) {
  if (!c || !isVisual(c)) return toast('Pick a video or photo clip');
  if ((look.vignette || look.grain) && !requirePremium('Film effects')) return;
  commit(() => Object.assign(c, JSON.parse(JSON.stringify(look))));
  select(c.id);
  toast('Applied to ' + clipLabel(c));
}
function renderFxGrid() {
  const box = $('#fxGrid');
  if (!box) return;
  box.innerHTML = '';
  for (const fx of EFFECTS) {
    const b = el('button', 'fx-chip');
    b.innerHTML = `<span class="fx-ico fx-${fx.id}"></span><span class="fx-name"></span>`;
    $('.fx-name', b).textContent = fx.name;
    if (fx.pro) $('.fx-name', b).insertAdjacentHTML('afterbegin', CROWN);
    b.draggable = true;
    b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/flux-effect', JSON.stringify(fx.look)); e.dataTransfer.effectAllowed = 'copy'; });
    b.onclick = () => applyLook(getClip(state.selectedId), fx.look);
    box.appendChild(b);
  }
}

// Drop things straight onto the preview picture
function setupPreviewDrop() {
  const target = $('#canvasWrap');
  target.addEventListener('dragover', (e) => {
    if (!state.inEditor) return;
    if (e.dataTransfer.types.some((x) => /^text\/flux-|^Files$/.test(x))) { e.preventDefault(); e.stopPropagation(); target.classList.add('drop-ok'); $('#dropOverlay').classList.remove('show'); }
  });
  target.addEventListener('dragleave', () => target.classList.remove('drop-ok'));
  target.addEventListener('drop', async (e) => {
    e.preventDefault(); e.stopPropagation();
    target.classList.remove('drop-ok');
    $('#dropOverlay').classList.remove('show');
    dragDepth = 0;
    const r = overlay.getBoundingClientRect();
    const [W, H] = refSize();
    const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
    const hit = rt.hitBoxes.slice().reverse().find((b) => Math.abs(px - b.cx) <= b.w / 2 && Math.abs(py - b.cy) <= b.h / 2);
    const dt = e.dataTransfer;
    const f = dt.getData('text/flux-filter'), fx = dt.getData('text/flux-effect');
    if (f || fx) {
      const c = hit ? getClip(hit.id) : P.clips.find((x) => isVisual(x) && state.time >= x.start && state.time < endOf(x));
      return applyLook(c, f ? { filter: f } : JSON.parse(fx));
    }
    const tx = dt.getData('text/flux-text');
    if (tx) { const props = JSON.parse(tx); props.x = clamp(px / W, 0.05, 0.95); props.y = clamp(py / H, 0.05, 0.95); props.align = 'center'; return addText(props); }
    const tr = dt.getData('text/flux-transition');
    if (tr) { const c = hit && getClip(hit.id); return c ? setTransition(c, tr) : toast('Drop it on a clip'); }
    const mu = dt.getData('text/flux-music');
    if (mu) return dropMusicOnTimeline(JSON.parse(mu), null, state.time);
    const id = dt.getData('text/flux-media');
    const place = (m) => {
      const onMain = !P.clips.some((c) => c.trackId === firstTrack('video').id && state.time >= c.start && state.time < endOf(c));
      const tr2 = m.kind === 'audio' ? firstTrack('audio') : onMain ? firstTrack('video') : (P.tracks.find((t) => t.type === 'video' && t.id !== firstTrack('video').id) || firstTrack('video'));
      return addMediaAt(m, tr2.id, state.time);
    };
    if (id) { const m = getMedia(id); if (m) place(m); return; }
    const files = filesFromDrop(e);
    if (files.length) for (const m of await importFiles(files)) place(m);
  });
}

/* ============================ SPEECH TO TEXT ============================ */
const LANGS = [['auto', 'Detect automatically'], ['english', 'English'], ['romanian', 'Romanian'], ['spanish', 'Spanish'], ['french', 'French'], ['german', 'German'], ['italian', 'Italian'], ['portuguese', 'Portuguese'], ['hungarian', 'Hungarian'], ['russian', 'Russian'], ['turkish', 'Turkish'], ['polish', 'Polish'], ['dutch', 'Dutch']];
const ASR_MODELS = [['tiny', 'Fast', '~40 MB · best for slow computers'], ['base', 'Balanced', '~80 MB'], ['small', 'Most accurate', '~250 MB · slower']];
function soundSource(c) {
  if (!c) return null;
  if (c.kind === 'video' && partners(c).length) return partners(c).find((p) => p.kind === 'audio') || c;
  return hasAudio(c) ? c : null;
}
function pickSoundClip() {
  const sel = soundSource(getClip(state.selectedId));
  if (sel) return sel;
  const all = P.clips.filter((c) => hasAudio(c) && !(c.kind === 'video' && c.muted && !partners(c).length));
  return all.find((c) => clipRole(c) === 'voice') || all.find((c) => c.trackId === 'av') || all[0] || null;
}
// Transcribes the whole file once and remembers the words on the media item.
async function transcribeMedia(m, onProgress) {
  const model = settings.asrModel || (lowEnd() ? 'tiny' : 'base');
  const lang = settings.asrLang || 'auto';
  if (m.words && m.wordsKey === model + '|' + lang) return m.words;
  const fn = api && api.transcribe ? api.transcribe : window.__mockTranscribe;
  if (!fn) throw new Error('Speech recognition works in the Flux desktop app.');
  if (api && api.onTranscribeProgress && !rt.asrHooked) { api.onTranscribeProgress((v) => rt.asrProgress && rt.asrProgress(v)); rt.asrHooked = true; }
  rt.asrProgress = onProgress;
  const r = await fn({ file: m.path, start: 0, end: m.duration || 0, model, language: lang });
  rt.asrProgress = null;
  if (!r || r.error) throw new Error((r && r.error) || 'Speech recognition failed');
  m.words = r.words || [];
  m.wordsKey = model + '|' + lang;
  markDirty();
  return m.words;
}
function wordsInClip(c, words) {
  return words.filter((w) => w.e > c.in && w.s < c.out);
}
function progressModal(title) {
  const box = modal(`<h2></h2><p class="sub" id="pmText">Starting…</p><div class="progress"><div id="pmBar" class="indet"></div></div>`);
  $('h2', box).textContent = title;
  return (v) => {
    const t = $('#pmText'), b = $('#pmBar');
    if (!t) return;
    const msg = { audio: 'Reading the sound…', download: 'Downloading the speech model (first time only)…', listen: 'Listening to the speech… this can take a little while', done: 'Done!' }[v.stage] || '';
    t.textContent = msg + (v.stage === 'download' && v.value ? ' ' + Math.round(v.value * 100) + '%' : '');
    if (v.stage === 'download' && v.value) { b.classList.remove('indet'); b.style.width = Math.round(v.value * 100) + '%'; }
    else if (v.stage === 'listen' || v.stage === 'audio') { b.classList.add('indet'); b.style.width = ''; }
  };
}

/* ============================ AUTO CAPTIONS ============================ */
const CAPTION_STYLES = [
  { id: 'classic', name: 'Classic', t: { font: 'Segoe UI', size: 62, bold: true, color: '#ffffff', bg: true, bgColor: '#000000', bgOpacity: 0.6, shadow: false, outline: false, anim: 'none' } },
  { id: 'bold', name: 'Bold yellow', t: { font: 'Arial Black', size: 78, bold: false, color: '#ffd23f', outline: true, outlineColor: '#000000', shadow: false, bg: false, anim: 'none' } },
  { id: 'clean', name: 'Clean', t: { font: 'Segoe UI', size: 60, bold: true, color: '#ffffff', shadow: true, outline: false, bg: false, anim: 'fade' } },
  { id: 'impact', name: 'Meme', t: { font: 'Impact', size: 90, bold: false, color: '#ffffff', outline: true, outlineColor: '#000000', shadow: false, bg: false, anim: 'none' } },
  { id: 'neon', name: 'Neon', t: { font: 'Segoe UI', size: 70, bold: true, color: '#c9b8ff', glow: true, shadow: false, bg: false, outline: false, anim: 'none' } },
  { id: 'box', name: 'Color box', t: { font: 'Trebuchet MS', size: 60, bold: true, color: '#ffffff', bg: true, bgColor: '#6c4bff', bgOpacity: 0.95, shadow: false, outline: false, anim: 'pop' } },
  { id: 'type', name: 'Typewriter', t: { font: 'Courier New', size: 58, bold: true, color: '#ffffff', bg: true, bgColor: '#000000', bgOpacity: 0.7, shadow: false, outline: false, anim: 'type' } },
  { id: 'karaoke', name: 'Karaoke', pro: true, t: { font: 'Arial Black', size: 74, bold: false, color: '#ffffff', dim: '#ffffff', hl: '#a59cff', outline: true, outlineColor: '#000000', shadow: false, bg: false, karaoke: true, anim: 'none' } },
  { id: 'pop', name: 'Word pop', pro: true, t: { font: 'Impact', size: 120, bold: false, color: '#ffffff', outline: true, outlineColor: '#000000', shadow: true, bg: false, wordByWord: true, anim: 'none' } },
  { id: 'hype', name: 'Hype', pro: true, t: { font: 'Arial Black', size: 84, bold: false, color: '#ffffff', hl: '#4fd6a0', dim: '#ffffff', outline: true, outlineColor: '#111111', shadow: true, bg: false, karaoke: true, anim: 'pop' } }
];
let capOpts = { style: 'classic', font: '', size: 0, pos: 0.82, perLine: 5, upper: false, hl: '#a59cff' };
try { Object.assign(capOpts, JSON.parse(localStorage.getItem('flux.capOpts') || '{}')); } catch {}

function captionTrack() {
  let tr = P.tracks.find((t) => t.type === 'text' && t.name === 'Captions');
  if (!tr) { tr = { id: 'cap' + uid().slice(0, 4), type: 'text', name: 'Captions', hidden: false, muted: false }; P.tracks.unshift(tr); }
  return tr;
}
function captionProps() {
  const st = CAPTION_STYLES.find((s) => s.id === capOpts.style) || CAPTION_STYLES[0];
  const t = Object.assign({}, DEFAULT_TEXT, st.t);
  if (capOpts.font) t.font = capOpts.font;
  if (capOpts.size) t.size = capOpts.size;
  if (t.karaoke) t.hl = capOpts.hl || t.hl;
  t.y = capOpts.pos; t.x = 0.5; t.align = 'center';
  return t;
}
function buildCaptions(src, words) {
  const ws = wordsInClip(src, words).map((w) => ({ ...w, w: capOpts.upper ? w.w.toUpperCase() : w.w }));
  const groups = [];
  let cur = [];
  for (const w of ws) {
    const prev = cur[cur.length - 1];
    const chars = cur.reduce((a, x) => a + x.w.length + 1, 0);
    if (cur.length && (cur.length >= capOpts.perLine || (prev && w.s - prev.e > 0.7) || chars + w.w.length > 34 || /[.!?]$/.test(prev.w))) { groups.push(cur); cur = []; }
    cur.push(w);
  }
  if (cur.length) groups.push(cur);
  const toTl = (s) => src.start + (s - src.in) / src.speed;
  const props = captionProps();
  const out = [];
  groups.forEach((g, i) => {
    const start = Math.max(src.start, toTl(g[0].s));
    let end = Math.min(endOf(src), toTl(g[g.length - 1].e) + 0.15);
    if (i < groups.length - 1) end = Math.min(end, toTl(groups[i + 1][0].s));
    if (end - start < 0.25) end = start + 0.25;
    const t = Object.assign({}, props, {
      content: g.map((w) => w.w).join(' '),
      words: g.map((w) => ({ w: w.w, t0: Math.max(0, toTl(w.s) - start), t1: Math.max(0, toTl(w.e) - start) }))
    });
    out.push({ id: uid(), trackId: null, kind: 'text', start, in: 0, out: end - start, speed: 1, fadeIn: 0, fadeOut: 0, opacity: 1, rotation: 0, scale: 1, text: t, caption: true, capFor: src.linkId || src.id });
  });
  return out;
}
async function runCaptions(src, styleId) {
  if (styleId) capOpts.style = styleId;
  const st = CAPTION_STYLES.find((s) => s.id === capOpts.style);
  if (st && st.pro && !requirePremium(st.name + ' captions')) return false;
  const m = getMedia(src.mediaId);
  const prog = progressModal('Making captions');
  try {
    const words = await transcribeMedia(m, prog);
    const caps = buildCaptions(src, words);
    closeModal();
    if (!caps.length) { toast('No speech was found in that clip'); return false; }
    commit(() => {
      const tr = captionTrack();
      const key = src.linkId || src.id;
      P.clips = P.clips.filter((c) => !(c.caption && c.capFor === key));
      for (const c of caps) { c.trackId = tr.id; P.clips.push(c); }
    });
    toast(`Added ${caps.length} captions - click one to edit its words`);
    return true;
  } catch (e) {
    closeModal();
    toast(e.message || String(e), { error: true, duration: 7000 });
    return false;
  }
}
function restyleCaptions() {
  const props = captionProps();
  commit(() => {
    for (const c of P.clips.filter((x) => x.caption)) {
      const keep = { content: c.text.content, words: c.text.words };
      if (capOpts.upper) { keep.content = keep.content.toUpperCase(); keep.words = (keep.words || []).map((w) => ({ ...w, w: w.w.toUpperCase() })); }
      c.text = Object.assign({}, props, keep);
    }
  });
  toast('Captions restyled');
}

function openCaptionsDialog(clip) {
  const src = soundSource(clip) || pickSoundClip();
  if (!src) return toast('Add a video or voice recording with speech first');
  const hasCaps = P.clips.some((c) => c.caption);
  const box = modal(`
    <h2>Auto captions</h2>
    <p class="sub">Flux listens to <b class="cap-src"></b> and writes the words on screen. It runs on your computer - nothing is uploaded.</p>
    <div class="row"><label>Style</label><div class="cap-grid"></div></div>
    <div class="cap-row">
      <div class="v-field"><label>Font</label><select class="dev-select cap-font"></select></div>
      <div class="v-field"><label>Position</label><div class="seg cap-pos"><button data-v="0.18">Top</button><button data-v="0.5">Middle</button><button data-v="0.82">Bottom</button></div></div>
    </div>
    <div class="cap-opts"></div>
    <div class="cap-row">
      <div class="v-field"><label>Spoken language</label><select class="dev-select cap-lang"></select></div>
      <div class="v-field"><label>Accuracy</label><select class="dev-select cap-model"></select></div>
    </div>
    <div class="footer">${hasCaps ? '<button class="btn ghost" data-a="restyle">Restyle existing captions</button>' : ''}<button class="btn ghost" data-a="cancel">Cancel</button><button class="btn primary" data-a="go">Generate captions</button></div>`, { wide: true });
  $('.cap-src', box).textContent = clipLabel(src);
  const grid = $('.cap-grid', box);
  const drawStyles = () => {
    grid.innerHTML = '';
    for (const st of CAPTION_STYLES) {
      const b = el('button', 'cap-card' + (capOpts.style === st.id ? ' active' : ''));
      const t = st.t;
      const sample = el('span', 'cap-sample');
      if (t.karaoke) sample.innerHTML = `<i style="color:${capOpts.hl || t.hl}">HELLO</i> THERE`;
      else sample.textContent = t.wordByWord ? 'HELLO' : 'Hello there';
      Object.assign(sample.style, {
        fontFamily: `"${capOpts.font || t.font}", sans-serif`, fontWeight: t.bold ? 700 : 400, color: t.color,
        background: t.bg ? hexToRgba(t.bgColor, t.bgOpacity) : 'none', padding: t.bg ? '2px 7px' : 0, borderRadius: '4px',
        textShadow: t.glow ? `0 0 8px ${t.color}` : t.outline ? '-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000' : t.shadow ? '0 2px 4px #000' : 'none'
      });
      b.appendChild(sample);
      const n = el('small');
      n.innerHTML = st.pro ? CROWN : '';
      n.appendChild(document.createTextNode(st.name));
      b.appendChild(n);
      b.onclick = () => { if (st.pro && !requirePremium(st.name + ' captions')) return; capOpts.style = st.id; drawStyles(); };
      grid.appendChild(b);
    }
  };
  drawStyles();
  const fs = $('.cap-font', box);
  fs.innerHTML = '<option value="">Style default</option>' + FONTS.map((f) => `<option>${f}</option>`).join('');
  fs.value = capOpts.font || '';
  fs.onchange = () => { capOpts.font = fs.value; drawStyles(); };
  const syncPos = () => $$('.cap-pos button', box).forEach((b) => b.classList.toggle('active', Math.abs(+b.dataset.v - capOpts.pos) < 0.01));
  $$('.cap-pos button', box).forEach((b) => (b.onclick = () => { capOpts.pos = +b.dataset.v; syncPos(); }));
  syncPos();
  const opts = $('.cap-opts', box);
  slider(opts, 'Words per line', { min: 1, max: 8, get: () => capOpts.perLine, set: (v) => (capOpts.perLine = v), fmt: (v) => v, live: false });
  slider(opts, 'Text size', { min: 0, max: 160, step: 2, get: () => capOpts.size || 0, set: (v) => (capOpts.size = v), fmt: (v) => (v ? v : 'Auto'), live: false });
  const extra = el('div', 'chips');
  extra.innerHTML = `<label class="v-opt"><input type="checkbox" class="cap-up"><span>UPPERCASE</span></label><label class="v-opt"><span>Highlight color</span><input type="color" class="cap-hl"></label>`;
  $('.cap-up', extra).checked = capOpts.upper;
  $('.cap-up', extra).onchange = (e) => (capOpts.upper = e.target.checked);
  $('.cap-hl', extra).value = capOpts.hl;
  $('.cap-hl', extra).oninput = (e) => { capOpts.hl = e.target.value; drawStyles(); };
  opts.appendChild(extra);
  const ls = $('.cap-lang', box);
  ls.innerHTML = LANGS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
  ls.value = settings.asrLang || 'auto';
  ls.onchange = () => { settings.asrLang = ls.value; saveSettings(); };
  const ms = $('.cap-model', box);
  ms.innerHTML = ASR_MODELS.map(([v, n, d]) => `<option value="${v}">${n} (${d})</option>`).join('');
  ms.value = settings.asrModel || (lowEnd() ? 'tiny' : 'base');
  ms.onchange = () => { settings.asrModel = ms.value; saveSettings(); };
  const save = () => { try { localStorage.setItem('flux.capOpts', JSON.stringify(capOpts)); } catch {} };
  $('[data-a=cancel]', box).onclick = closeModal;
  const rs = $('[data-a=restyle]', box);
  if (rs) rs.onclick = () => { save(); closeModal(); restyleCaptions(); };
  $('[data-a=go]', box).onclick = () => { save(); runCaptions(src); };
}

/* ============================ BLEEP SWEAR WORDS ============================ */
// Word stems: a trailing * means "anything starting with this".
const BAD_WORDS = {
  slurs: ['nigger*', 'nigga*', 'faggot*', 'fag', 'fags', 'retard', 'retards', 'retarded', 'chink*', 'spic', 'spics', 'kike*', 'tranny*', 'wetback*', 'coon', 'coons', 'gook*', 'paki', 'pakis', 'poponar*', 'bozgor*'],
  strong: ['fuck*', 'motherfuck*', 'fck*', 'fuk*', 'shit*', 'bullshit*', 'cunt*', 'bitch*', 'asshole*', 'bastard*', 'dick', 'dicks', 'dickhead*', 'cock', 'cocks', 'cocksucker*', 'pussy', 'pussies', 'whore*', 'slut*', 'twat*', 'wanker*', 'prick*',
    'pula', 'pulii', 'pulea', 'pizd*', 'muie*', 'futu*', 'futut*', 'fute', 'curva', 'curvo', 'curvele', 'coaie*', 'labagiu*'],
  mild: ['damn*', 'goddamn*', 'hell', 'crap*', 'ass', 'arse', 'piss*', 'bloody', 'bollock*', 'wtf', 'stfu', 'dumbass*', 'jackass*', 'dracu*', 'naiba', 'cacat*', 'rahat*']
};
const LEVELS = { low: ['slurs'], moderate: ['slurs', 'strong'], high: ['slurs', 'strong', 'mild'] };
function normWord(w) { return w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, ''); }
function isBad(w, level) {
  const n = normWord(w);
  if (!n) return false;
  for (const list of LEVELS[level] || LEVELS.moderate) {
    for (const stem of BAD_WORDS[list]) {
      if (stem.endsWith('*') ? n.startsWith(stem.slice(0, -1)) : n === stem) return true;
    }
  }
  return false;
}
const mask = (w) => w.replace(/[a-zA-ZÀ-ɏ]/g, (ch, i) => (i === 0 ? ch : '*'));

async function runBleep(clip, level, sound) {
  if (!requirePremium('Auto-bleep swearing')) return false;
  const src = soundSource(clip);
  if (!src) return toast('Pick a clip with sound');
  const m = getMedia(src.mediaId);
  const prog = progressModal('Finding swear words');
  try {
    const words = wordsInClip(src, await transcribeMedia(m, prog));
    const bad = words.filter((w) => isBad(w.w, level));
    closeModal();
    commit(() => {
      src.beeps = bad.map((w) => ({ s: Math.max(src.in, w.s - 0.04), e: Math.min(src.out, w.e + 0.04), w: mask(w.w) }));
      src.beepLevel = level;
      src.beepSound = sound || 'beep';
    });
    if (!bad.length) toast('No swear words found at this level');
    else {
      const box = modal(`<h2>Bleeped ${bad.length} word${bad.length === 1 ? '' : 's'}</h2><p class="sub">Press play to hear it. You can change the level or remove the bleeps any time (right-click the clip).</p>
        <div class="bleep-list"></div><div class="footer"><button class="btn primary">OK</button></div>`);
      const list = $('.bleep-list', box);
      for (const b of src.beeps) {
        const r = el('div', 'stat-row');
        r.innerHTML = `<span></span><b></b>`;
        r.firstChild.textContent = b.w;
        r.lastChild.textContent = fmt(src.start + (b.s - src.in) / src.speed);
        list.appendChild(r);
      }
      $('.footer button', box).onclick = closeModal;
    }
    return true;
  } catch (e) {
    closeModal();
    toast(e.message || String(e), { error: true, duration: 7000 });
    return false;
  }
}
function openBleepDialog(clip) {
  if (!requirePremium('Auto-bleep swearing')) return;
  const src = soundSource(clip) || pickSoundClip();
  if (!src) return toast('Pick a clip with sound');
  let level = src.beepLevel || 'moderate', sound = src.beepSound || 'beep';
  const box = modal(`<h2>Bleep swear words</h2><p class="sub">Flux listens to <b class="bl-src"></b> and covers the words you choose.</p>
    <div class="row"><label>How strict?</label><div class="seg tall bl-level">
      <button data-v="low">Low<small>Slurs only</small></button><button data-v="moderate">Moderate<small>+ strong swearing</small></button><button data-v="high">Strict<small>+ mild words</small></button></div></div>
    <div class="row"><label>Cover with</label><div class="seg bl-sound">
      <button data-v="beep">Beep</button><button data-v="low">Low beep</button><button data-v="mute">Silence</button><button data-v="duck">Quieter</button></div></div>
    <div class="footer">${src.beeps && src.beeps.length ? '<button class="btn ghost danger" data-a="remove">Remove bleeps</button>' : ''}<button class="btn ghost" data-a="cancel">Cancel</button><button class="btn primary" data-a="go">Find & bleep</button></div>`);
  $('.bl-src', box).textContent = clipLabel(src);
  const sync = () => {
    $$('.bl-level button', box).forEach((b) => b.classList.toggle('active', b.dataset.v === level));
    $$('.bl-sound button', box).forEach((b) => b.classList.toggle('active', b.dataset.v === sound));
  };
  $$('.bl-level button', box).forEach((b) => (b.onclick = () => { level = b.dataset.v; sync(); }));
  $$('.bl-sound button', box).forEach((b) => (b.onclick = () => { sound = b.dataset.v; sync(); }));
  sync();
  $('[data-a=cancel]', box).onclick = closeModal;
  const rm = $('[data-a=remove]', box);
  if (rm) rm.onclick = () => { closeModal(); commit(() => { src.beeps = []; }); toast('Bleeps removed'); };
  $('[data-a=go]', box).onclick = () => runBleep(src, level, sound);
}

/* ============================ REMOVE SILENCES ============================ */
function removeSilences(clip, { quiet } = {}) {
  if (!requirePremium('Remove silences')) return false;
  const src = soundSource(clip);
  if (!src) { if (!quiet) toast('Pick a clip with sound'); return false; }
  const m = getMedia(src.mediaId), pk = rt.peaksAbs.get(src.mediaId);
  if (!pk || !m || !m.duration) { if (m && !rt.peaks.has(m.id)) loadPeaks(m); if (!quiet) toast('Still analysing the sound - try again in a few seconds'); return false; }
  const bd = m.duration / pk.length;
  const a = Math.floor(src.in / bd), b = Math.min(pk.length, Math.ceil(src.out / bd));
  let mean = 0;
  for (let i = a; i < b; i++) mean += pk[i];
  mean /= Math.max(1, b - a);
  const thr = Math.max(0.012, mean * 0.18), MIN_SIL = 0.6, PAD = 0.12;
  const keep = [];
  let speechStart = null, silentRun = 0;
  for (let i = a; i < b; i++) {
    const t = i * bd;
    if (pk[i] >= thr) { if (speechStart == null) speechStart = Math.max(src.in, t - PAD); silentRun = 0; }
    else if (speechStart != null) {
      silentRun += bd;
      if (silentRun >= MIN_SIL) { keep.push([speechStart, Math.min(src.out, t - silentRun + bd + PAD)]); speechStart = null; silentRun = 0; }
    }
  }
  if (speechStart != null) keep.push([speechStart, src.out]);
  // merge overlaps
  const ranges = [];
  for (const r of keep) { const l = ranges[ranges.length - 1]; if (l && r[0] <= l[1] + 0.05) l[1] = Math.max(l[1], r[1]); else ranges.push(r.slice()); }
  const kept = ranges.reduce((s, r) => s + r[1] - r[0], 0);
  const removed = (src.out - src.in - kept) / src.speed;
  if (!ranges.length || removed < 0.3) { if (!quiet) toast('No long pauses found'); return false; }
  const group = [src, ...partners(src)];
  commit(() => {
    const oldEnd = Math.max(...group.map(endOf));
    for (const c of group) {
      const off = c.in - src.in;
      let cursor = c.start;
      P.clips = P.clips.filter((x) => x.id !== c.id);
      ranges.forEach(([r0, r1], i) => {
        const p = JSON.parse(JSON.stringify(c));
        p.id = uid(); p.in = r0 + off; p.out = r1 + off; p.start = cursor; p.keys = null; p.beeps = (c.beeps || []).filter((x) => x.e > p.in && x.s < p.out);
        if (i > 0) { p.transition = null; p.fadeIn = 0; }
        if (i < ranges.length - 1) p.fadeOut = 0;
        if (c.linkId) p.linkId = c.linkId + '_' + i;
        cursor += (r1 - r0) / c.speed;
        P.clips.push(p);
      });
    }
    const tracks = new Set(group.map((c) => c.trackId));
    for (const o of P.clips) if (tracks.has(o.trackId) && o.start >= oldEnd - 1e-4) o.start -= removed;
    state.selectedId = null;
  });
  const np = Math.max(1, ranges.length - 1);
  toast(`Removed ${np} pause${np === 1 ? '' : 's'} (${removed.toFixed(1)}s shorter)`);
  return true;
}

/* ============================ TIME MACHINE ============================ */
projectStore.versions = api && api.versionsList ? (id) => api.versionsList(id) : async (id) => { try { return JSON.parse(localStorage.getItem('flux.v.' + id) || '[]'); } catch { return []; } };
projectStore.addVersion = api && api.versionsAdd ? (id, v) => api.versionsAdd(id, v) : async (id, v) => {
  try { const l = JSON.parse(localStorage.getItem('flux.v.' + id) || '[]'); l.push(v); localStorage.setItem('flux.v.' + id, JSON.stringify(l.slice(-15))); } catch {}
};
let lastVersion = { id: null, at: 0 };
function maybeSaveVersion(data, thumb) {
  if (!data.clips || !data.clips.length) return;
  if (lastVersion.id === data.id && Date.now() - lastVersion.at < 3 * 60 * 1000) return;
  lastVersion = { id: data.id, at: Date.now() };
  projectStore.addVersion(data.id, { time: Date.now(), data, thumb });
}
function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return Math.max(1, Math.round(s)) + ' s ago';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
async function openTimeMachine() {
  if (!requirePremium('Time machine')) return;
  const startPos = hist.undo.length;
  const total = hist.undo.length + hist.redo.length;
  let pos = startPos;
  const box = modal(`
    <div class="tm-head"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg><div><h2>Time machine</h2>
      <p class="sub" style="margin:0">Drag back through your edits - the preview follows along.</p></div></div>
    <div class="tm-travel">
      <div class="tm-labels"><span>Start of session</span><b class="tm-now"></b><span>Now</span></div>
      <input type="range" class="tm-slider" min="0" max="${total}" step="1">
      <div class="tm-quick"></div>
    </div>
    <div class="help-title">Saved versions</div>
    <div class="tm-versions"><p class="hint">Loading…</p></div>
    <div class="footer"><button class="btn ghost" data-a="cancel">Cancel</button><button class="btn primary" data-a="keep">Keep this version</button></div>`, { wide: true, onClose: () => { while (pos < startPos && hist.redo.length) { redo(); pos++; } while (pos > startPos && hist.undo.length) { undo(); pos--; } } });
  const sl = $('.tm-slider', box);
  sl.value = pos; setRangeFill(sl);
  const label = () => {
    const back = startPos - pos;
    $('.tm-now', box).textContent = pos === total ? 'Latest edit' : back > 0 ? `${back} edit${back === 1 ? '' : 's'} back` + (hist.when[pos] ? ' · ' + ago(hist.when[pos]) : '') : `${-back} edit${back === -1 ? '' : 's'} ahead`;
  };
  const go = (target) => {
    target = clamp(target, 0, total);
    while (pos > target && hist.undo.length) { undo(); pos--; }
    while (pos < target && hist.redo.length) { redo(); pos++; }
    sl.value = pos; setRangeFill(sl); label();
  };
  sl.oninput = () => go(+sl.value);
  label();
  const quick = $('.tm-quick', box);
  for (const [n, txt] of [[5, '5 edits back'], [20, '20 edits back'], [Infinity, 'Start of session']]) {
    const b = el('button', 'chip', txt);
    b.onclick = () => go(n === Infinity ? 0 : startPos - n);
    quick.appendChild(b);
  }
  $('[data-a=cancel]', box).onclick = closeModal;
  $('[data-a=keep]', box).onclick = () => { $('#modalRoot .backdrop')._onClose = null; closeModal(); toast(pos === startPos ? 'Nothing changed' : 'Went back in time - press Ctrl+Y to come forward again'); };
  // older versions saved across sessions
  const vbox = $('.tm-versions', box);
  const versions = (await projectStore.versions(P.id)).slice().reverse();
  vbox.innerHTML = versions.length ? '' : '<p class="hint">Flux saves a version every few minutes while you edit. They’ll show up here.</p>';
  for (const v of versions) {
    const card = el('div', 'tm-ver');
    card.innerHTML = `<div class="tm-thumb">${v.thumb ? `<img src="${v.thumb}">` : ''}</div><div class="tm-info"><b></b><small></small></div><button class="btn ghost">Restore</button>`;
    $('b', card).textContent = ago(v.time);
    $('small', card).textContent = `${(v.data.clips || []).length} clips · ${fmt(v.data.duration || 0, false)}`;
    $('button', card).onclick = () => {
      $('#modalRoot .backdrop')._onClose = null;
      closeModal();
      restoreVersion(v.data);
    };
    vbox.appendChild(card);
  }
}
function restoreVersion(data) {
  commit(() => {
    for (const k of ['tracks', 'clips', 'aspect', 'background', 'markers', 'output']) if (data[k] !== undefined) P[k] = JSON.parse(JSON.stringify(data[k]));
  });
  const missing = (data.media || []).filter((m) => !getMedia(m.id));
  if (missing.length) { P.media.push(...missing.map((m) => ({ ...m }))); Promise.all(missing.map((m) => probeMedia(getMedia(m.id)))).then(refreshAll); }
  layoutStage();
  toast('Restored that version - Ctrl+Z brings back what you had');
}

/* ============================ AI EDITOR ============================ */
const AI_EXAMPLES = ['Add a title “My Trip” at the start', 'Put crossfades between all clips', 'Add happy background music', 'Add captions', 'Remove the silent parts', 'Make it vertical for TikTok', 'Balance all the audio', 'Bleep the swear words'];
const ai = { messages: [], busy: false };
function aiContext() {
  const r = (n) => Math.round(n * 100) / 100;
  return {
    duration: r(projectDuration()), aspect: P.aspect, playhead: r(state.time), selectedClip: state.selectedId,
    tracks: P.tracks.map((t) => ({ id: t.id, type: t.type, name: t.name })),
    clips: P.clips.map((c) => ({
      id: c.id, kind: c.kind, track: c.trackId, start: r(c.start), end: r(endOf(c)),
      name: c.kind === 'text' ? undefined : (getMedia(c.mediaId) || {}).name, text: c.kind === 'text' ? c.text.content : undefined,
      speed: c.speed !== 1 ? c.speed : undefined, volume: c.volume != null && c.volume !== 1 ? r(c.volume) : undefined,
      linkedTo: c.linkId ? partners(c).map((p) => p.id) : undefined, filter: c.filter && c.filter !== 'none' ? c.filter : undefined,
      transition: c.transition ? c.transition.type : undefined, caption: c.caption || undefined
    })),
    library: P.media.map((m) => ({ id: m.id, name: m.name, kind: m.kind, duration: r(m.duration || 0), onTimeline: P.clips.some((c) => c.mediaId === m.id) })),
    markers: (P.markers || []).map((m) => r(m.t))
  };
}
const AI_SYSTEM = `You are the AI editor inside Flux, a simple video editor. The user describes what they want; you answer with ONE JSON object and nothing else:
{"reply": "short friendly message (1-2 sentences) saying what you did or asking a question", "actions": [ ... ]}
Times are in seconds on the timeline. Only use clip ids / media ids that exist in the project JSON. Video clips may be linked to their sound clip (linkedTo); editing one edits both.
Available actions:
{"type":"addText","text":"...","start":0,"duration":3,"style":"title|subtitle|caption|lowerThird|meme|neon|typewriter|highlight","position":"top|middle|bottom"}
{"type":"split","time":12.5,"clipId":"optional"}
{"type":"delete","clipId":"...","closeGap":true}
{"type":"trim","clipId":"...","start":2,"end":9}   (new timeline start/end of that clip, within its media)
{"type":"move","clipId":"...","start":4}
{"type":"speed","clipId":"...","speed":1.5}   (0.1 to 10)
{"type":"volume","clipId":"...","volume":0.8}   (1 = normal, max 3)
{"type":"fade","clipId":"...","in":0.5,"out":1}
{"type":"filter","clipId":"...|all","filter":"none|vivid|warm|cool|bw|noir|vintage|faded|dreamy|drama|pop|sunset"}
{"type":"motion","clipId":"...","motion":"none|zoomIn|zoomOut|panLeft|panRight|panUp|shake"}
{"type":"transition","clipId":"...|all","transition":"${TRANSITIONS.slice(1).map((t) => t.id).join('|')}","duration":0.6}
{"type":"aspect","aspect":"16:9|9:16|1:1|4:5"}
{"type":"marker","time":10}
{"type":"addMedia","mediaId":"...","start":0}   (put a library file on the timeline)
{"type":"music","mood":"happy|calm|epic|dark|funny|action|romantic|mysterious|uplifting|relaxed","start":0}   (adds free background music, trimmed to the video and quieter under speech)
{"type":"captions","clipId":"optional - the clip with speech","style":"classic|bold|clean|impact|neon|box|type|karaoke|pop|hype"}
{"type":"bleep","clipId":"optional","level":"low|moderate|high"}
{"type":"removeSilences","clipId":"..."}
{"type":"autoBalance"}
If the request is unclear, return no actions and ask a short question in "reply". Keep "actions" in the order they should happen.`;

function aiPanelEl() {
  let p = $('#aiPanel');
  if (p) return p;
  p = el('aside');
  p.id = 'aiPanel';
  p.innerHTML = `
    <div class="ai-head"><span class="ai-spark"><svg viewBox="0 0 24 24"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/></svg></span><b>AI Editor</b>${CROWN}<span style="flex:1"></span>
      <button class="icon-btn small" data-a="clear" data-tip="New chat"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg></button>
      <button class="icon-btn small" data-a="close" data-tip="Close"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
    <div class="ai-msgs"></div>
    <div class="ai-examples"></div>
    <div class="ai-input"><textarea placeholder="Tell Flux what to do… e.g. “cut the first 3 seconds and add a title”" rows="2"></textarea><button class="btn primary" data-a="send">Send</button></div>`;
  document.body.appendChild(p);
  $('[data-a=close]', p).onclick = () => p.classList.remove('open');
  $('[data-a=clear]', p).onclick = () => { ai.messages = []; renderAi(); };
  const ta = $('textarea', p);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAi(); } });
  $('[data-a=send]', p).onclick = sendAi;
  const ex = $('.ai-examples', p);
  for (const t of AI_EXAMPLES) { const b = el('button', 'chip', t); b.onclick = () => { ta.value = t; sendAi(); }; ex.appendChild(b); }
  return p;
}
function toggleAiPanel() {
  if (!state.inEditor) return;
  if (!requirePremium('AI Editor')) return;
  const p = aiPanelEl();
  p.classList.toggle('open');
  renderAi();
  if (p.classList.contains('open')) setTimeout(() => $('textarea', p).focus(), 50);
}
function renderAi() {
  const p = aiPanelEl();
  const box = $('.ai-msgs', p);
  box.innerHTML = '';
  $('.ai-examples', p).style.display = ai.messages.length ? 'none' : '';
  if (!ai.messages.length) box.innerHTML = '<div class="ai-hello">Hi! I can edit your video for you. Try one of these, or type anything.</div>';
  for (const m of ai.messages) {
    const d = el('div', 'ai-msg ' + m.role);
    d.textContent = m.display || m.content;
    if (m.done && m.done.length) {
      const ul = el('ul', 'ai-done');
      for (const x of m.done) { const li = el('li'); li.textContent = x; ul.appendChild(li); }
      d.appendChild(ul);
    }
    if (m.undo) { const b = el('button', 'btn ghost ai-undo', 'Undo'); b.onclick = () => { for (let i = 0; i < m.undo; i++) undo(); m.undo = 0; renderAi(); }; d.appendChild(b); }
    box.appendChild(d);
  }
  if (ai.busy) box.appendChild(el('div', 'ai-msg assistant thinking', '<i></i><i></i><i></i>'));
  box.scrollTop = box.scrollHeight;
}
async function sendAi() {
  const p = aiPanelEl();
  const ta = $('textarea', p);
  const text = ta.value.trim();
  if (!text || ai.busy) return;
  ta.value = '';
  ai.messages.push({ role: 'user', content: text });
  ai.busy = true; renderAi();
  const history = ai.messages.slice(-10).map((m) => ({ role: m.role, content: m.role === 'user' ? m.content : (m.raw || m.content) }));
  history[history.length - 1] = { role: 'user', content: `Project right now:\n${JSON.stringify(aiContext())}\n\nRequest: ${text}` };
  try {
    let r;
    if (settings.aiKey && api && api.aiChat) r = await api.aiChat({ key: settings.aiKey, model: settings.aiModel || 'claude-sonnet-5-5', system: AI_SYSTEM, messages: history });
    else {
      const a = settings.account;
      if (!a || !a.token) throw new Error('Please sign in first.');
      r = await apiCall('ai', { system: AI_SYSTEM, messages: history }, a.token);
    }
    if (r.error) throw new Error(r.error);
    let plan;
    try { plan = JSON.parse(r.text.slice(r.text.indexOf('{'), r.text.lastIndexOf('}') + 1)); } catch { plan = { reply: r.text, actions: [] }; }
    const before = hist.undo.length;
    ai.busy = false;
    const done = await runAiActions(plan.actions || []);
    ai.messages.push({ role: 'assistant', content: plan.reply || 'Done.', raw: r.text, done, undo: hist.undo.length - before });
  } catch (e) {
    ai.busy = false;
    ai.messages.push({ role: 'assistant', content: 'Sorry - ' + (e.message || e) });
  }
  renderAi();
}
const STYLE_TO_PRESET = { title: 'Title', subtitle: 'Subtitle', caption: 'Caption', lowerthird: 'Lower third', meme: 'Meme', neon: 'Neon', typewriter: 'Typewriter', highlight: 'Highlight' };
async function runAiActions(actions) {
  const done = [];
  const clipOf = (id) => getClip(id);
  for (const a of actions) {
    try {
      const c = a.clipId && a.clipId !== 'all' ? clipOf(a.clipId) : null;
      switch (a.type) {
        case 'addText': {
          const pre = TEXT_PRESETS.find((x) => x.name === STYLE_TO_PRESET[String(a.style || 'title').toLowerCase().replace(/\s/g, '')]) || TEXT_PRESETS[0];
          const props = Object.assign({}, JSON.parse(JSON.stringify(pre.t)), { content: a.text || 'Title' });
          if (a.position) props.y = { top: 0.15, middle: 0.5, bottom: 0.85 }[a.position] || props.y;
          commit(() => {
            const tc = makeTextClip(0, props);
            tc.out = Math.max(0.5, +a.duration || 3);
            tc.trackId = P.tracks.find((t) => t.type === 'text' && t.name !== 'Captions').id;
            tc.start = findFreeStart(tc.trackId, Math.max(0, +a.start || 0), dur(tc), tc.id);
            P.clips.push(tc);
          });
          done.push(`Added text “${props.content}”`); break;
        }
        case 'split': state.selectedId = c ? c.id : null; splitAt(+a.time); done.push(`Cut at ${fmt(+a.time)}`); break;
        case 'delete': if (!c) break; state.selectedId = c.id; deleteSelected(!!a.closeGap); done.push(`Removed ${clipLabel(c)}`); break;
        case 'trim': {
          if (!c) break;
          commit(() => {
            const m = getMedia(c.mediaId);
            const maxOut = c.kind === 'video' || c.kind === 'audio' ? (m ? m.duration : c.out) : Infinity;
            for (const x of [c, ...partners(c)]) {
              if (a.start != null && +a.start > x.start) { const d = (+a.start - x.start) * x.speed; x.in = Math.min(x.in + d, x.out - MIN_DUR); x.start = +a.start; }
              if (a.end != null) x.out = clamp(x.in + (+a.end - x.start) * x.speed, x.in + MIN_DUR, maxOut);
            }
          });
          done.push(`Trimmed ${clipLabel(c)}`); break;
        }
        case 'move': if (!c) break; commit(() => { const d = Math.max(0, +a.start) - c.start; for (const x of [c, ...partners(c)]) x.start = Math.max(0, x.start + d); }); done.push(`Moved ${clipLabel(c)}`); break;
        case 'speed': if (!c) break; commit(() => setSpeed(c, clamp(+a.speed || 1, 0.1, 10))); done.push(`Speed ${a.speed}x on ${clipLabel(c)}`); break;
        case 'volume': if (!c) break; commit(() => { const t = soundSource(c) || c; t.volume = clamp(+a.volume, 0, 3); }); done.push(`Volume ${Math.round(a.volume * 100)}%`); break;
        case 'fade': if (!c) break; commit(() => { for (const x of [c, ...partners(c)]) { if (a.in != null) x.fadeIn = +a.in; if (a.out != null) x.fadeOut = +a.out; } }); done.push('Added fades'); break;
        case 'filter': commit(() => { for (const x of a.clipId === 'all' ? P.clips.filter(isVisual) : [c].filter(Boolean)) x.filter = a.filter; }); done.push(`Look: ${filterById(a.filter).name}`); break;
        case 'motion': if (c) { commit(() => { c.motion = a.motion; }); done.push(`Motion: ${a.motion}`); } break;
        case 'transition':
          if (a.clipId === 'all') applyTransitionToAll(a.transition);
          else if (c) setTransition(c, a.transition, +a.duration || undefined);
          done.push(`Transition: ${transById(a.transition).name}`); break;
        case 'aspect': setAspect(a.aspect); done.push(`Shape: ${a.aspect}`); break;
        case 'marker': commit(() => { P.markers.push({ id: uid(), t: +a.time, color: '#ffd23f' }); P.markers.sort((x, y) => x.t - y.t); }); done.push(`Marker at ${fmt(+a.time)}`); break;
        case 'addMedia': { const m = getMedia(a.mediaId); if (m) { addMediaAt(m, null, +a.start || 0); done.push(`Added ${m.name}`); } break; }
        case 'music': { const t = await aiAddMusic(a.mood, +a.start || 0); if (t) done.push(`Music: “${t}”`); break; }
        case 'captions': { const src = soundSource(c) || pickSoundClip(); if (src && await runCaptions(src, a.style)) done.push('Added captions'); break; }
        case 'bleep': { const src = soundSource(c) || pickSoundClip(); if (src && await runBleep(src, a.level || 'moderate', 'beep')) done.push('Bleeped swear words'); break; }
        case 'removeSilences': if (removeSilences(c || pickSoundClip(), { quiet: true })) done.push('Removed silences'); break;
        case 'autoBalance': autoBalanceAll(); done.push('Balanced the sound'); break;
      }
    } catch (e) { console.warn('AI action failed', a, e); }
  }
  return done;
}
async function aiAddMusic(mood, start) {
  if (!music.catalog) await loadKM();
  if (!music.catalog || !music.catalog.length) return null;
  const md = String(mood || 'happy').toLowerCase();
  const pool = music.catalog.filter((t) => t.feel.some((f) => f.toLowerCase().includes(md))) .concat(music.catalog);
  const t = pool[Math.floor(Math.random() * Math.min(8, pool.length))];
  const before = new Set(P.clips.map((c) => c.id));
  await addTrackToTimeline(t, null, null, start);
  const added = P.clips.find((c) => !before.has(c.id) && c.kind === 'audio');
  const videoEnd = Math.max(0, ...P.clips.filter((c) => c.kind !== 'audio' && c.kind !== 'text').map(endOf));
  if (added && videoEnd > added.start) {
    commit(() => {
      added.out = Math.min(added.out, added.in + (videoEnd - added.start) * added.speed);
      added.fadeOut = 2; added.fadeIn = 0.5; added.volume = 0.6;
      added.audio = Object.assign({ pan: 0, bass: 0, mid: 0, treble: 0 }, added.audio || {}, { duck: true });
    });
  }
  return t.title;
}

/* ============================ HOOKUP ============================ */
function setupSmartTools() {
  renderFxGrid();
  setupPreviewDrop();
  $('#btnCaptions').onclick = () => openCaptionsDialog(getClip(state.selectedId));
  $('#btnAI').onclick = toggleAiPanel;
  $('#btnTimeMachine').onclick = openTimeMachine;
  $('#btnPremium .crown-slot').innerHTML = CROWN;
}
