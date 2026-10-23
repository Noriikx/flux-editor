/* Flux — audio effects for any clip with sound: Fairlight EQ, De-esser, Noise reduction, Delay, Limiter, Reverb.
   They sit in the clip's own sound chain, so you hear them while editing and they're in the export too. */
'use strict';
const hz = (v) => (v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k' : Math.round(v)) + 'Hz';
const dbf = (v) => (v > 0 ? '+' : '') + (+v).toFixed(1).replace('.0', '') + 'dB';
const AFX_TYPES = {
  feq: { name: 'Fairlight EQ', pro: true, params: [
    ['lowcut', 'Low cut', 20, 400, 20, (v) => (v <= 20 ? 'Off' : hz(v))],
    ['lowG', 'Low (100Hz)', -15, 15, 0, dbf],
    ['lmF', 'Low-mid freq', 120, 800, 300, hz], ['lmG', 'Low-mid', -15, 15, 0, dbf],
    ['midF', 'Mid freq', 500, 4000, 1200, hz], ['midG', 'Mid', -15, 15, 0, dbf],
    ['hmF', 'High-mid freq', 2000, 9000, 4000, hz], ['hmG', 'High-mid', -15, 15, 0, dbf],
    ['highG', 'High (10kHz)', -15, 15, 0, dbf],
    ['highcut', 'High cut', 2000, 20000, 20000, (v) => (v >= 20000 ? 'Off' : hz(v))]
  ] },
  deess: { name: 'De-esser', pro: true, params: [['freq', 'Frequency', 3000, 11000, 6500, hz], ['amount', 'Amount', 0, 100, 50, (v) => v]] },
  nr: { name: 'Noise reduction', pro: true, params: [['amount', 'Amount', 0, 100, 50, (v) => v], ['lowcut', 'Rumble cut', 20, 200, 80, (v) => (v <= 20 ? 'Off' : hz(v))]], choice: ['hum', 'Hum removal', [['off', 'Off'], ['50', '50Hz'], ['60', '60Hz']], 'off'] },
  delay: { name: 'Delay', params: [['time', 'Time', 20, 1500, 300, (v) => Math.round(v) + 'ms'], ['feedback', 'Feedback', 0, 90, 35, (v) => v + '%'], ['mix', 'Mix', 0, 100, 30, (v) => v + '%']] },
  limiter: { name: 'Limiter', params: [['input', 'Input gain', 0, 20, 0, dbf], ['ceiling', 'Ceiling', -12, 0, -1, dbf]] },
  reverb: { name: 'Reverb', params: [['size', 'Room size', 1, 100, 40, (v) => v], ['decay', 'Decay', 1, 100, 50, (v) => v], ['mix', 'Mix', 0, 100, 25, (v) => v + '%']], choice: ['room', 'Space', [['room', 'Room'], ['hall', 'Hall'], ['plate', 'Plate']], 'room'] }
};
const FEQ_PRESETS = [
  ['Flat', {}],
  ['Voice', { lowcut: 90, lowG: -2, lmF: 300, lmG: -3, midF: 1200, midG: 0, hmF: 4000, hmG: 3, highG: 2 }],
  ['Podcast', { lowcut: 80, lowG: 2, lmF: 350, lmG: -4, midF: 2000, midG: 1, hmF: 5000, hmG: 3, highG: 1 }],
  ['Bass boost', { lowG: 8, lmF: 250, lmG: 2 }],
  ['Telephone', { lowcut: 400, highcut: 3400, midF: 1500, midG: 6 }],
  ['Muffled', { highcut: 2500, highG: -10 }]
];

function newAudioFx(type) {
  const t = AFX_TYPES[type], e = { id: uid(), type, on: true };
  for (const [k, , , , d] of t.params) e[k] = d;
  if (t.choice) e[t.choice[0]] = t.choice[3];
  return e;
}
function audioFxTarget(c) { return c && (c.kind === 'audio' || c.kind === 'video') ? c : null; }
function addAudioFx(c, type) {
  const t = AFX_TYPES[type];
  if (!audioFxTarget(c)) return toast('Select a clip with sound first');
  if (t.pro && !requirePremium(t.name)) return;
  commit(() => { c.audio = c.audio || {}; c.audio.fx = c.audio.fx || []; c.audio.fx.push(newAudioFx(type)); });
  toast(t.name + ' added');
}
const activeAudioFx = (c) => ((c.audio && c.audio.fx) || []).filter((e) => e.on !== false && AFX_TYPES[e.type] && (!AFX_TYPES[e.type].pro || isPremium()));

/* ---------- AudioWorklet for the de-esser and noise reduction ---------- */

let afxWorkletReady = false;
function loadFxWorklet() {
  if (!actx || !actx.audioWorklet || afxWorkletReady === 'loading') return;
  afxWorkletReady = 'loading';
  actx.audioWorklet.addModule(new URL('dyn-worklet.js', location.href).href).then(() => { afxWorkletReady = true; }).catch((e) => { console.warn('Audio FX worklet', e); afxWorkletReady = false; });
}
{
  const baseEnsureAudio = ensureAudio;
  ensureAudio = function () { const had = !!actx; baseEnsureAudio(); if (!had && actx) loadFxWorklet(); };
}

/* ---------- building the nodes ---------- */
const irCache = new Map();
function impulse(e) {
  const key = `${e.room}|${e.size}|${e.decay}|${actx.sampleRate}`;
  if (irCache.has(key)) return irCache.get(key);
  const base = e.room === 'hall' ? 2.6 : e.room === 'plate' ? 1.6 : 0.7;
  const len = Math.max(0.15, base * (0.3 + (e.size / 100) * 1.4)), sr = actx.sampleRate, n = Math.floor(len * sr);
  const buf = actx.createBuffer(2, n, sr), pow = 1.5 + (1 - e.decay / 100) * 4;
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0; const bright = e.room === 'plate' ? 0.9 : e.room === 'hall' ? 0.45 : 0.6;
    for (let i = 0; i < n; i++) { const r = Math.random() * 2 - 1; lp = lp + (r - lp) * bright; d[i] = lp * Math.pow(1 - i / n, pow); }
  }
  if (irCache.size > 12) irCache.clear();
  irCache.set(key, buf);
  return buf;
}
function makeUnit(e) {
  const A = actx, nodes = [];
  const mk = (n) => (nodes.push(n), n);
  const biq = (type, f, q) => { const b = mk(A.createBiquadFilter()); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; };
  const chain = (list) => { for (let i = 0; i < list.length - 1; i++) list[i].connect(list[i + 1]); return { in: list[0], out: list[list.length - 1] }; };
  const set = (param, v) => { if (Math.abs(param.value - v) > 1e-4) param.setTargetAtTime(v, A.currentTime, 0.015); };
  switch (e.type) {
    case 'feq': {
      const hp = biq('highpass', 20, 0.7), ls = biq('lowshelf', 100), p1 = biq('peaking', 300, 1), p2 = biq('peaking', 1200, 1), p3 = biq('peaking', 4000, 1), hs = biq('highshelf', 10000), lp = biq('lowpass', 20000, 0.7);
      const io = chain([hp, ls, p1, p2, p3, hs, lp]);
      return { ...io, nodes, update: (x) => {
        set(hp.frequency, x.lowcut <= 20 ? 10 : x.lowcut); set(ls.gain, x.lowG);
        set(p1.frequency, x.lmF); set(p1.gain, x.lmG); set(p2.frequency, x.midF); set(p2.gain, x.midG);
        set(p3.frequency, x.hmF); set(p3.gain, x.hmG); set(hs.gain, x.highG); set(lp.frequency, x.highcut >= 20000 ? 22000 : x.highcut);
      } };
    }
    case 'deess': case 'nr': {
      const pre = [];
      let hp = null, notches = [];
      if (e.type === 'nr') { hp = biq('highpass', 80, 0.7); pre.push(hp); for (let i = 1; i <= 3; i++) { const n = biq('notch', 50 * i, 30); notches.push(n); pre.push(n); } }
      let dyn = null;
      if (afxWorkletReady === true) {
        try { dyn = mk(new AudioWorkletNode(A, 'flux-dyn', { processorOptions: { mode: e.type === 'deess' ? 'deess' : 'gate' }, outputChannelCount: [2] })); } catch {}
      }
      if (!dyn && e.type === 'deess') dyn = biq('peaking', 6500, 2); // fallback: a fixed cut while the worklet loads
      const list = [...pre, ...(dyn ? [dyn] : [])];
      if (!list.length) list.push(mk(A.createGain()));
      const io = chain(list);
      let last = '';
      return { ...io, nodes, worklet: !!(dyn && dyn.port), update: (x) => {
        if (hp) set(hp.frequency, x.lowcut <= 20 ? 10 : x.lowcut);
        notches.forEach((n, i) => { const on = x.hum && x.hum !== 'off'; set(n.frequency, (on ? +x.hum : 50) * (i + 1)); set(n.Q, on ? 30 : 0.0001); n.type = on ? 'notch' : 'allpass'; });
        if (dyn && dyn.port) { const s = x.amount + '|' + x.freq; if (s !== last) { last = s; dyn.port.postMessage({ amount: x.amount, freq: x.freq || 6500 }); } }
        else if (dyn) { set(dyn.frequency, x.freq); set(dyn.gain, -x.amount * 0.12); }
      } };
    }
    case 'delay': {
      const inp = mk(A.createGain()), out = mk(A.createGain()), dry = mk(A.createGain()), wet = mk(A.createGain()), fb = mk(A.createGain()), d = mk(A.createDelay(2));
      inp.connect(dry); dry.connect(out); inp.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(out);
      return { in: inp, out, nodes, update: (x) => { set(d.delayTime, x.time / 1000); set(fb.gain, x.feedback / 100); set(wet.gain, x.mix / 100); set(dry.gain, 1 - (x.mix / 100) * 0.4); } };
    }
    case 'limiter': {
      const g = mk(A.createGain()), comp = mk(A.createDynamicsCompressor()), post = mk(A.createGain());
      comp.knee.value = 0; comp.ratio.value = 20; comp.attack.value = 0.002; comp.release.value = 0.08;
      g.connect(comp); comp.connect(post);
      return { in: g, out: post, nodes, update: (x) => { set(g.gain, Math.pow(10, x.input / 20)); set(comp.threshold, x.ceiling - 0.5); } };
    }
    case 'reverb': {
      const inp = mk(A.createGain()), out = mk(A.createGain()), dry = mk(A.createGain()), wet = mk(A.createGain()), conv = mk(A.createConvolver());
      inp.connect(dry); dry.connect(out); inp.connect(conv); conv.connect(wet); wet.connect(out);
      let irKey = '';
      return { in: inp, out, nodes, update: (x) => {
        const k = `${x.room}|${x.size}|${x.decay}`;
        if (k !== irKey) { irKey = k; conv.buffer = impulse(x); }
        set(wet.gain, (x.mix / 100) * 1.4); set(dry.gain, 1 - (x.mix / 100) * 0.5);
      } };
    }
  }
  const g = mk(A.createGain());
  return { in: g, out: g, nodes, update: () => {} };
}
function teardownAudioFx(p) {
  if (!p.afx) return;
  try { p.afxIn.disconnect(); } catch {}
  for (const u of p.afx.units) for (const n of u.nodes) { try { n.disconnect(); } catch {} }
  p.afx = null;
}
function syncAudioFx(p, c) {
  if (!p.high || !actx) return;
  const list = activeAudioFx(c);
  const sig = list.map((e) => e.id + e.type).join(',') + '|' + (afxWorkletReady === true);
  if (!p.afx && !list.length) return;
  if (!p.afxIn) {
    p.afxIn = actx.createGain(); p.afxOut = actx.createGain();
    try { p.high.disconnect(); } catch {}
    p.high.connect(p.afxIn); p.afxOut.connect(masterGain);
  }
  if (!p.afx || p.afx.sig !== sig) {
    teardownAudioFx(p);
    const units = list.map(makeUnit);
    let prev = p.afxIn;
    for (const u of units) { prev.connect(u.in); prev = u.out; }
    prev.connect(p.afxOut);
    p.afx = { sig, units, keys: [] };
  }
  list.forEach((e, i) => {
    const key = JSON.stringify(e);
    if (p.afx.keys[i] !== key) { p.afx.keys[i] = key; try { p.afx.units[i].update(e); } catch (er) { console.warn(er); } }
  });
}
{
  const baseApplyAudioFx = applyAudioFx;
  applyAudioFx = function (p, c) { baseApplyAudioFx(p, c); syncAudioFx(p, c); };
}

