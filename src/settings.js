/* =====================================================================
   Flux — Settings: keyboard shortcuts, audio devices and general options
   ===================================================================== */
'use strict';

const DEFAULT_SETTINGS = {
  keybinds: {},              // filled from ACTIONS defaults
  startFullscreen: true,
  linkAV: false,             // keep a video and its sound linked (move/trim together)
  autoAspect: true,
  transitionDur: 0.6,
  inputDevice: 'default',
  outputDevice: 'default',
  showTips: true,
  previewQuality: 'auto',
  proxies: true,             // make light copies of long / .mkv videos for smooth editing
  aiKey: '',
  aiModel: 'claude-sonnet-5-5',
  asrModel: '',
  asrLang: 'auto',
  multiKey: 'shift'          // hold this + click to select several clips / keyframes
};

// Every action that can have a shortcut. `global` = also works on the home screen / inside dialogs.
const ACTIONS = [
  { id: 'play', label: 'Play / pause', group: 'Playback', keys: ['Space'], run: () => togglePlay() },
  { id: 'frameBack', label: 'Back 1 frame', group: 'Playback', keys: ['ArrowLeft'], run: () => stepFrames(-1) },
  { id: 'frameFwd', label: 'Forward 1 frame', group: 'Playback', keys: ['ArrowRight'], run: () => stepFrames(1) },
  { id: 'jumpBack', label: 'Back 1 second', group: 'Playback', keys: ['Shift+ArrowLeft'], run: () => seek(state.time - 1) },
  { id: 'jumpFwd', label: 'Forward 1 second', group: 'Playback', keys: ['Shift+ArrowRight'], run: () => seek(state.time + 1) },
  { id: 'goStart', label: 'Go to start', group: 'Playback', keys: ['Home'], run: () => seek(0) },
  { id: 'goEnd', label: 'Go to end', group: 'Playback', keys: ['End'], run: () => seek(projectDuration()) },
  { id: 'loop', label: 'Loop on / off', group: 'Playback', keys: ['L'], run: () => $('#btnLoop').click() },
  { id: 'previewFullscreen', label: 'Full screen preview', group: 'Playback', keys: ['F'], run: () => toggleFullscreen() },
  { id: 'prevEdit', label: 'Previous edit point', group: 'Playback', keys: ['ArrowUp'], run: () => jumpEdit(-1) },
  { id: 'nextEdit', label: 'Next edit point', group: 'Playback', keys: ['ArrowDown'], run: () => jumpEdit(1) },
  { id: 'markIn', label: 'Mark In point', group: 'Playback', keys: ['I'], run: () => setRange('in') },
  { id: 'markOut', label: 'Mark Out point', group: 'Playback', keys: ['O'], run: () => setRange('out') },
  { id: 'clearRange', label: 'Clear In / Out', group: 'Playback', keys: ['Alt+X'], run: () => clearRange() },

  { id: 'split', label: 'Split clip', group: 'Editing', keys: ['S', 'Ctrl+B'], run: () => splitAt() },
  { id: 'delete', label: 'Delete clip (or picked library items)', group: 'Editing', keys: ['Delete', 'Backspace'], run: () => { if (rt.libFocus && removePickedMedia()) return; deleteSelected(); } },
  { id: 'rippleDelete', label: 'Delete & close gap', group: 'Editing', keys: ['Shift+Delete', 'Shift+Backspace'], run: () => deleteSelected(true) },
  { id: 'rippleTrimStart', label: 'Ripple trim start to playhead (cut the left part)', group: 'Editing', keys: ['Q'], run: () => trimToPlayhead('start', true) },
  { id: 'rippleTrimEnd', label: 'Ripple trim end to playhead (cut the right part)', group: 'Editing', keys: ['W'], run: () => trimToPlayhead('end', true) },
  { id: 'trimStart', label: 'Trim start to playhead (leave a gap)', group: 'Editing', keys: ['Shift+Q'], run: () => trimToPlayhead('start', false) },
  { id: 'trimEnd', label: 'Trim end to playhead (leave a gap)', group: 'Editing', keys: ['Shift+W'], run: () => trimToPlayhead('end', false) },
  { id: 'splitAll', label: 'Split all tracks at playhead', group: 'Editing', keys: ['Ctrl+Shift+B'], run: () => splitAllTracks() },
  { id: 'toggleClip', label: 'Turn clip on / off', group: 'Editing', keys: ['V'], run: () => toggleClipEnabled() },
  { id: 'nudgeLeft', label: 'Nudge clip 1 frame left', group: 'Editing', keys: ['Alt+ArrowLeft'], run: () => nudgeSelected(-1) },
  { id: 'nudgeRight', label: 'Nudge clip 1 frame right', group: 'Editing', keys: ['Alt+ArrowRight'], run: () => nudgeSelected(1) },
  { id: 'compound', label: 'Make compound clip', group: 'Editing', keys: ['Alt+C'], run: () => makeCompound() },
  { id: 'decompose', label: 'Decompose compound clip', group: 'Editing', keys: ['Alt+Shift+C'], run: () => decompose() },
  { id: 'normalize', label: 'Normalize volume', group: 'Editing', keys: [], run: () => normalizeClip() },
  { id: 'addKeyframe', label: 'Add keyframe', group: 'Keyframes', keys: ['K'], run: () => { const c = getClip(state.selectedId); if (!c) return toast('Click a clip first'); if (c.kind === 'audio') toggleKeyframe(c, 'volume'); else addKeyframeAll(c); } },
  { id: 'prevKey', label: 'Previous keyframe', group: 'Keyframes', keys: ['['], run: () => jumpKeyframe(null, -1) },
  { id: 'nextKey', label: 'Next keyframe', group: 'Keyframes', keys: [']'], run: () => jumpKeyframe(null, 1) },
  { id: 'graphEditor', label: 'Graph editor', group: 'Keyframes', keys: ['G'], run: () => toggleGraphEditor() },
  { id: 'selectAll', label: 'Select all clips', group: 'Editing', keys: ['Ctrl+A'], run: () => selectAllClips() },
  { id: 'duplicate', label: 'Duplicate', group: 'Editing', keys: ['Ctrl+D'], run: () => duplicateSelected() },
  { id: 'copy', label: 'Copy clip', group: 'Editing', keys: ['Ctrl+C'], run: () => copySel() },
  { id: 'paste', label: 'Paste clip', group: 'Editing', keys: ['Ctrl+V'], run: () => paste() },
  { id: 'undo', label: 'Undo', group: 'Editing', keys: ['Ctrl+Z'], run: () => undo() },
  { id: 'redo', label: 'Redo', group: 'Editing', keys: ['Ctrl+Y', 'Ctrl+Shift+Z'], run: () => redo() },
  { id: 'addText', label: 'Add text', group: 'Editing', keys: ['T'], run: () => addText() },
  { id: 'marker', label: 'Add / remove marker', group: 'Editing', keys: ['M'], run: () => toggleMarker() },
  { id: 'prevMarker', label: 'Previous marker', group: 'Editing', keys: [','], run: () => jumpMarker(-1) },
  { id: 'nextMarker', label: 'Next marker', group: 'Editing', keys: ['.'], run: () => jumpMarker(1) },
  { id: 'freeze', label: 'Freeze frame', group: 'Editing', keys: ['Shift+F'], run: () => freezeFrame() },
  { id: 'detach', label: 'Detach audio', group: 'Editing', keys: ['Ctrl+Shift+D'], run: () => detachAudio() },
  { id: 'transition', label: 'Add crossfade to selected clip', group: 'Editing', keys: ['Ctrl+T'], run: () => setTransition(getClip(state.selectedId), 'fade') },
  { id: 'record', label: 'Start / stop voiceover', group: 'Editing', keys: ['R'], run: () => toggleRecording() },
  { id: 'captions', label: 'Auto captions', group: 'Editing', keys: ['C'], run: () => openCaptionsDialog(getClip(state.selectedId)) },
  { id: 'aiEditor', label: 'AI Editor', group: 'Editing', keys: ['Ctrl+K'], run: () => toggleAiPanel() },
  { id: 'timeMachine', label: 'Time machine', group: 'Editing', keys: ['Ctrl+H'], run: () => openTimeMachine() },

  { id: 'zoomIn', label: 'Zoom timeline in', group: 'Timeline', keys: ['=', '+'], run: () => setZoom(state.zoom * 1.4) },
  { id: 'zoomOut', label: 'Zoom timeline out', group: 'Timeline', keys: ['-'], run: () => setZoom(state.zoom / 1.4) },
  { id: 'fit', label: 'Fit timeline', group: 'Timeline', keys: ['Shift+Z'], run: () => fitZoom() },
  { id: 'snap', label: 'Snapping on / off', group: 'Timeline', keys: ['N'], run: () => $('#btnSnap').click() },

  { id: 'import', label: 'Import media', group: 'App', keys: ['Ctrl+I'], run: () => promptImport() },
  { id: 'export', label: 'Export video', group: 'App', keys: ['Ctrl+E'], run: () => openExportDialog() },
  { id: 'save', label: 'Save now', group: 'App', keys: ['Ctrl+S'], run: async () => { await saveNow(); toast('Saved'); } },
  { id: 'newProject', label: 'New project', group: 'App', keys: ['Ctrl+N'], global: true, run: () => newProjectDialog() },
  { id: 'projects', label: 'All projects', group: 'App', keys: ['Ctrl+P'], global: true, run: () => goHome() },
  { id: 'settings', label: 'Settings', group: 'App', keys: ['Ctrl+,'], global: true, run: () => openSettings() },
  { id: 'help', label: 'Help & shortcuts', group: 'App', keys: ['F1', '?'], global: true, run: () => showHelp() },
  { id: 'appFullscreen', label: 'Full screen on / off', group: 'App', keys: ['F11'], global: true, run: () => toggleAppFullscreen() }
];
const actionById = (id) => ACTIONS.find((a) => a.id === id);

