/* Flux — AI Editor "quick mode": understands common requests on this computer, no internet or key needed.
   Used when the online AI isn't available. Returns the same {reply, actions} plan the online AI gives. */
'use strict';
function parseSeconds(s) {
  if (!s) return null;
  s = String(s).trim().toLowerCase();
  let m = /^(\d+):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (m) return +m[1] * 60 + +m[2];
  m = /^(\d+(?:[.,]\d+)?)\s*(?:s|sec|secs|second|seconds|secunde|secunda)?$/.exec(s);
  if (m) return parseFloat(m[1].replace(',', '.'));
  m = /^(\d+(?:[.,]\d+)?)\s*(?:m|min|mins|minute|minutes|minut|minute)$/.exec(s);
  if (m) return parseFloat(m[1].replace(',', '.')) * 60;
  return null;
}
const NUM_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30 };
function localPlan(text) {
  const raw = String(text || '');
  let t = ' ' + raw.toLowerCase().replace(/[’']/g, "'") + ' ';
  for (const [w, n] of Object.entries(NUM_WORDS)) t = t.replace(new RegExp('\\b' + w + '\\b', 'g'), String(n));
  const actions = [], said = [];
  const sel = getClip(state.selectedId);
  const mainClip = sel && (sel.kind === 'video' || sel.kind === 'image') ? sel
    : P.clips.filter((c) => c.kind === 'video' || c.kind === 'image').sort((a, b) => a.start - b.start)[0] || null;
  const timeRe = '(\\d+:\\d{1,2}(?:\\.\\d+)?|\\d+(?:[.,]\\d+)?\\s*(?:s|sec|secs|seconds?|secunde|secunda|m|min|mins|minutes?)?)';
  const quoted = /["“”«»]([^"“”«»]+)["“”«»]/.exec(raw);

  // ---- text / titles ----
  const titleM = /\b(?:add|put|write|make|create|adauga|pune)\b[^.]*?\b(title|text|caption text|subtitle|heading|titlu|text)\b(?:\s+(?:that says|saying|with|:)?\s*)?([^.,!?]*)/.exec(t);
  if (titleM || quoted) {
    let words = quoted ? quoted[1] : (titleM && titleM[2] || '').replace(/\b(at|in|on|to|for)\b.*$/, '').trim();
    if (!words) words = 'Your Title';
    const atEnd = /\b(at|in) the end\b|\bla final\b/.test(t);
    const style = /\bsubtitle\b/.test(t) ? 'subtitle' : /\bneon\b/.test(t) ? 'neon' : /\bmeme\b/.test(t) ? 'meme' : /\blower third\b/.test(t) ? 'lowerThird' : 'title';
    const start = atEnd ? Math.max(0, projectDuration() - 3) : 0;
    actions.push({ type: 'addText', text: quoted ? quoted[1] : words.replace(/^./, (c) => c.toUpperCase()), start, duration: 3, style, position: /\bbottom\b/.test(t) ? 'bottom' : /\btop\b/.test(t) ? 'top' : 'middle' });
    said.push('add the text');
  }
  // ---- cut the first / last N seconds ----
  let m = new RegExp('\\b(?:cut|remove|delete|trim|taie|sterge)\\b[^.]*?\\b(first|last|primele|ultimele)\\s+' + timeRe).exec(t);
  if (m && mainClip) {
    const n = parseSeconds(m[2]) || 0;
    if (n > 0) {
      if (/first|primele/.test(m[1])) actions.push({ type: 'trim', clipId: mainClip.id, start: mainClip.start + n }, { type: 'move', clipId: mainClip.id, start: mainClip.start });
      else actions.push({ type: 'trim', clipId: mainClip.id, end: Math.max(mainClip.start + 0.2, endOf(mainClip) - n) });
      said.push(`cut the ${m[1]} ${n}s`);
    }
  }
  // ---- split at a time ----
  m = new RegExp('\\b(?:split|cut|taie)\\b[^.]*?\\bat\\s+' + timeRe).exec(t);
  if (m && !/\b(first|last)\b/.test(t)) { const s = parseSeconds(m[1]); if (s != null) { actions.push({ type: 'split', time: s }); said.push('split at ' + fmt(s)); } }
  // ---- transitions ----
  const allTrans = /\b(all|every|between|each|toate)\b/.test(t);
  if (/\b(transition|crossfade|cross fade|fade between|tranzit)/.test(t)) {
    let tr = 'fade';
    for (const x of TRANSITIONS.slice(1)) if (t.includes(' ' + x.name.toLowerCase()) || t.includes(' ' + x.id.toLowerCase() + ' ')) { tr = x.id; break; }
    actions.push({ type: 'transition', clipId: allTrans || !sel ? 'all' : sel.id, transition: tr });
    said.push('add ' + transById(tr).name.toLowerCase() + ' transitions');
  }
  // ---- fades ----
  if (/\bfade (in|out)\b/.test(t) && !/between/.test(t) && mainClip) {
    actions.push({ type: 'fade', clipId: mainClip.id, in: /fade in/.test(t) ? 1 : undefined, out: /fade out/.test(t) ? 1 : undefined });
    said.push('add fades');
  }
  // ---- music ----
  if (/\b(music|song|soundtrack|muzica|melodie)\b/.test(t) && /\b(add|put|play|need|want|some|background|adauga|pune)\b/.test(t)) {
    const moods = ['happy', 'calm', 'epic', 'dark', 'funny', 'action', 'romantic', 'mysterious', 'uplifting', 'relaxed'];
    const mood = moods.find((x) => t.includes(x)) || (/\bsad\b/.test(t) ? 'calm' : /\bchill\b/.test(t) ? 'relaxed' : 'happy');
    actions.push({ type: 'music', mood, start: 0 });
    said.push(mood + ' background music');
  }
  // ---- captions / silences / bleep / balance ----
  if (/\b(caption|captions|subtitles|subtitrari|subtitrare)\b/.test(t) && !titleM) { actions.push({ type: 'captions' }); said.push('captions'); }
  if (/\b(silen|pause|dead air|quiet parts|pauzele|liniste)/.test(t)) { actions.push({ type: 'removeSilences', clipId: (soundSource(mainClip) || {}).id }); said.push('remove the silences'); }
  if (/\b(bleep|beep|swear|curse|cuss|injur)/.test(t)) {
    const level = /\b(strict|all|every|high)\b/.test(t) ? 'high' : /\b(slur|low|only the worst)\b/.test(t) ? 'low' : 'moderate';
    actions.push({ type: 'bleep', level }); said.push('bleep swear words');
  }
  if (/\b(balance|normali[sz]e|even out|level the|same volume)\b/.test(t)) { actions.push({ type: 'autoBalance' }); said.push('balance the sound'); }
  // ---- shape ----
  if (/\b(vertical|tiktok|reels?|shorts|9:16|portrait)\b/.test(t)) { actions.push({ type: 'aspect', aspect: '9:16' }); said.push('make it vertical'); }
  else if (/\b(square|1:1)\b/.test(t)) { actions.push({ type: 'aspect', aspect: '1:1' }); said.push('make it square'); }
  else if (/\b(4:5|instagram post)\b/.test(t)) { actions.push({ type: 'aspect', aspect: '4:5' }); said.push('make it 4:5'); }
  else if (/\b(horizontal|youtube|16:9|landscape|widescreen)\b/.test(t)) { actions.push({ type: 'aspect', aspect: '16:9' }); said.push('make it 16:9'); }
  // ---- speed ----
  m = /\b(\d+(?:[.,]\d+)?)\s*x\b/.exec(t);
  let speed = m ? parseFloat(m[1].replace(',', '.')) : null;
  if (!speed && /\b(speed (it )?up|faster|fast forward|timelapse|time lapse)\b/.test(t)) speed = 2;
  if (!speed && /\b(slow ?mo|slow motion|slower|slow it down|slow down)\b/.test(t)) speed = 0.5;
  if (speed && (sel || mainClip)) { actions.push({ type: 'speed', clipId: (sel || mainClip).id, speed: clamp(speed, 0.1, 10) }); said.push(`speed ${speed}x`); }
  // ---- looks ----
  const looks = { 'black and white': 'bw', 'black & white': 'bw', 'b&w': 'bw', grayscale: 'bw', noir: 'noir', warm: 'warm', cool: 'cool', cold: 'cool', vintage: 'vintage', retro: 'vintage', faded: 'faded', dreamy: 'dreamy', drama: 'drama', dramatic: 'drama', vivid: 'vivid', colorful: 'vivid', pop: 'pop', sunset: 'sunset' };
  if (/\b(filter|look|color|colour|grade|make it|style)\b/.test(t)) {
    for (const [k, v] of Object.entries(looks)) if (t.includes(' ' + k)) { actions.push({ type: 'filter', clipId: 'all', filter: v }); said.push(k + ' look'); break; }
  }
  // ---- motion ----
  if (/\b(zoom in|ken burns)\b/.test(t) && mainClip) { actions.push({ type: 'motion', clipId: mainClip.id, motion: 'zoomIn' }); said.push('slow zoom in'); }
  else if (/\bzoom out\b/.test(t) && mainClip) { actions.push({ type: 'motion', clipId: mainClip.id, motion: 'zoomOut' }); said.push('slow zoom out'); }
  if (/\bshake\b/.test(t) && mainClip && !/camera shake transition/.test(t)) { actions.push({ type: 'motion', clipId: mainClip.id, motion: 'shake' }); said.push('shake'); }
  // ---- volume ----
  m = /\b(?:volume|louder|quieter)\b[^.]*?(\d+)\s*%/.exec(t);
  if (m && (sel || mainClip)) { actions.push({ type: 'volume', clipId: (sel || mainClip).id, volume: clamp(+m[1] / 100, 0, 3) }); said.push(`volume ${m[1]}%`); }
  else if (/\b(louder|turn (it )?up)\b/.test(t) && (sel || mainClip)) { actions.push({ type: 'volume', clipId: (sel || mainClip).id, volume: 1.5 }); said.push('make it louder'); }
  else if (/\b(quieter|turn (it )?down|lower the volume)\b/.test(t) && (sel || mainClip)) { actions.push({ type: 'volume', clipId: (sel || mainClip).id, volume: 0.5 }); said.push('make it quieter'); }
  // ---- marker ----
  m = new RegExp('\\bmarker\\b[^.]*?\\bat\\s+' + timeRe).exec(t);
  if (m) { const s = parseSeconds(m[1]); if (s != null) { actions.push({ type: 'marker', time: s }); said.push('marker at ' + fmt(s)); } }

  if (!actions.length) {
    return { reply: 'I didn’t catch that one. Try things like: “add a title “My Trip””, “crossfades between all clips”, “cut the first 3 seconds”, “add happy music”, “add captions”, “remove silences”, “make it vertical”, “speed 2x”, “warm look”.', actions: [] };
  }
  return { reply: 'Okay - I’ll ' + said.join(', ') + '.', actions };
}
