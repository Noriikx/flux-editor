/* Flux 5.1 — Text to speech: type something, pick a voice, and Flux reads it out loud.
   Runs on this computer (Piper engine + LibriTTS voices, CC BY 4.0 - free to use in your videos).
   The voice lands on a sound track at the playhead, and Flux can add matching auto captions straight away. */
'use strict';
const TTS_VOICES = [
  { id: 681, name: 'Ava', desc: 'Warm', g: 'f' },
  { id: 723, name: 'Mia', desc: 'Friendly', g: 'f' },
  { id: 699, name: 'Zoe', desc: 'Bright', g: 'f' },
  { id: 195, name: 'Lily', desc: 'Lively', g: 'f' },
  { id: 450, name: 'Nora', desc: 'Clear', g: 'f' },
  { id: 204, name: 'Max', desc: 'Energetic', g: 'm' },
  { id: 3, name: 'Jack', desc: 'Clear', g: 'm' },
  { id: 117, name: 'Leo', desc: 'Warm', g: 'm' },
  { id: 501, name: 'Sam', desc: 'Calm', g: 'm' },
  { id: 342, name: 'Grant', desc: 'Deep narrator', g: 'm' }
];
const tts = { ready: null, installing: false, prog: 0, opts: { voice: 681, rate: 1, captions: true, capStyle: 'classic' }, text: '', audio: null, busy: false };
try { Object.assign(tts.opts, JSON.parse(localStorage.getItem('flux.ttsOpts') || '{}')); } catch {}
const saveTtsOpts = () => { try { localStorage.setItem('flux.ttsOpts', JSON.stringify(tts.opts)); } catch {} };
const ttsVoice = (id) => TTS_VOICES.find((v) => v.id === +id) || TTS_VOICES[0];

async function ttsCheck() {
  if (!api || !api.ttsStatus) { tts.ready = false; return tts; }
  try { const s = await api.ttsStatus(); tts.ready = !!s.ready; tts.supported = s.supported !== false; tts.size = s.size; } catch { tts.ready = false; }
  return tts;
}
async function ttsInstall() {
  if (tts.installing) return false;
  tts.installing = true; tts.prog = 0; renderTts();
  const r = await api.ttsInstall();
  tts.installing = false;
  if (r && r.error) { toast(r.error, { error: true, duration: 7000 }); renderTts(); return false; }
  tts.ready = true; renderTts();
  toast('Voices installed - they work offline from now on');
  return true;
}
// make the voice file (returns { path, words, duration })
async function ttsMake(text, voiceId, preview) {
  if (!tts.ready && !(await ttsInstall())) return null;
  const r = await api.ttsSpeak({ text, speaker: voiceId, rate: tts.opts.rate, preview: !!preview });
  if (!r || r.error) { toast((r && r.error) || 'The voice could not be made', { error: true }); return null; }
  return r;
}
async function ttsPreview(voiceId, btn) {
  if (tts.audio) { tts.audio.pause(); tts.audio = null; }
  const v = ttsVoice(voiceId);
  const sample = (tts.text || '').trim().slice(0, 140) || `Hi, I'm ${v.name}. This is how I sound in Flux.`;
  if (btn) btn.classList.add('busy');
  const r = await ttsMake(sample, v.id, true);
  if (btn) btn.classList.remove('busy');
  if (!r) return;
  const u = mediaUrl({ path: r.path });
  tts.audio = new Audio(u + (u.includes('?') ? '&' : '?') + 'v=' + Date.now());
  tts.audio.play().catch(() => {});
}
// put a voice on the timeline (and captions for it)
async function ttsAddToTimeline(text, at, opts = {}) {
  text = String(text || '').trim();
  if (!text) { toast('Type what the voice should say first'); return null; }
  if (tts.busy) return null;
  tts.busy = true; renderTts();
  try {
    const v = ttsVoice(opts.voice || tts.opts.voice);
    const r = await ttsMake(text, v.id, false);
    if (!r) return null;
    const name = r.path.split(/[\\/]/).pop();
    const [m] = await importFiles([{ path: r.path, name, kind: 'audio', duration: r.duration, tag: 'voice' }]);
    if (!m) { toast("Couldn't load the voice", { error: true }); return null; }
    const d = m.duration || r.duration || 1;
    const start = at != null ? at : state.time;
    const freeAt = (x) => Math.abs(findFreeStart(x.id, start, d) - start) < 1e-6;
    const auds = P.tracks.filter((x) => x.type === 'audio');
    let tr = auds.find((x) => x.id !== 'av' && freeAt(x) && P.clips.some((c) => c.trackId === x.id && clipRole(c) === 'voice'))
      || auds.find((x) => x.id !== 'av' && freeAt(x) && !P.clips.some((c) => c.trackId === x.id))
      || auds.find((x) => x.id !== 'av' && freeAt(x));
    if (!tr) tr = addTrack('audio');
    addMediaAt(m, tr.id, start);
    const clip = P.clips.filter((c) => c.mediaId === m.id).sort((a, b) => b.start - a.start)[0];
    const wantCaps = opts.captions != null ? opts.captions : tts.opts.captions;
    if (clip && wantCaps && r.words && r.words.length) {
      const st = CAPTION_STYLES.find((s) => s.id === (opts.capStyle || tts.opts.capStyle)) || CAPTION_STYLES[0];
      if (!st.pro || isPremium()) capOpts.style = st.id;
      const caps = buildCaptions(clip, r.words);
      commit(() => {
        const ct = captionTrack();
        for (const c of caps) { c.trackId = ct.id; P.clips.push(c); }
      });
      if (typeof ensureProjectFonts === 'function') ensureProjectFonts();
    }
    toast(`${v.name} is on the “${tr.name}” track${wantCaps ? ' with captions' : ''}`);
    return clip;
  } finally { tts.busy = false; renderTts(); }
}
// a text clip on the timeline -> read it out loud at the same time
async function ttsReadTextClip(c) {
  if (!c || c.kind !== 'text') return;
  return ttsAddToTimeline(c.text.content, c.start, { captions: false });
}

