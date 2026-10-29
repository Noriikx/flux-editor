/* Flux — creative audio effects: make any sound distorted, glitched, insanely loud, robotic, underwater, chipmunk…
   Built only from Web Audio nodes, so they play live while editing and render the same in the export
   (the export builds the same units in an OfflineAudioContext). */
'use strict';
const pct = (v) => Math.round(v) + '%';
const semis = (v) => (v > 0 ? '+' : '') + (+v).toFixed(1).replace('.0', '') + ' st';
Object.assign(AFX_TYPES, {
  loud: { name: 'Ultra loud (distorted)', group: 'Loud & broken', params: [['amount', 'Loudness', 0, 100, 80, pct], ['bass', 'Bass boost', 0, 24, 12, dbf], ['crunch', 'Crunch', 0, 100, 70, pct]] },
  distort: { name: 'Distortion', group: 'Loud & broken', params: [['drive', 'Drive', 0, 100, 50, pct], ['tone', 'Tone', 500, 12000, 5000, hz], ['mix', 'Mix', 0, 100, 100, pct]] },
  crush: { name: 'Bitcrusher / 8-bit', group: 'Loud & broken', params: [['bits', 'Bits', 2, 12, 5, (v) => Math.round(v) + '-bit'], ['tone', 'Tone', 1000, 16000, 6000, hz], ['mix', 'Mix', 0, 100, 100, pct]] },
  glitch: { name: 'Glitch', group: 'Loud & broken', params: [['amount', 'Strength', 0, 100, 70, pct], ['every', 'Pause between glitches', 0.3, 8, 1.5, (v) => (+v).toFixed(1) + 's'], ['length', 'Glitch length', 0.05, 1.5, 0.35, (v) => (+v).toFixed(2) + 's']] },
  pitch: { name: 'Pitch (chipmunk / deep)', group: 'Voice changers', params: [['semi', 'Pitch', -12, 12, 6, semis], ['mix', 'Mix', 0, 100, 100, pct]], presets: [['Chipmunk', { semi: 8 }], ['Higher', { semi: 4 }], ['Deep', { semi: -5 }], ['Demon', { semi: -10 }]] },
  robot: { name: 'Robot', group: 'Voice changers', params: [['freq', 'Robot pitch', 20, 300, 60, hz], ['amount', 'Amount', 0, 100, 100, pct]] },
  phone: { name: 'Telephone', group: 'Voice changers', params: [['amount', 'Amount', 0, 100, 100, pct]] },
  radio: { name: 'Walkie-talkie / radio', group: 'Voice changers', params: [['amount', 'Amount', 0, 100, 100, pct], ['noise', 'Static', 0, 100, 25, pct]] },
  megaphone: { name: 'Megaphone', group: 'Voice changers', params: [['amount', 'Amount', 0, 100, 100, pct]] },
  underwater: { name: 'Underwater', group: 'Voice changers', params: [['depth', 'Depth', 0, 100, 70, pct]] },
  faraway: { name: 'Far away / other room', group: 'Voice changers', params: [['distance', 'Distance', 0, 100, 60, pct]] },
  chorus: { name: 'Chorus', group: 'Movement', params: [['depth', 'Depth', 0, 100, 50, pct], ['rate', 'Speed', 0.1, 5, 1.2, (v) => (+v).toFixed(1) + 'Hz'], ['mix', 'Mix', 0, 100, 50, pct]] },
  flanger: { name: 'Flanger', group: 'Movement', params: [['depth', 'Depth', 0, 100, 60, pct], ['rate', 'Speed', 0.05, 3, 0.3, (v) => (+v).toFixed(2) + 'Hz'], ['feedback', 'Feedback', 0, 90, 50, pct]] },
  phaser: { name: 'Phaser', group: 'Movement', params: [['depth', 'Depth', 0, 100, 70, pct], ['rate', 'Speed', 0.05, 4, 0.5, (v) => (+v).toFixed(2) + 'Hz'], ['mix', 'Mix', 0, 100, 60, pct]] },
  tremolo: { name: 'Tremolo', group: 'Movement', params: [['depth', 'Depth', 0, 100, 70, pct], ['rate', 'Speed', 0.5, 20, 6, (v) => (+v).toFixed(1) + 'Hz']] },
  vibrato: { name: 'Wobble (vibrato)', group: 'Movement', params: [['depth', 'Depth', 0, 100, 40, pct], ['rate', 'Speed', 0.5, 12, 5, (v) => (+v).toFixed(1) + 'Hz']] },
  autopan: { name: 'Auto-pan (left ↔ right)', group: 'Movement', params: [['depth', 'Width', 0, 100, 90, pct], ['rate', 'Speed', 0.05, 8, 0.5, (v) => (+v).toFixed(2) + 'Hz']] },
  bassboost: { name: 'Bass boost', group: 'Tone', params: [['amount', 'Boost', 0, 24, 12, dbf], ['freq', 'Frequency', 40, 200, 90, hz]] },
  lofi: { name: 'Lo-fi / vinyl', group: 'Tone', params: [['amount', 'Amount', 0, 100, 70, pct], ['crackle', 'Crackle', 0, 100, 40, pct], ['wobble', 'Wow & flutter', 0, 100, 30, pct]] }
});
// the old six are in their own groups for the menu
for (const k of ['feq', 'deess', 'nr', 'limiter']) AFX_TYPES[k].group = 'Clean up';
for (const k of ['delay', 'reverb']) AFX_TYPES[k].group = 'Space';
const AFX_GROUPS = ['Loud & broken', 'Voice changers', 'Movement', 'Tone', 'Space', 'Clean up'];

