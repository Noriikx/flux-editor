/* Flux — Enhance: Studio sound, Improve quality, AI upscale and AI slow motion for the selected clip.
   The work happens in the background on this computer (see main.js "Enhance"). When it's done the clip
   simply switches to the improved copy, so Undo brings the original right back. */
'use strict';
const ENH = {
  voice: { title: 'Studio sound', icon: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/><path d="M19 3l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>',
    desc: 'Removes background noise, hum and echo, makes voices clearer and evens out the volume - like it was recorded in a studio.',
    levels: [['light', 'Light', 'Gentle clean-up'], ['medium', 'Clear', 'Best for most videos'], ['strong', 'Strong', 'Very noisy places']] },
  quality: { title: 'Improve quality', icon: '<path d="M12 3l2.4 5 5.6.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8l5.6-.8z"/>',
    desc: 'Cleans up grain and blocky compression, sharpens details and gives colors a little more life.',
    levels: [['light', 'Light', 'Subtle'], ['medium', 'Balanced', 'Best for most videos'], ['strong', 'Strong', 'Old or very grainy clips']] },
  upscale: { title: 'AI upscale', icon: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>',
    desc: 'Makes the video or photo bigger and sharper with AI - great for old, blurry or low-resolution clips.',
    levels: [[2, '2× bigger', 'Faster'], [4, '4× bigger', 'Most detail, slower']] },
  slowmo: { title: 'AI slow motion', icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    desc: 'AI creates the in-between frames, so the clip plays slower but stays perfectly smooth (no choppy repeated frames).',
    levels: [[2, '2× slower', '50% speed'], [4, '4× slower', '25% speed'], [8, '8× slower', '12.5% speed']] }
};
for (const k of Object.keys(ENH)) TOOL_ICONS['enh-' + k] = ENH[k].icon;

// what a clip can do
function enhTargets(c) {
  if (!c) return {};
  const vid = c.kind === 'video', img = c.kind === 'image';
  return { voice: !!soundSource(c) || vid, quality: vid, upscale: vid || img, slowmo: vid };
}

// the job card (bottom-right) - one job at a time
let enhBusy = null;
const ENH_STAGES = { download: 'Downloading the AI engine (once)', check: 'Checking the download', frames: 'Reading the frames', ai: 'AI is working', encode: 'Putting the video together', work: 'Working' };
function enhCard() {
  let card = $('#enhCard');
  if (!card) {
    card = el('div', 'enh-card');
    card.id = 'enhCard';
    card.innerHTML = '<div class="enh-ic"></div><div class="enh-body"><b></b><small></small><div class="enh-bar"><i></i></div></div><button class="icon-btn small enh-x" data-tip="Cancel"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button>';
    document.body.appendChild(card);
  }
  return card;
}
function enhShow(kind, text, v) {
  const card = enhCard();
  card.classList.add('show');
  $('.enh-ic', card).innerHTML = `<svg viewBox="0 0 24 24">${ENH[kind] ? ENH[kind].icon : ''}</svg>`;
  $('b', card).textContent = ENH[kind] ? ENH[kind].title : 'Working';
  $('small', card).textContent = text + (v != null ? ' · ' + Math.round(v * 100) + '%' : '');
  $('.enh-bar i', card).style.width = (v != null ? Math.round(v * 100) : 8) + '%';
  $('.enh-bar', card).classList.toggle('indet', v == null);
}
function enhHide() { const card = $('#enhCard'); if (card) card.classList.remove('show'); }
if (api && api.onEnhProgress) api.onEnhProgress((p) => {
  if (!enhBusy) return;
  if (p.install && p.install !== enhBusy.engine) return;
  if (p.id && p.id !== enhBusy.id) return;
  const label = ENH_STAGES[p.stage] || 'Working';
  enhShow(enhBusy.kind, label, p.stage === 'check' ? null : p.value);
});

