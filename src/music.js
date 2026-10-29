/* =====================================================================
   Flux — Music tab: free music you can use in videos.
   Sources: Kevin MacLeod / incompetech.com (CC BY 4.0, credit needed)
            "Free for YouTube": hand-checked CC0 / CC BY originals (freemusic.js)
            Sound effects made by Flux (sfx.js)
   ===================================================================== */
'use strict';

const music = {
  source: 'km',          // 'km' = Kevin MacLeod, 'free' = checked free music, 'sfx' = sound effects
  catalog: null,         // Kevin MacLeod track list
  query: '',
  mood: '',
  pdPage: 1,
  pdTotal: 0,
  pdItems: [],
  pdOpen: new Map(),     // archive item id -> tracks
  loading: false,
  playingUrl: null,
  error: null
};
let musicPreview = null;
const KM_MOODS = ['Happy', 'Calm', 'Epic', 'Dark', 'Funny', 'Action', 'Romantic', 'Mysterious', 'Bright', 'Relaxed', 'Suspense', 'Uplifting', 'Somber', 'Grooving'];

function parseLen(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const s = String(v);
  if (s.includes(':')) return s.split(':').reduce((a, x) => a * 60 + parseFloat(x || 0), 0);
  return parseFloat(s) || 0;
}
function licenseInfo(url = '') {
  const u = String(url).toLowerCase();
  if (u.includes('publicdomain/zero')) return { name: 'CC0', credit: false };
  if (u.includes('publicdomain')) return { name: 'Public domain', credit: false };
  if (u.includes('/by-sa/')) return { name: 'CC BY-SA', credit: true };
  if (u.includes('/by/')) return { name: 'CC BY', credit: true };
  return { name: 'Check license', credit: true };
}

function musicTabShown() {
  if (music.source === 'km' && !music.catalog && !music.loading) loadKM();
  else renderMusic();
}

async function loadKM() {
  music.loading = true; music.error = null; renderMusic();
  try {
    const raw = api && api.musicCatalog ? await api.musicCatalog() : await (await fetch('https://incompetech.com/music/royalty-free/pieces.json')).json();
    music.catalog = (raw || []).filter((p) => p && p.filename).map((p) => ({
      title: p.title,
      artist: 'Kevin MacLeod',
      url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/' + encodeURIComponent(p.filename),
      fileName: p.filename,
      length: parseLen(p.length),
      feel: String(p.feel || '').split(',').map((x) => x.trim()).filter(Boolean),
      instruments: p.instruments || '',
      bpm: p.bpm,
      description: p.description || '',
      license: 'CC BY 4.0',
      credit: `"${p.title}" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/`
    }));
  } catch (e) {
    console.warn(e);
    music.error = "Couldn't reach the music library. Check your internet connection and try again.";
  }
  music.loading = false;
  renderMusic();
}

// "Free for YouTube": a hand-checked list of CC0 / CC BY originals (see freemusic.js)
const FREE_CHIPS = ['No credit needed', 'Komiku', 'Monplaisir', 'Loyalty Freak Music', 'Audionautix', 'Rolemusic'];
let freeTracks = null;
function freeMusicList() {
  if (freeTracks) return freeTracks;
  freeTracks = (typeof FREE_MUSIC !== 'undefined' ? FREE_MUSIC : []).map(([title, artist, len, p, album, cc0, lic, licUrl, group]) => ({
    title, artist, length: len, album, group, cc0: !!cc0,
    url: 'https://archive.org/download/' + p,
    fileName: decodeURIComponent(p.split('/').pop()),
    license: cc0 ? 'CC0 · no credit' : lic,
    credit: cc0 ? '' : `"${title}" by ${artist} - ${group === 'Audionautix' ? 'audionautix.com' : 'archive.org/details/' + p.split('/')[0]}\nLicensed under ${lic}: ${licUrl}`
  }));
  return freeTracks;
}

function stopMusicPreview() {
  if (musicPreview) { musicPreview.pause(); }
  music.playingUrl = null;
  $$('.mrow.playing').forEach((r) => r.classList.remove('playing'));
}
async function previewTrack(t, row) {
  if (music.playingUrl === t.url) { stopMusicPreview(); return; }
  const src = t.sfx ? await sfxPreviewUrl(t) : t.url;
  if (state.playing) pause();
  if (!musicPreview) {
    musicPreview = new Audio();
    musicPreview.addEventListener('ended', stopMusicPreview);
    musicPreview.addEventListener('error', () => { toast("Couldn't play that song", { error: true }); stopMusicPreview(); });
    if (settings.outputDevice && settings.outputDevice !== 'default' && musicPreview.setSinkId) musicPreview.setSinkId(settings.outputDevice).catch(() => {});
  }
  musicPreview.src = src;
  musicPreview.volume = 0.8;
  musicPreview.play().catch(() => {});
  music.playingUrl = t.url;
  $$('.mrow.playing').forEach((r) => r.classList.remove('playing'));
  row.classList.add('playing');
}

