/* =====================================================================
   Flux — Voiceover tab: record your voice on top of the video.
   Pick a microphone and where you hear sound, watch the level meter,
   then press record. The take lands on a "Voiceover" track at the playhead.
   ===================================================================== */
'use strict';

const voice = {
  stream: null, src: null, gain: null, analyser: null, monitor: null, recDest: null,
  rec: null, chunks: [], startAt: 0, startWall: 0, level: 0, peakHold: 0, meterRaf: 0,
  opts: { countdown: true, playVideo: true, muteProject: true, hearSelf: false, noiseReduction: true, micGain: 1 },
  takePreview: null, busy: false
};
try { Object.assign(voice.opts, JSON.parse(localStorage.getItem('flux.voiceOpts') || '{}')); } catch {}
const saveVoiceOpts = () => { try { localStorage.setItem('flux.voiceOpts', JSON.stringify(voice.opts)); } catch {} };

async function openMic() {
  closeMic();
  ensureAudio();
  if (!actx) return false;
  if (actx.state === 'suspended') { try { await actx.resume(); } catch {} }
  const id = settings.inputDevice;
  try {
    voice.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: id && id !== 'default' ? { exact: id } : undefined,
        echoCancellation: voice.opts.noiseReduction, noiseSuppression: voice.opts.noiseReduction, autoGainControl: false,
        channelCount: 1
      }
    });
  } catch (e) {
    console.warn(e);
    setMicStatus(e && e.name === 'NotAllowedError' ? 'Flux isn’t allowed to use the microphone. Check your Windows privacy settings (Microphone).' : 'No microphone found. Plug one in and press Refresh.', true);
    return false;
  }
  voice.src = actx.createMediaStreamSource(voice.stream);
  voice.gain = actx.createGain();
  voice.gain.gain.value = voice.opts.micGain;
  voice.analyser = actx.createAnalyser();
  voice.analyser.fftSize = 1024;
  voice.recDest = actx.createMediaStreamDestination();
  voice.monitor = actx.createGain();
  voice.monitor.gain.value = voice.opts.hearSelf ? 1 : 0;
  voice.src.connect(voice.gain);
  voice.gain.connect(voice.analyser);
  voice.gain.connect(voice.recDest);
  voice.gain.connect(voice.monitor);
  voice.monitor.connect(actx.destination);
  const label = voice.stream.getAudioTracks()[0] ? voice.stream.getAudioTracks()[0].label : '';
  setMicStatus(label ? 'Listening: ' + label : 'Microphone ready');
  startMeter();
  return true;
}
function closeMic() {
  cancelAnimationFrame(voice.meterRaf);
  try { voice.src && voice.src.disconnect(); voice.gain && voice.gain.disconnect(); voice.monitor && voice.monitor.disconnect(); } catch {}
  if (voice.stream) voice.stream.getTracks().forEach((t) => t.stop());
  voice.stream = voice.src = voice.gain = voice.analyser = voice.monitor = voice.recDest = null;
  const bar = $('#vuBar'); if (bar) bar.style.width = '0%';
}
function setMicStatus(text, error) {
  const s = $('#micStatus');
  if (!s) return;
  s.textContent = text;
  s.classList.toggle('error', !!error);
}

function startMeter() {
  const buf = new Float32Array(1024);
  const loop = () => {
    if (!voice.analyser) return;
    voice.analyser.getFloatTimeDomainData(buf);
    let peak = 0, sum = 0;
    for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); sum += buf[i] * buf[i]; if (v > peak) peak = v; }
    const rms = Math.sqrt(sum / buf.length);
    const db = 20 * Math.log10(Math.max(rms, 1e-5));
    const lvl = clamp((db + 60) / 60, 0, 1);
    voice.level = voice.level * 0.6 + lvl * 0.4;
    voice.peakHold = Math.max(peak, voice.peakHold * 0.97);
    const bar = $('#vuBar');
    if (bar) {
      bar.style.width = (voice.level * 100).toFixed(1) + '%';
      bar.classList.toggle('hot', voice.peakHold > 0.95);
    }
    const hint = $('#vuHint');
    if (hint) hint.textContent = voice.peakHold > 0.95 ? 'Too loud - lower the mic volume' : voice.level < 0.25 ? 'Speak to test your level' : 'Good level';
    voice.meterRaf = requestAnimationFrame(loop);
  };
  loop();
}

