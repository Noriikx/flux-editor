/* Flux — Fusion page (like DaVinci's, made simple): a clip's look as a row of nodes.
   Picture comes in on the left (MediaIn), goes through each node in order, and comes out on the right (MediaOut).
   Nodes are the same effects you can add in the clip panel, plus Fusion-only ones: Transform, Color, Text+, Shape, Background. */
'use strict';

/* ---------- Fusion-only nodes ---------- */
Object.assign(EFFECT_TYPES, {
  transform: { name: 'Transform', group: 'fusion', params: [['x', 'Move X', -100, 100, 0], ['y', 'Move Y', -100, 100, 0], ['scale', 'Size %', 5, 400, 100], ['rot', 'Rotate', -180, 180, 0], ['opacity', 'Opacity %', 0, 100, 100]] },
  colorcorrect: { name: 'Color', group: 'fusion', params: [['bright', 'Brightness', 0, 200, 100], ['contrast', 'Contrast', 0, 200, 100], ['sat', 'Saturation', 0, 300, 100], ['hue', 'Hue', -180, 180, 0], ['warm', 'Warmth', -100, 100, 0]] },
  textplus: { name: 'Text+', group: 'fusion', text: ['text', 'Text', 'Your title'], font: ['font', 'Font', 'Montserrat'],
    params: [['size', 'Size', 10, 400, 110], ['x', 'Position X', 0, 100, 50], ['y', 'Position Y', 0, 100, 50], ['outline', 'Outline', 0, 30, 0], ['glow', 'Glow', 0, 100, 0], ['spacing', 'Letter spacing', -10, 60, 0]],
    color: ['color', 'Text color', '#ffffff'], color2: ['glowColor', 'Glow / outline color', '#8d7dff'], flags: [['bold', 'Bold', true], ['shadow', 'Shadow', true]] },
  shape: { name: 'Shape', group: 'fusion', choice: ['kind', 'Shape', [['rect', 'Rectangle'], ['ellipse', 'Circle'], ['tri', 'Triangle']], 'rect'],
    params: [['x', 'Position X', 0, 100, 50], ['y', 'Position Y', 0, 100, 80], ['w', 'Width %', 1, 150, 60], ['h', 'Height %', 1, 150, 14], ['rot', 'Rotate', -180, 180, 0], ['round', 'Round corners', 0, 100, 20], ['soft', 'Soft edge', 0, 100, 0], ['opacity', 'Opacity %', 0, 100, 85]],
    color: ['color', 'Color', '#6c4bff'], flags: [['cut', 'Cut a hole instead', false]] },
  background: { name: 'Background', group: 'fusion', choice: ['mode', 'Fill', [['solid', 'Solid'], ['grad', 'Gradient']], 'grad'], params: [['angle', 'Gradient angle', 0, 360, 135]],
    color: ['color', 'Color 1', '#1b1464'], color2: ['color2', 'Color 2', '#ff5c7a'] }
});
Object.assign(FX_SWATCH, { transform: 'none', colorcorrect: 'saturate(1.4)', textplus: 'brightness(.8)', shape: 'none', background: 'hue-rotate(200deg)' });
Object.assign(FX_EXTRA, {
  transform(g, src, e, w, h) {
    g.globalAlpha = e.opacity / 100;
    g.translate(w / 2 + (e.x / 100) * w, h / 2 + (e.y / 100) * h);
    g.rotate((e.rot * Math.PI) / 180);
    g.scale(e.scale / 100, e.scale / 100);
    g.drawImage(src, -w / 2, -h / 2);
  },
  colorcorrect(g, src, e, w, h) {
    g.filter = `brightness(${e.bright / 100}) contrast(${e.contrast / 100}) saturate(${e.sat / 100}) hue-rotate(${e.hue}deg)`;
    g.drawImage(src, 0, 0);
    g.filter = 'none';
    if (e.warm) {
      g.globalCompositeOperation = 'soft-light';
      g.fillStyle = e.warm > 0 ? `rgba(255,140,40,${e.warm / 140})` : `rgba(40,120,255,${-e.warm / 140})`;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(src, 0, 0);
    }
  },
  textplus(g, src, e, w, h, k) {
    g.drawImage(src, 0, 0);
    const size = Math.max(4, e.size * k);
    g.font = `${e.bold ? 700 : 400} ${size}px "${e.font || 'Segoe UI'}", "Segoe UI", sans-serif`;
    if ('letterSpacing' in g) g.letterSpacing = (e.spacing * k) + 'px';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const lines = String(e.text || '').split('\n'), lh = size * 1.15;
    const x = (e.x / 100) * w, y0 = (e.y / 100) * h - ((lines.length - 1) * lh) / 2;
    lines.forEach((ln, i) => {
      const y = y0 + i * lh;
      if (e.glow > 0) { g.save(); g.shadowColor = e.glowColor; g.shadowBlur = (e.glow / 100) * size * 0.8; g.fillStyle = e.glowColor; g.fillText(ln, x, y); g.restore(); }
      if (e.shadow) { g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = size * 0.12; g.shadowOffsetY = size * 0.05; g.fillStyle = e.color; g.fillText(ln, x, y); g.restore(); }
      if (e.outline > 0) { g.lineJoin = 'round'; g.lineWidth = e.outline * k; g.strokeStyle = e.glowColor; g.strokeText(ln, x, y); }
      g.fillStyle = e.color; g.fillText(ln, x, y);
    });
  },
  shape(g, src, e, w, h, k) {
    g.drawImage(src, 0, 0);
    const sw = (e.w / 100) * w, sh = (e.h / 100) * h;
    g.save();
    g.globalAlpha = e.opacity / 100;
    if (e.soft > 0) g.filter = `blur(${((e.soft / 100) * Math.min(sw, sh) * 0.25).toFixed(1)}px)`;
    g.globalCompositeOperation = e.cut ? 'destination-out' : 'source-over';
    g.translate((e.x / 100) * w, (e.y / 100) * h);
    g.rotate((e.rot * Math.PI) / 180);
    g.beginPath();
    if (e.kind === 'ellipse') g.ellipse(0, 0, sw / 2, sh / 2, 0, 0, Math.PI * 2);
    else if (e.kind === 'tri') { g.moveTo(0, -sh / 2); g.lineTo(sw / 2, sh / 2); g.lineTo(-sw / 2, sh / 2); g.closePath(); }
    else roundRect(g, -sw / 2, -sh / 2, sw, sh, (e.round / 100) * Math.min(sw, sh) / 2);
    g.fillStyle = e.color; g.fill();
    g.restore();
  },
  background(g, src, e, w, h) {
    if (e.mode === 'grad') {
      const a = (e.angle * Math.PI) / 180, r = Math.hypot(w, h) / 2;
      const gr = g.createLinearGradient(w / 2 - Math.cos(a) * r, h / 2 - Math.sin(a) * r, w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r);
      gr.addColorStop(0, e.color); gr.addColorStop(1, e.color2);
      g.fillStyle = gr;
    } else g.fillStyle = e.color;
    g.fillRect(0, 0, w, h);
    g.drawImage(src, 0, 0);
  }
});
// keep Fusion-only nodes out of the long effects menu in the clip panel (they live on the Fusion page)
const FUSION_GROUPS = [
  ['Fusion basics', ['transform', 'colorcorrect', 'textplus', 'shape', 'background']],
  ['Blur & sharpen', ['gaussian', 'lens', 'directional', 'radial', 'zoom', 'mosaic', 'tiltshift', 'sharpen']],
  ['Stylize', ['glow', 'dreamglow', 'chroma', 'glitch', 'vhs', 'cctv', 'scanlines', 'duotone', 'posterize', 'threshold', 'emboss', 'edges', 'sketch', 'halftone', 'invert', 'lightleak']],
  ['Shape & frame', ['shadow', 'rounded', 'border', 'letterbox', 'paper', 'mirror', 'kaleido']],
  ['Motion', ['shake', 'pulse']]
];
const FUSION_PRESETS = [
  ['Big title', [['textplus', { text: 'BIG TITLE', size: 150, glow: 40 }]]],
  ['Lower third', [['shape', { x: 28, y: 84, w: 46, h: 13, color: '#6c4bff' }], ['textplus', { text: 'Your Name', x: 28, y: 84, size: 60 }]]],
  ['Picture in picture', [['transform', { scale: 38, x: 27, y: -24 }], ['background', { mode: 'grad' }]]],
  ['Retro TV', [['vhs', {}], ['scanlines', {}], ['rounded', { radius: 30 }]]],
  ['Dreamy', [['colorcorrect', { sat: 130, warm: 30 }], ['dreamglow', { amount: 60 }]]],
  ['Spotlight', [['shape', { kind: 'ellipse', x: 50, y: 50, w: 55, h: 75, soft: 70, opacity: 100, color: '#000000', cut: true }], ['background', { mode: 'solid', color: '#000000' }]]]
];

