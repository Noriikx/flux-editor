'use strict';
/* Flux 1.7.5: copy & paste clips and effects between projects, and the Subtitle Translation Workspace. */

/* ============================ copy / paste between projects ============================ */
// The clipboard is kept on this computer (not just in the open project), so you can copy in one project,
// open another one and paste there. The pictures, videos and sounds the clips use come along too.
const CLIP_KEY = 'flux.clipboard2', FX_KEY = 'flux.fxClipboard';
// what counts as "the clip" (not its effects) when copying effects from one clip to another
const FX_SKIP = new Set(['id', 'trackId', 'mediaId', 'kind', 'start', 'in', 'out', 'text', 'linkId', 'caption', 'captionOf', 'compound', 'comp', 'name', 'label', 'groupId', 'adjustment', 'subtitle', 'lang']);
const readJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
function copySelMulti() {
  const clips = selectedClips();
  if (!clips.length) return;
  const t0 = Math.min(...clips.map((c) => c.start));
  const media = [];
  for (const c of clips) { const m = c.mediaId && getMedia(c.mediaId); if (m && !media.some((x) => x.id === m.id)) media.push({ id: m.id, path: m.path, name: m.name, kind: m.kind, duration: m.duration, width: m.width, height: m.height, credit: m.credit }); }
  // which of its kind each track is (the 2nd sound track, the 1st media track…), so pasting lands on similar tracks
  const trackInfo = {};
  for (const c of clips) { const tr = getTrack(c.trackId); if (!tr) continue; const same = P.tracks.filter((t) => t.type === tr.type); trackInfo[c.trackId] = { type: tr.type, n: same.indexOf(tr) }; }
  const data = { v: 2, from: P.id, fromName: P.name, at: Date.now(), clips: JSON.parse(JSON.stringify(clips)).map((c) => ({ ...c, _off: c.start - t0 })), media, trackInfo };
  clipboard = data.clips[0];
  try { localStorage.setItem(CLIP_KEY, JSON.stringify(data)); } catch { toast('That’s too much to copy at once', { error: true }); return; }
  toast(clips.length > 1 ? `Copied ${clips.length} clips - paste them here or in any other project` : 'Copied - paste it here or in any other project');
}
async function pasteMulti() {
  const data = readJson(CLIP_KEY);
  if (!data || !data.clips || !data.clips.length) { if (clipboard) return pasteOld(); return toast('Nothing copied yet'); }
  if (!P) return;
  // bring in the media the clips use (if this project doesn't have it yet)
  const mediaMap = {}, missing = [];
  for (const m of data.media || []) {
    const have = P.media.find((x) => x.path === m.path);
    if (have) mediaMap[m.id] = have.id; else missing.push(m);
  }
  if (missing.length) {
    const added = await importFiles(missing.map((m) => ({ path: m.path, name: m.name, kind: m.kind, duration: m.duration })));
    for (const m of missing) { const a = (added || []).find((x) => x.path === m.path) || P.media.find((x) => x.path === m.path); if (a) mediaMap[m.id] = a.id; }
  }
  const sameProject = data.from === P.id;
  const at = state.time;
  const newLink = new Map(), ids = [];
  commit(() => {
    for (const src of data.clips) {
      const c = JSON.parse(JSON.stringify(src)); const off = c._off || 0; delete c._off;
      c.id = uid();
      if (c.mediaId) { if (!mediaMap[c.mediaId] && !sameProject) continue; c.mediaId = mediaMap[c.mediaId] || c.mediaId; }
      if (c.linkId) { if (!newLink.has(c.linkId)) newLink.set(c.linkId, uid()); c.linkId = newLink.get(c.linkId); }
      // a track like the one it came from
      let tr = sameProject && getTrack(c.trackId);
      if (!tr) {
        const info = (data.trackInfo || {})[src.trackId], type = (info && info.type) || trackTypeFor(c.kind);
        const same = P.tracks.filter((t) => t.type === type);
        tr = same[Math.min(info ? info.n : 0, same.length - 1)] || firstTrack(trackTypeFor(c.kind));
      }
      c.trackId = tr.id;
      c.start = findFreeStart(c.trackId, at + off, dur(c), c.id);
      P.clips.push(c); ids.push(c.id);
    }
    state.selectedId = ids[0] || null; state.multi = new Set(ids.slice(1));
  });
  if (!ids.length) return toast('Those clips’ files couldn’t be found', { error: true });
  toast(sameProject ? `Pasted ${ids.length} clip${ids.length > 1 ? 's' : ''}` : `Pasted ${ids.length} clip${ids.length > 1 ? 's' : ''} from “${data.fromName || 'another project'}”`);
}
const pasteOld = paste;
copySel = copySelMulti;
paste = pasteMulti;
// effects: everything about how a clip looks and sounds, without the clip itself
function copyEffects() {
  const c = getClip(state.selectedId); if (!c) return toast('Select a clip first');
  const fx = {}; for (const [k, v] of Object.entries(c)) if (!FX_SKIP.has(k)) fx[k] = JSON.parse(JSON.stringify(v));
  try { localStorage.setItem(FX_KEY, JSON.stringify({ kind: c.kind, fx, at: Date.now() })); } catch {}
  toast('Copied the effects - select clips (in any project) and paste them');
}
function pasteEffects() {
  const data = readJson(FX_KEY); if (!data) return toast('Copy a clip’s effects first');
  const clips = selectedClips(); if (!clips.length) return toast('Select the clips to paste the effects onto');
  const visual = (k) => k === 'video' || k === 'image' || k === 'text' || k === 'adjust' || k === 'compound';
  commit(() => {
    for (const c of clips) {
      for (const [k, v] of Object.entries(data.fx)) {
        if (k === 'speed' && c.kind === 'image') continue;
        // sound settings only go to clips with sound, picture settings only to clips you can see
        if (c.kind === 'audio' && visual(data.kind) && !/^(volume|muted|fade|audio|afx|eq|speed|pitch)/i.test(k)) continue;
        if (c.kind !== 'audio' && data.kind === 'audio' && !/^(volume|muted|fade|audio|afx|eq|pitch)/i.test(k)) continue;
        c[k] = JSON.parse(JSON.stringify(v));
      }
    }
  });
  toast(`Pasted the effects onto ${clips.length} clip${clips.length > 1 ? 's' : ''}`);
}
// right-click menu on clips: add Copy effects / Paste effects
const _contextMenu74 = contextMenu;
contextMenu = function (x, y, items, parent) {
  if (!parent && Array.isArray(items) && items.some((it) => it && /^(Copy|Copy clip)$/i.test(it.label || '')) && getClip(state.selectedId)) {
    const i = items.findIndex((it) => it && /^(Paste|Copy)$/i.test(it.label || ''));
    const extra = [{ label: 'Copy effects', fn: copyEffects }, { label: 'Paste effects', fn: pasteEffects, disabled: !localStorage.getItem(FX_KEY) }];
    items = items.slice(); items.splice(i < 0 ? items.length : i + 1, 0, ...extra);
  }
  if (!parent && Array.isArray(items)) items = items.map((it) => (it && it.label === 'Paste' ? { ...it, fn: () => paste(), disabled: !localStorage.getItem(CLIP_KEY) && !clipboard } : it));
  return _contextMenu74.call(this, x, y, items, parent);
};
// keyboard: Ctrl+Alt+C / Ctrl+Alt+V copy and paste effects
addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey) || !e.altKey || e.target.matches('input, textarea, select, [contenteditable]')) return;
  if (document.body.classList.contains('at-home') || !P) return;
  const k = e.key.toLowerCase();
  if (k === 'c') { e.preventDefault(); copyEffects(); }
  else if (k === 'v') { e.preventDefault(); pasteEffects(); }
}, true);

