// Flux - safe bridge between the window and the computer.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

let mediaBaseCache = null;
const mediaBase = () => { if (mediaBaseCache === null) { try { mediaBaseCache = ipcRenderer.sendSync('media:base') || ''; } catch { mediaBaseCache = ''; } } return mediaBaseCache; };
contextBridge.exposeInMainWorld('flux', {
  // media
  openMedia: () => ipcRenderer.invoke('media:open'),
  pathForFile: (file) => { try { return webUtils.getPathForFile(file); } catch { return null; } },
  mediaUrl: (p) => 'flux://app/media/' + encodeURIComponent(p),
  // for <video>/<audio>: a local address that supports jumping around (seeking)
  playUrl: (p) => { const base = mediaBase(); return base ? base + encodeURIComponent(p) : 'flux://app/media/' + encodeURIComponent(p); },
  fileExists: (p) => ipcRenderer.invoke('file:exists', p),
  saveMediaFile: (opts) => ipcRenderer.invoke('media:save', opts),

  // projects (saved automatically)
  projectsList: () => ipcRenderer.invoke('projects:list'),
  projectLoad: (id) => ipcRenderer.invoke('projects:load', id),
  projectSave: (id, data, thumb) => ipcRenderer.invoke('projects:save', { id, data, thumb }),
  projectSaveSync: (id, data) => ipcRenderer.sendSync('projects:saveSync', { id, data }),
  projectDelete: (id) => ipcRenderer.invoke('projects:delete', id),
  saveProject: (opts) => ipcRenderer.invoke('project:save', opts),
  openProject: () => ipcRenderer.invoke('project:open'),

  // music
  musicCatalog: () => ipcRenderer.invoke('music:catalog'),
  musicArchiveSearch: (opts) => ipcRenderer.invoke('music:archiveSearch', opts),
  musicArchiveTracks: (id) => ipcRenderer.invoke('music:archiveTracks', id),
  musicDownload: (opts) => ipcRenderer.invoke('music:download', opts),

  // window
  toggleFullscreen: () => ipcRenderer.invoke('win:toggleFullscreen'),
  isFullscreen: () => ipcRenderer.invoke('win:isFullscreen'),
  minimize: () => ipcRenderer.invoke('win:minimize'),
  setStartFullscreen: (v) => ipcRenderer.invoke('win:setStartFullscreen', v),
  onFullscreenChange: (cb) => ipcRenderer.on('win:fullscreen', (_e, v) => cb(v)),
  quit: () => ipcRenderer.invoke('app:quit'),

  // export & snapshots
  saveSnapshot: (dataUrl) => ipcRenderer.invoke('snapshot:save', dataUrl),
  exportChoose: (opts) => ipcRenderer.invoke('export:choose', opts),
  exportBegin: () => ipcRenderer.invoke('export:begin'),
  exportChunk: (buf) => ipcRenderer.invoke('export:chunk', buf),
  exportFinish: (opts) => ipcRenderer.invoke('export:finish', opts),
  exportCancel: () => ipcRenderer.invoke('export:cancel'),
  onConvertProgress: (cb) => ipcRenderer.on('export:convert-progress', (_e, v) => cb(v)),
  showInFolder: (p) => ipcRenderer.invoke('shell:show', p),

  // time machine, AI and speech-to-text
  versionsList: (id) => ipcRenderer.invoke('versions:list', id),
  versionsAdd: (id, version) => ipcRenderer.invoke('versions:add', { id, version }),
  aiChat: (opts) => ipcRenderer.invoke('ai:chat', opts),
  transcribe: (opts) => ipcRenderer.invoke('asr:transcribe', opts),
  onTranscribeProgress: (cb) => ipcRenderer.on('asr:progress', (_e, v) => cb(v)),

  // premium licence
  mediaStrip: (opts) => ipcRenderer.invoke('media:strip', opts),
  mediaPeaks: (file) => ipcRenderer.invoke('media:peaks', file),
  licenseVerify: (opts) => ipcRenderer.invoke('license:verify', opts),
  licenseActivate: (key) => ipcRenderer.invoke('license:activate', key),
  licenseValidate: (opts) => ipcRenderer.invoke('license:validate', opts),
  appVersion: () => ipcRenderer.invoke('app:version'),
  fontGet: (opts) => ipcRenderer.invoke('font:get', opts),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateInstall: () => ipcRenderer.invoke('update:install'),
  onUpdateProgress: (cb) => ipcRenderer.on('update:progress', (_e, v) => cb(v)),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url)
});
