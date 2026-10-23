/* =====================================================================
   Flux — extra tools: linked video sound, keyframes, green screen,
   effects, pro transitions, sound balance/EQ/ducking, quality, Premium.
   ===================================================================== */
'use strict';

/* ============================ PREMIUM ============================ */
// You own this copy, so Premium is unlocked. Set this to false in builds you give to other people.
const OWNER_UNLOCKED = false;
const PREMIUM_PRICE = '€4.99';
// Payments: your Stripe Payment Link (monthly subscription).
const CHECKOUT_URL = 'https://buy.stripe.com/3cIaEX20u4o26rI4LUfMA00';
const PREMIUM_FEATURES = [
  ['AI Editor', 'Tell Flux what you want - it cuts, adds titles, music, transitions and more'],
  ['Time machine', 'Jump your whole edit back to any earlier point in a couple of clicks'],
  ['Auto-bleep swearing', 'Finds swear words in speech and bleeps them, from slurs-only to strict'],
  ['Remove silences', 'Cuts out pauses and dead air automatically'],
  ['Karaoke & word-pop captions', 'Animated caption styles that highlight each word as it\u2019s said'],
  ['4K export', 'Export in Ultra HD (2160p)'],
  ['Green screen', 'Remove a green or blue background (chroma key)'],
  ['Pro transitions', 'Glitch, pixelate, whip pan, flip, zoom blur, clock and blinds'],
  ['Film effects', 'Film grain and old-film looks'],
  ['Pro effects', 'Lens, directional, radial & zoom blur, Ultra sharpen, CCTV and Paper edge'],
  ['Pro audio', 'Fairlight EQ, De-esser and Noise reduction']
];
function isPremium() {
  if (OWNER_UNLOCKED) return true;
  const a = settings.account;
  return !!(a && a.token && a.premium && (!a.until || a.until > Date.now()));
}
function requirePremium(feature) {
  if (isPremium()) return true;
  openPremium(feature);
  return false;
}
function openCheckout() {
  const a = settings.account;
  const url = CHECKOUT_URL + (a && a.email ? '?prefilled_email=' + encodeURIComponent(a.email) : '');
  if (api && api.openExternal) api.openExternal(url); else window.open(url);
  toast('Pay in your browser with the same email, then come back - Premium turns on by itself.', { duration: 7000 });
  waitForPremium();
}
function openPremium(feature) {
  const unlocked = isPremium();
  const box = modal(`
    <div class="prem-head"><span class="crown">${CROWN}</span><div><h2>Flux Premium</h2>
      <p class="sub" style="margin:0">${feature ? `<b>${feature}</b> is a Premium feature.` : 'More tools for better videos.'}</p></div></div>
    <ul class="prem-list">${PREMIUM_FEATURES.map(([a, b]) => `<li><span>✓</span><div><b>${a}</b><small>${b}</small></div></li>`).join('')}</ul>
    <div class="prem-price"><b>${PREMIUM_PRICE}</b><small>per month · cancel anytime</small></div>
    ${unlocked ? `<div class="prem-ok">✓ Premium is active on your account${settings.account && settings.account.until ? ' until ' + new Date(settings.account.until).toLocaleDateString() : ''}</div>` : `
    <p class="hint">Secure checkout by Stripe. Use the same email as your Flux account (${settings.account ? settings.account.email : ''}).<br>Already paid? <a href="#" data-a="refresh">Check again</a></p>`}
    <div class="footer"><button class="btn ghost" data-a="close">Close</button>${unlocked ? '' : `<button class="btn primary prem-buy" data-a="buy">Get Premium - ${PREMIUM_PRICE}/month</button>`}</div>`);
  $('[data-a=close]', box).onclick = closeModal;
  const buy = $('[data-a=buy]', box);
  if (buy) buy.onclick = () => { closeModal(); openCheckout(); };
  const ref = $('[data-a=refresh]', box);
  if (ref) ref.onclick = async (e) => { e.preventDefault(); await refreshAccount(true); closeModal(); toast(isPremium() ? 'Premium is on - thank you!' : 'No subscription found for this email yet.', { error: !isPremium() }); };
}
function updatePremiumBadge() {
  const b = $('#btnPremium');
  if (b) { b.classList.toggle('on', isPremium()); b.lastChild.textContent = isPremium() ? 'Premium' : 'Get Premium'; }
}

