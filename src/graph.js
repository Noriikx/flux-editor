/* Flux — Graph editor (like DaVinci's curve editor): see how a value changes over time,
   drag keyframes, and pick how the value moves between them (smooth, linear, ease, hold, custom curve). */
'use strict';
const GRAPH_PROPS = [
  ['scale', 'Size', (v) => Math.round(v * 100) + '%'],
  ['x', 'Position X', (v) => Math.round(v * 100)],
  ['y', 'Position Y', (v) => Math.round(v * 100)],
  ['rotation', 'Rotation', (v) => Math.round(v) + '°'],
  ['opacity', 'Opacity', (v) => Math.round(v * 100) + '%'],
  ['volume', 'Volume', (v) => Math.round(v * 100) + '%']
];
const EASE_OPTS = [['smooth', 'Smooth'], ['linear', 'Linear'], ['in', 'Ease in'], ['out', 'Ease out'], ['hold', 'Hold'], ['bezier', 'Custom curve']];
const graph = { open: false, prop: null, sel: -1, drag: null };

function graphPropsFor(c) {
  const list = c.kind === 'audio' ? ['volume'] : c.kind === 'text' ? ['scale', 'rotation', 'opacity'] : c.kind === 'video' && !partners(c).some((p) => p.kind === 'audio') ? ['scale', 'x', 'y', 'rotation', 'opacity', 'volume'] : ['scale', 'x', 'y', 'rotation', 'opacity'];
  return GRAPH_PROPS.filter((p) => list.includes(p[0]));
}
function openGraphEditor() {
  const c = getClip(state.selectedId);
  if (!c) return toast('Select a clip first');
  if (!requirePremium('Graph editor')) return;
  let box = $('#graphEditor');
  if (!box) {
    box = el('div', '');
    box.id = 'graphEditor';
    box.innerHTML = `
      <div class="ge-head"><b>Graph editor</b><span class="ge-clip"></span><div class="ge-props"></div><span style="flex:1"></span>
        <button class="icon-btn small" data-a="close" data-tip="Close (G)"><svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="ge-body"><canvas class="ge-canvas"></canvas></div>
      <div class="ge-foot"><span class="ge-info">Double-click the line to add a keyframe · drag keyframes · right-click to delete</span><span style="flex:1"></span>
        <span class="ge-ease-label">Between this keyframe and the next:</span><div class="ge-ease"></div>
        <button class="btn ghost small" data-a="del">Delete keyframe</button></div>`;
    document.body.appendChild(box);
    $('[data-a=close]', box).onclick = closeGraphEditor;
    $('[data-a=del]', box).onclick = () => graphDeleteSelected();
    setupGraphCanvas($('.ge-canvas', box));
    new ResizeObserver(() => drawGraph()).observe($('.ge-body', box));
  }
  graph.open = true;
  box.classList.add('open');
  const props = graphPropsFor(c);
  if (!graph.prop || !props.some((p) => p[0] === graph.prop)) {
    graph.prop = (props.find((p) => c.keys && c.keys[p[0]] && c.keys[p[0]].length) || props[0])[0];
  }
  graph.sel = -1;
  rt.graphRedraw = () => drawGraph();
  renderGraphHead();
  drawGraph();
}
function closeGraphEditor() {
  const box = $('#graphEditor');
  if (box) box.classList.remove('open');
  graph.open = false;
  rt.graphRedraw = null;
}
function toggleGraphEditor() { if (graph.open) closeGraphEditor(); else openGraphEditor(); }

function renderGraphHead() {
  const box = $('#graphEditor'), c = getClip(state.selectedId);
  if (!box || !c) return;
  $('.ge-clip', box).textContent = clipLabel(c);
  const pr = $('.ge-props', box);
  pr.innerHTML = '';
  for (const [id, name] of graphPropsFor(c)) {
    const n = keysInClip(c, id).length;
    const b = el('button', 'chip' + (graph.prop === id ? ' active' : ''), name + (n ? ` <i>${n}</i>` : ''));
    b.onclick = () => { graph.prop = id; graph.sel = -1; renderGraphHead(); drawGraph(); };
    pr.appendChild(b);
  }
  const ez = $('.ge-ease', box);
  ez.innerHTML = '';
  const arr = c.keys && c.keys[graph.prop];
  const k = arr && arr[graph.sel];
  for (const [id, name] of EASE_OPTS) {
    const b = el('button', 'chip' + (k && (k.ease || 'smooth') === id ? ' active' : ''), name);
    b.disabled = !k || graph.sel >= arr.length - 1;
    b.onclick = () => {
      if (!k) return;
      commit(() => { k.ease = id; if (id === 'bezier' && !k.h) k.h = [0.42, 0, 0.58, 1]; if (id !== 'bezier') delete k.h; });
      renderGraphHead(); drawGraph();
    };
    ez.appendChild(b);
  }
  $('[data-a=del]', box).disabled = !k;
  $('.ge-ease-label', box).style.opacity = k ? 1 : 0.4;
}

