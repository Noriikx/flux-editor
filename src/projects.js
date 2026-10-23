/* =====================================================================
   Flux — Project manager (home screen). Projects save themselves here,
   so there's no need to save files by hand.
   ===================================================================== */
'use strict';

// Where projects live: in the desktop app they're files in Flux's own folder;
// in a plain browser (for testing) they're kept in localStorage.
const projectStore = api && api.projectsList ? {
  list: () => api.projectsList(),
  load: (id) => api.projectLoad(id),
  save: (id, data, thumb) => api.projectSave(id, data, thumb),
  saveSync: (id, data) => api.projectSaveSync(id, data),
  remove: (id) => api.projectDelete(id)
} : {
  _all() { try { return JSON.parse(localStorage.getItem('flux.projects') || '{}'); } catch { return {}; } },
  _put(all) { localStorage.setItem('flux.projects', JSON.stringify(all)); },
  async list() {
    return Object.values(this._all()).map((p) => ({ id: p.data.id, name: p.data.name, aspect: p.data.aspect, updatedAt: p.data.updatedAt, createdAt: p.data.createdAt, duration: p.data.duration || 0, clips: (p.data.clips || []).length, thumb: p.thumb }));
  },
  async load(id) { const p = this._all()[id]; return p ? p.data : null; },
  async save(id, data, thumb) { const all = this._all(); all[id] = { data, thumb: thumb || (all[id] && all[id].thumb) || null }; this._put(all); },
  saveSync(id, data) { const all = this._all(); all[id] = { data, thumb: (all[id] && all[id].thumb) || null }; this._put(all); },
  async remove(id) { const all = this._all(); delete all[id]; this._put(all); }
};

let homeProjects = [];
let homeQuery = '';
let homeSort = 'recent';

function timeAgo(ts) {
  if (!ts) return '';
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 86400 * 7) return Math.floor(s / 86400) + ' days ago';
  return new Date(ts).toLocaleDateString();
}

async function goHome() {
  if (state.exporting) return toast('Wait for the export to finish first');
  if (state.recording) await stopRecording();
  if (state.inEditor) {
    pause();
    await saveNow();
  }
  state.inEditor = false;
  if (typeof voiceTabHidden === 'function') voiceTabHidden();
  if (typeof stopMusicPreview === 'function') stopMusicPreview();
  closeModal();
  document.body.classList.add('at-home');
  await refreshHome();
}

async function refreshHome() {
  try { homeProjects = await projectStore.list(); } catch (e) { console.error(e); homeProjects = []; }
  renderHome();
}