let settings = loadSettings();
function loadSettings() {
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  try { Object.assign(s, JSON.parse(localStorage.getItem('flux.settings') || '{}')); } catch {}
  const kb = {};
  for (const a of ACTIONS) kb[a.id] = (s.keybinds && Array.isArray(s.keybinds[a.id])) ? s.keybinds[a.id].slice(0, 2) : a.keys.slice();
  s.keybinds = kb;
  return s;
}
function saveSettings() {
  try { localStorage.setItem('flux.settings', JSON.stringify(settings)); } catch {}
  if (api && api.setStartFullscreen) api.setStartFullscreen(!!settings.startFullscreen);
}

/* ---------- Key combos ---------- */
const MOD_KEYS = ['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock', 'OS'];
function comboFromEvent(e) {
  if (MOD_KEYS.includes(e.key)) return null;
  let key = e.key;
  if (key === ' ' || key === 'Spacebar') key = 'Space';
  if (key === 'Esc') key = 'Escape';
  const printable = key.length === 1;
  if (printable) key = key.toUpperCase();
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  // Shift is part of symbols like "?" or "+", so only count it for letters, numbers and named keys
  if (e.shiftKey && (!printable || /[A-Z0-9]/.test(key))) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}
function actionForCombo(combo) {
  for (const a of ACTIONS) if ((settings.keybinds[a.id] || []).includes(combo)) return a;
  return null;
}
const PRETTY = { ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Delete: 'Del', Backspace: '⌫', Escape: 'Esc', ' ': 'Space' };
function prettyCombo(c) {
  return c.split('+').map((p) => PRETTY[p] || p).join(' + ').replace('+ + +', '+ +');
}
function keyLabel(actionId) {
  const k = (settings.keybinds[actionId] || [])[0];
  return k ? prettyCombo(k) : '';
}

