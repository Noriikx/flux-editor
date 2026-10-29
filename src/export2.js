/* Flux — export engine 2.
   Every frame is rendered and encoded one by one (nothing is ever skipped, so no more choppy 10 fps exports),
   the sound is mixed separately faster than real time, and simple edits go straight to ffmpeg (very fast). */
'use strict';
const EXP_SR = 48000;
let exp2Job = null;

/* ---------- 1. can ffmpeg do it all by itself? (only cuts of plain videos / photos) ---------- */
function isPlainVisual(c) {
  const z = (v, d) => v == null || Math.abs(v - d) < 1e-6;
  if (!(c.kind === 'video' || c.kind === 'image')) return false;
  const m = getMedia(c.mediaId);
  if (!m || m.missing || m.error || !m.path) return false;
  if (c.keys && Object.entries(c.keys).some(([k, a]) => k !== 'volume' && a && a.length)) return false;
  if (!z(c.scale, 1) || !z(c.x, 0) || !z(c.y, 0) || !z(c.rotation, 0) || !z(c.opacity, 1)) return false;
  if (!z(c.brightness, 100) || !z(c.contrast, 100) || !z(c.saturation, 100) || !z(c.blur, 0) || !z(c.hue, 0) || !z(c.temp, 0) || !z(c.tint, 0)) return false;
  if (!z(c.vignette, 0) || !z(c.grain, 0) || (c.filter && c.filter !== 'none')) return false;
  if (c.flipH || c.flipV || c.bgBlur || (c.motion && c.motion !== 'none') || (c.blend && c.blend !== 'source-over')) return false;
  const cr = c.crop || {};
  if (!z(cr.l, 0) || !z(cr.r, 0) || !z(cr.t, 0) || !z(cr.b, 0)) return false;
  if (c.transition || c.transitionOut || (c.fadeIn || 0) > 0 || (c.fadeOut || 0) > 0) return false;
  if (c.chroma && c.chroma.on) return false;
  if ((c.effects || []).some((e) => e.on !== false)) return false;
  if (typeof maskOn === 'function' && maskOn(c)) return false;
  if (c.fit && c.fit !== 'contain' && c.fit !== 'cover') return false;
  return true;
}
function directPlan(r0, r1, fps) {
  const vis = P.clips.filter((c) => {
    if (c.kind === 'audio' || c.disabled) return false;
    const tr = getTrack(c.trackId);
    if (tr && tr.hidden) return false;
    return endOf(c) > r0 + 1e-4 && c.start < r1 - 1e-4;
  }).sort((a, b) => a.start - b.start);
  if (!vis.length || vis.length > 150) return null;
  if (!vis.every(isPlainVisual)) return null;
  for (let i = 1; i < vis.length; i++) if (vis[i].start < endOf(vis[i - 1]) - 1e-3) return null; // clips on top of each other
  const segs = [];
  let cur = r0;
  const half = 0.5 / fps;
  for (const c of vis) {
    const a = Math.max(c.start, r0), b = Math.min(endOf(c), r1);
    if (b - a < half) continue;
    if (a - cur > half) segs.push({ type: 'gap', dur: a - cur });
    const m = getMedia(c.mediaId);
    segs.push({ type: 'clip', kind: c.kind, file: m.path, in: c.kind === 'image' ? 0 : c.in + (a - c.start) * c.speed, dur: b - a, speed: c.kind === 'image' ? 1 : c.speed, fit: c.fit || 'contain' });
    cur = b;
  }
  if (r1 - cur > half) segs.push({ type: 'gap', dur: r1 - cur });
  return segs.length ? segs : null;
}

