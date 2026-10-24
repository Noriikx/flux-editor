// Flux - main process
// Creates the window, serves the app + your media files through a private
// "flux://" protocol, stores projects, downloads free music and handles export.

const { app, BrowserWindow, ipcMain, dialog, protocol, shell, Menu, net, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Readable } = require('stream');
const { spawn } = require('child_process');

let win = null;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'flux',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
  }
]);

// ---------- folders ----------
const dataDir = () => app.getPath('userData');
const projectsDir = () => ensureDir(path.join(dataDir(), 'projects'));
const mediaDir = (sub) => ensureDir(path.join(dataDir(), 'media', sub || 'misc'));
const cacheDir = () => ensureDir(path.join(dataDir(), 'cache'));
function ensureDir(d) { fs.mkdirSync(d, { recursive: true }); return d; }
const safeName = (s) => String(s || 'file').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').slice(0, 150);
const safeId = (s) => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '');

// small settings file so we know whether to start full screen before the window exists
const mainSettingsFile = () => path.join(dataDir(), 'window.json');
function readMainSettings() {
  try { return JSON.parse(fs.readFileSync(mainSettingsFile(), 'utf8')); } catch { return { startFullscreen: true }; }
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.bmp': 'image/bmp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.m4v': 'video/mp4',
  '.mov': 'video/mp4', '.webm': 'video/webm', '.mkv': 'video/webm', '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.flac': 'audio/flac', '.opus': 'audio/ogg'
};

function serveFile(filePath, request) {
  let stat;
  try { stat = fs.statSync(filePath); } catch { return new Response('Not found', { status: 404 }); }
  const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  const range = request.headers.get('range');
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (end >= stat.size) end = stat.size - 1;
    if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
    const stream = Readable.toWeb(fs.createReadStream(filePath, { start, end }));
    return new Response(stream, {
      status: 206,
      headers: {
        'Content-Type': type, 'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': String(end - start + 1)
      }
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(filePath)), {
    status: 200,
    headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(stat.size) }
  });
}

// Videos and sounds are played from a tiny private web server on this computer (127.0.0.1 only, secret
// address) because Chromium can only jump around (seek) inside media that comes over http(s) or file://.
// Without this, dragging the playhead or jumping in a long video could show a black screen.
const http = require('http');
const crypto = require('crypto');
const mediaToken = crypto.randomBytes(18).toString('hex');
let mediaPort = 0;
function startMediaServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Range', 'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges' };
      if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      const prefix = '/' + mediaToken + '/';
      if (!req.url.startsWith(prefix)) { res.writeHead(403); return res.end(); }
      let filePath;
      try { filePath = decodeURIComponent(req.url.slice(prefix.length).split('?')[0]); } catch { res.writeHead(400); return res.end(); }
      let stat;
      try { stat = fs.statSync(filePath); if (!stat.isFile()) throw 0; } catch { res.writeHead(404, cors); return res.end(); }
      const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      const range = req.headers.range;
      let start = 0, end = stat.size - 1, status = 200;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        if (m) {
          if (m[1]) { start = parseInt(m[1], 10); if (m[2]) end = Math.min(parseInt(m[2], 10), stat.size - 1); }
          else if (m[2]) { start = Math.max(0, stat.size - parseInt(m[2], 10)); }
          status = 206;
        }
      }
      if (start > end || start >= stat.size) { res.writeHead(416, Object.assign({ 'Content-Range': `bytes */${stat.size}` }, cors)); return res.end(); }
      const headers = Object.assign({ 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), 'Cache-Control': 'no-store' }, cors);
      if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      res.writeHead(status, headers);
      if (req.method === 'HEAD') return res.end();
      const st = fs.createReadStream(filePath, { start, end });
      st.on('error', () => res.destroy());
      res.on('close', () => st.destroy());
      st.pipe(res);
    });
    srv.on('error', () => resolve());
    srv.listen(0, '127.0.0.1', () => { mediaPort = srv.address().port; resolve(); });
  });
}
ipcMain.on('media:base', (e) => { e.returnValue = mediaPort ? `http://127.0.0.1:${mediaPort}/${mediaToken}/` : ''; });

function registerProtocol() {
  const srcDir = path.join(__dirname, 'src');
  protocol.handle('flux', (request) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/media/')) {
      const filePath = decodeURIComponent(url.pathname.slice('/media/'.length));
      return serveFile(filePath, request);
    }
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const full = path.normalize(path.join(srcDir, rel));
    if (!full.startsWith(srcDir)) return new Response('Forbidden', { status: 403 });
    return serveFile(full, request);
  });
}

function createWindow() {
  const startFs = readMainSettings().startFullscreen !== false;
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    title: 'Flux',
    backgroundColor: '#07070b',
    icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png'),
    autoHideMenuBar: true,
    fullscreen: startFs,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      enableBlinkFeatures: 'AudioVideoTracks' // lets Flux tell whether a video has sound
    }
  });
  Menu.setApplicationMenu(null);
  win.loadURL('flux://app/index.html');
  win.once('ready-to-show', () => { if (!startFs) win.maximize(); win.show(); });

  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
  });
  const sendFs = () => { if (win) win.webContents.send('win:fullscreen', win.isFullScreen()); };
  win.on('enter-full-screen', sendFs);
  win.on('leave-full-screen', sendFs);
}