function openEnhanceDialog(kind, c = getClip(state.selectedId)) {
  const E = ENH[kind];
  if (!c || !E) return;
  if (!api || !api.enhRun) return toast('This needs the Flux desktop app');
  if (enhBusy) return toast('Flux is already working on ' + ENH[enhBusy.kind].title.toLowerCase() + ' - wait for it to finish');
  if (!enhTargets(c)[kind]) return toast(kind === 'voice' ? 'Select a clip with sound' : 'Select a video clip');
  const isAI = kind === 'upscale' || kind === 'slowmo';
  const lvKey = 'flux.enh.' + kind;
  let level = E.levels[kind === 'voice' || kind === 'quality' ? 1 : 0][0];
  try { const s = localStorage.getItem(lvKey); if (s && E.levels.some((l) => String(l[0]) === s)) level = isNaN(+s) ? s : +s; } catch {}
  const len = dur(c) * c.speed;
  const box = modal(`<div class="enh-head"><span class="enh-badge"><svg viewBox="0 0 24 24">${E.icon}</svg></span><div><h2>${E.title}</h2><p class="sub">${E.desc}</p></div></div>
    <div class="row"><label>${kind === 'upscale' ? 'Size' : kind === 'slowmo' ? 'How slow' : 'Strength'}</label><div class="seg tall enh-levels"></div></div>
    <div class="enh-note"></div>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn primary" data-a="go">${kind === 'slowmo' ? 'Make it slow-mo' : kind === 'upscale' ? 'Upscale' : 'Improve'}</button></div>`);
  const seg = $('.enh-levels', box);
  for (const [v, name, sub] of E.levels) {
    const b = el('button', String(v) === String(level) ? 'active' : '');
    b.innerHTML = `${name}<small></small>`; $('small', b).textContent = sub;
    b.onclick = () => { level = v; $$('button', seg).forEach((x) => x.classList.toggle('active', x === b)); note(); };
    seg.appendChild(b);
  }
  const noteEl = $('.enh-note', box);
  let status = null;
  const note = () => {
    const parts = [];
    if (c.kind === 'image') parts.push('The photo is replaced by the bigger copy.');
    else parts.push(`Works on the part of the clip you're using (${fmt(len)}). The original file isn't changed - Undo (Ctrl+Z) brings it back.`);
    if (isAI && status) {
      const st = status[kind === 'upscale' ? 'upscale' : 'slowmo'];
      if (st && !st.ready && st.supported) parts.push(`<b>First time only:</b> Flux downloads the AI engine (${Math.round(st.size / 1e6)} MB) from GitHub. It runs on your graphics card.`);
      if (c.kind !== 'image') {
        const frames = Math.round(len * 30 * (kind === 'slowmo' ? level : 1));
        const slow = kind === 'upscale' ? (level === 4 ? 0.9 : 0.12) : 0.05; // rough seconds per frame on an average graphics card
        const est = frames * slow;
        if (est > 90) parts.push(`This can take ${est > 3600 ? 'over an hour' : '~' + Math.round(est / 60) + ' minutes'} for a clip this long. Tip: split out just the part you need first.`);
      }
    }
    if (kind === 'slowmo') parts.push('The clip gets longer, and its sound is muted (slow-motion sound is usually weird). You can unmute it any time.');
    noteEl.innerHTML = parts.map((p) => `<p>${p}</p>`).join('');
  };
  note();
  if (isAI && api.enhStatus) api.enhStatus().then((s) => { status = s; note(); });
  $('[data-a=no]', box).onclick = closeModal;
  $('[data-a=go]', box).onclick = () => {
    try { localStorage.setItem(lvKey, String(level)); } catch {}
    closeModal();
    runEnhanceJob(kind, c, level, status);
  };
}

