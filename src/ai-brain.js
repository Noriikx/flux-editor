/* Flux 5.1 — the AI Editor's brain, running on this computer (no internet, no account, no Claude key).
   It reads a request like a person would: splits it into steps ("cut the first 3s, then add a title and make it warmer"),
   works out WHICH clips you mean (this one, the music, the 2nd clip, every clip, "intro.mp4"…) and WHEN (at 0:05,
   from 3 to 8s, the first/last N seconds, at the end, every cut…), and turns each step into an edit.
   It also answers "how do I…" questions about editing in Flux. */
'use strict';

/* ============================ words ============================ */
const AIB_NUM = { zero: 0, one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, ninety: 90, hundred: 100, half: 0.5, double: 2, twice: 2, triple: 3,
  unu: 1, una: 1, doi: 2, doua: 2, trei: 3, patru: 4, cinci: 5, sase: 6, sapte: 7, opt: 8, noua: 9, zece: 10 };
const AIB_COLORS = { white: '#ffffff', black: '#000000', red: '#ff3b4a', orange: '#ff9f43', yellow: '#ffd23f', gold: '#ffc53d', green: '#2bd17e', lime: '#a6ff4d', teal: '#20c4b0', cyan: '#4cdcff', blue: '#3f7bff', navy: '#1b2a6b', purple: '#8d5cff', violet: '#8d5cff', pink: '#ff6fb5', magenta: '#ff3bd4', grey: '#9aa0ad', gray: '#9aa0ad', brown: '#8a5a33',
  alb: '#ffffff', negru: '#000000', rosu: '#ff3b4a', galben: '#ffd23f', verde: '#2bd17e', albastru: '#3f7bff', mov: '#8d5cff', roz: '#ff6fb5' };
