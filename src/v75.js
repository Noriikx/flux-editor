/* Flux 1.7.5 — Flux Collaboration: edit one project together.
   The owner shares a project and adds editors (username, email or friends). Everyone's changes are sent to the
   Flux server every second or two and merged in; the top bar shows who's in the project right now.
   Videos, pictures and music are NOT uploaded: each person uses their own copy of the files. */

const esc75 = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CO_KEYS = ['name', 'tracks', 'aspect', 'background', 'markers', 'output', 'folders'];
const CO_SNAP_KEYS = ['tracks', 'aspect', 'background', 'markers', 'output']; // the parts undo remembers
const CO = { cid: null, owner: false, base: null, cursor: '', seen: new Set(), timer: null, busy: false, presence: [], editors: 1, offline: false, members: [], invites: [], quick: null };
const coTok = () => settings.account && settings.account.token;
const coColor = (uid) => { let h = 0; for (const ch of String(uid || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return `hsl(${h % 360} 85% 62%)`; };

// what is shared about a file: never its place on your computer (that can include your name)
function coMediaOut(m) {
  const { id, name, kind, duration, width, height, credit, tag, hasAudio, words, wordsKey, folder } = m;
  return JSON.parse(JSON.stringify({ id, path: '', name, kind, duration, width, height, credit, tag, hasAudio, words, wordsKey, folder }));
}
function coDocNow() {
  return { name: P.name, tracks: P.tracks, aspect: P.aspect, background: P.background, markers: P.markers || [], output: P.output, folders: P.folders || [], clips: P.clips, media: P.media.map(coMediaOut) };
}
// a fingerprint of the project, piece by piece, so only what changed is sent
function coFp(doc) {
  const k = {}; for (const key of CO_KEYS) k[key] = JSON.stringify(doc[key] === undefined ? null : doc[key]);
  const clips = new Map(), media = new Map();
  for (const c of doc.clips || []) clips.set(c.id, JSON.stringify(c));
  for (const m of doc.media || []) media.set(m.id, JSON.stringify(m));
  return { k, clips, media };
}
function coDiff(a, b) {
  const ops = [];
  for (const key of CO_KEYS) if (a.k[key] !== b.k[key]) ops.push(['k', key, JSON.parse(b.k[key])]);
  for (const kind of ['media', 'clips']) {
    for (const [id, j] of b[kind]) if (a[kind].get(id) !== j) ops.push(['u', kind, JSON.parse(j)]);
    for (const id of a[kind].keys()) if (!b[kind].has(id)) ops.push(['d', kind, id]);
  }
  return ops;
}
// the same merge rules the server uses (for undo history and the fingerprint)
function coApplyPlain(doc, ops, keys = CO_KEYS) {
  for (const [t, a, b] of ops) {
    if (t === 'k') { if (keys.includes(a)) doc[a] = JSON.parse(JSON.stringify(b)); continue; }
    if (!(a in doc) && a === 'media') continue;
    const arr = doc[a] || (doc[a] = []), id = t === 'u' ? b.id : b, i = arr.findIndex((x) => x.id === id);
    if (t === 'd') { if (i >= 0) arr.splice(i, 1); } else if (i >= 0) arr[i] = JSON.parse(JSON.stringify(b)); else arr.push(JSON.parse(JSON.stringify(b)));
  }
  return doc;
}

/* ---------------- applying someone else's changes ---------------- */
function coApplyRemote(ops) {
  let aspect = false, mediaChanged = false, nameChanged = false;
  const touched = { k: new Set(), clips: new Set(), media: new Set() };
  for (const [t, a, b] of ops) {
    if (t === 'k') {
      if (!CO_KEYS.includes(a)) continue;
      touched.k.add(a);
      if (a === 'aspect' && b !== P.aspect) aspect = true;
      if (a === 'name') nameChanged = true;
      P[a] = JSON.parse(JSON.stringify(b));
      if (a === 'output' && P.output) FPS = P.output.fps || 30;
    } else if (a === 'clips') {
      const id = t === 'u' ? b.id : b; touched.clips.add(id);
      const i = P.clips.findIndex((c) => c.id === id);
      if (t === 'd') {
        if (i >= 0) { P.clips.splice(i, 1); destroyPlayer(id); }
        if (state.selectedId === id) state.selectedId = null;
        state.multi.delete(id);
      } else if (i >= 0) {
        const c = P.clips[i];
        if (c.mediaId !== b.mediaId || c.kind !== b.kind) destroyPlayer(id);
        for (const key of Object.keys(c)) delete c[key];
        Object.assign(c, JSON.parse(JSON.stringify(b)));
      } else P.clips.push(JSON.parse(JSON.stringify(b)));
    } else if (a === 'media') {
      const id = t === 'u' ? b.id : b; touched.media.add(id); mediaChanged = true;
      const i = P.media.findIndex((m) => m.id === id);
      if (t === 'd') { if (i >= 0) P.media.splice(i, 1); }
      else if (i >= 0) { const m = P.media[i]; const { path, missing } = m; Object.assign(m, JSON.parse(JSON.stringify(b)), { path, missing }); }
      else P.media.push(Object.assign(JSON.parse(JSON.stringify(b)), { path: '', missing: true }));
    }
  }
  // keep undo working: what others did stays when you undo your own changes
  const fix = (s) => { try { return JSON.stringify(coApplyPlain(JSON.parse(s), ops, CO_SNAP_KEYS)); } catch { return s; } };
  hist.undo = hist.undo.map(fix); hist.redo = hist.redo.map(fix);
  if (pendingSnap) pendingSnap = fix(pendingSnap);
  // the fingerprint now matches for everything that came in (your own unsent changes stay different, so they still go out)
  const now = coFp(coDocNow());
  for (const key of touched.k) CO.base.k[key] = now.k[key];
  for (const kind of ['clips', 'media']) for (const id of touched[kind]) { if (now[kind].has(id)) CO.base[kind].set(id, now[kind].get(id)); else CO.base[kind].delete(id); }
  if (aspect) { layoutStage(); const s = $('#aspectSelect'); if (s) s.value = P.aspect; }
  if (nameChanged) { const n = $('#projectName'); if (n && document.activeElement !== n) n.value = P.name; }
  if (mediaChanged) renderMedia();
  refreshAll();
  coQuietSave();
}
// save to this computer without counting it as a new change to send
let coSaveTimer = null;
function coQuietSave() { clearTimeout(coSaveTimer); coSaveTimer = setTimeout(() => { if (state.inEditor && CO.cid) saveNow(); }, 900); }

/* ---------------- the heartbeat ---------------- */
function coSchedule(ms) {
  clearTimeout(CO.timer);
  if (!CO.cid) return;
  const others = CO.presence.some((p) => !p.me);
  CO.timer = setTimeout(coTick, ms != null ? ms : document.hidden ? 15000 : others ? 1500 : 4000);
}
async function coTick() {
  if (!CO.cid || !state.inEditor) return;
  if (CO.busy) return coSchedule(500);
  if (pendingSnap || state.exporting || !CO.base) return coSchedule(700); // wait until you let go of the mouse
  CO.busy = true;
  const cid = CO.cid, now = coFp(coDocNow()), ops = coDiff(CO.base, now);
  const r = await apiCall('collab/sync', { cid, cursor: CO.cursor, ops, time: Math.round(state.time * 100) / 100, sel: state.selectedId || null }, coTok());
  CO.busy = false;
  if (cid !== CO.cid) return;
  if (r.error || r.offline) {
    CO.offline = true; coRenderBar();
    if (ops.length) { P.collab.unsent = true; }
    return coSchedule(r.status === 429 ? 30000 : 6000);
  }
  if (r.gone) return coGone();
  CO.offline = false;
  if (P.collab.unsent) { P.collab.unsent = false; }
  // what was sent is now shared (anything newer is still different from the base)
  for (const [t, a, b] of ops) {
    if (t === 'k') CO.base.k[a] = now.k[a];
    else { const id = t === 'u' ? b.id : b; if (t === 'u') CO.base[a].set(id, now[a].get(id)); else CO.base[a].delete(id); }
  }
  if (r.mine) CO.seen.add(r.mine);
  const fresh = (r.ops || []).filter((o) => !CO.seen.has(o.k));
  for (const o of fresh) CO.seen.add(o.k);
  if (CO.seen.size > 600) CO.seen = new Set(Array.from(CO.seen).slice(-300));
  CO.cursor = r.cursor || CO.cursor;
  if (fresh.length) coApplyRemote(fresh.flatMap((o) => o.ops));
  CO.presence = r.presence || []; CO.editors = r.editors || 1; CO.owner = !!r.owner;
  coRenderBar(); coMarkTimeline();
  coSchedule();
}
// send what's left right away (before leaving the project)
async function coFlush() {
  if (!CO.cid || !CO.base) return;
  for (let i = 0; i < 20 && CO.busy; i++) await new Promise((r) => setTimeout(r, 150));
  if (coDiff(CO.base, coFp(coDocNow())).length) await coTick();
}
function coStop() {
  clearTimeout(CO.timer);
  Object.assign(CO, { cid: null, base: null, cursor: '', seen: new Set(), presence: [], busy: false, offline: false });
  coRenderBar(); coMarkTimeline();
}
function coGone() {
  const name = P.name;
  coStop();
  if (P.collab) { delete P.collab; saveNow(); }
  coRenderBar();
  toast(`“${name}” isn’t shared with you any more. What you have is now your own copy.`, { duration: 7000 });
}

/* ---------------- opening a shared project ---------------- */
async function coStart() {
  coStop();
  if (!P.collab || !P.collab.cid) return coRenderBar();
  if (!coTok()) { coRenderBar(); return toast('Sign in to edit this shared project together', { action: 'Sign in', onAction: openAccount }); }
  CO.cid = P.collab.cid; CO.owner = !!P.collab.owner;
  coRenderBar();
  const r = await apiCall('collab/open', { cid: CO.cid }, coTok());
  if (CO.cid !== P.collab?.cid) return;
  if (r.status === 403 || r.status === 404) return coGone();
  if (r.error) { CO.offline = true; coRenderBar(); CO.timer = setTimeout(coStart, 8000); return; }
  if (P.collab.unsent) {
    // you changed it while offline: keep that version as your own copy, then load everyone's latest
    const copy = JSON.parse(JSON.stringify(serializeProject()));
    copy.id = uid() + uid(); copy.name = P.name + ' (my offline changes)'; delete copy.collab; copy.updatedAt = Date.now();
    await projectStore.save(copy.id, copy, null);
    toast('You changed this project while offline. Those changes were saved as “' + copy.name + '”.', { duration: 8000 });
  }
  coAdopt(r.doc || {});
  CO.base = coFp(coDocNow());
  CO.cursor = r.cursor || ''; CO.seen = new Set(r.seen || []);
  CO.members = r.members || []; CO.invites = r.invites || []; CO.owner = !!r.owner;
  P.collab.owner = CO.owner; P.collab.unsent = false;
  coQuietSave();
  coTick();
}
// load the shared version, keeping where the files are on this computer
function coAdopt(doc) {
  const local = new Map(P.media.map((m) => [m.id, m]));
  for (const key of CO_KEYS) if (doc[key] !== undefined) P[key] = doc[key];
  P.clips = Array.isArray(doc.clips) ? doc.clips : [];
  P.media = (doc.media || []).map((m) => { const l = local.get(m.id); return l ? Object.assign(m, { path: l.path, missing: l.missing }) : Object.assign(m, { path: '', missing: true }); });
  if (!Array.isArray(P.tracks) || !P.tracks.length) P.tracks = defaultTracks();
  P.markers = P.markers || []; P.output = P.output || { res: 1080, fps: 30 }; FPS = P.output.fps || 30;
  for (const id of Array.from(rt.players.keys())) if (!P.clips.some((c) => c.id === id)) destroyPlayer(id);
  hist.undo = []; hist.redo = []; hist.when = []; updateUndoButtons();
  $('#projectName').value = P.name; $('#aspectSelect').value = P.aspect;
  layoutStage(); renderMedia(); refreshAll();
  const missing = P.media.filter((m) => m.missing).length;
  if (missing) toast(`${missing} file${missing === 1 ? '' : 's'} in this shared project ${missing === 1 ? 'isn’t' : 'aren’t'} on your computer yet. Click ${missing === 1 ? 'it' : 'them'} in the library to pick your copy.`, { duration: 7000 });
}

// open a project someone shared with you (makes a copy on this computer the first time)
async function coOpenShared(cid) {
  if (state.inEditor) { await coFlush(); await saveNow(); }
  const have = await projectStore.load(cid).catch(() => null);
  if (have && have.collab) return openProjectById(cid);
  toast('Opening shared project…');
  const r = await apiCall('collab/open', { cid }, coTok());
  if (r.error) return toast(r.error, { error: true });
  const data = Object.assign(newProject(), JSON.parse(JSON.stringify(r.doc || {})), { id: cid, name: r.name || (r.doc && r.doc.name) || 'Shared project', collab: { cid, owner: !!r.owner } });
  data.media = (data.media || []).map((m) => Object.assign(m, { path: '' }));
  data.createdAt = data.updatedAt = Date.now();
  await projectStore.save(cid, data, null);
  return openProjectById(cid);
}

/* ---------------- hooks into the editor ---------------- */
const _serialize75 = serializeProject;
serializeProject = function () { const d = _serialize75.apply(this, arguments); if (P.collab) d.collab = { cid: P.collab.cid, owner: !!P.collab.owner, unsent: !!P.collab.unsent }; return d; };
const _load75 = loadProjectData;
loadProjectData = async function (data) {
  if (CO.cid) { await coFlush(); coStop(); }
  const r = await _load75.apply(this, arguments);
  P.collab = data && data.collab && data.collab.cid ? JSON.parse(JSON.stringify(data.collab)) : null;
  coRenderBar();
  if (P.collab) coStart();
  return r;
};
const _goHome75 = goHome;
goHome = async function () { if (CO.cid) { await coFlush(); coStop(); } return _goHome75.apply(this, arguments); };
const _markDirty75 = markDirty;
markDirty = function () { const r = _markDirty75.apply(this, arguments); if (CO.cid && !CO.busy) { clearTimeout(CO.timer); CO.timer = setTimeout(coTick, 350); } return r; };
const _updatePlayhead75 = updatePlayhead;
updatePlayhead = function () { const r = _updatePlayhead75.apply(this, arguments); coPlaceHeads(); return r; };
const _renderTimeline75 = renderTimeline;
renderTimeline = function () { const r = _renderTimeline75.apply(this, arguments); coMarkTimeline(); return r; };
document.addEventListener('visibilitychange', () => { if (CO.cid && !document.hidden) coSchedule(200); });
addEventListener('online', () => { if (CO.cid) coSchedule(300); });

/* ---------------- who's here (top bar + timeline) ---------------- */
function coRenderBar() {
  let bar = $('#coBar');
  if (!bar) {
    const at = $('#btnAI'); if (!at) return;
    bar = el('div', 'co-bar'); bar.id = 'coBar';
    at.before(bar);
  }
  const live = CO.cid ? CO.presence.slice().sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0)) : [];
  const shared = !!(P.collab && P.collab.cid);
  const others = live.filter((p) => !p.me).length;
  let html = '';
  if (shared && live.length) {
    const shown = live.slice(0, 4), more = live.length - shown.length;
    html += `<div class="co-stack">${shown.map((p) => `<button class="co-av${p.me ? ' me' : ''}" data-uid="${esc75(p.uid)}" style="--cc:${coColor(p.uid)}" data-tip="${esc75(p.me ? 'You' : p.username + ' · at ' + fmt(p.time || 0, false) + ' · click to jump there')}">${avatarHtml(p, 26)}</button>`).join('')}${more > 0 ? `<span class="co-more">+${more}</span>` : ''}</div>`;
    html += `<span class="co-count${others ? ' live' : ''}" data-tip="${others ? 'People editing this project right now' : 'Only you right now'}"><i></i>${live.length}<span class="co-lbl"> editing</span></span>`;
  } else if (shared && CO.offline) html += '<span class="co-count off" data-tip="Can’t reach Flux - your changes are kept and sent when you’re back online"><i></i>Offline</span>';
  html += `<button class="btn ghost co-share${shared ? ' on' : ''}" data-tip="${shared ? 'Shared project - manage who can edit' : 'Share - edit this project together with others'}"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><path d="M18 8v6M15 11h6"/></svg><span class="co-lbl">${shared ? 'Shared' : 'Share'}</span></button>`;
  bar.innerHTML = html;
  $('.co-share', bar).onclick = openShareDialog;
  $$('.co-av', bar).forEach((b) => (b.onclick = () => { const p = CO.presence.find((x) => x.uid === b.dataset.uid); if (p && !p.me) { seek(p.time || 0); const c = p.sel && getClip(p.sel); if (c) { /* show what they're working on */ } } }));
}
function coPlaceHeads() {
  const ph = $('#playhead'); if (!ph || !ph.parentElement) return;
  const host = ph.parentElement;
  const want = CO.cid ? CO.presence.filter((p) => !p.me) : [];
  $$('.co-ph', host).forEach((n) => { if (!want.some((p) => p.uid === n.dataset.uid)) n.remove(); });
  for (const p of want) {
    let n = $(`.co-ph[data-uid="${p.uid}"]`, host);
    if (!n) { n = el('div', 'co-ph'); n.dataset.uid = p.uid; n.innerHTML = '<span></span>'; host.appendChild(n); }
    n.style.setProperty('--cc', coColor(p.uid));
    n.firstChild.textContent = p.username;
    n.style.transform = `translateX(${(p.time || 0) * state.zoom}px)`;
  }
}
function coMarkTimeline() {
  $$('.clip.co-sel').forEach((c) => { c.classList.remove('co-sel'); c.style.removeProperty('--co'); c.removeAttribute('data-co'); });
  if (CO.cid) for (const p of CO.presence) {
    if (p.me || !p.sel) continue;
    const c = $(`.clip[data-id="${CSS.escape(p.sel)}"]`);
    if (c) { c.classList.add('co-sel'); c.style.setProperty('--co', coColor(p.uid)); c.dataset.co = p.username; }
  }
  coPlaceHeads();
}

