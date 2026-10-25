/* Flux — folders in the media library (like DaVinci's bins).
   New imports go into the folder you're in; from the top level, videos/photos go into "Media" and sounds into "Music".
   Double-click a folder to open it, drag files onto a folder to move them, right-click for rename / delete. */
'use strict';
const lib = { folder: null, pickedFolder: null };
const ICON_FOLDER = '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
const folders = () => (P.folders = P.folders || []);
const folderById = (id) => folders().find((f) => f.id === id) || null;
const childFolders = (pid) => folders().filter((f) => (f.parent || null) === pid).sort((a, b) => a.name.localeCompare(b.name));
function folderCount(id) {
  let n = P.media.filter((m) => (m.folder || null) === id).length;
  for (const f of childFolders(id)) n += folderCount(f.id);
  return n;
}
function makeFolder(name, parent = null) {
  let n = name, i = 2;
  while (childFolders(parent).some((f) => f.name.toLowerCase() === n.toLowerCase())) n = `${name} ${i++}`;
  const f = { id: 'f' + uid(), name: n, parent };
  folders().push(f);
  markDirty();
  return f;
}
function folderNamed(name, parent = null) { return childFolders(parent).find((f) => f.name === name) || makeFolder(name, parent); }
// where a newly imported file goes
function folderForImport(m) {
  if (lib.importTarget !== undefined && (lib.importTarget === null || folderById(lib.importTarget))) return lib.importTarget;
  if (lib.folder && folderById(lib.folder)) return lib.folder;
  if (m.kind === 'audio') return folderNamed(m.tag === 'voice' ? 'Voiceovers' : 'Music').id;
  return folderNamed('Media').id;
}
function moveToFolder(ids, fid) {
  for (const id of ids) { const m = getMedia(id); if (m) m.folder = fid || null; }
  markDirty();
  renderMedia();
}
function pickedIds(fallbackId) {
  const sel = rt.mediaSel && rt.mediaSel.size ? [...rt.mediaSel] : [];
  return fallbackId && !sel.includes(fallbackId) ? [fallbackId] : sel.length ? sel : fallbackId ? [fallbackId] : [];
}
function deleteFolder(f) {
  const parent = f.parent || null;
  // the files stay - they move up one level
  for (const m of P.media) if (m.folder === f.id) m.folder = parent;
  for (const c of folders()) if (c.parent === f.id) c.parent = parent;
  P.folders = folders().filter((x) => x !== f);
  if (lib.folder === f.id) lib.folder = parent;
  lib.pickedFolder = null;
  markDirty();
  renderMedia();
  toast(`Folder “${f.name}” deleted - its files moved ${parent ? 'up' : 'to the top level'}`);
}
function renameFolder(f, after) {
  const box = modal(`<h2>${after ? 'New folder' : 'Rename folder'}</h2><div class="row" style="margin-top:14px"><input class="num-input" style="font-family:var(--font);font-size:13px;height:36px" maxlength="40"></div>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn primary" data-a="ok">${after ? 'Create' : 'Rename'}</button></div>`);
  const inp = $('input', box);
  inp.value = f.name;
  setTimeout(() => { inp.focus(); inp.select(); }, 30);
  const ok = () => { const v = inp.value.trim(); closeModal(); if (v) { f.name = v; markDirty(); } renderMedia(); };
  inp.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') { closeModal(); } };
  $('[data-a=ok]', box).onclick = ok;
  $('[data-a=no]', box).onclick = () => { closeModal(); renderMedia(); };
}
function newFolderHere() {
  const f = makeFolder('New folder', lib.folder);
  renderMedia();
  renameFolder(f, true);
}
function openFolder(id) { lib.folder = id; lib.pickedFolder = null; if (rt.mediaSel) rt.mediaSel.clear(); renderMedia(); }
function folderMenu(f, x, y) {
  contextMenu(x, y, [
    { label: 'Open', fn: () => openFolder(f.id) },
    { label: 'Rename', fn: () => renameFolder(f) },
    { label: 'New folder inside', fn: () => { const n = makeFolder('New folder', f.id); renameFolder(n, true); } },
    { label: 'Delete folder (keeps the files)', danger: true, fn: () => deleteFolder(f) }
  ]);
}
function moveMenuItems(ids) {
  const out = [];
  const walk = (pid, depth) => { for (const f of childFolders(pid)) { out.push({ label: '   '.repeat(depth) + '📁 ' + f.name, fn: () => moveToFolder(ids, f.id) }); walk(f.id, depth + 1); } };
  out.push({ label: '⬆ Top level', fn: () => moveToFolder(ids, null) });
  walk(null, 0);
  return out;
}
// is folder `id` inside folder `anc` (or the same one)?
function isInside(id, anc) { for (let f = folderById(id); f; f = folderById(f.parent)) if (f.id === anc) return true; return false; }
function moveFolder(fid, targetId) {
  const f = folderById(fid);
  if (!f || (targetId && isInside(targetId, fid))) return toast('A folder can\u2019t go inside itself');
  if ((f.parent || null) === (targetId || null)) return;
  f.parent = targetId || null;
  markDirty(); renderMedia();
  toast(`Moved “${f.name}” to ${targetId ? folderById(targetId).name : 'the top level'}`);
}
// which folder tile / crumb is under the mouse (for files dropped from your computer); undefined = none
function folderElAt(x, y) {
  for (const el of document.elementsFromPoint(x, y)) { const t = el.closest && el.closest('[data-drop-folder]'); if (t) return t; }
  return null;
}
function folderTileAt(x, y) { const t = folderElAt(x, y); return t ? (t.dataset.dropFolder || null) : undefined; }
function acceptDrop(elm, targetId) {
  elm.dataset.dropFolder = targetId || '';
  const ok = (e) => e.dataTransfer.types.includes('text/flux-media') || e.dataTransfer.types.includes('text/flux-folder');
  elm.addEventListener('dragenter', (e) => { if (ok(e)) { e.preventDefault(); elm.classList.add('drop'); } });
  elm.addEventListener('dragover', (e) => { if (ok(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; elm.classList.add('drop'); } });
  elm.addEventListener('dragleave', (e) => { if (!elm.contains(e.relatedTarget)) elm.classList.remove('drop'); });
  elm.addEventListener('drop', (e) => {
    elm.classList.remove('drop');
    const fid = e.dataTransfer.getData('text/flux-folder');
    const id = e.dataTransfer.getData('text/flux-media');
    if (!id && !fid) return;
    e.preventDefault(); e.stopPropagation();
    if (fid) moveFolder(fid, targetId);
    else moveToFolder(pickedIds(id), targetId);
  });
}
function decorateLibrary() {
  const grid = $('#mediaGrid');
  if (!grid) return;
  if (lib.folder && !folderById(lib.folder)) lib.folder = null;
  // files whose folder was lost show at the top level
  for (const m of P.media) if (m.folder && !folderById(m.folder)) m.folder = null;
  const cur = lib.folder;
  // only show what's in this folder
  for (const item of $$('.media-item', grid)) {
    const m = getMedia(item.dataset.id);
    if (!m || (m.folder || null) !== cur) item.remove();
  }
  // folders first
  const first = grid.firstChild;
  const tiles = [];
  if (cur) {
    const up = el('div', 'media-item folder up');
    up.innerHTML = `<div class="thumb">${ICON_FOLDER}<span class="f-up">⬆</span></div><div class="meta"><div class="name">Back</div></div>`;
    up.dataset.tip = 'Back to ' + (folderById(cur).parent ? folderById(folderById(cur).parent).name : 'the top level') + ' (drop files here to move them up)';
    up.ondblclick = up.onclick = () => openFolder(folderById(cur).parent || null);
    acceptDrop(up, folderById(cur).parent || null);
    tiles.push(up);
  }
  for (const f of childFolders(cur)) {
    const t = el('div', 'media-item folder' + (lib.pickedFolder === f.id ? ' picked' : ''));
    t.dataset.folder = f.id;
    t.innerHTML = `<div class="thumb">${ICON_FOLDER}<span class="f-count"></span></div><div class="meta"><div class="name"></div></div>`;
    $('.name', t).textContent = f.name;
    const n = folderCount(f.id);
    $('.f-count', t).textContent = n ? n : '';
    t.dataset.tip = 'Double-click to open · drop files here · right-click for more';
    t.onclick = () => { lib.pickedFolder = f.id; rt.libFocus = true; if (rt.mediaSel) rt.mediaSel.clear(); $$('#mediaGrid .media-item').forEach((x) => x.classList.toggle('picked', x === t)); };
    t.ondblclick = () => openFolder(f.id);
    t.oncontextmenu = (e) => { e.preventDefault(); folderMenu(f, e.clientX, e.clientY); };
    t.draggable = true;
    t.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/flux-folder', f.id); e.dataTransfer.effectAllowed = 'move'; });
    acceptDrop(t, f.id);
    tiles.push(t);
  }
  for (const t of tiles) grid.insertBefore(t, first);
  // right-click a file: move to a folder
  for (const item of $$('.media-item:not(.folder)', grid)) {
    if (item._fm) continue; item._fm = true;
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const m = getMedia(item.dataset.id); if (!m) return;
      const ids = pickedIds(m.id);
      contextMenu(e.clientX, e.clientY, [
        { label: 'Add to the end of the timeline', fn: () => appendMediaToTimeline(m) },
        { label: ids.length > 1 ? `Move ${ids.length} items to…` : 'Move to…', disabled: true, fn: () => {} },
        ...moveMenuItems(ids),
        { label: 'Remove from library', danger: true, fn: () => { if (rt.mediaSel) { rt.mediaSel.clear(); ids.forEach((i) => rt.mediaSel.add(i)); } removePickedMedia(); } }
      ]);
    });
  }
  // the bar above the grid: where you are + new folder
  let bar = $('#libFolderBar');
  if (!bar) { bar = el('div', ''); bar.id = 'libFolderBar'; grid.parentNode.insertBefore(bar, grid); }
  bar.innerHTML = '';
  const crumbs = el('div', 'lf-crumbs');
  const path = [];
  for (let f = folderById(cur); f; f = folderById(f.parent)) path.unshift(f);
  const home = el('button', 'lf-crumb' + (cur ? '' : ' on'), 'All media');
  home.onclick = () => openFolder(null);
  acceptDrop(home, null);
  crumbs.appendChild(home);
  for (const f of path) {
    crumbs.appendChild(el('span', 'lf-sep', '›'));
    const b = el('button', 'lf-crumb' + (f.id === cur ? ' on' : ''));
    b.textContent = f.name;
    b.onclick = () => openFolder(f.id);
    acceptDrop(b, f.id);
    crumbs.appendChild(b);
  }
  const nb = el('button', 'icon-btn small lf-new', `${ICON_FOLDER}<b>+</b>`);
  nb.dataset.tip = 'New folder';
  nb.onclick = newFolderHere;
  bar.append(crumbs, nb);
  const hint = $('#mediaHint');
  if (hint) hint.style.display = P.media.length ? '' : 'none';
}
function setupFolders() {
  const baseRender = renderMedia;
  renderMedia = function () { const r = baseRender.apply(this, arguments); decorateLibrary(); return r; };
  // Delete / Backspace on a picked folder deletes the folder (files are kept)
  const baseRemove = removePickedMedia;
  removePickedMedia = function () {
    const f = lib.pickedFolder && folderById(lib.pickedFolder);
    if (f && !(rt.mediaSel && rt.mediaSel.size)) { deleteFolder(f); return true; }
    return baseRemove.apply(this, arguments);
  };
  const baseLoad = loadProjectData;
  loadProjectData = async function () { lib.folder = null; lib.pickedFolder = null; const r = await baseLoad.apply(this, arguments); P.folders = P.folders || []; renderMedia(); return r; };
  // files dragged in from your computer: show which folder they'll land in
  let hot = null;
  const card = () => document.querySelector('#dropOverlay .drop-card');
  const clear = () => { if (hot) hot.classList.remove('drop'); hot = null; const c = card(); if (c && c.dataset.base) c.lastChild.textContent = c.dataset.base; };
  window.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    const id = folderTileAt(e.clientX, e.clientY);
    const el = folderElAt(e.clientX, e.clientY);
    if (el !== hot) { clear(); hot = el; if (el) el.classList.add('drop'); }
    const c = card();
    if (c) { if (!c.dataset.base) c.dataset.base = c.lastChild.textContent; c.lastChild.textContent = id === undefined ? c.dataset.base : 'Drop into “' + (id ? folderById(id).name : 'All media') + '”'; }
  });
  window.addEventListener('drop', clear);
  window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) clear(); });
  document.addEventListener('pointerdown', (e) => { if (!(e.target.closest && e.target.closest('.media-item.folder'))) lib.pickedFolder = null; }, true);
  renderMedia();
}
