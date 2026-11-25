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
  const mx = mk('btnMixer', 'Audio Mixer - levels, pan, EQ, mute & solo for every track', '<svg viewBox="0 0 24 24"><path d="M6 4v16M12 4v16M18 4v16"/><rect x="4" y="13" width="4" height="3" rx="1"/><rect x="10" y="7" width="4" height="3" rx="1"/><rect x="16" y="11" width="4" height="3" rx="1"/></svg>', 'Mixer', openMixer);
  void mx;
})();
addEventListener('keydown', (e) => { if (e.key === 'Escape' && mixerEl && !document.querySelector('#modalRoot .backdrop')) closeMixer(); });