/* ---------------- the Share window ---------------- */
async function openShareDialog() {
  if (!coTok()) {
    const box = modal(`<div class="co-dlg"><div class="co-hero"><div class="co-hero-ic"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.5 0 4.4 1.6 5 4.8"/></svg></div><div><h2>Edit together</h2><p class="sub">Sign in to your Flux account to share this project with friends and edit it at the same time.</p></div></div>
      <div class="footer"><button class="btn ghost" data-a="no">Not now</button><button class="btn primary" data-a="in">Sign in</button></div></div>`);
    $('[data-a=no]', box).onclick = closeModal; $('[data-a=in]', box).onclick = () => { closeModal(); openAccount(); };
    return;
  }
  if (!settings.account.username) return toast('Pick a username first (Account) so people know who you are');
  if (!P.collab) return shareStartDialog();
  const box = modal(`<div class="co-dlg"><div class="co-hero"><div class="co-hero-ic"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.5 0 4.4 1.6 5 4.8"/></svg></div><div><h2>Share “<span class="n"></span>”</h2><p class="sub co-sub">Loading…</p></div></div>
    <div class="co-add" hidden><input class="co-in" placeholder="Add by username or email" spellcheck="false" maxlength="120"><button class="btn primary" data-a="add">Invite</button></div>
    <div class="co-err" hidden></div>
    <div class="co-sec"><h4>People</h4><div class="co-people"></div></div>
    <div class="co-sec co-fsec" hidden><h4>Your friends</h4><div class="co-friends"></div></div>
    <p class="co-note"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/></svg>Videos, photos and music aren’t uploaded. Everyone uses their own copy of the files - Flux asks them to pick any they don’t have.</p>
    <div class="footer"><button class="btn ghost danger-text" data-a="stop"></button><span style="flex:1"></span><button class="btn primary" data-a="done">Done</button></div></div>`, { wide: false });
  $('.n', box).textContent = P.name;
  $('[data-a=done]', box).onclick = closeModal;
  const err = (m) => { const e = $('.co-err', box); e.hidden = !m; e.textContent = m || ''; };
  let friends = null;
  const draw = () => {
    const owner = CO.owner;
    $('.co-sub', box).textContent = owner ? `Up to 10 people can edit with you. Changes show up for everyone in a second or two.` : `You’re editing with ${CO.members.length - 1} other${CO.members.length - 1 === 1 ? '' : 's'}. Only the owner can add or remove people.`;
    $('.co-add', box).hidden = !owner;
    const live = new Set(CO.presence.map((p) => p.uid));
    $('.co-people', box).innerHTML = CO.members.map((m) => `<div class="co-row"><span class="co-rav" style="--cc:${coColor(m.uid)}">${avatarHtml(m, 34)}${live.has(m.uid) ? '<i class="co-dot" data-tip="Here now"></i>' : ''}</span><div class="co-rname"><b>${esc75(m.username)}${m.uid === settings.account.uid ? ' <span class="co-you">(you)</span>' : ''}</b><small>${m.owner ? 'Owner' : 'Can edit'}</small></div>${owner && !m.owner ? `<button class="btn ghost small" data-rm="${esc75(m.uid)}">Remove</button>` : ''}</div>`).join('')
      + CO.invites.map((m) => `<div class="co-row pending"><span class="co-rav">${m.hidden ? '<span class="fx-av" style="--s:34px">@</span>' : avatarHtml(m, 34)}</span><div class="co-rname"><b>${m.hidden ? 'Invited by email' : esc75(m.username)}</b><small>Invite sent - waiting for them to accept</small></div>${owner ? `<button class="btn ghost small" data-rm="${esc75(m.uid)}">Cancel</button>` : ''}</div>`).join('');
    $$('[data-rm]', box).forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      const r = await apiCall('collab/members', { cid: CO.cid, remove: b.dataset.rm }, coTok());
      if (r.error) { b.disabled = false; return err(r.error); }
      CO.members = r.members; CO.invites = r.invites; draw();
    }));
    if (friends && owner) {
      const taken = new Set([...CO.members.map((m) => m.uid), ...CO.invites.map((m) => m.uid)]);
      const list = friends.filter((f) => !taken.has(f.uid));
      $('.co-fsec', box).hidden = !friends.length;
      $('.co-friends', box).innerHTML = list.length ? list.map((f) => `<button class="co-fr" data-uid="${esc75(f.uid)}">${avatarHtml(f, 28)}<span>${esc75(f.username)}</span><b>+ Add</b></button>`).join('') : '<p class="co-empty">All your friends are already in this project.</p>';
      $$('.co-fr', box).forEach((b) => (b.onclick = () => invite({ uid: b.dataset.uid }, b)));
    } else $('.co-fsec', box).hidden = true;
  };
  const invite = async (what, btn) => {
    err('');
    if (btn) btn.disabled = true;
    const r = await apiCall('collab/members', Object.assign({ cid: CO.cid }, what), coTok());
    if (btn) btn.disabled = false;
    if (r.error) return err(r.error);
    CO.members = r.members; CO.invites = r.invites; draw();
    if (what.add && what.add.includes('@')) toast('If they have a Flux account, they’ll see your invite on their home screen');
    else toast('Invite sent - they’ll see it on their home screen');
    const i = $('.co-in', box); if (i) i.value = '';
  };
  $('[data-a=add]', box).onclick = () => { const v = $('.co-in', box).value.trim(); if (v) invite({ add: v }, $('[data-a=add]', box)); };
  $('.co-in', box).onkeydown = (e) => { if (e.key === 'Enter') $('[data-a=add]', box).click(); };
  const stop = $('[data-a=stop]', box);
  const setStop = () => { stop.textContent = CO.owner ? 'Stop sharing' : 'Leave project'; };
  setStop();
  stop.onclick = () => coConfirmStop();
  draw();
  if (CO.cid) {
    const r = await apiCall('collab/members?cid=' + encodeURIComponent(CO.cid), null, coTok());
    if (r.status === 403) { closeModal(); return coGone(); }
    if (!r.error) { CO.members = r.members; CO.invites = r.invites; }
  }
  setStop(); draw();
  if (CO.owner) {
    const s = await apiCall('social', null, coTok());
    friends = s.error ? [] : s.friends || [];
    if (box.isConnected) draw();
  }
}
function shareStartDialog() {
  const box = modal(`<div class="co-dlg"><div class="co-hero"><div class="co-hero-ic"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.5 0 4.4 1.6 5 4.8"/></svg></div><div><h2>Edit together</h2><p class="sub">Share this project and edit it with friends at the same time. You'll see who's in it and where they are on the timeline.</p></div></div>
    <ul class="co-points"><li><b>You stay the owner.</b> Add people by username, email or from your friends, and remove them any time.</li><li><b>Changes sync on their own</b> every second or two. Undo only undoes your own changes.</li><li><b>Your files stay on your computer.</b> Only the edit is shared (clips, text, effects) - friends use their own copy of the videos.</li></ul>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn primary" data-a="go">Start sharing</button></div></div>`);
  $('[data-a=no]', box).onclick = closeModal;
  $('[data-a=go]', box).onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = 'Sharing…';
    const cid = /^[a-z0-9]{6,40}$/i.test(P.id) ? P.id : uid() + uid();
    const r = await apiCall('collab/share', { cid, name: P.name, doc: coDocNow() }, coTok());
    if (r.error) { e.target.disabled = false; e.target.textContent = 'Start sharing'; return toast(r.error, { error: true }); }
    P.collab = { cid, owner: true };
    CO.members = r.members; CO.invites = r.invites;
    await saveNow();
    closeModal();
    await coStart();
    openShareDialog();
  };
}
function coConfirmStop() {
  const owner = CO.owner;
  const box = modal(`<h2>${owner ? 'Stop sharing' : 'Leave'} “<span class="n"></span>”?</h2>
    <p class="sub">${owner ? 'Nobody else will be able to edit it. Everyone keeps the copy they have now.' : 'You won’t get new changes any more. You keep your own copy of the project as it is now.'}</p>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn danger" data-a="yes">${owner ? 'Stop sharing' : 'Leave'}</button></div>`);
  $('.n', box).textContent = P.name;
  $('[data-a=no]', box).onclick = () => openShareDialog();
  $('[data-a=yes]', box).onclick = async (e) => {
    e.target.disabled = true;
    await coFlush();
    const r = await apiCall(owner ? 'collab/stop' : 'collab/leave', { cid: CO.cid }, coTok());
    if (r.error) { e.target.disabled = false; return toast(r.error, { error: true }); }
    coStop(); delete P.collab; await saveNow(); coRenderBar(); closeModal();
    toast(owner ? 'Stopped sharing - this project is only yours again' : 'You left the project. Your copy is still in your projects.');
    coListCache = null;
  };
}

