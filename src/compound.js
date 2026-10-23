/* Flux — Compound clips (like DaVinci): squash several clips into one clip you can move, trim, scale, color
   and add effects to as a whole. Decompose puts the clips back on the timeline. */
'use strict';
KIND_COLOR.compound = '#d08a3a';
ICON.compound = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="13" height="10" rx="2"/><rect x="8" y="10" width="13" height="10" rx="2"/></svg>';

// Swap the project to the compound's own little timeline while fn runs.
function withInner(c, innerTime, fn) {
  const save = { clips: P.clips, tracks: P.tracks, time: state.time, layout: rt.layout, hit: rt.hitBoxes, depth: rt.inCompound || 0, gain: rt.compGain };
  P.clips = c.sub.clips; P.tracks = c.sub.tracks;
  state.time = innerTime; rt.layout = null; rt.inCompound = save.depth + 1;
  try { return fn(); } finally {
    P.clips = save.clips; P.tracks = save.tracks; state.time = save.time; rt.layout = save.layout; rt.hitBoxes = save.hit; rt.inCompound = save.depth; rt.compGain = save.gain;
  }
}
function compoundInnerIds() {
  const ids = new Set();
  const walk = (clips) => { for (const c of clips) if (c.kind === 'compound' && c.sub) for (const x of c.sub.clips) { ids.add(x.id); if (x.kind === 'compound') walk([x]); } };
  walk(P.clips);
  return ids;
}
function compoundLength(sub) { return sub.clips.reduce((m, x) => Math.max(m, endOf(x)), 0); }

/* ---------- picture ---------- */
const compCanvases = new Map();
function renderCompound(c, local, k) {
  if (!c.sub || (rt.inCompound || 0) > 3) return null;
  const [W, H] = refSize();
  const cap = state.exporting ? 4096 : Math.max(480, previewCap());
  const sc = Math.min(1, cap / Math.max(W * k, H * k));
  const cw = Math.max(2, Math.round(W * k * sc)), ch = Math.max(2, Math.round(H * k * sc));
  let cv = compCanvases.get(c.id);
  if (!cv) { cv = document.createElement('canvas'); compCanvases.set(c.id, cv); }
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
  const g = cv.getContext('2d');
  withInner(c, c.in + local, () => render(g, cw));
  return cv;
}

/* ---------- sound / video players inside compounds ---------- */
function syncCompounds(t) {
  for (const c of P.clips) {
    if (c.kind !== 'compound' || !c.sub) continue;
    const near = t >= c.start - 2.5 && t < endOf(c);
    const it = near ? c.in + (t - c.start) : -1e6;
    const tr = getTrack(c.trackId);
    let gain = t < c.start || c.disabled || c.muted || (tr && tr.muted) ? 0 : kv(c, 'volume', t - c.start) * fadeEnv(c, t - c.start);
    if (rt.compGain != null) gain *= rt.compGain;
    withInner(c, it, () => { rt.compGain = gain; syncMedia(); });
  }
}

