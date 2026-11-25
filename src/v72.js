'use strict';
/* Flux 7.2.x (shown as 1.7.3): template review from the admin panel, Professional Audio Mixer,
   Thumbnail Studio, Golden Hour (Premium) and limited Christmas themes. */
const mixDbGain = (db) => (db <= -60 ? 0 : Math.pow(10, db / 20));
const esc72 = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ============================ template review (owner) ============================ */
function placeholderPng(W, H, i, secs) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), hue = (i * 47 + 210) % 360;
  const g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, `hsl(${hue} 70% 46%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360} 75% 28%)`);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,.08)';
  for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(W * ((k * 0.37 + i * 0.13) % 1), H * ((k * 0.61 + 0.2) % 1), Math.min(W, H) * (0.08 + (k % 3) * 0.05), 0, 7); x.fill(); }
  const s = Math.min(W, H);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `800 ${Math.round(s * 0.16)}px "Segoe UI", sans-serif`; x.fillText('Clip ' + (i + 1), W / 2, H / 2 - s * 0.04);
  x.font = `600 ${Math.round(s * 0.06)}px "Segoe UI", sans-serif`; x.globalAlpha = 0.85; x.fillText(secs + ' seconds', W / 2, H / 2 + s * 0.1);
  return c.toDataURL('image/png');
}
async function reviewTemplate(tp) {
  if (state.exporting) return toast('Wait for the export to finish first', { error: true });
  if (!tp || !Array.isArray(tp.slots) || !tp.slots.length) return toast('That template is empty', { error: true });
  const t = { ...tp, name: 'Review · ' + (tp.name || 'Template'), motion: Array.isArray(tp.motion) && tp.motion.length ? tp.motion : ['none'], texts: Array.isArray(tp.texts) ? tp.texts : [] };
  await createFromTemplate(t);
  const [W, H] = refSize(), k = 960 / Math.max(W, H);
  const urls = t.slots.map((d, i) => placeholderPng(Math.round(W * k), Math.round(H * k), i, Math.round(d * 10) / 10));
  const paths = api && api.templatePlaceholders ? await api.templatePlaceholders(urls) : [];
  if (!paths.length) return;
  const ms = await importFiles(paths.map((p, i) => ({ path: p, name: `Clip ${i + 1}.png` })));
  for (let n = 0; n < 60 && (ms || []).some((m) => m.loading); n++) await new Promise((r) => setTimeout(r, 150));
  fillTemplate();
  seek(0);
  toast('Template preview - press Play. The coloured cards stand in for the clips.', { duration: 7000 });
}
if (typeof api !== 'undefined' && api && api.onTemplateReview) api.onTemplateReview((tp) => { reviewTemplate(tp).catch((e) => toast('Couldn’t open the template: ' + e.message, { error: true })); });