/* ---------------- home: “Shared with you” ---------------- */
let coListCache = null, coListAt = 0;
async function coRenderShared() {
  const grid = $('#homeGrid'); if (!grid) return;
  let sec = $('#coShared');
  if (!coTok()) { if (sec) sec.remove(); return; }
  if (!coListCache || Date.now() - coListAt > 15000) {
    const r = await apiCall('collab/list', null, coTok());
    if (r.error) { if (sec) sec.remove(); return; }
    coListCache = r; coListAt = Date.now();
  }
  const { invites = [], member = [] } = coListCache;
  if (!invites.length && !member.length) { if (sec) sec.remove(); return; }
  if (!sec) { sec = el('div', 'co-home'); sec.id = 'coShared'; grid.before(sec); }
  const card = (p, inv) => `<div class="co-hcard${inv ? ' inv' : ''}" data-cid="${esc75(p.cid)}">
      <span class="co-hav" style="--cc:${coColor(p.owner && p.owner.uid)}">${avatarHtml(p.owner || {}, 38)}</span>
      <div class="co-hmeta"><b></b><small>${inv ? `<em>${esc75(p.owner ? p.owner.username : 'Someone')}</em> invited you to edit` : `by ${esc75(p.owner ? p.owner.username : '?')} · ${p.editors} editor${p.editors === 1 ? '' : 's'}`}</small></div>
      ${p.live ? `<span class="co-hlive"><i></i>${p.live} here now</span>` : ''}
      ${inv ? '<button class="btn ghost small" data-a="no">Decline</button><button class="btn primary small" data-a="yes">Accept</button>' : '<button class="btn small" data-a="open">Open</button>'}</div>`;
  sec.innerHTML = `<div class="co-htitle"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.2 3-5 6-5s5.4 1.8 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c2.5 0 4.4 1.6 5 4.8"/></svg>Shared with you${invites.length ? `<span class="co-badge">${invites.length} new</span>` : ''}</div><div class="co-hlist">${invites.map((p) => card(p, true)).join('')}${member.map((p) => card(p, false)).join('')}</div>`;
  const all = [...invites, ...member];
  $$('.co-hcard', sec).forEach((c, i) => {
    $('.co-hmeta b', c).textContent = all[i].name || 'Shared project';
    const cid = c.dataset.cid;
    const btn = (a) => $(`[data-a=${a}]`, c);
    if (btn('open')) { btn('open').onclick = () => coOpenShared(cid); c.ondblclick = () => coOpenShared(cid); }
    if (btn('yes')) btn('yes').onclick = async (e) => {
      e.target.disabled = true;
      const r = await apiCall('collab/accept', { cid }, coTok());
      coListCache = null;
      if (r.error) { toast(r.error, { error: true }); return coRenderShared(); }
      toast('Joined! Opening the project…'); coOpenShared(cid);
    };
    if (btn('no')) btn('no').onclick = async () => { await apiCall('collab/decline', { cid }, coTok()); coListCache = null; coRenderShared(); };
  });
}
const _renderHome75 = renderHome;
renderHome = function () { const r = _renderHome75.apply(this, arguments); coRenderShared().catch(() => {}); return r; };
setInterval(() => { if (document.body.classList.contains('at-home') && !document.hidden && coTok()) { coListAt = 0; coRenderShared().catch(() => {}); } }, 45000);
coRenderBar();

