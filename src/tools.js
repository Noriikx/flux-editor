/* Flux — "Clip tools": one-click buttons for the selected clip, under the media library. */
'use strict';
const TOOL_ICONS = {
  key: '<path d="M12 3 21 12 12 21 3 12z"/>',
  split: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  freeze: '<path d="M12 2v20M4.9 4.9l14.2 14.2M2 12h20M4.9 19.1 19.1 4.9"/>',
  speed: '<path d="M12 14l4-4"/><path d="M3.3 17a9 9 0 1 1 17.4 0"/>',
  detach: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><path d="M3 3l18 18"/>',
  quality: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10v4M7 12h3M10 10v4M14 10h2.5a2 2 0 0 1 0 4H14z"/>',
  balance: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  mute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M23 9l-6 6M17 9l6 6"/>',
  unmute: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>',
  captions: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M7 15h4M14 15h3M7 11h2M12 11h5"/>',
  bleep: '<path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 14l4 4M21 14l-4 4"/>',
  silence: '<path d="M3 12h3l2-5 3 10 2-5h2"/><path d="M17 9l4 6M21 9l-4 6"/>',
  trans: '<rect x="2" y="6" width="9" height="12" rx="1.5"/><rect x="13" y="6" width="9" height="12" rx="1.5"/><path d="M10 12h4"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  graph: '<path d="M3 3v18h18"/><path d="M6 16c3 0 4-9 7-9s3 6 7 6"/>',
  kprev: '<path d="M15 6l-6 6 6 6"/><path d="M19 12h-1"/>',
  knext: '<path d="M9 6l6 6-6 6"/><path d="M5 12h1"/>'
};
function clipTools(c) {
  const vis = c && isVisual(c), snd = c && soundSource(c);
  const inside = c && state.time >= c.start && state.time <= endOf(c);
  return [
    { id: 'key', tip: 'Add keyframe at the playhead (animate size, position, rotation, opacity)', pro: true, on: vis && inside, fn: () => { addKeyframeAll(c); renderInspector(); } },
    { id: 'kprev', tip: 'Previous keyframe ([)', on: c && c.keys && Object.keys(c.keys).length, fn: () => jumpKeyframe(c, -1) },
    { id: 'knext', tip: 'Next keyframe (])', on: c && c.keys && Object.keys(c.keys).length, fn: () => jumpKeyframe(c, 1) },
    { id: 'graph', tip: 'Graph editor - shape the animation curves (G)', pro: true, on: !!c, fn: () => toggleGraphEditor() },
    { id: 'split', tip: 'Split at the playhead (S)', on: c && inside, fn: () => splitAt(state.time) },
    { id: 'speed', tip: 'Change speed (up to 10x)', on: c && (c.kind === 'video' || c.kind === 'audio'), fn: (b) => speedMenu(c, b) },
    { id: 'freeze', tip: 'Freeze this frame for 2 seconds', on: c && c.kind === 'video' && inside, fn: () => freezeFrame() },
    { id: 'trans', tip: 'Add a transition', on: vis, fn: () => openTransitionsFor(c) },
    { id: 'fit', tip: 'Fill the frame / show the whole picture', on: c && (c.kind === 'video' || c.kind === 'image'), fn: () => commit(() => { c.fit = c.fit === 'cover' ? 'contain' : 'cover'; }) },
    { id: 'quality', tip: 'Quality & frame rate', on: c && (c.kind === 'video' || c.kind === 'image'), fn: () => openQualityDialog(c) },
    { id: 'detach', tip: 'Separate the sound from the video', on: c && c.kind === 'video' && !partners(c).length, fn: () => detachAudio(c) },
    { id: c && soundTarget(c).muted ? 'mute' : 'unmute', tip: c && soundTarget(c).muted ? 'Unmute' : 'Mute', on: c && hasAudio(c), fn: () => commit(() => { const t = soundTarget(c); t.muted = !t.muted; }) },
    { id: 'balance', tip: 'Balance, EQ & ducking', on: c && hasAudio(c) && !(c.kind === 'video' && partners(c).length), fn: () => openBalanceDialog(c) },
    { id: 'captions', tip: 'Auto captions', on: snd, fn: () => openCaptionsDialog(c) },
    { id: 'bleep', tip: 'Bleep swear words', pro: true, on: snd, fn: () => openBleepDialog(c) },
    { id: 'silence', tip: 'Remove silences', pro: true, on: snd, fn: () => removeSilences(c) }
  ];
}
function speedMenu(c, btn) {
  const r = btn.getBoundingClientRect();
  contextMenu(r.left, r.top - 8, [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 10].map((v) => ({
    label: (Math.abs(c.speed - v) < 0.001 ? '✓ ' : '') + v + 'x' + (v === 1 ? ' (normal)' : ''),
    fn: () => commit(() => setSpeed(c, v))
  })));
}
function updateClipTools() {
  const box = $('#clipTools');
  if (!box) return;
  const c = getClip(state.selectedId);
  const name = c ? clipLabel(c) : '';
  $('.ct-name', box).textContent = c ? name : 'Click a clip on the timeline';
  const row = $('.ct-row', box);
  row.innerHTML = '';
  for (const t of clipTools(c)) {
    const b = el('button', 'ct-btn' + (t.pro && !isPremium() ? ' pro' : ''));
    b.innerHTML = `<svg viewBox="0 0 24 24">${TOOL_ICONS[t.id]}</svg>${t.pro ? '<i class="ct-crown">' + CROWN + '</i>' : ''}`;
    b.dataset.tip = t.tip + (t.pro && !isPremium() ? ' (Premium)' : '');
    b.disabled = !t.on;
    b.onclick = () => t.fn(b);
    row.appendChild(b);
  }
}
function setupClipTools() {
  const lib = $('#library');
  if (!lib || $('#clipTools')) return;
  const box = el('div', '');
  box.id = 'clipTools';
  box.innerHTML = '<div class="ct-head"><b>Clip tools</b><span class="ct-name"></span></div><div class="ct-row"></div>';
  lib.appendChild(box);
  // keep the buttons in step with the selected clip and the playhead
  const baseRender = renderInspector;
  renderInspector = function () { const r = baseRender.apply(this, arguments); updateClipTools(); if (typeof graph !== 'undefined' && graph.open) { const gc = getClip(state.selectedId); if (gc && !graphPropsFor(gc).some((p) => p[0] === graph.prop)) graph.prop = graphPropsFor(gc)[0][0]; renderGraphHead(); drawGraph(); } if (rt.redrawTextFonts && $('[data-page="text"].active')) rt.redrawTextFonts(); return r; };
  let lastInside = null;
  setInterval(() => {
    const c = getClip(state.selectedId);
    const inside = c ? state.time >= c.start && state.time <= endOf(c) : null;
    if (inside !== lastInside) { lastInside = inside; updateClipTools(); }
  }, 300);
  updateClipTools();
}