/* ---------- Settings window ---------- */
let keyCapture = null;
function openSettings(tab = 'general') {
  const box = modal(`
    <div class="settings">
      <nav class="settings-nav">
        <h2>Settings</h2>
        <button data-tab="general">General</button>
        <button data-tab="keys">Keyboard shortcuts</button>
        <button data-tab="audio">Audio devices</button>
        <button data-tab="perf">Performance</button>
        <button data-tab="ai">AI Editor</button>
        <button data-tab="about">About</button>
      </nav>
      <div class="settings-body"></div>
    </div>`, { wide: true, onClose: () => { keyCapture = null; } });
  box.classList.add('settings-modal');
  const body = $('.settings-body', box);
  const show = (t) => {
    keyCapture = null;
    $$('.settings-nav button', box).forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    body.innerHTML = '';
    ({ general: settingsGeneral, keys: settingsKeys, audio: settingsAudio, perf: settingsPerf, ai: settingsAi, about: settingsAbout })[t](body);
  };
  $$('.settings-nav button', box).forEach((b) => (b.onclick = () => show(b.dataset.tab)));
  show(tab);
}

function toggleRow(parent, label, desc, get, set) {
  const row = el('label', 'set-row');
  row.innerHTML = `<div><b></b><small></small></div><span class="switch"><input type="checkbox"><i></i></span>`;
  $('b', row).textContent = label;
  $('small', row).textContent = desc;
  const cb = $('input', row);
  cb.checked = !!get();
  cb.onchange = () => { set(cb.checked); saveSettings(); };
  parent.appendChild(row);
}