function renderHome() {
  const grid = $('#homeGrid');
  grid.innerHTML = '';
  let list = homeProjects.slice();
  if (homeQuery) list = list.filter((p) => (p.name || '').toLowerCase().includes(homeQuery));
  list.sort(homeSort === 'name' ? (a, b) => (a.name || '').localeCompare(b.name || '') : (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  $('#homeCount').textContent = homeProjects.length ? `${homeProjects.length} project${homeProjects.length === 1 ? '' : 's'}` : '';
  $('#homeEmpty').style.display = homeProjects.length ? 'none' : '';
  for (const p of list) {
    const [W, H] = ASPECTS[p.aspect] || ASPECTS['16:9'];
    const card = el('div', 'proj-card');
    card.tabIndex = 0;
    card.innerHTML = `
      <div class="proj-thumb"><div class="proj-frame" style="aspect-ratio:${W}/${H}">${p.thumb ? `<img src="${p.thumb}" alt="">` : '<img src="logo.png" class="ph" alt="">'}</div>
        <span class="proj-ar">${p.aspect || '16:9'}</span>${p.duration ? `<span class="proj-dur">${fmt(p.duration, false)}</span>` : ''}
        <button class="proj-more" data-tip="More">⋯</button></div>
      <div class="proj-meta"><div class="proj-name"></div><div class="proj-sub">Edited ${timeAgo(p.updatedAt)}</div></div>`;
    $('.proj-name', card).textContent = p.name || 'Untitled project';
    card.addEventListener('click', (e) => { if (!e.target.closest('.proj-more')) openProjectById(p.id); });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') openProjectById(p.id); });
    const menu = (x, y) => contextMenu(x, y, [
      { label: 'Open', fn: () => openProjectById(p.id) },
      { label: 'Rename', fn: () => renameProjectDialog(p) },
      { label: 'Duplicate', fn: () => duplicateProject(p.id) },
      { label: 'Save a copy as file…', fn: () => exportProjectFile(p.id) },
      { label: 'Delete', fn: () => deleteProjectDialog(p), danger: true }
    ]);
    $('.proj-more', card).addEventListener('click', (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom + 4); });
    card.addEventListener('contextmenu', (e) => { e.preventDefault(); menu(e.clientX, e.clientY); });
    grid.appendChild(card);
  }
}

async function openProjectById(id) {
  const data = await projectStore.load(id);
  if (!data) { toast("Couldn't open that project", { error: true }); return refreshHome(); }
  document.body.classList.remove('at-home');
  await loadProjectData(data);
  fitZoomSoon();
  maybeShowTips();
}
function fitZoomSoon() { setTimeout(() => { if (projectDuration() > 0) fitZoom(); }, 60); }
function maybeShowTips() {
  try {
    if (settings.showTips && !localStorage.getItem('flux.seenHelp')) { localStorage.setItem('flux.seenHelp', '1'); setTimeout(showHelp, 300); }
  } catch {}
}

async function createProject(name, aspect) {
  const p = newProject();
  p.name = name || nextProjectName();
  p.aspect = aspect || '16:9';
  await projectStore.save(p.id, p, null);
  document.body.classList.remove('at-home');
  closeModal();
  await loadProjectData(p);
  maybeShowTips();
}
function nextProjectName() {
  let n = homeProjects.length + 1;
  const names = new Set(homeProjects.map((p) => p.name));
  while (names.has('Project ' + n)) n++;
  return 'Project ' + n;
}

async function newProjectDialog() {
  if (state.inEditor) { await saveNow(); }
  if (!homeProjects.length) { try { homeProjects = await projectStore.list(); } catch {} }
  const shapes = [['16:9', 'Wide', 'YouTube, TV', 64, 36], ['9:16', 'Vertical', 'TikTok, Reels, Shorts', 27, 48], ['1:1', 'Square', 'Instagram, posts', 44, 44], ['4:5', 'Portrait', 'Instagram feed', 38, 48]];
  let aspect = '16:9';
  const box = modal(`
    <h2>New project</h2><p class="sub">Name it and pick a shape - you can change both later.</p>
    <div class="row"><label>Name</label><input class="num-input np-name" style="font-family:var(--font);font-size:14px;height:38px" maxlength="60"></div>
    <div class="row"><label>Video shape</label><div class="shape-grid">${shapes.map(([k, n, d, w, h]) => `
      <button class="shape-card" data-k="${k}"><span class="shape-box"><i style="width:${w}px;height:${h}px"></i></span><b>${n}</b><small>${k} · ${d}</small></button>`).join('')}</div></div>
    <div class="footer"><button class="btn ghost" data-a="cancel">Cancel</button><button class="btn primary" data-a="ok">Create project</button></div>`);
  const nameInp = $('.np-name', box);
  nameInp.value = nextProjectName();
  setTimeout(() => { nameInp.focus(); nameInp.select(); }, 30);
  const sync = () => $$('.shape-card', box).forEach((b) => b.classList.toggle('active', b.dataset.k === aspect));
  $$('.shape-card', box).forEach((b) => {
    b.onclick = () => { aspect = b.dataset.k; sync(); };
    b.ondblclick = () => { aspect = b.dataset.k; go(); };
  });
  sync();
  const go = () => createProject(nameInp.value.trim(), aspect);
  nameInp.onkeydown = (e) => { if (e.key === 'Enter') go(); };
  $('[data-a=cancel]', box).onclick = closeModal;
  $('[data-a=ok]', box).onclick = go;
}

function renameProjectDialog(p) {
  const box = modal(`<h2>Rename project</h2><div class="row" style="margin-top:14px"><input class="num-input" style="font-family:var(--font);font-size:14px;height:38px" maxlength="60"></div>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn primary" data-a="ok">Rename</button></div>`);
  const inp = $('input', box);
  inp.value = p.name || '';
  setTimeout(() => { inp.focus(); inp.select(); }, 30);
  const ok = async () => {
    const v = inp.value.trim();
    closeModal();
    if (!v) return;
    if (state.inEditor && P.id === p.id) { P.name = v; $('#projectName').value = v; await saveNow(); }
    else { const data = await projectStore.load(p.id); if (data) { data.name = v; await projectStore.save(p.id, data, p.thumb); } }
    refreshHome();
  };
  inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); };
  $('[data-a=ok]', box).onclick = ok;
  $('[data-a=no]', box).onclick = closeModal;
}