async function voiceTabShown() {
  renderVoice();
  await fillDeviceSelect($('#vIn'), 'audioinput', settings.inputDevice);
  await fillDeviceSelect($('#vOut'), 'audiooutput', settings.outputDevice);
  if (!voice.stream) openMic();
}
function voiceTabHidden() {
  if (!state.recording) closeMic();
  if (voice.takePreview) voice.takePreview.pause();
}
function voiceDevicesChanged() {
  if ($('#vIn')) { fillDeviceSelect($('#vIn'), 'audioinput', settings.inputDevice); fillDeviceSelect($('#vOut'), 'audiooutput', settings.outputDevice); }
  if (voice.stream && !state.recording) openMic();
}

function toggleRecording() { state.recording ? stopRecording() : startRecording(); }

async function countdown(n) {
  const box = $('#countdown');
  box.classList.add('show');
  for (let i = n; i > 0; i--) {
    box.textContent = i;
    box.classList.remove('tick'); void box.offsetWidth; box.classList.add('tick');
    await new Promise((r) => setTimeout(r, 1000));
    if (voice.cancelCountdown) break;
  }
  box.classList.remove('show');
  const c = voice.cancelCountdown; voice.cancelCountdown = false;
  return !c;
}

async function startRecording() {
  if (!state.inEditor || state.exporting || voice.busy) return;
  if (currentLibTab !== 'voice') showLibTab('voice');
  voice.busy = true;
  try {
    if (!voice.stream && !(await openMic())) { toast('No microphone available', { error: true }); return; }
    if (state.playing) pause();
    $('#recBtn').classList.add('arming');
    if (voice.opts.countdown && !(await countdown(3))) { $('#recBtn').classList.remove('arming'); return; }
    $('#recBtn').classList.remove('arming');
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
    voice.rec = new MediaRecorder(voice.recDest.stream, mime ? { mimeType: mime, audioBitsPerSecond: 160000 } : undefined);
    voice.chunks = [];
    voice.rec.ondataavailable = (e) => { if (e.data && e.data.size) voice.chunks.push(e.data); };
    voice.startAt = state.time;
    voice.startWall = performance.now();
    voice.rec.start(250);
    state.recording = true;
    document.body.classList.add('recording');
    if (voice.opts.playVideo && projectDuration() > state.time + 0.05) {
      if (voice.opts.muteProject && monitorGain) monitorGain.gain.value = 0;
      play();
    }
    renderVoice();
  } finally { voice.busy = false; }
}

function voiceTick() {
  const t = (performance.now() - voice.startWall) / 1000;
  const tm = $('#recTime'); if (tm) tm.textContent = fmt(t);
  const ghost = $('#recGhost');
  if (ghost) {
    ghost.style.left = voice.startAt * state.zoom + 'px';
    ghost.style.width = Math.max(2, t * state.zoom) + 'px';
  }
}

async function stopRecording() {
  if (!state.recording || !voice.rec) return;
  const elapsed = (performance.now() - voice.startWall) / 1000;
  const rec = voice.rec;
  await new Promise((r) => { rec.onstop = r; rec.stop(); });
  voice.rec = null;
  state.recording = false;
  document.body.classList.remove('recording');
  if (state.playing) pause();
  if (monitorGain) monitorGain.gain.value = 1;
  const g = $('#recGhost'); if (g) g.style.width = '0px';
  renderVoice();
  if (elapsed < 0.3 || !voice.chunks.length) { toast('Recording was too short'); return; }
  const blob = new Blob(voice.chunks, { type: voice.chunks[0].type || 'audio/webm' });
  const n = P.media.filter((m) => m.tag === 'voice').length + 1;
  const name = `Voiceover ${n}.webm`;
  let path;
  try {
    path = api && api.saveMediaFile ? await api.saveMediaFile({ folder: 'voiceovers', name, data: await blob.arrayBuffer() }) : URL.createObjectURL(blob);
  } catch (e) { console.error(e); }
  if (!path) return toast("Couldn't save the recording", { error: true });
  const [m] = await importFiles([{ path, name, kind: 'audio', duration: elapsed, tag: 'voice' }]);
  if (!m) return toast("Couldn't load the recording", { error: true });
  const d = m.duration || elapsed;
  // Put it on a free "Voiceover" track (make one if needed)
  let tr = P.tracks.find((x) => x.type === 'audio' && /voice/i.test(x.name) && Math.abs(findFreeStart(x.id, voice.startAt, d) - voice.startAt) < 1e-6);
  if (!tr) {
    const n = P.tracks.filter((x) => /voiceover/i.test(x.name)).length;
    tr = addTrack('audio', n ? 'Voiceover ' + (n + 1) : 'Voiceover');
  }
  addMediaAt(m, tr.id, voice.startAt);
  seek(voice.startAt);
  renderVoice();
  toast(`Saved ${name} - it's on the “${tr.name}” track`);
}