/* ---------- make / decompose ---------- */
function makeCompound() {
  let sel = selectedClips();
  if (!sel.length) return toast('Select the clips first (hold Shift and click to pick several)');
  const all = [];
  for (const x of sel) for (const y of [x, ...partners(x)]) if (!all.includes(y)) all.push(y);
  if (all.some(isLocked)) return lockedToast();
  const t0 = Math.min(...all.map((x) => x.start)), t1 = Math.max(...all.map(endOf));
  const order = (id) => P.tracks.findIndex((tr) => tr.id === id);
  let comp;
  commit(() => {
    const usedTracks = P.tracks.filter((tr) => all.some((x) => x.trackId === tr.id));
    const subTracks = usedTracks.map((tr) => ({ ...JSON.parse(JSON.stringify(tr)), locked: false, hidden: false }));
    const subClips = all.map((x) => { const y = JSON.parse(JSON.stringify(x)); y.start = x.start - t0; return y; });
    P.clips = P.clips.filter((x) => !all.includes(x));
    // put the compound on the top-most media track that's free there, or a new media track
    const vids = usedTracks.filter((tr) => tr.type === 'video').sort((a, b) => order(a.id) - order(b.id));
    const free = (tr) => !P.clips.some((o) => o.trackId === tr.id && o.start < t1 - 1e-4 && endOf(o) > t0 + 1e-4);
    let tr = vids.find(free) || P.tracks.find((x) => x.type === 'video' && free(x) && !x.locked);
    if (!tr) {
      tr = { id: 'v' + uid().slice(0, 4), type: 'video', name: '', auto: true, hidden: false, muted: false, locked: false };
      const i = P.tracks.findIndex((x) => x.type === 'video');
      P.tracks.splice(i < 0 ? 0 : i, 0, tr);
      autoNameTracks();
    }
    const n = P.clips.filter((x) => x.kind === 'compound').length + 1;
    comp = Object.assign({ id: uid(), trackId: tr.id, kind: 'compound', name: 'Compound clip ' + n, start: t0, in: 0, out: t1 - t0, speed: 1, volume: 1, muted: false, fadeIn: 0, fadeOut: 0 }, visualDefaults());
    comp.sub = { tracks: subTracks, clips: subClips };
    P.clips.push(comp);
    state.selectedId = comp.id;
    state.multi = new Set();
  });
  toast(`${all.length} clips combined into one - right-click it to decompose`);
  return comp;
}
function decompose(c = getClip(state.selectedId)) {
  if (!c || c.kind !== 'compound') return toast('Select a compound clip first');
  if (isLocked(c)) return lockedToast();
  const off = c.start - c.in, a = c.in, b = c.out;
  commit(() => {
    const pieces = [];
    for (const x0 of c.sub.clips) {
      const s = x0.start, e = endOf(x0);
      if (e <= a + 1e-4 || s >= b - 1e-4) continue;
      const x = JSON.parse(JSON.stringify(x0));
      x.id = uid();
      if (s < a) { const cut = a - s; x.in += cut * (x.speed || 1); x.start = a; if (x.keys) for (const arr of Object.values(x.keys)) for (const kk of arr) kk.t -= cut; x.fadeIn = 0; x.transition = null; }
      if (endOf(x) > b) { x.out = x.in + (b - x.start) * (x.speed || 1); x.fadeOut = 0; }
      x.start += off;
      x._from = x0.id; x._track = x0.trackId;
      pieces.push(x);
    }
    // keep links between video and its sound
    const linkMap = new Map();
    for (const x of pieces) if (x.linkId) { if (!linkMap.has(x.linkId)) linkMap.set(x.linkId, uid()); x.linkId = linkMap.get(x.linkId); }
    P.clips = P.clips.filter((x) => x !== c);
    const myIdx = P.tracks.findIndex((t) => t.id === c.trackId);
    const trackMap = new Map();
    const free = (trId, list) => !P.clips.some((o) => o.trackId === trId && list.some((x) => o.start < endOf(x) - 1e-4 && endOf(o) > x.start + 1e-4));
    // inner tracks top → bottom
    for (const st of c.sub.tracks) {
      const list = pieces.filter((x) => x._track === st.id);
      if (!list.length) continue;
      let target = P.tracks.find((t) => t.id === st.id && !t.locked && free(t.id, list));
      if (!target && st.type === 'video' && !trackMap.size && P.tracks[myIdx] && free(P.tracks[myIdx].id, list)) target = P.tracks[myIdx];
      if (!target) target = P.tracks.find((t) => t.type === st.type && !t.locked && ![...trackMap.values()].includes(t) && free(t.id, list));
      if (!target) {
        target = { id: st.type[0] + uid().slice(0, 4), type: st.type, name: '', auto: true, hidden: false, muted: false, locked: false };
        if (st.type === 'audio') P.tracks.push(target);
        else { const i = P.tracks.findIndex((t) => t.type === st.type); P.tracks.splice(i < 0 ? 0 : i, 0, target); }
      }
      trackMap.set(st.id, target);
      for (const x of list) x.trackId = target.id;
    }
    for (const x of pieces) { delete x._from; delete x._track; P.clips.push(x); }
    autoNameTracks();
    state.selectedId = pieces[0] ? pieces[0].id : null;
    state.multi = new Set(pieces.map((x) => x.id));
  });
  toast('Compound clip taken apart');
}

/* ---------- inspector ---------- */
function compoundInspector(body, c) {
  const s = section(body, 'Compound clip');
  const row = el('div', 'field wide');
  row.innerHTML = '<label>Name</label><input class="val" style="width:100%;text-align:left">';
  const inp = $('input', row); inp.value = c.name || '';
  inp.onchange = () => commit(() => { c.name = inp.value.trim() || 'Compound clip'; });
  s.appendChild(row);
  const n = c.sub ? c.sub.clips.length : 0;
  const p = el('p', 'hint'); p.textContent = `${n} clip${n === 1 ? '' : 's'} inside · ${fmtShort(compoundLength(c.sub))} long`; s.appendChild(p);
  const acts = el('div', 'insp-actions'); acts.style.gridTemplateColumns = '1fr';
  acts.innerHTML = '<button class="btn">Decompose (put the clips back)</button>';
  $('button', acts).onclick = () => decompose(c);
  s.appendChild(acts);
  const a = section(body, 'Sound', () => Object.assign(c, { volume: 1, muted: false }));
  slider(a, 'Volume', { min: 0, max: 200, get: () => Math.round(kvNow(c, 'volume') * 100), set: (v) => setProp(c, 'volume', v / 100), fmt: (v) => v + '%', def: 100, live: false, kf: [c, 'volume'] });
  chips(a, [{ label: c.muted ? 'Muted - click to unmute' : 'Mute this clip', value: 'm' }], c.muted ? 'm' : null, () => commit(() => { c.muted = !c.muted; }), 'toggle-row');
}

// timeline look: a picture from inside + a stack badge
{
  const baseRenderLanes = renderLanes;
  renderLanes = function () {
    baseRenderLanes();
    for (const ce of document.querySelectorAll('.clip.kind-compound')) {
      const c = getClip(ce.dataset.id);
      if (!c || !c.sub) continue;
      const v = c.sub.clips.find((x) => x.kind === 'video' || x.kind === 'image');
      const th = v && rt.thumbs.get(v.mediaId);
      if (th && !ce.querySelector('.film')) { const f = el('div', 'film'); f.style.backgroundImage = `url('${th}')`; ce.prepend(f); }
      if (!ce.querySelector('.comp-badge')) { const b = el('div', 'comp-badge', ICON.compound + '<span></span>'); b.lastChild.textContent = c.sub.clips.length; b.dataset.tip = 'Compound clip - right-click to decompose'; ce.appendChild(b); }
    }
  };
}
