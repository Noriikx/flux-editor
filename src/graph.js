/* Flux — Graph editor (like DaVinci's curve editor): see how a value changes over time,
   drag keyframes, and pick how the value moves between them (smooth, linear, ease, hold, custom curve).
   Mouse: drag empty space = move the playhead · drag a keyframe = move it · Shift+click (or your setting) = select several
   · wheel = zoom time · Shift+wheel = scroll · double-click = add keyframe · right-click / Delete = remove. */
'use strict';
const GRAPH_PROPS = [
  ['scale', 'Size', (v) => Math.round(v * 100) + '%', '#8d7dff'],
  ['x', 'Position X', (v) => Math.round(v * 100), '#4fc3f7'],
  ['y', 'Position Y', (v) => Math.round(v * 100), '#57d9a3'],
  ['rotation', 'Rotation', (v) => Math.round(v) + '°', '#ffb35c'],
  ['opacity', 'Opacity', (v) => Math.round(v * 100) + '%', '#ff7ab6'],
  ['volume', 'Volume', (v) => fmtDb(gainToDb(v)), '#9be15d']
];
const EASE_OPTS = [['smooth', 'Smooth'], ['linear', 'Linear'], ['in', 'Ease in'], ['out', 'Ease out'], ['hold', 'Hold'], ['bezier', 'Custom curve']];
const graph = { open: false, prop: null, sel: -1, selKeys: new Set(), drag: null, view: null, clipId: null };

function graphPropsFor(c) {
  const list = c.kind === 'audio' ? ['volume'] : c.kind === 'text' ? ['scale', 'rotation', 'opacity'] : c.kind === 'video' && !partners(c).some((p) => p.kind === 'audio') ? ['scale', 'x', 'y', 'rotation', 'opacity', 'volume'] : ['scale', 'x', 'y', 'rotation', 'opacity'];
  return GRAPH_PROPS.filter((p) => list.includes(p[0]));
}
const gKeys = (c) => (c && c.keys && c.keys[graph.prop]) || [];
function graphSelected(c) { return gKeys(c).filter((k) => graph.selKeys.has(k)); }
function setGraphSel(c, keys) {
  graph.selKeys = new Set(keys);
  const arr = gKeys(c);
  graph.sel = keys.length ? arr.indexOf(keys[keys.length - 1]) : -1;
}

function openGraphEditor() {
  const c = getClip(state.selectedId);
  if (!c) return toast('Select a clip first');
  let box = $('#graphEditor');
  if (!box) {
    box = el('div', '');
    box.id = 'graphEditor';
    box.innerHTML = `
      <div class="ge-head"><b>Graph editor</b><span class="ge-clip"></span><div class="ge-props"></div><span style="flex:1"></span>
        <button class="btn ghost small" data-a="fit" data-tip="Show the whole clip">Fit</button>
        <button class="btn ghost small" data-a="add" data-tip="Add a keyframe at the playhead">+ Keyframe</button>
        <button class="icon-btn small" data-a="close" data-tip="Close (G)"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="ge-body" tabindex="0"><canvas class="ge-canvas"></canvas></div>
      <div class="ge-foot"><span class="ge-info"></span><span class="ge-edit"></span><span style="flex:1"></span>
        <span class="ge-ease-label">Curve to the next keyframe:</span><div class="ge-ease"></div>
        <button class="btn ghost small" data-a="del">Delete</button></div>`;
    document.body.appendChild(box);
    $('[data-a=close]', box).onclick = closeGraphEditor;
    $('[data-a=del]', box).onclick = () => graphDeleteSelected();
    $('[data-a=fit]', box).onclick = () => { graph.view = null; drawGraph(); };
    $('[data-a=add]', box).onclick = () => graphAddKey(null);
    setupGraphCanvas($('.ge-canvas', box));
    $('.ge-body', box).addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); graphDeleteSelected(); }
    });
    new ResizeObserver(() => drawGraph()).observe($('.ge-body', box));
  }
  graph.open = true;
  box.classList.add('open');
  document.body.classList.add('graph-open');
  const props = graphPropsFor(c);
  if (!graph.prop || !props.some((p) => p[0] === graph.prop)) {
    graph.prop = (props.find((p) => c.keys && c.keys[p[0]] && c.keys[p[0]].length) || props[0])[0];
  }
  if (graph.clipId !== c.id) { graph.view = null; graph.clipId = c.id; }
  setGraphSel(c, []);
  rt.graphRedraw = () => drawGraph();
  renderGraphHead();
  drawGraph();
}
function closeGraphEditor() {
  const box = $('#graphEditor');
  if (box) box.classList.remove('open');
  document.body.classList.remove('graph-open');
  graph.open = false;
  rt.graphRedraw = null;
}
function toggleGraphEditor() { if (graph.open) closeGraphEditor(); else openGraphEditor(); }

