/* Flux — live previews: hover a transition, a text animation or a look and see it on the selected clip
   right away (nothing changes until you click). */
'use strict';
const pv = { on: false, restore: null, timer: null, t0: 0, wasPlaying: false };

function startPreview({ apply, restore, from, to, still }) {
  endPreview();
  pv.on = true;
  pv.t0 = state.time;
  pv.wasPlaying = state.playing;
  apply();
  pv.restore = restore;
  rt.previewTrans = true;
  rt.layout = computeLayout();
  if (still) { requestDraw(); return; }
  const start = Math.max(0, from), end = Math.max(start + 0.3, to);
  seek(start);
  if (!state.playing) play();
  pv.timer = setInterval(() => {
    if (!pv.on) return;
    if (!state.playing) play();
    if (state.time >= end || state.time < start - 0.05) seek(start);
  }, 30);
}
function endPreview() {
  if (!pv.on) return;
  pv.on = false;
  clearInterval(pv.timer);
  pv.timer = null;
  rt.previewTrans = false;
  if (pv.restore) pv.restore();
  pv.restore = null;
  if (!pv.wasPlaying) pause();
  seek(pv.t0);
  rt.layout = computeLayout();
  requestDraw();
}
// hover = preview, leaving or pressing = back to normal (the click then applies it for real)
function hoverPreview(elm, getOpts) {
  elm.addEventListener('mouseenter', () => { const o = getOpts(); if (o) startPreview(o); });
  elm.addEventListener('mouseleave', endPreview);
  elm.addEventListener('pointerdown', endPreview);
}

function transitionPreviewOpts(type) {
  const c = getClip(state.selectedId);
  if (!c || !(isVisual(c) || c.kind === 'text')) return null;
  const tr = transById(type);
  if (tr.pro && !isPremium()) return null;
  const old = c.transition ? JSON.parse(JSON.stringify(c.transition)) : null;
  const d = (old && old.duration) || (typeof settings !== 'undefined' ? settings.transitionDur : 0.6) || 0.6;
  const prev = c.kind === 'text' ? null : adjPrev(c);
  const from = c.kind === 'text' ? c.start : prev ? c.start - d / 2 - 0.5 : c.start;
  const to = c.kind === 'text' ? c.start + Math.min(dur(c), d + 0.9) : prev ? c.start + d / 2 + 0.7 : c.start + d + 0.6;
  return {
    apply: () => { c.transition = { type, duration: d }; },
    restore: () => { c.transition = old; },
    from, to
  };
}
function animPreviewOpts(c, anim) {
  if (!c || c.kind !== 'text') return null;
  const old = c.text.anim;
  return { apply: () => { c.text.anim = anim; }, restore: () => { c.text.anim = old; }, from: c.start, to: c.start + Math.min(dur(c), 1.6) };
}
function filterPreviewOpts(id) {
  const c = getClip(state.selectedId);
  if (!c || !isVisual(c)) return null;
  const old = c.filter;
  return { apply: () => { c.filter = id; }, restore: () => { c.filter = old; }, still: true };
}

// Wire up the grids (called after each grid is drawn)
function addTransitionHover() {
  $$('#transitionGrid .trans-chip').forEach((b, i) => {
    if (b._pv) return; b._pv = true;
    const t = TRANSITIONS.slice(1)[i];
    if (t) hoverPreview(b, () => transitionPreviewOpts(t.id));
  });
}
function addFilterHover() {
  $$('#filterGrid .filter-chip').forEach((b, i) => {
    if (b._pv) return; b._pv = true;
    const f = FILTERS[i];
    if (f) hoverPreview(b, () => filterPreviewOpts(f.id));
  });
}
function setupPreviews() {
  const baseT = renderTransitionGrid;
  renderTransitionGrid = function () { endPreview(); const r = baseT.apply(this, arguments); addTransitionHover(); return r; };
  const baseF = renderFilterGrid;
  renderFilterGrid = function () { const r = baseF.apply(this, arguments); addFilterHover(); return r; };
  addTransitionHover(); addFilterHover();
}