/* ---------- inspector ---------- */
let feqCtx = null;
function drawEqCurve(cv, x) {
  const w = cv.width = cv.clientWidth * devicePixelRatio, h = cv.height = cv.clientHeight * devicePixelRatio;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, w, h);
  try { feqCtx = feqCtx || new OfflineAudioContext(1, 1, 48000); } catch { return; }
  const N = 160, f = new Float32Array(N);
  for (let i = 0; i < N; i++) f[i] = 20 * Math.pow(1000, i / (N - 1));
  const total = new Float32Array(N).fill(0);
  const bands = [['highpass', x.lowcut <= 20 ? 10 : x.lowcut, 0.7, 0], ['lowshelf', 100, 1, x.lowG], ['peaking', x.lmF, 1, x.lmG], ['peaking', x.midF, 1, x.midG], ['peaking', x.hmF, 1, x.hmG], ['highshelf', 10000, 1, x.highG], ['lowpass', x.highcut >= 20000 ? 22000 : x.highcut, 0.7, 0]];
  const mag = new Float32Array(N), ph = new Float32Array(N);
  for (const [type, fr, q, gain] of bands) {
    const b = feqCtx.createBiquadFilter(); b.type = type; b.frequency.value = fr; b.Q.value = q; b.gain.value = gain;
    b.getFrequencyResponse(f, mag, ph);
    for (let i = 0; i < N; i++) total[i] += 20 * Math.log10(Math.max(1e-5, mag[i]));
  }
  const y = (db) => h / 2 - (clamp(db, -18, 18) / 18) * (h / 2 - 4 * devicePixelRatio);
  g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1;
  for (const db of [-12, -6, 0, 6, 12]) { g.beginPath(); g.moveTo(0, y(db)); g.lineTo(w, y(db)); g.stroke(); }
  for (const fr of [100, 1000, 10000]) { const xx = (Math.log10(fr / 20) / 3) * w; g.beginPath(); g.moveTo(xx, 0); g.lineTo(xx, h); g.stroke(); }
  g.beginPath();
  for (let i = 0; i < N; i++) { const xx = (i / (N - 1)) * w; i ? g.lineTo(xx, y(total[i])) : g.moveTo(xx, y(total[i])); }
  g.strokeStyle = '#8b6dff'; g.lineWidth = 2 * devicePixelRatio; g.stroke();
  g.lineTo(w, h / 2); g.lineTo(0, h / 2); g.closePath(); g.fillStyle = 'rgba(139,109,255,.15)'; g.fill();
}
function audioFxInspector(body, c) {
  const s = section(body, 'Audio effects', () => { if (c.audio) c.audio.fx = []; });
  const add = el('button', 'btn fx-add', '+ Add audio effect');
  add.onclick = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    contextMenu(r.left, r.bottom + 4, Object.entries(AFX_TYPES).map(([id, t]) => ({ label: t.name, pro: t.pro && !isPremium(), fn: () => addAudioFx(c, id) })));
  };
  s.appendChild(add);
  const list = (c.audio && c.audio.fx) || [];
  for (const fxo of list) {
    const t = AFX_TYPES[fxo.type];
    if (!t) continue;
    const card = el('div', 'fx-card' + (fxo.on === false ? ' off' : ''));
    card.innerHTML = `<div class="fx-top"><label class="fx-on"><input type="checkbox"></label><b></b><span style="flex:1"></span><button class="icon-btn small" data-a="up" data-tip="Move up">↑</button><button class="icon-btn small" data-a="rm" data-tip="Remove">×</button></div>`;
    $('b', card).textContent = t.name + (t.pro && !isPremium() ? ' 👑' : '');
    const cb = $('input', card); cb.checked = fxo.on !== false;
    cb.onchange = () => commit(() => { fxo.on = cb.checked; });
    $('[data-a=rm]', card).onclick = () => commit(() => { c.audio.fx = c.audio.fx.filter((x) => x !== fxo); });
    $('[data-a=up]', card).onclick = () => commit(() => { const i = c.audio.fx.indexOf(fxo); if (i > 0) { c.audio.fx.splice(i, 1); c.audio.fx.splice(i - 1, 0, fxo); } });
    let curve = null;
    if (fxo.type === 'feq') {
      curve = el('canvas', 'feq-curve'); card.appendChild(curve);
      chips(card, FEQ_PRESETS.map(([n]) => ({ label: n, value: n })), null, (n) => commit(() => {
        const base = newAudioFx('feq'); for (const [k] of t.params) fxo[k] = base[k];
        Object.assign(fxo, FEQ_PRESETS.find((p) => p[0] === n)[1]);
      }));
    }
    if (t.choice) {
      const [k, label, opts] = t.choice;
      const row = el('div', 'field'); row.innerHTML = `<label></label>`; row.firstChild.textContent = label;
      chips(row, opts.map(([v, l]) => ({ label: l, value: v })), fxo[k], (v) => commit(() => { fxo[k] = v; }));
      card.appendChild(row);
    }
    for (const [k, label, mn, mx, d, f] of t.params) {
      const step = mx - mn > 2000 ? 10 : mx - mn > 200 ? 5 : mx - mn <= 30 ? 0.5 : 1;
      slider(card, label, { min: mn, max: mx, step, get: () => fxo[k], set: (v) => { fxo[k] = v; if (curve) drawEqCurve(curve, fxo); }, fmt: f, def: d, live: false });
    }
    s.appendChild(card);
    if (curve) requestAnimationFrame(() => drawEqCurve(curve, fxo));
  }
  if (!list.length) { const p = el('p', 'hint'); p.textContent = 'EQ, de-esser, noise reduction, delay, limiter and reverb. They play live and are in your export.'; s.appendChild(p); }
}