function settingsGeneral(body) {
  body.innerHTML = '<h3>General</h3>';
  toggleRow(body, 'Open in full screen', 'Flux fills your whole screen when it starts. Press F11 any time to switch.',
    () => settings.startFullscreen, (v) => { settings.startFullscreen = v; });
  toggleRow(body, 'Match video shape automatically', 'When the first clip is vertical or square, switch the project to match.',
    () => settings.autoAspect, (v) => { settings.autoAspect = v; });
  toggleRow(body, 'Keep video & sound linked', 'When on, a video and its sound move and trim together. Off: you can move them separately (right-click a clip to link).',
    () => settings.linkAV, (v) => { settings.linkAV = v; });
  toggleRow(body, 'Show tips', 'Show the “How Flux works” guide when you open a new project.',
    () => settings.showTips, (v) => { settings.showTips = v; });
  const r = el('div', 'set-row');
  r.innerHTML = `<div><b>Default transition length</b><small>Used when you add a new transition.</small></div><div class="set-slider"><input type="range" min="0.2" max="2" step="0.1"><span></span></div>`;
  const inp = $('input', r), val = $('span', r.lastChild);
  inp.value = settings.transitionDur; val.textContent = Number(settings.transitionDur).toFixed(1) + 's'; setRangeFill(inp);
  inp.oninput = () => { settings.transitionDur = +inp.value; val.textContent = (+inp.value).toFixed(1) + 's'; setRangeFill(inp); };
  inp.onchange = saveSettings;
  body.appendChild(r);
}

function settingsKeys(body) {
  body.innerHTML = `<div class="keys-head"><h3>Keyboard shortcuts</h3>
    <input class="num-input keys-search" placeholder="Search…" style="font-family:var(--font)">
    <button class="btn ghost" data-a="reset">Reset all</button></div>
    <div class="set-row"><div><b>Select several clips / keyframes</b><small>Hold this key and click</small></div>
      <select class="dev-select" id="multiKeySel"><option value="shift">Shift + click</option><option value="ctrl">Ctrl + click</option><option value="alt">Alt + click</option></select></div>
    <div class="kb-map"></div>
    <p class="sub" style="margin:14px 0 12px">Or click a shortcut below, then press the keys you want. Each action can have two.</p>
    <div class="keys-list"></div>`;
  const list = $('.keys-list', body);
  let map = null;
  const draw = () => {
    const q = $('.keys-search', body).value.trim().toLowerCase();
    list.innerHTML = '';
    let group = null;
    for (const a of ACTIONS) {
      if (q && !a.label.toLowerCase().includes(q)) continue;
      if (a.group !== group) { group = a.group; list.appendChild(el('div', 'keys-group', group)); }
      const row = el('div', 'key-row');
      row.innerHTML = `<span class="key-label"></span>`;
      $('.key-label', row).textContent = a.label;
      for (let i = 0; i < 2; i++) {
        const combo = settings.keybinds[a.id][i];
        const slot = el('div', 'key-slot');
        const b = el('button', 'key-btn' + (combo ? '' : ' empty'));
        b.textContent = combo ? prettyCombo(combo) : 'Add';
        b.onclick = () => startCapture(a, i, b, draw);
        slot.appendChild(b);
        if (combo) {
          const x = el('button', 'key-clear', '×');
          x.dataset.tip = 'Remove';
          x.onclick = () => { settings.keybinds[a.id].splice(i, 1); saveSettings(); draw(); };
          slot.appendChild(x);
        }
        row.appendChild(slot);
      }
      list.appendChild(row);
    }
    if (map) map.redraw();
  };
  map = keyboardMap($('.kb-map', body), () => draw());
  const mk = $('#multiKeySel', body);
  mk.value = settings.multiKey || 'shift';
  mk.onchange = () => { settings.multiKey = mk.value; saveSettings(); toast('Select several with ' + mk.options[mk.selectedIndex].text); };
  $('.keys-search', body).oninput = draw;
  $('[data-a=reset]', body).onclick = () => {
    for (const a of ACTIONS) settings.keybinds[a.id] = a.keys.slice();
    saveSettings(); draw(); toast('Shortcuts reset to the defaults');
  };
  draw();
}

