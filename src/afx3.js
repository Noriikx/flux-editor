/* Flux 5.1 — more audio effects in every group, and proper icons for the Audio FX tab (no more emojis).
   Same rules as afx2.js: plain Web Audio nodes, so they play live and render the same in the export. */
'use strict';
const hzs = (v) => (+v).toFixed(v < 1 ? 2 : 1) + 'Hz';
Object.assign(AFX_TYPES, {
  // Loud & broken
  overdrive: { name: 'Overdrive (guitar amp)', group: 'Loud & broken', params: [['drive', 'Drive', 0, 100, 60, pct], ['tone', 'Tone', 800, 8000, 3200, hz], ['level', 'Level', 0, 100, 70, pct]] },
  blown: { name: 'Blown speaker', group: 'Loud & broken', params: [['amount', 'Amount', 0, 100, 80, pct], ['rattle', 'Rattle', 0, 100, 50, pct]] },
  stutter: { name: 'Stutter / gate', group: 'Loud & broken', params: [['rate', 'Speed', 1, 16, 8, hzs], ['depth', 'Depth', 0, 100, 100, pct], ['shape', 'Hardness', 0, 100, 80, pct]] },
  // Voice changers
  alien: { name: 'Alien', group: 'Voice changers', params: [['amount', 'Amount', 0, 100, 100, pct], ['wobble', 'Wobble', 0, 100, 50, pct]] },
  monster: { name: 'Monster', group: 'Voice changers', params: [['depth', 'Depth', 0, 100, 70, pct], ['growl', 'Growl', 0, 100, 50, pct]] },
  ghost: { name: 'Ghost', group: 'Voice changers', params: [['amount', 'Amount', 0, 100, 80, pct], ['tail', 'Echo tail', 0, 100, 60, pct]] },
  // Movement
  rotary: { name: 'Rotating speaker', group: 'Movement', params: [['rate', 'Speed', 0.3, 8, 4, hzs], ['depth', 'Depth', 0, 100, 60, pct]] },
  wah: { name: 'Auto-wah / filter sweep', group: 'Movement', params: [['rate', 'Speed', 0.05, 6, 1, hzs], ['depth', 'Range', 0, 100, 70, pct], ['q', 'Sharpness', 1, 15, 6, (v) => (+v).toFixed(1)]] },
  // Tone
  treble: { name: 'Treble boost (brighter)', group: 'Tone', params: [['amount', 'Boost', 0, 18, 8, dbf], ['freq', 'From', 2000, 10000, 4500, hz]] },
  muffled: { name: 'Muffled (through a wall)', group: 'Tone', params: [['amount', 'Amount', 0, 100, 70, pct]] },
  oldradio: { name: 'Old radio (1940s)', group: 'Tone', params: [['amount', 'Amount', 0, 100, 100, pct], ['crackle', 'Crackle', 0, 100, 35, pct]] },
  // Space
  echo: { name: 'Canyon echo', group: 'Space', params: [['time', 'Echo time', 100, 900, 380, (v) => Math.round(v) + 'ms'], ['repeats', 'Repeats', 0, 90, 55, pct], ['mix', 'Mix', 0, 100, 40, pct]] },
  pingpong: { name: 'Ping-pong delay', group: 'Space', params: [['time', 'Time', 60, 800, 250, (v) => Math.round(v) + 'ms'], ['feedback', 'Feedback', 0, 85, 45, pct], ['mix', 'Mix', 0, 100, 35, pct]] },
  stadium: { name: 'Stadium / arena', group: 'Space', params: [['size', 'Size', 0, 100, 80, pct], ['mix', 'Mix', 0, 100, 45, pct]] },
  // Clean up
  voiceboost: { name: 'Podcast voice', group: 'Clean up', params: [['amount', 'Amount', 0, 100, 70, pct], ['warmth', 'Warmth', 0, 100, 50, pct]] },
  compress: { name: 'Compressor (even volume)', group: 'Clean up', params: [['amount', 'Amount', 0, 100, 60, pct], ['makeup', 'Make louder', 0, 18, 6, dbf]] },
  clarity: { name: 'Speech clarity', group: 'Clean up', params: [['amount', 'Amount', 0, 100, 60, pct]] }
});
const AFX3 = ['overdrive', 'blown', 'stutter', 'alien', 'monster', 'ghost', 'rotary', 'wah', 'treble', 'muffled', 'oldradio', 'echo', 'pingpong', 'stadium', 'voiceboost', 'compress', 'clarity'];
// a square-ish gate shape for the stutter effect (sine pushed through a shaper)
function gateCurve(hard) {
  const key = 'gate' + Math.round(hard);
  if (afxCurves.has(key)) return afxCurves.get(key);
  const n = 1024, c = new Float32Array(n), k = 1 + hard / 4;
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); }
  afxCurves.set(key, c); return c;
}
{
  const base = makeUnit;
  makeUnit = function (e, A = actx, workletOk = afxWorkletReady === true, instant = false) {
    if (!AFX3.includes(e.type)) return base(e, A, workletOk, instant);
    const nodes = [];
    const mk = (n) => (nodes.push(n), n);
    const G = (v = 1) => { const g = mk(A.createGain()); g.gain.value = v; return g; };
    const biq = (type, f, q, gain) => { const b = mk(A.createBiquadFilter()); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (gain != null) b.gain.value = gain; return b; };
    const shaper = (curve, os = '4x') => { const s = mk(A.createWaveShaper()); s.curve = curve; s.oversample = os; return s; };
    const set = (param, v) => { if (instant) { param.value = v; return; } if (Math.abs(param.value - v) > 1e-4) param.setTargetAtTime(v, A.currentTime, 0.02); };
    const inp = G(), out = G(), dry = G(), wet = G();
    const unit = (update) => ({ in: inp, out, nodes, update });
    const dryWet = () => { inp.connect(dry); dry.connect(out); wet.connect(out); };
    const delayLine = (max, t) => { const d = mk(A.createDelay(max)); d.delayTime.value = t; return d; };
    const modDelay = (base0, amt, rate, type = 'sine') => { // a delay whose time wobbles (for pitch wobble / chorus-like)
      const d = delayLine(0.2, 0), o = lfo(A, mk, type, rate), og = G(amt), c = konst(A, mk, base0);
      o.connect(og); og.connect(d.delayTime); c.connect(d.delayTime); return { d, o, og };
    };
    const pitchShift = (into, semi) => { // two-tap delay pitch shifter (same idea as the Pitch effect)
      const W = 0.06, ratio = Math.pow(2, semi / 12), f = Math.max(0.01, Math.abs(1 - ratio) / W), sum = G(1);
      for (let t = 0; t < 2; t++) {
        const dl = delayLine(0.2, 0), win = G(0), saw = mk(A.createOscillator()), sawG = G((ratio > 1 ? -1 : 1) * W / 2), off = konst(A, mk, W / 2 + 0.004), wo = mk(A.createOscillator()), woG = G(0.5), wc = konst(A, mk, 0.5);
        saw.type = 'sawtooth'; wo.setPeriodicWave(windowWave(A)); saw.frequency.value = f; wo.frequency.value = f;
        saw.connect(sawG); sawG.connect(dl.delayTime); off.connect(dl.delayTime); wo.connect(woG); woG.connect(win.gain); wc.connect(win.gain);
        into.connect(dl); dl.connect(win); win.connect(sum);
        const at = A.currentTime + (t ? 0.5 / f : 0); saw.start(at); wo.start(at);
      }
      return sum;
    };
    switch (e.type) {
      case 'overdrive': {
        const hp = biq('highpass', 90, 0.7), pre = G(4), ws = shaper(softClipCurve(30)), cab1 = biq('lowpass', 3200, 0.9), cab2 = biq('peaking', 1600, 1, 4), lvl = G(0.6);
        inp.connect(hp); hp.connect(pre); pre.connect(ws); ws.connect(cab1); cab1.connect(cab2); cab2.connect(lvl); lvl.connect(out);
        return unit((x) => { ws.curve = softClipCurve(5 + x.drive * 1.5); set(pre.gain, 1.5 + x.drive / 12); set(cab1.frequency, x.tone); set(lvl.gain, (x.level / 100) * 0.9); });
      }
      case 'blown': {
        const bp = biq('bandpass', 1400, 0.6), pre = G(8), clip = shaper(hardClipCurve(10)), rat = shaper(crushCurve(4), 'none'), rg = G(0), lp = biq('lowpass', 5000, 0.7), lvl = G(0.55);
        inp.connect(bp); bp.connect(pre); pre.connect(clip); clip.connect(lp); clip.connect(rat); rat.connect(rg); rg.connect(lp); lp.connect(lvl); lvl.connect(out);
        return unit((x) => { set(pre.gain, 2 + x.amount / 8); clip.curve = hardClipCurve(2 + x.amount / 8); set(rg.gain, x.rattle / 150); set(bp.Q, 0.4 + x.amount / 160); });
      }
      case 'stutter': {
        const g = G(0), o = lfo(A, mk, 'sine', 8), sh = shaper(gateCurve(80), 'none'), half = G(0.5), mid = konst(A, mk, 0.5), dep = G(1), rest = konst(A, mk, 0);
        // gain = (1 - depth) + depth * (0.5 + 0.5 * shaped LFO)
        o.connect(sh); sh.connect(half); half.connect(dep); mid.connect(dep); dep.connect(g.gain); rest.connect(g.gain);
        inp.connect(g); g.connect(out);
        return unit((x) => { set(o.frequency, x.rate); sh.curve = gateCurve(x.shape); set(dep.gain, x.depth / 100); set(rest.offset, 1 - x.depth / 100); });
      }
      case 'alien': {
        dryWet();
        const up = pitchShift(inp, 5), ring = G(0), car = lfo(A, mk, 'sine', 30), w = modDelay(0.006, 0.002, 4), hp = biq('highpass', 250, 0.7);
        car.connect(ring.gain); up.connect(ring); ring.connect(w.d); up.connect(w.d); w.d.connect(hp); hp.connect(wet);
        return unit((x) => { set(w.og.gain, 0.0002 + x.wobble * 0.00004); set(wet.gain, (x.amount / 100) * 0.6); set(dry.gain, 1 - x.amount / 100); });
      }
      case 'monster': {
        const down = pitchShift(inp, -9), ls = biq('lowshelf', 160, null, 8), ws = shaper(softClipCurve(10)), lp = biq('lowpass', 3500, 0.7), conv = mk(A.createConvolver()), rv = G(0.25), mainG = G(1);
        conv.buffer = impulse({ room: 'room', size: 40, decay: 50 }, A);
        down.connect(ls); ls.connect(ws); ws.connect(lp); lp.connect(mainG); mainG.connect(out); lp.connect(conv); conv.connect(rv); rv.connect(out);
        return unit((x) => { ws.curve = softClipCurve(2 + x.growl * 0.6); set(ls.gain, 2 + x.depth / 10); set(rv.gain, 0.1 + x.depth / 400); });
      }
      case 'ghost': {
        dryWet();
        const w = modDelay(0.01, 0.003, 0.4), lp = biq('lowpass', 2600, 0.7), hp = biq('highpass', 300, 0.7), conv = mk(A.createConvolver()), tail = G(0.6), fb = G(0.4), d2 = delayLine(1, 0.33);
        conv.buffer = impulse({ room: 'hall', size: 90, decay: 25 }, A);
        inp.connect(hp); hp.connect(w.d); w.d.connect(lp); lp.connect(conv); conv.connect(tail); tail.connect(wet); lp.connect(d2); d2.connect(fb); fb.connect(d2); d2.connect(wet);
        return unit((x) => { set(tail.gain, 0.3 + x.tail / 100); set(fb.gain, x.tail / 200); set(wet.gain, (x.amount / 100) * 0.9); set(dry.gain, 1 - x.amount / 120); });
      }
      case 'rotary': {
        const w = modDelay(0.004, 0.0012, 4), g = G(0.8), o = lfo(A, mk, 'sine', 4), og = G(0.2), p = mk(A.createStereoPanner()), po = lfo(A, mk, 'sine', 4), pg = G(0.6);
        o.connect(og); og.connect(g.gain); po.connect(pg); pg.connect(p.pan);
        inp.connect(w.d); w.d.connect(g); g.connect(p); p.connect(out);
        return unit((x) => { [w.o, o, po].forEach((n) => set(n.frequency, x.rate)); set(w.og.gain, 0.0002 + x.depth * 0.00002); set(og.gain, x.depth / 400); set(pg.gain, x.depth / 120); });
      }
      case 'wah': {
        const bp = biq('bandpass', 900, 6), o = lfo(A, mk, 'sine', 1), og = G(600), lvl = G(2);
        o.connect(og); og.connect(bp.frequency);
        dryWet(); inp.connect(bp); bp.connect(lvl); lvl.connect(wet);
        return unit((x) => { set(o.frequency, x.rate); set(og.gain, 100 + x.depth * 12); set(bp.Q, x.q); set(lvl.gain, 0.6 + x.q / 12); set(dry.gain, 0.25); set(wet.gain, 1); });
      }
      case 'treble': {
        const hs = biq('highshelf', 4500, null, 8), pres = biq('peaking', 3000, 1, 2);
        inp.connect(pres); pres.connect(hs); hs.connect(out);
        return unit((x) => { set(hs.gain, x.amount); set(hs.frequency, x.freq); set(pres.gain, x.amount / 4); });
      }
      case 'muffled': {
        const lp = biq('lowpass', 600, 0.9), lp2 = biq('lowpass', 900, 0.7), ls = biq('lowshelf', 150, null, 4), lvl = G(1.2);
        inp.connect(lp); lp.connect(lp2); lp2.connect(ls); ls.connect(lvl); lvl.connect(out);
        return unit((x) => { set(lp.frequency, 4000 - x.amount * 36); set(lp2.frequency, 5000 - x.amount * 40); set(ls.gain, x.amount / 20); });
      }
      case 'oldradio': {
        dryWet();
        const hp = biq('highpass', 500, 1), lp = biq('lowpass', 3000, 1), pk = biq('peaking', 1200, 1.4, 5), ws = shaper(softClipCurve(6)), lv = G(0.8);
        inp.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(ws); ws.connect(lv); lv.connect(wet);
        const cr = loopSource(A, noiseBuffer(A, 'crackle'), mk), hum = lfo(A, mk, 'sine', 60), hg = G(0.004), cg = G(0);
        cr.connect(cg); cg.connect(wet); hum.connect(hg); hg.connect(wet);
        return unit((x) => { set(wet.gain, x.amount / 100); set(dry.gain, 1 - x.amount / 100); set(cg.gain, (x.crackle / 100) * 0.6); });
      }
      case 'echo': {
        dryWet();
        const d = delayLine(2, 0.38), fb = G(0.55), lp = biq('lowpass', 3500, 0.7), hp = biq('highpass', 200, 0.7);
        inp.connect(hp); hp.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet);
        return unit((x) => { set(d.delayTime, x.time / 1000); set(fb.gain, x.repeats / 100); set(wet.gain, x.mix / 100); set(dry.gain, 1 - x.mix / 250); });
      }
      case 'pingpong': {
        dryWet();
        const dl = delayLine(2, 0.25), dr = delayLine(2, 0.25), fb = G(0.45), mg = mk(A.createChannelMerger(2)), mono = G(1);
        mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
        inp.connect(mono); mono.connect(dl); dl.connect(dr); dr.connect(fb); fb.connect(dl);
        dl.connect(mg, 0, 0); dr.connect(mg, 0, 1); mg.connect(wet);
        return unit((x) => { set(dl.delayTime, x.time / 1000); set(dr.delayTime, x.time / 1000); set(fb.gain, x.feedback / 100); set(wet.gain, x.mix / 100); set(dry.gain, 1 - x.mix / 250); });
      }
      case 'stadium': {
        dryWet();
        const pre = delayLine(0.3, 0.08), conv = mk(A.createConvolver()), slap = delayLine(1, 0.45), sg = G(0.25), hp = biq('highpass', 180, 0.7);
        let key = '';
        inp.connect(hp); hp.connect(pre); pre.connect(conv); conv.connect(wet); hp.connect(slap); slap.connect(sg); sg.connect(wet);
        return unit((x) => {
          const k = Math.round(x.size / 10); if (k !== key) { key = k; conv.buffer = impulse({ room: 'hall', size: 60 + x.size * 0.4, decay: 25 + x.size * 0.15 }, A); }
          set(pre.delayTime, 0.03 + x.size * 0.0008); set(wet.gain, (x.mix / 100) * 1.1); set(dry.gain, 1 - x.mix / 200);
        });
      }
      case 'voiceboost': {
        const hp = biq('highpass', 80, 0.7), warm = biq('peaking', 180, 0.9, 2), mud = biq('peaking', 400, 1.2, -3), pres = biq('peaking', 3200, 1, 4), air = biq('highshelf', 10000, null, 3);
        const comp = mk(A.createDynamicsCompressor()), mu = G(1.4);
        comp.attack.value = 0.005; comp.release.value = 0.12; comp.knee.value = 8;
        inp.connect(hp); hp.connect(warm); warm.connect(mud); mud.connect(pres); pres.connect(air); air.connect(comp); comp.connect(mu); mu.connect(out);
        return unit((x) => { set(comp.threshold, -10 - x.amount * 0.2); set(comp.ratio, 2 + x.amount / 25); set(pres.gain, x.amount / 20); set(air.gain, x.amount / 30); set(warm.gain, x.warmth / 15); set(mud.gain, -x.amount / 25); set(mu.gain, Math.pow(10, (2 + x.amount / 14) / 20)); });
      }
      case 'compress': {
        const comp = mk(A.createDynamicsCompressor()), mu = G(1);
        comp.attack.value = 0.01; comp.release.value = 0.2; comp.knee.value = 10;
        inp.connect(comp); comp.connect(mu); mu.connect(out);
        return unit((x) => { set(comp.threshold, -6 - x.amount * 0.34); set(comp.ratio, 1.5 + x.amount / 10); set(mu.gain, Math.pow(10, x.makeup / 20)); });
      }
      case 'clarity': {
        const hp = biq('highpass', 120, 0.7), mud = biq('peaking', 300, 1, -3), pres = biq('peaking', 2500, 0.9, 4), sib = biq('peaking', 7000, 2, -1);
        inp.connect(hp); hp.connect(mud); mud.connect(pres); pres.connect(sib); sib.connect(out);
        return unit((x) => { set(hp.frequency, 60 + x.amount * 1.2); set(mud.gain, -x.amount / 15); set(pres.gain, x.amount / 14); set(sib.gain, -x.amount / 40); });
      }
    }
    return base(e, A, workletOk, instant);
  };
}