// ---------- window ----------
ipcMain.handle('win:toggleFullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); return win && win.isFullScreen(); });
ipcMain.handle('win:isFullscreen', () => !!(win && win.isFullScreen()));
ipcMain.handle('win:minimize', () => { if (win) win.minimize(); });
ipcMain.handle('win:setStartFullscreen', (_e, v) => {
  try { fs.writeFileSync(mainSettingsFile(), JSON.stringify({ startFullscreen: !!v })); } catch {}
});
ipcMain.handle('app:quit', () => app.quit());

// ---------- media import ----------
const MEDIA_EXT = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'ogv', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];

ipcMain.handle('media:open', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Import media',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Video, audio & images', extensions: MEDIA_EXT }, { name: 'All files', extensions: ['*'] }]
  });
  if (r.canceled) return [];
  return r.filePaths.map((p) => ({ path: p, name: path.basename(p), size: fs.statSync(p).size }));
});
ipcMain.handle('file:exists', (_e, p) => { try { return fs.existsSync(p); } catch { return false; } });

function uniquePath(dir, name) {
  const ext = path.extname(name), base = path.basename(name, ext);
  let p = path.join(dir, name), i = 2;
  while (fs.existsSync(p)) p = path.join(dir, `${base} (${i++})${ext}`);
  return p;
}
// Save a file Flux made itself (voice recording, freeze frame) into Flux's media folder.
ipcMain.handle('media:save', (_e, { folder, name, dataUrl, data }) => {
  const dir = mediaDir(safeName(folder));
  const p = uniquePath(dir, safeName(name));
  const buf = dataUrl ? Buffer.from(dataUrl.split(',')[1], 'base64') : Buffer.from(data);
  fs.writeFileSync(p, buf);
  return p;
});

// ---------- projects (auto-saved) ----------
ipcMain.handle('projects:list', () => {
  const dir = projectsDir();
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      const id = path.basename(f, '.json');
      let thumb = null;
      const tp = path.join(dir, id + '.jpg');
      if (fs.existsSync(tp)) thumb = 'data:image/jpeg;base64,' + fs.readFileSync(tp).toString('base64');
      out.push({ id, name: data.name, aspect: data.aspect, updatedAt: data.updatedAt, createdAt: data.createdAt, duration: data.duration || 0, clips: (data.clips || []).length, thumb });
    } catch (e) { console.warn('Bad project file', f, e.message); }
  }
  return out;
});
ipcMain.handle('projects:load', (_e, id) => {
  try { return JSON.parse(fs.readFileSync(path.join(projectsDir(), safeId(id) + '.json'), 'utf8')); } catch { return null; }
});
function writeProject(id, data) {
  const p = path.join(projectsDir(), safeId(id) + '.json');
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, p); // write-then-rename so a crash never leaves half a file
}
ipcMain.handle('projects:save', (_e, { id, data, thumb }) => {
  writeProject(id, data);
  if (thumb) fs.writeFileSync(path.join(projectsDir(), safeId(id) + '.jpg'), Buffer.from(thumb.split(',')[1], 'base64'));
  return true;
});
ipcMain.on('projects:saveSync', (e, { id, data }) => {
  try { writeProject(id, data); e.returnValue = true; } catch { e.returnValue = false; }
});
ipcMain.handle('projects:delete', (_e, id) => {
  for (const ext of ['.json', '.jpg']) { try { fs.unlinkSync(path.join(projectsDir(), safeId(id) + ext)); } catch {} }
  return true;
});

// Optional .flux files (share / back up a project)
ipcMain.handle('project:save', async (_e, { data, filePath, saveAs }) => {
  let target = filePath;
  if (!target || saveAs) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Save project file',
      defaultPath: path.join(app.getPath('documents'), safeName(data.name || 'My Flux Project') + '.flux'),
      filters: [{ name: 'Flux Project', extensions: ['flux'] }]
    });
    if (r.canceled) return null;
    target = r.filePath;
  }
  fs.writeFileSync(target, JSON.stringify(data, null, 2), 'utf8');
  return target;
});
ipcMain.handle('project:open', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Open project file', properties: ['openFile'],
    filters: [{ name: 'Flux Project', extensions: ['flux'] }]
  });
  if (r.canceled) return null;
  const p = r.filePaths[0];
  return { path: p, data: JSON.parse(fs.readFileSync(p, 'utf8')) };
});

ipcMain.handle('snapshot:save', async (_e, dataUrl) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Save frame as image',
    defaultPath: path.join(app.getPath('pictures'), 'Flux frame.png'),
    filters: [{ name: 'PNG image', extensions: ['png'] }]
  });
  if (r.canceled) return null;
  fs.writeFileSync(r.filePath, Buffer.from(dataUrl.split(',')[1], 'base64'));
  return r.filePath;
});