/* ============================ LINKED VIDEO SOUND ============================ */
function partners(c) {
  return c && c.linkId ? P.clips.filter((o) => o.linkId === c.linkId && o.id !== c.id) : [];
}
function ensureSoundTrack() {
  let tr = P.tracks.find((t) => t.type === 'audio' && (t.id === 'av' || t.name === 'Video sound'));
  if (tr) return tr;
  tr = { id: P.tracks.some((t) => t.id === 'av') ? 'av' + uid().slice(0, 3) : 'av', type: 'audio', name: 'Sound', auto: true, hidden: false, muted: false };
  let i = -1;
  P.tracks.forEach((t, j) => { if (t.type === 'video') i = j; });
  P.tracks.splice(i + 1, 0, tr);
  return tr;
}
// Put a video's sound on its own track right under the video, linked so they move together.
function linkSoundFor(c, m, force) {
  if (!c || c.kind !== 'video' || !m) return null;
  if (!force && m.hasAudio === false) return null;
  const d = dur(c);
  const free = (tr) => Math.abs(findFreeStart(tr.id, c.start, d) - c.start) < 1e-6;
  let tr = ensureSoundTrack();
  if (!free(tr)) tr = P.tracks.find((t) => t.type === 'audio' && free(t));
  if (!tr) {
    tr = { id: 'a' + uid().slice(0, 4), type: 'audio', name: 'Sound', auto: true, hidden: false, muted: false };
    const i = P.tracks.indexOf(ensureSoundTrack());
    P.tracks.splice(i + 1, 0, tr);
  }
  if (typeof autoNameTracks === 'function') autoNameTracks();
  const link = uid();
  const a = {
    id: uid(), trackId: tr.id, mediaId: c.mediaId, kind: 'audio', start: c.start, in: c.in, out: c.out, speed: c.speed,
    volume: c.volume == null ? 1 : c.volume, muted: false, fadeIn: c.fadeIn || 0, fadeOut: c.fadeOut || 0, linkId: link,
    audio: { pan: 0, bass: 0, mid: 0, treble: 0, duck: false }
  };
  c.linkId = link;
  c.muted = true;
  P.clips.push(a);
  if (!rt.peaks.has(m.id)) loadPeaks(m);
  return a;
}

/* ============================ KEYFRAMES ============================ */
const KF_DEFAULTS = { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1, volume: 1 };
const easeKF = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
function baseVal(c, prop) { return c[prop] != null ? c[prop] : KF_DEFAULTS[prop]; }
// cubic-bezier(x1, y1, x2, y2) like CSS: returns y for a given x
function bezierY(x, x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  let t = x;
  for (let i = 0; i < 8; i++) { // Newton steps
    const xt = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(xt) < 1e-5) break;
    if (Math.abs(d) < 1e-6) break;
    t -= xt / d;
  }
  t = clamp(t, 0, 1);
  return ((ay * t + by) * t + cy) * t;
}
// How the value travels from a keyframe to the next one
const KF_EASES = {
  smooth: easeKF,
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - Math.pow(1 - x, 3),
  hold: () => 0
};
function keyEase(k, x) {
  if (k.ease === 'bezier' && k.h) return bezierY(x, k.h[0], k.h[1], k.h[2], k.h[3]);
  return (KF_EASES[k.ease] || easeKF)(x);
}
function kv(c, prop, local) {
  const arr = c.keys && c.keys[prop];
  if (!arr || !arr.length) return baseVal(c, prop);
  if (local <= arr[0].t) return arr[0].v;
  const n = arr.length - 1;
  if (local >= arr[n].t) return arr[n].v;
  let lo = 0, hi = n; // binary search: fast even with many keyframes
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid].t <= local) lo = mid; else hi = mid; }
  const a = arr[lo], b = arr[hi];
  return a.v + (b.v - a.v) * keyEase(a, (local - a.t) / Math.max(1e-6, b.t - a.t));
}
// keyframes that are inside the clip (a split keeps the others so the motion stays the same)
function keysInClip(c, prop) {
  const arr = c.keys && c.keys[prop];
  if (!arr) return [];
  const d = dur(c);
  return arr.filter((k) => k.t >= -1e-4 && k.t <= d + 1e-4);
}
const localNow = (c) => clamp(state.time - c.start, 0, dur(c));
function kvNow(c, prop) { return kv(c, prop, localNow(c)); }
function hasKeyAt(c, prop) {
  const arr = c.keys && c.keys[prop];
  if (!arr) return false;
  const l = localNow(c);
  return arr.some((k) => Math.abs(k.t - l) < 0.6 / FPS);
}
// Change a value: if it's animated, change the keyframe at the playhead (adding one if needed).
function setProp(c, prop, v) {
  const arr = c.keys && c.keys[prop];
  if (arr && arr.length) {
    const l = localNow(c);
    const k = arr.find((x) => Math.abs(x.t - l) < 0.6 / FPS);
    if (k) k.v = v; else { arr.push({ t: l, v }); arr.sort((a, b) => a.t - b.t); }
  } else c[prop] = v;
}
function toggleKeyframe(c, prop) {
  if (state.time < c.start || state.time > endOf(c)) return toast('Move the playhead over this clip first');
  commit(() => {
    c.keys = c.keys || {};
    const arr = c.keys[prop] = c.keys[prop] || [];
    const l = localNow(c);
    const i = arr.findIndex((k) => Math.abs(k.t - l) < 0.6 / FPS);
    if (i >= 0) {
      const v = arr[i].v;
      arr.splice(i, 1);
      if (!arr.length) { delete c.keys[prop]; c[prop] = v; }
    } else {
      arr.push({ t: l, v: kv(c, prop, l) });
      arr.sort((a, b) => a.t - b.t);
    }
  });
  if (c.keys && Object.values(c.keys).some((a) => a.length === 1)) toast('Keyframe added. Move the playhead and change the value to animate.');
}
function addKeyframeAll(c) {
  if (state.time < c.start - 1e-4 || state.time > endOf(c) + 1e-4) return toast('Move the playhead over this clip first');
  commit(() => {
    c.keys = c.keys || {};
    const l = localNow(c);
    for (const prop of ['scale', 'x', 'y', 'rotation', 'opacity']) {
      const arr = c.keys[prop] = c.keys[prop] || [];
      if (!arr.some((k) => Math.abs(k.t - l) < 0.6 / FPS)) { arr.push({ t: l, v: kv(c, prop, l) }); arr.sort((a, b) => a.t - b.t); }
    }
  });
  toast('Keyframe added for size, position, rotation and opacity');
}
// Splitting doesn't add keyframes: both halves keep the same curve (keys outside a half are just hidden).
function splitKeys(c, b, cut) {
  if (!c.keys) return;
  b.keys = {};
  for (const [prop, arr] of Object.entries(c.keys)) b.keys[prop] = arr.map((k) => Object.assign({}, k, { t: k.t - cut }));
}