/* ---------- 2. the sound: every clip mixed exactly like you hear it, but faster than real time ---------- */
function exportSoundItems() {
  const items = [];
  const voiceRanges = P.clips.filter((c) => hasAudio(c) && !c.muted && clipRole(c) === 'voice').map((c) => [c.start, endOf(c)]);
  const voiceAt = (t) => voiceRanges.some(([a, b]) => t >= a && t < b);
  const collect = (comp) => {
    const L = computeLayout();
    for (const c of P.clips) {
      if (!hasAudio(c)) continue;
      const m = getMedia(c.mediaId);
      if (!m || m.missing || m.error || !m.path || m.hasAudio === false) continue;
      const tr = getTrack(c.trackId);
      const silent = (tr && tr.muted) || c.muted || c.disabled || (c.kind === 'video' && !!soundClipOf(c));
      if (silent) continue;
      const w = L.get(c.id) || { vs: c.start, ve: endOf(c) };
      const off = comp ? comp.start - comp.in : 0;
      let a0 = w.vs + off, a1 = w.ve + off;
      if (comp) { a0 = Math.max(a0, comp.start); a1 = Math.min(a1, endOf(comp)); }
      if (a1 - a0 < 0.005) continue;
      items.push({ c, m, w, off, a0, a1, comp, voiceAt, dur: m.duration || Infinity });
    }
  };
  collect(null);
  for (const comp of P.clips.filter((x) => x.kind === 'compound' && x.sub && !x.disabled && !x.muted)) {
    const tr = getTrack(comp.trackId);
    if (tr && tr.muted) continue;
    withInner(comp, 0, () => collect(comp));
  }
  return items;
}
function soundGainAt(it, t) {
  const c = it.c, tt = t - it.off, local = tt - c.start, w = it.w;
  let g = kv(c, 'volume', local) * fadeEnv(c, local);
  if (w.tin && tt < w.tin.start + w.tin.dur) g *= clamp((tt - w.tin.start) / w.tin.dur, 0, 1);
  if (w.tout && tt >= w.tout.start) g *= clamp(1 - (tt - w.tout.start) / w.tout.dur, 0, 1);
  if (c.audio && c.audio.duck && it.voiceAt(t)) g *= 0.25;
  if (c.beeps && c.beeps.length && isPremium()) {
    const src = c.in + local * c.speed, look = 0.06 * Math.max(1, c.speed);
    const b = c.beeps.find((x) => src >= x.s - look && src <= x.e);
    if (b) g *= c.beepSound === 'duck' ? 0.12 : 0;
  }
  if (it.comp) { const cl = t - it.comp.start; g *= kv(it.comp, 'volume', cl) * fadeEnv(it.comp, cl); }
  return Math.max(0, g);
}
async function renderSound(r0, r1, onProgress, isCancelled) {
  const items = exportSoundItems();
  if (typeof prepareBleeps === 'function') await prepareBleeps();
  const SEG = 40, PRE = 3;
  const total = Math.round((r1 - r0) * EXP_SR);
  const needWorklet = items.some((it) => activeAudioFx(it.c).some((e) => e.type === 'deess' || e.type === 'nr'));
  for (let a = r0; a < r1 - 1e-6; a += SEG) {
    if (isCancelled()) return false;
    const b = Math.min(r1, a + SEG), pa = a - PRE;
    const nOut = Math.round((b - r0) * EXP_SR) - Math.round((a - r0) * EXP_SR);
    const ctx = new OfflineAudioContext(2, Math.ceil((b - pa) * EXP_SR) + 8, EXP_SR);
    let workletOk = false;
    if (needWorklet) { try { await ctx.audioWorklet.addModule(new URL('dyn-worklet.js', location.href).href); workletOk = true; } catch {} }
    let any = false;
    for (const it of items) {
      const c = it.c;
      let ta = Math.max(pa, it.a0), tb = Math.min(b, it.a1);
      if (tb - ta < 0.002) continue;
      // where in the file that is (never before the start of the file)
      let srcA = c.in + (ta - it.off - c.start) * c.speed;
      if (srcA < 0) { ta += -srcA / c.speed; srcA = 0; }
      const srcB = Math.min(it.dur, c.in + (tb - it.off - c.start) * c.speed);
      if (srcB - srcA < 0.002 || tb - ta < 0.002) continue;
      const raw = await api.audioExtract({ file: it.m.path, start: srcA, dur: srcB - srcA, speed: c.speed });
      if (!raw || raw.byteLength < 16) continue;
      const f = new Float32Array(raw), frames = Math.floor(f.length / 2);
      const buf = ctx.createBuffer(2, frames, EXP_SR);
      const L = buf.getChannelData(0), R = buf.getChannelData(1);
      for (let i = 0, j = 0; i < frames; i++, j += 2) { L[i] = f[j]; R[i] = f[j + 1]; }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      const span = frames / EXP_SR, n = Math.max(2, Math.ceil(span * 100) + 1), curve = new Float32Array(n);
      for (let i = 0; i < n; i++) curve[i] = soundGainAt(it, ta + (i / (n - 1)) * span);
      gain.gain.value = curve[0];
      try { gain.gain.setValueCurveAtTime(curve, ta - pa, span); } catch {}
      let last = gain;
      src.connect(gain);
      const au = c.audio || {};
      if (au.pan) { const p = ctx.createStereoPanner(); p.pan.value = au.pan; last.connect(p); last = p; }
      if (isPremium() && (au.bass || au.mid || au.treble)) {
        const lo = ctx.createBiquadFilter(); lo.type = 'lowshelf'; lo.frequency.value = 200; lo.gain.value = au.bass || 0;
        const mi = ctx.createBiquadFilter(); mi.type = 'peaking'; mi.frequency.value = 1500; mi.Q.value = 0.9; mi.gain.value = au.mid || 0;
        const hi = ctx.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 5000; hi.gain.value = au.treble || 0;
        last.connect(lo); lo.connect(mi); mi.connect(hi); last = hi;
      }
      for (const e of activeAudioFx(c)) {
        try { const u = makeUnit(e, ctx, workletOk, true); u.update(e); last.connect(u.in); last = u.out; } catch (er) { console.warn('export fx', er); }
      }
      last.connect(ctx.destination);
      src.start(Math.max(0, ta - pa));
      any = true;
      // bleep tone over covered words
      if (c.beeps && c.beeps.length && isPremium() && c.beepSound !== 'mute' && c.beepSound !== 'duck') {
        for (const bp of c.beeps) {
          const t0 = it.off + c.start + (bp.s - c.in) / c.speed, t1 = it.off + c.start + (bp.e - c.in) / c.speed;
          const x0 = Math.max(t0, ta, pa), x1 = Math.min(t1, tb, b);
          if (typeof bleepIsShot === 'function' && bleepIsShot(c.beepSound)) {
            // one-shot sound (anvil, bonk…): starts with the bleep, rings out even past it
            const buf = bleepReady(c.beepSound);
            if (buf && t0 >= pa && t0 < b && t0 >= ta - 1e-3 && t0 < tb) { const s1 = ctx.createBufferSource(), g1 = ctx.createGain(); s1.buffer = buf; g1.gain.value = 0.9; s1.connect(g1); g1.connect(ctx.destination); s1.start(Math.max(0, t0 - pa)); }
            continue;
          }
          if (x1 - x0 < 0.005) continue;
          const o = ctx.createOscillator(); o.frequency.value = c.beepSound === 'low' ? 400 : 1000;
          const og = ctx.createGain(); og.gain.value = 0.22;
          o.connect(og); og.connect(ctx.destination);
          o.start(x0 - pa); o.stop(x1 - pa);
        }
      }
    }
    const out = new Float32Array(nOut * 2);
    if (any) {
      const res = await ctx.startRendering();
      const skip = Math.round((a - pa) * EXP_SR);
      const L = res.getChannelData(0), R = res.getChannelData(1);
      for (let i = 0; i < nOut; i++) { const k = skip + i; out[i * 2] = L[k] || 0; out[i * 2 + 1] = R[k] || 0; }
    }
    await api.exp2Audio(out.buffer);
    onProgress(clamp((b - r0) / Math.max(0.001, r1 - r0), 0, 1));
  }
  void total;
  return true;
}