function renderGraphHead() {
  const box = $('#graphEditor'), c = getClip(state.selectedId);
  if (!box || !c) return;
  if (graph.clipId !== c.id) { graph.view = null; graph.clipId = c.id; graph.selKeys.clear(); graph.sel = -1; }
  $('.ge-clip', box).textContent = clipLabel(c);
  const pr = $('.ge-props', box);
  pr.innerHTML = '';
  for (const [id, name, , color] of graphPropsFor(c)) {
    const n = keysInClip(c, id).length;
    const b = el('button', 'chip' + (graph.prop === id ? ' active' : ''), `<i class="ge-dot" style="background:${color}"></i>${name}${n ? ` <i class="ge-n">${n}</i>` : ''}`);
    b.onclick = () => { graph.prop = id; setGraphSel(c, []); renderGraphHead(); drawGraph(); };
    pr.appendChild(b);
  }
  const ez = $('.ge-ease', box);
  ez.innerHTML = '';
  const arr = gKeys(c);
  const sel = graphSelected(c).filter((k) => arr.indexOf(k) < arr.length - 1);
  const cur = sel.length ? sel[0].ease || 'smooth' : null;
  for (const [id, name] of EASE_OPTS) {
    const b = el('button', 'chip' + (cur === id ? ' active' : ''), name);
    b.disabled = !sel.length;
    b.onclick = () => {
      commit(() => { for (const k of sel) { k.ease = id; if (id === 'bezier' && !k.h) k.h = [0.42, 0, 0.58, 1]; if (id !== 'bezier') delete k.h; } });
      renderGraphHead(); drawGraph();
    };
    ez.appendChild(b);
  }
  $('[data-a=del]', box).disabled = !graph.selKeys.size;
  $('.ge-ease-label', box).style.opacity = sel.length ? 1 : 0.4;
  // exact numbers for one selected keyframe
  const ed = $('.ge-edit', box);
  ed.innerHTML = '';
  const one = graphSelected(c);
  if (one.length === 1) {
    const k = one[0];
    const info = GRAPH_PROPS.find((p) => p[0] === graph.prop);
    const toUser = (v) => (graph.prop === 'rotation' ? v : v * 100), fromUser = (v) => (graph.prop === 'rotation' ? v : v / 100);
    ed.innerHTML = `<label>Time <input class="num-input ge-num" data-f="t" type="number" step="0.01"></label><label>${info[1]} <input class="num-input ge-num" data-f="v" type="number" step="1"></label>`;
    const ti = $('[data-f=t]', ed), vi = $('[data-f=v]', ed);
    ti.value = k.t.toFixed(2); vi.value = Math.round(toUser(k.v) * 10) / 10;
    ti.onchange = () => { const v = parseFloat(ti.value); if (isNaN(v)) return; commit(() => { k.t = clamp(v, 0, dur(c)); arr.sort((a, b) => a.t - b.t); }); drawGraph(); renderGraphHead(); };
    vi.onchange = () => { const v = parseFloat(vi.value); if (isNaN(v)) return; commit(() => { k.v = fromUser(v); }); drawGraph(); };
  }
}