/* ---------- the panel in the Voice tab ---------- */
function renderTts() {
  const box = $('#ttsPanel');
  if (!box) return;
  if (tts.ready === null) { ttsCheck().then(renderTts); return; }
  if (tts.supported === false) { box.innerHTML = '<p class="hint">Text to speech isn’t available on this computer yet.</p>'; return; }
  if (!tts.ready) {
    box.innerHTML = `<div class="tts-setup"><div class="tts-setup-ico"><svg viewBox="0 0 24 24"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></div>
      <b>Natural AI voices</b><p>10 voices that read your text out loud. They run on your computer, work offline and are free to use in your videos.</p>
      <button class="btn primary" id="ttsInstallBtn">${tts.installing ? 'Downloading…' : 'Get the voices'}</button>
      <div class="tts-bar"${tts.installing ? '' : ' hidden'}><i style="width:${Math.round(tts.prog * 100)}%"></i></div>
      <small>One-time download, about ${Math.round((tts.size || 143e6) / 1e6)} MB</small></div>`;
    $('#ttsInstallBtn', box).disabled = tts.installing;
    $('#ttsInstallBtn', box).onclick = ttsInstall;
    return;
  }
  const sel = getClip(state.selectedId);
  const fromText = sel && sel.kind === 'text' && !sel.caption;
  box.innerHTML = `<textarea id="ttsText" class="tts-text" rows="5" placeholder="Type what the voice should say…"></textarea>
    <div class="tts-row"><span class="tts-count"></span>${fromText ? '<button class="btn ghost small" id="ttsUseText">Use the selected text</button>' : ''}</div>
    <div class="help-title">Voice</div><div class="tts-voices"></div>
    <div class="field"><label>Speed</label><input type="range" id="ttsRate" min="0.7" max="1.4" step="0.05"><span class="val" id="ttsRateVal"></span></div>
    <label class="v-opt"><input type="checkbox" id="ttsCaps"><span>Add auto captions too</span></label>
    <div class="v-field" id="ttsCapRow"><label>Caption style</label><select id="ttsCapStyle" class="dev-select"></select></div>
    <button class="btn primary tts-go" id="ttsGo">${tts.busy ? 'Making the voice…' : 'Add voice at the playhead'}</button>
    <p class="hint">Voices: LibriTTS (CC BY 4.0) via Piper - free to use in your videos.</p>`;
  const ta = $('#ttsText', box);
  ta.value = tts.text;
  const count = () => { $('.tts-count', box).textContent = ta.value.trim() ? `${ta.value.trim().split(/\s+/).length} words · about ${Math.max(1, Math.round(ta.value.trim().split(/\s+/).length / 2.6 / tts.opts.rate))}s` : ''; };
  ta.oninput = () => { tts.text = ta.value; count(); };
  count();
  if (fromText) $('#ttsUseText', box).onclick = () => { ta.value = tts.text = sel.text.content; count(); };
  const grid = $('.tts-voices', box);
  for (const v of TTS_VOICES) {
    const b = el('div', 'tts-voice' + (v.id === tts.opts.voice ? ' active' : ''));
    b.innerHTML = `<span class="tts-av ${v.g}">${v.name[0]}</span><span class="tts-vn"><b></b><small></small></span><button class="tts-play" data-tip="Hear ${v.name}"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></button>`;
    $('b', b).textContent = v.name; $('small', b).textContent = v.desc; b.dataset.tip = `${v.name} - ${v.desc.toLowerCase()} ${v.g === 'f' ? 'female' : 'male'} voice`;
    b.onclick = (e) => { if (e.target.closest('.tts-play')) return; tts.opts.voice = v.id; saveTtsOpts(); renderTts(); };
    $('.tts-play', b).onclick = (e) => { e.stopPropagation(); ttsPreview(v.id, e.currentTarget); };
    grid.appendChild(b);
  }
  const rate = $('#ttsRate', box), rv = $('#ttsRateVal', box);
  rate.value = tts.opts.rate; rv.textContent = (+tts.opts.rate).toFixed(2) + 'x'; setRangeFill(rate);
  rate.oninput = () => { tts.opts.rate = +rate.value; rv.textContent = (+rate.value).toFixed(2) + 'x'; setRangeFill(rate); count(); };
  rate.onchange = saveTtsOpts;
  const caps = $('#ttsCaps', box), cs = $('#ttsCapStyle', box);
  caps.checked = tts.opts.captions;
  for (const st of CAPTION_STYLES) { const o = el('option'); o.value = st.id; o.textContent = st.name + (st.pro && !isPremium() ? ' (Premium)' : ''); o.disabled = !!(st.pro && !isPremium()); cs.appendChild(o); }
  cs.value = tts.opts.capStyle;
  $('#ttsCapRow', box).style.display = caps.checked ? '' : 'none';
  caps.onchange = () => { tts.opts.captions = caps.checked; saveTtsOpts(); $('#ttsCapRow', box).style.display = caps.checked ? '' : 'none'; };
  cs.onchange = () => { tts.opts.capStyle = cs.value; saveTtsOpts(); };
  const go = $('#ttsGo', box);
  go.disabled = tts.busy;
  go.onclick = () => ttsAddToTimeline(ta.value);
}
(function setupTts() {
  const page = document.querySelector('[data-page=voice]');
  if (!page || $('#ttsPanel')) return;
  const sw = el('div', 'seg v-switch', '<button data-m="rec" class="active">Record</button><button data-m="tts">Text to speech</button>');
  page.insertBefore(sw, page.firstChild);
  const panel = el('div', 'tts-panel'); panel.id = 'ttsPanel';
  page.appendChild(panel);
  const setMode = (m) => {
    page.classList.toggle('tts-mode', m === 'tts');
    sw.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.m === m));
    try { localStorage.setItem('flux.voiceMode', m); } catch {}
    if (m === 'tts') { if (!state.recording) closeMic(); renderTts(); }
    else if (currentLibTab === 'voice' && !voice.stream) openMic();
  };
  sw.onclick = (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); };
  let mode = 'rec'; try { mode = localStorage.getItem('flux.voiceMode') || 'rec'; } catch {}
  if (mode === 'tts') { page.classList.add('tts-mode'); sw.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.m === 'tts')); }
  // don't open the microphone while the text-to-speech side is showing
  const baseShown = voiceTabShown;
  voiceTabShown = async function () { if (page.classList.contains('tts-mode')) { renderVoice(); renderTts(); return; } return baseShown.apply(this, arguments); };
  if (api && api.onTtsProgress) api.onTtsProgress((v) => { tts.prog = v.value || 0; const bar = $('#ttsPanel .tts-bar i'); if (bar) bar.style.width = Math.round(tts.prog * 100) + '%'; const b = $('#ttsInstallBtn'); if (b) b.textContent = v.stage === 'check' ? 'Installing…' : `Downloading… ${Math.round(tts.prog * 100)}%`; });
  // keep "Use the selected text" in step with the selection
  const baseInsp = renderInspector;
  renderInspector = function () { const r = baseInsp.apply(this, arguments); if (currentLibTab === 'voice' && page.classList.contains('tts-mode') && !$('#ttsText:focus')) renderTts(); return r; };
})();