/* ============================ SOUND: BALANCE / EQ / DUCKING ============================ */
function applyAudioFx(p, c) {
  if (!p.pan) return;
  const a = c.audio || {};
  const pro = isPremium();
  if (p.pan.pan.value !== (a.pan || 0)) p.pan.pan.value = a.pan || 0;
  const bass = pro ? a.bass || 0 : 0, mid = pro ? a.mid || 0 : 0, tre = pro ? a.treble || 0 : 0;
  if (p.low.gain.value !== bass) p.low.gain.value = bass;
  if (p.mid.gain.value !== mid) p.mid.gain.value = mid;
  if (p.high.gain.value !== tre) p.high.gain.value = tre;
}
function clipRole(c) {
  const m = getMedia(c.mediaId), tr = getTrack(c.trackId);
  if ((m && m.tag === 'voice') || (tr && /voice/i.test(tr.name))) return 'voice';
  if ((m && m.tag === 'music') || (tr && /music/i.test(tr.name))) return 'music';
  return 'other';
}
function loudness(c) {
  const pk = rt.peaksAbs.get(c.mediaId), m = getMedia(c.mediaId);
  if (!pk || !m || !m.duration) return null;
  const a = Math.floor((c.in / m.duration) * pk.length), b = Math.max(a + 1, Math.ceil((c.out / m.duration) * pk.length));
  let sum = 0, n = 0;
  for (let i = a; i < b && i < pk.length; i++) { sum += pk[i]; n++; }
  return n ? sum / n : null;
}
const ROLE_TARGET = { voice: 0.32, music: 0.12, other: 0.22 };
function autoLevel(c, quiet) {
  const L = loudness(c);
  if (L == null) { if (!quiet) toast('Still analysing this sound - try again in a second'); const m = getMedia(c.mediaId); if (m && !rt.peaks.has(m.id)) loadPeaks(m); return false; }
  c.volume = clamp(ROLE_TARGET[clipRole(c)] / Math.max(L, 0.005), 0.1, 3);
  if (c.keys && c.keys.volume) delete c.keys.volume;
  return true;
}
function soundClips() {
  return P.clips.filter((c) => (c.kind === 'audio' || (c.kind === 'video' && !partners(c).length && !c.muted)));
}
function autoBalanceAll() {
  let n = 0, missing = 0;
  const hasVoice = P.clips.some((c) => hasAudio(c) && clipRole(c) === 'voice');
  commit(() => {
    for (const c of soundClips()) {
      if (autoLevel(c, true)) n++; else missing++;
      if (hasVoice && clipRole(c) === 'music') { c.audio = c.audio || {}; c.audio.duck = true; }
    }
  });
  toast(`Balanced ${n} sound clip${n === 1 ? '' : 's'}` + (hasVoice ? ' - music will dip under your voice' : '') + (missing ? ` (${missing} still loading)` : ''));
}