/* ============================ Professional Audio Mixer ============================ */
const MIX_DEF = { vol: 0, pan: 0, low: 0, mid: 0, high: 0, mute: false, solo: false };
// the mix lives on the tracks (track.mix) and the master on P.output.mix, so it's saved and undoable like everything else
function mixT(id) { if (typeof P === 'undefined' || !P || !P.tracks) return null; const t = P.tracks.find((x) => x.id === id); return (t && t.mix) || null; }
function mixAnySolo() { return !!(P && P.tracks && P.tracks.some((t) => t.mix && t.mix.solo)); }
function mixTrackGain(id) {
  if (!P || !P.tracks) return 1;
  const m = mixT(id);
  if (mixAnySolo() && !(m && m.solo)) return 0;
  if (!m) return 1;
  return m.mute ? 0 : mixDbGain(m.vol || 0);
}
function mixPan(id) { const m = mixT(id); return m ? m.pan || 0 : 0; }
function mixEq(id) { const m = mixT(id); return m && (m.low || m.mid || m.high) ? { low: m.low || 0, mid: m.mid || 0, high: m.high || 0 } : null; }
function mixMaster() { return (P && P.output && P.output.mix) || null; }
// export: master level → glue compressor → limiter
function mixMasterChain(ctx) {
  const ms = mixMaster();
  if (!ms) return ctx.destination;
  const g = ctx.createGain(); g.gain.value = mixDbGain(ms.vol || 0);
  let last = g;
  if (ms.glue) { const c = ctx.createDynamicsCompressor(); c.threshold.value = -20; c.knee.value = 8; c.ratio.value = 3; c.attack.value = 0.01; c.release.value = 0.22; last.connect(c); last = c; }
  if (ms.limit !== false) { const l = ctx.createDynamicsCompressor(); l.threshold.value = -1.5; l.knee.value = 0; l.ratio.value = 20; l.attack.value = 0.002; l.release.value = 0.08; last.connect(l); last = l; }
  last.connect(ctx.destination);
  return g;
}
// live playback: the track fader on every player (one frame behind is fine)
const _setGain72 = setGain;
setGain = function (p, g) { _setGain72(p, g * (p && p._tr != null ? mixTrackGain(p._tr) : 1)); };
const _applyAudioFx72 = applyAudioFx;
applyAudioFx = function (p, c) {
  const before = p._tr;
  p._tr = c.trackId;
  _applyAudioFx72(p, c);
  if (before !== c.trackId && p.gain && p.gain.gain) p.gain.gain.value *= mixTrackGain(c.trackId);
  if (!p.pan) return;
  const a = c.audio || {}, pro = isPremium();
  const pan = clamp((a.pan || 0) + mixPan(c.trackId), -1, 1);
  if (Math.abs(p.pan.pan.value - pan) > 1e-4) p.pan.pan.value = pan;
  const q = mixEq(c.trackId);
  if (q) {
    p.low.gain.value = (pro ? a.bass || 0 : 0) + q.low;
    p.mid.gain.value = (pro ? a.mid || 0 : 0) + q.mid;
    p.high.gain.value = (pro ? a.treble || 0 : 0) + q.high;
  }
  // a meter tap for the mixer
  if (!p.mixAn && actx && p.high) { try { p.mixAn = actx.createAnalyser(); p.mixAn.fftSize = 1024; p.high.connect(p.mixAn); } catch {} }
};
// live master: level, glue, limiter and a meter, between Flux's sound and the speakers / recorder
let mixLive = null;
function mixLiveChain() {
  if (mixLive || !actx || !masterGain) return mixLive;
  try {
    const g = actx.createGain(), glue = actx.createDynamicsCompressor(), lim = actx.createDynamicsCompressor(), an = actx.createAnalyser();
    an.fftSize = 2048;
    const sp = actx.createChannelSplitter(2), anL = actx.createAnalyser(), anR = actx.createAnalyser(); anL.fftSize = anR.fftSize = 1024;
    masterGain.disconnect();
    masterGain.connect(g); g.connect(glue); glue.connect(lim); lim.connect(an);
    lim.connect(monitorGain); if (exportDest) lim.connect(exportDest);
    lim.connect(sp); sp.connect(anL, 0); sp.connect(anR, 1);
    mixLive = { g, glue, lim, an, anL, anR };
    mixLiveUpdate();
  } catch (e) { console.warn('mixer', e); }
  return mixLive;
}
function mixLiveUpdate() {
  if (!mixLive) return;
  const ms = mixMaster(), on = !!ms;
  mixLive.g.gain.value = on ? mixDbGain(ms.vol || 0) : 1;
  const glue = on && ms.glue, lim = on && ms.limit !== false;
  Object.assign(mixLive.glue, {}); mixLive.glue.threshold.value = glue ? -20 : 0; mixLive.glue.ratio.value = glue ? 3 : 1; mixLive.glue.knee.value = 8; mixLive.glue.attack.value = 0.01; mixLive.glue.release.value = 0.22;
  mixLive.lim.threshold.value = lim ? -1.5 : 0; mixLive.lim.ratio.value = lim ? 20 : 1; mixLive.lim.knee.value = 0; mixLive.lim.attack.value = 0.002; mixLive.lim.release.value = 0.08;
}
const _ensureAudio72 = ensureAudio;
ensureAudio = function () { _ensureAudio72(); mixLiveChain(); mixLiveUpdate(); };

function levelOf(an) {
  if (!an) return 0;
  const buf = mixLevelBuf.length === an.fftSize ? mixLevelBuf : (mixLevelBuf = new Float32Array(an.fftSize));
  an.getFloatTimeDomainData(buf);
  let pk = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > pk) pk = v; }
  return pk;
}
let mixLevelBuf = new Float32Array(1024);
const toDb = (v) => (v <= 0.00001 ? -100 : 20 * Math.log10(v));
const meterPct = (db) => Math.max(0, Math.min(100, ((db + 60) / 66) * 100));