// ---------- helpers ----------
const afxCurves = new Map();
function softClipCurve(k) {
  const key = 'soft' + Math.round(k);
  if (afxCurves.has(key)) return afxCurves.get(key);
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
  afxCurves.set(key, c); return c;
}
function hardClipCurve(drive) {
  const key = 'hard' + Math.round(drive * 10);
  if (afxCurves.has(key)) return afxCurves.get(key);
  const n = 4096, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.max(-1, Math.min(1, Math.tanh(x * drive) * 1.15)); }
  afxCurves.set(key, c); return c;
}
function crushCurve(bits) {
  const key = 'crush' + Math.round(bits);
  if (afxCurves.has(key)) return afxCurves.get(key);
  const n = 65536, c = new Float32Array(n), steps = Math.pow(2, Math.round(bits) - 1);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.round(x * steps) / steps; }
  afxCurves.set(key, c); return c;
}
function seeded(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const idSeed = (id) => String(id || 'x').split('').reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
const noiseBufs = new Map();
function noiseBuffer(A, kind) {
  const key = kind + A.sampleRate + (A instanceof OfflineAudioContext ? 'o' : 'l');
  if (noiseBufs.has(key) && !(A instanceof OfflineAudioContext)) return noiseBufs.get(key);
  const len = Math.round(A.sampleRate * 3), b = A.createBuffer(1, len, A.sampleRate), d = b.getChannelData(0), R = seeded(kind === 'crackle' ? 99 : 7);
  for (let i = 0; i < len; i++) {
    if (kind === 'crackle') d[i] = R() < 0.0009 ? (R() * 2 - 1) * (0.4 + R() * 0.6) : (R() * 2 - 1) * 0.015;
    else d[i] = R() * 2 - 1;
  }
  if (!(A instanceof OfflineAudioContext)) noiseBufs.set(key, b);
  return b;
}
// a looping control signal (drives gains / delay times) - here: glitch bursts
function glitchControl(A, e) {
  const sr = Math.min(A.sampleRate, 48000), every = Math.max(0.3, +e.every || 1.5), len = clamp(+e.length || 0.35, 0.05, every);
  const cycles = Math.max(4, Math.ceil(12 / every)), total = Math.round(every * cycles * sr);
  const mute = A.createBuffer(1, total, sr), wet = A.createBuffer(1, total, sr), dly = A.createBuffer(1, total, sr);
  const m = mute.getChannelData(0), w = wet.getChannelData(0), dl = dly.getChannelData(0), R = seeded(idSeed(e.id));
  for (let c = 0; c < cycles; c++) {
    const start = Math.round((c * every + R() * (every - len) * 0.9) * sr), n = Math.round(len * sr);
    let i = 0;
    while (i < n) {
      const seg = Math.round((0.02 + R() * 0.07) * sr), kind = R();
      const d = 0.02 + R() * 0.12;
      for (let j = 0; j < seg && i < n; j++, i++) {
        const k = start + i; if (k >= total) break;
        if (kind < 0.35) { m[k] = -1; w[k] = 0; } // drop-out
        else if (kind < 0.85) { m[k] = -1; w[k] = 1; dl[k] = d; } // stutter (repeat a tiny slice)
        else { m[k] = 0; w[k] = 0.6; dl[k] = d * 0.3; } // smear
      }
    }
  }
  return { mute, wet, dly };
}
function loopSource(A, buf, mk) { const s = mk(A.createBufferSource()); s.buffer = buf; s.loop = true; s.start(); return s; }
function lfo(A, mk, type, rate) { const o = mk(A.createOscillator()); o.type = type; o.frequency.value = rate; o.start(); return o; }
function konst(A, mk, v) { const c = mk(A.createConstantSource()); c.offset.value = v; c.start(); return c; }
let cosWave = null;
function windowWave(A) { // cos(2πt): 1 at the start of a cycle, -1 halfway (used as a crossfade window)
  if (cosWave && cosWave.ctx === A) return cosWave.w;
  const w = A.createPeriodicWave(new Float32Array([0, 1]), new Float32Array([0, 0]), { disableNormalization: true });
  cosWave = { ctx: A, w }; return w;
}

// ---------- the effects ----------
const baseMakeUnit = makeUnit;
makeUnit = function (e, A = actx, workletOk = afxWorkletReady === true, instant = false) {
  if (!['loud', 'distort', 'crush', 'glitch', 'pitch', 'robot', 'phone', 'radio', 'megaphone', 'underwater', 'faraway', 'chorus', 'flanger', 'phaser', 'tremolo', 'vibrato', 'autopan', 'bassboost', 'lofi'].includes(e.type)) return baseMakeUnit(e, A, workletOk, instant);
  const nodes = [];
  const mk = (n) => (nodes.push(n), n);
  const G = (v = 1) => { const g = mk(A.createGain()); g.gain.value = v; return g; };
  const biq = (type, f, q, gain) => { const b = mk(A.createBiquadFilter()); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (gain != null) b.gain.value = gain; return b; };
  const shaper = (curve) => { const s = mk(A.createWaveShaper()); s.curve = curve; s.oversample = '4x'; return s; };
  const set = (param, v) => { if (instant) { param.value = v; return; } if (Math.abs(param.value - v) > 1e-4) param.setTargetAtTime(v, A.currentTime, 0.02); };
  const inp = G(), out = G(), dry = G(), wet = G();
  const unit = (update) => ({ in: inp, out, nodes, update });
  const dryWet = () => { inp.connect(dry); dry.connect(out); wet.connect(out); };
  switch (e.type) {
    case 'loud': {
      // way too much gain -> bass boost -> hard clipping -> a bit more crunch. Loud on purpose.
      const pre = G(), bass = biq('lowshelf', 120, null, 12), mid = biq('peaking', 2500, 0.8, 6), clip = shaper(hardClipCurve(8)), post = G(0.9);
      inp.connect(pre); pre.connect(bass); bass.connect(mid); mid.connect(clip); clip.connect(post); post.connect(out);
      return unit((x) => { set(pre.gain, Math.pow(10, (6 + x.amount * 0.34) / 20)); set(bass.gain, x.bass); clip.curve = hardClipCurve(1 + x.crunch / 6); set(mid.gain, x.crunch / 12); });
    }
    case 'distort': {
      dryWet();
      const pre = G(), ws = shaper(softClipCurve(50)), tone = biq('lowpass', 5000, 0.7), post = G(0.7);
      inp.connect(pre); pre.connect(ws); ws.connect(tone); tone.connect(post); post.connect(wet);
      return unit((x) => { ws.curve = softClipCurve(2 + x.drive * 3); set(pre.gain, 1 + x.drive / 25); set(tone.frequency, x.tone); set(wet.gain, x.mix / 100); set(dry.gain, 1 - x.mix / 100); });
    }
    case 'crush': {
      dryWet();
      const ws = shaper(crushCurve(5)), tone = biq('lowpass', 6000, 2.5);
      ws.oversample = 'none';
      inp.connect(ws); ws.connect(tone); tone.connect(wet);
      return unit((x) => { ws.curve = crushCurve(x.bits); set(tone.frequency, x.tone); set(wet.gain, x.mix / 100); set(dry.gain, 1 - x.mix / 100); });
    }
    case 'glitch': {
      // dry is muted / stuttered by looping control signals made from the clip's own random seed
      inp.connect(dry); dry.connect(out);
      const d = mk(A.createDelay(1)), fb = G(0.75), wg = G(0);
      inp.connect(d); d.connect(fb); fb.connect(d); d.connect(wg); wg.connect(out);
      const amt = G(1), wamt = G(1), damt = G(1);
      let srcs = [], key = '';
      const build = (x) => {
        for (const s of srcs) { try { s.stop(); s.disconnect(); } catch {} }
        const c = glitchControl(A, x);
        const sm = loopSource(A, c.mute, mk), sw = loopSource(A, c.wet, mk), sd = loopSource(A, c.dly, mk);
        sm.connect(amt); amt.connect(dry.gain); sw.connect(wamt); wamt.connect(wg.gain); sd.connect(damt); damt.connect(d.delayTime);
        srcs = [sm, sw, sd];
      };
      d.delayTime.value = 0.001;
      return unit((x) => { const k = x.every + '|' + x.length; if (k !== key) { key = k; build(x); } set(amt.gain, x.amount / 100); set(wamt.gain, x.amount / 100); });
    }
    case 'pitch': {
      // delay-line pitch shifter: two taps whose delay ramps like a saw, crossfaded with cosine windows
      dryWet();
      const W = 0.06, taps = [];
      for (let t = 0; t < 2; t++) {
        const dl = mk(A.createDelay(0.2)), win = G(0), saw = mk(A.createOscillator()), sawG = G(0), off = konst(A, mk, W / 2 + 0.004), wo = mk(A.createOscillator()), woG = G(0.5), wc = konst(A, mk, 0.5);
        saw.type = 'sawtooth'; wo.setPeriodicWave(windowWave(A));
        dl.delayTime.value = 0;
        saw.connect(sawG); sawG.connect(dl.delayTime); off.connect(dl.delayTime);
        wo.connect(woG); woG.connect(win.gain); wc.connect(win.gain);
        inp.connect(dl); dl.connect(win); win.connect(wet);
        taps.push({ saw, sawG, wo, started: false });
      }
      let started = false;
      return unit((x) => {
        const ratio = Math.pow(2, x.semi / 12), f = Math.max(0.01, Math.abs(1 - ratio) / W);
        taps.forEach((tp) => { set(tp.saw.frequency, f); set(tp.wo.frequency, f); set(tp.sawG.gain, (ratio > 1 ? -1 : 1) * W / 2); });
        if (!started) { started = true; const t0 = A.currentTime; taps.forEach((tp, i) => { const at = t0 + (i ? 0.5 / f : 0); tp.saw.start(at); tp.wo.start(at); }); }
        set(wet.gain, (x.mix / 100) * (Math.abs(x.semi) < 0.05 ? 0 : 1)); set(dry.gain, Math.abs(x.semi) < 0.05 ? 1 : 1 - x.mix / 100);
      });
    }
    case 'robot': {
      dryWet();
      const ring = G(0), car = lfo(A, mk, 'sine', 60), comb = mk(A.createDelay(0.1)), fb = G(0.55), hp = biq('highpass', 120, 0.7);
      car.connect(ring.gain);
      inp.connect(ring); ring.connect(comb); comb.connect(fb); fb.connect(comb); ring.connect(hp); comb.connect(hp); hp.connect(wet);
      return unit((x) => { set(car.frequency, x.freq); set(comb.delayTime, 1 / Math.max(20, x.freq * 2)); set(wet.gain, (x.amount / 100) * 1.6); set(dry.gain, 1 - x.amount / 100); });
    }
    case 'phone': case 'radio': case 'megaphone': {
      dryWet();
      const isR = e.type === 'radio', isM = e.type === 'megaphone';
      const hp = biq('highpass', isM ? 500 : isR ? 450 : 320, 0.9), lp = biq('lowpass', isM ? 4200 : isR ? 2800 : 3400, 0.9), pk = biq('peaking', isM ? 2000 : 1500, 1.2, isM ? 9 : 6);
      const ws = shaper(isM ? hardClipCurve(4) : softClipCurve(isR ? 25 : 8)), lvl = G(isM ? 0.7 : 0.9);
      inp.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(ws); ws.connect(lvl); lvl.connect(wet);
      let ng = null;
      if (isR) { const n = loopSource(A, noiseBuffer(A, 'white'), mk), nb = biq('bandpass', 2500, 0.8); ng = G(0); n.connect(nb); nb.connect(ng); ng.connect(wet); }
      return unit((x) => { set(wet.gain, x.amount / 100); set(dry.gain, 1 - x.amount / 100); if (ng) set(ng.gain, (x.noise / 100) * 0.08); });
    }
    case 'underwater': {
      const lp = biq('lowpass', 500, 4), d = mk(A.createDelay(0.1)), o = lfo(A, mk, 'sine', 0.6), og = G(0.004), cd = konst(A, mk, 0.012), boost = G(1.4);
      o.connect(og); og.connect(d.delayTime); cd.connect(d.delayTime); d.delayTime.value = 0;
      inp.connect(lp); lp.connect(d); d.connect(boost); boost.connect(out);
      return unit((x) => { set(lp.frequency, 1600 - x.depth * 13); set(lp.Q, 1 + x.depth / 20); set(og.gain, 0.001 + x.depth * 0.00005); });
    }
    case 'faraway': {
      const lp = biq('lowpass', 2000, 0.7), conv = mk(A.createConvolver()), wg = G(0.6), dg = G(0.5);
      conv.buffer = impulse({ room: 'hall', size: 70, decay: 45 }, A);
      inp.connect(lp); lp.connect(dg); dg.connect(out); lp.connect(conv); conv.connect(wg); wg.connect(out);
      return unit((x) => { set(lp.frequency, 6000 - x.distance * 52); set(dg.gain, 0.9 - x.distance * 0.0065); set(wg.gain, 0.15 + x.distance * 0.0085); });
    }
    case 'chorus': {
      dryWet();
      const voices = [0.012, 0.019, 0.027].map((base, i) => {
        const d = mk(A.createDelay(0.1)), o = lfo(A, mk, 'sine', 1.2 * (1 + i * 0.13)), og = G(0.003), c = konst(A, mk, base);
        d.delayTime.value = 0; o.connect(og); og.connect(d.delayTime); c.connect(d.delayTime);
        inp.connect(d); d.connect(wet); return { o, og };
      });
      return unit((x) => { voices.forEach((v, i) => { set(v.o.frequency, x.rate * (1 + i * 0.13)); set(v.og.gain, 0.0005 + x.depth * 0.00005); }); set(wet.gain, (x.mix / 100) * 0.6); set(dry.gain, 1 - (x.mix / 100) * 0.4); });
    }
    case 'flanger': {
      dryWet();
      const d = mk(A.createDelay(0.05)), o = lfo(A, mk, 'sine', 0.3), og = G(0.002), c = konst(A, mk, 0.003), fb = G(0.5);
      d.delayTime.value = 0; o.connect(og); og.connect(d.delayTime); c.connect(d.delayTime);
      inp.connect(d); d.connect(fb); fb.connect(d); d.connect(wet);
      return unit((x) => { set(o.frequency, x.rate); set(og.gain, 0.0002 + x.depth * 0.000028); set(fb.gain, x.feedback / 100); set(wet.gain, 0.7); set(dry.gain, 0.7); });
    }
    case 'phaser': {
      dryWet();
      const o = lfo(A, mk, 'sine', 0.5), og = G(600), stages = [];
      let prev = inp;
      for (let i = 0; i < 4; i++) { const ap = biq('allpass', 800 + i * 250, 0.7); o.connect(og); og.connect(ap.frequency); prev.connect(ap); prev = ap; stages.push(ap); }
      prev.connect(wet);
      return unit((x) => { set(o.frequency, x.rate); set(og.gain, 100 + x.depth * 9); set(wet.gain, x.mix / 100); set(dry.gain, 1 - (x.mix / 100) * 0.5); });
    }
    case 'tremolo': {
      const g = G(1), o = lfo(A, mk, 'sine', 6), og = G(0.35);
      o.connect(og); og.connect(g.gain);
      inp.connect(g); g.connect(out);
      return unit((x) => { set(o.frequency, x.rate); set(og.gain, x.depth / 200); set(g.gain, 1 - x.depth / 200); });
    }
    case 'vibrato': {
      const d = mk(A.createDelay(0.05)), o = lfo(A, mk, 'sine', 5), og = G(0.002), c = konst(A, mk, 0.008);
      d.delayTime.value = 0; o.connect(og); og.connect(d.delayTime); c.connect(d.delayTime);
      inp.connect(d); d.connect(out);
      return unit((x) => { set(o.frequency, x.rate); set(og.gain, 0.0001 + x.depth * 0.00006); });
    }
    case 'autopan': {
      const p = mk(A.createStereoPanner()), o = lfo(A, mk, 'sine', 0.5), og = G(0.9);
      o.connect(og); og.connect(p.pan);
      inp.connect(p); p.connect(out);
      return unit((x) => { set(o.frequency, x.rate); set(og.gain, x.depth / 100); });
    }
    case 'bassboost': {
      const ls = biq('lowshelf', 90, null, 12), comp = mk(A.createDynamicsCompressor());
      comp.threshold.value = -10; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.15;
      inp.connect(ls); ls.connect(comp); comp.connect(out);
      return unit((x) => { set(ls.gain, x.amount); set(ls.frequency, x.freq); });
    }
    case 'lofi': {
      const hp = biq('highpass', 150, 0.7), lp = biq('lowpass', 4000, 0.8), ws = shaper(softClipCurve(3)), d = mk(A.createDelay(0.05)), o = lfo(A, mk, 'sine', 0.7), og = G(0.0008), c = konst(A, mk, 0.006);
      d.delayTime.value = 0; o.connect(og); og.connect(d.delayTime); c.connect(d.delayTime);
      const lv = G(0.5);
      inp.connect(hp); hp.connect(lp); lp.connect(ws); ws.connect(lv); lv.connect(d); d.connect(out);
      const cr = loopSource(A, noiseBuffer(A, 'crackle'), mk), cg = G(0); cr.connect(cg); cg.connect(out);
      return unit((x) => { set(lp.frequency, 9000 - x.amount * 60); set(hp.frequency, 40 + x.amount * 2); set(cg.gain, (x.crackle / 100) * 0.5); set(og.gain, x.wobble * 0.00004); });
    }
  }
  return baseMakeUnit(e, A, workletOk, instant);
};
// stop the oscillators / loops of a removed effect too
{
  const baseTeardown = teardownAudioFx;
  teardownAudioFx = function (p) {
    if (p && p.afx) for (const u of p.afx.units) for (const n of u.nodes) { if (n.stop) { try { n.stop(); } catch {} } }
    return baseTeardown.apply(this, arguments);
  };
}
// grouped "+ Add audio effect" menu
{
  const baseInspector = audioFxInspector;
  audioFxInspector = function (body, c) {
    c = audioFxTarget(c) || c;
    baseInspector(body, c);
    const add = [...body.querySelectorAll('.fx-add')].pop();
    if (add) add.onclick = (ev) => {
      const r = ev.currentTarget.getBoundingClientRect(), items = [];
      for (const gname of AFX_GROUPS) {
        const list = Object.entries(AFX_TYPES).filter(([, t]) => (t.group || 'Clean up') === gname);
        if (!list.length) continue;
        items.push({ label: gname.toUpperCase(), disabled: true, fn: () => {} });
        for (const [id, t] of list) items.push({ label: '   ' + t.name, pro: t.pro && !isPremium(), fn: () => addAudioFx(c, id) });
      }
      contextMenu(r.left, Math.max(8, Math.min(r.bottom + 4, innerHeight - 560)), items);
    };
    // quick presets for effects that have them (e.g. Chipmunk / Deep voice)
    const cards = [...body.querySelectorAll('.fx-card')], list = (c.audio && c.audio.fx) || [];
    list.forEach((fxo, i) => {
      const t = AFX_TYPES[fxo.type], card = cards[i];
      if (!t || !t.presets || !card) return;
      const row = el('div', 'field');
      chips(row, t.presets.map(([n]) => ({ label: n, value: n })), null, (n) => commit(() => Object.assign(fxo, t.presets.find((p) => p[0] === n)[1])));
      card.insertBefore(row, card.children[1] || null);
    });
    const hint = [...body.querySelectorAll('.hint')].find((p) => /EQ, de-esser/.test(p.textContent));
    if (hint) hint.textContent = 'Make it distorted, glitched, insanely loud, robotic, chipmunk, underwater… or clean it up with EQ and noise reduction. They play live and are in your export.';
  };
}

/* ---------- "Audio FX" tab in the library: the easy place to find sound effects ---------- */
const AFX_ICONS = { loud: '📢', distort: '🔥', crush: '👾', glitch: '⚡', pitch: '🐿️', robot: '🤖', phone: '☎️', radio: '📻', megaphone: '📣', underwater: '🌊', faraway: '🚪', chorus: '🎶', flanger: '🌀', phaser: '🌗', tremolo: '〰️', vibrato: '🥴', autopan: '↔️', bassboost: '🔊', lofi: '📀', delay: '🔁', reverb: '⛪', limiter: '🧱', feq: '🎚️', deess: '🐍', nr: '🧹' };
function renderAfxTab() {
  const page = document.querySelector('[data-page=afx]');
  if (!page) return;
  const sel = getClip(state.selectedId), target = sel ? audioFxTarget(sel) : null;
  const on = new Set(((target && target.audio && target.audio.fx) || []).map((e) => e.type));
  page.innerHTML = `<p class="page-intro">${target ? `Click to add to <b></b> - or drag onto any clip with sound.` : 'Select a clip with sound (or a video), then click an effect - or drag one onto a clip.'}</p>`;
  if (target) $('b', page).textContent = clipLabel(target);
  for (const gname of AFX_GROUPS) {
    const list = Object.entries(AFX_TYPES).filter(([, t]) => (t.group || 'Clean up') === gname);
    if (!list.length) continue;
    page.appendChild(el('div', 'help-title', gname));
    const grid = el('div', 'afx-grid');
    for (const [id, t] of list) {
      const b = el('button', 'afx-tile' + (on.has(id) ? ' active' : ''), `<span class="afx-ico">${AFX_ICONS[id] || '🎵'}</span><span class="afx-name"></span>${t.pro && !isPremium() ? '<i class="afx-pro">' + CROWN + '</i>' : ''}`);
      $('.afx-name', b).textContent = t.name;
      b.dataset.tip = on.has(id) ? 'Already on this clip - click to add another one' : 'Add ' + t.name;
      b.draggable = true;
      b.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/flux-afx', id); ev.dataTransfer.effectAllowed = 'copy'; });
      b.onclick = () => {
        const c = getClip(state.selectedId);
        if (!c || !audioFxTarget(c)) return toast('Select a clip with sound first');
        addAudioFx(c, id);
        renderAfxTab();
      };
      grid.appendChild(b);
    }
    page.appendChild(grid);
  }
}
(function setupAfxTab() {
  const tabs = document.getElementById('libTabs'), lib = document.getElementById('library');
  if (!tabs || !lib || document.querySelector('[data-tab=afx]')) return;
  const tab = el('button', 'tab', '<svg viewBox="0 0 24 24"><path d="M3 12h2l2-6 3 12 3-9 2 5 2-2h4"/></svg>Audio FX');
  tab.dataset.tab = 'afx';
  const filters = tabs.querySelector('[data-tab=filters]');
  tabs.insertBefore(tab, filters ? filters.nextSibling : null);
  const page = el('section', 'tab-page'); page.dataset.page = 'afx';
  lib.appendChild(page);
  tab.addEventListener('click', () => showLibTab('afx'));
  const baseShow = showLibTab;
  showLibTab = function (name) { const r = baseShow.apply(this, arguments); if (name === 'afx') renderAfxTab(); return r; };
  // keep it in step with the selected clip
  const baseInsp = renderInspector;
  renderInspector = function () { const r = baseInsp.apply(this, arguments); if (currentLibTab === 'afx') renderAfxTab(); return r; };
  // drop an effect onto a clip on the timeline
  tlLanes.addEventListener('drop', (e) => {
    const id = e.dataTransfer.getData('text/flux-afx');
    if (!id) return;
    e.preventDefault(); e.stopPropagation();
    const ce = e.target.closest && e.target.closest('.clip');
    let c = ce ? getClip(ce.dataset.id) : null;
    if (!c) { const t = timeAtClientX(e.clientX); c = P.clips.find((x) => (x.kind === 'audio' || x.kind === 'video') && t >= x.start && t < endOf(x)); }
    if (!c || !audioFxTarget(c)) return toast('Drop it onto a clip with sound');
    select(c.id);
    addAudioFx(c, id);
  }, true);
})();