// ---------- drawing ----------
function graphView(c, cv) {
  const d = dur(c);
  const arr = keysInClip(c, graph.prop);
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 80; i++) { const v = kv(c, graph.prop, (i / 80) * d); lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (const k of arr) { lo = Math.min(lo, k.v); hi = Math.max(hi, k.v); }
  const def = { scale: [0, 2], x: [-1, 1], y: [-1, 1], rotation: [-180, 180], opacity: [0, 1], volume: [0, 2] }[graph.prop] || [0, 1];
  if (!isFinite(lo) || hi - lo < 1e-6) { lo = Math.min(lo, def[0]); hi = Math.max(hi, def[1]); }
  const pad = (hi - lo) * 0.15 || 0.1;
  lo -= pad; hi += pad;
  const W = cv.width, H = cv.height, L = 54, R = 16, T = 14, B = 22;
  return {
    d, lo, hi, W, H, L, R, T, B,
    x: (t) => L + (t / Math.max(1e-6, d)) * (W - L - R),
    y: (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B),
    t: (x) => clamp(((x - L) / (W - L - R)) * d, 0, d),
    v: (y) => lo + (1 - (y - T) / (H - T - B)) * (hi - lo)
  };
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
  const fake = { width: w, height: h };
  const V = graphView(c, fake);
  const fmtV = (GRAPH_PROPS.find((p) => p[0] === graph.prop) || [])[2] || ((v) => v.toFixed(2));
  // grid
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; g.fillStyle = '#8a8ca3'; g.font = '10px "JetBrains Mono", monospace';
  for (let i = 0; i <= 4; i++) {
    const v = V.lo + ((V.hi - V.lo) * i) / 4, y = V.y(v);
    g.beginPath(); g.moveTo(V.L, y); g.lineTo(w - V.R, y); g.stroke();
    g.fillText(String(fmtV(v)), 6, y + 3);
  }
  const step = V.d > 20 ? 5 : V.d > 8 ? 2 : V.d > 3 ? 1 : 0.5;
  for (let t = 0; t <= V.d + 1e-6; t += step) {
    const x = V.x(t);
    g.beginPath(); g.moveTo(x, V.T); g.lineTo(x, h - V.B); g.stroke();
    g.fillText(t.toFixed(step < 1 ? 1 : 0) + 's', x - 8, h - 6);
  }
  // curve
  g.strokeStyle = '#8d7dff'; g.lineWidth = 2;
  g.beginPath();
  const N = Math.max(60, Math.round(w - V.L - V.R));
  for (let i = 0; i <= N; i++) { const t = (i / N) * V.d, x = V.x(t), y = V.y(kv(c, graph.prop, t)); i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  // bezier handles for the selected key
  const arr = (c.keys && c.keys[graph.prop]) || [];
  const sk = arr[graph.sel], nk = arr[graph.sel + 1];
  if (sk && nk && sk.ease === 'bezier' && sk.h) {
    const hp = graphHandlePoints(V, sk, nk);
    g.strokeStyle = 'rgba(255,210,63,.7)'; g.lineWidth = 1;
    for (const [ax, ay, bx, by] of [[V.x(sk.t), V.y(sk.v), hp[0][0], hp[0][1]], [V.x(nk.t), V.y(nk.v), hp[1][0], hp[1][1]]]) { g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); }
    g.fillStyle = '#ffd23f';
    for (const [hx, hy] of hp) { g.beginPath(); g.arc(hx, hy, 5, 0, Math.PI * 2); g.fill(); }
  }
  // keyframes
  arr.forEach((k, i) => {
    if (k.t < -1e-4 || k.t > V.d + 1e-4) return;
    const x = V.x(k.t), y = V.y(k.v);
    g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
    g.fillStyle = i === graph.sel ? '#ffd23f' : '#e6e6ff';
    g.strokeStyle = '#0b0b11'; g.lineWidth = 1.5;
    g.fillRect(-5, -5, 10, 10); g.strokeRect(-5, -5, 10, 10);
    g.restore();
  });
  // playhead
  const lt = state.time - c.start;
  if (lt >= 0 && lt <= V.d) { g.strokeStyle = '#fff'; g.lineWidth = 1; g.beginPath(); g.moveTo(V.x(lt), V.T); g.lineTo(V.x(lt), h - V.B); g.stroke(); }
  if (graph.sel >= 0 && arr[graph.sel]) {
    const k = arr[graph.sel];
    $('.ge-info', box).textContent = `Keyframe at ${k.t.toFixed(2)}s · ${fmtV(k.v)}`;
  } else $('.ge-info', box).textContent = 'Double-click the line to add a keyframe · drag keyframes · right-click to delete';
}
function graphHandlePoints(V, a, b) {
  const x0 = V.x(a.t), y0 = V.y(a.v), x1 = V.x(b.t), y1 = V.y(b.v);
  return [[x0 + (x1 - x0) * a.h[0], y0 + (y1 - y0) * a.h[1]], [x0 + (x1 - x0) * a.h[2], y0 + (y1 - y0) * a.h[3]]];
}