async function runEnhanceJob(kind, c, level, status) {
  // the clip whose file gets processed
  let t = c;
  if (kind === 'voice') {
    if (c.kind === 'video' && !soundClipOf(c)) { detachAudio(c); }
    t = soundSource(c) || (c.kind === 'video' ? soundClipOf(c) : null);
    if (!t) return toast('This clip has no sound');
  }
  const m = getMedia(t.mediaId);
  if (!m || !m.path || m.missing) return toast('The file for this clip is missing');
  const id = 'e' + Date.now();
  const engine = kind === 'upscale' || kind === 'slowmo' ? kind : null;
  enhBusy = { id, kind, engine, clipId: c.id };
  enhShow(kind, 'Starting', 0);
  const card = enhCard();
  $('.enh-x', card).onclick = () => { if (enhBusy) { enhBusy.cancelled = true; api.enhCancel(enhBusy.id); } };
  try {
    // 1) the AI engine (downloaded once). If it can't be downloaded, the standard method is used.
    let standard = false;
    if (engine) {
      const st = status || (await api.enhStatus());
      if (st[engine] && st[engine].supported && !st[engine].ready) {
        enhShow(kind, ENH_STAGES.download, 0);
        const r = await api.enhInstall(engine);
        if (enhBusy.cancelled) throw new Error('cancelled');
        if (r.error) { standard = true; toast('Couldn’t download the AI engine (' + r.error + ') - using the standard method', { error: true }); }
      } else if (!st[engine] || !st[engine].supported) standard = true;
    }
    // 2) the work
    const isImg = c.kind === 'image';
    const job = { id, kind: isImg ? 'image-upscale' : kind, file: m.path, start: isImg ? 0 : t.in, len: isImg ? 0 : t.out - t.in, level, standard };
    if (kind === 'upscale') job.scale = level;
    if (kind === 'slowmo') job.factor = level;
    const r = await api.enhRun(job);
    if (r.error) throw new Error(r.error);
    if (enhBusy.cancelled) throw new Error('cancelled');
    // 3) use the new file
    enhShow(kind, 'Almost done', 1);
    const base = m.name.replace(/\.[^.]+$/, '');
    const nm = `${base} (${ENH[kind].title.toLowerCase()})` + (r.path.match(/\.[^.]+$/) || [''])[0];
    const [nmedia] = await importFiles([{ path: r.path, name: nm }]);
    if (!nmedia) throw new Error('Flux couldn’t open the result');
    const live = getClip(t.id), cv = getClip(c.id);
    if (!live || !cv) throw new Error('The clip was deleted while Flux was working');
    commit(() => {
      if (isImg) { cv.mediaId = nmedia.id; return; }
      live.mediaId = nmedia.id;
      live.in = 0; live.out = Math.min(nmedia.duration || r.len || (live.out - live.in), r.len || 1e9);
      if (kind === 'slowmo') {
        setSpeed(cv, cv.speed / level);
        const snd = soundClipOf(cv);
        if (snd) snd.muted = true; else cv.muted = true;
      }
    });
    if (kind === 'voice' && nmedia && !rt.peaks.has(nmedia.id)) loadPeaks(nmedia);
    const how = engine && !standard && r.ai === false ? ' (standard method - your graphics card couldn’t run the AI)' : '';
    toast(`${ENH[kind].title}: done${how}. Undo (Ctrl+Z) brings the original back.`, { duration: 6000 });
  } catch (err) {
    const msg = String(err && err.message || err);
    if (msg === 'cancelled') toast(ENH[kind].title + ' cancelled');
    else toast(ENH[kind].title + ' failed: ' + msg, { error: true, duration: 7000 });
  } finally {
    enhBusy = null;
    enhHide();
  }
}

// add the tools to the "Smart" clip tools and to the right-click menu
(function setupEnhanceTools() {
  const baseTools = clipTools;
  clipTools = function (c) {
    const list = baseTools(c), t = enhTargets(c);
    const mk = (k, label) => ({ id: 'enh-' + k, g: 'smart', label, tip: ENH[k].title + ' - ' + ENH[k].desc, on: !!t[k], fn: () => openEnhanceDialog(k, c) });
    list.push(mk('voice', 'Studio'), mk('quality', 'Enhance'), mk('upscale', 'Upscale'), mk('slowmo', 'Slow-mo'));
    return list;
  };
})();
