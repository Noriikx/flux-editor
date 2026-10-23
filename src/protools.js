/* Flux — pro editing tools (DaVinci-style): ripple trims, edit points, nudge, enable/disable clips,
   clip colors, track lock, In/Out range, normalize audio, split all tracks. */
'use strict';
const isLocked = (c) => { const tr = c && getTrack(c.trackId); return !!(tr && tr.locked); };
function lockedToast() { toast('That track is locked - click the lock on the track to unlock it'); }

/* ---------- ripple trims (Q / W) ---------- */
// side 'start': cut away everything left of the playhead in the selected clip; 'end': everything right of it.
// ripple = later clips slide over so no gap is left.
function trimToPlayhead(side, ripple) {
  const t = state.time;
  let c = getClip(state.selectedId);
  if (!c || t <= c.start + 0.02 || t >= endOf(c) - 0.02) {
    // nothing selected under the playhead: use the top-most media clip under it
    const under = P.clips.filter((x) => t > x.start + 0.02 && t < endOf(x) - 0.02 && x.kind !== 'audio' && !isLocked(x));
    c = under.sort((a, b) => P.tracks.findIndex((tr) => tr.id === a.trackId) - P.tracks.findIndex((tr) => tr.id === b.trackId))[0]
      || P.clips.find((x) => t > x.start + 0.02 && t < endOf(x) - 0.02 && !isLocked(x));
  }
  if (!c) return toast('Put the playhead over a clip first');
  if (isLocked(c)) return lockedToast();
  const group = [c, ...partners(c)].filter((x) => t > x.start + 0.02 && t < endOf(x) - 0.02);
  commit(() => {
    for (const x of group) {
      const oldStart = x.start, oldEnd = endOf(x);
      if (side === 'start') {
        const cutLocal = t - x.start;
        x.in = x.in + cutLocal * x.speed;
        if (x.keys) for (const arr of Object.values(x.keys)) for (const k of arr) k.t -= cutLocal;
        x.fadeIn = 0; x.transition = null;
        if (ripple) {
          // the clip stays where it began, everything after it moves left
          x.start = oldStart;
          for (const o of P.clips) if (o.trackId === x.trackId && o.id !== x.id && o.start >= oldEnd - 1e-4) o.start = Math.max(0, o.start - cutLocal);
        } else x.start = t;
      } else {
        x.out = x.in + (t - x.start) * x.speed;
        x.fadeOut = 0;
        if (ripple) { const gap = oldEnd - t; for (const o of P.clips) if (o.trackId === x.trackId && o.id !== x.id && o.start >= oldEnd - 1e-4) o.start = Math.max(0, o.start - gap); }
      }
    }
    state.selectedId = c.id;
  });
  if (side === 'start' && ripple) seek(c.start);
}

/* ---------- edit points, nudge ---------- */
function jumpEdit(dir) {
  const t = state.time, pts = new Set([0]);
  for (const c of P.clips) { pts.add(+c.start.toFixed(4)); pts.add(+endOf(c).toFixed(4)); }
  const list = [...pts].sort((a, b) => a - b);
  const to = dir < 0 ? list.filter((p) => p < t - 0.5 / FPS).pop() : list.find((p) => p > t + 0.5 / FPS);
  if (to == null) return;
  if (state.playing) pause();
  seek(to);
}
function nudgeSelected(dir) {
  const c = getClip(state.selectedId);
  if (!c) return toast('Click a clip first');
  if (isLocked(c)) return lockedToast();
  const d = dir / FPS, group = [];
  for (const x of selectedClips()) for (const y of [x, ...partners(x)]) if (!group.includes(y) && !isLocked(y)) group.push(y);
  if (group.some((x) => x.start + d < -1e-6)) return;
  const clash = group.some((x) => P.clips.some((o) => o.trackId === x.trackId && !group.includes(o) && x.start + d < endOf(o) - 1e-4 && x.start + d + dur(x) > o.start + 1e-4));
  if (clash) return toast('There’s another clip in the way');
  commit(() => { for (const x of group) x.start = Math.max(0, x.start + d); });
}