const EQ_PRESETS = [
  ['Flat', { bass: 0, mid: 0, treble: 0 }],
  ['Voice clarity', { bass: -4, mid: 3, treble: 4 }],
  ['Warm', { bass: 4, mid: 0, treble: -2 }],
  ['Bass boost', { bass: 8, mid: 0, treble: 0 }],
  ['Bright', { bass: -2, mid: 0, treble: 6 }],
  ['Phone', { bass: -12, mid: 8, treble: -12 }],
  ['Radio', { bass: -8, mid: 6, treble: -4 }]
];
function openBalanceDialog(c) {
  if (!c || !hasAudio(c)) return;
  if (c.kind === 'video' && partners(c).length) c = partners(c)[0];
  c.audio = Object.assign({ pan: 0, bass: 0, mid: 0, treble: 0, duck: false }, c.audio || {});
  const a = c.audio;
  const box = modal(`<h2>Balance sound</h2><p class="sub"></p><div class="bal-body"></div>
    <div class="footer"><button class="btn ghost" data-a="all">Auto-balance whole project</button><button class="btn primary" data-a="done">Done</button></div>`, { onClose: () => renderInspector() });
  $('.sub', box).textContent = clipLabel(c);
  const body = $('.bal-body', box);
  const draw = () => {
    body.innerHTML = '';
    const lv = section(body, 'Level');
    slider(lv, 'Volume', { min: 0, max: 300, get: () => Math.round(kvNow(c, 'volume') * 100), set: (v) => setProp(c, 'volume', v / 100), fmt: (v) => v + '%', def: 100, live: false });
    slider(lv, 'Left ↔ Right', { min: -100, max: 100, get: () => Math.round(a.pan * 100), set: (v) => (a.pan = v / 100), fmt: (v) => (v === 0 ? 'C' : v < 0 ? 'L' + -v : 'R' + v), def: 0, live: false });
    const auto = el('div', 'v-btns');
    auto.innerHTML = '<button class="btn ghost" data-x="lvl">Auto-level this clip</button><button class="btn ghost" data-x="ctr">Center</button>';
    $('[data-x=lvl]', auto).onclick = () => { commit(() => autoLevel(c)); draw(); };
    $('[data-x=ctr]', auto).onclick = () => { commit(() => { a.pan = 0; }); draw(); };
    lv.appendChild(auto);
    const eq = section(body, 'Equalizer 👑', () => Object.assign(a, { bass: 0, mid: 0, treble: 0 }));
    if (isPremium()) {
      chips(eq, EQ_PRESETS.map(([n, v]) => ({ label: n, value: n })), (EQ_PRESETS.find(([, v]) => v.bass === a.bass && v.mid === a.mid && v.treble === a.treble) || [])[0],
        (n) => { commit(() => Object.assign(a, EQ_PRESETS.find((p) => p[0] === n)[1])); draw(); });
      for (const [k, label] of [['bass', 'Bass'], ['mid', 'Mid'], ['treble', 'Treble']]) {
        slider(eq, label, { min: -12, max: 12, get: () => a[k], set: (v) => (a[k] = v), fmt: (v) => (v > 0 ? '+' : '') + v + 'dB', def: 0, live: false });
      }
    } else {
      const u = el('button', 'btn', CROWN + ' Unlock the equalizer'); u.onclick = () => openPremium('Equalizer'); eq.appendChild(u);
    }
    const dk = section(body, 'Ducking');
    const row = el('label', 'v-opt');
    row.innerHTML = '<input type="checkbox"><span>Lower this sound while a voiceover plays</span>';
    $('input', row).checked = !!a.duck;
    $('input', row).onchange = (e) => commit(() => { a.duck = e.target.checked; });
    dk.appendChild(row);
    const fd = section(body, 'Fade in & out');
    const maxFade = Math.max(0.1, Math.min(5, dur(c) / 2));
    slider(fd, 'Fade in', { min: 0, max: maxFade, step: 0.1, get: () => Math.min(c.fadeIn, maxFade), set: (v) => (c.fadeIn = v), fmt: (v) => v.toFixed(1) + 's', def: 0 });
    slider(fd, 'Fade out', { min: 0, max: maxFade, step: 0.1, get: () => Math.min(c.fadeOut, maxFade), set: (v) => (c.fadeOut = v), fmt: (v) => v.toFixed(1) + 's', def: 0 });
  };
  draw();
  $('[data-a=done]', box).onclick = closeModal;
  $('[data-a=all]', box).onclick = () => { autoBalanceAll(); draw(); };
}