function renderVoice() {
  const btn = $('#recBtn');
  if (!btn) return;
  btn.classList.toggle('on', state.recording);
  $('#recLabel').textContent = state.recording ? 'Stop' : 'Record';
  $('#recTime').textContent = state.recording ? $('#recTime').textContent : fmt(0);
  $('#recHint').innerHTML = state.recording ? 'Recording… press <kbd>' + (keyLabel('record') || 'R') + '</kbd> or the button to stop'
    : `Starts at the playhead (${fmt(state.time)}). Shortcut: <kbd>${keyLabel('record') || 'R'}</kbd>`;
  for (const [k, id] of [['countdown', 'vCount'], ['playVideo', 'vPlay'], ['muteProject', 'vMute'], ['hearSelf', 'vHear'], ['noiseReduction', 'vNoise']]) {
    const cb = $('#' + id); if (cb) cb.checked = !!voice.opts[k];
  }
  const g = $('#vGain');
  if (g && document.activeElement !== g) { g.value = Math.round(voice.opts.micGain * 100); $('#vGainVal').textContent = g.value + '%'; setRangeFill(g); }
  const takes = $('#takes');
  takes.innerHTML = '';
  const list = state.inEditor ? P.media.filter((m) => m.tag === 'voice') : [];
  $('#takesTitle').style.display = list.length ? '' : 'none';
  for (const m of list.slice().reverse()) {
    const row = el('div', 'mrow');
    row.innerHTML = `<button class="mplay" data-tip="Listen"><svg viewBox="0 0 24 24" class="i-p"><path d="M7 4.5v15l13-7.5z"/></svg><svg viewBox="0 0 24 24" class="i-s"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg></button>
      <div class="minfo"><div class="mtitle"></div><div class="msub"></div></div>
      <button class="madd" data-tip="Add at the playhead">${ICON.plus}</button>`;
    $('.mtitle', row).textContent = m.name.replace(/\.webm$/, '');
    $('.msub', row).textContent = (m.duration ? fmt(m.duration) : '') + (P.clips.some((c) => c.mediaId === m.id) ? ' · on timeline' : '');
    $('.mplay', row).onclick = () => {
      if (!voice.takePreview) voice.takePreview = new Audio();
      const a = voice.takePreview;
      if (row.classList.contains('playing')) { a.pause(); row.classList.remove('playing'); return; }
      $$('#takes .mrow.playing').forEach((r) => r.classList.remove('playing'));
      if (settings.outputDevice !== 'default' && a.setSinkId) a.setSinkId(settings.outputDevice).catch(() => {});
      a.src = mediaUrl(m); a.play().catch(() => {});
      row.classList.add('playing');
      a.onended = () => row.classList.remove('playing');
    };
    $('.madd', row).onclick = () => { const tr = audioTrackFreeAt(state.time, m.duration, 'Voiceover') || firstTrack('audio'); addMediaAt(m, tr.id, state.time); };
    takes.appendChild(row);
  }
}

function setupVoice() {
  $('#recBtn').onclick = () => {
    if ($('#countdown').classList.contains('show')) { voice.cancelCountdown = true; return; }
    toggleRecording();
  };
  $('#vIn').onchange = (e) => { settings.inputDevice = e.target.value; saveSettings(); openMic(); };
  $('#vOut').onchange = (e) => { settings.outputDevice = e.target.value; saveSettings(); applyOutputDevice(e.target.value); };
  $('#vRefresh').onclick = () => voiceDevicesChanged();
  $('#vTest').onclick = testTone;
  const bind = (id, key, after) => { $('#' + id).onchange = (e) => { voice.opts[key] = e.target.checked; saveVoiceOpts(); after && after(); }; };
  bind('vCount', 'countdown');
  bind('vPlay', 'playVideo');
  bind('vMute', 'muteProject');
  bind('vHear', 'hearSelf', () => { if (voice.monitor) voice.monitor.gain.value = voice.opts.hearSelf ? 1 : 0; if (voice.opts.hearSelf) toast('Use headphones so the speakers don’t echo into the mic'); });
  bind('vNoise', 'noiseReduction', () => { if (!state.recording) openMic(); });
  const g = $('#vGain');
  g.oninput = () => { voice.opts.micGain = g.value / 100; $('#vGainVal').textContent = g.value + '%'; setRangeFill(g); if (voice.gain) voice.gain.gain.value = voice.opts.micGain; };
  g.onchange = saveVoiceOpts;
  // a red bar on the timeline that grows while you record
  const ghost = el('div'); ghost.id = 'recGhost';
  $('#tlContent').appendChild(ghost);
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => { if (currentLibTab === 'voice') voiceDevicesChanged(); });
}