// ---------- free music ----------
async function getJSON(url) {
  const res = await net.fetch(url, { headers: { 'User-Agent': 'Flux video editor' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
ipcMain.handle('music:catalog', async () => {
  const cache = path.join(cacheDir(), 'incompetech.json');
  try {
    const st = fs.statSync(cache);
    if (Date.now() - st.mtimeMs < 24 * 3600 * 1000) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  } catch {}
  try {
    const data = await getJSON('https://incompetech.com/music/royalty-free/pieces.json');
    fs.writeFileSync(cache, JSON.stringify(data));
    return data;
  } catch (e) {
    if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8')); // offline: use the last copy
    throw e;
  }
});
// Public domain MUSIC only: music collections, no audiobooks, radio shows, talks or podcasts.
const PD_MUSIC_FILTER = 'mediatype:audio AND licenseurl:*publicdomain* AND collection:(musopen OR georgeblood OR 78rpm OR audio_music OR netlabels)' +
  ' AND -collection:(librivoxaudio OR audio_bookspoetry OR oldtimeradio OR podcasts OR radioprograms OR audio_religion)' +
  ' AND -subject:(audiobook OR librivox OR podcast OR poetry OR speech OR lecture OR radio OR story)' +
  ' AND -title:(chapter OR audiobook OR librivox OR episode)';
ipcMain.handle('music:archiveSearch', async (_e, { q, page }) => {
  const fields = ['identifier', 'title', 'creator', 'licenseurl'].map((f) => 'fl[]=' + f).join('&');
  const query = `(${q}) AND ${PD_MUSIC_FILTER}`;
  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(query)}&${fields}&sort[]=downloads+desc&rows=30&page=${page || 1}&output=json`;
  const j = await getJSON(url);
  if (!j.response) throw new Error('search failed');
  return {
    total: j.response.numFound,
    items: j.response.docs.map((d) => ({ id: d.identifier, title: Array.isArray(d.title) ? d.title[0] : d.title, creator: Array.isArray(d.creator) ? d.creator.join(', ') : d.creator, license: d.licenseurl }))
  };
});
ipcMain.handle('music:archiveTracks', async (_e, id) => {
  const j = await getJSON('https://archive.org/metadata/' + encodeURIComponent(id));
  return (j.files || [])
    .filter((f) => /mp3/i.test(f.format || '') || /\.mp3$/i.test(f.name || ''))
    .filter((f) => !/_64kb|_vbr\.m3u/i.test(f.name))
    .map((f) => ({
      name: f.name,
      title: f.title || path.basename(f.name, path.extname(f.name)),
      length: f.length,
      url: `https://archive.org/download/${encodeURIComponent(id)}/${f.name.split('/').map(encodeURIComponent).join('/')}`
    }));
});
ipcMain.handle('music:download', async (_e, { url, name }) => {
  const u = new URL(url);
  if (!['incompetech.com', 'archive.org'].some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) throw new Error('Unknown music source');
  const dir = mediaDir('music');
  const p = path.join(dir, safeName(name));
  if (fs.existsSync(p) && fs.statSync(p).size > 1000) return p;
  const res = await net.fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(p, buf);
  return p;
});

// ---------- export ----------
// The window records the video in real time and streams chunks here.
let exportJob = null;

ipcMain.handle('export:choose', async (_e, { format, name }) => {
  const ext = format === 'webm' ? 'webm' : 'mp4';
  const r = await dialog.showSaveDialog(win, {
    title: 'Export video',
    defaultPath: path.join(app.getPath('videos'), `${safeName(name || 'Flux video')}.${ext}`),
    filters: [{ name: ext.toUpperCase() + ' video', extensions: [ext] }]
  });
  return r.canceled ? null : r.filePath;
});
ipcMain.handle('export:begin', () => {
  const tmp = path.join(os.tmpdir(), `flux-export-${Date.now()}.webm`);
  exportJob = { tmp, fd: fs.openSync(tmp, 'w') };
  return true;
});
ipcMain.handle('export:chunk', (_e, buf) => {
  if (exportJob) fs.writeSync(exportJob.fd, Buffer.from(buf));
  return true;
});
ipcMain.handle('export:cancel', () => {
  if (!exportJob) return;
  try { fs.closeSync(exportJob.fd); } catch {}
  if (exportJob.proc) try { exportJob.proc.kill(); } catch {}
  try { fs.unlinkSync(exportJob.tmp); } catch {}
  exportJob = null;
});
function ffmpegPath() {
  try {
    let p = require('ffmpeg-static');
    if (p) p = p.replace('app.asar', 'app.asar.unpacked');
    if (p && fs.existsSync(p)) return p;
  } catch {}
  return null;
}
ipcMain.handle('export:finish', async (_e, { target, format, duration, quality, fps }) => {
  if (!exportJob) return { ok: false, error: 'No export in progress' };
  try { fs.closeSync(exportJob.fd); } catch {}
  const { tmp } = exportJob;
  const ff = ffmpegPath();
  if (!ff) {
    let finalTarget = target;
    if (format !== 'webm') finalTarget = target.replace(/\.mp4$/i, '.webm');
    fs.copyFileSync(tmp, finalTarget); fs.unlinkSync(tmp); exportJob = null;
    return { ok: true, path: finalTarget, note: format !== 'webm' ? 'Saved as WebM (MP4 converter not installed - run "npm install").' : null };
  }
  const crf = quality === 'high' ? '18' : quality === 'small' ? '28' : '22';
  const args = format === 'webm'
    ? ['-y', '-i', tmp, '-c', 'copy', target]
    : ['-y', '-i', tmp, '-c:v', 'libx264', '-preset', 'medium', '-crf', crf, '-pix_fmt', 'yuv420p',
       '-r', String(fps || 30), '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', target];
  return await new Promise((resolve) => {
    const proc = spawn(ff, args);
    exportJob.proc = proc;
    let errText = '';
    proc.stderr.on('data', (d) => {
      const s = d.toString(); errText = (errText + s).slice(-4000);
      const m = /time=(\d+):(\d+):(\d+\.\d+)/.exec(s);
      if (m && duration && win) {
        const t = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
        win.webContents.send('export:convert-progress', Math.min(1, t / duration));
      }
    });
    proc.on('close', (code) => {
      try { fs.unlinkSync(tmp); } catch {}
      exportJob = null;
      if (code === 0) resolve({ ok: true, path: target });
      else resolve({ ok: false, error: 'Converting the video failed.\n' + errText.split('\n').slice(-6).join('\n') });
    });
  });
});


