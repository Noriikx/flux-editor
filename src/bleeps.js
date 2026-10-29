/* Flux — bleep sounds. Besides the classic beep, a bleeped word can be covered by a funny one-shot sound
   (anvil clang, bonk, quack, air horn…). All sounds are made by Flux itself (no copyright).
   One-shot sounds play once when the bleep starts; the word itself is muted. */
'use strict';
const BLEEP_SOUNDS = [
  { id: 'beep', name: 'Beep', tone: 1000 },
  { id: 'low', name: 'Low beep', tone: 400 },
  { id: 'mute', name: 'Silence' },
  { id: 'duck', name: 'Quieter' },
  { id: 'anvil', name: 'Anvil clang', len: 1.6, make: (c, o) => {
    const r = sfxReverb(c, o, 1, 0.18);
    // an inharmonic metal ring + the hit
    for (const [ratio, v, d] of [[1, 0.45, 1.3], [2.32, 0.3, 0.9], [3.98, 0.22, 0.7], [5.61, 0.14, 0.5], [7.3, 0.09, 0.35]]) sfxOsc(c, 'sine', 0, [[0, 820 * ratio], [d, 820 * ratio * 0.998]], [[0, v], [d, 0.0001]], r);
    sfxClickNoise(c, r, 0, 0.05, 4200, 1);
    sfxKick(c, r, 0, 180, 70, 0.12, 0.7);
  } },
  { id: 'bonk', name: 'Bonk', len: 0.5, make: (c, o) => { sfxOsc(c, 'sine', 0, [[0, 420], [0.12, 190]], [[0, 0.9], [0.3, 0.0001]], o); sfxOsc(c, 'triangle', 0, [[0, 980], [0.2, 900]], [[0, 0.25], [0.2, 0.0001]], o); sfxClickNoise(c, o, 0, 0.02, 2500, 0.6); } },
  { id: 'quack', name: 'Quack', len: 0.45, make: (c, o) => {
    const bp1 = sfxFilter(c, 'bandpass', 900, 4), bp2 = sfxFilter(c, 'bandpass', 2300, 5), g = sfxEnv(c, 0, [[0, 0.0001], [0.03, 1], [0.22, 0.8], [0.32, 0.0001]]);
    bp1.frequency.setValueAtTime(700, 0); bp1.frequency.linearRampToValueAtTime(1200, 0.12); bp1.frequency.linearRampToValueAtTime(800, 0.3);
    const s = c.createOscillator(); s.type = 'sawtooth'; s.frequency.setValueAtTime(330, 0); s.frequency.linearRampToValueAtTime(250, 0.3);
    s.connect(bp1); s.connect(bp2); bp1.connect(g); bp2.connect(g); g.connect(o); s.start(0); s.stop(0.34);
  } },
  { id: 'airhorn', name: 'Air horn', len: 1.1, make: (c, o) => { const lp = sfxFilter(c, 'lowpass', 3200, 1); lp.connect(o); for (const [f, d] of [[466, 0], [470, 6], [699, -4], [932, 3]]) sfxOsc(c, 'sawtooth', 0, [[0, f], [1, f]], [[0, 0.0001], [0.03, 0.18], [0.85, 0.17], [1, 0.0001]], lp, { detune: d }); } },
  { id: 'carhorn', name: 'Car horn', len: 0.7, make: (c, o) => { const lp = sfxFilter(c, 'lowpass', 2400, 1); lp.connect(o); for (const f of [392, 494]) sfxOsc(c, 'square', 0, [[0, f], [0.6, f]], [[0, 0.0001], [0.02, 0.2], [0.55, 0.2], [0.62, 0.0001]], lp); } },
  { id: 'dolphin', name: 'Dolphin', len: 0.7, make: (c, o) => { for (let i = 0; i < 4; i++) sfxOsc(c, 'sine', i * 0.14, [[0, 2600], [0.06, 4200], [0.12, 3000]], [[0, 0.0001], [0.01, 0.4], [0.12, 0.0001]], o); } },
  { id: 'sfx:boing', name: 'Boing' }, { id: 'sfx:slide-down', name: 'Whistle' }, { id: 'sfx:scratch', name: 'Record scratch' },
  { id: 'sfx:error', name: 'Buzzer' }, { id: 'sfx:laser', name: 'Laser' }, { id: 'sfx:glitch', name: 'Glitch' },
  { id: 'sfx:cartoon-zip', name: 'Zip' }, { id: 'sfx:ding', name: 'Ding' }, { id: 'sfx:drama-boom', name: 'Boom' }
];
const bleepInfo = (id) => BLEEP_SOUNDS.find((s) => s.id === id) || BLEEP_SOUNDS[0];
const bleepIsShot = (id) => { const s = bleepInfo(id); return !!(s.make || /^sfx:/.test(s.id)); };
const bleepBufs = new Map();
// render a one-shot into an AudioBuffer (works in any audio context, live or export)
function bleepBuffer(id) {
  if (bleepBufs.has(id)) return bleepBufs.get(id);
  const s = bleepInfo(id);
  const recipe = s.make ? s : /^sfx:/.test(id) && typeof SFX !== 'undefined' ? SFX.find((x) => x.id === id.slice(4)) : null;
  if (!recipe) return Promise.resolve(null);
  const job = (async () => {
    const SR = 44100, ctx = new OfflineAudioContext(2, Math.ceil((recipe.len + 0.1) * SR), SR);
    const g = ctx.createGain(); g.connect(ctx.destination);
    recipe.make(ctx, g);
    const buf = await ctx.startRendering();
    let pk = 0; for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i])); }
    const k = pk > 0 ? 0.8 / pk : 1;
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) d[i] *= k; }
    bleepBufs.set(id, buf);
    return buf;
  })();
  bleepBufs.set(id, job);
  return job;
}
const bleepReady = (id) => { const b = bleepBufs.get(id); return b && !b.then ? b : null; };
// live playback: called every frame while the playhead is inside a bleep; plays the sound once per pass
const bleepFired = new Map();
function bleepTrigger(c, b) {
  if (!actx || !masterGain || !state.playing) return;
  const id = c.beepSound;
  const key = c.id + '|' + b.s.toFixed(3), now = performance.now(), last = bleepFired.get(key);
  bleepFired.set(key, now);
  if (last && now - last < 250) return; // still in the same pass
  const buf = bleepReady(id);
  if (!buf) { bleepBuffer(id); return; }
  const src = actx.createBufferSource(), g = actx.createGain();
  src.buffer = buf; g.gain.value = 0.9;
  src.connect(g); g.connect(masterGain); src.start();
}
// warm up the sounds used in the project (so the first bleep isn't silent)
function prepareBleeps() {
  const ids = new Set((P && P.clips || []).filter((c) => c.beeps && c.beeps.length && bleepIsShot(c.beepSound)).map((c) => c.beepSound));
  return Promise.all([...ids].map(bleepBuffer));
}