/* ---------- enable / disable, colors, normalize ---------- */
function toggleClipEnabled(c = getClip(state.selectedId)) {
  if (!c) return toast('Click a clip first');
  const group = [];
  for (const x of (c.id === state.selectedId ? selectedClips() : [c])) for (const y of [x, ...partners(x)]) if (!group.includes(y)) group.push(y);
  const off = !c.disabled;
  commit(() => { for (const x of group) x.disabled = off; });
  toast(off ? 'Clip turned off (it won’t show or play) - press V to turn it back on' : 'Clip turned on');
}
const CLIP_COLORS = [['', 'Default'], ['#e5484d', 'Red'], ['#f76b15', 'Orange'], ['#ffc53d', 'Yellow'], ['#46a758', 'Green'], ['#12a594', 'Teal'], ['#0090ff', 'Blue'], ['#8e4ec6', 'Purple'], ['#d6409f', 'Pink']];
function clipColorMenu(c, x, y) {
  const targets = c.id === state.selectedId ? selectedClips() : [c];
  contextMenu(x, y, CLIP_COLORS.map(([col, name]) => ({ label: (c.color === col || (!c.color && !col) ? '✓ ' : '') + name, fn: () => commit(() => { for (const t of targets) t.color = col || null; }) })));
}
function normalizeClip(c = getClip(state.selectedId)) {
  const src = soundSource(c);
  if (!src) return toast('Pick a clip with sound');
  const pk = rt.peaksAbs.get(src.mediaId), m = getMedia(src.mediaId);
  if (!pk || !m || !m.duration) { if (m) loadPeaks(m); return toast('Still reading the sound - try again in a second'); }
  const a = Math.floor((src.in / m.duration) * pk.length), b = Math.ceil((src.out / m.duration) * pk.length);
  let peak = 0;
  for (let i = Math.max(0, a); i < Math.min(pk.length, b); i++) if (pk[i] > peak) peak = pk[i];
  if (peak < 0.001) return toast('This clip is silent');
  const v = clamp(0.89 / peak, 0, 3); // peak at about -1 dB
  commit(() => { if (src.keys && src.keys.volume) delete src.keys.volume; src.volume = +v.toFixed(2); });
  toast(`Normalized - volume set to ${Math.round(v * 100)}%`);
}
function splitAllTracks() {
  const t = state.time;
  const keep = state.selectedId;
  state.selectedId = null; // so splitAt cuts every clip under the playhead
  splitAt(t);
  if (keep && getClip(keep)) state.selectedId = keep;
}

/* ---------- In / Out range ---------- */
function setRange(which) {
  P.range = P.range || {};
  P.range[which] = state.time;
  if (P.range.in != null && P.range.out != null && P.range.out < P.range.in) { const x = P.range.in; P.range.in = P.range.out; P.range.out = x; }
  markDirty();
  drawRange();
  toast(which === 'in' ? 'In point set (I)' : 'Out point set (O)', { duration: 1200 });
}
function clearRange() { P.range = null; markDirty(); drawRange(); toast('In / Out cleared', { duration: 1200 }); }
function rangeOK() { return P.range && P.range.in != null && P.range.out != null && P.range.out - P.range.in > 0.05; }
function drawRange() {
  let r = $('#rangeBar');
  if (!r) { r = el('div', ''); r.id = 'rangeBar'; tlRuler.appendChild(r); }
  const R = P.range || {};
  const a = R.in != null ? R.in : 0, b = R.out != null ? R.out : projectDuration();
  if (R.in == null && R.out == null) { r.style.display = 'none'; return; }
  r.style.display = 'block';
  r.style.left = a * state.zoom + 'px';
  r.style.width = Math.max(2, (b - a) * state.zoom) + 'px';
  r.dataset.tip = `In ${fmt(a)} → Out ${fmt(b)} (Alt+X clears)`;
}

/* ---------- track lock button ---------- */
function lockButton(tr) {
  const b = el('button', 'icon-btn' + (tr.locked ? ' off locked' : ''), tr.locked
    ? '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>'
    : '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>');
  b.dataset.tip = tr.locked ? 'Unlock track' : 'Lock track (nothing on it can be changed)';
  b.onclick = () => commit(() => { tr.locked = !tr.locked; });
  return b;
}