function startCapture(action, slot, btn, redraw) {
  $$('.key-btn.capturing').forEach((b) => b.classList.remove('capturing'));
  btn.classList.add('capturing');
  btn.textContent = 'Press keys…';
  keyCapture = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') { keyCapture = null; redraw(); return; }
    const combo = comboFromEvent(e);
    if (!combo) return; // waiting for a non-modifier key
    keyCapture = null;
    // Take it away from any other action that used it
    for (const a of ACTIONS) {
      if (a.id === action.id) continue;
      const i = settings.keybinds[a.id].indexOf(combo);
      if (i >= 0) { settings.keybinds[a.id].splice(i, 1); toast(`${prettyCombo(combo)} was removed from “${a.label}”`); }
    }
    const arr = settings.keybinds[action.id];
    const dup = arr.indexOf(combo);
    if (dup >= 0) arr.splice(dup, 1);
    if (slot >= arr.length) arr.push(combo); else arr[slot] = combo;
    settings.keybinds[action.id] = arr.slice(0, 2);
    saveSettings();
    redraw();
  };
}
window.addEventListener('keydown', (e) => { if (keyCapture) keyCapture(e); }, true);

async function listDevices(kind) {
  try {
    let devs = await navigator.mediaDevices.enumerateDevices();
    if (kind === 'audioinput' && devs.filter((d) => d.kind === kind).every((d) => !d.label)) {
      // labels are hidden until the microphone has been allowed once
      try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); } catch {}
      devs = await navigator.mediaDevices.enumerateDevices();
    }
    return devs.filter((d) => d.kind === kind);
  } catch { return []; }
}
async function fillDeviceSelect(sel, kind, current) {
  const devs = await listDevices(kind);
  sel.innerHTML = '';
  const def = el('option'); def.value = 'default'; def.textContent = kind === 'audioinput' ? 'Default microphone' : 'Default speakers / headphones';
  sel.appendChild(def);
  devs.filter((d) => d.deviceId !== 'default' && d.deviceId !== 'communications').forEach((d, i) => {
    const o = el('option');
    o.value = d.deviceId;
    o.textContent = d.label || (kind === 'audioinput' ? 'Microphone ' : 'Output ') + (i + 1);
    sel.appendChild(o);
  });
  sel.value = Array.from(sel.options).some((o) => o.value === current) ? current : 'default';
}
function settingsAudio(body) {
  body.innerHTML = `<h3>Audio devices</h3>
    <div class="set-row col"><b>Microphone (for voiceovers)</b><select id="setIn" class="dev-select"></select></div>
    <div class="set-row col"><b>Play sound through</b><select id="setOut" class="dev-select"></select>
      <button class="btn ghost" id="setTest" style="margin-top:8px;align-self:flex-start">Play test sound</button></div>
    <p class="hint">Plug in headphones or a mic? Press <b>Refresh</b> to see it.</p>
    <button class="btn ghost" id="setRefresh">Refresh devices</button>`;
  const si = $('#setIn', body), so = $('#setOut', body);
  const refresh = () => { fillDeviceSelect(si, 'audioinput', settings.inputDevice); fillDeviceSelect(so, 'audiooutput', settings.outputDevice); };
  refresh();
  si.onchange = () => { settings.inputDevice = si.value; saveSettings(); if (typeof voiceDevicesChanged === 'function') voiceDevicesChanged(); };
  so.onchange = () => { settings.outputDevice = so.value; saveSettings(); applyOutputDevice(so.value); if (typeof voiceDevicesChanged === 'function') voiceDevicesChanged(); };
  $('#setRefresh', body).onclick = refresh;
  $('#setTest', body).onclick = testTone;
}
function testTone() {
  ensureAudio();
  if (!actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.frequency.value = 660; g.gain.value = 0.0001;
  o.connect(g); g.connect(actx.destination);
  const t = actx.currentTime;
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  o.start(t); o.stop(t + 0.65);
}
function settingsPerf(body) {
  const auto = lowEnd();
  body.innerHTML = `<h3>Performance</h3>
    <div class="set-row col"><b>Preview quality</b><small>Lower quality makes playback smooth on older laptops. Exported videos always use full quality.</small>
      <div class="seg tall" id="pq"><button data-v="auto">Auto<small>${auto ? 'Low-end detected' : 'Recommended'}</small></button><button data-v="low">Low<small>Fastest</small></button><button data-v="medium">Medium</button><button data-v="high">High<small>Sharpest</small></button></div></div>
    <p class="hint">This computer: ${navigator.hardwareConcurrency || '?'} CPU threads${navigator.deviceMemory ? ', ' + navigator.deviceMemory + ' GB memory' : ''}.</p>
    <div class="set-row"><div><b>Smooth editing copies</b><small>For long videos and .mkv recordings Flux makes a light copy so playing and dragging the playhead is smooth. Exports always use your original files.</small></div><span class="switch"><input type="checkbox" id="pxOn"><i></i></span></div>
    <div class="set-row"><div><b>Space used by the copies</b><small id="pxSize">…</small></div><button class="btn ghost" id="pxClear">Delete copies</button></div>`;
  const sync = () => $$('#pq button', body).forEach((b) => b.classList.toggle('active', b.dataset.v === (settings.previewQuality || 'auto')));
  $$('#pq button', body).forEach((b) => (b.onclick = () => { settings.previewQuality = b.dataset.v; saveSettings(); sync(); layoutStage(); }));
  sync();
  const on = $('#pxOn', body); on.checked = settings.proxies !== false;
  on.onchange = () => { settings.proxies = on.checked; saveSettings(); for (const m of P.media) if (m.kind === 'video') { reloadPlayersFor(m); if (on.checked) ensureProxy(m); } if (typeof renderMediaBadges === 'function') renderMediaBadges(); };
  const sz = () => api && api.proxySize && api.proxySize().then((n) => { const e = $('#pxSize', body); if (e) e.textContent = formatBytes(n || 0) + ' on this computer'; });
  sz();
  $('#pxClear', body).onclick = async () => {
    if (!api || !api.proxyClear) return;
    for (const m of P.media) { delete m.proxy; delete m.full; reloadPlayersFor(m); }
    await api.proxyClear(); sz(); toast('Copies deleted - they’ll be made again when needed');
    if (typeof renderMediaBadges === 'function') renderMediaBadges();
  };
}
function settingsAi(body) {
  body.innerHTML = `<h3>AI Editor</h3>
    <p class="sub">The AI Editor is included with Premium - nothing to set up.</p>
    <div class="set-row col"><b>Your own Anthropic API key (optional, advanced)</b><small>Only if you want the AI to run on your own key instead. Leave empty to use the one included with Premium.</small>
      <input class="num-input" id="aiKey" type="password" placeholder="sk-ant-…"></div>
    <div class="set-row col"><b>Model</b><input class="num-input" id="aiModel"></div>
    <div class="set-row col"><b>Captions accuracy</b><small>Bigger models are more accurate but slower and download once.</small><select class="dev-select" id="asrModel"></select></div>`;
  const k = $('#aiKey', body), m = $('#aiModel', body), a = $('#asrModel', body);
  k.value = settings.aiKey || ''; m.value = settings.aiModel || 'claude-sonnet-5-5';
  k.onchange = () => { settings.aiKey = k.value.trim(); saveSettings(); };
  m.onchange = () => { settings.aiModel = m.value.trim() || 'claude-sonnet-5-5'; saveSettings(); };
  a.innerHTML = ASR_MODELS.map(([v, n, d]) => `<option value="${v}">${n} (${d})</option>`).join('');
  a.value = settings.asrModel || (lowEnd() ? 'tiny' : 'base');
  a.onchange = () => { settings.asrModel = a.value; saveSettings(); };
}
function settingsAbout(body) {
  body.innerHTML = `<h3>About Flux</h3>
    <div style="display:flex;gap:14px;align-items:center;margin-bottom:14px"><img src="logo.png" style="width:56px;height:56px;border-radius:14px"><div><b style="font-size:16px" class="about-ver">Flux</b><br><small style="color:var(--muted)">A simple, friendly video editor</small></div><span style="flex:1"></span><button class="btn" id="btnCheckUpd">Check for updates</button></div>
    <p class="sub">Projects are saved automatically on this computer. Music from the Music tab comes from Kevin MacLeod (incompetech.com, CC BY 4.0) and the Internet Archive. Check each song's license and add the credit when it asks for one.</p>`;
  if (api && api.appVersion) api.appVersion().then((v) => { const e = $('.about-ver', body); if (e) e.textContent = 'Flux ' + v; });
  $('#btnCheckUpd', body).onclick = async (e) => { e.target.disabled = true; e.target.textContent = 'Checking…'; await checkForUpdates(false); e.target.disabled = false; e.target.textContent = 'Check for updates'; };
}

/* ---------- Full screen ---------- */
function toggleAppFullscreen() {
  if (api && api.toggleFullscreen) api.toggleFullscreen();
  else if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}