const AIB_VERBS = 'add|put|insert|place|make|turn|cut|trim|remove|delete|erase|get rid of|split|speed|slow|mute|unmute|silence|change|set|give|apply|use|zoom|rotate|flip|mirror|move|shift|duplicate|copy|bleep|caption|subtitle|export|render|save|fade|color|colour|grade|crop|blur|freeze|undo|redo|play|pause|stop|lower|raise|increase|decrease|boost|reduce|normalize|normalise|balance|center|centre|resize|scale|shrink|enlarge|write|type|say|read|narrate|replace|swap|close|fill|fit|stretch|loop|detach|separate|unlink|select|go|jump|open|show|hide|clean|enhance|fix|level|shorten|lengthen|extend|darken|brighten|sharpen|warm|cool|adauga|pune|taie|sterge|fa|schimba';
function aibNorm(raw) {
  let t = ' ' + String(raw || '').toLowerCase().replace(/[’`]/g, "'").replace(/[“”«»]/g, '"') + ' ';
  t = t.replace(/\b(please|pls|plz|kindly|can you|could you|would you|will you|i want you to|i'd like you to|i would like you to|i want to|i'd like to|i need you to|i need to|help me|for me|thanks|thank you|te rog|poti sa|vreau sa)\b/g, ' ');
  t = t.replace(/\b(a couple of|a couple)\b/g, '2').replace(/\ba few\b/g, '3');
  t = t.replace(/\b(\d+) and a half\b/g, (_, n) => String(+n + 0.5));
  for (const [w, n] of Object.entries(AIB_NUM)) if (!['a', 'an'].includes(w)) t = t.replace(new RegExp('\\b' + w + '\\b', 'g'), String(n));
  t = t.replace(/\b(\d+) (\d)\b(?= ?(?:s|sec|second))/g, (_, a, b) => String(+a + +b)); // "twenty 5 seconds" -> 25
  return t.replace(/\s+/g, ' ');
}
// pull "quoted text" out first so splitting never cuts through it
function aibProtect(raw) {
  const quotes = [];
  const text = String(raw || '').replace(/["“”«»]([^"“”«»]{1,400})["“”«»]|(?:^|\s)'([^']{2,200})'(?=\s|[.,!?]|$)/g, (m, a, b) => { quotes.push(a || b); return ` §${quotes.length - 1}§ `; });
  return { text, quotes };
}
function aibSplit(norm) {
  const parts = norm.split(new RegExp(`(?:[.;!?]\\s+|\\n+|,?\\s+(?:and then|then|after that|afterwards|also|plus|apoi|dupa aceea)\\s+|,\\s*(?=(?:${AIB_VERBS})\\b)|\\s+and\\s+(?=(?:${AIB_VERBS})\\b)|\\s+si\\s+(?=(?:${AIB_VERBS})\\b))`));
  return parts.map((p) => p.trim()).filter((p) => p.length > 1);
}

/* ============================ time ============================ */
const AIB_TIME = '(\\d+:\\d{1,2}(?:\\.\\d+)?|\\d+\\s*(?:m|min|mins|minutes?)\\s*\\d+\\s*(?:s|sec|secs|seconds?)?|\\d+(?:[.,]\\d+)?\\s*(?:ms|milliseconds?|s|sec|secs|seconds?|secunde|secunda|m|min|mins|minutes?|minute|h|hours?)?)';
function aibSec(s) {
  if (s == null) return null;
  s = String(s).trim().toLowerCase();
  let m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(s); if (m) return +m[1] * 60 + +m[2];
  m = /^(\d+)\s*(?:m|min|mins|minutes?)\s*(\d+)\s*(?:s|sec|secs|seconds?)?$/.exec(s); if (m) return +m[1] * 60 + +m[2];
  m = /^(\d+(?:[.,]\d+)?)\s*(ms|milliseconds?)$/.exec(s); if (m) return parseFloat(m[1].replace(',', '.')) / 1000;
  m = /^(\d+(?:[.,]\d+)?)\s*(m|min|mins|minutes?|minute)$/.exec(s); if (m) return parseFloat(m[1].replace(',', '.')) * 60;
  m = /^(\d+(?:[.,]\d+)?)\s*(h|hours?)$/.exec(s); if (m) return parseFloat(m[1].replace(',', '.')) * 3600;
  m = /^(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|seconds?|secunde|secunda)?$/.exec(s); if (m) return parseFloat(m[1].replace(',', '.'));
  return null;
}
function aibAt(cl) {
  if (/\b(at|from) the (very )?(start|beginning)\b|\bat 0(?![:.,\d])|\bla inceput\b|\b(intro|opening)\b/.test(cl) && !/\bend\b/.test(cl)) return 0;
  if (/\b(at|to|by) the (very )?end\b|\bat the finish\b|\bla final\b|\boutro\b|\bending\b/.test(cl)) return 'end';
  if (/\b(here|at the playhead|right now|where i am|where the playhead is|at the current (time|spot|position))\b/.test(cl)) return state.time;
  const m = new RegExp('\\b(?:at|@|on|la|after|around)\\s+(?:second\\s+|minute\\s+)?' + AIB_TIME + '(?!\\s*%)').exec(cl);
  if (m) { const v = aibSec(m[1]); if (v != null && !/\bx\b/.test(m[1])) return /\bminute\s+/.test(m[0]) && /^\d+$/.test(m[1]) ? v * 60 : v; }
  return null;
}
function aibRange(cl) {
  let m = new RegExp('\\b(?:from|between|de la)\\s+' + AIB_TIME + '\\s*(?:to|and|until|till|-|–|pana la)\\s*' + AIB_TIME).exec(cl);
  if (m) { const a = aibSec(m[1]), b = aibSec(m[2]); if (a != null && b != null && b > a) return [a, b]; }
  m = new RegExp('\\b(first|last|primele|ultimele)\\s+' + AIB_TIME).exec(cl);
  if (m) { const n = aibSec(m[2]); if (n) return /first|primele/.test(m[1]) ? [0, n, 'first'] : ['end-' + n, 'end', 'last']; }
  return null;
}
function aibDuration(cl) {
  const m = new RegExp('\\b(?:for|lasting|last|long|durata)\\s+' + AIB_TIME + '(?!\\s*%)').exec(cl) || new RegExp(AIB_TIME + '\\s+long\\b').exec(cl);
  return m ? aibSec(m[1]) : null;
}
function aibAllTimes(cl) {
  const out = [];
  const re = new RegExp('\\b(?:at|and|,)\\s*' + AIB_TIME, 'g');
  let m; while ((m = re.exec(cl))) { const v = aibSec(m[1]); if (v != null) out.push(v); }
  return out;
}

const aibFmt = (t) => { t = Math.max(0, +t || 0); const m = Math.floor(t / 60), sec = t - m * 60; return m + ':' + (sec < 10 ? '0' : '') + (Math.abs(sec - Math.round(sec)) < 0.05 ? Math.round(sec) : sec.toFixed(1)); };

/* ============================ which clips ============================ */
const aibVisuals = () => P.clips.filter((c) => (c.kind === 'video' || c.kind === 'image') && !c.caption).sort((a, b) => a.start - b.start);
const aibMainTrackId = () => { const v = aibVisuals(); const cnt = new Map(); for (const c of v) cnt.set(c.trackId, (cnt.get(c.trackId) || 0) + dur(c)); return [...cnt].sort((a, b) => b[1] - a[1])[0]?.[0] || null; };
const aibIsMusic = (c) => c.kind === 'audio' && !c.linkId && (clipRole(c) === 'music' || /music/i.test((getTrack(c.trackId) || {}).name || '') || !!(getMedia(c.mediaId) || {}).credit);
const aibIsSfx = (c) => c.kind === 'audio' && ((getMedia(c.mediaId) || {}).tag === 'sfx' || clipRole(c) === 'sfx');
const aibIsVoice = (c) => c.kind === 'audio' && clipRole(c) === 'voice';
function aibKindWord(cl) {
  if (/\b(music|song|songs|soundtrack|background music|beat|muzica|melodia)\b/.test(cl)) return 'music';
  if (/\b(voice ?over|voice|narration|recording|voce|talking|speech)\b/.test(cl) && !/\b(text to speech|tts|female|male|with (ava|mia|zoe|lily|nora|max|jack|leo|sam|grant))\b/.test(cl)) return 'voice';
  if (/\b(sound effects?|sfx|effects? sounds?)\b/.test(cl)) return 'sfx';
  if (/\b(captions?|subtitles?|subtitrari)\b/.test(cl)) return 'captions';
  if (/\b(texts?|titles?|words|text clips?|heading|lower third)\b/.test(cl)) return 'text';
  if (/\b(photos?|images?|pictures?|pics?|poze|imagini)\b/.test(cl)) return 'image';
  if (/\b(original (sound|audio)|video'?s? (sound|audio)|game sound|clip sound|sound of the video)\b/.test(cl)) return 'videosound';
  if (/\b(audio|sound|sounds|volume)\b/.test(cl)) return 'audio';
  if (/\b(videos?|clips?|footage|shots?|scenes?|filmari)\b/.test(cl)) return 'video';
  return null;
}
function aibPool(kind) {
  switch (kind) {
    case 'music': { const m = P.clips.filter(aibIsMusic); return m.length ? m : P.clips.filter((c) => c.kind === 'audio' && !c.linkId && !aibIsVoice(c) && !aibIsSfx(c)); }
    case 'voice': { const v = P.clips.filter(aibIsVoice); if (v.length) return v; const sel = getClip(state.selectedId); if (sel && soundSource(sel)) return [sel]; const vid = aibVisuals().filter((c) => c.kind === 'video'); return vid.length ? [vid[0]] : []; }
    case 'sfx': return P.clips.filter(aibIsSfx);
    case 'captions': return P.clips.filter((c) => c.caption);
    case 'text': return P.clips.filter((c) => c.kind === 'text' && !c.caption);
    case 'image': return P.clips.filter((c) => c.kind === 'image');
    case 'videosound': return P.clips.filter((c) => c.kind === 'video' || (c.kind === 'audio' && c.linkId && partners(c).some((p) => p.kind === 'video')));
    case 'audio': return P.clips.filter((c) => c.kind === 'audio' || (c.kind === 'video' && hasAudio(c) && !partners(c).length));
    case 'video': return aibVisuals();
    default: return aibVisuals();
  }
}
// returns { clips, all, explicit }
function aibTargets(cl, fallbackKind) {
  const sel = getClip(state.selectedId);
  const kind = aibKindWord(cl);
  const pool = aibPool(kind || fallbackKind).slice().sort((a, b) => a.start - b.start);
  // a file name: "intro.mp4", "the beach clip"
  for (const m of P.media) {
    const base = String(m.name || '').toLowerCase().replace(/\.[a-z0-9]+$/, '');
    if (base.length >= 3 && (cl.includes(base) || cl.includes(String(m.name).toLowerCase()))) {
      const list = P.clips.filter((c) => c.mediaId === m.id && (!kind || pool.includes(c)));
      if (list.length) return { clips: list, all: false, explicit: true, kind };
    }
  }
  if (/\b(all|every|each|whole|entire|everything|both|toate|tot)\b/.test(cl) && (kind || /\b(clips?|everything|whole video|entire video|the video)\b/.test(cl))) return { clips: pool, all: true, explicit: true, kind };
  const ord = /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|sixth|6th|last|final|next to last|second to last|penultimate)\b(?:\s+\w+)?\s+(clip|video|photo|image|picture|text|title|caption|sound|song|music|scene|shot|one)\b/.exec(cl)
    || /\b(clip|video|scene|shot|photo|image|text|title)\s*(?:number\s*)?#?(\d+)\b/.exec(cl);
  if (ord) {
    let k = ord[1];
    const idx = /^\d+$/.test(ord[2]) ? +ord[2] - 1 : { first: 0, '1st': 0, second: 1, '2nd': 1, third: 2, '3rd': 2, fourth: 3, '4th': 3, fifth: 4, '5th': 4, sixth: 5, '6th': 5 }[k];
    const kp = /photo|image|picture/.test(ord[2] || ord[1]) ? aibPool('image') : /text|title/.test(ord[2] || ord[1]) ? aibPool('text') : /caption/.test(ord[2] || '') ? aibPool('captions') : /song|music/.test(ord[2] || '') ? aibPool('music') : /sound/.test(ord[2] || '') ? aibPool('audio') : pool;
    const list = kp.slice().sort((a, b) => a.start - b.start);
    let c = null;
    if (/last|final/.test(k) && !/next to|second to/.test(k)) c = list[list.length - 1];
    else if (/next to last|second to last|penultimate/.test(k)) c = list[list.length - 2];
    else if (idx != null) c = list[idx];
    if (c) return { clips: [c], all: false, explicit: true, kind };
  }
  // the clip under a time: "the clip at 0:12"
  const at = new RegExp('\\b(?:clip|video|one|scene|part)\\s+(?:at|around)\\s+' + AIB_TIME).exec(cl);
  if (at) { const t = aibSec(at[1]); const c = pool.find((x) => t >= x.start && t < endOf(x)); if (c) return { clips: [c], all: false, explicit: true, kind }; }
  if (kind && kind !== 'video') {
    if (sel && pool.includes(sel)) return { clips: [sel], all: false, explicit: true, kind };
    return { clips: pool, all: pool.length > 1, explicit: true, kind };
  }
  if (sel && (/\b(this|selected|current|it|that)\b/.test(cl) || !kind)) {
    if (!fallbackKind || pool.includes(sel) || fallbackKind === 'any') return { clips: [sel], all: false, explicit: false, kind };
  }
  if (kind === 'video' && /\b(the video|my video|the clip|my clip)\b/.test(cl) && pool.length > 1 && !sel) return { clips: pool, all: true, explicit: false, kind };
  return { clips: pool.length === 1 || !pool.length ? pool : [sel && pool.includes(sel) ? sel : pool[0]], all: false, explicit: false, kind, guessed: pool.length > 1 };
}
const aibLabel = (c) => (c ? clipLabel(c) : 'the clip');

/* ============================ catalogues ============================ */
function aibFind(list, cl, keyFn) {
  // longest name that appears in the request wins
  let best = null, bl = 0;
  for (const x of list) for (const k of keyFn(x)) { const kk = String(k).toLowerCase(); if (kk.length >= 3 && kk.length > bl && new RegExp('(^|[^a-z0-9])' + kk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(cl)) { best = x; bl = kk.length; } }
  return best;
}
const AIB_LOOK_ALIASES = { 'black and white': 'bw', 'black & white': 'bw', 'b&w': 'bw', grayscale: 'bw', greyscale: 'bw', monochrome: 'bw', 'old movie': 'vintage', retro: 'vintage', cinematic: 'cinema', movie: 'cinema', film: 'cinema', 'teal orange': 'tealorange', vaporwave: 'vapor', 'neon': 'neonnight', 'night': 'nightcity', 'colorful': 'vivid', 'colourful': 'vivid', saturated: 'vivid', 'vibrant': 'vivid', 'golden': 'golden', 'sepia': 'sepia', 'cold': 'cool', 'icy': 'arctic', 'summer': 'sunset', 'sad': 'moody', 'dark': 'lowkey', 'bright': 'cleanbright', 'dreamy': 'dreamy', 'alb negru': 'bw', 'alb-negru': 'bw' };
function aibLook(cl) {
  for (const [k, v] of Object.entries(AIB_LOOK_ALIASES)) if (new RegExp('\\b' + k.replace(/[&]/g, '\\&') + '\\b').test(cl) && FILTERS.some((f) => f.id === v)) return v;
  const f = aibFind(FILTERS.slice(1), cl, (x) => [x.name, x.id]);
  return f ? f.id : null;
}
const AIB_AFX_ALIASES = { 'chipmunk': ['pitch', { semi: 8 }], 'helium': ['pitch', { semi: 9 }], 'higher voice': ['pitch', { semi: 4 }], 'high pitch': ['pitch', { semi: 6 }], 'deep voice': ['pitch', { semi: -5 }], 'deeper': ['pitch', { semi: -5 }], 'low pitch': ['pitch', { semi: -6 }], 'demon': ['pitch', { semi: -10 }], 'darth vader': ['monster'], 'ear ?rape': ['loud'], 'earrape': ['loud'], 'insanely loud': ['loud'], 'super loud': ['loud'], 'really loud': ['loud'], 'distorted': ['distort'], 'distortion': ['distort'], 'crunchy': ['distort'], '8[ -]?bit': ['crush'], 'bitcrush': ['crush'], 'retro game': ['crush'], 'glitch': ['glitch'], 'glitchy': ['glitch'], 'robot': ['robot'], 'robotic': ['robot'], 'telephone': ['phone'], 'phone call': ['phone'], 'on the phone': ['phone'], 'walkie': ['radio'], 'radio': ['radio'], 'megaphone': ['megaphone'], 'announcer': ['megaphone'], 'underwater': ['underwater'], 'under water': ['underwater'], 'far away': ['faraway'], 'other room': ['faraway'], 'next room': ['faraway'], 'chorus': ['chorus'], 'flanger': ['flanger'], 'phaser': ['phaser'], 'tremolo': ['tremolo'], 'wobble': ['vibrato'], 'vibrato': ['vibrato'], 'drunk': ['vibrato', { depth: 70 }], 'left to right': ['autopan'], 'auto ?pan': ['autopan'], '8d': ['autopan', { depth: 100, rate: 0.25 }], 'bass ?boost': ['bassboost'], 'more bass': ['bassboost'], 'lo-?fi': ['lofi'], 'vinyl': ['lofi'], 'echo': ['echo'], 'canyon': ['echo'], 'delay': ['delay'], 'reverb': ['reverb'], 'church': ['reverb'], 'hall': ['reverb'], 'stadium': ['stadium'], 'arena': ['stadium'], 'concert': ['stadium'], 'ping ?pong': ['pingpong'], 'overdrive': ['overdrive'], 'guitar amp': ['overdrive'], 'blown': ['blown'], 'broken speaker': ['blown'], 'stutter': ['stutter'], 'alien': ['alien'], 'monster': ['monster'], 'scary': ['monster'], 'ghost': ['ghost'], 'spooky': ['ghost'], 'rotating': ['rotary'], 'leslie': ['rotary'], 'wah': ['wah'], 'filter sweep': ['wah'], 'brighter sound': ['treble'], 'treble': ['treble'], 'muffled': ['muffled'], 'through a wall': ['muffled'], 'old radio': ['oldradio'], '1940s': ['oldradio'], 'podcast': ['voiceboost'], 'voice boost': ['voiceboost'], 'enhance (the )?voice': ['voiceboost'], 'better voice': ['voiceboost'], 'compress': ['compress'], 'even (out )?(the )?volume': ['compress'], 'clearer': ['clarity'], 'clarity': ['clarity'], 'noise reduction': ['nr'], 'remove (the )?(background )?noise': ['nr'], 'denoise': ['nr'], 'hum': ['nr', { hum: '50' }], 'de-?ess': ['deess'], 'limiter': ['limiter'], 'eq\\b': ['feq'], 'equali[sz]er': ['feq'] };
function aibAfx(cl) {
  let best = null, bl = 0;
  for (const [k, v] of Object.entries(AIB_AFX_ALIASES)) { const m = new RegExp('\\b' + k).exec(cl); if (m && m[0].length > bl && AFX_TYPES[v[0]]) { best = v; bl = m[0].length; } }
  if (best) return best;
  const t = aibFind(Object.entries(AFX_TYPES), cl, ([id, x]) => [x.name.replace(/\s*\(.*\)/, ''), id]);
  return t ? [t[0]] : null;
}
const AIB_FX_ALIASES = { 'rgb split': 'chroma', 'chromatic': 'chroma', 'cinema bars': 'letterbox', 'black bars': 'letterbox', 'letterbox': 'letterbox', 'widescreen bars': 'letterbox', 'rounded': 'rounded', 'border': 'border', 'frame around': 'border', 'pixelate': 'mosaic', 'pixelated': 'mosaic', 'censor': 'mosaic', 'mosaic': 'mosaic', 'blur effect': 'gaussian', 'glow': 'glow', 'shadow': 'shadow', 'invert': 'invert', 'negative': 'invert', 'scan ?lines': 'scanlines', 'vhs': 'vhs', 'camcorder': 'vhs', 'kaleidoscope': 'kaleido', 'sketch': 'sketch', 'drawing': 'sketch', 'comic': 'halftone', 'halftone': 'halftone', 'neon edges': 'edges', 'outline': 'edges', 'emboss': 'emboss', 'posteri[sz]e': 'posterize', 'tilt.?shift': 'tiltshift', 'miniature': 'tiltshift', 'light leak': 'lightleak', 'dream glow': 'dreamglow', 'duotone': 'duotone', 'cctv': 'cctv', 'security camera': 'cctv', 'sharpen': 'sharpen', 'sharper': 'sharpen', 'zoom blur': 'zoom', 'radial blur': 'radial', 'motion blur': 'directional', 'lens blur': 'lens', 'zoom pulse': 'pulse', 'pulse': 'pulse', 'camera shake': 'shake', 'glitch effect': 'glitch', 'glitch': 'glitch', 'mirror effect': 'mirror', 'paper': 'paper', 'threshold': 'threshold' };
function aibVisFx(cl) {
  let best = null, bl = 0;
  for (const [k, v] of Object.entries(AIB_FX_ALIASES)) { const m = new RegExp('\\b' + k).exec(cl); if (m && m[0].length > bl && EFFECT_TYPES[v]) { best = v; bl = m[0].length; } }
  return best;
}
function aibTransition(cl) {
  const alias = { crossfade: 'fade', 'cross fade': 'fade', dissolve: 'fade', 'fade to black': 'black', 'dip to black': 'black', 'flash': 'white', 'white flash': 'white', 'whip': 'whip', 'swipe': 'slide', 'zoom punch': 'zoomPunch', 'punch': 'zoomPunch', 'glitch': 'glitch', 'spin': 'spin', 'zoom': 'zoom' };
  const t = aibFind(TRANSITIONS.slice(1), cl, (x) => [x.name, x.id]);
  if (t) return t.id;
  for (const [k, v] of Object.entries(alias)) if (new RegExp('\\b' + k + '\\b').test(cl)) return v;
  return null;
}
function aibSfx(cl) {
  const alias = { 'vine boom': 'boom', 'bruh': 'boom', 'woosh': 'whoosh', 'swish': 'swoosh-fast', 'swoosh': 'swoosh-fast', 'explosion': 'cinematic-hit', 'impact': 'cinematic-hit', 'hit': 'punch', 'punch': 'punch', 'pop': 'pop', 'click': 'click', 'ding': 'ding', 'bell': 'bell', 'notification': 'notify', 'coin': 'coin', 'level up': 'level-up', 'success': 'success', 'fail': 'error', 'error': 'error', 'wrong': 'error', 'camera': 'shutter', 'shutter': 'shutter', 'typing': 'typing', 'keyboard': 'typing', 'boing': 'boing', 'sad trombone': 'wah-wah', 'wah wah': 'wah-wah', 'drumroll': 'drumroll', 'drum roll': 'drumroll', 'rimshot': 'rimshot', 'ba dum tss': 'rimshot', 'record scratch': 'scratch', 'scratch': 'scratch', 'zip': 'cartoon-zip', 'heartbeat': 'heartbeat', 'dramatic': 'drama-boom', 'dun dun': 'drama-boom', 'static': 'static', 'laser': 'laser', 'power down': 'power-down', 'power up': 'power-up', 'beep': 'beep', 'sparkle': 'sparkle', 'magic': 'sparkle', 'wind': 'wind', 'rain': 'rain', 'clock': 'clock', 'ticking': 'clock', 'applause': 'applause', 'clapping': 'applause', 'riser': 'riser', 'bass drop': 'bass-drop', 'drop': 'bass-drop', 'tape stop': 'tape-stop', 'whoosh': 'whoosh', 'thud': 'thud', 'glass': 'glass-tap', 'bubble': 'bubble' };
  let best = null, bl = 0;
  for (const [k, v] of Object.entries(alias)) { const m = new RegExp('\\b' + k + '\\b').exec(cl); if (m && m[0].length > bl && sfxById(v)) { best = v; bl = m[0].length; } }
  if (best) return best;
  const s = aibFind(SFX, cl, (x) => [x.name, x.id.replace(/-/g, ' ')]);
  return s ? s.id : null;
}
function aibCapStyle(cl) {
  const alias = { 'word by word': 'pop', 'one word': 'pop', 'highlight': 'karaoke', 'tiktok': 'viral', 'mrbeast': 'viral', 'youtube': 'viral', 'yellow': 'yellowpop', 'movie': 'cinema', 'cinematic': 'cinema', 'simple': 'minimal', 'small': 'minimal', 'box': 'box', 'white box': 'sticker', 'red': 'alert', 'news': 'alert', 'game': 'gaming', 'gamer': 'gaming' };
  const st = aibFind(CAPTION_STYLES, cl, (x) => [x.name, x.id]);
  if (st) return st.id;
  for (const [k, v] of Object.entries(alias)) if (new RegExp('\\b' + k + '\\b').test(cl)) return v;
  return null;
}
function aibVoice(cl) {
  if (typeof TTS_VOICES === 'undefined') return null;
  const byName = TTS_VOICES.find((v) => new RegExp('\\b' + v.name.toLowerCase() + '\\b').test(cl));
  if (byName) return byName.id;
  if (/\b(deep|narrator|movie trailer|epic voice)\b/.test(cl)) return 342;
  if (/\b(female|woman|girl|lady|her)\b/.test(cl)) return 681;
  if (/\b(male|man|guy|boy|dude|his)\b/.test(cl)) return 204;
  return null;
}
function aibColor(cl) {
  const hex = /#([0-9a-f]{6}|[0-9a-f]{3})\b/.exec(cl);
  if (hex) return '#' + hex[1];
  for (const [k, v] of Object.entries(AIB_COLORS)) if (new RegExp('\\b' + k + '\\b').test(cl)) return v;
  return null;
}
function aibPct(cl) { const m = /(-?\d+(?:[.,]\d+)?)\s*(%|percent|procent)/.exec(cl); return m ? parseFloat(m[1].replace(',', '.')) : null; }
function aibDb(cl) { const m = /([+-]?\d+(?:[.,]\d+)?)\s*(db|decibels?)\b/.exec(cl); return m ? parseFloat(m[1].replace(',', '.')) : null; }

/* ============================ how-to answers ============================ */
const AIB_HELP = [
  [/split|cut (a|the) clip|cut in half/, 'Move the playhead to the spot and press S (or right-click the clip → Split here). Or just tell me: “split at 0:12”.'],
  [/transition/, 'Open the Transitions tab and drag one onto the cut between two clips, or click a clip and then a transition. Hover a transition to preview it. Or tell me: “add crossfades between all clips”.'],
  [/caption|subtitle/, 'Right-click a clip with speech → Smart → Auto captions, pick a style and press Generate. Or tell me: “add captions in the Fire style”.'],
  [/text to speech|tts|voice ?over|narrat|ai voice|read (it|text)/, 'Go to the Voice tab → Text to speech, type your text, pick a voice and press “Add voice at the playhead”. Or tell me: “say ‘Welcome back’ with Max”.'],
  [/record|microphone|mic\b/, 'Open the Voice tab, pick your microphone and press the red button. Your take lands on a free sound track.'],
  [/music|song/, 'Open the Music tab: free music you can use on YouTube and TikTok. Drag a song onto the timeline. Or tell me: “add calm background music”.'],
  [/sound effect|sfx/, 'Music tab → Sound FX has whooshes, booms, pops and more. Or tell me: “add a whoosh at every cut”.'],
  [/audio (effect|fx)|robot|chipmunk|echo|distort/, 'The Audio FX tab has every sound effect (robot, chipmunk, echo, ultra loud…). Click one with a clip selected or drag it onto a clip.'],
  [/keyframe|animate|animation/, 'Select a clip, move the playhead and click the ◆ keyframe button in Clip tools → Animate, change size/position, move the playhead and change it again. The Curves button opens the graph editor.'],
  [/speed|slow ?mo|fast/, 'Select the clip → Clip tools → Edit → Speed, or tell me: “make it 2x faster”.'],
  [/zoom/, 'For a smooth zoom tell me “zoom in at 0:05”, or add two keyframes with different sizes. For a slow constant zoom use “slow zoom in”.'],
  [/green ?screen|chroma|remove (the )?background/, 'Select the clip → inspector → Green screen (Premium). It removes green or blue backgrounds.'],
  [/export|save (the|my) video|render/, 'Press Export (top right), pick the resolution and quality and press Export. Best quality keeps every frame, with no watermark.'],
  [/vertical|tiktok|shorts|reels|9:16|aspect|square/, 'Click the shape menu at the top (16:9 · YouTube) and pick 9:16 for TikTok/Shorts. Or tell me: “make it vertical”.'],
  [/bleep|swear|curse/, 'Right-click a clip → Smart → Bleep swear words (Premium). You can pick the sound, even an anvil or a duck.'],
  [/silence|pause|dead air/, 'Right-click a clip → Smart → Remove silences (Premium), or tell me “remove the silences”.'],
  [/filter|look|color grade|colour/, 'The Filters tab has looks you can click or drag onto a clip. Hover one to preview. Or tell me: “make it warmer” / “cinematic look”.'],
  [/undo|mistake/, 'Press Ctrl+Z to undo and Ctrl+Y to redo. Time machine (clock icon at the top) can bring back any earlier version.'],
  [/volume|louder|quieter|db/, 'Drag the line on a sound clip up or down, or select it and use Volume in the inspector (up to +40 dB). Or tell me “music 10 dB quieter”.'],
  [/fusion|node/, 'The Fusion page (next to Edit, above the timeline) lets you build effects with nodes, like DaVinci Resolve.'],
  [/mask/, 'Select a video → inspector → Mask to show only part of the picture (circle, rectangle…).'],
  [/compound/, 'Select several clips (Ctrl+click) and press Alt+C to turn them into one compound clip.'],
  [/folder/, 'In the Media tab use the folder button to make folders, and drag files into them.'],
  [/freeze/, 'Put the playhead on the frame and use Clip tools → Edit → Freeze (holds that frame for 2 seconds).'],
  [/premium|price|pay/, 'Premium is coming soon. Most of Flux is free with no watermark.'],
  [/shortcut|keyboard|hotkey/, 'Settings → Keyboard shows every shortcut, and you can change them. Space plays, S splits, Del deletes, Ctrl+Z undoes.'],
  [/track/, 'Right-click a track name to rename or remove it. New tracks are added automatically when you drop clips above or below.']
];
function aibHelp(cl) {
  for (const [re, ans] of AIB_HELP) if (re.test(cl)) return ans;
  return null;
}
const AIB_SUGGEST = ['cut the first 3 seconds', 'add a title “My Trip” at the start', 'crossfades between all clips', 'add calm music', 'add captions in the Fire style', 'say “Welcome back” with Max', 'make it vertical', 'speed 2x', 'warm look', 'zoom in at 0:05', 'add a whoosh at every cut', 'make the music 10 dB quieter', 'robot voice on the voiceover', 'remove silences'];

/* ============================ the planner ============================ */
function aibPlan(raw) {
  const { text, quotes } = aibProtect(raw);
  const Q = (s) => String(s).replace(/§(\d+)§/g, (_, i) => quotes[+i] || '');
  const norm = aibNorm(text);
  const clauses = aibSplit(norm);
  const actions = [], said = [], notes = [];
  let lastTargets = null, lastQuote = null;
  const qOf = (cl) => { const m = /§(\d+)§/.exec(cl); return m ? quotes[+m[1]] : null; };
  // "how do I ..." / "what can you do"
  const rawLow = ' ' + String(raw).toLowerCase().trim();
  if (/^\s*(how|where|what|why|can (i|flux|you)|does|is there|do you|cum|unde|ce)\b/.test(rawLow) && !/\b(add|cut|make|put|remove|delete)\b.*\b(for me|now)\b/.test(norm)) {
    if (/what can you do|what do you do|^\s*help\b|what can i (say|ask)|what are you/.test(rawLow)) return { reply: 'I can do almost any edit for you. Try: ' + AIB_SUGGEST.slice(0, 8).map((s) => '“' + s + '”').join(', ') + '. You can also chain steps with “and” / “then”.', actions: [] };
    const h = aibHelp(norm);
    if (h) return { reply: h, actions: [] };
  }
  for (let cl of clauses) {
    cl = ' ' + cl + ' ';
    const quote = qOf(cl);
    const rawCl = Q(cl);
    const n0 = actions.length;
    const T = (kind) => { const r = aibTargets(cl.replace(/§\d+§/g, ' '), kind); if (!r.explicit && /\b(it|them|that|those)\b/.test(cl) && lastTargets) return lastTargets; lastTargets = r; return r; };
    const ids = (r) => r.clips.map((c) => c.id);
    const push = (a, s) => { actions.push(a); if (s) said.push(s); };
    const neg = /\b(don't|do not|dont|no|without|stop|nu)\b/.test(cl);
    const at = aibAt(cl), range = aibRange(cl);

    // ---- undo / redo / play ----
    if (/^\s*(undo|go back|revert)\b/.test(cl)) { push({ type: 'undo', times: (/(\d+)\s*(times|steps)/.exec(cl) || [])[1] || 1 }, 'undo'); continue; }
    if (/^\s*redo\b/.test(cl)) { push({ type: 'redo' }, 'redo'); continue; }
    if (/^\s*(play|preview|watch)\b/.test(cl)) { push({ type: 'play', time: at === 'end' ? null : at }, 'play it'); continue; }
    if (/^\s*(pause|stop playing)\b/.test(cl)) { push({ type: 'pause' }); continue; }
    if (/\b(export|render|save (the )?video|download (the )?video)\b/.test(cl) && !/how/.test(cl)) { push({ type: 'export' }, 'open Export'); continue; }

    // ---- text to speech ----
    if (/\b(text to speech|tts|ai voice|voice ?over|narrat\w*|read (it|this|that|the text|the title)?\s*(out loud|aloud)?|say|speak|zi|spune)\b|\b(voice|narrator)\s+(saying|that says)\b/.test(cl) && (quote || /\b(read|text to speech|tts)\b/.test(cl)) && !/\b(record|mic)\b/.test(cl) && !(/\b(title|text|heading|headline|caption text|lower third|label)\b/.test(cl) && !/\b(read|say|speak|voice|narrat|tts|text to speech)\b/.test(cl.replace(/\bsaying\b/, '')))) {
      const sel = getClip(state.selectedId);
      const tclip = sel && sel.kind === 'text' ? sel : (P.clips.filter((c) => c.kind === 'text' && !c.caption).sort((a, b) => Math.abs(a.start - state.time) - Math.abs(b.start - state.time))[0] || null);
      const txt = quote || (/\b(read|this text|the text|that text|the title)\b/.test(cl) && tclip ? tclip.text.content : null);
      if (txt) {
        push({ type: 'tts', text: txt, voice: aibVoice(cl), time: at === 'end' ? 'end' : at != null ? at : (tclip && !quote ? tclip.start : null), captions: /\bcaption|subtit/.test(cl) ? true : /\bno captions|without captions\b/.test(cl) ? false : undefined }, 'read “' + txt.slice(0, 30) + (txt.length > 30 ? '…' : '') + '” out loud');
        continue;
      }
    }

    // ---- captions ----
    if (/\b(captions?|subtitles?|subtitrari|subtitrare)\b/.test(cl) && !/\b(title|heading)\b.*§/.test(cl)) {
      const st = aibCapStyle(cl);
      if (/\b(remove|delete|get rid|clear|sterge)\b/.test(cl)) { push({ type: 'deleteClips', kind: 'captions' }, 'remove the captions'); continue; }
      const have = P.clips.some((c) => c.caption);
      const restyle = have && (/\b(change|make|style|restyle|switch|turn|bigger|smaller|larger|top|bottom|middle|upper ?case|color|colour|yellow|red|font)\b/.test(cl) || (st && !/\badd|generate|create|auto\b/.test(cl)));
      if (restyle) {
        const ch = {};
        if (st) ch.style = st;
        if (/\b(bigger|larger|huge|big)\b/.test(cl)) ch.sizeMul = 1.25; if (/\b(smaller|tiny|small)\b/.test(cl)) ch.sizeMul = 0.8;
        if (/\btop\b/.test(cl)) ch.pos = 0.15; else if (/\b(middle|center|centre)\b/.test(cl)) ch.pos = 0.5; else if (/\bbottom\b/.test(cl)) ch.pos = 0.82;
        if (/\bupper ?case|all caps|capital\b/.test(cl)) ch.upper = true; if (/\blower ?case|normal case\b/.test(cl)) ch.upper = false;
        const col = aibColor(cl); if (col && /\b(color|colour|yellow|red|white|green|blue|pink|purple|orange)\b/.test(cl)) ch.color = col;
        push({ type: 'captionsStyle', ...ch }, 'restyle the captions'); continue;
      }
      const r = T('audio');
      push({ type: 'captions', clipId: r.clips[0] && r.explicit ? r.clips[0].id : undefined, style: st || undefined }, 'add auto captions' + (st ? ' (' + (CAPTION_STYLES.find((x) => x.id === st) || {}).name + ')' : ''));
      continue;
    }

    // ---- bleep / silences / balance ----
    if (/\b(bleep|beep out|censor (the )?(swear|curse|bad)|swear words?|cuss|curse words?|injur)/.test(cl)) {
      const level = /\b(strict|all|every|high|kid|family)\b/.test(cl) ? 'high' : /\b(slur|low|only the worst)\b/.test(cl) ? 'low' : 'moderate';
      const snd = (typeof BLEEP_SOUNDS !== 'undefined') && aibFind(BLEEP_SOUNDS, cl, (x) => [x.name, x.id.replace('sfx:', '')]);
      push({ type: 'bleep', level, sound: snd ? snd.id : undefined }, 'bleep the swear words' + (snd ? ' with ' + snd.name.toLowerCase() : '')); continue;
    }
    if (/\b(silen\w*|pauses|dead air|quiet parts|awkward pauses|umm?s?|pauzele|liniste)\b/.test(cl) && /\b(remove|cut|delete|trim|get rid|sterge|taie)\b/.test(cl)) { const r = T('audio'); push({ type: 'removeSilences', clipId: r.clips[0] && r.explicit ? r.clips[0].id : undefined }, 'remove the silences'); continue; }
    if (/\b(balance|normali[sz]e|even out|level (the|all)|same volume)\b/.test(cl)) { if (/\b(this|clip|selected)\b/.test(cl) && getClip(state.selectedId)) push({ type: 'normalize', clipId: state.selectedId }, 'normalize the volume'); else push({ type: 'autoBalance' }, 'balance the sound'); continue; }
    if (/\bduck|lower the music (under|when)|music quieter (under|when)/.test(cl)) { push({ type: 'duck', on: !neg }, neg ? 'stop ducking the music' : 'make the music duck under speech'); continue; }

    // ---- shape ----
    if (/\b(vertical|tiktok|reels?|shorts|9:16|portrait|phone format)\b/.test(cl) && !/\b(caption|music|sound)\b/.test(cl)) { push({ type: 'aspect', aspect: '9:16' }, 'make it vertical'); if (/\bfill|crop|full ?screen\b/.test(cl)) push({ type: 'fit', clipId: 'all', fit: 'cover' }); continue; }
    if (/\b(square|1:1|instagram)\b/.test(cl) && !/\bcorner/.test(cl)) { push({ type: 'aspect', aspect: /4:5|post/.test(cl) ? '4:5' : '1:1' }, 'make it square'); continue; }
    if (/\b(4:5)\b/.test(cl)) { push({ type: 'aspect', aspect: '4:5' }, 'make it 4:5'); continue; }
    if (/\b(horizontal|landscape|16:9|widescreen|youtube format)\b/.test(cl)) { push({ type: 'aspect', aspect: '16:9' }, 'make it 16:9'); continue; }

    // ---- music ----
    if (/\b(music|song|soundtrack|beat|muzica|melodie)\b/.test(cl) && /\b(add|put|play|need|want|some|background|insert|adauga|pune|give)\b/.test(cl) && !/\b(remove|delete|mute|quieter|louder|volume|fade|loop|duck)\b/.test(cl) && !(aibAfx(cl) && !/\b(add|insert|put|play)\s+(some\s+|a\s+)?(\w+\s+)?(music|song|soundtrack)\b/.test(cl))) {
      const moods = { happy: 'happy', upbeat: 'happy', fun: 'funny', funny: 'funny', calm: 'calm', chill: 'relaxed', relaxing: 'relaxed', relaxed: 'relaxed', lofi: 'relaxed', sad: 'calm', emotional: 'romantic', epic: 'epic', cinematic: 'epic', dramatic: 'epic', dark: 'dark', scary: 'dark', horror: 'dark', action: 'action', energetic: 'action', hype: 'action', gaming: 'action', romantic: 'romantic', love: 'romantic', mysterious: 'mysterious', suspense: 'mysterious', uplifting: 'uplifting', inspiring: 'uplifting', motivational: 'uplifting' };
      const mood = Object.keys(moods).find((m) => new RegExp('\\b' + m + '\\b').test(cl));
      push({ type: 'music', mood: mood ? moods[mood] : 'happy', start: typeof at === 'number' ? at : 0, quiet: /\bquiet|soft|low\b/.test(cl) }, 'add ' + (mood || 'happy') + ' background music'); continue;
    }
    if (/\bloop\b/.test(cl) && /\b(music|song|audio|sound)\b/.test(cl)) { const r = T('music'); if (r.clips.length) push({ type: 'loopAudio', clipId: r.clips[0].id }, 'loop the music to the end'); continue; }

    // ---- sound effects ----
    const shot = typeof BLEEP_SOUNDS !== 'undefined' && /\b(add|put|play|insert|place|use)\b/.test(cl) ? BLEEP_SOUNDS.find((b) => b.make && new RegExp('\\b' + b.name.toLowerCase().replace(/ clang$/, '') + '|\\b' + b.id + '\\b').test(cl)) : null;
    if (shot && !/\bbleep\b/.test(cl)) {
      const many = aibAllTimes(cl); const times = many.length > 1 ? many : [at === 'end' ? 'end' : at != null ? at : state.time];
      push({ type: 'shotSfx', id: shot.id, times }, 'add an ' + shot.name.toLowerCase() + ' sound'); continue;
    }
    const sfx = /\b(sound|sfx|effect|noise|sound effect)\b|\b(whoosh|woosh|swoosh|vine boom|boom|ding|pop|click|applause|drumroll|rimshot|laser|boing|bruh|record scratch|riser)\b/.test(cl) && /\b(add|put|play|insert|place|use|adauga|pune)\b/.test(cl) ? aibSfx(cl) : null;
    if (sfx && !/\b(audio effect|voice|robot|echo|reverb|distort)\b/.test(cl)) {
      let times;
      if (/\b(every|each|all the|at all|on all)\s+(cut|transition|clip|scene|change)s?\b|\bbetween (the |all )?clips\b/.test(cl)) times = aibVisuals().slice(1).map((c) => c.start).filter((t, i, a) => a.indexOf(t) === i);
      else { const many = aibAllTimes(cl); times = many.length > 1 ? many : [at === 'end' ? 'end' : at != null ? at : state.time]; }
      push({ type: 'sfx', sfx, times }, `add a ${sfxById(sfx).name.toLowerCase()} sound${times.length > 1 ? ' at ' + times.length + ' spots' : ''}`); continue;
    }

    // ---- audio effects (voice changers etc.) ----
    const afx = /\b(remove|clear|delete|no more)\b.*\b(audio effects?|sound effects? on|voice effects?)\b/.test(cl) ? 'CLEAR' : aibAfx(cl);
    if (afx && (/\b(voice|sound|audio|effect|make|sound like|add|put|apply|use|give|turn)\b/.test(cl)) && !/\b(text|title|transition|filter|look)\b/.test(cl)) {
      const r = T('audio');
      if (afx === 'CLEAR') { push({ type: 'removeAudioFx', clipIds: ids(r) }, 'remove the audio effects'); continue; }
      if (neg && /\b(remove|no|without|stop)\b/.test(cl)) { push({ type: 'removeAudioFx', clipIds: ids(r), fx: afx[0] }, 'remove ' + AFX_TYPES[afx[0]].name.toLowerCase()); continue; }
      const params = Object.assign({}, afx[1] || {});
      const pc = aibPct(cl); if (pc != null) { const t = AFX_TYPES[afx[0]]; const p0 = t.params && t.params.find((p) => /amount|depth|mix|drive|distance/.test(p[0])); if (p0) params[p0[0]] = clamp(pc, p0[2], p0[3]); }
      push({ type: 'audioFx', clipIds: ids(r), fx: afx[0], params }, 'put ' + AFX_TYPES[afx[0]].name.replace(/\s*\(.*\)/, '').toLowerCase() + ' on ' + (r.all ? 'all sound' : aibLabel(r.clips[0])));
      continue;
    }

    // ---- mute / volume ----
    if (/\b(unmute|turn (the )?(sound|audio|volume) (back )?on)\b/.test(cl)) { const r = T('audio'); push({ type: 'mute', clipIds: ids(r), muted: false }, 'unmute ' + (r.all ? 'everything' : aibLabel(r.clips[0]))); continue; }
    if (/\b(mute|silence|turn off the (sound|audio)|no sound|remove the (sound|audio)|without sound|fara sunet)\b/.test(cl) && !/\bsilences\b/.test(cl)) { const r = T(aibKindWord(cl) ? null : 'videosound'); push({ type: 'mute', clipIds: ids(r), muted: true }, 'mute ' + (r.all ? 'all ' + ({ videosound: 'video sound', sfx: 'sound effects' }[r.kind] || r.kind || 'clips') : aibLabel(r.clips[0]))); continue; }
    if ((/\b(volume|louder|quieter|softer|turn (it |the \w+ )?(up|down)|lower|boost|db|decibels?)\b/.test(cl) || (/\d+\s*%/.test(cl) && ['music', 'voice', 'audio', 'sfx', 'videosound'].includes(aibKindWord(cl)) && !/\b(speed|fast|slow|opacity|transparent|size|bigger|smaller|zoom)\b/.test(cl))) && /\b(volume|louder|quieter|softer|loud|quiet|sound|music|voice|audio|db|up|down|lower|boost)\b|\d+\s*%/.test(cl) && !/\b(bass|text|title|brightness|contrast|lower third|lower-third)\b/.test(cl)) {
      const r = T('audio');
      const db = aibDb(cl), pc = aibPct(cl);
      let a;
      if (db != null) a = /\b(quieter|lower|down|reduce|decrease|softer)\b/.test(cl) ? { delta: -Math.abs(db) } : /\b(louder|up|boost|raise|increase)\b/.test(cl) ? { delta: Math.abs(db) } : { db };
      else if (pc != null) a = { gain: clamp(pc / 100, 0, 100) };
      else if (/\b(much|way|a lot) (louder|up)\b/.test(cl)) a = { delta: 10 }; else if (/\b(louder|up|boost|raise|increase)\b/.test(cl)) a = { delta: 6 };
      else if (/\b(much|way|a lot) (quieter|lower|softer)\b/.test(cl)) a = { delta: -12 }; else if (/\b(quieter|lower|down|softer|reduce|decrease)\b/.test(cl)) a = { delta: -6 };
      if (a) { push({ type: 'volumeDb', clipIds: ids(r), ...a }, `set the volume ${a.db != null ? a.db + ' dB' : a.gain != null ? Math.round(a.gain * 100) + '%' : (a.delta > 0 ? '+' : '') + a.delta + ' dB'} on ${r.all ? 'all ' + (r.kind || 'sound') : aibLabel(r.clips[0])}`); continue; }
    }

    // ---- fades ----
    if (/\bfade(s|d)?\b/.test(cl) && !/\b(to black|between|transition|cross ?fade)\b/.test(cl)) {
      const r = T(aibKindWord(cl) ? null : 'video');
      const secs = (new RegExp('\\b(?:over|for|of)?\\s*' + AIB_TIME + '\\s*(?:fade|long)?').exec(cl.replace(/fade (in|out)/, '')) || [])[1];
      const d = clamp(aibSec(secs) || 1, 0.1, 10);
      const both = /\bin and out\b|\bboth\b|\bout and in\b/.test(cl) || !/\b(in|out)\b/.test(cl);
      const fin = both || /\bfade (it |them )?in\b|\bfade-in\b/.test(cl), fout = both || /\bfade (it |them )?out\b|\bfade-out\b/.test(cl);
      let list = r.clips;
      if (!r.explicit && r.kind == null) { const v = aibVisuals(); list = [fin && !fout ? v[0] : v[v.length - 1]].filter(Boolean); if (fin && fout) list = [v[0], v[v.length - 1]].filter(Boolean); }
      push({ type: 'fadeMany', clipIds: list.map((c) => c.id), in: fin ? d : undefined, out: fout ? d : undefined, first: !r.explicit && fin && fout }, `${fin && fout ? 'fade in and out' : fin ? 'fade in' : 'fade out'}`); continue;
    }

    // ---- transitions ----
    if (/\b(transitions?|crossfades?|cross fades?|dissolves?|fade to black|whip|swipe between|tranzit\w*)\b/.test(cl) || (/\bbetween (the |all |every )?(clips|scenes|cuts)\b/.test(cl) && aibTransition(cl))) {
      if (/\b(remove|delete|no|without|clear|get rid)\b/.test(cl)) { push({ type: 'removeTransitions' }, 'remove the transitions'); continue; }
      const tr = aibTransition(cl) || 'fade';
      const d = aibSec((new RegExp('\\b' + AIB_TIME + '\\s*(?:long|transitions?|crossfades?)').exec(cl) || new RegExp('\\b(?:of|for|lasting)\\s+' + AIB_TIME).exec(cl) || [])[1]);
      const r = T('video');
      const all = r.all || !r.explicit || /\b(all|every|each|between)\b/.test(cl);
      push({ type: 'transition', clipId: all ? 'all' : r.clips[0].id, transition: tr, duration: d || undefined }, `add ${transById(tr).name.toLowerCase()} transition${all ? 's between all clips' : ' on ' + aibLabel(r.clips[0])}`); continue;
    }

    // ---- delete / cut ranges ----
    const isSplitCut = /\b(in half|into \d+|in \d+ (parts|pieces)|every \d)/.test(cl) || (/\b(cut|taie)\b/.test(cl) && !/\b(remove|delete|out|off|erase|get rid)\b/.test(cl) && !range && at != null && at !== 'end');
    if (!isSplitCut && /\b(remove|delete|cut( out)?|trim( off)?|get rid of|erase|sterge|taie|scoate)\b/.test(cl)) {
      if (/\bgaps?\b|\bempty (space|parts)\b|\bblack (parts|gaps)\b/.test(cl)) { push({ type: 'closeGaps' }, 'close the gaps'); continue; }
      if (/\btransitions?\b/.test(cl)) { push({ type: 'removeTransitions' }, 'remove the transitions'); continue; }
      if (/\b(filters?|looks?|color grade)\b/.test(cl)) { const r = T('video'); push({ type: 'filter', clipIds: r.all || !r.explicit ? 'all' : ids(r), filter: 'none' }, 'remove the looks'); continue; }
      if (/\beffects?\b/.test(cl) && !/\bsound\b/.test(cl)) { const r = T('video'); push({ type: 'clearEffects', clipIds: r.all || !r.explicit ? aibVisuals().map((c) => c.id) : ids(r) }, 'remove the effects'); continue; }
      if (/\bkeyframes?|animation\b/.test(cl)) { const r = T('video'); push({ type: 'clearKeys', clipIds: ids(r) }, 'remove the animation'); continue; }
      if (/\bmarkers?\b/.test(cl)) { push({ type: 'clearMarkers' }, 'remove the markers'); continue; }
      if (range) {
        if (range[2] === 'first' || range[2] === 'last') {
          const r = T('video');
          const scope = /\b(each|every|all)\b/.test(cl) ? aibVisuals() : r.explicit ? r.clips : null;
          if (scope) { for (const c of scope) push({ type: 'trimClip', clipId: c.id, [range[2] === 'first' ? 'cutStart' : 'cutEnd']: aibSec(String(range[0]).replace('end-', '')) || (range[1] - range[0]) }); said.push(`cut the ${range[2]} ${aibSec(String(range[0]).replace('end-', '')) || range[1]}s of ${scope.length > 1 ? 'each clip' : aibLabel(scope[0])}`); continue; }
          const n = range[2] === 'first' ? range[1] : aibSec(String(range[0]).replace('end-', ''));
          push({ type: 'cutRange', from: range[2] === 'first' ? 0 : 'end-' + n, to: range[2] === 'first' ? n : 'end' }, `cut the ${range[2]} ${n}s`); continue;
        }
        push({ type: 'cutRange', from: range[0], to: range[1] }, `cut out ${aibFmt(range[0])}–${aibFmt(range[1])}`); continue;
      }
      const kind = aibKindWord(cl);
      if (kind && kind !== 'video' && kind !== 'audio' && kind !== 'videosound') {
        const r = T(kind);
        if (r.clips.length) { push({ type: 'deleteClips', clipIds: r.explicit && !r.all && r.clips.length === 1 && /\b(first|last|second|this|selected|\d)\b/.test(cl) ? ids(r) : r.clips.map((c) => c.id), closeGap: false }, 'remove ' + (r.clips.length > 1 ? 'the ' + kind : aibLabel(r.clips[0]))); continue; }
      }
      const r = T('video');
      if (r.clips.length && (r.explicit || /\b(this|it|selected|clip)\b/.test(cl))) { push({ type: 'deleteClips', clipIds: ids(r), closeGap: !/\bleave (a )?gap|keep the gap\b/.test(cl) }, 'remove ' + (r.clips.length > 1 ? r.clips.length + ' clips' : aibLabel(r.clips[0]))); continue; }
    }

    // ---- split ----
    if (/\b(split|cut|chop|slice|taie)\b/.test(cl)) {
      let m = new RegExp('\\b(?:every|each)\\s+' + AIB_TIME).exec(cl);
      if (m) { const s = aibSec(m[1]); if (s >= 0.2) { push({ type: 'splitEvery', every: s }, `split every ${s}s`); continue; } }
      m = /\b(?:in(?:to)?|in)\s+(\d+)\s+(?:parts|pieces|equal parts|bucati)\b|\bin half\b/.exec(cl);
      if (m) { push({ type: 'splitParts', parts: m[1] ? +m[1] : 2, clipId: (T('video').clips[0] || {}).id }, `split into ${m[1] || 2} parts`); continue; }
      const times = aibAllTimes(cl);
      if (times.length) { for (const t of times) push({ type: 'split', time: t, all: true }); said.push('split at ' + times.map(fmt).join(', ')); continue; }
      if (/\b(here|playhead|now)\b/.test(cl)) { push({ type: 'split', time: state.time, all: true }, 'split at the playhead'); continue; }
    }

    // ---- speed ----
    {
      let m = /\b(\d+(?:[.,]\d+)?)\s*x\b|\bx\s*(\d+(?:[.,]\d+)?)\b/.exec(cl);
      let speed = m ? parseFloat((m[1] || m[2]).replace(',', '.')) : null;
      const pc = aibPct(cl);
      if (!speed && /\b(speed|faster|slower|fast|slow)\b/.test(cl) && pc != null) speed = /slow/.test(cl) ? pc / 100 : 1 + pc / 100;
      if (!speed && /\b(twice as fast|double speed)\b/.test(cl)) speed = 2;
      if (!speed && /\b(half speed|half as fast)\b/.test(cl)) speed = 0.5;
      if (!speed && /\b(normal speed|real ?time|reset (the )?speed|1x)\b/.test(cl)) speed = 1;
      if (!speed && /\b(speed (it |this |them )?up|faster|fast forward|timelapse|time lapse|quicker|mai repede)\b/.test(cl)) speed = /\b(much|way|a lot|super)\b/.test(cl) ? 4 : 2;
      if (!speed && /\b(slow ?mo\w*|slow motion|slower|slow (it |this |them )?down|mai incet|super slow)\b/.test(cl)) speed = /\b(super|very|really|much)\b/.test(cl) ? 0.25 : 0.5;
      if (speed && /\b(speed|fast|slow|x\b|\dx)/.test(cl)) {
        const r = T('any');
        const list = r.all || /\b(everything|whole video|all)\b/.test(cl) ? aibVisuals() : r.clips;
        if (list.length) { push({ type: 'speedMany', clipIds: list.map((c) => c.id), speed: clamp(speed, 0.1, 10) }, `set the speed to ${+speed.toFixed(2)}x on ${list.length > 1 ? list.length + ' clips' : aibLabel(list[0])}`); continue; }
      }
    }

    // ---- text / titles ----
    const itText = lastTargets && lastTargets.kind === 'text' && /\b(it|them|that)\b/.test(cl) && (aibColor(cl) || /\b(bigger|smaller|larger|bold|italic|top|bottom|middle|left|right|outline|glow|shadow|font|upper ?case|pop|fade|slide|typewriter)\b/.test(cl));
    const wantsText = itText || /\b(title|text|heading|headline|words?|caption text|lower third|label|name tag|subtitle|titlu|scris)\b/.test(cl) || (quote && /\b(add|put|write|type|show|display|insert|adauga|pune|scrie)\b/.test(cl));
    if (wantsText) {
      const sel = getClip(state.selectedId);
      let editing = /\b(change|edit|replace|rename|update|make|set|turn|move|schimba)\b/.test(cl) && !/\b(add|put|insert|new|create|adauga|pune)\b/.test(cl);
      const pre = aibFind(TEXT_PRESETS, cl, (x) => [x.name]);
      const props = {};
      const col = aibColor(cl); if (col) props.color = col;
      if (/\b(bigger|larger|huge|big|massive)\b/.test(cl)) props.sizeMul = /\b(huge|massive)\b/.test(cl) ? 1.6 : 1.3;
      if (/\b(smaller|tiny|small)\b/.test(cl)) props.sizeMul = 0.75;
      const sizeM = /\bsize\s*(\d+)\b/.exec(cl); if (sizeM) props.size = +sizeM[1];
      if (/\btop\b/.test(cl)) props.y = 0.15; else if (/\bbottom\b/.test(cl)) props.y = 0.85; else if (/\b(middle|center|centre)\b/.test(cl)) props.y = 0.5;
      if (/\b(left)\b/.test(cl)) { props.x = 0.08; props.align = 'left'; } else if (/\bright\b/.test(cl) && !/\bright (now|here)\b/.test(cl)) { props.x = 0.92; props.align = 'right'; }
      if (/\bbold\b/.test(cl)) props.bold = !/\bnot bold|no bold\b/.test(cl);
      if (/\bitalic\b/.test(cl)) props.italic = true;
      if (/\b(outline|stroke|border)\b/.test(cl)) props.outline = !neg;
      if (/\b(glow|glowing|neon)\b/.test(cl)) props.glow = !neg;
      if (/\bshadow\b/.test(cl)) props.shadow = !neg;
      if (/\b(background|box behind|highlight box)\b/.test(cl)) props.bg = !neg;
      if (/\b(upper ?case|all caps|capital letters)\b/.test(cl)) props.upper = true;
      const anim = /\btype ?writer|typing\b/.test(cl) ? 'type' : /\bpop(s|ping)?\b|\bbounce\b/.test(cl) ? 'pop' : /\bslide\b/.test(cl) ? 'slide' : /\bfade\b/.test(cl) ? 'fade' : /\bno animation\b/.test(cl) ? 'none' : null;
      if (anim) props.anim = anim;
      const font = typeof ALL_FONTS !== 'undefined' ? aibFind(ALL_FONTS.map((f) => (typeof f === 'string' ? f : f.name || f.family)).filter(Boolean), cl, (f) => [f]) : null;
      if (font) props.font = font;
      const d = aibDuration(cl);
      if (!quote && /\bthe (text|title|words|heading|headline)\b/.test(cl) && aibPool('text').length && (Object.keys(props).length || at != null)) editing = true;
      if (itText) editing = true;
      if (editing || (!quote && Object.keys(props).length && (sel && sel.kind === 'text'))) {
        const pool = aibPool('text');
        const r = itText ? { clips: lastTargets.newText ? [{ id: '@last' }] : lastTargets.clips } : sel && sel.kind === 'text' ? { clips: [sel] } : /\b(all|every)\b/.test(cl) ? { clips: pool } : { clips: aibTargets(cl, 'text').clips.filter((c) => c.kind === 'text') };
        if (!r.clips.length && pool.length) r.clips = [pool[0]];
        if (itText && lastTargets.newText) { push({ type: 'textEdit', clipIds: ['@last'], props }, 'change it'); continue; }
        if (r.clips.length) {
          const toM = /\bto\s+§(\d+)§/.exec(cl);
          if (toM || (quote && editing)) props.content = toM ? quotes[+toM[1]] : quote;
          if (d) props.duration = d;
          const mv = new RegExp('\\b(?:to|at)\\s+' + AIB_TIME + '(?!\\s*%)').exec(cl);
          if (/\b(move|shift|start|put)\b/.test(cl) && mv && aibSec(mv[1]) != null) props.start = aibSec(mv[1]);
          lastTargets = { clips: r.clips, all: r.clips.length > 1, explicit: true, kind: 'text' };
          push({ type: 'textEdit', clipIds: r.clips.map((c) => c.id), props }, 'change the text'); continue;
        }
      }
      let content = quote;
      if (!content) { const m = /\b(?:saying|that says|says|with the words|reading|called|named|:)\s+(.+?)\s*$/i.exec(rawCl.trim()); if (m) content = m[1].replace(new RegExp('\\s+\\b(at|in|on|for|from|until|to)\\s+(the\\s+)?(\\d|start|end|beginning|top|bottom|middle|left|right).*$', 'i'), '').trim(); }
      if (!content) { const m = /\bwith\s+([^,]+?)\s*$/i.exec(rawCl.replace(/\b(at|in|on|for|from)\b.*$/i, '')); if (m && !/\b(color|font|outline|glow|shadow|background)\b/i.test(m[1])) content = m[1].trim(); }
      if (!content) content = pre ? pre.t.content : 'Your Title';
      const start = at === 'end' ? 'end' : at != null ? at : (/\bintro|beginning|start\b/.test(cl) ? 0 : state.time);
      lastTargets = { clips: [], all: false, explicit: true, kind: 'text', newText: true };
      push({ type: 'addText', text: content.replace(/^./, (c) => c.toUpperCase()), start, duration: d || 3, preset: pre ? pre.name : /\bsubtitle\b/.test(cl) ? 'Subtitle' : /\blower third|name tag\b/.test(cl) ? 'Lower third' : 'Title', props }, `add the text “${content.slice(0, 30)}”`);
      continue;
    }

    // ---- visual effects (glitch, VHS, cinema bars…) ----
    const vfx = aibVisFx(cl);
    if (vfx && /\b(add|put|apply|use|give|make|effect|look|turn|with)\b/.test(cl) && !/\b(sound|audio|voice|transition)\b/.test(cl)) {
      const r = T('video');
      const list = r.all ? r.clips : r.clips.length ? r.clips : aibVisuals().slice(0, 1);
      if (/\b(remove|no|without)\b/.test(cl)) { push({ type: 'clearEffects', clipIds: list.map((c) => c.id), fx: vfx }, 'remove ' + EFFECT_TYPES[vfx].name.toLowerCase()); continue; }
      push({ type: 'visualFx', clipIds: list.map((c) => c.id), fx: vfx }, 'add ' + EFFECT_TYPES[vfx].name.toLowerCase() + ' to ' + (list.length > 1 ? list.length + ' clips' : aibLabel(list[0]))); continue;
    }
    if (/\bcinematic|like a movie|film look|movie look\b/.test(cl) && /\b(make|look|style|give|add)\b/.test(cl)) {
      const vs = aibVisuals().map((c) => c.id);
      push({ type: 'filter', clipIds: 'all', filter: 'cinema' }); push({ type: 'visualFx', clipIds: vs, fx: 'letterbox' }); said.push('give it a cinematic look with cinema bars'); continue;
    }

    // ---- color / look adjustments ----
    {
      const r0 = () => T('video');
      const adj = {};
      const pc = aibPct(cl);
      const amt = (base) => (pc != null ? pc : /\b(much|way|a lot|very|really|super)\b/.test(cl) ? base * 2 : /\b(slightly|a bit|a little|little)\b/.test(cl) ? base / 2 : base);
      if (/\b(brighter|brighten|lighter|more light|too dark|luminos)\b/.test(cl)) adj.brightness = amt(15);
      if (/\b(darker|darken|dimmer|too bright|less bright)\b/.test(cl)) adj.brightness = -amt(15);
      if (/\b(more contrast|contrastier|punchier|increase (the )?contrast)\b/.test(cl)) adj.contrast = amt(15);
      if (/\b(less contrast|flatter|lower (the )?contrast|reduce (the )?contrast)\b/.test(cl)) adj.contrast = -amt(15);
      if (/\b(more (saturated|color|colour)|saturate|more vivid|more vibrant|colou?rful)\b/.test(cl) && !aibLook(cl)) adj.saturation = amt(25);
      if (/\b(less (saturated|color|colour)|desaturate|muted colou?rs?|washed out)\b/.test(cl)) adj.saturation = -amt(30);
      if (/\b(warmer|warm it|make it warm|more orange|more yellow)\b/.test(cl)) adj.temp = amt(30);
      if (/\b(cooler|colder|cool it|make it cool|more blue|bluer)\b/.test(cl)) adj.temp = -amt(30);
      if (/\b(blurr?y|blur (it|the video|this|the clip)|make it blur)\b/.test(cl) && !/\bbackground\b/.test(cl)) adj.blurSet = clamp(pc != null ? pc / 5 : 6, 0, 30);
      if (/\b(vignette|dark corners|darker edges)\b/.test(cl)) adj.vignetteSet = neg ? 0 : clamp(pc != null ? pc : 55, 0, 100);
      if (/\b(film grain|grainy|add grain|noise effect)\b/.test(cl)) adj.grainSet = neg ? 0 : clamp(pc != null ? pc : 45, 0, 100);
      if (/\b(reset|remove|clear|undo)\b.*\b(colou?r|adjustments?|grading|brightness|contrast)\b/.test(cl)) Object.assign(adj, { reset: true });
      if (Object.keys(adj).length) {
        const r = r0();
        const list = /\b(all|every|everything|whole|entire)\b/.test(cl) || (!r.explicit && aibVisuals().length > 1 && !getClip(state.selectedId)) ? aibVisuals() : r.clips;
        push({ type: 'adjust', clipIds: list.map((c) => c.id), ...adj }, 'adjust the colors' + (list.length > 1 ? ' on all clips' : ''));
        continue;
      }
      const look = aibLook(cl);
      if (look && /\b(filter|look|colou?r|grade|make it|make (the )?\w+|style|turn|vibe|give|add|apply|use|feel)\b/.test(cl)) {
        const r = r0();
        const all = r.all || !r.explicit;
        push({ type: 'filter', clipIds: all ? 'all' : ids(r), filter: look }, 'use the ' + filterById(look).name + ' look' + (all ? '' : ' on ' + aibLabel(r.clips[0]))); continue;
      }
    }

    // ---- background blur / fill / fit ----
    if (/\b(blur(red)? (the )?background|blurry background|background blur|blurred bars)\b/.test(cl)) { const r = T('video'); push({ type: 'bgBlur', clipIds: (r.all || !r.explicit ? aibVisuals() : r.clips).map((c) => c.id), on: !neg }, neg ? 'remove the blurred background' : 'blur the background'); continue; }
    if (/\b(fill (the )?(screen|frame)|full ?screen|crop to fill|no black bars|remove (the )?black bars|zoom to fill)\b/.test(cl)) { const r = T('video'); push({ type: 'fit', clipIds: (r.all || !r.explicit ? aibVisuals() : r.clips).map((c) => c.id), fit: 'cover' }, 'fill the frame'); continue; }
    if (/\b(fit (the )?(screen|frame)|show (the )?whole (picture|video)|don't crop|uncrop)\b/.test(cl)) { const r = T('video'); push({ type: 'fit', clipIds: (r.all || !r.explicit ? aibVisuals() : r.clips).map((c) => c.id), fit: 'contain' }, 'fit the whole picture'); continue; }
    if (/\bgreen ?screen|chroma ?key|remove (the )?green\b|key out\b/.test(cl)) { const r = T('video'); push({ type: 'chroma', clipIds: ids(r), color: /\bblue\b/.test(cl) ? '#0000ff' : '#00ff00', on: !neg }, 'remove the green screen'); continue; }

    // ---- zoom / motion / transform ----
    if (/\bzoom\b/.test(cl) && !/\b(timeline|transition)\b/.test(cl)) {
      const r = T('video');
      const c = r.clips[0];
      if (/\bslow(ly)?\b|ken burns|gradual|throughout|whole clip/.test(cl) && c) { push({ type: 'motion', clipIds: (r.all ? r.clips : [c]).map((x) => x.id), motion: /\bout\b/.test(cl) ? 'zoomOut' : 'zoomIn' }, 'slow zoom ' + (/\bout\b/.test(cl) ? 'out' : 'in')); continue; }
      const t = at === 'end' ? null : at != null ? at : range ? range[0] : null;
      const pc = aibPct(cl);
      const amount = pc != null ? (pc > 100 ? pc / 100 : 1 + pc / 100) : /\b(a lot|way|big|huge)\b/.test(cl) ? 1.6 : /\b(a bit|slightly|a little)\b/.test(cl) ? 1.15 : 1.35;
      const target = t != null ? P.clips.filter(isVisual).find((x) => t >= x.start && t < endOf(x)) || c : c;
      if (target) { push({ type: 'zoomKey', clipId: target.id, time: t != null ? t : Math.max(target.start, state.time), to: /\bout\b/.test(cl) ? 1 / amount : amount, hold: range ? range[1] - range[0] : aibDuration(cl) || 1.2, smooth: !/\b(punch|snap|quick|instant|fast|hard)\b/.test(cl) }, `zoom ${/\bout\b/.test(cl) ? 'out' : 'in'}${t != null ? ' at ' + aibFmt(t) : ''}`); continue; }
    }
    if (/\b(pan (left|right)|ken burns)\b/.test(cl)) { const r = T('video'); push({ type: 'motion', clipIds: ids(r), motion: /left/.test(cl) ? 'panLeft' : 'panRight' }, 'pan ' + (/left/.test(cl) ? 'left' : 'right')); continue; }
    if (/\b(shake|shaky|earthquake)\b/.test(cl) && !/\btransition\b/.test(cl)) { const r = T('video'); push({ type: 'motion', clipIds: ids(r), motion: neg ? 'none' : 'shake' }, neg ? 'stop the shake' : 'add a shake'); continue; }
    if (/\b(rotate|turn (it )?(sideways|upside down)|upside down|tilt|roteste)\b/.test(cl)) {
      const r = T('any'); const m = /(-?\d+)\s*(°|degrees?|grade)?/.exec(cl);
      let deg = m ? +m[1] : /upside down/.test(cl) ? 180 : 90;
      if (/\b(left|counter ?clockwise|anticlockwise)\b/.test(cl)) deg = -Math.abs(deg);
      push({ type: 'transform', clipIds: ids(r), rotateBy: /\bto\b/.test(cl) ? undefined : deg, rotation: /\bto\b/.test(cl) ? deg : undefined }, `rotate ${deg}°`); continue;
    }
    if (/\b(flip|mirror|oglind)\b/.test(cl)) { const r = T('any'); const v = /\b(vertical(ly)?|upside|up ?down)\b/.test(cl); push({ type: 'transform', clipIds: ids(r), [v ? 'toggleFlipV' : 'toggleFlipH']: true }, 'flip ' + (v ? 'vertically' : 'horizontally')); continue; }
    if (/\b(bigger|smaller|scale|resize|size|enlarge|shrink|make it \d+%)\b/.test(cl) && !/\b(text|title|caption|font|file)\b/.test(cl)) {
      const r = T('any'); const pc = aibPct(cl);
      const a = pc != null ? (/\b(by|bigger by|smaller by)\b/.test(cl) ? { scaleMul: /smaller|shrink/.test(cl) ? 1 - pc / 100 : 1 + pc / 100 } : { scale: pc / 100 }) : { scaleMul: /\b(smaller|shrink)\b/.test(cl) ? 0.8 : 1.25 };
      push({ type: 'transform', clipIds: ids(r), ...a }, 'resize ' + aibLabel(r.clips[0])); continue;
    }
    if (/\b(move|put|place|shift|position)\b.*\b(left|right|up|down|top|bottom|corner|center|centre|middle)\b/.test(cl) && !/\b(timeline|track|later|earlier|text|title|caption)\b/.test(cl)) {
      const r = T('any'), a = {};
      if (/\b(center|centre|middle)\b/.test(cl)) { a.x = 0; a.y = 0; }
      if (/\bleft\b/.test(cl)) a.dx = -0.25; if (/\bright\b/.test(cl)) a.dx = 0.25;
      if (/\b(up|top)\b/.test(cl)) a.dy = -0.25; if (/\b(down|bottom)\b/.test(cl)) a.dy = 0.25;
      push({ type: 'transform', clipIds: ids(r), ...a }, 'move ' + aibLabel(r.clips[0])); continue;
    }
    if (/\b(opacity|transparent|see[- ]through|invisible|fade it a bit)\b/.test(cl)) { const r = T('any'); const pc = aibPct(cl); push({ type: 'transform', clipIds: ids(r), opacity: clamp((pc != null ? pc : /invisible/.test(cl) ? 0 : 50) / 100, 0, 1) }, 'set the opacity'); continue; }

    // ---- moving clips in time, duplicate, freeze ----
    const moveTo = new RegExp('\\bto\\s+' + AIB_TIME + '(?!\\s*%)').exec(cl);
    if (/\b(move|shift|put|place|start)\b/.test(cl) && (at != null || moveTo || /\b(later|earlier|to the end|to the start|after|before)\b/.test(cl)) && !/\b(left|right|up|down|top|bottom|corner|center|centre|middle)\b/.test(cl.replace(/\b(later|earlier)\b/, ''))) {
      const r = T('any'); const c = r.clips[0];
      if (c) {
        let to = at === 'end' ? Math.max(0, ...P.clips.filter((x) => x.trackId === c.trackId && x.id !== c.id).map(endOf)) : at != null ? at : moveTo ? aibSec(moveTo[1]) : /\bto the start\b/.test(cl) ? 0 : null;
        const by = new RegExp('\\bby\\s+' + AIB_TIME).exec(cl);
        if (by && /\b(later|right|forward)\b/.test(cl)) to = c.start + aibSec(by[1]); else if (by && /\b(earlier|left|back)\b/.test(cl)) to = Math.max(0, c.start - aibSec(by[1]));
        if (to != null && typeof to === 'number') { push({ type: 'move', clipId: c.id, start: to }, `move ${aibLabel(c)} to ${aibFmt(to)}`); continue; }
      }
    }
    if (/\b(duplicate|copy|repeat|again|twice|dubleaza)\b/.test(cl) && !/\bspeed|fast|as fast\b/.test(cl)) { const r = T('any'); const n = +((/(\d+)\s*(times|x)/.exec(cl) || [])[1] || 1); push({ type: 'duplicate', clipId: (r.clips[0] || {}).id, times: clamp(n, 1, 20) }, 'duplicate ' + aibLabel(r.clips[0])); continue; }
    if (/\b(freeze|still frame|pause the video|hold (the|this) frame|freeze frame)\b/.test(cl)) { push({ type: 'freeze', time: at === 'end' ? null : at != null ? at : state.time }, 'add a freeze frame' + (at != null && at !== 'end' ? ' at ' + aibFmt(at) : '')); continue; }
    if (/\b(separate|detach|split) (the )?(audio|sound)\b|\bunlink\b/.test(cl)) { const r = T('video'); push({ type: 'detach', clipIds: ids(r) }, 'separate the sound'); continue; }
    { const m = new RegExp('\\b(?:make|set)\\b.*\\b(?:clip|video|photo|image|text|title|it|one)\\s+' + AIB_TIME + '\\s+long\\b').exec(cl);
      if (m && !/\b(whole|entire|project|everything|the video)\b/.test(cl)) { const r = T('any'); if (r.clips[0]) { push({ type: 'length', clipId: r.clips[0].id, length: aibSec(m[1]) }, `make ${aibLabel(r.clips[0])} ${aibFmt(aibSec(m[1]))} long`); continue; } } }
    if (/\b(shorten|shorter|trim it to|make it|cut it to|lengthen|longer|extend)\b/.test(cl) && new RegExp('\\b(?:to|down to)\\s+' + AIB_TIME).test(cl)) {
      const m = new RegExp('\\b(?:to|down to)\\s+' + AIB_TIME).exec(cl), want = aibSec(m[1]);
      const r = T('any');
      if (/\b(video|whole|everything|total|project)\b/.test(cl) && !r.explicit) push({ type: 'cutRange', from: want, to: 'end' }, `make the video ${aibFmt(want)} long`);
      else push({ type: 'length', clipId: (r.clips[0] || {}).id, length: want }, `make ${aibLabel(r.clips[0])} ${aibFmt(want)} long`);
      continue;
    }
    { const m = new RegExp('\\b(?:make|trim|cut|shorten)\\s+(?:the |my )?(?:whole )?(?:video|it|everything|project|edit)\\s+(?:to\\s+|down to\\s+)?' + AIB_TIME + '\\s*(?:long)?\\b').exec(cl);
      if (m && /\b(long|to|down)\b/.test(cl) && aibSec(m[1]) > 0.5) { const want = aibSec(m[1]); if (want < aibEnd()) { push({ type: 'cutRange', from: want, to: 'end' }, `make the video ${aibFmt(want)} long`); continue; } } }
    if (/\b(marker|mark this|bookmark)\b/.test(cl)) { const ts = aibAllTimes(cl); for (const t of ts.length ? ts : [at != null && at !== 'end' ? at : state.time]) push({ type: 'marker', time: t }); said.push('add a marker'); continue; }
    if (/\b(background colou?r|bg colou?r)\b/.test(cl)) { const col = aibColor(cl); if (col) { push({ type: 'background', color: col }, 'change the background color'); continue; } }
    if (/\bclose (the )?gaps?|remove (the )?gaps?|no gaps\b/.test(cl)) { push({ type: 'closeGaps' }, 'close the gaps'); continue; }
    if (/\b(go to|jump to|seek to|skip to)\b/.test(cl) && at != null) { push({ type: 'seek', time: at }, 'go to ' + (at === 'end' ? 'the end' : aibFmt(at))); continue; }

    if (actions.length === n0) {
      const h = aibHelp(cl);
      notes.push(h ? h : null);
    }
  }
  if (!actions.length) {
    const h = notes.find(Boolean);
    if (h) return { reply: h, actions: [] };
    return { reply: 'I’m not sure what to change there. You can say things like: ' + AIB_SUGGEST.slice(0, 7).map((s) => '“' + s + '”').join(', ') + '. Or ask “how do I…”.', actions: [] };
  }
  const missed = notes.filter((x) => x === null).length;
  let reply = 'Okay - I’ll ' + said.filter(Boolean).join(', ') + '.';
  if (missed) reply += ' (I didn’t understand one part - try saying it another way.)';
  return { reply, actions };
}
// the old quick mode is replaced by this one
localPlan = aibPlan;

/* ============================ doing the edits ============================ */
const aibEnd = () => Math.max(0, ...P.clips.filter((c) => c.kind !== 'text' || !c.caption).map(endOf));
const aibT = (t) => (t === 'end' ? Math.max(0, aibEnd() - 3) : typeof t === 'string' && t.startsWith('end-') ? Math.max(0, aibEnd() - parseFloat(t.slice(4))) : +t || 0);
function aibCloseGaps() {
  commit(() => {
    const tracks = new Set(P.clips.filter((c) => c.kind !== 'audio' || !c.linkId).map((c) => c.trackId));
    for (const tid of tracks) {
      const tr = getTrack(tid); if (!tr || tr.locked || tr.type === 'audio' && !P.clips.some((c) => c.trackId === tid && c.kind === 'audio' && !c.linkId && aibIsVoice(c))) continue;
      const list = P.clips.filter((c) => c.trackId === tid).sort((a, b) => a.start - b.start);
      let cur = 0;
      for (const c of list) {
        if (c.caption) continue;
        if (c.start > cur + 1e-3) { const d = c.start - cur; for (const x of [c, ...partners(c)]) x.start -= d; }
        cur = endOf(c);
      }
    }
  });
}
function aibCutRange(a, b) {
  a = Math.max(0, a); b = Math.min(b, aibEnd());
  if (b - a < 0.05) return false;
  const keep = state.selectedId; state.selectedId = null;
  for (const t of [b, a]) { if (P.clips.some((c) => t > c.start + 0.02 && t < endOf(c) - 0.02 && !isLocked(c))) splitAt(t); }
  state.selectedId = keep;
  commit(() => {
    const gone = P.clips.filter((c) => !isLocked(c) && c.start >= a - 0.02 && endOf(c) <= b + 0.02);
    const goneIds = new Set(gone.map((c) => c.id));
    P.clips = P.clips.filter((c) => !goneIds.has(c.id));
    const d = b - a;
    for (const c of P.clips) if (!isLocked(c) && c.start >= b - 0.02) c.start = Math.max(0, c.start - d);
    if (P.markers) P.markers = P.markers.filter((m) => m.t < a || m.t > b).map((m) => (m.t > b ? { ...m, t: m.t - d } : m));
  });
  return true;
}
function aibZoomKey(c, t, to, hold, smooth) {
  commit(() => {
    const local = clamp(t - c.start, 0, dur(c));
    const base = c.scale || 1, ramp = smooth ? 0.45 : 0.08;
    c.keys = c.keys || {};
    const ks = (c.keys.scale = (c.keys.scale || []).filter((k) => k.t < local - 0.01 || k.t > local + ramp + hold + ramp + 0.01));
    const add = (tt, v) => { if (tt >= 0 && tt <= dur(c) + 1e-3) ks.push({ t: +tt.toFixed(3), v, ease: smooth ? 'smooth' : 'linear' }); };
    add(local, base); add(local + ramp, base * to); add(local + ramp + hold, base * to); add(local + ramp + hold + ramp, base);
    ks.sort((x, y) => x.t - y.t);
  });
}
function aibSetCapStyle(o) {
  if (o.style) { const st = CAPTION_STYLES.find((s) => s.id === o.style); if (st && (!st.pro || requirePremium(st.name + ' captions'))) capOpts.style = o.style; }
  if (o.pos != null) capOpts.pos = o.pos;
  if (o.upper != null) capOpts.upper = o.upper;
  if (o.sizeMul) { const st = CAPTION_STYLES.find((s) => s.id === capOpts.style) || CAPTION_STYLES[0]; capOpts.size = Math.round((capOpts.size || st.t.size || 60) * o.sizeMul); }
  try { localStorage.setItem('flux.capOpts', JSON.stringify(capOpts)); } catch {}
  restyleCaptions();
  if (o.color) commit(() => { for (const c of P.clips.filter((x) => x.caption)) { if (c.text.karaoke) c.text.hl = o.color; else c.text.color = o.color; } });
}
{
  const baseRun = runAiActions;
  runAiActions = async function (actions) {
    const done = [], rest = [];
    let lastText = null;
    const many = (a) => (a.clipIds === 'all' ? aibVisuals() : (a.clipIds || (a.clipId ? [a.clipId] : [])).map((id) => (id === '@last' ? lastText : getClip(id))).filter(Boolean));
    const flush = async () => { if (rest.length) { done.push(...(await baseRun(rest.splice(0)))); } };
    for (const a of actions) {
      try {
        switch (a.type) {
          case 'undo': await flush(); for (let i = 0; i < Math.min(20, +a.times || 1); i++) undo(); done.push('Undone'); break;
          case 'redo': await flush(); redo(); done.push('Redone'); break;
          case 'play': await flush(); if (a.time != null) seek(+a.time); play(); break;
          case 'pause': await flush(); pause(); break;
          case 'seek': await flush(); seek(a.time === 'end' ? aibEnd() : +a.time); break;
          case 'export': await flush(); openExportDialog(); done.push('Opened Export'); break;
          case 'tts': {
            await flush();
            const t = a.time === 'end' ? aibEnd() : a.time != null ? +a.time : state.time;
            const c = await ttsAddToTimeline(a.text, t, { voice: a.voice || undefined, captions: a.captions });
            if (c) done.push(`Voice: “${String(a.text).slice(0, 40)}”`);
            break;
          }
          case 'captionsStyle': await flush(); aibSetCapStyle(a); done.push('Restyled the captions'); break;
          case 'captions': if (a.style) capOpts.style = a.style; rest.push({ type: 'captions', clipId: a.clipId, style: a.style }); break;
          case 'bleep': {
            await flush();
            const src = (getClip(state.selectedId) && soundSource(getClip(state.selectedId)) ? getClip(state.selectedId) : null) || pickSoundClip();
            if (src && await runBleep(src, a.level || 'moderate', a.sound || 'beep')) done.push('Bleeped swear words');
            break;
          }
          case 'normalize': await flush(); normalizeClip(getClip(a.clipId)); done.push('Normalized the volume'); break;
          case 'duck': await flush(); commit(() => { for (const c of aibPool('music')) c.audio = Object.assign({ pan: 0, bass: 0, mid: 0, treble: 0 }, c.audio || {}, { duck: !!a.on }); }); done.push(a.on ? 'Music ducks under speech' : 'Ducking off'); break;
          case 'music': {
            await flush();
            const t = await aiAddMusic(a.mood, +a.start || 0);
            if (t) { if (a.quiet) { const m = P.clips.filter(aibIsMusic).pop(); if (m) commit(() => { m.volume = 0.35; }); } done.push(`Music: “${t}”`); }
            break;
          }
          case 'loopAudio': {
            await flush();
            const c = getClip(a.clipId); if (!c) break;
            const end = Math.max(0, ...P.clips.filter((x) => x.kind !== 'audio' && !x.caption).map(endOf));
            commit(() => {
              let at = endOf(c), n = 0;
              while (at < end - 0.1 && n < 50) {
                const b = JSON.parse(JSON.stringify(c)); b.id = uid(); b.linkId = null; b.start = at; b.fadeIn = 0;
                const room = end - at; if (dur(b) > room) b.out = b.in + room * b.speed;
                b.fadeOut = dur(b) >= room - 0.01 ? 2 : 0;
                P.clips.push(b); at = endOf(b); n++;
              }
            });
            done.push('Looped the music to the end'); break;
          }
          case 'shotSfx': {
            await flush();
            const info = bleepInfo(a.id), buf = await bleepBuffer(a.id); if (!buf) break;
            const n = buf.length, dv = new DataView(new ArrayBuffer(44 + n * 4)), ws = (o, x) => [...x].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
            ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); ws(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, buf.sampleRate, true); dv.setUint32(28, buf.sampleRate * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, n * 4, true);
            const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
            for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, clamp(L[i], -1, 1) * 32767, true); dv.setInt16(46 + i * 4, clamp(R[i], -1, 1) * 32767, true); }
            const name = 'SFX - ' + info.name + '.wav';
            let m = P.media.find((x) => x.shotSfx === a.id && !x.missing);
            if (!m) { const path = api && api.saveMediaFile ? await api.saveMediaFile({ folder: 'sound effects', name, data: dv.buffer }) : URL.createObjectURL(new Blob([dv.buffer], { type: 'audio/wav' })); [m] = await importFiles([{ path, name, kind: 'audio', duration: n / buf.sampleRate, tag: 'sfx' }]); if (m) m.shotSfx = a.id; }
            if (!m) break;
            for (const tm of a.times) { const t = tm === 'end' ? Math.max(0, aibEnd() - n / buf.sampleRate) : +tm; addMediaAt(m, sfxTrackAt(t, n / buf.sampleRate).id, t); }
            done.push(info.name + (a.times.length > 1 ? ' ×' + a.times.length : '')); break;
          }
          case 'sfx': {
            await flush();
            const s = sfxById(a.sfx); if (!s) break;
            for (const tm of a.times || [state.time]) await addTrackToTimeline(sfxTrack(s), null, null, tm === 'end' ? Math.max(0, aibEnd() - s.len) : +tm);
            done.push(`${s.name}${(a.times || []).length > 1 ? ' ×' + a.times.length : ''}`);
            break;
          }
          case 'audioFx': {
            await flush();
            const list = many(a).map((c) => audioFxTarget(c)).filter(Boolean);
            const t = AFX_TYPES[a.fx]; if (!t || !list.length) break;
            if (t.pro && !requirePremium(t.name)) break;
            commit(() => {
              for (const c of list) {
                c.audio = c.audio || {}; c.audio.fx = c.audio.fx || [];
                const e = newAudioFx(a.fx); Object.assign(e, a.params || {});
                c.audio.fx.push(e);
              }
            });
            done.push(`${t.name} on ${list.length > 1 ? list.length + ' clips' : aibLabel(list[0])}`); break;
          }
          case 'removeAudioFx': await flush(); commit(() => { for (const c of many(a).map(audioFxTarget).filter(Boolean)) if (c.audio && c.audio.fx) c.audio.fx = a.fx ? c.audio.fx.filter((e) => e.type !== a.fx) : []; }); done.push('Removed audio effects'); break;
          case 'mute': await flush(); commit(() => { for (const c of many(a)) { const t = soundTarget(c); if (t) t.muted = !!a.muted; } }); done.push(a.muted ? 'Muted' : 'Unmuted'); break;
          case 'volumeDb': {
            await flush();
            commit(() => {
              for (const c of many(a)) {
                const t = soundSource(c) || c;
                if (a.gain != null) t.volume = clamp(a.gain, 0, 100);
                else if (a.db != null) t.volume = clamp(dbToGain(a.db), 0, 100);
                else t.volume = clamp(dbToGain(gainToDb(t.volume == null ? 1 : t.volume) + a.delta), 0, 100);
              }
            });
            done.push('Volume changed'); break;
          }
          case 'fadeMany': await flush(); commit(() => { for (const c of many(a)) for (const x of [c, ...partners(c)]) { if (a.in != null && (!a.first || c === many(a)[0])) x.fadeIn = a.in; if (a.out != null && (!a.first || c === many(a)[many(a).length - 1])) x.fadeOut = a.out; } }); done.push('Added fades'); break;
          case 'removeTransitions': await flush(); commit(() => { for (const c of P.clips) { c.transition = null; c.transitionOut = null; } }); done.push('Removed transitions'); break;
          case 'transition': rest.push({ type: 'transition', clipId: a.clipId, transition: a.transition, duration: a.duration }); break;
          case 'closeGaps': await flush(); aibCloseGaps(); done.push('Closed the gaps'); break;
          case 'clearEffects': await flush(); commit(() => { for (const c of many(a)) c.effects = a.fx ? (c.effects || []).filter((e) => e.type !== a.fx) : []; }); done.push('Removed effects'); break;
          case 'clearKeys': await flush(); commit(() => { for (const c of many(a)) c.keys = {}; }); done.push('Removed the animation'); break;
          case 'clearMarkers': await flush(); commit(() => { P.markers = []; }); done.push('Removed markers'); break;
          case 'cutRange': await flush(); { const f = aibT(a.from), t = a.to === 'end' ? aibEnd() : aibT(a.to); if (aibCutRange(f, t)) done.push(`Cut out ${aibFmt(f)}–${aibFmt(t)}`); } break;
          case 'trimClip': {
            await flush();
            const c = getClip(a.clipId); if (!c) break;
            commit(() => {
              const keepStart = c.start;
              for (const x of [c, ...partners(c)]) {
                if (a.cutStart) { const d = Math.min(a.cutStart, dur(x) - MIN_DUR); x.in += d * x.speed; }
                if (a.cutEnd) x.out = Math.max(x.in + MIN_DUR, x.out - a.cutEnd * x.speed);
                if (a.cutStart) x.start = keepStart + (x.start - c.start);
              }
              if (a.cutStart) { const d = a.cutStart; for (const o of P.clips) if (o.trackId === c.trackId && o.id !== c.id && o.start > keepStart) for (const x of [o, ...partners(o)]) x.start = Math.max(0, x.start - d); }
              if (a.cutEnd) { const d = a.cutEnd; for (const o of P.clips) if (o.trackId === c.trackId && o.id !== c.id && o.start > keepStart) for (const x of [o, ...partners(o)]) x.start = Math.max(0, x.start - d); }
            });
            done.push('Trimmed ' + aibLabel(c)); break;
          }
          case 'deleteClips': {
            await flush();
            const list = a.kind ? aibPool(a.kind) : (a.clipIds || []).map(getClip).filter(Boolean);
            if (!list.length) break;
            commit(() => {
              const all = new Set(); for (const c of list) for (const x of [c, ...partners(c)]) if (!isLocked(x)) all.add(x);
              for (const x of [...all].sort((p, q) => q.start - p.start)) {
                const d = dur(x), e = endOf(x);
                P.clips = P.clips.filter((y) => y.id !== x.id && !(y.caption && y.capFor === (x.linkId || x.id)));
                if (a.closeGap) for (const o of P.clips) if (o.trackId === x.trackId && o.start >= e - 1e-4) o.start -= d;
              }
              if (all.has(getClip(state.selectedId))) state.selectedId = null;
            });
            done.push(`Removed ${list.length > 1 ? list.length + ' clips' : aibLabel(list[0])}`); break;
          }
          case 'split': await flush(); { const keep = state.selectedId; if (a.all) state.selectedId = null; splitAt(+a.time); if (a.all && keep && getClip(keep)) state.selectedId = keep; done.push(`Cut at ${aibFmt(+a.time)}`); } break;
          case 'splitEvery': await flush(); { const end = aibEnd(); let n = 0; const keep = state.selectedId; state.selectedId = null; for (let t = a.every; t < end - 0.1 && n < 200; t += a.every, n++) splitAt(t); state.selectedId = keep; done.push(`Split every ${a.every}s (${n} cuts)`); } break;
          case 'splitParts': await flush(); { const c = getClip(a.clipId) || aibVisuals()[0]; if (!c) break; const d = dur(c) / a.parts; const keep = state.selectedId; for (let i = 1; i < a.parts; i++) { state.selectedId = null; splitAt(c.start + d * i); } state.selectedId = keep; done.push(`Split into ${a.parts} parts`); } break;
          case 'speedMany': await flush(); commit(() => { for (const c of many(a)) setSpeed(c, a.speed); }); done.push(`Speed ${a.speed}x`); break;
          case 'addText': {
            await flush();
            const pre = TEXT_PRESETS.find((x) => x.name === a.preset) || TEXT_PRESETS[0];
            const p = a.props || {};
            const props = Object.assign({}, JSON.parse(JSON.stringify(pre.t)), { content: p.upper ? String(a.text).toUpperCase() : a.text });
            for (const k of ['color', 'y', 'x', 'align', 'bold', 'italic', 'outline', 'glow', 'shadow', 'bg', 'anim', 'font', 'size']) if (p[k] != null) props[k] = p[k];
            if (p.sizeMul) props.size = Math.round((props.size || 96) * p.sizeMul);
            if (props.font && typeof ensureFont === 'function') ensureFont(props.font);
            const d = Math.max(0.5, +a.duration || 3);
            const st = a.start === 'end' ? Math.max(0, aibEnd() - d) : Math.max(0, +a.start || 0);
            commit(() => { const tc = makeTextClip(st, props); tc.out = d; tc.trackId = textTrackFor(st, d, tc.id).id; tc.start = findFreeStart(tc.trackId, st, d, tc.id); P.clips.push(tc); state.selectedId = tc.id; lastText = tc; });
            done.push(`Added text “${props.content}”`); break;
          }
          case 'textEdit': {
            await flush();
            const p = a.props || {};
            commit(() => {
              for (const c of many(a)) {
                const t = c.text;
                if (p.content != null) { t.content = p.content; delete t.words; }
                for (const k of ['color', 'y', 'x', 'align', 'bold', 'italic', 'outline', 'glow', 'shadow', 'bg', 'anim', 'font', 'size']) if (p[k] != null) t[k] = p[k];
                if (p.sizeMul) t.size = Math.round((t.size || 96) * p.sizeMul);
                if (p.upper) t.content = t.content.toUpperCase();
                if (p.duration) c.out = c.in + p.duration;
                if (p.start != null) c.start = findFreeStart(c.trackId, p.start, dur(c), c.id);
                if (p.font && typeof ensureFont === 'function') ensureFont(p.font);
              }
            });
            done.push('Changed the text'); break;
          }
          case 'visualFx': {
            await flush();
            const t = EFFECT_TYPES[a.fx]; const list = many(a).filter((c) => isVisual(c) || c.kind === 'adjust');
            if (!t || !list.length) break;
            if (t.pro && !requirePremium(t.name)) break;
            if (t.font && typeof ensureFont === 'function') ensureFont(t.font[2]);
            commit(() => { for (const c of list) { c.effects = c.effects || []; c.effects.push(newEffect(a.fx)); } });
            done.push(`${t.name} on ${list.length > 1 ? list.length + ' clips' : aibLabel(list[0])}`); break;
          }
          case 'filter': {
            await flush();
            const list = a.clipIds === 'all' ? P.clips.filter(isVisual) : many(a);
            commit(() => { for (const c of list) c.filter = a.filter; });
            done.push(`Look: ${filterById(a.filter).name}`); break;
          }
          case 'adjust': {
            await flush();
            commit(() => {
              for (const c of many(a).filter(isVisual)) {
                if (a.reset) Object.assign(c, { brightness: 100, contrast: 100, saturation: 100, temp: 0, tint: 0, hue: 0, blur: 0 });
                if (a.brightness) c.brightness = clamp((c.brightness ?? 100) + a.brightness, 0, 200);
                if (a.contrast) c.contrast = clamp((c.contrast ?? 100) + a.contrast, 0, 200);
                if (a.saturation) c.saturation = clamp((c.saturation ?? 100) + a.saturation, 0, 200);
                if (a.temp) c.temp = clamp((c.temp || 0) + a.temp, -100, 100);
                if (a.blurSet != null) c.blur = a.blurSet;
                if (a.vignetteSet != null) c.vignette = a.vignetteSet;
                if (a.grainSet != null) { if (a.grainSet && !isPremium()) { requirePremium('Film effects'); continue; } c.grain = a.grainSet; }
              }
            });
            done.push('Adjusted the colors'); break;
          }
          case 'bgBlur': await flush(); commit(() => { for (const c of many(a)) c.bgBlur = !!a.on; }); done.push(a.on ? 'Blurred background' : 'Background blur off'); break;
          case 'fit': await flush(); commit(() => { for (const c of (a.clipId === 'all' ? aibVisuals() : many(a))) if (c.kind === 'video' || c.kind === 'image') c.fit = a.fit; }); done.push(a.fit === 'cover' ? 'Filled the frame' : 'Showing the whole picture'); break;
          case 'chroma': {
            await flush();
            if (!requirePremium('Green screen')) break;
            commit(() => { for (const c of many(a)) { c.chroma = c.chroma || { on: false, color: '#00ff00', similarity: 0.4, smooth: 0.1 }; c.chroma.on = !!a.on; c.chroma.color = a.color || c.chroma.color; } });
            done.push('Green screen'); break;
          }
          case 'motion': await flush(); commit(() => { for (const c of many(a)) c.motion = a.motion; }); done.push('Motion: ' + a.motion); break;
          case 'zoomKey': await flush(); { const c = getClip(a.clipId); if (c) { aibZoomKey(c, +a.time, a.to, a.hold || 1.2, a.smooth !== false); done.push(`Zoom at ${aibFmt(+a.time)}`); } } break;
          case 'transform': {
            await flush();
            commit(() => {
              for (const c of many(a)) {
                if (c.kind === 'text') {
                  const t = c.text;
                  if (a.dx) t.x = clamp((t.x ?? 0.5) + a.dx, 0, 1); if (a.dy) t.y = clamp((t.y ?? 0.5) + a.dy, 0, 1);
                  if (a.x === 0 && a.y === 0) { t.x = 0.5; t.y = 0.5; }
                  if (a.scaleMul) t.size = Math.round((t.size || 96) * a.scaleMul); if (a.scale) t.size = Math.round(96 * a.scale);
                  continue;
                }
                if (a.rotateBy) c.rotation = ((c.rotation || 0) + a.rotateBy) % 360; if (a.rotation != null) c.rotation = a.rotation;
                if (a.toggleFlipH) c.flipH = !c.flipH; if (a.toggleFlipV) c.flipV = !c.flipV;
                if (a.scale) c.scale = clamp(a.scale, 0.05, 10); if (a.scaleMul) c.scale = clamp((c.scale || 1) * a.scaleMul, 0.05, 10);
                if (a.x != null) c.x = a.x; if (a.y != null) c.y = a.y;
                if (a.dx) c.x = clamp((c.x || 0) + a.dx, -1, 1); if (a.dy) c.y = clamp((c.y || 0) + a.dy, -1, 1);
                if (a.opacity != null) c.opacity = a.opacity;
              }
            });
            done.push('Changed ' + (many(a).length > 1 ? many(a).length + ' clips' : aibLabel(many(a)[0]))); break;
          }
          case 'duplicate': await flush(); { const c = getClip(a.clipId); if (!c) break; for (let i = 0; i < (a.times || 1); i++) { state.selectedId = i ? state.selectedId : c.id; duplicateSelected(); } done.push('Duplicated ' + aibLabel(c)); } break;
          case 'freeze': await flush(); { if (a.time != null) seek(+a.time); const v = P.clips.find((c) => c.kind === 'video' && state.time >= c.start && state.time < endOf(c)); if (v) { state.selectedId = v.id; requestDraw(); if (typeof playersReady === 'function') await playersReady(2500); const n = P.clips.length; await freezeFrame(); if (P.clips.length > n) done.push('Freeze frame at ' + aibFmt(state.time)); } } break;
          case 'detach': await flush(); for (const c of many(a)) if (c.kind === 'video' && !partners(c).length) detachAudio(c); done.push('Separated the sound'); break;
          case 'length': await flush(); { const c = getClip(a.clipId); if (c) { commit(() => setClipLength(c, a.length)); done.push(`${aibLabel(c)} is now ${aibFmt(a.length)}`); } } break;
          case 'move': rest.push(a); break;
          case 'background': await flush(); commit(() => { P.background = a.color; P.bgChosen = true; }); done.push('Background color changed'); break;
          default: rest.push(a);
        }
      } catch (e) { console.warn('AI action failed', a, e); }
    }
    await flush();
    if (typeof refreshAll === 'function') try { refreshAll(); } catch {}
    return done;
  };
}

/* ============================ local first ============================ */
// With your own Claude key Flux asks Claude. Without one, the brain above runs on this computer
// (fast, free, offline); only if it can't make sense of a request does Flux try the online helper.
sendAi = async function () {
  const p = aiPanelEl();
  const ta = $('textarea', p);
  const text = ta.value.trim();
  if (!text || ai.busy) return;
  ta.value = '';
  ai.messages.push({ role: 'user', content: text });
  ai.busy = true; renderAi();
  try {
    let plan = null, raw;
    if (settings.aiKey && api && api.aiChat) {
      const history = ai.messages.slice(-10).map((m) => ({ role: m.role, content: m.role === 'user' ? m.content : (m.raw || m.content) }));
      history[history.length - 1] = { role: 'user', content: `Project right now:\n${JSON.stringify(aiContext())}\n\nRequest: ${text}` };
      const r = await api.aiChat({ key: settings.aiKey, model: settings.aiModel || 'claude-sonnet-5-5', system: AI_SYSTEM, messages: history });
      if (!r.error) { raw = r.text; try { plan = JSON.parse(r.text.slice(r.text.indexOf('{'), r.text.lastIndexOf('}') + 1)); } catch { plan = { reply: r.text, actions: [] }; } }
    }
    if (!plan) plan = aibPlan(text);
    const before = hist.undo.length;
    ai.busy = false;
    const done = await runAiActions(plan.actions || []);
    ai.messages.push({ role: 'assistant', content: plan.reply || 'Done.', raw, done, undo: hist.undo.length - before });
  } catch (e) {
    ai.busy = false;
    ai.messages.push({ role: 'assistant', content: 'Sorry - ' + (e.message || e) });
  }
  renderAi();
};

// examples shown when the AI panel opens
AI_EXAMPLES.splice(0, AI_EXAMPLES.length, 'Cut the first 3 seconds and add a title “My Trip”', 'Crossfades between all clips', 'Add calm music and make it quieter', 'Add captions in the Fire style', 'Say “Welcome back” with Max', 'Zoom in at 0:05', 'Add a whoosh at every cut', 'Make it warmer and more cinematic', 'Robot voice on the voiceover', 'How do I add keyframes?');