// ---------- drawing ----------
function graphView(c, cv) {
  const d = dur(c);
  if (!graph.view || graph.view.d !== d) graph.view = { t0: 0, t1: d, d };
  const t0 = graph.view.t0, t1 = Math.max(graph.view.t0 + 0.05, graph.view.t1);
  const arr = keysInClip(c, graph.prop);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 80; i++) { const v = kv(c, graph.prop, t0 + (i / 80) * (t1 - t0)); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (const k of arr) { lo = Math.min(lo, k.v); hi = Math.max(hi, k.v); }
  const def = { scale: [0, 2], x: [-1, 1], y: [-1, 1], rotation: [-180, 180], opacity: [0, 1], volume: [0, 2] }[graph.prop] || [0, 1];
  if (!isFinite(lo) || hi - lo < 1e-6) { lo = Math.min(isFinite(lo) ? lo : def[0], def[0]); hi = Math.max(isFinite(hi) ? hi : def[1], def[1]); }
  const minRange = { rotation: 20, volume: 0.25 }[graph.prop] || 0.2;
  if (hi - lo < minRange) { const m = (hi + lo) / 2; lo = m - minRange / 2; hi = m + minRange / 2; }
  const pad = (hi - lo) * 0.15 || 0.1;
  lo -= pad; hi += pad;
  // PX keeps keyframes at the very start / end of the view clear of the labels and edges
  const W = cv.width, H = cv.height, L = 58, R = 16, T = 14, B = 24, PX = 14;
  const iw = Math.max(10, W - L - R - PX * 2);
  return {
    d, t0, t1, lo, hi, W, H, L, R, T, B, PX, iw,
    x: (t) => L + PX + ((t - t0) / (t1 - t0)) * iw,
    y: (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B),
    t: (x) => clamp(t0 + ((x - L - PX) / iw) * (t1 - t0), 0, d),
    v: (y) => lo + (1 - (y - T) / (H - T - B)) * (hi - lo)
  };
}
function fmtFine(v) {
  if (graph.prop === 'rotation') return v.toFixed(1) + '°';
  if (graph.prop === 'volume') return fmtDb(gainToDb(v));
  if (graph.prop === 'x' || graph.prop === 'y') return (v * 100).toFixed(1);
  return (v * 100).toFixed(1) + '%';
}
// keyframes outside the visible time range (shown as little arrows you can click)
function graphHidden(c, V) {
  const arr = gKeys(c);
  return { left: arr.filter((k) => k.t < V.t0 - 1e-4), right: arr.filter((k) => k.t > V.t1 + 1e-4) };
}
function graphArrowBoxes(V, hid) {
  const out = [];
  const yc = V.T + 4;
  if (hid.left.length) out.push({ side: 'left', x: V.L + 4, y: yc, w: 46, h: 20, n: hid.left.length });
  if (hid.right.length) out.push({ side: 'right', x: V.W - V.R - 50, y: yc, w: 46, h: 20, n: hid.right.length });
  return out;
}
function graphReveal(c, V, side) {
  const hid = graphHidden(c, V), span = V.t1 - V.t0, d = dur(c);
  const k = side === 'left' ? hid.left[hid.left.length - 1] : hid.right[0];
  if (!k) return;
  // move the view so that keyframe sits a bit inside the edge
  let t0 = side === 'left' ? k.t - span * 0.15 : k.t - span * 0.85;
  t0 = clamp(t0, 0, Math.max(0, d - span));
  graph.view = { t0, t1: t0 + span, d };
  drawGraph();
}
function drawGraph() {
  const box = $('#graphEditor'), c = getClip(state.selectedId);
  if (!box || !graph.open) return;
  const cv = $('.ge-canvas', box), body = $('.ge-body', box);
  const dpr = window.devicePixelRatio || 1;
  const w = body.clientWidth, h = body.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.width = w + 'px'; cv.style.height = h + 'px'; }
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, cv.width, cv.height);
  if (!c) { g.fillStyle = '#8a8ca3'; g.font = `${13 * dpr}px Inter, sans-serif`; g.fillText('Select a clip to see its keyframes', 20 * dpr, 30 * dpr); return; }
  g.scale(dpr, dpr);
  const V = graphView(c, { width: w, height: h });
  const info = GRAPH_PROPS.find((p) => p[0] === graph.prop) || GRAPH_PROPS[0];
  const fmtV = info[2], color = info[3];
  // grid + labels
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.fillStyle = '#8a8ca3'; g.font = '10px "JetBrains Mono", monospace';
  const labels = [];
  for (let i = 0; i <= 4; i++) labels.push(V.lo + ((V.hi - V.lo) * i) / 4);
  const fine = new Set(labels.map((v) => String(fmtV(v)))).size < labels.length;
  for (const v of labels) {
    const y = V.y(v);
    g.beginPath(); g.moveTo(V.L, y); g.lineTo(w - V.R, y); g.stroke();
    g.fillText(fine ? fmtFine(v) : String(fmtV(v)), 6, y + 3);
  }
  const span = V.t1 - V.t0;
  const step = [0.04, 0.1, 0.2, 0.5, 1, 2, 5, 10, 30].find((s) => (s / span) * V.iw > 60) || 30;
  for (let t = Math.ceil(V.t0 / step) * step; t <= V.t1 + 1e-6; t += step) {
    const x = V.x(t);
    g.beginPath(); g.moveTo(x, V.T); g.lineTo(x, h - V.B); g.stroke();
    g.fillText(t.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0) + 's', x - 8, h - 7);
  }
  // other properties, faint (scaled into this view so you can compare timing)
  for (const [pid, , , pcol] of graphPropsFor(c)) {
    if (pid === graph.prop || !keysInClip(c, pid).length) continue;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i <= 60; i++) { const v = kv(c, pid, V.t0 + (i / 60) * span); lo = Math.min(lo, v); hi = Math.max(hi, v); }
    if (hi - lo < 1e-6) continue;
    g.strokeStyle = pcol; g.globalAlpha = 0.22; g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i <= 120; i++) { const t = V.t0 + (i / 120) * span; const v = kv(c, pid, t); const y = V.T + (1 - (v - lo) / (hi - lo)) * (h - V.T - V.B); i ? g.lineTo(V.x(t), y) : g.moveTo(V.x(t), y); }
    g.stroke(); g.globalAlpha = 1;
  }
  // the curve (clipped to the graph area so it never runs under the value labels)
  g.save(); g.beginPath(); g.rect(V.L, 0, w - V.L, h); g.clip();
  g.strokeStyle = color; g.lineWidth = 2.2;
  g.beginPath();
  const N = Math.max(80, Math.round(w - V.L - V.R));
  const ta = V.t(V.L), tb = V.t(w - V.R);
  for (let i = 0; i <= N; i++) { const t = ta + (i / N) * (tb - ta), x = V.x(t), y = V.y(kv(c, graph.prop, t)); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke(); g.restore();
  // custom-curve handles of selected keys
  const arr = gKeys(c);
  for (const sk of graphSelected(c)) {
    const nk = arr[arr.indexOf(sk) + 1];
    if (!nk || sk.ease !== 'bezier' || !sk.h) continue;
    const hp = graphHandlePoints(V, sk, nk);
    g.strokeStyle = 'rgba(255,210,63,.7)'; g.lineWidth = 1;
    for (const [ax, ay, bx, by] of [[V.x(sk.t), V.y(sk.v), hp[0][0], hp[0][1]], [V.x(nk.t), V.y(nk.v), hp[1][0], hp[1][1]]]) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
    g.fillStyle = '#ffd23f';
    for (const [hx, hy] of hp) { g.beginPath(); g.arc(hx, hy, 5, 0, Math.PI * 2); g.fill(); }
  }
  // keyframes
  for (const k of arr) {
    if (k.t < V.t0 - 1e-4 || k.t > V.t1 + 1e-4) continue;
    const x = V.x(k.t), y = V.y(k.v), on = graph.selKeys.has(k);
    g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
    g.fillStyle = on ? '#ffd23f' : '#e6e6ff';
    g.strokeStyle = '#0b0b11'; g.lineWidth = 1.5;
    const r = on ? 6 : 5;
    g.fillRect(-r, -r, r * 2, r * 2); g.strokeRect(-r, -r, r * 2, r * 2);
    g.restore();
  }
  // keyframes you can't see right now: arrows at the edges
  const hid = graphHidden(c, V);
  for (const b of graphArrowBoxes(V, hid)) {
    g.fillStyle = 'rgba(141,125,255,.9)';
    g.beginPath(); g.roundRect ? g.roundRect(b.x, b.y, b.w, b.h, 10) : g.rect(b.x, b.y, b.w, b.h); g.fill();
    g.fillStyle = '#fff'; g.font = '600 11px Inter, sans-serif'; g.textAlign = 'center';
    g.fillText(b.side === 'left' ? `◀ ${b.n}` : `${b.n} ▶`, b.x + b.w / 2, b.y + 14);
    g.textAlign = 'left'; g.font = '10px "JetBrains Mono", monospace';
  }
  // box selection
  if (graph.drag && graph.drag.kind === 'box') {
    const b = graph.drag;
    g.fillStyle = 'rgba(141,125,255,.12)'; g.strokeStyle = 'rgba(141,125,255,.7)'; g.lineWidth = 1;
    g.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
    g.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
  }
  // playhead (drag it, or drag anywhere empty)
  const lt = state.time - c.start;
  if (lt >= V.t0 && lt <= V.t1) {
    const px = V.x(lt);
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(px, V.T - 6); g.lineTo(px, h - V.B); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(px - 6, 2); g.lineTo(px + 6, 2); g.lineTo(px, V.T); g.closePath(); g.fill();
  }
  const sel = graphSelected(c);
  $('.ge-info', box).textContent = sel.length > 1 ? `${sel.length} keyframes selected` : sel.length ? `Keyframe at ${sel[0].t.toFixed(2)}s · ${fmtV(sel[0].v)}` : 'Drag empty space to move the playhead · double-click the line to add a keyframe · wheel to zoom · middle-drag or Shift+wheel to scroll';
}
function graphHandlePoints(V, a, b) {
  const x0 = V.x(a.t), y0 = V.y(a.v), x1 = V.x(b.t), y1 = V.y(b.v);
  return [[x0 + (x1 - x0) * a.h[0], y0 + (y1 - y0) * a.h[1]], [x0 + (x1 - x0) * a.h[2], y0 + (y1 - y0) * a.h[3]]];
}
function graphAddKey(t) {
  const c = getClip(state.selectedId);
  if (!c) return;
  if (t == null) t = clamp(state.time - c.start, 0, dur(c));
  t = Math.round(t * FPS) / FPS;
  let made = null;
  commit(() => {
    c.keys = c.keys || {};
    const arr = c.keys[graph.prop] = c.keys[graph.prop] || [];
    if (arr.some((k) => Math.abs(k.t - t) < 0.6 / FPS)) return;
    made = { t, v: kv(c, graph.prop, t) };
    arr.push(made);
    arr.sort((a, b) => a.t - b.t);
  });
  if (made) setGraphSel(c, [made]);
  seek(c.start + t);
  renderGraphHead(); drawGraph(); renderLanes();
}