const downloading = new Map();
async function downloadTrack(t) {
  if (downloading.has(t.url)) return downloading.get(t.url);
  const job = (async () => {
    if (t.sfx) return sfxImport(t);
    const name = (t.fileName || (t.title + '.mp3')).replace(/[\\/:*?"<>|]+/g, '_');
    const path = api && api.musicDownload ? await api.musicDownload({ url: t.url, name }) : t.url;
    if (!path) throw new Error('download failed');
    const [m] = await importFiles([{ path, name: t.title + '.mp3', kind: 'audio', duration: t.length, credit: t.credit, tag: 'music' }]);
    return m;
  })();
  downloading.set(t.url, job);
  try { return await job; } finally { downloading.delete(t.url); }
}
async function addTrackToTimeline(t, row, track, at) {
  if (!state.inEditor) return;
  row && row.classList.add('busy');
  try {
    const m = await downloadTrack(t);
    if (!m) throw new Error('import failed');
    const when = at != null ? at : state.time;
    const tr = track && track.type === 'audio' ? track : t.sfx ? sfxTrackAt(when, t.length || 1) : (P.tracks.find((x) => x.type === 'audio' && /music/i.test(x.name)) || firstTrack('audio'));
    addMediaAt(m, tr.id, when);
    renderCredits();
    if (t.sfx) { toast(`Added “${t.title}”`); row && row.classList.remove('busy'); return; }
    toast(t.credit && !/public domain|cc0/i.test(t.license) ? `Added “${t.title}” - remember to credit it (see Credits)` : `Added “${t.title}”`);
  } catch (e) {
    console.warn(e);
    toast(t.sfx ? "Couldn't make that sound effect." : "Couldn't download that song. Check your internet connection.", { error: true });
  }
  row && row.classList.remove('busy');
}
function dropMusicOnTimeline(t, track, at) { addTrackToTimeline(t, null, track, at); }

function trackRow(t) {
  const row = el('div', 'mrow' + (music.playingUrl === t.url ? ' playing' : ''));
  row.draggable = true;
  row.innerHTML = `
    <button class="mplay" data-tip="Listen"><svg viewBox="0 0 24 24" class="i-p"><path d="M7 4.5v15l13-7.5z"/></svg><svg viewBox="0 0 24 24" class="i-s"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button>
    <div class="minfo"><div class="mtitle"></div><div class="msub"></div></div>
    <span class="mlic"></span>
    <button class="madd" data-tip="Add at the playhead">${ICON.plus}</button>`;
  $('.mtitle', row).textContent = t.title;
  $('.msub', row).textContent = [t.artist, t.length ? fmt(t.length, false) : '', (t.feel || []).slice(0, 2).join(', ')].filter(Boolean).join(' · ');
  $('.mtitle', row).title = t.description || t.title;
  const lic = $('.mlic', row);
  lic.textContent = t.license;
  lic.classList.toggle('free', /public domain|cc0|no credit/i.test(t.license));
  lic.dataset.tip = /public domain|cc0|no credit/i.test(t.license) ? 'No credit needed' : 'Free to use - give credit in your video description';
  $('.mplay', row).onclick = () => previewTrack(t, row);
  $('.madd', row).onclick = () => addTrackToTimeline(t, row);
  row.addEventListener('dblclick', () => addTrackToTimeline(t, row));
  row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/flux-music', JSON.stringify(t)); e.dataTransfer.effectAllowed = 'copy'; });
  return row;
}

function renderMusic() {
  const page = $('[data-page=music]');
  if (!page) return;
  $$('#musicSource button').forEach((b) => b.classList.toggle('active', b.dataset.src === music.source));
  const chipsBox = $('#musicMoods');
  chipsBox.innerHTML = '';
  for (const m of music.source === 'km' ? KM_MOODS : music.source === 'sfx' ? SFX_CATS : FREE_CHIPS) {
    const b = el('button', 'chip' + (music.mood === m ? ' active' : ''));
    b.textContent = m;
    b.onclick = () => {
      music.mood = music.mood === m ? '' : m;
      renderMusic();
    };
    chipsBox.appendChild(b);
  }
  const list = $('#musicList');
  list.innerHTML = '';
  const status = $('#musicStatus');
  status.textContent = '';
  if (music.error && music.source === 'km') { status.textContent = music.error; const b = el('button', 'btn ghost', 'Try again'); b.onclick = () => loadKM(); status.appendChild(el('br')); status.appendChild(b); }

  if (music.source === 'sfx') {
    $('#musicNote').textContent = 'Made by Flux - free for anything, no credit needed. Click ▶ to listen, + or drag to add.';
    const q = music.query.toLowerCase();
    const items = SFX.filter((s) => (!music.mood || s.cat === music.mood) && (!q || (s.name + ' ' + s.cat).toLowerCase().includes(q)));
    if (!items.length) status.textContent = 'No sound effects match. Try another word.';
    const frag = document.createDocumentFragment();
    items.forEach((s) => { const r = trackRow(sfxTrack(s)); r.classList.add('sfx'); frag.appendChild(r); });
    list.appendChild(frag);
    $('#musicCount').textContent = `${items.length} of ${SFX.length} sounds`;
    return;
  }
  if (music.source === 'km') {
    $('#musicNote').textContent = 'Free to use with credit (CC BY 4.0). Flux keeps the credit text for you under Credits.';
    if (!music.catalog) { if (music.loading) status.textContent = 'Loading music…'; return; }
    const q = music.query.toLowerCase();
    const mood = music.mood.toLowerCase();
    let items = music.catalog.filter((t) =>
      (!q || (t.title + ' ' + t.instruments + ' ' + t.feel.join(' ') + ' ' + t.description).toLowerCase().includes(q)) &&
      (!mood || t.feel.some((f) => f.toLowerCase().includes(mood))));
    if (!items.length) status.textContent = 'No songs match. Try another word.';
    const frag = document.createDocumentFragment();
    items.slice(0, 300).forEach((t) => frag.appendChild(trackRow(t)));
    list.appendChild(frag);
    $('#musicCount').textContent = `${items.length} of ${music.catalog.length} songs`;
  } else {
    $('#musicNote').textContent = 'Checked for YouTube & TikTok: original music, CC0 (no credit) or CC BY (add the credit - Flux keeps it under Credits). Commercial use OK.';
    const q = music.query.toLowerCase(), mood = music.mood;
    const all = freeMusicList();
    const items = all.filter((t) => (!q || (t.title + ' ' + t.artist + ' ' + t.album).toLowerCase().includes(q))
      && (!mood || (mood === 'No credit needed' ? t.cc0 : t.group === mood)));
    if (!items.length) status.textContent = 'No songs match. Try another word.';
    const frag = document.createDocumentFragment();
    items.slice(0, 400).forEach((t) => { const r = trackRow(t); $('.msub', r).textContent = [t.artist, t.length ? fmt(t.length, false) : '', t.album].filter(Boolean).join(' · '); frag.appendChild(r); });
    list.appendChild(frag);
    $('#musicCount').textContent = `${items.length} of ${all.length} songs`;
  }
}

function projectCredits() {
  const used = new Set(P.clips.map((c) => c.mediaId));
  return P.media.filter((m) => m.credit && used.has(m.id)).map((m) => m.credit);
}
function renderCredits() {
  const b = $('#musicCredits');
  if (!b) return;
  const n = state.inEditor ? projectCredits().length : 0;
  b.textContent = n ? `Credits (${n})` : 'Credits';
}
function showCredits() {
  const list = projectCredits();
  const text = list.length ? list.join('\n\n') : '';
  const box = modal(`<h2>Music credits</h2>
    <p class="sub">${list.length ? 'Paste this into your video description so the musicians get credit.' : 'No music that needs credit is on your timeline yet.'}</p>
    ${list.length ? '<textarea class="text-input" style="min-height:180px" readonly></textarea>' : ''}
    <div class="footer"><button class="btn ghost" data-a="close">Close</button>${list.length ? '<button class="btn primary" data-a="copy">Copy</button>' : ''}</div>`);
  if (list.length) $('textarea', box).value = text;
  $('[data-a=close]', box).onclick = closeModal;
  const cp = $('[data-a=copy]', box);
  if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(text); toast('Credits copied'); } catch { $('textarea', box).select(); document.execCommand('copy'); toast('Credits copied'); } };
}

function setupMusic() {
  $$('#musicSource button').forEach((b) => (b.onclick = () => {
    music.source = b.dataset.src; music.mood = ''; music.query = ''; $('#musicSearch').value = '';
    stopMusicPreview();
    if (music.source === 'sfx') renderMusic();
    else if (music.source === 'km') { if (!music.catalog) loadKM(); else renderMusic(); }
    else renderMusic();
  }));
  let timer = null;
  $('#musicSearch').addEventListener('input', (e) => {
    music.query = e.target.value.trim();
    clearTimeout(timer);
    timer = setTimeout(renderMusic, music.source === 'free' ? 120 : 0);
  });
  $('#musicCredits').onclick = showCredits;
}
