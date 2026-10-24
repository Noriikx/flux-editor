/* Flux — audio worklet for the de-esser and noise reduction (runs on the audio thread). */
function hpCoef(f, sr) { const w = 2 * Math.PI * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * 0.7071); const a0 = 1 + al;
  return [(1 + cs) / 2 / a0, -(1 + cs) / a0, (1 + cs) / 2 / a0, -2 * cs / a0, (1 - al) / a0]; }
class FluxDyn extends AudioWorkletProcessor {
  constructor(o) { super(); this.mode = o.processorOptions.mode; this.p = Object.assign({ amount: 50, freq: 6500 }, (o.processorOptions && o.processorOptions.params) || {}); this.env = []; this.g = []; this.z = []; this.cf = null;
    this.port.onmessage = (e) => { Object.assign(this.p, e.data); this.cf = null; }; }
  process(inputs, outputs) {
    const inp = inputs[0], out = outputs[0];
    if (!inp || !inp.length) return true;
    const sr = sampleRate, a = this.p.amount / 100;
    if (this.mode === 'deess' && !this.cf) this.cf = hpCoef(this.p.freq, sr);
    const atk = Math.exp(-1 / (0.002 * sr)), rel = Math.exp(-1 / ((this.mode === 'gate' ? 0.15 : 0.06) * sr));
    const gAtk = Math.exp(-1 / (0.004 * sr)), gRel = Math.exp(-1 / ((this.mode === 'gate' ? 0.12 : 0.03) * sr));
    for (let ch = 0; ch < inp.length; ch++) {
      const x = inp[ch], y = out[ch]; if (!y) continue;
      let env = this.env[ch] || 0, g = this.g[ch] == null ? 1 : this.g[ch];
      if (this.mode === 'deess') {
        const z = this.z[ch] || (this.z[ch] = [0, 0, 0, 0]), [b0, b1, b2, a1, a2] = this.cf;
        const thr = Math.pow(10, (-14 - a * 22) / 20), depth = 0.35 + a * 0.6;
        for (let i = 0; i < x.length; i++) {
          const s = x[i], h = b0 * s + b1 * z[0] + b2 * z[1] - a1 * z[2] - a2 * z[3];
          z[1] = z[0]; z[0] = s; z[3] = z[2]; z[2] = h;
          const r = Math.abs(h); env = r > env ? atk * env + (1 - atk) * r : rel * env + (1 - rel) * r;
          const want = env > thr ? Math.pow(thr / env, depth) : 1;
          g = want < g ? gAtk * g + (1 - gAtk) * want : gRel * g + (1 - gRel) * want;
          y[i] = s - h * (1 - g);
        }
      } else {
        const thr = Math.pow(10, (-62 + a * 32) / 20), floor = Math.pow(10, (-6 - a * 24) / 20);
        for (let i = 0; i < x.length; i++) {
          const s = x[i], r = Math.abs(s); env = r > env ? atk * env + (1 - atk) * r : rel * env + (1 - rel) * r;
          let want = env >= thr ? 1 : Math.max(floor, Math.pow(env / thr, 2));
          g = want > g ? gAtk * g + (1 - gAtk) * want : gRel * g + (1 - gRel) * want;
          y[i] = s * g;
        }
      }
      this.env[ch] = env; this.g[ch] = g;
    }
    return true;
  }
}
registerProcessor('flux-dyn', FluxDyn);