// ===================== Export engine 2 =====================
// Video frames are rendered by the app and encoded (H.264) frame by frame - nothing is skipped, no matter how
// slow the computer is. Sound is mixed separately (faster than real time). ffmpeg then puts them together.
// Simple edits (just cuts of videos/photos) skip the frame renderer and go straight to ffmpeg = much faster.
let exp2 = null;
const send = (ch, v) => { try { if (win && !win.isDestroyed()) win.webContents.send(ch, v); } catch {} };
let encoderCache = null;
function runQuick(ff, args, ms = 15000) {
  return new Promise((resolve) => {
    let done = false;
    const p = spawn(ff, args, { windowsHide: true });
    const t = setTimeout(() => { if (!done) { done = true; try { p.kill(); } catch {} resolve(false); } }, ms);
    p.on('error', () => { if (!done) { done = true; clearTimeout(t); resolve(false); } });
    p.on('close', (code) => { if (!done) { done = true; clearTimeout(t); resolve(code === 0); } });
  });
}
// Find the fastest H.264 encoder this computer has (graphics card first), once.
async function pickEncoder(ff) {
  if (encoderCache) return encoderCache;
  const list = process.platform === 'darwin' ? ['h264_videotoolbox'] : ['h264_nvenc', 'h264_qsv', 'h264_amf'];
  for (const enc of list) {
    const ok = await runQuick(ff, ['-hide_banner', '-v', 'error', '-f', 'lavfi', '-i', 'color=black:s=640x360:r=30:d=0.3', '-c:v', enc, '-f', 'null', '-']);
    if (ok) { encoderCache = enc; return enc; }
  }
  encoderCache = 'libx264';
  return encoderCache;
}
function encoderArgs(enc, quality, w, h, fps) {
  const q = { high: 0, standard: 1, small: 2 }[quality] ?? 1;
  const kbps = Math.round((w * h * fps * [0.16, 0.1, 0.055][q]) / 1000);
  switch (enc) {
    case 'h264_nvenc': return ['-c:v', 'h264_nvenc', '-preset', 'p5', '-tune', 'hq', '-rc', 'vbr', '-cq', String([17, 21, 27][q]), '-b:v', '0', '-maxrate', kbps * 2 + 'k', '-bufsize', kbps * 4 + 'k', '-profile:v', 'high', '-spatial-aq', '1'];
    case 'h264_qsv': return ['-c:v', 'h264_qsv', '-preset', 'medium', '-global_quality', String([18, 22, 28][q]), '-look_ahead', '0'];
    case 'h264_amf': return ['-c:v', 'h264_amf', '-quality', 'quality', '-rc', 'cqp', '-qp_i', String([17, 21, 27][q]), '-qp_p', String([19, 23, 29][q]), '-qp_b', String([21, 25, 31][q])];
    case 'h264_videotoolbox': return ['-c:v', 'h264_videotoolbox', '-b:v', kbps + 'k', '-profile:v', 'high'];
    default: return ['-c:v', 'libx264', '-preset', 'faster', '-crf', String([17, 20, 26][q]), '-profile:v', 'high'];
  }
}
function exp2Clean() {
  if (!exp2) return;
  try { fs.closeSync(exp2.vfd); } catch {}
  try { fs.closeSync(exp2.afd); } catch {}
  if (exp2.proc) try { exp2.proc.kill(); } catch {}
  try { fs.rmSync(exp2.dir, { recursive: true, force: true }); } catch {}
  exp2 = null;
}
ipcMain.handle('exp2:begin', () => {
  exp2Clean();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flux-export-'));
  exp2 = { dir, v: path.join(dir, 'video.h264'), a: path.join(dir, 'sound.pcm') };
  exp2.vfd = fs.openSync(exp2.v, 'w');
  exp2.afd = fs.openSync(exp2.a, 'w');
  return { ok: !!ffmpegPath() };
});
ipcMain.handle('exp2:video', (_e, buf) => { if (exp2) fs.writeSync(exp2.vfd, Buffer.from(buf)); return true; });
ipcMain.handle('exp2:audio', (_e, buf) => { if (exp2) fs.writeSync(exp2.afd, Buffer.from(buf)); return true; });
ipcMain.handle('exp2:cancel', () => { exp2Clean(); return true; });
// Sound from part of a file, at a speed (pitch kept), as 48 kHz stereo float samples
function atempoChain(speed) {
  const out = [];
  let s = speed;
  while (s > 2) { out.push('atempo=2'); s /= 2; }
  while (s < 0.5) { out.push('atempo=0.5'); s /= 0.5; }
  if (Math.abs(s - 1) > 1e-4) out.push('atempo=' + s.toFixed(5));
  return out.join(',');
}
ipcMain.handle('audio:extract', (_e, { file, start, dur, speed }) => new Promise((resolve) => {
  const ff = ffmpegPath();
  if (!ff || !fs.existsSync(file)) return resolve(null);
  const af = atempoChain(speed || 1);
  const args = ['-v', 'error', '-ss', Math.max(0, start).toFixed(4), '-t', Math.max(0.01, dur).toFixed(4), '-i', file, '-vn', '-ac', '2', '-ar', '48000'];
  if (af) args.push('-af', af);
  args.push('-f', 'f32le', 'pipe:1');
  const p = spawn(ff, args, { windowsHide: true });
  const parts = [];
  p.stdout.on('data', (d) => parts.push(d));
  p.on('error', () => resolve(null));
  p.on('close', () => { const b = Buffer.concat(parts); resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); });
}));
function runFfmpeg(args, duration) {
  const ff = ffmpegPath();
  return new Promise((resolve) => {
    const proc = spawn(ff, args, { windowsHide: true });
    if (exp2) exp2.proc = proc;
    let errText = '';
    proc.stderr.on('data', (d) => {
      const s = d.toString(); errText = (errText + s).slice(-6000);
      const m = /time=(\d+):(\d+):(\d+\.\d+)/.exec(s);
      if (m && duration) send('exp2:progress', Math.min(1, ((+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3])) / duration));
    });
    proc.on('error', (e) => resolve({ ok: false, error: String(e) }));
    proc.on('close', (code) => resolve(code === 0 ? { ok: true } : { ok: false, error: errText.split('\n').filter(Boolean).slice(-6).join('\n') }));
  });
}
function audioOut(format) { return format === 'webm' ? ['-c:a', 'libopus', '-b:a', '256k'] : ['-c:a', 'aac', '-b:a', '320k']; }
// frames from the app + mixed sound -> final file
ipcMain.handle('exp2:finish', async (_e, { target, fps, format, quality, duration, w, h }) => {
  if (!exp2) return { ok: false, error: 'No export in progress' };
  try { fs.closeSync(exp2.vfd); } catch {}
  try { fs.closeSync(exp2.afd); } catch {}
  const vArgs = format === 'webm'
    ? ['-c:v', 'libvpx-vp9', '-crf', String({ high: 24, standard: 30, small: 36 }[quality] || 30), '-b:v', '0', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1']
    : ['-c:v', 'copy'];
  const args = ['-y', '-hide_banner', '-fflags', '+genpts', '-r', String(fps), '-f', 'h264', '-i', exp2.v,
    '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', exp2.a, '-map', '0:v:0', '-map', '1:a:0', ...vArgs, ...audioOut(format),
    '-t', duration.toFixed(3), '-movflags', '+faststart', target];
  const r = await runFfmpeg(args, duration);
  exp2Clean();
  return r.ok ? { ok: true, path: target } : { ok: false, error: 'Saving the video failed.\n' + r.error };
});
// the fast way: ffmpeg cuts and joins the original files itself
ipcMain.handle('exp2:direct', async (_e, { target, fps, format, quality, duration, w, h, bg, segs }) => {
  if (!exp2) return { ok: false, error: 'No export in progress' };
  try { fs.closeSync(exp2.afd); } catch {}
  const ff = ffmpegPath();
  const enc = format === 'webm' ? 'vp9' : await pickEncoder(ff);
  const inputs = [], filters = [];
  const col = (bg || '#000000').replace('#', '0x');
  let k = 0;
  for (const sg of segs) {
    const d = sg.dur.toFixed(4);
    if (sg.type === 'gap') { filters.push(`color=c=${col}:s=${w}x${h}:r=${fps}:d=${d},format=yuv420p,setsar=1[v${k}]`); k++; continue; }
    const idx = inputs.filter((x) => x === '-i').length;
    if (sg.kind === 'image') inputs.push('-loop', '1', '-framerate', String(fps), '-t', d, '-i', sg.file);
    else inputs.push('-ss', Math.max(0, sg.in).toFixed(4), '-t', (sg.dur * sg.speed + 0.25).toFixed(4), '-i', sg.file);
    const fit = sg.fit === 'cover'
      ? `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`
      : `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${col}`;
    const sp = sg.kind === 'image' ? 'setpts=PTS-STARTPTS' : `setpts=(PTS-STARTPTS)/${sg.speed}`;
    filters.push(`[${idx}:v]${sp},fps=${fps},${fit},setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=${d},trim=duration=${d},setpts=PTS-STARTPTS[v${k}]`);
    k++;
  }
  const aIdx = inputs.filter((x) => x === '-i').length;
  filters.push(Array.from({ length: k }, (_, i) => `[v${i}]`).join('') + `concat=n=${k}:v=1:a=0[vout]`);
  const fgFile = path.join(exp2.dir, 'graph.txt');
  fs.writeFileSync(fgFile, filters.join(';\n'));
  const vArgs = enc === 'vp9'
    ? ['-c:v', 'libvpx-vp9', '-crf', String({ high: 24, standard: 30, small: 36 }[quality] || 30), '-b:v', '0', '-deadline', 'good', '-cpu-used', '4', '-row-mt', '1']
    : [...encoderArgs(enc, quality, w, h, fps), '-pix_fmt', 'yuv420p', '-g', String(fps * 2)];
  const args = ['-y', '-hide_banner', ...inputs, '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', exp2.a,
    '-filter_complex_script', fgFile, '-map', '[vout]', '-map', `${aIdx}:a:0`, ...vArgs, ...audioOut(format), '-r', String(fps),
    '-t', duration.toFixed(3), '-movflags', '+faststart', target];
  let r = await runFfmpeg(args, duration);
  if (!r.ok && enc !== 'libx264' && enc !== 'vp9') {
    // the graphics card encoder failed on this video - do it with the normal encoder
    encoderCache = 'libx264';
    const i = args.indexOf('-c:v'), j = args.indexOf('-pix_fmt');
    args.splice(i, j - i, ...encoderArgs('libx264', quality, w, h, fps));
    r = await runFfmpeg(args, duration);
  }
  exp2Clean();
  return r.ok ? { ok: true, path: target, encoder: enc } : { ok: false, error: 'Saving the video failed.\n' + r.error };
});

ipcMain.handle('shell:show', (_e, p) => shell.showItemInFolder(p));


// ---------- waveforms: how loud the sound is, 40 times a second ----------
ipcMain.handle('media:peaks', (_e, file) => new Promise((resolve) => {
  const ff = ffmpegPath();
  if (!ff) return resolve(null);
  const RATE = 4000, PER = RATE / 40;
  const p = spawn(ff, ['-v', 'error', '-i', file, '-vn', '-ac', '1', '-ar', String(RATE), '-f', 'f32le', '-']);
  const peaks = [];
  let cur = 0, n = 0, rest = Buffer.alloc(0), gotAudio = false;
  p.stdout.on('data', (d) => {
    gotAudio = true;
    const buf = rest.length ? Buffer.concat([rest, d]) : d;
    const usable = buf.length - (buf.length % 4);
    for (let i = 0; i < usable; i += 4) {
      const v = Math.abs(buf.readFloatLE(i));
      if (v > cur) cur = v;
      if (++n >= PER) { peaks.push(cur); cur = 0; n = 0; }
    }
    rest = buf.subarray(usable);
  });
  p.on('close', () => { if (n) peaks.push(cur); resolve(gotAudio ? { peaks } : { peaks: [], silent: true }); });
  p.on('error', () => resolve(null));
}));

// ---------- Video frames for the timeline (one picture sheet per video, cached) ----------
const stripJobs = new Map();
ipcMain.handle('media:strip', (_e, { file, duration, count }) => {
  const ff = ffmpegPath();
  if (!ff || !file) return null;
  let st; try { st = fs.statSync(file); } catch { return null; }
  const n = Math.max(4, Math.min(160, Math.round(count || 30)));
  const cols = 10, rows = Math.ceil(n / cols);
  const key = require('crypto').createHash('md5').update(file + '|' + st.size + '|' + st.mtimeMs + '|' + n).digest('hex');
  const out = path.join(ensureDir(path.join(dataDir(), 'cache', 'strips')), key + '.jpg');
  if (fs.existsSync(out)) return { file: out, n, cols, rows };
  if (stripJobs.has(key)) return stripJobs.get(key);
  const job = new Promise((resolve) => {
    const d = Math.max(0.1, +duration || 1);
    const vf = `fps=${(n / d).toFixed(6)},scale=-2:90,tile=${cols}x${rows}`;
    const p = spawn(ff, ['-v', 'error', '-y', '-i', file, '-an', '-vf', vf, '-frames:v', '1', '-q:v', '5', out]);
    p.on('close', (code) => resolve(code === 0 && fs.existsSync(out) ? { file: out, n, cols, rows } : null));
    p.on('error', () => resolve(null));
  }).finally(() => stripJobs.delete(key));
  stripJobs.set(key, job);
  return job;
});

// ---------- version history (Time machine) ----------
const versionsFile = (id) => path.join(projectsDir(), safeId(id) + '.versions.json');
ipcMain.handle('versions:list', (_e, id) => { try { return JSON.parse(fs.readFileSync(versionsFile(id), 'utf8')); } catch { return []; } });
ipcMain.handle('versions:add', (_e, { id, version }) => {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(versionsFile(id), 'utf8')); } catch {}
  list.push(version);
  if (list.length > 40) list = list.slice(-40);
  fs.writeFileSync(versionsFile(id), JSON.stringify(list));
  return list.length;
});

