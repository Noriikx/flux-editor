/* Flux — Viral Shorts: drop in a long video or podcast and Flux finds the best 30-60 second moments,
   then turns each one into a ready vertical Short (cut, reframed to 9:16, captions, hook title).
   Everything runs on this computer: speech-to-text (the same model as Auto captions) + an analysis of
   what makes a clip work - a strong first line, a complete thought, emotion, questions, energy in the voice,
   laughter, no dead air or rambling. */
'use strict';
const SH = {
  src: null,          // { path, name, duration, video }
  words: null, peaks: null, results: [], wordsKey: '',
  busy: false, stop: false, stage: '', value: 0,
  feed: null,
  opts: { range: 'mid', count: 0, reframe: 'fill', captions: true, hook: true, style: 'viral' }
};
const SH_RANGES = { short: [15, 30, 'Short', '15-30s'], mid: [30, 60, 'Classic', '30-60s'], long: [60, 90, 'Long', '60-90s'] };
const SH_STYLES = [['viral', 'Viral'], ['yellowpop', 'Yellow pop'], ['bold', 'Bold'], ['box', 'Color box'], ['classic', 'Classic']];
try { Object.assign(SH.opts, JSON.parse(localStorage.getItem('flux.shorts') || '{}')); } catch {}
if (!SH_STYLES.some((x) => x[0] === SH.opts.style)) SH.opts.style = 'viral';
const shSave = () => { try { localStorage.setItem('flux.shorts', JSON.stringify(SH.opts)); } catch {} };
const SH_ICON = '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>';