/* ---------- 3. the picture, frame by frame ---------- */
// called by syncMedia for each video that should be showing while exporting
function exp2SyncPlayer(p, c, src) {
  const el = p.el;
  if (c.kind !== 'video') { if (!el.paused) el.pause(); return; }
  if (!p.vfc && el.requestVideoFrameCallback) {
    p.vfc = true;
    const cb = (now, md) => { p.presented = md.mediaTime; p.presentedAt = performance.now(); try { el.requestVideoFrameCallback(cb); } catch {} };
    el.requestVideoFrameCallback(cb);
  }
  const job = rt.exp2;
  const wait = () => job.wait.push(p);
  if (el.readyState < 1) return wait();
  const rate = clamp(c.speed * job.rate, 0.0625, 16);
  const pr = p.presented;
  if (el.ended || (el.duration && src >= el.duration - 0.05 && pr != null && pr >= el.duration - 0.25)) return; // last frame of the file
  if (pr == null || pr > src + 0.35 || pr < src - 2) {
    if (!el.seeking) {
      if (Math.abs(el.currentTime - src) > 0.03 || pr == null) { if (!el.paused) el.pause(); el.currentTime = src; p.presented = null; p.seekedAt = performance.now(); }
      else if (el.paused) { el.playbackRate = rate; el.play().catch(() => {}); }
    }
    return wait();
  }
  if (pr < src - 0.021) {
    if (el.paused && !el.seeking) { el.playbackRate = rate; el.play().catch(() => {}); }
    else if (Math.abs(el.playbackRate - rate) > 0.01) el.playbackRate = rate;
    return wait();
  }
  if (pr > src + 0.15 && !el.paused) el.pause(); // ahead of the clock: wait for it
}
const nextTick = () => new Promise((r) => setTimeout(r, 2));
async function prepareFrame(t) {
  const job = rt.exp2;
  const t0 = performance.now();
  for (;;) {
    job.wait = [];
    rt.layout = computeLayout();
    syncMedia(rt.layout);
    if (!job.wait.length) return true;
    if (performance.now() - t0 > 6000 || job.cancelled) return false;
    await nextTick();
  }
}
async function pickVideoCodec(w, h, fps, bitrate) {
  if (typeof VideoEncoder === 'undefined') return null;
  for (const codec of ['avc1.640034', 'avc1.640033', 'avc1.64002A', 'avc1.640028', 'avc1.4D4033', 'avc1.4D0028']) {
    for (const hw of ['prefer-hardware', 'no-preference']) {
      const cfg = { codec, width: w, height: h, bitrate, framerate: fps, hardwareAcceleration: hw, latencyMode: 'quality', bitrateMode: 'variable', avc: { format: 'annexb' } };
      try { const s = await VideoEncoder.isConfigSupported(cfg); if (s.supported) return s.config || cfg; } catch {}
    }
  }
  return null;
}
async function renderFrames(job, onProgress) {
  const { r0, fps, w, h, frames } = job;
  const bpp = { high: 0.22, standard: 0.13, small: 0.07 }[job.quality] || 0.13;
  const cfg = await pickVideoCodec(w, h, fps, Math.round(w * h * fps * bpp));
  if (!cfg) throw new Error('This computer can’t encode H.264 video here.');
  let failed = null, chain = Promise.resolve(), pend = [], pendBytes = 0;
  const flush = () => {
    if (!pend.length) return;
    const total = new Uint8Array(pendBytes); let o = 0;
    for (const p of pend) { total.set(p, o); o += p.length; }
    pend = []; pendBytes = 0;
    chain = chain.then(() => api.exp2Video(total.buffer));
  };
  const enc = new VideoEncoder({
    output: (chunk) => { const b = new Uint8Array(chunk.byteLength); chunk.copyTo(b); pend.push(b); pendBytes += b.length; if (pendBytes > 4 * 1048576) flush(); },
    error: (e) => { failed = e; }
  });
  enc.configure(cfg);
  const pv = job.pv && job.pv.isConnected ? job.pv.getContext('2d') : null;
  const gop = Math.max(1, Math.round(fps * 2));
  for (let i = 0; i < frames; i++) {
    if (job.cancelled) break;
    if (failed) throw failed;
    const t = r0 + i / fps;
    state.time = t;
    await prepareFrame(t);
    render();
    const vf = new VideoFrame(canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: i % gop === 0 });
    vf.close();
    while (enc.encodeQueueSize > 8) await nextTick();
    if (i % 6 === 0) {
      onProgress(i / frames);
      if (pv) { try { pv.drawImage(canvas, 0, 0, job.pv.width, job.pv.height); } catch {} }
    }
  }
  await enc.flush();
  enc.close();
  flush();
  await chain;
  if (failed) throw failed;
  onProgress(1);
}