// ---------- AI Editor (uses your own Anthropic API key) ----------
ipcMain.handle('ai:chat', async (_e, { key, model, system, messages }) => {
  const res = await net.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 2500, system, messages })
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) return { error: (j.error && j.error.message) || ('HTTP ' + res.status) };
  return { text: (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n') };
});

// ---------- Speech to text (captions & bleeping) - runs locally with Whisper ----------
let asrCache = { name: null, pipe: null };
function extractPcm(file, start, end) {
  return new Promise((resolve, reject) => {
    const ff = ffmpegPath();
    if (!ff) return reject(new Error('The audio tool is missing - run Install Flux.bat again.'));
    const args = ['-v', 'error'];
    if (start > 0) args.push('-ss', String(start));
    if (end > start) args.push('-t', String(end - start));
    args.push('-i', file, '-vn', '-ac', '1', '-ar', '16000', '-f', 'f32le', '-');
    const p = spawn(ff, args);
    const chunks = [];
    let err = '';
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => { err += d; });
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error('Could not read the audio: ' + err.slice(-300)));
      const buf = Buffer.concat(chunks);
      resolve(new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.length / 4)));
    });
  });
}
async function getAsr(size, send) {
  const name = 'Xenova/whisper-' + (['tiny', 'base', 'small'].includes(size) ? size : 'base');
  if (asrCache.name === name) return asrCache.pipe;
  const { pipeline, env } = await import('@huggingface/transformers');
  env.cacheDir = ensureDir(path.join(dataDir(), 'models'));
  const files = {};
  const pipe = await pipeline('automatic-speech-recognition', name, {
    dtype: 'q8',
    progress_callback: (p) => {
      if (p.status === 'progress' && p.total) {
        files[p.file] = [p.loaded, p.total];
        const all = Object.values(files);
        send({ stage: 'download', value: all.reduce((a, f) => a + f[0], 0) / all.reduce((a, f) => a + f[1], 0) });
      }
    }
  });
  asrCache = { name, pipe };
  return pipe;
}
ipcMain.handle('asr:transcribe', async (e, { file, start, end, model, language }) => {
  const send = (v) => { try { e.sender.send('asr:progress', v); } catch {} };
  try {
    send({ stage: 'audio', value: 0 });
    const audio = await extractPcm(file, start || 0, end || 0);
    if (!audio.length) return { words: [] };
    send({ stage: 'download', value: 0 });
    const asr = await getAsr(model, send);
    send({ stage: 'listen', value: 0 });
    const opts = { chunk_length_s: 30, stride_length_s: 5, task: 'transcribe' };
    if (language && language !== 'auto') opts.language = language;
    let out, wordLevel = true;
    try { out = await asr(audio, { ...opts, return_timestamps: 'word' }); }
    catch (err) { wordLevel = false; out = await asr(audio, { ...opts, return_timestamps: true }); }
    const words = [];
    for (const ch of out.chunks || []) {
      const [s, e2] = ch.timestamp || [0, 0];
      const text = String(ch.text || '').trim();
      if (!text) continue;
      const end2 = e2 == null ? s + 0.5 : e2;
      if (wordLevel) { words.push({ w: text, s, e: end2 }); continue; }
      // only phrase timings: spread the words across the phrase by length
      const parts = text.split(/\s+/);
      const total = parts.reduce((a, w) => a + w.length + 1, 0);
      let t = s;
      for (const w of parts) { const d = ((end2 - s) * (w.length + 1)) / total; words.push({ w, s: t, e: t + d }); t += d; }
    }
    send({ stage: 'done', value: 1 });
    return { words };
  } catch (err) {
    console.error(err);
    return { error: err.message || String(err) };
  }
});