/* ============================ QUALITY / FRAME RATE ============================ */
function openQualityDialog(c) {
  const m = c && getMedia(c.mediaId);
  const out = Object.assign({ res: 1080, fps: 30 }, P.output || {});
  const box = modal(`<h2>Quality & frame rate</h2>
    <p class="sub">Sets the size and smoothness your video is exported in. The preview isn't affected.</p>
    ${m && m.width ? `<div class="stat-row">This clip <b>${m.width} × ${m.height}${m.duration && m.kind !== 'image' ? ' · ' + fmt(m.duration, false) : ''}</b></div>` : ''}
    <div class="row" style="margin-top:12px"><label>Resolution</label><div class="seg tall" data-k="res">
      <button data-v="720">720p<small>HD</small></button><button data-v="1080">1080p<small>Full HD</small></button><button data-v="1440">1440p<small>2K</small></button><button data-v="2160" data-pro="1">4K ${CROWN}<small>Ultra HD</small></button></div></div>
    <div class="row"><label>Frame rate</label><div class="seg tall" data-k="fps">
      <button data-v="24">24 fps<small>Film look</small></button><button data-v="30">30 fps<small>Standard</small></button><button data-v="60">60 fps<small>Smooth</small></button></div></div>
    <div class="footer"><button class="btn ghost" data-a="cancel">Cancel</button><button class="btn primary" data-a="ok">Apply</button></div>`);
  const sync = () => $$('.seg', box).forEach((s) => $$('button', s).forEach((b) => b.classList.toggle('active', String(out[s.dataset.k]) === b.dataset.v)));
  $$('.seg', box).forEach((s) => $$('button', s).forEach((b) => (b.onclick = () => {
    if (b.dataset.pro && !requirePremium(b.textContent.replace('👑', '').trim())) return;
    out[s.dataset.k] = +b.dataset.v; sync();
  })));
  sync();
  $('[data-a=cancel]', box).onclick = closeModal;
  $('[data-a=ok]', box).onclick = () => {
    closeModal();
    commit(() => { P.output = { res: out.res, fps: out.fps }; });
    FPS = out.fps;
    toast(`Export set to ${out.res === 2160 ? '4K' : out.res + 'p'} at ${out.fps} fps`);
  };
}