// ---------- mouse ----------
function setupGraphCanvas(cv) {
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const view = () => { const c = getClip(state.selectedId); return c ? [c, graphView(c, { width: cv.clientWidth, height: cv.clientHeight })] : [null, null]; };
  const hitKey = (c, V, x, y) => {
    let best = null, bd = 9;
    for (const k of gKeys(c)) { const d = Math.hypot(V.x(k.t) - x, V.y(k.v) - y); if (d < bd) { bd = d; best = k; } }
    return best;
  };
  cv.addEventListener('pointerdown', (e) => {
    const [c, V] = view();
    if (!c) return;
    cv.parentElement.focus({ preventScroll: true });
    const [x, y] = pos(e);
    const arr = gKeys(c);
    // custom-curve handle?
    for (const sk of graphSelected(c)) {
      const nk = arr[arr.indexOf(sk) + 1];
      if (!nk || sk.ease !== 'bezier' || !sk.h) continue;
      const hp = graphHandlePoints(V, sk, nk);
      for (let hi = 0; hi < 2; hi++) if (Math.hypot(hp[hi][0] - x, hp[hi][1] - y) < 8) {
        beginEdit(); graph.drag = { kind: 'handle', hi, k: sk, n: nk }; cv.setPointerCapture(e.pointerId); return;
      }
    }
    for (const b of graphArrowBoxes(V, graphHidden(c, V))) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { graphReveal(c, V, b.side); return; }
    if (e.button === 1 || (e.button === 0 && e.altKey)) { e.preventDefault(); graph.drag = { kind: 'pan', x0: x, t0: V.t0, span: V.t1 - V.t0 }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; return; }
    const k = hitKey(c, V, x, y);
    if (e.button === 2) { if (k) { if (!graph.selKeys.has(k)) setGraphSel(c, [k]); graphDeleteSelected(); } return; }
    if (k) {
      if (isMultiClick(e)) { const s = new Set(graph.selKeys); s.has(k) ? s.delete(k) : s.add(k); setGraphSel(c, [...s]); renderGraphHead(); drawGraph(); return; }
      if (!graph.selKeys.has(k)) setGraphSel(c, [k]);
      renderGraphHead();
      beginEdit();
      graph.drag = { kind: 'keys', x0: x, y0: y, base: graphSelected(c).map((q) => ({ k: q, t: q.t, v: q.v })), moved: false };
      cv.setPointerCapture(e.pointerId);
      seek(c.start + k.t);
      drawGraph();
      return;
    }
    if (isMultiClick(e)) { graph.drag = { kind: 'box', x0: x, y0: y, x1: x, y1: y }; cv.setPointerCapture(e.pointerId); return; }
    // empty space: hold and drag to move the playhead (only here, not in the main editor)
    setGraphSel(c, []); renderGraphHead();
    if (state.playing) pause();
    scrubStart();
    graph.drag = { kind: 'scrub' };
    cv.setPointerCapture(e.pointerId);
    const t = V.t(x); scrubMove(c.start + t); seek(c.start + t);
    drawGraph();
  });
  cv.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  cv.addEventListener('pointermove', (e) => {
    if (!graph.drag) {
      const [c, V] = view(); if (!c) return;
      const [x, y] = pos(e);
      cv.style.cursor = graphArrowBoxes(V, graphHidden(c, V)).some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || hitKey(c, V, x, y) ? 'pointer' : '';
      return;
    }
    const [c, V] = view();
    if (!c) return;
    const [x, y] = pos(e);
    const arr = gKeys(c);
    const d = graph.drag;
    if (d.kind === 'scrub') { const t = c.start + V.t(x); scrubMove(t); seek(t); drawGraph(); return; }
    if (d.kind === 'pan') { const dd = dur(c); const t0 = clamp(d.t0 - ((x - d.x0) / V.iw) * d.span, 0, Math.max(0, dd - d.span)); graph.view = { t0, t1: t0 + d.span, d: dd }; drawGraph(); return; }
    if (d.kind === 'box') {
      d.x1 = x; d.y1 = y;
      const xa = Math.min(d.x0, x), xb = Math.max(d.x0, x), ya = Math.min(d.y0, y), yb = Math.max(d.y0, y);
      setGraphSel(c, arr.filter((k) => { const kx = V.x(k.t), ky = V.y(k.v); return kx >= xa && kx <= xb && ky >= ya && ky <= yb; }));
      drawGraph();
      return;
    }
    if (d.kind === 'keys') {
      d.moved = true;
      const dt = Math.round(((x - d.x0) / V.iw) * (V.t1 - V.t0) * FPS) / FPS;
      const dv = e.shiftKey && multiKey() !== 'shift' ? 0 : V.v(y) - V.v(d.y0);
      const moving = new Set(d.base.map((b) => b.k));
      for (const b of d.base) {
        // don't pass a keyframe that isn't selected
        const i = arr.indexOf(b.k);
        let lo = 0, hi = dur(c);
        for (let j = i - 1; j >= 0; j--) if (!moving.has(arr[j])) { lo = arr[j].t + 1 / FPS; break; }
        for (let j = i + 1; j < arr.length; j++) if (!moving.has(arr[j])) { hi = arr[j].t - 1 / FPS; break; }
        b.k.t = clamp(b.t + dt, lo, hi);
        let v = b.v + dv;
        if (graph.prop === 'opacity') v = clamp(v, 0, 1);
        if (graph.prop === 'volume') v = clamp(v, 0, 100);
        if (graph.prop === 'scale') v = Math.max(0.01, v);
        b.k.v = v;
      }
      arr.sort((a, b) => a.t - b.t);
      if (d.base.length === 1) seek(c.start + d.base[0].k.t);
      requestDraw(); drawGraph();
      return;
    }
    if (d.kind === 'handle') {
      const { hi, k, n } = d;
      const x0 = V.x(k.t), x1 = V.x(n.t), y0 = V.y(k.v), y1 = V.y(n.v);
      const fx = clamp((x - x0) / Math.max(1, x1 - x0), 0, 1);
      const fy = Math.abs(y1 - y0) < 1 ? (y - y0) / 60 : (y - y0) / (y1 - y0);
      k.h[hi * 2] = fx; k.h[hi * 2 + 1] = clamp(fy, -1.5, 2.5);
      requestDraw(); drawGraph();
    }
  });
  const up = () => {
    const d = graph.drag;
    if (!d) return;
    graph.drag = null;
    cv.style.cursor = '';
    if (d.kind === 'pan') return;
    if (d.kind === 'scrub') { scrubEnd(); drawGraph(); return; }
    if (d.kind === 'box') { renderGraphHead(); drawGraph(); return; }
    endEdit(); renderLanes(); scheduleInspector(); renderGraphHead(); drawGraph();
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('dblclick', (e) => { const [c, V] = view(); if (!c) return; const [x] = pos(e); graphAddKey(V.t(x)); });
  // wheel: zoom time around the mouse; Shift+wheel: scroll
  cv.addEventListener('wheel', (e) => {
    const [c, V] = view();
    if (!c) return;
    e.preventDefault();
    const span = V.t1 - V.t0, d = dur(c);
    if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      const sh = ((e.shiftKey ? e.deltaY : e.deltaX) / V.iw) * span;
      const t0 = clamp(V.t0 + sh, 0, Math.max(0, d - span));
      graph.view = { t0, t1: t0 + span, d };
    } else {
      const [x] = pos(e);
      const at = V.t(x), f = e.deltaY > 0 ? 1.2 : 1 / 1.2;
      const ns = clamp(span * f, Math.min(d, 2 / FPS * 10), d);
      let t0 = at - ((at - V.t0) / span) * ns;
      t0 = clamp(t0, 0, Math.max(0, d - ns));
      graph.view = { t0, t1: t0 + ns, d };
    }
    drawGraph();
  }, { passive: false });
}
function graphDeleteSelected() {
  const c = getClip(state.selectedId);
  const arr = c && c.keys && c.keys[graph.prop];
  const sel = graphSelected(c);
  if (!arr || !sel.length) return;
  commit(() => {
    const lastV = arr[arr.length - 1].v;
    c.keys[graph.prop] = arr.filter((k) => !graph.selKeys.has(k));
    if (!c.keys[graph.prop].length) { delete c.keys[graph.prop]; c[graph.prop] = lastV; }
  });
  setGraphSel(c, []);
  renderGraphHead(); drawGraph(); renderLanes();
}