let mixerEl = null, mixRaf = 0, mixPeaks = {};
function mixTracks() { return P.tracks.filter((t) => t.type === 'audio' || P.clips.some((c) => c.trackId === t.id && (c.kind === 'video' || c.kind === 'audio'))); }
function mixObj(id) {
  if (id === 'master') { if (!P.output || typeof P.output !== 'object') P.output = { ...(P.output || {}) }; return (P.output.mix = P.output.mix || { vol: 0, glue: false, limit: true }); }
  const t = P.tracks.find((x) => x.id === id); if (!t) return { ...MIX_DEF };
  return (t.mix = { ...MIX_DEF, ...(t.mix || {}) });
}
function openMixer() {
  if (!P) return;
  if (mixerEl) { closeMixer(); return; }
  ensureAudio();
  mixerEl = el('div', 'mixer');
  mixerEl.innerHTML = `<div class="mx-head"><svg viewBox="0 0 24 24"><path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="13" width="4" height="3" rx="1"/><rect x="10" y="7" width="4" height="3" rx="1"/><rect x="16" y="11" width="4" height="3" rx="1"/></svg><b>Audio Mixer</b><span class="mx-hint">Changes are used in the export too</span><button class="icon-btn small mx-reset" data-tip="Reset the whole mix"><svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg></button><button class="icon-btn small mx-x" data-tip="Close (X)"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="mx-body"></div>`;
  document.body.appendChild(mixerEl);
  $('.mx-x', mixerEl).onclick = closeMixer;
  $('.mx-reset', mixerEl).onclick = () => { commit(() => { for (const t of P.tracks) delete t.mix; if (P.output) delete P.output.mix; }); mixLiveUpdate(); renderMixer(); toast('Mix reset'); };
  // drag the panel by its title
  const head = $('.mx-head', mixerEl);
  head.onpointerdown = (e) => {
    if (e.target.closest('button')) return;
    const r = mixerEl.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    const mv = (ev) => { mixerEl.style.left = clamp(ev.clientX - ox, 0, innerWidth - 120) + 'px'; mixerEl.style.top = clamp(ev.clientY - oy, 0, innerHeight - 60) + 'px'; mixerEl.style.right = 'auto'; mixerEl.style.bottom = 'auto'; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
  renderMixer();
  const loop = () => { if (!mixerEl) return; drawMeters(); mixRaf = requestAnimationFrame(loop); };
  mixRaf = requestAnimationFrame(loop);
  bump('mixerOpened');
}
function closeMixer() { cancelAnimationFrame(mixRaf); if (mixerEl) mixerEl.remove(); mixerEl = null; }
function stripHtml(id, name, m, master) {
  const v = m.vol || 0;
  return `<div class="mx-strip${master ? ' master' : ''}" data-id="${esc72(id)}">
    <div class="mx-name" title="${esc72(name)}">${esc72(name)}</div>
    ${master ? `<div class="mx-row"><button class="mx-tog${m.glue ? ' on' : ''}" data-k="glue" data-tip="Glue: a gentle compressor that makes everything sit together">Glue</button><button class="mx-tog${m.limit !== false ? ' on' : ''}" data-k="limit" data-tip="Limiter: stops the sound from ever clipping (distorting)">Limit</button></div>`
      : `<div class="mx-row"><button class="mx-tog m${m.mute ? ' on' : ''}" data-k="mute" data-tip="Mute">M</button><button class="mx-tog s${m.solo ? ' on' : ''}" data-k="solo" data-tip="Solo: only hear this track">S</button></div>
    <div class="mx-eq">${[['high', 'Hi'], ['mid', 'Mid'], ['low', 'Lo']].map(([k, n]) => `<label><span>${n}</span><input type="range" min="-12" max="12" step="0.5" value="${m[k] || 0}" data-k="${k}"><em>${(m[k] || 0) > 0 ? '+' : ''}${m[k] || 0}</em></label>`).join('')}</div>
    <label class="mx-pan"><span>Pan</span><input type="range" min="-1" max="1" step="0.02" value="${m.pan || 0}" data-k="pan"><em>${panTxt(m.pan || 0)}</em></label>`}
    <div class="mx-fader"><div class="mx-meter"><i class="l"></i>${master ? '<i class="r"></i>' : ''}<b class="pk"></b></div><input type="range" class="vert" min="-60" max="12" step="0.5" value="${v}" data-k="vol"><div class="mx-scale"><span>+12</span><span>0</span><span>-12</span><span>-30</span><span>-∞</span></div></div>
    <div class="mx-db">${v <= -60 ? '-∞' : (v > 0 ? '+' : '') + v.toFixed(1)} dB</div>
  </div>`;
}
const panTxt = (p) => (Math.abs(p) < 0.02 ? 'C' : (p < 0 ? 'L' : 'R') + Math.round(Math.abs(p) * 100));
function renderMixer() {
  if (!mixerEl || !P) return;
  const body = $('.mx-body', mixerEl);
  const tracks = mixTracks();
  body.innerHTML = (tracks.length ? tracks.map((t) => stripHtml(t.id, t.name, { ...MIX_DEF, ...(t.mix || {}) }, false)).join('') : '<p class="mx-empty">Add a video or sound to see its track here.</p>') + stripHtml('master', 'Master', { vol: 0, glue: false, limit: true, ...(mixMaster() || {}) }, true);
  body.onpointerdown = (e) => { if (e.target.matches('input[type=range]')) beginEdit(); };
  body.oninput = (e) => {
    const i = e.target; if (!i.dataset.k) return;
    const strip = i.closest('.mx-strip'), id = strip.dataset.id, v = +i.value;
    const obj = mixObj(id);
    obj[i.dataset.k] = v;
    if (i.dataset.k === 'vol') $('.mx-db', strip).textContent = (v <= -60 ? '-∞' : (v > 0 ? '+' : '') + v.toFixed(1)) + ' dB';
    else if (i.dataset.k === 'pan') i.nextElementSibling.textContent = panTxt(v);
    else i.nextElementSibling.textContent = (v > 0 ? '+' : '') + v;
    mixLiveUpdate(); requestDraw();
  };
  body.onchange = (e) => { if (e.target.matches('input[type=range]')) endEdit(); };
  body.ondblclick = (e) => {
    const i = e.target.closest('input[type=range]'); if (!i) return;
    beginEdit(); i.value = i.dataset.k === 'vol' || i.dataset.k === 'pan' ? 0 : 0; i.dispatchEvent(new Event('input', { bubbles: true })); endEdit();
  };
  body.onclick = (e) => {
    const b = e.target.closest('.mx-tog'); if (!b) return;
    const id = b.closest('.mx-strip').dataset.id, k = b.dataset.k;
    commit(() => { const obj = mixObj(id); obj[k] = k === 'limit' ? obj.limit === false : !obj[k]; });
    mixLiveUpdate(); renderMixer();
  };
}
function drawMeters() {
  if (!mixerEl) return;
  const now = performance.now();
  for (const strip of mixerEl.querySelectorAll('.mx-strip')) {
    const id = strip.dataset.id;
    let lv = 0, lvR = 0;
    if (id === 'master') { if (mixLive) { lv = levelOf(mixLive.anL); lvR = levelOf(mixLive.anR); } }
    else for (const p of rt.players.values()) if (p._tr === id && p.mixAn && !p.el.paused) lv = Math.max(lv, levelOf(p.mixAn));
    const db = toDb(lv), dbR = toDb(lvR);
    const L = strip.querySelector('.mx-meter .l'), R = strip.querySelector('.mx-meter .r'), pk = strip.querySelector('.pk');
    L.style.height = meterPct(db) + '%'; if (R) R.style.height = meterPct(dbR) + '%';
    const top = Math.max(db, id === 'master' ? dbR : -100), hold = mixPeaks[id] || { db: -100, at: 0 };
    if (top >= hold.db || now - hold.at > 1400) mixPeaks[id] = { db: top, at: now };
    const h = mixPeaks[id].db;
    pk.style.bottom = meterPct(h) + '%'; pk.classList.toggle('clip', h > -0.5); pk.style.opacity = h > -59 ? 1 : 0;
  }
}
const _refreshAll72 = refreshAll;
refreshAll = function () { _refreshAll72.apply(this, arguments); if (mixerEl && !document.activeElement?.closest?.('.mixer')) renderMixer(); mixLiveUpdate(); };

/* ============================ Thumbnail Studio ============================ */
const TS_SIZES = { yt: [1280, 720, 'YouTube'], short: [1080, 1920, 'Shorts / TikTok'], square: [1080, 1080, 'Square'] };
const TS_FONTS = ['Impact', 'Arial Black', 'Segoe UI', 'Georgia', 'Trebuchet MS', 'Comic Sans MS', 'Courier New'];
const TS_STICKERS = ['🔥', '😱', '🤯', '😂', '💰', '👀', '✅', '❌', '⚠️', '💯', '🏆', '❤️', '⭐', '👉', '🎮', '🚀'];
const TS_PRESETS = {
  shock: { name: 'Shock', adj: { bright: 4, contrast: 18, sat: 30, vignette: 0.45, darken: 0 }, layers: [
    { type: 'text', text: 'I CAN’T BELIEVE IT', x: 0.47, y: 0.8, size: 108, font: 'Impact', color: '#ffe14d', stroke: '#000000', strokeW: 10, glow: 0, rot: -3 },
    { type: 'shape', shape: 'arrow', x: 0.74, y: 0.42, w: 0.22, h: 0.16, color: '#ff2d2d', rot: -25 },
    { type: 'sticker', text: '😱', x: 0.88, y: 0.2, size: 170, rot: 8 }] },
  tutorial: { name: 'Tutorial', adj: { bright: 6, contrast: 6, sat: 6, vignette: 0.15, darken: 0 }, layers: [
    { type: 'text', text: 'HOW TO DO IT', x: 0.3, y: 0.2, size: 96, font: 'Arial Black', color: '#ffffff', stroke: '#000000', strokeW: 0, glow: 0, rot: 0, box: '#2b6dff' },
    { type: 'text', text: 'in 5 minutes', x: 0.26, y: 0.36, size: 64, font: 'Segoe UI', color: '#ffffff', stroke: '#000000', strokeW: 6, glow: 0, rot: 0 }] },
  gaming: { name: 'Gaming', adj: { bright: 0, contrast: 22, sat: 40, vignette: 0.5, darken: 0.1 }, layers: [
    { type: 'text', text: 'INSANE CLUTCH', x: 0.5, y: 0.82, size: 130, font: 'Impact', color: '#ffffff', stroke: '#7a2cff', strokeW: 12, glow: 28, rot: -4 },
    { type: 'shape', shape: 'circle', x: 0.62, y: 0.42, w: 0.2, h: 0.32, color: '#ff2d2d', rot: 0 }] },
  vlog: { name: 'Vlog', adj: { bright: 8, contrast: 4, sat: 14, vignette: 0.2, darken: 0 }, layers: [
    { type: 'text', text: 'a day in my life', x: 0.5, y: 0.84, size: 96, font: 'Georgia', color: '#ffffff', stroke: '#000000', strokeW: 0, glow: 18, rot: 0 }] },
  clean: { name: 'Clean', adj: { bright: 0, contrast: 0, sat: 0, vignette: 0, darken: 0.25 }, layers: [
    { type: 'text', text: 'YOUR TITLE', x: 0.5, y: 0.5, size: 110, font: 'Segoe UI', color: '#ffffff', stroke: '#000000', strokeW: 0, glow: 0, rot: 0 }] }
};
let TS = null;
function openThumbnailStudio() {
  if (!P) return;
  if (state.playing && typeof togglePlay === 'function') togglePlay();
  const D = projectDuration();
  TS = { size: P.aspect === '9:16' ? 'short' : P.aspect === '1:1' ? 'square' : 'yt', bgCanvas: null, bgImg: null, bgMode: D ? 'frame' : 'gradient', grad: 0, time: clamp(state.time || 0, 0, Math.max(0, D - 0.05)),
    adj: { ...TS_PRESETS.shock.adj }, layers: JSON.parse(JSON.stringify(TS_PRESETS.shock.layers)), sel: 0, drag: null };
  const box = modal(`<div class="ts"><div class="ts-stage"><canvas class="ts-cv"></canvas><div class="ts-bar">
      <div class="seg ts-size">${Object.entries(TS_SIZES).map(([k, v]) => `<button data-v="${k}">${v[2]}<small>${v[0]}×${v[1]}</small></button>`).join('')}</div>
      <span class="ts-tip">Drag things to move them · Delete removes the selected one</span></div></div>
    <div class="ts-side">
      <h2>Thumbnail Studio</h2>
      <div class="ts-sec"><div class="set-h4">Background</div>
        <div class="chips small ts-bgm"><button class="chip" data-v="frame">Video frame</button><button class="chip" data-v="image">Picture</button><button class="chip" data-v="gradient">Colors</button></div>
        <div class="ts-frame"><input type="range" class="ts-time" min="0" max="${Math.max(0.1, D)}" step="0.04" value="${TS.time}"><small class="ts-tl">${fmtShort(TS.time)}</small></div>
        <div class="ts-grads" hidden></div>
      </div>
      <div class="ts-sec"><div class="set-h4">Style</div><div class="chips small ts-presets">${Object.entries(TS_PRESETS).map(([k, v]) => `<button class="chip" data-v="${k}">${v.name}</button>`).join('')}</div></div>
      <div class="ts-sec"><div class="set-h4">Make it pop</div><div class="ts-adj">${[['bright', 'Brightness', -40, 40], ['contrast', 'Contrast', -40, 60], ['sat', 'Color', -60, 80], ['vignette', 'Dark edges', 0, 1], ['darken', 'Darken', 0, 0.8]].map(([k, n, a, b]) => `<label><span>${n}</span><input type="range" data-a="${k}" min="${a}" max="${b}" step="${b <= 1 ? 0.01 : 1}"></label>`).join('')}</div></div>
      <div class="ts-sec"><div class="set-h4">Add</div><div class="ts-add"><button class="btn small" data-add="text">+ Text</button><button class="btn small" data-add="arrow">+ Arrow</button><button class="btn small" data-add="circle">+ Circle</button><button class="btn small" data-add="box">+ Box</button></div>
        <div class="ts-stickers">${TS_STICKERS.map((s) => `<button data-st="${s}">${s}</button>`).join('')}</div></div>
      <div class="ts-sec ts-props"></div>
      <div class="footer"><button class="btn ghost" data-a="close">Close</button><button class="btn primary" data-a="save">Save thumbnail</button></div>
    </div></div>`, { wide: true });
  box.classList.add('ts-modal');
  const cv = $('.ts-cv', box);
  const sync = () => {
    $$('.ts-size button', box).forEach((b) => b.classList.toggle('active', b.dataset.v === TS.size));
    $$('.ts-bgm .chip', box).forEach((b) => b.classList.toggle('active', b.dataset.v === TS.bgMode));
    $('.ts-frame', box).hidden = TS.bgMode !== 'frame'; $('.ts-grads', box).hidden = TS.bgMode !== 'gradient';
    $$('.ts-adj input', box).forEach((i) => { i.value = TS.adj[i.dataset.a]; });
    tsProps(box); tsDraw(cv);
  };
  TS.sync = sync;
  $('.ts-grads', box).innerHTML = TS_GRADS.map((g, i) => `<button data-g="${i}" style="background:linear-gradient(135deg,${g[0]},${g[1]})"></button>`).join('');
  $('.ts-grads', box).onclick = (e) => { const b = e.target.closest('[data-g]'); if (b) { TS.grad = +b.dataset.g; tsDraw(cv); } };
  $('.ts-size', box).onclick = (e) => { const b = e.target.closest('button'); if (b) { TS.size = b.dataset.v; tsGrab(cv).then(sync); } };
  $('.ts-bgm', box).onclick = (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    if (b.dataset.v === 'image') {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
      inp.onchange = () => { const f = inp.files[0]; if (!f) return; const im = new Image(); im.onload = () => { TS.bgImg = im; TS.bgMode = 'image'; sync(); }; im.src = URL.createObjectURL(f); };
      inp.click(); return;
    }
    TS.bgMode = b.dataset.v; if (TS.bgMode === 'frame') tsGrab(cv).then(sync); else sync();
  };
  let tmr = 0;
  $('.ts-time', box).oninput = (e) => { TS.time = +e.target.value; $('.ts-tl', box).textContent = fmtShort(TS.time); clearTimeout(tmr); tmr = setTimeout(() => tsGrab(cv).then(() => tsDraw(cv)), 120); };
  $('.ts-presets', box).onclick = (e) => { const b = e.target.closest('.chip'); if (!b) return; const pr = TS_PRESETS[b.dataset.v]; TS.adj = { ...pr.adj }; TS.layers = JSON.parse(JSON.stringify(pr.layers)); TS.sel = 0; sync(); };
  $('.ts-adj', box).oninput = (e) => { const i = e.target; TS.adj[i.dataset.a] = +i.value; tsDraw(cv); };
  $('.ts-add', box).onclick = (e) => {
    const b = e.target.closest('[data-add]'); if (!b) return;
    const k = b.dataset.add;
    TS.layers.push(k === 'text' ? { type: 'text', text: 'NEW TEXT', x: 0.5, y: 0.5, size: 100, font: 'Impact', color: '#ffffff', stroke: '#000000', strokeW: 8, glow: 0, rot: 0 }
      : { type: 'shape', shape: k, x: 0.5, y: 0.5, w: k === 'arrow' ? 0.22 : 0.2, h: k === 'arrow' ? 0.16 : 0.3, color: k === 'box' ? '#ffe14d' : '#ff2d2d', rot: 0 });
    TS.sel = TS.layers.length - 1; sync();
  };
  $('.ts-stickers', box).onclick = (e) => { const b = e.target.closest('[data-st]'); if (!b) return; TS.layers.push({ type: 'sticker', text: b.dataset.st, x: 0.5, y: 0.5, size: 160, rot: 0 }); TS.sel = TS.layers.length - 1; sync(); };
  // move things by dragging them
  cv.onpointerdown = (e) => {
    const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    let hit = -1;
    for (let i = TS.layers.length - 1; i >= 0; i--) { const bb = TS.layers[i]._bb; if (bb && px >= bb[0] && px <= bb[2] && py >= bb[1] && py <= bb[3]) { hit = i; break; } }
    TS.sel = hit; tsProps(box); tsDraw(cv);
    if (hit < 0) return;
    const L = TS.layers[hit], ox = px - L.x, oy = py - L.y;
    cv.setPointerCapture(e.pointerId);
    cv.onpointermove = (ev) => { L.x = clamp((ev.clientX - r.left) / r.width - ox, -0.2, 1.2); L.y = clamp((ev.clientY - r.top) / r.height - oy, -0.2, 1.2); tsDraw(cv); };
    cv.onpointerup = () => { cv.onpointermove = null; };
  };
  const key = (e) => { if (!document.body.contains(box)) { removeEventListener('keydown', key, true); return; } if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.matches('input, textarea') && TS.sel >= 0) { TS.layers.splice(TS.sel, 1); TS.sel = -1; sync(); e.preventDefault(); e.stopPropagation(); } };
  addEventListener('keydown', key, true);
  $('[data-a=close]', box).onclick = closeModal;
  $('[data-a=save]', box).onclick = async () => {
    TS.sel = -1; tsDraw(cv);
    const png = cv.toDataURL('image/png'), jpg = cv.toDataURL('image/jpeg', 0.92);
    const name = (P.name || 'Thumbnail').replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 60) + ' thumbnail';
    if (api && api.saveThumbnail) { const p = await api.saveThumbnail({ png, jpg, name }); if (p) { toast('Thumbnail saved'); bump('thumbnails'); } }
    else { const a = document.createElement('a'); a.href = png; a.download = name + '.png'; a.click(); }
  };
  tsGrab(cv).then(sync);
}
const TS_GRADS = [['#ff512f', '#dd2476'], ['#1fa2ff', '#12d8fa'], ['#f7971e', '#ffd200'], ['#8e2de2', '#4a00e0'], ['#00b09b', '#96c93d'], ['#232526', '#414345'], ['#ee0979', '#ff6a00'], ['#0f2027', '#2c5364']];
async function tsGrab(cv) {
  if (TS.bgMode !== 'frame' || !projectDuration()) return;
  const keep = state.time;
  seek(TS.time);
  if (typeof playersReady === 'function') await playersReady(1200);
  await new Promise((r) => setTimeout(r, 60));
  const [W, H] = refSize();
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const sel = state.selectedId; state.selectedId = null;
  try { render(c.getContext('2d'), W); } catch (e) { console.warn(e); }
  state.selectedId = sel;
  TS.bgCanvas = c;
  void keep;
}
function tsDraw(cv) {
  const [W, H] = TS_SIZES[TS.size];
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const x = cv.getContext('2d'), a = TS.adj;
  x.save();
  x.filter = `brightness(${100 + a.bright}%) contrast(${100 + a.contrast}%) saturate(${100 + a.sat}%)`;
  const src = TS.bgMode === 'frame' ? TS.bgCanvas : TS.bgMode === 'image' ? TS.bgImg : null;
  if (src) {
    const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight, k = Math.max(W / sw, H / sh);
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    x.drawImage(src, (W - sw * k) / 2, (H - sh * k) / 2, sw * k, sh * k);
  } else {
    const g = TS_GRADS[TS.grad] || TS_GRADS[0], gr = x.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, g[0]); gr.addColorStop(1, g[1]); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  }
  x.restore();
  if (a.darken > 0) { x.fillStyle = `rgba(0,0,0,${a.darken})`; x.fillRect(0, 0, W, H); }
  if (a.vignette > 0) { const v = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a.vignette})`); x.fillStyle = v; x.fillRect(0, 0, W, H); }
  const S = W / 1280; // sizes are made for a 1280-wide picture
  TS.layers.forEach((L, i) => {
    x.save(); x.translate(L.x * W, L.y * H); x.rotate(((L.rot || 0) * Math.PI) / 180);
    let bw = 0, bh = 0;
    if (L.type === 'text' || L.type === 'sticker') {
      let size = L.size * S * (TS.size === 'short' ? 1.5 : 1);
      const fontOf = (z) => (L.type === 'sticker' ? `${z}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif` : `900 ${z}px "${L.font}", Impact, sans-serif`);
      x.font = fontOf(size);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      const lines = String(L.text || '').split('\n');
      // long text gets smaller so it always fits on the picture
      const widest = Math.max(...lines.map((l) => x.measureText(l).width)) + size * 0.3;
      if (L.type === 'text' && widest > W * 0.94) { size *= (W * 0.94) / widest; x.font = fontOf(size); }
      const lh = size * 1.05;
      bw = Math.max(...lines.map((l) => x.measureText(l).width)) + size * 0.3; bh = lh * lines.length + size * 0.15;
      if (L.box) { x.fillStyle = L.box; const r = size * 0.18; x.beginPath(); x.roundRect(-bw / 2, -bh / 2, bw, bh, r); x.fill(); }
      lines.forEach((ln, k) => {
        const y = (k - (lines.length - 1) / 2) * lh;
        if (L.type === 'text') {
          if (L.glow) { x.shadowColor = L.stroke && L.stroke !== '#000000' ? L.stroke : L.color; x.shadowBlur = L.glow * S; }
          else { x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = 18 * S; x.shadowOffsetY = 6 * S; }
          if (L.strokeW) { x.lineJoin = 'round'; x.lineWidth = L.strokeW * 2 * S; x.strokeStyle = L.stroke; x.strokeText(ln, 0, y); }
          x.shadowColor = 'transparent'; x.fillStyle = L.color; x.fillText(ln, 0, y);
        } else { x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 20 * S; x.fillText(ln, 0, y); }
      });
    } else {
      bw = L.w * W; bh = L.h * H;
      x.strokeStyle = L.color; x.fillStyle = L.color; x.lineCap = 'round'; x.lineJoin = 'round';
      x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 16 * S;
      if (L.shape === 'circle') { x.lineWidth = 14 * S; x.beginPath(); x.ellipse(0, 0, bw / 2, bh / 2, 0, 0, Math.PI * 2); x.stroke(); }
      else if (L.shape === 'box') { x.lineWidth = 14 * S; x.beginPath(); x.roundRect(-bw / 2, -bh / 2, bw, bh, 18 * S); x.stroke(); }
      else { const t = bh * 0.32, hw = bw * 0.36; x.beginPath(); x.moveTo(-bw / 2, -t / 2); x.lineTo(bw / 2 - hw, -t / 2); x.lineTo(bw / 2 - hw, -bh / 2); x.lineTo(bw / 2, 0); x.lineTo(bw / 2 - hw, bh / 2); x.lineTo(bw / 2 - hw, t / 2); x.lineTo(-bw / 2, t / 2); x.closePath(); x.fill(); x.shadowColor = 'transparent'; x.lineWidth = 5 * S; x.strokeStyle = '#ffffff'; x.stroke(); }
    }
    x.restore();
    // a simple box around it (for clicking and the selection outline); rotation is ignored here
    L._bb = [L.x - bw / 2 / W, L.y - bh / 2 / H, L.x + bw / 2 / W, L.y + bh / 2 / H];
    if (i === TS.sel) { x.save(); x.strokeStyle = '#ffffff'; x.setLineDash([12 * S, 8 * S]); x.lineWidth = 3 * S; x.strokeRect(L._bb[0] * W - 6, L._bb[1] * H - 6, bw + 12, bh + 12); x.restore(); }
  });
}
function tsProps(box) {
  const pr = $('.ts-props', box), L = TS.layers[TS.sel];
  if (!L) { pr.innerHTML = '<p class="hint">Click something on the picture to change it.</p>'; return; }
  const color = (k, n) => `<label class="ts-col"><span>${n}</span><input type="color" data-p="${k}" value="${L[k] || '#ffffff'}"></label>`;
  const range = (k, n, a, b, st = 1) => `<label><span>${n}</span><input type="range" data-p="${k}" min="${a}" max="${b}" step="${st}" value="${L[k] || 0}"></label>`;
  let h = `<div class="set-h4">Selected: ${L.type === 'shape' ? niceShape(L.shape) : L.type === 'sticker' ? 'Sticker' : 'Text'}</div>`;
  if (L.type === 'text') {
    h += `<textarea data-p="text" rows="2"></textarea><div class="ts-row"><select data-p="font">${TS_FONTS.map((f) => `<option${f === L.font ? ' selected' : ''}>${f}</option>`).join('')}</select>${color('color', 'Color')}${color('stroke', 'Outline')}</div>`;
    h += range('size', 'Size', 30, 260) + range('strokeW', 'Outline', 0, 24) + range('glow', 'Glow', 0, 60) + range('rot', 'Tilt', -30, 30);
    h += `<label class="ts-chk"><input type="checkbox" data-p="box" ${L.box ? 'checked' : ''}> Color box behind</label>`;
  } else if (L.type === 'sticker') h += range('size', 'Size', 40, 400) + range('rot', 'Tilt', -45, 45);
  else h += `<div class="ts-row">${color('color', 'Color')}</div>` + range('w', 'Width', 0.05, 0.9, 0.01) + range('h', 'Height', 0.05, 0.9, 0.01) + range('rot', 'Turn', -180, 180);
  h += `<div class="ts-row"><button class="btn small" data-x="up">Bring to front</button><button class="btn small" data-x="dup">Duplicate</button><button class="btn small danger" data-x="del">Delete</button></div>`;
  pr.innerHTML = h;
  const ta = $('textarea', pr); if (ta) ta.value = L.text;
  const cv = $('.ts-cv', box);
  pr.oninput = (e) => {
    const i = e.target, k = i.dataset.p; if (!k) return;
    if (k === 'box') L.box = i.checked ? (L.color === '#2b6dff' ? '#ff2d2d' : '#2b6dff') : null;
    else L[k] = i.type === 'range' ? +i.value : i.value;
    tsDraw(cv);
  };
  pr.onclick = (e) => {
    const b = e.target.closest('[data-x]'); if (!b) return;
    if (b.dataset.x === 'del') { TS.layers.splice(TS.sel, 1); TS.sel = -1; }
    else if (b.dataset.x === 'dup') { const c = JSON.parse(JSON.stringify(L)); c.x += 0.04; c.y += 0.04; TS.layers.push(c); TS.sel = TS.layers.length - 1; }
    else { TS.layers.push(TS.layers.splice(TS.sel, 1)[0]); TS.sel = TS.layers.length - 1; }
    TS.sync();
  };
}
const niceShape = (s) => ({ arrow: 'Arrow', circle: 'Circle', box: 'Box' }[s] || 'Shape');

/* ============================ themes: Golden Hour (Premium) + limited Christmas themes ============================ */
function themeOwned(t) {
  if (!t) return true;
  const a = settings.account;
  if (t.premium) return isPremium();
  if (t.limited) return !!(a && ((a.themes || []).includes(t.id) || a.admin));
  return true;
}
function enforceTheme() {
  const t = themeById(settings.theme);
  if (t.id === settings.theme && !themeOwned(t)) { settings.theme = 'midnight'; applyTheme(settings.theme, settings.accent, settings.motion, settings.bright); saveSettings(); }
}
let themePeek = 0;
function themeShop(t) {
  const lim = !!t.limited, c = t.c;
  const box = modal(`<div class="tshop" style="--a:${c.accent};--d:${c.deep};--bg:${c.bg};--p:${c.panel};--t:${c.text}">
      <div class="tshop-prev"><div class="tp-top"></div><div class="tp-mid"><i></i><i></i><i></i></div><div class="tp-btn">Export</div>${lim ? '<div class="tp-snow"></div>' : ''}</div>
      <span class="tshop-tag">${lim ? 'Limited · Christmas 2026' : 'Flux Premium'}</span>
      <h2>${esc72(t.name)}</h2><p class="sub">${esc72(t.sub)}. ${lim ? 'A limited Christmas theme. Once it’s yours, you keep it forever - on every computer you sign in on.' : 'Warm without being too bright. Part of Flux Premium.'}</p>
      <p class="hint">${lim ? 'Buying themes opens soon in the Flux shop. Until then the Flux team can gift it to you.' : 'Premium isn’t for sale yet - it’s coming soon.'}</p>
      <div class="footer"><button class="btn ghost" data-a="close">Close</button><button class="btn" data-a="try">Try it for 10 seconds</button></div></div>`);
  $('[data-a=close]', box).onclick = closeModal;
  $('[data-a=try]', box).onclick = () => {
    closeModal(); clearTimeout(themePeek);
    applyTheme(t.id, '', settings.motion, settings.bright);
    toast(`Trying ${t.name} for 10 seconds`);
    themePeek = setTimeout(() => { applyTheme(settings.theme, settings.accent, settings.motion, settings.bright); requestDraw(); }, 10000);
  };
}
function decorateThemeCards(grid) {
  [...grid.children].forEach((card, i) => {
    const t = THEMES[i]; if (!t || card._dec) return;
    card._dec = true;
    if (t.premium || t.limited) {
      const tag = el('span', 'tc-tag' + (t.limited ? ' xmas' : ''), t.limited ? '🎄 Limited' : '👑 Premium');
      card.appendChild(tag);
    }
    if (!themeOwned(t)) {
      card.classList.add('locked');
      card.addEventListener('click', (e) => { e.stopImmediatePropagation(); e.preventDefault(); themeShop(t); }, true);
    }
  });
}
const _settingsLook72 = settingsLook;
settingsLook = function (body) {
  _settingsLook72.apply(this, arguments);
  const grid = $('.theme-grid', body); if (!grid) return;
  decorateThemeCards(grid);
  new MutationObserver(() => decorateThemeCards(grid)).observe(grid, { childList: true });
};
const _storeAccount72 = storeAccount;
storeAccount = function () { const r = _storeAccount72.apply(this, arguments); setTimeout(enforceTheme, 0); return r; };
setTimeout(enforceTheme, 1500);

/* ============================ buttons ============================ */
(function addButtons() {
  const rec = $('#btnRecTl'); if (!rec) return;
  const mk = (id, tip, svg, label, fn) => { const b = el('button', 'tool-btn'); b.id = id; b.dataset.tip = tip; b.innerHTML = svg + label; b.onclick = fn; rec.after(b); return b; };
  const th = mk('btnThumb', 'Thumbnail Studio - make a clickable thumbnail', '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 16 5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/></svg>', 'Thumbnail', openThumbnailStudio);
  const mx = mk('btnMixer', 'Audio Mixer - levels, pan, EQ, mute & solo for every track', '<svg viewBox="0 0 24 24"><path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="13" width="4" height="3" rx="1"/><rect x="10" y="7" width="4" height="3" rx="1"/><rect x="16" y="11" width="4" height="3" rx="1"/></svg>', 'Mixer', openMixer);
  void th; void mx;
})();
addEventListener('keydown', (e) => { if (e.key === 'Escape' && mixerEl && !document.querySelector('#modalRoot .backdrop')) closeMixer(); });