/* ---------- 4. the export window ---------- */
async function runExport(opts) {
  if (!api || !api.exp2Begin || typeof OfflineAudioContext === 'undefined') return runExportLegacy(opts);
  const useRange = opts.range && rangeOK();
  const r0 = useRange ? P.range.in : 0, r1 = useRange ? P.range.out : projectDuration();
  const total = r1 - r0;
  if (total <= 0.05) return toast('Nothing to export');
  const target = await api.exportChoose({ format: opts.format, name: P.name });
  if (!target) return;
  if (typeof ensureProjectFonts === 'function') await ensureProjectFonts();
  const [W, H] = refSize();
  const factor = opts.res / Math.min(W, H);
  const w = Math.round((W * factor) / 2) * 2, h = Math.round((H * factor) / 2) * 2, fps = opts.fps || 30;
  const box = modal(`
    <h2>Exporting…</h2><p class="sub" id="exSub">Getting ready…</p>
    <canvas class="export-preview" id="exPreview"></canvas>
    <div class="progress"><div id="exBar"></div></div>
    <div class="progress-label"><span id="exLabel">0%</span><span id="exTime"></span></div>
    <p class="hint">Keep Flux open while it works. Every frame is saved at full quality.</p>
    <div class="footer"><button class="btn ghost" id="exCancel">Cancel</button></div>`);
  const pv = $('#exPreview', box);
  pv.width = 400; pv.height = Math.round(400 * (H / W));
  if (H > W) { pv.style.width = '50%'; pv.style.margin = '0 auto'; pv.style.display = 'block'; }
  const job = exp2Job = { r0, r1, total, fps, w, h, quality: opts.quality, format: opts.format, frames: Math.max(1, Math.round(total * fps)), pv, cancelled: false, started: performance.now(), wait: [], rate: fps > 30 || opts.quality === 'high' ? 1 : opts.quality === 'small' ? 2 : 1.5 };
  const setP = (p, label) => {
    p = clamp(p, 0, 1);
    const bar = $('#exBar'); if (bar) bar.style.width = (p * 100).toFixed(1) + '%';
    const lab = $('#exLabel'); if (lab) lab.textContent = Math.round(p * 100) + '%';
    if (label) { const s = $('#exSub'); if (s) s.textContent = label; }
    const el2 = (performance.now() - job.started) / 1000, tt = $('#exTime');
    if (tt && p > 0.03) tt.textContent = 'about ' + fmtLeft(el2 / p - el2) + ' left';
  };
  $('#exCancel', box).onclick = async () => { job.cancelled = true; $('#exSub').textContent = 'Stopping…'; if (job.stage === 'ffmpeg') { try { await api.exp2Cancel(); } catch {} } };
  const prevSel = state.selectedId;
  pause();
  try {
    const begin = await api.exp2Begin();
    if (!begin || !begin.ok) throw new Error('The video saver (ffmpeg) is missing - reinstall Flux.');
    const plan = opts.format === 'webm' ? null : directPlan(r0, r1, fps);
    // sound first (fast)
    const SOUND = plan ? 0.08 : 0.06;
    setP(0, 'Mixing the sound…');
    const okSound = await renderSound(r0, r1, (p) => setP(p * SOUND), () => job.cancelled);
    if (!okSound || job.cancelled) throw new Error('cancelled');
    let res;
    if (plan) {
      setP(SOUND, 'Saving your video (fast mode)…');
      const off = api.onExp2Progress ? null : null; void off;
      exp2Progress = (v) => setP(SOUND + v * (1 - SOUND));
      job.stage = 'ffmpeg';
      res = await api.exp2Direct({ target, fps, format: opts.format, quality: opts.quality, duration: total, w, h, bg: P.background || '#000000', segs: plan });
    } else {
      setP(SOUND, 'Rendering every frame…');
      state.exporting = true;
      document.body.classList.add('exporting');
      ensureAudio();
      if (monitorGain) monitorGain.gain.value = 0;
      canvas.width = w; canvas.height = h;
      rt.exp2 = job;
      const VID = 0.95;
      await renderFrames(job, (p) => setP(SOUND + p * (VID - SOUND), 'Rendering every frame…'));
      rt.exp2 = null;
      endExportMode();
      if (job.cancelled) throw new Error('cancelled');
      setP(VID, 'Saving the MP4…');
      exp2Progress = (v) => setP(VID + v * (1 - VID), 'Saving the file…');
      job.stage = 'ffmpeg';
      res = await api.exp2Finish({ target, fps, format: opts.format, quality: opts.quality, duration: total, w, h });
    }
    exp2Progress = null;
    exp2Job = null;
    if (job.cancelled) throw new Error('cancelled');
    closeModal();
    state.selectedId = prevSel;
    exportDone(res);
  } catch (e) {
    rt.exp2 = null;
    exp2Progress = null;
    if (state.exporting) endExportMode();
    exp2Job = null;
    try { await api.exp2Cancel(); } catch {}
    closeModal();
    if (String(e && e.message) === 'cancelled') { toast('Export cancelled'); return; }
    console.error(e);
    exportDone({ ok: false, error: (e && e.message) || String(e) });
  }
  layoutStage();
  requestDraw();
}
let exp2Progress = null;
if (api && api.onExp2Progress) api.onExp2Progress((v) => { if (exp2Progress) exp2Progress(v); });
function fmtLeft(s) {
  if (!isFinite(s) || s < 0) return '';
  if (s < 60) return Math.max(1, Math.round(s)) + ' s';
  if (s < 3600) return Math.round(s / 60) + ' min';
  return (s / 3600).toFixed(1) + ' h';
}