/* ---------------- Halloween theme scenery (home screen) ---------------- */
const BAT_SVG = '<svg viewBox="0 0 64 28"><path class="w1" d="M32 14c-3-4-8-7-14-7 2 2 2 5 0 7-3-2-7-2-10 0 0-3-3-6-8-7 4 4 6 10 6 15 3-2 7-3 10-1 1-3 5-4 8-2 2-3 5-4 8-5z"/><path class="w2" d="M32 14c3-4 8-7 14-7-2 2-2 5 0 7 3-2 7-2 10 0 0-3 3-6 8-7-4 4-6 10-6 15-3-2-7-3-10-1-1-3-5-4-8-2-2-3-5-4-8-5z"/><ellipse cx="32" cy="15" rx="3.2" ry="4.2"/><path d="M29.5 11.5l.8-2.6 1.2 2M34.5 11.5l-.8-2.6-1.2 2"/></svg>';
const GHOST_SVG = '<svg viewBox="0 0 60 72"><path d="M30 2C15 2 6 13 6 28v38l8-6 8 6 8-6 8 6 8-6 8 6V28C54 13 45 2 30 2z"/><ellipse class="eye" cx="22" cy="28" rx="3.6" ry="5"/><ellipse class="eye" cx="38" cy="28" rx="3.6" ry="5"/><ellipse class="eye" cx="30" cy="42" rx="4" ry="3"/></svg>';
const PUMPKIN_SVG = '<svg viewBox="0 0 80 70"><path class="stem" d="M38 14c0-6 3-10 8-12l2 3c-4 2-5 5-5 9z"/><path class="body" d="M40 14c-6-3-15-2-22 3C6 25 4 45 14 58c8 10 18 10 26 7 8 3 18 3 26-7 10-13 8-33-4-41-7-5-16-6-22-3z"/><path class="rib" d="M40 16c-6 10-6 38 0 48M40 16c6 10 6 38 0 48M24 20c-8 10-8 30 0 42M56 20c8 10 8 30 0 42"/><path class="face" d="M22 32l8 3-8 4zM58 32l-8 3 8 4zM24 47c5 6 11 4 16 8 5-4 11-2 16-8-4 1-6 4-8 2-2 3-4 3-8 1-4 2-6 2-8-1-2 2-4-1-8-2z"/></svg>';
function hwScene(id) {
  const home = $('#home'); if (!home) return;
  let d = $('.hw-deco', home);
  if (id !== 'pumpkin' && id !== 'haunted') { if (d) d.remove(); return; }
  if (d && d.dataset.t === id) return;
  if (d) d.remove();
  d = el('div', 'hw-deco hw-t-' + id); d.dataset.t = id; d.setAttribute('aria-hidden', 'true');
  if (id === 'pumpkin') {
    d.innerHTML = '<div class="hw-moon"></div>'
      + [[0, 14, 1, 26], [1, 26, .7, 34], [2, 9, .55, 41], [3, 34, .85, 30], [4, 20, .5, 47]].map(([i, top, s, dur]) => `<div class="hw-bat" style="--top:${top}%;--s:${s};--dur:${dur}s;--delay:${-i * 7.3}s"><div class="flap">${BAT_SVG}</div></div>`).join('')
      + '<div class="hw-hill"></div>'
      + [[6, 1, 0], [13, .72, 1.3], [88, .9, .6], [94, .6, 2.1]].map(([x, s, dl]) => `<div class="hw-pumpkin" style="--x:${x}%;--s:${s};--dl:${dl}s">${PUMPKIN_SVG}</div>`).join('');
  } else {
    d.innerHTML = '<div class="hw-moon"></div>'
      + [[8, 58, 1, 0], [84, 40, .75, 3], [66, 70, .55, 6]].map(([x, y, s, dl]) => `<div class="hw-ghost" style="--x:${x}%;--y:${y}%;--s:${s};--dl:${-dl}s">${GHOST_SVG}</div>`).join('')
      + '<div class="hw-fog f1"></div><div class="hw-fog f2"></div><div class="hw-fog f3"></div>';
  }
  home.prepend(d);
}
const _applyTheme75 = applyTheme;
applyTheme = function (id) { const r = _applyTheme75.apply(this, arguments); try { hwScene(document.documentElement.dataset.theme || id); } catch {} return r; };
setTimeout(() => hwScene(document.documentElement.dataset.theme), 0);