/* ---------- icons for the Audio FX tab (simple line icons, coloured per group) ---------- */
const AFX_SVG = {
  loud: '<path d="M3 10v4h4l5 4V6L7 10z"/><path d="M16 8l2-2M16 16l2 2M17 12h4"/>',
  distort: '<path d="M2 12h3l2-7 3 14 2-10 2 6 2-3h6"/>',
  crush: '<path d="M3 17v-4h4V9h4v4h4V7h4v10"/><path d="M3 20h18"/>',
  glitch: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  pitch: '<path d="M7 20V9M12 20V4M17 20v-7"/><path d="M5 9h4M10 4h4M15 13h4"/>',
  robot: '<rect x="5" y="8" width="14" height="11" rx="2"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6"/><circle cx="12" cy="3" r="1"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  radio: '<rect x="3" y="9" width="18" height="11" rx="2"/><path d="M7 9l10-5"/><circle cx="15.5" cy="14.5" r="2.5"/><path d="M6 13h4M6 16h4"/>',
  megaphone: '<path d="M3 10v4l3 1 12 5V4L6 9z"/><path d="M8 15.5V20h3v-3.4"/>',
  underwater: '<path d="M2 15c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><path d="M2 20c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="4" r="1.2"/>',
  faraway: '<path d="M4 20V4h11v16"/><path d="M15 6l5-2v18l-5-2"/><circle cx="12" cy="12" r=".8"/>',
  chorus: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  flanger: '<path d="M12 12a3 3 0 1 1 3-3"/><path d="M12 12a6 6 0 1 0 6-6"/><path d="M12 12a9 9 0 1 1 9-9"/>',
  phaser: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>',
  tremolo: '<path d="M2 12h2M20 12h2"/><path d="M4 12c1-5 2-5 3 0s2 5 3 0 2-5 3 0 2 5 3 0 2-5 3 0"/>',
  vibrato: '<path d="M2 12c2-6 4-6 5 0s3 6 5 0 3-6 5 0 3 6 5 0"/>',
  autopan: '<path d="M7 7l-4 5 4 5M17 7l4 5-4 5M3 12h18"/>',
  bassboost: '<rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="14" r="4"/><circle cx="12" cy="14" r="1"/><circle cx="12" cy="7" r="1.2"/>',
  lofi: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3a9 9 0 0 1 9 9"/>',
  delay: '<path d="M4 12h3M10 12h3M16 12h4"/><path d="M5 8v8M11 9v6M17 10v4"/>',
  reverb: '<path d="M3 21V10l9-6 9 6v11"/><path d="M8 21v-6a4 4 0 0 1 8 0v6"/>',
  limiter: '<path d="M3 6h18"/><path d="M4 18l3-8 3 5 3-9 3 7 3-4 2 9"/>',
  feq: '<path d="M6 3v18M12 3v18M18 3v18"/><rect x="4" y="13" width="4" height="3" rx="1"/><rect x="10" y="6" width="4" height="3" rx="1"/><rect x="16" y="10" width="4" height="3" rx="1"/>',
  deess: '<path d="M16 7a4 4 0 0 0-4-2c-2.5 0-4 1.3-4 3 0 4 8 3 8 7 0 1.8-1.6 3-4 3a4.5 4.5 0 0 1-4.3-2.5"/><path d="M4 20 20 4"/>',
  nr: '<path d="M3 12h2l1-3 2 6 2-8 2 10 2-5 1 2h6"/><path d="M17 7l4-4M21 7l-4-4"/>',
  overdrive: '<rect x="3" y="6" width="18" height="13" rx="2"/><circle cx="8" cy="12.5" r="3"/><path d="M14 10h4M14 13h4M14 16h4M6 6V4"/>',
  blown: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 4l-1 4 2 2-1 2M20 12l-4 .5-1.5 2"/>',
  stutter: '<path d="M3 17V7M7 17V7M11 17V7M15 17V7M19 17V7"/><path d="M3 20h18"/>',
  alien: '<path d="M12 3c4.5 0 7 3 7 7 0 5-4 11-7 11s-7-6-7-11c0-4 2.5-7 7-7"/><path d="M7.5 11c1.5 0 3 1 3.3 2.5M16.5 11c-1.5 0-3 1-3.3 2.5"/>',
  monster: '<path d="M5 20V9a7 7 0 0 1 14 0v11l-2.3-2-2.3 2-2.4-2-2.3 2-2.4-2z"/><path d="M5 5 3 2M19 5l2-3"/><circle cx="9.5" cy="10" r="1"/><circle cx="14.5" cy="10" r="1"/>',
  ghost: '<path d="M5 21V10a7 7 0 0 1 14 0v11l-2.3-2-2.3 2-2.4-2-2.3 2-2.4-2z"/><circle cx="9.5" cy="11" r="1"/><circle cx="14.5" cy="11" r="1"/>',
  rotary: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/><circle cx="12" cy="12" r="2"/>',
  wah: '<path d="M2 18c4 0 5-12 10-12s6 12 10 12"/><path d="M12 6v14"/>',
  treble: '<path d="M2 18h6c5 0 7-12 14-12"/><path d="M17 3l3 3-3 3"/>',
  muffled: '<rect x="13" y="3" width="8" height="18" rx="1"/><path d="M13 8h8M13 13h8M13 18h8M17 3v5M15 8v5M19 13v5"/><path d="M3 10v4h3l4 3V7l-4 3z"/>',
  oldradio: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 3l4 4 4-4"/><circle cx="8" cy="13.5" r="2.5"/><path d="M14 11h4M14 14h4M14 17h4"/>',
  echo: '<path d="M2 20l6-10 4 6 3-4 7 8z"/><path d="M14 4a3 3 0 0 1 0 4M17 3a6 6 0 0 1 0 6"/>',
  pingpong: '<circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 11l4-4 2 0M17 13l-4 4h-2"/>',
  stadium: '<ellipse cx="12" cy="9" rx="9" ry="4"/><path d="M3 9v6c0 2.2 4 4 9 4s9-1.8 9-4V9"/><path d="M8 12.5v4M16 12.5v4M12 13v5"/>',
  voiceboost: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4M8 22h8"/>',
  compress: '<path d="M4 4v16M20 4v16"/><path d="M8 12h8M10 9l-2 3 2 3M14 9l2 3-2 3"/>',
  clarity: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12"/><circle cx="12" cy="12" r="3"/>'
};
const AFX_GROUP_COLOR = { 'Loud & broken': '#ff6b5e', 'Voice changers': '#a78bff', 'Movement': '#4cc3ff', 'Tone': '#ffc53d', 'Space': '#4fd6a0', 'Clean up': '#9aa4b8' };
function afxIcon(id) {
  const t = AFX_TYPES[id] || {}, col = AFX_GROUP_COLOR[t.group || 'Clean up'] || '#9aa4b8';
  return `<span class="afx-ico" style="--c:${col}"><svg viewBox="0 0 24 24">${AFX_SVG[id] || AFX_SVG.chorus}</svg></span>`;
}
// swap the emoji icons in the Audio FX tab for these
{
  const baseRender = renderAfxTab;
  renderAfxTab = function () {
    const r = baseRender.apply(this, arguments);
    document.querySelectorAll('[data-page=afx] .afx-tile').forEach((b) => {
      const id = Object.keys(AFX_TYPES).find((k) => AFX_TYPES[k].name === ($('.afx-name', b) || {}).textContent);
      const old = $('.afx-ico', b);
      if (id && old) old.outerHTML = afxIcon(id);
    });
    return r;
  };
}