/* ============================ GREEN SCREEN & EFFECTS ============================ */
function hexRgb(hex) { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function chromaKey(src, sx, sy, cw, ch, opt, outW) {
  const w = Math.max(1, Math.round(outW)), h = Math.max(1, Math.round(outW * (ch / cw)));
  if (!rt.chromaCanvas) { rt.chromaCanvas = document.createElement('canvas'); rt.chromaCtx = rt.chromaCanvas.getContext('2d', { willReadFrequently: true }); }
  const cv = rt.chromaCanvas, g = rt.chromaCtx;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  try { g.clearRect(0, 0, w, h); g.drawImage(src, sx, sy, cw, ch, 0, 0, w, h); } catch { return null; }
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const [kr, kg, kb] = hexRgb(opt.color || '#00ff00');
  const kCb = -0.169 * kr - 0.331 * kg + 0.5 * kb, kCr = 0.5 * kr - 0.419 * kg - 0.081 * kb;
  const sim = (opt.similarity ?? 0.4) * 120, smooth = Math.max(1, (opt.smooth ?? 0.1) * 120);
  const greenKey = kg > kr && kg > kb, blueKey = kb > kr && kb > kg;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const cb = -0.169 * r - 0.331 * gg + 0.5 * b, cr = 0.5 * r - 0.419 * gg - 0.081 * b;
    const dist = Math.hypot(cb - kCb, cr - kCr);
    const a = clamp((dist - sim) / smooth, 0, 1);
    d[i + 3] = d[i + 3] * a;
    if (a < 1) { // remove colored edge spill
      if (greenKey) d[i + 1] = Math.min(gg, Math.max(r, b));
      else if (blueKey) d[i + 2] = Math.min(b, Math.max(r, gg));
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}
let grainPattern = null;
function getGrain(g) {
  if (!grainPattern) {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), im = x.createImageData(256, 256);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    x.putImageData(im, 0, 0);
    grainPattern = c;
  }
  return g.createPattern(grainPattern, 'repeat');
}
function drawEffects(g, c, dw, dh) {
  if (c.temp) {
    g.globalCompositeOperation = 'soft-light';
    g.globalAlpha = Math.min(1, g.globalAlpha);
    g.fillStyle = c.temp > 0 ? `rgba(255,140,40,${(c.temp / 100) * 0.6})` : `rgba(40,120,255,${(-c.temp / 100) * 0.6})`;
    g.fillRect(-dw / 2, -dh / 2, dw, dh);
  }
  if (c.tint) { // + magenta, - green
    g.globalCompositeOperation = 'soft-light';
    g.fillStyle = c.tint > 0 ? `rgba(255,60,200,${(c.tint / 100) * 0.55})` : `rgba(60,220,90,${(-c.tint / 100) * 0.55})`;
    g.fillRect(-dw / 2, -dh / 2, dw, dh);
  }
  if (c.vignette > 0) { // free for everyone
    g.globalCompositeOperation = 'source-over';
    const gr = g.createRadialGradient(0, 0, Math.min(dw, dh) * 0.28, 0, 0, Math.hypot(dw, dh) / 2);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,0,${(c.vignette / 100) * 0.9})`);
    g.fillStyle = gr;
    g.fillRect(-dw / 2, -dh / 2, dw, dh);
  }
  if (!isPremium()) return;
  if (c.grain > 0) {
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha *= (c.grain / 100) * 0.55;
    g.beginPath(); g.rect(-dw / 2, -dh / 2, dw, dh); g.clip();
    g.translate(Math.random() * 256, Math.random() * 256);
    g.fillStyle = getGrain(g);
    g.fillRect(-dw / 2 - 256, -dh / 2 - 256, dw + 512, dh + 512);
    g.restore();
  }
}
function drawPixelated(g, src, sx, sy, cw, ch, dw, dh, px) {
  if (!rt.pixCanvas) rt.pixCanvas = document.createElement('canvas');
  const c = rt.pixCanvas, w = Math.max(1, Math.round(dw / px)), h = Math.max(1, Math.round(dh / px));
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(src, sx, sy, cw, ch, 0, 0, w, h);
  const sm = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(c, 0, 0, w, h, -dw / 2, -dh / 2, dw, dh);
  g.imageSmoothingEnabled = sm;
}
function drawGlitched(g, src, sx, sy, cw, ch, dw, dh, amt) {
  const N = 14, seed = Math.floor(state.time * 24);
  for (let i = 0; i < N; i++) {
    const r = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    const off = ((r - Math.floor(r)) - 0.5) * amt * dw * 0.25;
    g.drawImage(src, sx, sy + (ch * i) / N, cw, ch / N, -dw / 2 + off, -dh / 2 + (dh * i) / N, dw, dh / N + 1);
  }
  if (amt > 0.3) { // a little RGB split
    g.globalCompositeOperation = 'screen';
    g.globalAlpha *= 0.35;
    g.drawImage(src, sx, sy, cw, ch, -dw / 2 + amt * 18, -dh / 2, dw, dh);
  }
}
function effectsInspector(body, c) {
  const s = section(body, 'Effects', () => { c.vignette = 0; c.grain = 0; if (c.chroma) c.chroma.on = false; });
  slider(s, 'Vignette', { min: 0, max: 100, get: () => c.vignette || 0, set: (v) => (c.vignette = v), fmt: (v) => v, def: 0, live: false });
  if (!isPremium()) {
    const u = el('button', 'btn', CROWN + (c.kind === 'adjust' ? ' Unlock film grain' : ' Unlock green screen & film grain'));
    u.style.cssText = 'width:100%;justify-content:center';
    u.onclick = () => openPremium('Effects');
    s.appendChild(u);
    return;
  }
  c.chroma = c.chroma || { on: false, color: '#00ff00', similarity: 0.4, smooth: 0.1 };
  if (c.kind !== 'adjust') chips(s, [{ label: c.chroma.on ? 'Green screen: ON' : 'Remove green screen', value: 'on' }], c.chroma.on ? 'on' : null, () => commit(() => { c.chroma.on = !c.chroma.on; }), 'toggle-row');
  if (c.chroma.on && c.kind !== 'adjust') {
    const row = el('div', 'field');
    row.innerHTML = `<label>Key color</label><div class="chips" style="margin:0"><button class="chip" data-c="#00ff00">Green</button><button class="chip" data-c="#0040ff">Blue</button></div><input type="color">`;
    const ci = $('input', row);
    ci.value = c.chroma.color;
    ci.addEventListener('input', () => { beginEdit(); c.chroma.color = ci.value; requestDraw(); });
    ci.addEventListener('change', endEdit);
    $$('[data-c]', row).forEach((b) => (b.onclick = () => commit(() => { c.chroma.color = b.dataset.c; })));
    s.appendChild(row);
    slider(s, 'Strength', { min: 0, max: 100, get: () => Math.round(c.chroma.similarity * 100), set: (v) => (c.chroma.similarity = v / 100), fmt: (v) => v, def: 40, live: false });
    slider(s, 'Edge softness', { min: 0, max: 100, get: () => Math.round(c.chroma.smooth * 100), set: (v) => (c.chroma.smooth = v / 100), fmt: (v) => v, def: 10, live: false });
  }
  slider(s, 'Film grain', { min: 0, max: 100, get: () => c.grain || 0, set: (v) => (c.grain = v), fmt: (v) => v, def: 0, live: false });
}

/* ============================ MORE TRANSITIONS ============================ */
TRANSITIONS.push(
  { id: 'diag', name: 'Diagonal wipe' },
  { id: 'barn', name: 'Barn doors' },
  { id: 'iris', name: 'Box open' },
  { id: 'pushUp', name: 'Push up' },
  { id: 'clock', name: 'Clock wipe', pro: true },
  { id: 'blinds', name: 'Blinds', pro: true },
  { id: 'pixel', name: 'Pixelate', pro: true },
  { id: 'glitch', name: 'Glitch', pro: true },
  { id: 'whip', name: 'Whip pan', pro: true },
  { id: 'flip', name: 'Flip', pro: true },
  { id: 'zoomblur', name: 'Zoom blur', pro: true },
  { id: 'slideLeft', name: 'Slide from left' },
  { id: 'slideDown', name: 'Slide down' },
  { id: 'pushRight', name: 'Push right' },
  { id: 'pushDown', name: 'Push down' },
  { id: 'wipeLeft', name: 'Wipe left' },
  { id: 'wipeUp', name: 'Wipe up' },
  { id: 'splitH', name: 'Split open' },
  { id: 'diamond', name: 'Diamond' },
  { id: 'zoomOut', name: 'Zoom out' },
  { id: 'heart', name: 'Heart', pro: true },
  { id: 'star', name: 'Star', pro: true },
  { id: 'checker', name: 'Checkerboard', pro: true },
  { id: 'bars', name: 'Bars', pro: true },
  { id: 'spinZoom', name: 'Spin zoom', pro: true },
  { id: 'bounce', name: 'Bounce in', pro: true },
  { id: 'shake', name: 'Camera shake', pro: true },
  { id: 'burn', name: 'Light leak', pro: true },
  { id: 'swing', name: 'Swing', pro: true }
);
function easeOutBounce(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}
const tHash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const baseTransitionFx = transitionFx;
transitionFx = function (type, p, role, W, H) {
  const e = easeInOut(clamp(p, 0, 1));
  const isIn = role === 'in';
  const fx = { alpha: 1, dx: 0, dy: 0, scale: 1, rot: 0, blur: 0, clip: null, cover: null };
  const half = (inside) => { fx.alpha = isIn ? (p >= 0.5 ? 1 : 0) : (p < 0.5 ? 1 : 0); return inside; };
  switch (type) {
    case 'diag': if (isIn) fx.clip = (g) => { g.moveTo(0, 0); g.lineTo(e * 2 * W, 0); g.lineTo(0, e * 2 * H); g.closePath(); }; return fx;
    case 'barn': if (isIn) fx.clip = (g) => g.rect(W / 2 - (e * W) / 2, 0, e * W, H); return fx;
    case 'iris': if (isIn) fx.clip = (g) => g.rect(W / 2 - (e * W) / 2, H / 2 - (e * H) / 2, e * W, e * H); return fx;
    case 'pushUp': fx.dy = isIn ? (1 - e) * H : -e * H; return fx;
    case 'clock': if (isIn) fx.clip = (g) => { const r = Math.hypot(W, H); g.moveTo(W / 2, H / 2); g.arc(W / 2, H / 2, r, -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2); g.closePath(); }; return fx;
    case 'blinds': if (isIn) fx.clip = (g) => { for (let i = 0; i < 10; i++) g.rect(0, (i * H) / 10, W, (e * H) / 10 + 0.5); }; return fx;
    case 'pixel': half(); fx.pixel = 1 + (1 - Math.abs(2 * e - 1)) * 70; return fx;
    case 'glitch': half(); fx.glitch = 1 - Math.abs(2 * e - 1); return fx;
    case 'whip': fx.dx = isIn ? (1 - e) * W : -e * W; fx.blur = (1 - Math.abs(2 * e - 1)) * 45; return fx;
    case 'flip': half(); fx.flipX = Math.abs(Math.cos(Math.PI * e)); return fx;
    case 'zoomblur':
      if (isIn) { fx.alpha = e; fx.scale = 1 + (1 - e) * 0.7; fx.blur = (1 - e) * 28; }
      else { fx.alpha = 1 - e; fx.scale = 1 + e * 1.4; fx.blur = e * 28; }
      return fx;
    case 'slideLeft': if (isIn) fx.dx = -(1 - e) * W; return fx;
    case 'slideDown': if (isIn) fx.dy = -(1 - e) * H; return fx;
    case 'pushRight': fx.dx = isIn ? -(1 - e) * W : e * W; return fx;
    case 'pushDown': fx.dy = isIn ? -(1 - e) * H : e * H; return fx;
    case 'wipeLeft': if (isIn) fx.clip = (g) => g.rect(W - e * W, 0, e * W, H); return fx;
    case 'wipeUp': if (isIn) fx.clip = (g) => g.rect(0, H - e * H, W, e * H); return fx;
    case 'splitH': if (isIn) fx.clip = (g) => g.rect(0, H / 2 - (e * H) / 2, W, e * H); return fx;
    case 'diamond': if (isIn) fx.clip = (g) => { const r = e * (W + H) / 2 + 0.01; g.moveTo(W / 2, H / 2 - r); g.lineTo(W / 2 + r, H / 2); g.lineTo(W / 2, H / 2 + r); g.lineTo(W / 2 - r, H / 2); g.closePath(); }; return fx;
    case 'zoomOut':
      if (isIn) { fx.alpha = e; fx.scale = 0.6 + 0.4 * e; } else { fx.alpha = 1 - e * 0.5; fx.scale = 1 - 0.25 * e; }
      return fx;
    case 'heart': if (isIn) fx.clip = (g) => {
      const s2 = e * Math.hypot(W, H) * 0.95 + 0.01, cx = W / 2, cy = H / 2 + s2 * 0.1;
      g.moveTo(cx, cy + s2 * 0.35);
      g.bezierCurveTo(cx - s2 * 0.7, cy - s2 * 0.05, cx - s2 * 0.35, cy - s2 * 0.55, cx, cy - s2 * 0.25);
      g.bezierCurveTo(cx + s2 * 0.35, cy - s2 * 0.55, cx + s2 * 0.7, cy - s2 * 0.05, cx, cy + s2 * 0.35);
      g.closePath();
    }; return fx;
    case 'star': if (isIn) fx.clip = (g) => {
      const R = e * Math.hypot(W, H) * 0.9 + 0.01, r = R * 0.45;
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r : R; g[i ? 'lineTo' : 'moveTo'](W / 2 + Math.cos(a) * rr, H / 2 + Math.sin(a) * rr); }
      g.closePath();
    }; return fx;
    case 'checker': if (isIn) fx.clip = (g) => { const n = 8, cw = W / n, ch = H / 6; for (let y = 0; y < 6; y++) for (let x = 0; x < n; x++) if (tHash(y * n + x) < e * 1.05) g.rect(x * cw, y * ch, cw + 0.5, ch + 0.5); }; return fx;
    case 'bars': if (isIn) fx.clip = (g) => { const n = 9, bw = W / n; for (let i = 0; i < n; i++) { const hh = clamp(e * 1.6 - (i % 3) * 0.15, 0, 1) * H; g.rect(i * bw, i % 2 ? 0 : H - hh, bw + 0.5, hh); } }; return fx;
    case 'spinZoom':
      if (isIn) { fx.alpha = e; fx.scale = 0.2 + 0.8 * e; fx.rot = -(1 - e) * Math.PI * 2; }
      else { fx.alpha = 1 - e; fx.scale = 1 + e * 1.5; fx.rot = e * Math.PI; }
      return fx;
    case 'bounce': if (isIn) fx.dy = -(1 - easeOutBounce(clamp(p, 0, 1))) * H; return fx;
    case 'shake': {
      half(); const amt = (1 - Math.abs(2 * e - 1)) * Math.min(W, H) * 0.06;
      fx.dx = (tHash(Math.floor(p * 40)) - 0.5) * 2 * amt; fx.dy = (tHash(Math.floor(p * 40) + 99) - 0.5) * 2 * amt;
      fx.blur = amt * 0.15; return fx;
    }
    case 'burn': half(); fx.cover = { color: '#ffb35c', alpha: (1 - Math.abs(2 * e - 1)) * 0.95 }; fx.blur = (1 - Math.abs(2 * e - 1)) * 10; return fx;
    case 'swing':
      if (isIn) { fx.alpha = e; fx.rot = -(1 - e) * 0.5; fx.dx = -(1 - e) * W * 0.3; fx.scale = 0.85 + 0.15 * e; }
      else { fx.alpha = 1 - e * 0.4; fx.rot = e * 0.3; fx.dx = e * W * 0.2; }
      return fx;
  }
  return baseTransitionFx(type, p, role, W, H);
};
const baseSetTransition = setTransition;
setTransition = function (c, type, duration) {
  const t = transById(type);
  if (t.pro && !requirePremium(t.name + ' transition')) return;
  return baseSetTransition(c, type, duration);
};