/* ---------------- the analysis ---------------- */
const SH_WORDS = {
  hookStart: /^(what|why|how|who|when|where|did you|have you|do you|are you|you|your|here'?s|this is|the (secret|truth|problem|reason|biggest|best|worst|one)|never|nobody|no one|everyone|everybody|stop|if you|i (was|never|can'?t|almost|used to|just|lost|made|quit)|imagine|listen|look|let me|there'?s|most people|the moment|one day|true story|wait)\b/i,
  strong: /\b(crazy|insane|unbelievable|incredible|amazing|shocking|shocked|terrified|scared|afraid|love|hate|hated|angry|furious|cried|crying|died|dead|death|kill|killed|million|millions|billion|money|rich|broke|fired|quit|secret|truth|lie|lied|never|always|worst|best|biggest|huge|massive|wild|literally|honestly|actually|seriously|genuinely|obsessed|mistake|regret|changed my life|life[- ]changing|game changer|nobody|everyone|impossible|finally|ruined|destroyed|disaster|perfect|dream|nightmare|wow|omg|holy|damn|hell|crazy)\b/gi,
  story: /\b(so then|and then|suddenly|turns out|it turns out|the next day|one day|that'?s when|i realized|we realized|out of nowhere|plot twist|long story short|believe it or not)\b/gi,
  payoff: /\b(the answer|the key|the trick|the lesson|here'?s (what|why|how)|that'?s why|which means|the point is|the reason is|so the|because)\b/gi,
  badStart: /^(and|but|so|because|or|um+|uh+|yeah|yes|no|like|well|which|that|it|he|she|they|them|this|those|these|then|also|anyway|right|okay|ok|mhm|hmm)\b/i,
  filler: /\b(um+|uh+|erm|you know|i mean|kind of|sort of|like,)\b/gi,
  laugh: /(\(laugh|\[laugh|laughter|haha|hahaha|lol\b|\(laughs\))/i,
  badEnd: /\b(and|but|so|because|or|the|a|to|of|with|that|which|like|um|uh)[,.…]*$/i
};
function shSentences(words) {
  const out = [];
  let cur = [];
  const flush = () => { if (cur.length) { out.push({ s: cur[0].s, e: cur[cur.length - 1].e, words: cur, text: cur.map((w) => w.w).join(' ').replace(/\s+([,.!?…])/g, '$1') }); cur = []; } };
  words.forEach((w, i) => {
    const next = words[i + 1];
    cur.push(w);
    if (/[.!?…]["')\]]*$/.test(w.w) || !next || next.s - w.e > 0.9 || cur.length > 45) flush();
  });
  flush();
  return out;
}
// a sentence that's only filler / small talk: "Um, and, uh, yeah so anyway." "Yeah." "Okay."
function shFillerSent(x) {
  const t = x.text.toLowerCase().replace(/[^a-z' ]/g, ' ').trim(), ws = t.split(/\s+/).filter(Boolean);
  if (!ws.length) return true;
  const fill = ws.filter((w) => /^(um+|uh+|erm|yeah|yes|okay|ok|so|and|anyway|like|mhm|hmm|right|well|uh-huh|you|know|i|mean|kind|sort|of)$/.test(w)).length;
  return ws.length <= 3 ? fill >= ws.length - 1 : fill / ws.length > 0.5 || (/\b(um+|uh+)\b/.test(t) && ws.length < 9);
}
function shEnergy(peaks, s, e) {
  if (!peaks || !peaks.length) return { mean: 0, dyn: 0 };
  const a = Math.max(0, Math.floor(s * 40)), b = Math.min(peaks.length, Math.ceil(e * 40));
  if (b <= a) return { mean: 0, dyn: 0 };
  let sum = 0, sq = 0;
  for (let i = a; i < b; i++) { sum += peaks[i]; sq += peaks[i] * peaks[i]; }
  const mean = sum / (b - a), dyn = Math.sqrt(Math.max(0, sq / (b - a) - mean * mean));
  return { mean, dyn };
}
function shAnalyze(words, peaks, duration, opts) {
  const [minL, maxL] = SH_RANGES[opts.range] || SH_RANGES.mid;
  const target = (minL + maxL) / 2;
  const sents = shSentences(words.filter((w) => w.w && w.w.trim()));
  if (!sents.length) return [];
  const gE = shEnergy(peaks, 0, duration || sents[sents.length - 1].e);
  const cands = [];
  for (let i = 0; i < sents.length; i++) {
    // a Short should start at the beginning of a thought
    const gapBefore = i === 0 ? 9 : sents[i].s - sents[i - 1].e;
    for (let j = i; j < sents.length; j++) {
      // start on the first real word (skip "um", "so", "yeah" at the very beginning)
      let w0 = 0; const fw = sents[i].words;
      while (w0 < fw.length - 3 && /^(um+|uh+|erm|so|yeah|okay|ok|well|like|and|but)[,.…]*$/i.test(String(fw[w0].w).trim())) w0++;
      const s = Math.max(0, fw[w0].s - 0.15), e = sents[j].e + 0.25, L = e - s;
      if (L > maxL + 4) break;
      if (L < minL) continue;
      const ss = sents.slice(i, j + 1), ws = ss.flatMap((x) => x.words), text = ss.map((x) => x.text).join(' ');
      // filler at the very end (um, yeah, small talk) makes people swipe away
      if (ss.length > 1 && shFillerSent(ss[ss.length - 1])) continue;
      const hookSents = []; for (const x of ss) { hookSents.push(x); if (x.e - ss[0].s > 7) break; }
      const hook = hookSents.map((x) => x.text).join(' ');
      const why = [];
      let sc = 0;
      // the first seconds decide everything
      if (SH_WORDS.hookStart.test(ss[0].text)) { sc += 14; why.push('Strong hook'); }
      if (/\?/.test(hook)) { sc += 8; if (!why.includes('Strong hook')) why.push('Opens with a question'); }
      if (/\d/.test(hook)) sc += 4;
      if (SH_WORDS.badStart.test(ss[0].text)) sc -= 12;
      if (gapBefore > 0.6) sc += 4;
      // talking straight to the viewer, numbers and lists ("3 things…") make people stay
      const you = (hook.match(/\b(you|your|you're|yourself)\b/gi) || []).length;
      if (you) { sc += Math.min(6, you * 2); }
      if (/\b(\d+|one|two|three|four|five|ten) (things|ways|reasons|tips|mistakes|steps|rules|signs|secrets)\b|\bnumber (one|two|three|\d)\b|\bstep (one|1)\b/i.test(hook)) { sc += 7; why.push('List / steps'); }
      // a pronoun nobody knows yet ("he said…", "that was…") means the clip needs context
      if (/^(he|she|they|that|this|it|those|these|him|her)\b/i.test(ss[0].text.replace(/^\W+/, ''))) sc -= 6;
      // emotion, stories and payoffs keep people watching
      const nW = ws.length || 1;
      const strong = (text.match(SH_WORDS.strong) || []).length, story = (text.match(SH_WORDS.story) || []).length, pay = (text.match(SH_WORDS.payoff) || []).length;
      const emo = (strong / nW) * 100;
      sc += Math.min(18, emo * 3.2);
      if (emo > 2.2) why.push('Emotional');
      if (story) { sc += Math.min(10, story * 5); why.push('Tells a story'); }
      if (pay) sc += Math.min(8, pay * 3);
      const qs = (text.match(/\?/g) || []).length, ex = (text.match(/!/g) || []).length;
      sc += Math.min(8, qs * 2.5) + Math.min(6, ex * 2);
      if (SH_WORDS.laugh.test(text)) { sc += 8; why.push('Funny'); }
      // pace: lively but clear; dead air and filler lose viewers
      const wps = nW / L;
      sc += wps >= 2.2 && wps <= 3.8 ? 8 : wps < 1.6 ? -10 : wps > 4.5 ? -4 : 2;
      let dead = 0; for (let k = 1; k < ws.length; k++) { const g = ws[k].s - ws[k - 1].e; if (g > 0.6) dead += g; }
      sc -= Math.min(18, (dead / L) * 60);
      const fill = (text.match(SH_WORDS.filler) || []).length;
      sc -= Math.min(12, (fill / nW) * 250);
      // voice energy compared with the whole recording
      const en = shEnergy(peaks, s, e);
      if (gE.mean > 0) {
        const lift = en.mean / gE.mean, dyn = gE.dyn > 0 ? en.dyn / gE.dyn : 1;
        sc += Math.max(-8, Math.min(12, (lift - 1) * 30)) + Math.max(-4, Math.min(6, (dyn - 1) * 12));
        if (lift > 1.15) why.push('High energy');
      }
      // a clean ending, close to the ideal length
      const last = ss[ss.length - 1].text;
      if (/[.!?…]["')]*$/.test(last) && !SH_WORDS.badEnd.test(last)) { sc += 6; } else sc -= 6;
      // ending on a punchline / payoff / laugh makes people rewatch
      if (/[!?]["')]*$/.test(last) || SH_WORDS.laugh.test(last) || SH_WORDS.payoff.test(last)) { sc += 4; SH_WORDS.payoff.lastIndex = 0; }
      sc -= Math.abs(L - target) / target * 8;
      if (ss.length >= 2 && !why.length) why.push('Complete thought');
      cands.push({ s, e, i, j, score: sc, hook, text, why: [...new Set(why)].slice(0, 3) });
    }
  }
  if (!cands.length) return [];
  // the best ones that don't overlap
  cands.sort((a, b) => b.score - a.score);
  const want = opts.count > 0 ? opts.count : Math.max(1, Math.min(10, Math.round((duration || 600) / 300) + 2));
  const picked = [];
  // greedy, but moments right next to one already picked count a bit less - so the Shorts cover the whole video
  const pool = cands.slice(0, 4000);
  while (picked.length < want) {
    let best = null, bestSc = -Infinity;
    for (const c of pool) {
      if (picked.some((p) => c.s < p.e + 3 && c.e > p.s - 3)) continue;
      const near = picked.filter((p) => Math.abs(c.s - p.s) < 90).length;
      const sc = c.score - near * 5;
      if (sc > bestSc) { bestSc = sc; best = c; }
    }
    if (!best) break;
    picked.push(best);
  }
  picked.sort((a, b) => b.score - a.score);
  // a friendly 0-99 "viral score" from how many good signs the moment has
  for (const p of picked) {
    p.viral = Math.round(Math.max(12, Math.min(98, 52 + p.score * 1.15)));
    p.title = shTitle(p.hook);
  }
  return picked;
}
function shTitle(hook) {
  let t = String(hook || '').replace(/\s+/g, ' ').replace(/^(so|and|but|um+|uh+|like|well|okay|ok|yeah)[, ]+/i, '').trim();
  const first = (t.match(/^[^.!?…]+[.!?…]?/) || [t])[0];
  t = first.length >= 12 ? first : t;
  if (t.length > 62) { t = t.slice(0, 62); t = t.slice(0, t.lastIndexOf(' ') > 30 ? t.lastIndexOf(' ') : 62) + '…'; }
  t = t.replace(/[,;:]$/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ---------------- getting the words ---------------- */
// a part with (almost) no sound at all doesn't need to be listened to
function shSilent(peaks, a, b) {
  if (!peaks || !peaks.length) return false;
  const i0 = Math.floor(a * 40), i1 = Math.min(peaks.length, Math.ceil(b * 40));
  if (i1 <= i0) return false;
  let loud = 0;
  for (let i = i0; i < i1; i++) if (peaks[i] > 0.02) loud++;
  return loud / (i1 - i0) < 0.01;
}
// the words of the last few videos are remembered, so changing the clip length or re-opening is instant
function shCacheGet(key) {
  try { const all = JSON.parse(localStorage.getItem('flux.shortsWords') || '[]'); const x = all.find((e) => e.k === key); return x ? { words: x.w.map(([w, s, e]) => ({ w, s, e })), refined: x.r } : null; } catch { return null; }
}
function shCachePut(key, v) {
  try {
    let all = JSON.parse(localStorage.getItem('flux.shortsWords') || '[]').filter((e) => e.k !== key);
    all.unshift({ k: key, w: v.words.map((x) => [x.w, Math.round(x.s * 100) / 100, Math.round(x.e * 100) / 100]), r: v.refined });
    all = all.slice(0, 4);
    for (;;) { try { localStorage.setItem('flux.shortsWords', JSON.stringify(all)); break; } catch { if (all.length <= 1) break; all.pop(); } }
  } catch {}
}
function shProbe(file) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.preload = 'metadata'; v.muted = true;
    const done = (r) => { v.removeAttribute('src'); try { v.load(); } catch {} resolve(r); };
    const to = setTimeout(() => done(null), 20000);
    v.onloadedmetadata = () => { clearTimeout(to); done({ duration: v.duration || 0, video: v.videoWidth > 0 }); };
    v.onerror = () => { clearTimeout(to); done(null); };
    v.src = api.mediaUrl(file);
  });
}
const shPro = () => typeof requirePremium !== 'function' || requirePremium('Viral Shorts');
// the file Flux listens to: the video itself, or only the sound of a YouTube / Twitch link
function shFile() { return (SH.src && SH.src.audioPath) || (SH.src && SH.src.path); }
// YouTube's "most replayed" graph, turned into the loudness-like signal the moment finder uses
function shHeatPeaks(heat, D) {
  if (!heat || !heat.length || !D) return null;
  const n = Math.ceil(D * 40), out = new Array(n).fill(0.12);
  for (const [a, b, v] of heat) { const i0 = Math.max(0, Math.floor(a * 40)), i1 = Math.min(n, Math.ceil(b * 40)); for (let i = i0; i < i1; i++) out[i] = 0.08 + 0.5 * v; }
  return out;
}
function shHeat(results) {
  const heat = SH.src && SH.src.heat;
  if (!heat || !heat.length) return results;
  for (const r of results) {
    const parts = heat.filter(([a, b]) => b > r.s && a < r.e);
    const v = parts.length ? parts.reduce((x, h) => x + h[2], 0) / parts.length : 0;
    if (v > 0.55) { r.why = [...(r.why || []).filter((w) => w !== 'Most replayed'), 'Most replayed']; r.viral = Math.min(99, Math.round(r.viral + (v - 0.5) * 20)); }
  }
  return results.sort((a, b) => b.viral - a.viral);
}
function shHookProgress() {
  if (rt.shProgHooked || !api.onShortsProgress) return;
  rt.shProgHooked = true;
  api.onShortsProgress((v) => {
    if (!SH.linkDl) return;
    if (v.stage === 'tool') shStage('Getting the downloader (first time only)', v.value || null);
    else if (v.stage === 'info') shStage('Reading the video', null);
    else if (v.stage === 'sound') shStage(`Getting only the sound… ${Math.round(v.value * 100)}%${v.size ? ' of ' + v.size : ''}`, v.value);
    else if (v.stage === 'section') shStage(`Downloading just this moment… ${Math.round(v.value * 100)}%`, v.value);
    else if (v.stage === 'download') shStage(`Downloading… ${Math.round(v.value * 100)}%`, v.value);
  });
}
async function shRun() {
  if (!SH.src || SH.busy) return;
  if (!shPro()) return;
  if (!api || !api.transcribe) return toast('Viral Shorts works in the Flux desktop app');
  SH.busy = true; SH.stop = false; SH.results = [];
  const model = settings.asrModel || (lowEnd() ? 'tiny' : 'base'), lang = settings.asrLang || 'auto';
  const D = SH.src.duration;
  // long videos: a quick listen with the small model finds the moments, then only those are listened to again
  // with the accurate model (for exact cuts and captions). Much faster than the accurate model on everything.
  const quick = model !== 'tiny' && D > 6 * 60 ? 'tiny' : model;
  const key = SH.src.path + '|' + Math.round(D) + '|' + model + '|' + lang;
  const tx = (o) => (window.__shTx || api.transcribe)(o);
  try {
    if (SH.wordsKey !== key || !SH.words) {
      SH.words = null; SH.peaks = null; SH.refined = [];
      const remote = SH.src.remote;
      if (remote) SH.peaks = shHeatPeaks(SH.src.heat, D);
      if (remote && SH.src.words) { SH.words = SH.src.words; SH.wordsKey = key; SH.refined = [[0, D]]; }
      else if (remote && !SH.src.audioPath) {
        // no captions: get only the sound (small, deleted after 2 days) so Flux can listen to it
        shStage('Getting the sound of the video (not the video itself)', null); shRender();
        SH.linkDl = true; shHookProgress();
        let ra; try { ra = await api.shortsPlatformAudio(SH.src); } finally { SH.linkDl = false; }
        if (ra.error) throw new Error(ra.error === 'cancelled' ? 'stopped' : ra.error);
        SH.src.audioPath = ra.path;
      }
    }
    if (SH.wordsKey !== key || !SH.words) {
      if (!SH.src.remote || SH.src.audioPath) { shStage('Reading the sound', null); shRender(); }
      const pk = !SH.src.remote || SH.src.audioPath ? (api.mediaPeaks ? await api.mediaPeaks(shFile()) : null) : null;
      if (pk && pk.peaks && !(SH.src.remote && SH.src.heat)) SH.peaks = pk.peaks;
      const saved = shCacheGet(key);
      if (saved) { SH.words = saved.words; SH.refined = saved.refined || []; SH.wordsKey = key; }
      else {
        // listen in 4-minute parts so there's progress (and Stop works) even for a 3-hour podcast; silent parts are skipped
        const STEP = 240, words = [];
        if (api.onTranscribeProgress && !rt.asrHooked) { api.onTranscribeProgress((v) => rt.asrProgress && rt.asrProgress(v)); rt.asrHooked = true; }
        const t0 = performance.now();
        for (let t = 0; t < D && !SH.stop; t += STEP) {
          const end = Math.min(D, t + STEP);
          if (shSilent(SH.peaks, t, end)) continue;
          rt.asrProgress = (v) => { if (v.stage === 'download') shStage('Downloading the speech model (first time only)', v.value || null); };
          const el = (performance.now() - t0) / 1000, left = t > 0 ? el / (t / D) - el : 0;
          shStage(`Listening… ${fmtMin(t)} of ${fmtMin(D)}${left > 20 ? ' · about ' + fmtMin(left) + ' left' : ''}`, (t / D) * (quick !== model ? 0.8 : 1));
          const r = await tx({ file: shFile(), start: t, end, model: quick, language: lang });
          if (r && r.error) throw new Error(r.error);
          for (const w of (r && r.words) || []) words.push({ w: w.w, s: w.s + t, e: w.e + t });
        }
        rt.asrProgress = null;
        if (SH.stop) throw new Error('stopped');
        SH.words = words; SH.wordsKey = key; SH.refined = quick === model ? [[0, D]] : [];
      }
    }
    shStage('Finding the best moments', null); shRender();
    await new Promise((r) => setTimeout(r, 30));
    SH.results = shHeat(shAnalyze(SH.words, SH.peaks, D, SH.opts));
    // second pass: the picked moments are listened to again with the accurate model, then picked again
    for (let round = 0; round < 2 && SH.results.length && !SH.stop; round++) {
      const todo = SH.results.filter((r) => !SH.refined.some(([a, b]) => r.s >= a - 1 && r.e <= b + 1));
      if (!todo.length) break;
      let n = 0;
      for (const r of todo) {
        if (SH.stop) break;
        shStage(`Listening closely to the best moments… ${++n} of ${todo.length}`, 0.8 + 0.2 * (n / todo.length));
        const a = Math.max(0, r.s - 8), b = Math.min(D, r.e + 8);
        const res = await tx({ file: shFile(), start: a, end: b, model, language: lang });
        SH.refined.push([a + 1, b - 1]); // listened to closely (even if nothing new was heard)
        if (!res || res.error || !res.words || !res.words.length) continue;
        const fresh = res.words.map((w) => ({ w: w.w, s: w.s + a, e: w.e + a })).filter((w) => w.s >= a + 0.5 && w.e <= b - 0.5);
        if (!fresh.length) continue;
        const fa = fresh[0].s, fb = fresh[fresh.length - 1].e;
        SH.words = [...SH.words.filter((w) => w.e <= fa || w.s >= fb), ...fresh].sort((x, y) => x.s - y.s);
      }
      if (SH.stop) throw new Error('stopped');
      SH.results = shHeat(shAnalyze(SH.words, SH.peaks, D, SH.opts));
    }
    shCachePut(key, { words: SH.words, refined: SH.refined });
    if (!SH.results.length) toast(SH.words.length < 30 ? 'Flux couldn’t hear enough speech in this file' : 'No moments of that length were found - try another clip length', { error: true });
  } catch (e) {
    if (String(e.message) !== 'stopped') toast('Viral Shorts: ' + (e.message || e), { error: true, duration: 7000 });
  } finally {
    SH.busy = false; rt.asrProgress = null; shStage('', 0); shRender();
  }
}
function shWrap(t, n) {
  const lines = []; let cur = '';
  for (const w of String(t).split(/\s+/)) { if (cur && (cur + ' ' + w).length > n) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) lines.push(cur);
  return lines.slice(0, 4).join('\n');
}
function fmtMin(s) { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); }
function shStage(t, v) {
  SH.stage = t; SH.value = v;
  const p = $('#shProg');
  if (!p) return;
  p.hidden = !t;
  $('span', p).textContent = t + (v != null && t ? ' · ' + Math.round(v * 100) + '%' : '');
  const bar = $('.enh-bar', p);
  bar.classList.toggle('indet', v == null);
  $('i', bar).style.width = (v != null ? Math.round(v * 100) : 30) + '%';
}

/* ---------------- choosing the source ---------------- */
async function shSetSource(file, name) {
  if (SH.busy) return;
  shStage('Opening the file', null); shRender();
  const info = await shProbe(file);
  shStage('', 0);
  if (!info || !(info.duration > 0)) { shRender(); return toast('Flux couldn’t open that file', { error: true }); }
  if (info.duration < 20) { shRender(); return toast('That’s already short - Viral Shorts is for long videos and podcasts', { error: true }); }
  SH.src = { path: file, name: name || file.split(/[\\/]/).pop(), duration: info.duration, video: info.video };
  SH.results = []; SH.feed = null;
  if (SH.wordsKey && !SH.wordsKey.startsWith(file + '|')) { SH.words = null; SH.wordsKey = ''; }
  shRender();
}
async function shPick() {
  const files = await api.openMedia();
  const f = files && files.find((x) => /\.(mp4|mov|m4v|webm|mkv|ogv|mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(x.name));
  if (f) shSetSource(f.path, f.name);
}
async function shLink(url) {
  if (!url || SH.busy) return;
  if (!api.shortsLink) return;
  SH.busy = true; shStage('Getting the link', null); shRender();
  let r;
  try { r = await api.shortsLink(url); } finally { SH.busy = false; shStage('', 0); }
  if (r.error === 'yt') return shPlatform(r.url);
  if (r.error === 'platform') { shRender(); return shPlatformNote(r.host); }
  if (r.error === 'page') { shRender(); return toast('That link is a web page, not a video or audio file. Use a direct link to the file (it usually ends in .mp4 or .mp3) or a podcast’s RSS feed.', { error: true, duration: 9000 }); }
  if (r.error) { shRender(); return toast(r.error, { error: true, duration: 7000 }); }
  if (r.feed) { SH.feed = r.feed; shRender(); return; }
  await shSetSource(r.path, r.name);
}
// YouTube / Twitch: Flux downloads the video (with yt-dlp) and then finds the moments
async function shPlatform(url) {
  if (!api.shortsPlatform) return toast('Update Flux to use YouTube and Twitch links', { error: true });
  if (!settings.ytOk) {
    const ok = await new Promise((res) => {
      const box = modal(`<h2>Use this video?</h2><p class="sub">Flux reads the video’s captions to find the best moments - it doesn’t download the whole video. When you make a Short, only that moment is downloaded. Only use videos <b>you made</b> or that you have <b>permission</b> to use - re-uploading other people's videos can break copyright and the site's rules.</p>
        <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn primary" data-a="yes">It's my video / I have permission</button></div>`);
      $('[data-a=no]', box).onclick = () => { closeModal(); res(false); };
      $('[data-a=yes]', box).onclick = () => { closeModal(); res(true); };
    });
    if (!ok) return shRender();
    settings.ytOk = true; saveSettings();
  }
  SH.busy = true; SH.stop = false; SH.linkDl = true;
  shStage(/twitch/i.test(url) ? 'Opening the Twitch link' : 'Opening the YouTube link', null); shRender();
  shHookProgress();
  let r;
  try { r = await api.shortsPlatform(url); } finally { SH.busy = false; SH.linkDl = false; shStage('', 0); }
  if (r.error) { shRender(); if (r.error !== 'cancelled') toast(r.error, { error: true, duration: 8000 }); return; }
  shStopPreview();
  SH.src = { remote: true, url: r.url, id: r.id, site: r.site, path: 'link:' + r.site + '-' + r.id, name: r.name, duration: r.duration, video: true, words: r.words, heat: r.heat };
  SH.results = []; SH.feed = null; SH.words = null; SH.wordsKey = '';
  shRender();
  toast(r.words ? 'Ready - Flux will use the video’s captions. Nothing is downloaded until you make a Short.' : 'Ready - this one has no captions, so Flux will listen to its sound first. Press Find the best moments.', { duration: 7000 });
}
function shPlatformNote(host) {
  const box = modal(`<h2>Links from ${host} can't be downloaded</h2>
    <p class="sub">${host} doesn't allow other apps to download its videos, so Flux doesn't do it. For your own videos, download the file from the site (for YouTube: YouTube Studio → Content → ⋮ → Download), then drop it here.</p>
    <p class="hint">Direct links to video / audio files (.mp4, .mp3…) and podcast RSS feeds work.</p>
    <div class="footer"><button class="btn primary" data-a="ok">Got it</button></div>`);
  $('[data-a=ok]', box).onclick = closeModal;
}

/* ---------------- making the Shorts ---------------- */
async function shCreate(r, { quiet = false } = {}) {
  if (!SH.src) return null;
  if (!shPro()) return null;
  shStopPreview();
  if (state.inEditor) await saveNow();
  const o = SH.opts;
  let src = SH.src, shift = 0;
  if (src.remote) {
    // download only this moment (a little extra on both sides for clean cuts)
    SH.linkDl = true; shHookProgress(); shStage('Downloading just this moment…', 0); shRender();
    let part;
    try { part = await api.shortsSection({ url: src.url, id: src.id, site: src.site, start: Math.max(0, r.s - 1), end: Math.min(src.duration || r.e + 1, r.e + 1) }); } finally { SH.linkDl = false; shStage('', 0); shRender(); }
    if (!part || part.error) { if (part && part.error !== 'cancelled') toast(part.error, { error: true, duration: 8000 }); return null; }
    shift = part.start;
    src = { path: part.path, name: src.name + ' (' + fmtMin(r.s) + ')', duration: r.e - r.s + 2, video: true };
    r = { ...r, s: r.s - shift, e: r.e - shift };
  }
  const words = shift && SH.words ? SH.words.map((w) => ({ ...w, s: w.s - shift, e: w.e - shift })).filter((w) => w.e > 0 && w.s < r.e + 2) : SH.words;
  await createProject(r.title.replace(/[…?!.]+$/, '').slice(0, 50) || 'Short', '9:16');
  const [m] = await importFiles([{ path: src.path, name: src.name }]);
  if (!m) { toast('Flux couldn’t open the file for this Short', { error: true }); return null; }
  if (words && !shift) { m.words = words; m.wordsKey = SH.wordsKey.split('|').slice(1).join('|'); }
  const L = r.e - r.s;
  let main = null, sound = null;
  commit(() => {
    P.aspect = '9:16';
    if (m.kind === 'video' && src.video !== false) {
      const t = firstTrack('video');
      main = makeMediaClip(m, t.id, 0);
      main.in = r.s; main.out = r.e;
      if (o.reframe === 'blur') { main.fit = 'contain'; main.bgBlur = true; } else main.fit = 'cover';
      P.clips.push(main);
      linkSoundFor(main, m);
      sound = soundClipOf(main);
      if (sound) { sound.in = r.s; sound.out = r.e; }
    } else {
      // a podcast without picture: an "audiogram" - colored background, big title and captions
      P.background = '#14112b';
      const t = firstTrack('audio');
      sound = makeMediaClip(m, t.id, 0);
      sound.in = r.s; sound.out = r.e;
      P.clips.push(sound);
    }
    const spk = main && sound ? main : sound || main;
    // the hook as a title at the top for the first seconds (the whole time for podcasts)
    if (o.hook) {
      const tc = makeTextClip(0, { content: shWrap(r.title, main ? 20 : 18), size: main ? 58 : 70, y: main ? 0.15 : 0.22, bg: true, bgColor: '#000000', bgOpacity: 0.62, shadow: false, bold: true, anim: 'pop', font: 'Segoe UI' });
      tc.out = main ? Math.min(4, L) : L;
      P.clips.push(tc);
    }
    // captions from the words Flux already heard
    if (o.captions && words) {
      const keep = { ...capOpts };
      capOpts.style = o.style; capOpts.pos = main ? 0.7 : 0.55; capOpts.perLine = 4; capOpts.size = 0;
      const capSrc = sound || spk;
      const caps = buildCaptions(capSrc, words);
      Object.assign(capOpts, keep);
      const tr = captionTrack();
      for (const c of caps) { c.trackId = tr.id; P.clips.push(c); }
    }
    state.selectedId = main ? main.id : null;
  });
  if (typeof ensureProjectFonts === 'function') ensureProjectFonts();
  fitZoomSoon();
  // show a frame with the title on it, so the project gets a real thumbnail
  seek(Math.min(1.2, L / 2));
  if (typeof playersReady === 'function') await playersReady(2500);
  await new Promise((res) => setTimeout(res, 250));
  requestDraw();
  await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
  await saveNow();
  if (!quiet) toast(`Short ready: “${r.title}” - edit anything, then Export`, { duration: 6000 });
  return true;
}
async function shCreateAll() {
  if (!SH.results.length || SH.busy) return;
  SH.busy = true; shRender();
  try {
    for (let i = 0; i < SH.results.length; i++) {
      shStage(`Making Short ${i + 1} of ${SH.results.length}`, i / SH.results.length);
      await shCreate(SH.results[i], { quiet: true });
    }
    toast(`${SH.results.length} Shorts made - find them all on the Projects page`, { duration: 7000 });
  } finally { SH.busy = false; shStage('', 0); shRender(); }
}

/* ---------------- preview ---------------- */
let shPrev = null;
function shStopPreview() { if (shPrev) { try { shPrev.el.pause(); } catch {} shPrev = null; } }
function shPreview(r, btn) {
  if (!SH.src) return;
  if (SH.src.remote) {
    const t = Math.max(0, Math.floor(r.s));
    const u = SH.src.site === 'yt' ? `https://www.youtube.com/watch?v=${encodeURIComponent(SH.src.id)}&t=${t}s` : SH.src.url.split('?')[0] + '?t=' + Math.floor(t / 3600) + 'h' + Math.floor((t % 3600) / 60) + 'm' + (t % 60) + 's';
    if (api && api.openExternal) api.openExternal(u);
    return;
  }
  if (shPrev && shPrev.r === r) { shStopPreview(); shRender(); return; }
  shStopPreview();
  shRender();
  const card = [...document.querySelectorAll('.sh-card')].find((c) => c._r === r);
  const box = card && $('.sh-pv', card);
  if (!box) return;
  box.innerHTML = '';
  box.hidden = false;
  const v = document.createElement(SH.src.video ? 'video' : 'audio');
  v.src = api.mediaUrl(SH.src.path); v.controls = true; v.className = 'sh-video';
  box.appendChild(v);
  const cap = el('div', 'sh-cap');
  box.appendChild(cap);
  v.currentTime = r.s;
  v.play().catch(() => {});
  v.ontimeupdate = () => {
    if (v.currentTime >= r.e) { v.pause(); v.currentTime = r.s; }
    if (!v.isConnected) { v.pause(); return; }
    if (SH.words) { const w = SH.words.filter((x) => x.s <= v.currentTime + 1.2 && x.e >= v.currentTime - 1.2).map((x) => x.w).join(' '); cap.textContent = w; }
  };
  shPrev = { r, el: v };
  $('.sh-play', card).textContent = 'Stop';
  if (typeof state !== 'undefined' && state.playing && typeof togglePlay === 'function') togglePlay();
}

/* ---------------- the tab ---------------- */
function shRender() {
  const page = document.querySelector('.tab-page[data-page=shorts]');
  if (!page) return;
  if (!page.dataset.built) {
    page.dataset.built = '1';
    page.innerHTML = `
      <div class="sh-hero"><span class="sh-hero-ic"><svg viewBox="0 0 24 24">${SH_ICON}</svg></span><div><b>Viral Shorts ${typeof CROWN !== 'undefined' ? CROWN : ''}</b><small>Turn a long video or podcast into ready-to-post Shorts. Flux finds the best moments for you.</small></div></div>
      <div class="sh-src"></div>
      <div class="sh-opts"></div>
      <div id="shProg" class="sh-prog" hidden><span></span><div class="enh-bar"><i></i></div><button class="link-btn sh-stop">Stop</button></div>
      <div class="sh-results"></div>`;
    $('.sh-stop', page).onclick = () => { SH.stop = true; if (SH.linkDl && api.shortsCancelLink) api.shortsCancelLink(); };
    // drop a file right on the tab
    page.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); page.classList.add('sh-drop'); });
    page.addEventListener('dragleave', () => page.classList.remove('sh-drop'));
    page.addEventListener('drop', (e) => {
      e.preventDefault(); e.stopPropagation(); page.classList.remove('sh-drop');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      const p = f && (api.pathForFile ? api.pathForFile(f) : f.path);
      if (p) shSetSource(p, f.name);
      const id = e.dataTransfer.getData('text/flux-media') || e.dataTransfer.getData('flux/media');
      if (!p && id) { const m = getMedia(id); if (m && m.path) shSetSource(m.path, m.name); }
    });
  }
  shStage(SH.stage, SH.value);
  // 1) the source
  const srcBox = $('.sh-src', page);
  if (!SH.src) {
    srcBox.innerHTML = `<div class="sh-dropzone"><svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/></svg><b>Drop a long video or podcast here</b><small>MP4, MOV, MP3, M4A… any length</small><button class="btn sh-pick">Choose a file</button></div>
      <div class="sh-or">or paste a link</div>
      <div class="sh-link"><input class="num-input" placeholder="Paste a YouTube or Twitch link (or a .mp4 / podcast link)"><button class="btn">Get</button></div>
      <div class="sh-link-note">YouTube videos, streams and Twitch VODs work. Only use videos you made or have permission to use.</div>
      <div class="sh-proj"></div>`;
    $('.sh-pick', srcBox).onclick = shPick;
    const inp = $('.sh-link input', srcBox);
    $('.sh-link .btn', srcBox).onclick = () => shLink(inp.value.trim());
    inp.onkeydown = (e) => { if (e.key === 'Enter') shLink(inp.value.trim()); };
    const own = (typeof P !== 'undefined' && P ? P.media : []).filter((m) => (m.kind === 'video' || m.kind === 'audio') && m.duration >= 60 && m.path && !m.missing);
    if (own.length) {
      const pj = $('.sh-proj', srcBox);
      pj.innerHTML = '<div class="set-h4">From this project</div>';
      for (const m of own.slice(0, 6)) {
        const b = el('button', 'sh-own');
        b.innerHTML = `<svg viewBox="0 0 24 24">${m.kind === 'video' ? '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>' : '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'}</svg><span></span><small>${fmtMin(m.duration)}</small>`;
        $('span', b).textContent = m.name;
        b.onclick = () => shSetSource(m.path, m.name);
        pj.appendChild(b);
      }
    }
    if (SH.feed) {
      const f = el('div', 'sh-feed');
      f.innerHTML = '<div class="set-h4"></div>';
      $('.set-h4', f).textContent = (SH.feed.title || 'Podcast') + ' · pick an episode';
      for (const it of SH.feed.items) {
        const b = el('button', 'sh-own');
        b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg><span></span><small></small>';
        $('span', b).textContent = it.title; $('small', b).textContent = it.duration ? fmtMin(it.duration) : '';
        b.onclick = () => shLink(it.url);
        f.appendChild(b);
      }
      srcBox.appendChild(f);
    }
  } else {
    srcBox.innerHTML = `<div class="sh-file"><span class="sh-file-ic"><svg viewBox="0 0 24 24">${SH.src.video ? '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>' : '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'}</svg></span><div><b></b><small>${fmtMin(SH.src.duration)} · ${SH.src.video ? 'video' : 'audio only - Flux makes a captioned audiogram'}</small></div><button class="icon-btn small sh-clear" data-tip="Use another file"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>`;
    $('b', srcBox).textContent = SH.src.name;
    $('.sh-clear', srcBox).onclick = () => { if (SH.busy) return; SH.src = null; SH.results = []; shStopPreview(); shRender(); };
  }
  // 2) the options
  const ob = $('.sh-opts', page);
  ob.hidden = !SH.src;
  if (SH.src) {
    ob.innerHTML = `<div class="set-h4">Clip length</div><div class="seg sh-range"></div>
      <div class="set-h4">Captions</div><div class="chips small sh-style"></div>
      <div class="set-h4">Fit to vertical</div><div class="seg sh-fit"><button data-v="fill">Fill<small>Crop to 9:16</small></button><button data-v="blur">Whole picture<small>Blurred bars</small></button></div>
      <label class="sh-check"><input type="checkbox" data-k="hook"> Show the hook as a title</label>
      <button class="btn primary sh-go">${SH.busy ? 'Working…' : SH.results.length ? 'Find again' : 'Find the best moments'}</button>`;
    const rg = $('.sh-range', ob);
    for (const [k, [a, b, n, d]] of Object.entries(SH_RANGES)) {
      const bt = el('button', SH.opts.range === k ? 'active' : '');
      bt.innerHTML = `${n}<small>${d}</small>`;
      bt.onclick = () => { SH.opts.range = k; shSave(); shRender(); };
      rg.appendChild(bt);
    }
    const sty = $('.sh-style', ob);
    const off = el('button', 'chip' + (!SH.opts.captions ? ' active' : ''), 'None');
    off.onclick = () => { SH.opts.captions = false; shSave(); shRender(); };
    sty.appendChild(off);
    for (const [id, n] of SH_STYLES) {
      const st = CAPTION_STYLES.find((s) => s.id === id);
      if (!st) continue;
      const b = el('button', 'chip' + (SH.opts.captions && SH.opts.style === id ? ' active' : ''), n);
      b.onclick = () => { SH.opts.captions = true; SH.opts.style = id; shSave(); shRender(); };
      sty.appendChild(b);
    }
    $$('.sh-fit button', ob).forEach((b) => { b.classList.toggle('active', b.dataset.v === SH.opts.reframe); b.onclick = () => { SH.opts.reframe = b.dataset.v; shSave(); shRender(); }; });
    const hk = $('[data-k=hook]', ob); hk.checked = !!SH.opts.hook; hk.onchange = () => { SH.opts.hook = hk.checked; shSave(); };
    const go = $('.sh-go', ob);
    go.disabled = SH.busy;
    go.onclick = () => shRun();
  }
  // 3) the results
  const rb = $('.sh-results', page);
  rb.innerHTML = '';
  if (SH.results.length) {
    const head = el('div', 'sh-res-head');
    head.innerHTML = `<b>${SH.results.length} moments found</b><button class="btn primary sh-all"${SH.busy ? ' disabled' : ''}>Make all ${SH.results.length}</button>`;
    $('.sh-all', head).onclick = shCreateAll;
    rb.appendChild(head);
    SH.results.forEach((r, i) => {
      const card = el('div', 'sh-card');
      card.style.animationDelay = i * 40 + 'ms';
      card._r = r;
      card.innerHTML = `<div class="sh-score" style="--v:${r.viral}"><span>${r.viral}</span></div>
        <div class="sh-info"><b class="sh-title"></b><small>${fmtMin(r.s)} - ${fmtMin(r.e)} · ${Math.round(r.e - r.s)}s</small><div class="sh-why">${r.why.map((w) => `<i>${w}</i>`).join('')}</div><p class="sh-text"></p>
        <div class="sh-pv sh-preview" hidden></div>
        <div class="sh-actions"><button class="btn ghost sh-play">${SH.src && SH.src.remote ? '▶ Watch on ' + (SH.src.site === 'yt' ? 'YouTube' : 'Twitch') : '▶ Preview'}</button><button class="btn sh-make">Make Short</button></div></div>`;
      $('.sh-title', card).textContent = r.title;
      $('.sh-text', card).textContent = '“' + r.text.slice(0, 190) + (r.text.length > 190 ? '…' : '') + '”';
      $('.sh-play', card).onclick = (e) => shPreview(r, e.currentTarget);
      $('.sh-make', card).onclick = async (e) => { if (SH.busy) return; e.currentTarget.disabled = true; SH.busy = true; try { await shCreate(r); } finally { SH.busy = false; shRender(); } };
      if (SH.busy) $('.sh-make', card).disabled = true;
      rb.appendChild(card);
    });
  } else if (SH.src && !SH.busy) {
    rb.innerHTML = `<p class="hint">Flux listens to the whole ${SH.src.video ? 'video' : 'recording'} (on your computer), then picks the moments most likely to do well: a strong first line, a complete thought, emotion, energy and no dead air. ${SH.src.duration > 1800 ? 'Long files take a while - you can keep editing meanwhile.' : ''}</p>`;
  }
}

(function setupShortsTab() {
  const tabs = document.getElementById('libTabs'), lib = document.getElementById('library');
  if (!tabs || !lib || document.querySelector('[data-tab=shorts]')) return;
  const tab = el('button', 'tab', `<svg viewBox="0 0 24 24">${SH_ICON}</svg>Shorts${typeof CROWN !== 'undefined' ? CROWN : ''}`);
  tab.dataset.tab = 'shorts';
  tab.dataset.tip = 'Viral Shorts - turn a long video or podcast into Shorts';
  tabs.insertBefore(tab, tabs.children[1] || null);
  const page = el('section', 'tab-page'); page.dataset.page = 'shorts';
  const firstPage = lib.querySelector('.tab-page');
  lib.insertBefore(page, firstPage ? firstPage.nextSibling : null);
  tab.addEventListener('click', () => showLibTab('shorts'));
  const baseShow = showLibTab;
  showLibTab = function (name) { const r = baseShow.apply(this, arguments); if (name === 'shorts') shRender(); else shStopPreview(); return r; };
})();

// a way in from the home screen: opens (or makes) a "Viral Shorts" project with the Shorts tab ready
(function setupShortsHome() {
  const hero = document.querySelector('.home-hero');
  if (!hero || document.querySelector('.sh-home')) return;
  const b = el('button', 'sh-home', `<span class="sh-hero-ic"><svg viewBox="0 0 24 24">${SH_ICON}</svg></span><span><b>Viral Shorts</b><small>Turn a long video or podcast into Shorts</small></span><svg viewBox="0 0 24 24" class="sh-home-go"><path d="m9 6 6 6-6 6"/></svg>`);
  b.onclick = async () => {
    let list = [];
    try { list = await projectStore.list(); } catch {}
    const ex = list.find((p) => p.name === 'Viral Shorts');
    if (ex) await openProjectById(ex.id); else await createProject('Viral Shorts', '9:16');
    showLibTab('shorts');
  };
  hero.appendChild(b);
})();