// ---------- mouse ----------
function setupGraphCanvas(cv) {
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const view = () => { const c = getClip(state.selectedId); return c ? [c, graphView(c, { width: cv.clientWidth, height: cv.clientHeight })] : [null, null]; };
  const hitKey = (c, V, x, y) => {
    const arr = (c.keys && c.keys[graph.prop]) || [];
    let best = -1, bd = 9;
    arr.forEach((k, i) => { const d = Math.hypot(V.x(k.t) - x, V.y(k.v) - y); if (d < bd) { bd = d; best = i; } });
    return best;
  };
  cv.addEventListener('pointerdown', (e) => {
    const [c, V] = view();
    if (!c) return;
    const [x, y] = pos(e);
    const arr = (c.keys && c.keys[graph.prop]) || [];
    // bezier handle?
    const sk = arr[graph.sel], nk = arr[graph.sel + 1];
    if (sk && nk && sk.ease === 'bezier' && sk.h) {
      const hp = graphHandlePoints(V, sk, nk);
      for (let hi = 0; hi < 2; hi++) if (Math.hypot(hp[hi][0] - x, hp[hi][1] - y) < 8) {
        beginEdit(); graph.drag = { kind: 'handle', hi, k: sk, n: nk }; cv.setPointerCapture(e.pointerId); return;
      }
    }
    const i = hitKey(c, V, x, y);
    if (e.button === 2) { if (i >= 0) { graph.sel = i; graphDeleteSelected(); } return; }
    if (i >= 0) {
      graph.sel = i; renderGraphHead();
      beginEdit(); graph.drag = { kind: 'key', i }; cv.setPointerCapture(e.pointerId);
      seek(c.start + arr[i].t);
    } else {
      graph.sel = -1; renderGraphHead();
      seek(c.start + V.t(x));
    }
    drawGraph();
  });
  cv.addEventListener('pointermove', (e) => {
    if (!graph.drag) return;
    const [c, V] = view();
    if (!c) return;
    const [x, y] = pos(e);
    const arr = c.keys && c.keys[graph.prop];
    if (!arr) return;
    if (graph.drag.kind === 'key') {
      const i = graph.drag.i, k = arr[i];
      const minT = i > 0 ? arr[i - 1].t + 1 / FPS : 0, maxT = i < arr.length - 1 ? arr[i + 1].t - 1 / FPS : V.d;
      k.t = clamp(Math.round(V.t(x) * FPS) / FPS, Math.max(0, minT), Math.min(V.d, maxT));
      let v = V.v(y);
      if (graph.prop === 'opacity') v = clamp(v, 0, 1);
      if (graph.prop === 'volume') v = clamp(v, 0, 3);
      if (graph.prop === 'scale') v = Math.max(0.01, v);
      k.v = e.shiftKey ? k.v : v;
      seek(c.start + k.t);
    } else {
      const { hi, k, n } = graph.drag;
      const x0 = V.x(k.t), x1 = V.x(n.t), y0 = V.y(k.v), y1 = V.y(n.v);
      const fx = clamp((x - x0) / Math.max(1, x1 - x0), 0, 1);
      const fy = Math.abs(y1 - y0) < 1 ? (y - y0) / 60 : (y - y0) / (y1 - y0);
      k.h[hi * 2] = fx; k.h[hi * 2 + 1] = clamp(fy, -1.5, 2.5);
    }
    requestDraw(); drawGraph();
  });
  const up = () => { if (graph.drag) { graph.drag = null; endEdit(); renderLanes(); scheduleInspector(); } };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('dblclick', (e) => {
    const [c, V] = view();
    if (!c) return;
    if (!requirePremium('Keyframes')) return;
    const [x] = pos(e);
    const t = Math.round(V.t(x) * FPS) / FPS;
    commit(() => {
      c.keys = c.keys || {};
      const arr = c.keys[graph.prop] = c.keys[graph.prop] || [];
      if (arr.some((k) => Math.abs(k.t - t) < 0.6 / FPS)) return;
      arr.push({ t, v: kv(c, graph.prop, t) });
      arr.sort((a, b) => a.t - b.t);
      graph.sel = arr.findIndex((k) => Math.abs(k.t - t) < 1e-6);
    });
    seek(c.start + t);
    renderGraphHead(); drawGraph();
  });
}
function graphDeleteSelected() {
  const c = getClip(state.selectedId);
  const arr = c && c.keys && c.keys[graph.prop];
  if (!arr || graph.sel < 0 || !arr[graph.sel]) return;
  commit(() => {
    const v = arr[graph.sel].v;
    arr.splice(graph.sel, 1);
    if (!arr.length) { delete c.keys[graph.prop]; c[graph.prop] = v; }
  });
  graph.sel = -1;
  renderGraphHead(); drawGraph();
}