/* ============================ Subtitle Translation Workspace ============================ */
// Each language is its own captions track ("Captions · Español"). One language shows in the video at a time,
// and every language can be saved as a subtitle file (.srt / .vtt) to upload to YouTube, TikTok and others.
const SUB_LANGS = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', it: 'Italiano', pt: 'Português', ro: 'Română', ru: 'Русский', uk: 'Українська',
  nl: 'Nederlands', sv: 'Svenska', da: 'Dansk', fi: 'Suomi', cs: 'Čeština', hu: 'Magyar', ar: 'العربية', hi: 'हिन्दी', id: 'Bahasa Indonesia', vi: 'Tiếng Việt', zh: '中文', ja: '日本語',
  ko: '한국어', pl: 'Polski', tr: 'Türkçe', th: 'ไทย' };
const SUB_TARGETS = ['es', 'fr', 'de', 'it', 'pt', 'ro', 'ru', 'uk', 'nl', 'sv', 'da', 'fi', 'cs', 'hu', 'ar', 'hi', 'id', 'vi', 'zh', 'ja', 'en'];
const subOriginals = () => P.clips.filter((c) => c.caption && !c.subLang).sort((a, b) => a.start - b.start);
const subTrack = (code) => P.tracks.find((t) => t.subLang === code);
const subClips = (code) => P.clips.filter((c) => c.subLang === code);
const subLangs = () => P.tracks.filter((t) => t.subLang).map((t) => t.subLang);
function subSpreadWords(text, dur) {
  const ws = String(text).split(/\s+/).filter(Boolean); const tot = ws.reduce((a, w) => a + w.length + 1, 0) || 1; let t = 0;
  return ws.map((w) => { const d = (dur * (w.length + 1)) / tot; const o = { w, t0: t, t1: t + d }; t += d; return o; });
}
// keep each translation lined up with its original caption (after you move or trim the originals)
function subSync(code) {
  const orig = new Map(P.clips.filter((c) => c.caption && !c.subLang).map((c) => [c.id, c]));
  for (const c of subClips(code)) {
    const o = orig.get(c.trOf);
    if (!o) { c._orphan = true; continue; }
    if (c.start !== o.start || c.out - c.in !== o.out - o.in) { c.start = o.start; c.in = 0; c.out = o.out - o.in; c.text.words = subSpreadWords(c.text.content, c.out); }
  }
  P.clips = P.clips.filter((c) => !c._orphan);
}
function subShow(code) {
  // only one language in the video at a time
  const capTr = P.tracks.find((t) => t.type !== 'audio' && t.name === 'Captions');
  if (capTr) capTr.hidden = code !== 'orig';
  for (const t of P.tracks) if (t.subLang) t.hidden = t.subLang !== code;
}
function subAddLang(code) {
  const capTr = P.tracks.find((t) => t.type !== 'audio' && t.name === 'Captions');
  const tr = { id: 'sub' + uid().slice(0, 5), type: 'video', name: 'Captions · ' + SUB_LANGS[code], subLang: code, auto: false, hidden: true, muted: false };
  const i = capTr ? P.tracks.indexOf(capTr) : 0;
  P.tracks.splice(i, 0, tr);
  for (const o of subOriginals()) {
    const c = JSON.parse(JSON.stringify(o));
    c.id = uid(); c.trackId = tr.id; c.subLang = code; c.trOf = o.id; c.caption = true;
    c.text.content = ''; c.text.words = [];
    P.clips.push(c);
  }
  return tr;
}
function srtTime(t) { t = Math.max(0, t); const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60), ms = Math.round((t % 1) * 1000); const p = (n, k = 2) => String(n).padStart(k, '0'); return `${p(h)}:${p(m)}:${p(s)},${p(Math.min(999, ms), 3)}`; }
function subSrt(clips) { return clips.filter((c) => c.text && String(c.text.content).trim()).sort((a, b) => a.start - b.start).map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(endOf(c))}\n${String(c.text.content).trim()}\n`).join('\n'); }

let subUi = { lang: null, from: 'en' };
try { subUi.from = localStorage.getItem('flux.subFrom') || 'en'; } catch {}
function openSubtitleWorkspace() {
  if (!P) return;
  if (!subOriginals().length) {
    const box = modal(`<h2>Subtitle translations</h2><p class="sub">First make captions for your video (Captions in the AI tab, or right-click a clip → Auto captions). Then come back here to translate them into other languages.</p><div class="footer"><button class="btn primary" data-a="close">OK</button></div>`);
    $('[data-a=close]', box).onclick = closeModal; return;
  }
  for (const code of subLangs()) subSync(code);
  if (!subUi.lang || (subUi.lang !== 'orig' && !subTrack(subUi.lang))) subUi.lang = subLangs()[0] || 'orig';
  const box = modal(`<div class="stw">
    <div class="stw-side">
      <h2>Subtitles</h2>
      <label class="stw-from"><span>Your captions are in</span><select data-a="from">${Object.entries(SUB_LANGS).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
      <div class="stw-langs"></div>
      <div class="stw-add"><select data-a="addsel"><option value="">+ Add a language…</option>${SUB_TARGETS.map((k) => `<option value="${k}">${SUB_LANGS[k]}</option>`).join('')}</select></div>
      <p class="hint">Translations run on your computer (Opus-MT by Helsinki-NLP). The first time you use a language, Flux downloads it once (about 100 MB).</p>
    </div>
    <div class="stw-main"><div class="stw-head"></div><div class="stw-rows"></div><div class="stw-foot"></div></div></div>`, { wide: true });
  box.classList.add('stw-modal');
  const from = $('[data-a=from]', box); from.value = subUi.from;
  from.onchange = () => { subUi.from = from.value; try { localStorage.setItem('flux.subFrom', from.value); } catch {} draw(); };
  $('[data-a=addsel]', box).onchange = (e) => {
    const code = e.target.value; e.target.value = '';
    if (!code) return;
    if (code === subUi.from) return toast('Your captions are already in ' + SUB_LANGS[code]);
    if (subTrack(code)) { subUi.lang = code; return draw(); }
    commit(() => { subAddLang(code); });
    subUi.lang = code; draw(); bump('subLangs');
    translateAll(code, false);
  };
  const draw = () => {
    const langs = subLangs();
    const visible = (code) => (code === 'orig' ? !(P.tracks.find((t) => t.name === 'Captions') || {}).hidden : subTrack(code) && !subTrack(code).hidden);
    $('.stw-langs', box).innerHTML = [['orig', SUB_LANGS[subUi.from] + ' (original)'], ...langs.map((k) => [k, SUB_LANGS[k] || k])].map(([k, n]) => {
      const done = k === 'orig' ? subOriginals().length : subClips(k).filter((c) => String(c.text.content).trim()).length;
      return `<button class="stw-lang${subUi.lang === k ? ' on' : ''}" data-k="${k}"><b>${esc72(n)}</b><small>${k === 'orig' ? done + ' lines' : done + ' / ' + subOriginals().length + ' translated'}${visible(k) ? ' · <i>in the video</i>' : ''}</small></button>`;
    }).join('');
    $$('.stw-lang', box).forEach((b) => (b.onclick = () => { subUi.lang = b.dataset.k; draw(); }));
    const k = subUi.lang, orig = subOriginals(), byOrig = new Map(subClips(k).map((c) => [c.trOf, c]));
    $('.stw-head', box).innerHTML = k === 'orig'
      ? `<b>${SUB_LANGS[subUi.from]} (original)</b><span>Edit the words here - translations keep their own text.</span>`
      : `<b>${SUB_LANGS[k]}</b><span>Click any line to fix the translation.</span>`;
    const rows = $('.stw-rows', box); rows.innerHTML = '';
    for (const o of orig) {
      const c = k === 'orig' ? o : byOrig.get(o.id);
      const r = el('div', 'stw-row');
      r.innerHTML = `<button class="stw-t" data-tip="Jump here">${fmtShort(o.start)}</button><div class="stw-o">${k === 'orig' ? '' : esc72(o.text.content)}</div><textarea rows="1" spellcheck="${k === 'orig'}"></textarea>`;
      const ta = $('textarea', r); ta.value = c ? c.text.content : '';
      if (k === 'orig') r.classList.add('orig');
      ta.placeholder = k === 'orig' ? '' : 'Not translated yet';
      $('.stw-t', r).onclick = () => seek(o.start + 0.01);
      ta.onfocus = () => { seek(o.start + 0.01); beginEdit(); };
      ta.oninput = () => { if (!c) return; c.text.content = ta.value; c.text.words = k === 'orig' ? subSpreadWords(ta.value, c.out - c.in) : subSpreadWords(ta.value, c.out - c.in); requestDraw(); };
      ta.onblur = () => { endEdit(); };
      rows.appendChild(r);
    }
    const foot = $('.stw-foot', box);
    foot.innerHTML = k === 'orig'
      ? `<button class="btn${visible('orig') ? ' primary' : ''}" data-a="show">${visible('orig') ? '✓ Shown in the video' : 'Show in the video'}</button><span class="sp"></span><button class="btn" data-a="srt">Save as subtitle file</button>`
      : `<button class="btn${visible(k) ? ' primary' : ''}" data-a="show">${visible(k) ? '✓ Shown in the video' : 'Show in the video'}</button><button class="btn" data-a="tr">Translate empty lines</button><button class="btn ghost" data-a="retr">Translate everything again</button><span class="sp"></span><button class="btn" data-a="srt">Save as subtitle file</button><button class="btn ghost danger" data-a="del">Remove ${SUB_LANGS[k]}</button>`;
    $('[data-a=show]', foot).onclick = () => { commit(() => subShow(k)); draw(); };
    $('[data-a=srt]', foot).onclick = async () => {
      const clips = k === 'orig' ? subOriginals() : subClips(k);
      if (!clips.some((c) => String(c.text.content).trim())) return toast('There’s nothing to save yet');
      const p = await api.saveSubtitles({ name: `${P.name} (${k === 'orig' ? SUB_LANGS[subUi.from] : SUB_LANGS[k]})`, text: subSrt(clips) });
      if (p) toast('Subtitles saved - upload them to YouTube or TikTok as captions');
    };
    const tr = $('[data-a=tr]', foot); if (tr) tr.onclick = () => translateAll(k, false);
    const re = $('[data-a=retr]', foot); if (re) re.onclick = () => translateAll(k, true);
    const del = $('[data-a=del]', foot); if (del) del.onclick = () => {
      if (!confirm(`Remove the ${SUB_LANGS[k]} subtitles?`)) return;
      commit(() => { const t = subTrack(k); P.clips = P.clips.filter((c) => c.subLang !== k); P.tracks = P.tracks.filter((x) => x !== t); if (!P.tracks.some((x) => x.subLang && !x.hidden)) subShow('orig'); });
      subUi.lang = subLangs()[0] || 'orig'; draw();
    };
  };
  let busy = false;
  async function translateAll(code, all) {
    if (busy) return;
    const orig = subOriginals(), byOrig = new Map(subClips(code).map((c) => [c.trOf, c]));
    const todo = orig.filter((o) => byOrig.get(o.id) && (all || !String(byOrig.get(o.id).text.content).trim()));
    if (!todo.length) return toast('Everything is translated already');
    busy = true;
    progressModal(`Translating into ${SUB_LANGS[code]}`);
    const onP = (v) => {
      const t = $('#pmText'), b = $('#pmBar'); if (!t) return;
      const step = v.steps > 1 ? ` (step ${v.step} of ${v.steps}, through English)` : '';
      t.textContent = (v.stage === 'download' ? 'Getting the translator - only the first time' : v.stage === 'model' ? 'Starting the translator' : 'Translating') + step + (v.value ? ' ' + Math.round(v.value * 100) + '%' : '…');
      if (v.value) { b.classList.remove('indet'); b.style.width = Math.round(v.value * 100) + '%'; } else b.classList.add('indet');
    };
    translateProgressFn = onP;
    let r;
    try { r = await (window.__fluxTranslate || api.translate)({ texts: todo.map((o) => o.text.content.replace(/\s+/g, ' ')), from: subUi.from, to: code }); }
    finally { busy = false; translateProgressFn = null; closeModal(); }
    if (!r || r.error) { toast((r && r.error) || 'Translation didn’t work', { error: true, duration: 7000 }); openSubtitleWorkspace(); return; }
    commit(() => {
      todo.forEach((o, i) => { const c = byOrig.get(o.id); if (!c) return; c.text.content = (r.texts[i] || '').trim(); c.text.words = subSpreadWords(c.text.content, c.out - c.in); });
      subShow(code);
    });
    bump('translations');
    toast(`Translated ${todo.length} lines into ${SUB_LANGS[code]} - it’s showing in the video now`);
    openSubtitleWorkspace();
  }
  draw();
}
let translateProgressFn = null;
if (typeof api !== 'undefined' && api && api.onTranslateProgress) api.onTranslateProgress((v) => translateProgressFn && translateProgressFn(v));
(function addSubsButton() {
  const at = $('#btnMixer') || $('#btnRecTl'); if (!at) return;
  const b = el('button', 'tool-btn'); b.id = 'btnSubs'; b.dataset.tip = 'Subtitle translations - translate your captions into other languages';
  b.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 5h7M7.5 3v2M9.5 5c-.6 3-2.7 5.6-5.5 7M6 9c1 1.5 2.6 2.8 4.5 3.5"/><path d="M12.5 20l3.5-9 3.5 9M13.8 17h4.4"/></svg>Translate';
  b.onclick = openSubtitleWorkspace;
  at.after(b);
})();