// ---------- Premium licence keys (Lemon Squeezy) ----------
async function lsCall(endpoint, fields) {
  const res = await net.fetch('https://api.lemonsqueezy.com/v1/licenses/' + endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields).toString()
  });
  return res.json();
}
ipcMain.handle('license:activate', async (_e, key) => {
  try { return await lsCall('activate', { license_key: key, instance_name: os.hostname() || 'Flux PC' }); }
  catch (err) { return { error: 'Could not reach the licence server. Check your internet connection.' }; }
});
ipcMain.handle('license:validate', async (_e, { key, instanceId }) => {
  try { return await lsCall('validate', { license_key: key, instance_id: instanceId }); }
  catch { return { offline: true }; }
});

// ---------- Fonts (downloaded from Google Fonts once, then kept offline) ----------
const fontJobs = new Map();
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
async function downloadFont(family, weights) {
  const dir = ensureDir(path.join(dataDir(), 'fonts'));
  const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const manifest = path.join(dir, slug + '.json');
  try { const m = JSON.parse(fs.readFileSync(manifest, 'utf8')); if (m.length && m.every((f) => fs.existsSync(f.file))) return m; } catch {}
  const faces = [];
  for (const w of weights) {
    const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${w}&display=swap`;
    const res = await net.fetch(url, { headers: { 'User-Agent': CHROME_UA } });
    if (!res.ok) { if (w === weights[0]) throw new Error('Font not found: ' + family); continue; }
    const css = await res.text();
    const re = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g;
    let mm;
    while ((mm = re.exec(css))) {
      const sub = mm[1] || '', b = mm[2];
      const src = (/url\((https:[^)]+)\)/.exec(b) || [])[1];
      const range = (/unicode-range:\s*([^;]+);/.exec(b) || [])[1] || '';
      if (!src) continue;
      // keep the subsets that cover European languages (incl. Romanian)
      if (sub && !/^latin(-ext)?$/.test(sub)) continue;
      const file = path.join(dir, `${slug}-${w}-${sub || 'all'}.woff2`);
      if (!fs.existsSync(file)) {
        const f = await net.fetch(src, { headers: { 'User-Agent': CHROME_UA } });
        if (!f.ok) continue;
        fs.writeFileSync(file, Buffer.from(await f.arrayBuffer()));
      }
      faces.push({ file, weight: w, range });
    }
  }
  if (!faces.length) throw new Error('Could not download ' + family);
  fs.writeFileSync(manifest, JSON.stringify(faces));
  return faces;
}
ipcMain.handle('font:get', async (_e, { family, weights }) => {
  const key = family + '|' + (weights || []).join(',');
  if (!fontJobs.has(key)) fontJobs.set(key, downloadFont(String(family), (weights && weights.length ? weights : [400]).map(Number)).finally(() => setTimeout(() => fontJobs.delete(key), 1000)));
  try { return { faces: await fontJobs.get(key) }; } catch (err) { return { error: err.message || String(err) }; }
});

// ---------- Updates (from GitHub Releases) ----------
const REPO = 'Noriikx/flux-editor';
const verNum = (v) => String(v || '0').replace(/^v/, '').split('.').map((x) => parseInt(x, 10) || 0);
const newer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
function updateAsset(rel) {
  const assets = rel.assets || [];
  if (process.platform === 'win32') return assets.find((a) => /\.exe$/i.test(a.name));
  if (process.platform === 'darwin') return assets.find((a) => a.name === `Flux-mac-${process.arch}.dmg`) || assets.find((a) => /\.dmg$/i.test(a.name));
  return null;
}
// Pick the newest release that already has an installer for this computer
// (a brand-new release needs ~10 minutes before its installer is uploaded).
let pendingRelease = null;
async function findUpdate() {
  const res = await net.fetch(`https://api.github.com/repos/${REPO}/releases?per_page=15`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Flux' } });
  if (!res.ok) throw Object.assign(new Error('Could not check for updates (' + res.status + ')'), { status: res.status });
  const list = (await res.json()).filter((r) => !r.draft && !r.prerelease)
    .sort((a, b) => (newer(String(a.tag_name).replace(/^v/, ''), String(b.tag_name).replace(/^v/, '')) ? -1 : 1));
  const newest = list[0];
  const ready = list.find((r) => updateAsset(r));
  return { newest, ready };
}
ipcMain.handle('update:check', async () => {
  try {
    const { newest, ready } = await findUpdate();
    const cur = app.getVersion();
    const latest = ready ? String(ready.tag_name).replace(/^v/, '') : cur;
    const newestV = newest ? String(newest.tag_name).replace(/^v/, '') : cur;
    const asset = ready ? updateAsset(ready) : null;
    const available = !!asset && newer(latest, cur);
    pendingRelease = available ? ready : null;
    return {
      current: cur, latest, available, notes: ready ? ready.body || '' : '', size: asset ? asset.size : 0,
      preparing: newer(newestV, cur) && newestV !== latest ? newestV : null
    };
  } catch (err) { return { error: err.status ? err.message : 'No internet connection.' }; }
});
let updating = false;
ipcMain.handle('update:install', async (e) => {
  if (updating) return { error: 'Already updating' };
  updating = true;
  const send = (v) => { try { e.sender.send('update:progress', v); } catch {} };
  try {
    const rel = pendingRelease || (await findUpdate()).ready;
    const asset = rel && updateAsset(rel);
    if (!asset) throw new Error('No download for this computer yet. Try again later.');
    const file = path.join(os.tmpdir(), asset.name.replace(/(\.\w+)$/, '-' + String(rel.tag_name).replace(/[^\w.-]/g, '') + '$1'));
    const dl = await net.fetch(asset.browser_download_url);
    if (!dl.ok || !dl.body) throw new Error('Download failed (' + dl.status + ')');
    const total = +dl.headers.get('content-length') || asset.size || 0;
    const out = fs.createWriteStream(file);
    let got = 0;
    const reader = dl.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(Buffer.from(value))) await new Promise((r) => out.once('drain', r));
      send({ value: total ? got / total : 0 });
    }
    await new Promise((r, j) => out.end((err) => (err ? j(err) : r())));
    if (total && got < total) throw new Error('The download was cut off. Try again.');
    send({ value: 1, stage: 'install' });
    if (process.platform === 'win32') {
      // Silent install over the current version, then start Flux again.
      spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
      setTimeout(() => app.quit(), 600);
    } else {
      await shell.openPath(file);
    }
    return { ok: true };
  } catch (err) {
    updating = false;
    return { error: err.message || String(err) };
  }
});
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:openExternal', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });

// Stripe licence keys: FLUX-<data>.<signature>, signed by your website after payment, checked here offline.
ipcMain.handle('license:verify', (_e, { key, publicKey }) => {
  try {
    const m = /^FLUX-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(key).trim());
    if (!m) return { ok: false };
    const pub = require('crypto').createPublicKey({ key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki' });
    const data = Buffer.from(m[1], 'base64url');
    const ok = require('crypto').verify(null, data, pub, Buffer.from(m[2], 'base64url'));
    if (!ok) return { ok: false };
    const info = JSON.parse(data.toString('utf8'));
    return { ok: true, email: info.e };
  } catch { return { ok: false }; }
});

app.commandLine.appendSwitch('disable-renderer-backgrounding');
// Only one Flux at a time: opening it again brings the open window to the front
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});
app.whenReady().then(async () => {
  if (!gotLock) return;
  await startMediaServer();
  // Allow the microphone (for voiceovers) and choosing speakers/headphones
  const allowed = ['media', 'speaker-selection', 'clipboard-sanitized-write', 'fullscreen'];
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.includes(permission)));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.includes(permission) || permission === 'media');
  registerProtocol();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