/* ---------- the page ---------- */
const fusion = { open: false, sel: null, drag: null };
const fusionClip = () => { const c = getClip(state.selectedId); return c && (isVisual(c) || c.kind === 'adjust') ? c : null; };
function setupFusion() {
  const tools = $('#tlToolbar .tl-tools');
  const sw = el('div', 'page-switch');
  sw.innerHTML = '<button data-p="edit" class="on" data-tip="Edit page - the timeline">Edit</button><button data-p="fusion" data-tip="Fusion page - build a clip’s look with nodes">Fusion</button>';
  tools.prepend(sw);
  $$('button', sw).forEach((b) => (b.onclick = () => (b.dataset.p === 'fusion' ? openFusion() : closeFusion())));
  const page = el('div', ''); page.id = 'fusionPage'; page.hidden = true;
  $('#timelinePanel').appendChild(page);
  // keep the page in sync after edits / undo
  const baseRI = renderInspector;
  renderInspector = function () { const r = baseRI.apply(this, arguments); if (fusion.open) renderFusion(); return r; };
  window.addEventListener('keydown', (e) => {
    if (!fusion.open || !fusion.sel) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || document.querySelector('.modal')) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const c = fusionClip(); if (!c) return;
      const f = (c.effects || []).find((x) => x.id === fusion.sel); if (!f) return;
      e.preventDefault(); e.stopPropagation();
      commit(() => { c.effects = c.effects.filter((x) => x !== f); });
      fusion.sel = null;
    }
  }, true);
}
function openFusion() {
  fusion.open = true;
  document.body.classList.add('fusion-open');
  $('#fusionPage').hidden = false;
  $$('.page-switch button').forEach((b) => b.classList.toggle('on', b.dataset.p === 'fusion'));
  renderFusion();
}
function closeFusion() {
  fusion.open = false;
  document.body.classList.remove('fusion-open');
  $('#fusionPage').hidden = true;
  $$('.page-switch button').forEach((b) => b.classList.toggle('on', b.dataset.p === 'edit'));
  renderTimeline();
}
function addFusionNode(c, type, props) {
  const t = EFFECT_TYPES[type];
  if (t.pro && !requirePremium(t.name)) return;
  const n = Object.assign(newEffect(type), props || {});
  commit(() => {
    c.effects = c.effects || [];
    const i = c.effects.findIndex((x) => x.id === fusion.sel);
    c.effects.splice(i >= 0 ? i + 1 : c.effects.length, 0, n);
  });
  fusion.sel = n.id;
  if (n.font && typeof ensureFont === 'function') ensureFont(n.font);
  renderFusion();
}
function nodeMenu(c, x, y, pick) {
  pick = pick || ((id) => addFusionNode(c, id));
  const items = [];
  for (const [group, ids] of FUSION_GROUPS) {
    items.push({ label: '— ' + group + ' —', disabled: true, fn: () => {} });
    for (const id of ids) { const t = EFFECT_TYPES[id]; if (t) items.push({ label: '   ' + t.name, pro: t.pro && !isPremium(), fn: () => pick(id) }); }
  }
  contextMenu(x, y, items);
  const m = $('.ctx-menu'); if (m) { m.style.maxHeight = '70vh'; m.style.overflowY = 'auto'; }
}
function renderFusion() {
  const page = $('#fusionPage');
  if (!page || !fusion.open) return;
  const c = fusionClip();
  const keepScroll = $('.fu-graph', page) ? $('.fu-graph', page).scrollLeft : 0;
  page.innerHTML = '';
  if (!c) {
    page.innerHTML = `<div class="fu-empty"><b>Pick a clip first</b><p>Go back to <a href="#" data-a="edit">Edit</a>, click a video, photo or adjustment clip, then come back to Fusion.</p></div>`;
    $('[data-a=edit]', page).onclick = (e) => { e.preventDefault(); closeFusion(); };
    return;
  }
  const nodes = c.effects || [];
  page.innerHTML = `
    <div class="fu-bar">
      <b class="fu-title"></b>
      <button class="btn small primary" data-a="add">+ Add node</button>
      <span class="fu-presets"></span>
      <span style="flex:1"></span>
      <span class="fu-hint">Picture flows left → right. Drag a node to change the order · click to edit · Delete removes it</span>
    </div>
    <div class="fu-main"><div class="fu-graph"><svg class="fu-wires"></svg></div><div class="fu-insp"></div></div>`;
  $('.fu-title', page).textContent = 'Fusion · ' + clipLabel(c);
  $('[data-a=add]', page).onclick = (e) => { const r = e.currentTarget.getBoundingClientRect(); nodeMenu(c, r.left, r.bottom + 4); };
  const pre = $('.fu-presets', page);
  for (const [name, list] of FUSION_PRESETS) {
    const b = el('button', 'chip', name);
    b.dataset.tip = 'Add this ready-made set of nodes';
    b.onclick = () => {
      if (list.some(([id]) => EFFECT_TYPES[id].pro) && !requirePremium(name)) return;
      commit(() => { c.effects = c.effects || []; for (const [id, props] of list) c.effects.push(Object.assign(newEffect(id), props)); });
      for (const [id, props] of list) if (props.font || id === 'textplus') ensureFont && ensureFont((props && props.font) || 'Montserrat');
      toast(name + ' added');
    };
    pre.appendChild(b);
  }
  const graph = $('.fu-graph', page), svg = $('.fu-wires', page);
  const STEP = 170, X0 = 30, NW = 132;
  const all = [{ id: '__in', label: 'MediaIn', sub: clipLabel(c), kind: 'io' }, ...nodes.map((n) => ({ id: n.id, label: (EFFECT_TYPES[n.type] || {}).name || n.type, sub: n.type === 'textplus' ? n.text : '', kind: (EFFECT_TYPES[n.type] || {}).group === 'fusion' ? 'gen' : 'fx', off: n.on === false, n })), { id: '__out', label: 'MediaOut', sub: maskOn(c) ? 'with mask' : 'to the timeline', kind: 'io' }];
  const width = X0 * 2 + (all.length - 1) * STEP + NW;
  svg.setAttribute('width', width); svg.setAttribute('height', 10);
  svg.style.width = width + 'px';
  const els = all.map((a, i) => {
    const d = el('div', `fu-node ${a.kind}${a.off ? ' off' : ''}${fusion.sel === a.id ? ' sel' : ''}`);
    d.style.left = X0 + i * STEP + 'px';
    d.dataset.id = a.id;
    d.innerHTML = `<i class="fu-dot in"></i><i class="fu-dot out"></i><b></b><small></small>${a.n ? '<button class="fu-pow" data-tip="Turn on / off">⏻</button><button class="fu-x" data-tip="Remove (Delete)">×</button>' : ''}`;
    $('b', d).textContent = a.label;
    $('small', d).textContent = a.sub || '';
    graph.appendChild(d);
    if (a.n) {
      $('.fu-pow', d).onclick = (e) => { e.stopPropagation(); commit(() => { a.n.on = a.n.on === false; }); };
      $('.fu-x', d).onclick = (e) => { e.stopPropagation(); commit(() => { c.effects = c.effects.filter((x) => x !== a.n); }); if (fusion.sel === a.id) fusion.sel = null; renderFusion(); };
    }
    d.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      fusion.sel = a.id;
      $$('.fu-node', graph).forEach((x) => x.classList.toggle('sel', x === d));
      showFusionInspector(c);
      if (!a.n) return;
      const x0 = e.clientX, left0 = parseFloat(d.style.left);
      d.setPointerCapture(e.pointerId);
      let moved = false;
      const mv = (ev) => {
        const dx = ev.clientX - x0;
        if (!moved && Math.abs(dx) < 4) return;
        moved = true; d.classList.add('dragging');
        d.style.left = clamp(left0 + dx, X0 + STEP * 0.5, X0 + (all.length - 1.5) * STEP) + 'px';
        drawWires();
      };
      const up = () => {
        d.removeEventListener('pointermove', mv); d.removeEventListener('pointerup', up);
        d.classList.remove('dragging');
        if (!moved) return;
        const to = clamp(Math.round((parseFloat(d.style.left) - X0) / STEP), 1, nodes.length) - 1;
        const from = nodes.indexOf(a.n);
        if (to !== from) commit(() => { c.effects.splice(from, 1); c.effects.splice(to, 0, a.n); });
        else renderFusion();
      };
      d.addEventListener('pointermove', mv); d.addEventListener('pointerup', up);
    });
    return d;
  });
  const drawWires = () => {
    const H = graph.clientHeight || 220, y = H / 2;
    svg.setAttribute('height', H); svg.style.height = H + 'px';
    const order = els.slice().sort((p, q) => parseFloat(p.style.left) - parseFloat(q.style.left));
    let path = '';
    for (let i = 0; i < order.length - 1; i++) {
      const xa = parseFloat(order[i].style.left) + NW, xb = parseFloat(order[i + 1].style.left);
      path += `M${xa},${y} C${xa + 30},${y} ${xb - 30},${y} ${xb},${y} `;
    }
    svg.innerHTML = `<path d="${path}" />`;
    els.forEach((d) => (d.style.top = y - 32 + 'px'));
  };
  requestAnimationFrame(drawWires);
  graph.addEventListener('pointerdown', (e) => { if (e.target === graph || e.target === svg) { fusion.sel = null; $$('.fu-node', graph).forEach((x) => x.classList.remove('sel')); showFusionInspector(c); } });
  graph.addEventListener('contextmenu', (e) => { e.preventDefault(); nodeMenu(c, e.clientX, e.clientY); });
  graph.scrollLeft = keepScroll;
  showFusionInspector(c);
}
function showFusionInspector(c) {
  const box = $('#fusionPage .fu-insp');
  if (!box) return;
  box.innerHTML = '';
  rt.inspRefresh = rt.inspRefresh || [];
  if (fusion.sel === '__out') {
    const h = el('div', 'fu-ih'); h.innerHTML = '<b>MediaOut</b><small>What leaves this node goes back to the timeline. Add a mask here to show only part of it.</small>';
    box.appendChild(h);
    maskInspector(box, c);
    return;
  }
  if (fusion.sel === '__in') {
    const h = el('div', 'fu-ih'); h.innerHTML = '<b>MediaIn</b><small>The clip itself. Size, position, color and speed are set on the Edit page.</small>';
    box.appendChild(h);
    return;
  }
  const n = (c.effects || []).find((x) => x.id === fusion.sel);
  if (!n) {
    const h = el('div', 'fu-ih');
    h.innerHTML = '<b>Nodes</b><small>Click a node to change it. Use <b>+ Add node</b> (or right-click the empty space) to add Text+, Shape, Background, Transform, Color and every effect. Try a ready-made set like <b>Lower third</b>.</small>';
    box.appendChild(h);
    return;
  }
  const card = fxCard(c, n);
  if (card) { card.classList.add('fu-card'); box.appendChild(card); }
}