async function duplicateProject(id) {
  if (state.inEditor && P.id === id) await saveNow();
  const data = await projectStore.load(id);
  if (!data) return;
  const src = homeProjects.find((p) => p.id === id);
  const copy = JSON.parse(JSON.stringify(data));
  copy.id = uid() + uid();
  copy.name = (data.name || 'Project') + ' (copy)';
  copy.createdAt = copy.updatedAt = Date.now();
  await projectStore.save(copy.id, copy, src ? src.thumb : null);
  toast('Duplicated “' + (data.name || 'project') + '”');
  if (!state.inEditor) refreshHome();
}

function deleteProjectDialog(p) {
  const box = modal(`<h2>Delete “<span class="n"></span>”?</h2>
    <p class="sub">The project will be removed from Flux. Your original video, photo and music files are not touched.</p>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn danger" data-a="yes">Delete project</button></div>`);
  $('.n', box).textContent = p.name || 'Untitled project';
  $('[data-a=no]', box).onclick = closeModal;
  $('[data-a=yes]', box).onclick = async () => {
    closeModal();
    await projectStore.remove(p.id);
    if (state.inEditor && P.id === p.id) { state.inEditor = false; await goHome(); }
    else refreshHome();
    toast('Project deleted');
  };
}

// Optional: share a project as a .flux file, or bring one in.
async function exportProjectFile(id = P.id) {
  if (!api) return toast('Saving project files works in the desktop app');
  if (state.inEditor && P.id === id) await saveNow();
  const data = await projectStore.load(id);
  if (!data) return;
  const p = await api.saveProject({ data, filePath: null, saveAs: true });
  if (p) toast('Saved a copy to ' + p);
}
async function importProjectFile() {
  if (!api) return toast('Opening project files works in the desktop app');
  const r = await api.openProject();
  if (!r || !r.data) return;
  const data = r.data;
  data.id = uid() + uid();
  data.name = data.name || 'Imported project';
  data.updatedAt = Date.now();
  await projectStore.save(data.id, data, null);
  document.body.classList.remove('at-home');
  closeModal();
  await loadProjectData(data);
  fitZoomSoon();
  toast('Imported “' + data.name + '” into your projects');
}

/* ---------- App menu (click the Flux logo) ---------- */
function openAppMenu(anchor) {
  const r = anchor.getBoundingClientRect();
  const inEd = state.inEditor;
  contextMenu(r.left, r.bottom + 6, [
    { label: 'New project', key: keyLabel('newProject'), fn: newProjectDialog },
    { label: 'All projects', key: keyLabel('projects'), fn: goHome },
    inEd ? { label: 'Duplicate this project', fn: async () => { await duplicateProject(P.id); } } : null,
    inEd ? { label: 'Save a copy as file…', fn: () => exportProjectFile() } : null,
    { label: 'Open project file…', fn: importProjectFile },
    inEd ? { label: 'Export video', key: keyLabel('export'), fn: openExportDialog } : null,
    { label: 'Settings', key: keyLabel('settings'), fn: () => openSettings() },
    { label: 'Keyboard shortcuts', fn: () => openSettings('keys') },
    { label: 'Help', key: keyLabel('help'), fn: showHelp },
    { label: 'Full screen on / off', key: keyLabel('appFullscreen'), fn: toggleAppFullscreen },
    { label: 'Exit Flux', fn: exitApp, danger: true }
  ].filter(Boolean));
}
async function exitApp() {
  if (state.inEditor) await saveNow();
  if (api && api.quit) api.quit(); else window.close();
}

function setupHome() {
  $('#homeNew').onclick = newProjectDialog;
  $('#homeNew2').onclick = newProjectDialog;
  $$('.quick-shape').forEach((b) => (b.onclick = () => createProject(null, b.dataset.k)));
  $('#homeSearch').oninput = (e) => { homeQuery = e.target.value.trim().toLowerCase(); renderHome(); };
  $('#homeSort').onchange = (e) => { homeSort = e.target.value; renderHome(); };
  $('#homeImport').onclick = importProjectFile;
  $('#homeSettings').onclick = () => openSettings();
  $('#homeMenu').onclick = (e) => openAppMenu(e.currentTarget);
  $('#brandMenu').onclick = (e) => openAppMenu(e.currentTarget);
  $('#btnHome').onclick = goHome;
  $('#btnSettings').onclick = () => openSettings();
  $$('.win-min').forEach((b) => (b.onclick = () => api && api.minimize && api.minimize()));
  $$('.win-fs').forEach((b) => (b.onclick = toggleAppFullscreen));
  $$('.win-close').forEach((b) => (b.onclick = exitApp));
  if (api && api.onFullscreenChange) api.onFullscreenChange((fs) => document.body.classList.toggle('is-fullscreen', fs));
}
