/* Flux — video effects (blurs, sharpen, CCTV, paper edge, drop shadow) and masks (rectangle, ellipse, pen).
   A clip with effects or a mask is first drawn into its own layer, processed, then placed in the frame. */
'use strict';
const EFFECT_TYPES = {
  gaussian: { name: 'Gaussian blur', params: [['amount', 'Amount', 0, 80, 12]] },
  mosaic: { name: 'Mosaic blur', params: [['size', 'Block size', 2, 120, 24]] },
  shadow: { name: 'Drop shadow', params: [['dist', 'Distance', 0, 200, 30], ['angle', 'Angle', -180, 180, 45], ['blur', 'Softness', 0, 200, 40], ['opacity', 'Strength', 0, 100, 60]], color: ['color', 'Color', '#000000'] },
  lens: { name: 'Lens blur', pro: true, params: [['amount', 'Amount', 0, 80, 16], ['bokeh', 'Bokeh glow', 0, 100, 40]] },
  directional: { name: 'Directional blur', pro: true, params: [['amount', 'Amount', 0, 150, 40], ['angle', 'Angle', -180, 180, 0]] },
  radial: { name: 'Radial blur', pro: true, params: [['amount', 'Spin', 0, 45, 8], ['cx', 'Center X', 0, 100, 50], ['cy', 'Center Y', 0, 100, 50]] },
  zoom: { name: 'Zoom blur', pro: true, params: [['amount', 'Amount', 0, 100, 30], ['cx', 'Center X', 0, 100, 50], ['cy', 'Center Y', 0, 100, 50]] },
  sharpen: { name: 'Ultra sharpen', pro: true, params: [['amount', 'Amount', 0, 300, 120]] },
  cctv: { name: 'CCTV', pro: true, params: [['noise', 'Noise', 0, 100, 40], ['lines', 'Scan lines', 0, 100, 50], ['green', 'Green tint', 0, 100, 35]], flags: [['stamp', 'REC & clock', true]] },
  paper: { name: 'Paper edge', pro: true, params: [['rough', 'Roughness', 0, 100, 50], ['border', 'Paper border', 0, 80, 22], ['inset', 'Edge inset', 0, 30, 6]], color: ['paper', 'Paper color', '#f4f1ea'] }
};
const FX_EXTRA = {}; // more effects are added by more.js
const effectsOn = (c) => (c.effects || []).filter((e) => e.on !== false && EFFECT_TYPES[e.type] && (!EFFECT_TYPES[e.type].pro || isPremium()));
const maskOn = (c) => c.mask && c.mask.shape && c.mask.shape !== 'none' && (c.mask.shape !== 'pen' || (c.mask.points && c.mask.points.length >= 3));
const needsLayer = (c) => effectsOn(c).length > 0 || maskOn(c);

function newEffect(type) {
  const t = EFFECT_TYPES[type], e = { id: uid(), type, on: true };
  for (const [k, , , , d] of t.params) e[k] = d;
  if (t.color) e[t.color[0]] = t.color[2];
  if (t.color2) e[t.color2[0]] = t.color2[2];
  if (t.text) e[t.text[0]] = t.text[2];
  if (t.font) e[t.font[0]] = t.font[2];
  if (t.choice) e[t.choice[0]] = t.choice[3];
  for (const [k, , d] of t.flags || []) e[k] = d;
  return e;
}
function addEffect(c, type) {
  const t = EFFECT_TYPES[type];
  if (!c || !(isVisual(c) || c.kind === 'adjust')) return toast('Select a video, photo or adjustment clip first');
  if (t.font && typeof ensureFont === 'function') ensureFont(t.font[2]);
  if (t.pro && !requirePremium(t.name)) return;
  commit(() => { c.effects = c.effects || []; c.effects.push(newEffect(type)); });
  toast(t.name + ' added');
}

// ---------- canvas pool ----------
const fxPool = [];
function poolCanvas(i, w, h) {
  const cv = fxPool[i] || (fxPool[i] = document.createElement('canvas'));
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  const g = cv.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.imageSmoothingEnabled = true;
  g.clearRect(0, 0, w, h);
  return cv;
}
// average many shifted copies = smooth motion / spin / zoom blur
function averageTaps(dst, srcCv, taps) {
  const g = dst.getContext('2d');
  taps.forEach((tf, i) => {
    g.save();
    g.globalAlpha = 1 / (i + 1);
    tf(g);
    g.drawImage(srcCv, 0, 0);
    g.restore();
  });
}
// SVG convolution filter for sharpening (the browser runs it fast)
const sharpenIds = new Set();
function sharpenFilter(amount) {
  const a = Math.round(amount) / 100, id = 'fluxSharp' + Math.round(amount);
  if (!sharpenIds.has(id)) {
    let svg = $('#fluxSvgFilters');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'fluxSvgFilters';
      svg.setAttribute('width', '0'); svg.setAttribute('height', '0');
      svg.style.position = 'absolute';
      document.body.appendChild(svg);
    }
    const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    f.id = id;
    f.innerHTML = `<feConvolveMatrix order="3" preserveAlpha="true" kernelMatrix="0 ${-a} 0 ${-a} ${1 + 4 * a} ${-a} 0 ${-a} 0"/>`;
    svg.appendChild(f);
    sharpenIds.add(id);
  }
  return `url(#${id})`;
}
// a fixed bumpy edge for the paper effect
function paperPath(g, w, h, inset, rough, seed) {
  const pts = [], step = Math.max(6, Math.min(w, h) / 40);
  const amp = (rough / 100) * Math.min(w, h) * 0.025;
  const jit = (i) => { const x = Math.sin(i * 91.7 + seed * 13.1) * 43758.5453; return (x - Math.floor(x) - 0.5) * 2 * amp; };
  let i = 0;
  for (let x = inset; x <= w - inset; x += step) pts.push([x, inset + jit(i++)]);
  for (let y = inset; y <= h - inset; y += step) pts.push([w - inset + jit(i++), y]);
  for (let x = w - inset; x >= inset; x -= step) pts.push([x, h - inset + jit(i++)]);
  for (let y = h - inset; y >= inset; y -= step) pts.push([inset + jit(i++), y]);
  g.beginPath();
  pts.forEach(([x, y], j) => (j ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

// Run the effect list on a canvas (returns the finished canvas). k = canvas pixels per 1080p-reference pixel.
function runEffects(c, A, k, local) {
  const w = A.width, h = A.height;
  let cur = A, slot = 1;
  const next = () => { slot = slot === 1 ? 2 : 1; return poolCanvas(slot, w, h); };
  for (const e of effectsOn(c)) {
    if (e.type === 'shadow') continue; // applied when placing the layer
    let B;
    switch (e.type) {
      case 'gaussian': {
        if (e.amount <= 0) continue;
        B = next(); const g = B.getContext('2d'); g.filter = `blur(${(e.amount * k).toFixed(2)}px)`; g.drawImage(cur, 0, 0); g.filter = 'none';
        break;
      }
      case 'mosaic': {
        const s = Math.max(2, e.size * k);
        const tw = Math.max(1, Math.round(w / s)), th = Math.max(1, Math.round(h / s));
        const T = poolCanvas(3, tw, th); T.getContext('2d').drawImage(cur, 0, 0, tw, th);
        B = next(); const g = B.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(T, 0, 0, tw, th, 0, 0, w, h);
        break;
      }
      case 'lens': {
        if (e.amount <= 0) continue;
        const r = e.amount * k, n = 12, taps = [(g) => {}];
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; taps.push((g) => g.translate(Math.cos(a) * r, Math.sin(a) * r)); }
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.5; taps.push((g) => g.translate(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5)); }
        B = next(); averageTaps(B, cur, taps);
        const C = next(); const g = C.getContext('2d');
        g.filter = `blur(${(r * 0.25).toFixed(2)}px) brightness(${1 + e.bokeh / 400}) contrast(${1 + e.bokeh / 300})`;
        g.drawImage(B, 0, 0); g.filter = 'none';
        B = C;
        break;
      }
      case 'directional': {
        if (e.amount <= 0) continue;
        const r = e.amount * k, a = (e.angle * Math.PI) / 180, n = state.playing && !state.exporting ? 9 : 16, taps = [];
        for (let i = 0; i < n; i++) { const f = (i / (n - 1) - 0.5) * 2 * r; taps.push((g) => g.translate(Math.cos(a) * f, Math.sin(a) * f)); }
        B = next(); averageTaps(B, cur, taps);
        break;
      }
      case 'radial': {
        if (e.amount <= 0) continue;
        const cx = (e.cx / 100) * w, cy = (e.cy / 100) * h, n = state.playing && !state.exporting ? 9 : 16, taps = [];
        for (let i = 0; i < n; i++) { const ang = ((i / (n - 1) - 0.5) * e.amount * Math.PI) / 180; taps.push((g) => { g.translate(cx, cy); g.rotate(ang); g.translate(-cx, -cy); }); }
        B = next(); averageTaps(B, cur, taps);
        break;
      }
      case 'zoom': {
        if (e.amount <= 0) continue;
        const cx = (e.cx / 100) * w, cy = (e.cy / 100) * h, n = state.playing && !state.exporting ? 9 : 16, taps = [];
        for (let i = 0; i < n; i++) { const s = 1 + (i / (n - 1)) * (e.amount / 100) * 0.45; taps.push((g) => { g.translate(cx, cy); g.scale(s, s); g.translate(-cx, -cy); }); }
        B = next(); averageTaps(B, cur, taps);
        break;
      }
      case 'sharpen': {
        if (e.amount <= 0) continue;
        B = next(); const g = B.getContext('2d'); g.filter = sharpenFilter(e.amount); g.drawImage(cur, 0, 0); g.filter = 'none';
        break;
      }
      case 'cctv': {
        B = next(); const g = B.getContext('2d');
        g.filter = 'grayscale(1) contrast(1.35) brightness(1.08)'; g.drawImage(cur, 0, 0); g.filter = 'none';
        g.globalCompositeOperation = 'source-atop';
        if (e.green > 0) { g.globalCompositeOperation = 'overlay'; g.fillStyle = `rgba(70,255,120,${(e.green / 100) * 0.55})`; g.fillRect(0, 0, w, h); }
        g.globalCompositeOperation = 'source-atop';
        if (e.lines > 0) { const lh = Math.max(2, 3 * k); g.fillStyle = `rgba(0,0,0,${(e.lines / 100) * 0.35})`; for (let y = 0; y < h; y += lh * 2) g.fillRect(0, y, w, lh); }
        if (e.noise > 0) {
          g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = (e.noise / 100) * 0.8;
          g.translate(Math.random() * 256, Math.random() * 256); g.fillStyle = getGrain(g); g.fillRect(-256, -256, w + 512, h + 512); g.restore();
          g.globalCompositeOperation = 'source-atop';
        }
        const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)');
        g.fillStyle = vg; g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
        if (e.stamp) {
          const fs = Math.max(10, h * 0.045);
          g.font = `600 ${fs}px "Courier New", monospace`; g.textBaseline = 'top';
          g.fillStyle = 'rgba(255,255,255,.92)'; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = fs * 0.2;
          g.fillText('CAM 01', fs * 0.8, fs * 0.7);
          const blink = Math.floor((state.time * 2)) % 2 === 0;
          if (blink) { g.fillStyle = '#ff2b2b'; g.beginPath(); g.arc(w - fs * 4.2, fs * 1.2, fs * 0.35, 0, Math.PI * 2); g.fill(); }
          g.fillStyle = 'rgba(255,255,255,.92)'; g.fillText('REC', w - fs * 3.6, fs * 0.7);
          const d = new Date(2026, 0, 1, 12, 0, 0); d.setSeconds(d.getSeconds() + Math.floor(local || 0));
          const p2 = (x) => String(x).padStart(2, '0');
          const txt = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}  ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
          g.textBaseline = 'bottom'; g.fillText(txt, fs * 0.8, h - fs * 0.7);
          g.shadowBlur = 0;
        }
        break;
      }
      case 'paper': {
        B = next(); const g = B.getContext('2d');
        const inset = (e.inset / 100) * Math.min(w, h), border = e.border * k;
        const seed = (c.id || 'x').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
        g.fillStyle = e.paper || '#f4f1ea';
        paperPath(g, w, h, Math.max(0, inset), e.rough, seed); g.fill();
        g.save(); paperPath(g, w, h, inset + border, e.rough * 0.7, seed + 7); g.clip(); g.drawImage(cur, 0, 0); g.restore();
        break;
      }
      default: {
        const f = FX_EXTRA[e.type];
        if (!f) continue;
        B = next();
        try { f(B.getContext('2d'), cur, e, w, h, k, local); } catch (er) { console.warn('effect', e.type, er); continue; }
        break;
      }
    }
    cur = B;
  }
  return cur;
}
// Cut the layer to the mask shape (soft edge = feather, invert = keep the outside)
function applyMask(c, cur, k) {
  const m = c.mask, w = cur.width, h = cur.height;
  const M = poolCanvas(4, w, h), g = M.getContext('2d');
  const feather = ((m.feather || 0) / 100) * Math.min(w, h) * 0.2;
  if (feather > 0.5) g.filter = `blur(${feather.toFixed(1)}px)`;
  g.fillStyle = '#fff';
  g.beginPath();
  if (m.shape === 'pen') {
    m.points.forEach(([u, v], i) => (i ? g.lineTo(u * w, v * h) : g.moveTo(u * w, v * h)));
    g.closePath();
  } else {
    g.save();
    g.translate(m.x * w, m.y * h);
    g.rotate(((m.rot || 0) * Math.PI) / 180);
    const mw = m.w * w, mh = m.h * h;
    if (m.shape === 'ellipse') g.ellipse(0, 0, mw / 2, mh / 2, 0, 0, Math.PI * 2);
    else if (g.roundRect) g.roundRect(-mw / 2, -mh / 2, mw, mh, ((m.round || 0) / 100) * Math.min(mw, mh) / 2);
    else g.rect(-mw / 2, -mh / 2, mw, mh);
    g.restore();
  }
  g.fill();
  g.filter = 'none';
  const out = cur.getContext('2d');
  out.save();
  out.setTransform(1, 0, 0, 1, 0, 0);
  out.globalCompositeOperation = m.invert ? 'destination-out' : 'destination-in';
  out.drawImage(M, 0, 0);
  out.restore();
  return cur;
}
// Draw a media clip's own layer (picture + color + effects + mask). Returns { canvas, shadow }.
function buildLayer(c, src, sx, sy, cw, ch, dw, dh, k, fx, local) {
  const cap = state.exporting ? 4096 : state.playing ? Math.min(1280, Math.max(480, previewCap())) : Math.max(480, previewCap());
  let lw = Math.max(2, Math.round(Math.abs(dw * k))), lh = Math.max(2, Math.round(Math.abs(dh * k)));
  const sc = Math.min(1, cap / Math.max(lw, lh));
  lw = Math.max(2, Math.round(lw * sc)); lh = Math.max(2, Math.round(lh * sc));
  const lk = k * sc; // layer pixels per reference pixel
  const A = poolCanvas(0, lw, lh), g = A.getContext('2d');
  g.filter = buildFilter(c, lk);
  g.translate(lw / 2, lh / 2);
  try {
    if (fx && fx.pixel > 1) drawPixelated(g, src, sx, sy, cw, ch, lw, lh, fx.pixel);
    else if (fx && fx.glitch > 0) drawGlitched(g, src, sx, sy, cw, ch, lw, lh, fx.glitch);
    else g.drawImage(src, sx, sy, cw, ch, -lw / 2, -lh / 2, lw, lh);
  } catch {}
  g.filter = 'none';
  const f = filterById(c.filter);
  if (f.tint) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = f.tint; g.fillRect(-lw / 2, -lh / 2, lw, lh); g.globalCompositeOperation = 'source-over'; }
  drawEffects(g, c, lw, lh, local);
  g.setTransform(1, 0, 0, 1, 0, 0);
  let out = runEffects(c, A, lk, local);
  if (maskOn(c)) out = applyMask(c, out, lk);
  const sh = effectsOn(c).find((e) => e.type === 'shadow');
  return { canvas: out, shadow: sh || null };
}
function applyShadow(g, sh, k) {
  if (!sh) return;
  const a = (sh.angle * Math.PI) / 180;
  const hex = (sh.color || '#000000').replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16) || 0, gg = parseInt(hex.slice(2, 4), 16) || 0, b = parseInt(hex.slice(4, 6), 16) || 0;
  g.shadowColor = `rgba(${r},${gg},${b},${(sh.opacity / 100).toFixed(2)})`;
  g.shadowBlur = sh.blur * k;
  g.shadowOffsetX = Math.cos(a) * sh.dist * k;
  g.shadowOffsetY = Math.sin(a) * sh.dist * k;
}

/* ---------- inspector: effect stack ---------- */
function fxInspector(body, c) {
  const s = section(body, 'Effects & blurs', () => { c.effects = []; });
  const add = el('button', 'btn fx-add', '+ Add effect');
  add.onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    if (typeof nodeMenu === 'function') return nodeMenu(c, r.left, r.bottom + 4, (id) => addEffect(c, id));
    contextMenu(r.left, r.bottom + 4, Object.entries(EFFECT_TYPES).map(([id, t]) => ({ label: t.name, pro: t.pro && !isPremium(), fn: () => addEffect(c, id) })));
  };
  s.appendChild(add);
  for (const fxo of c.effects || []) { const card = fxCard(c, fxo); if (card) s.appendChild(card); }
}
// One effect's controls (used by the clip panel and by the Fusion page)
function fxCard(c, fxo) {
  const t = EFFECT_TYPES[fxo.type];
  if (!t) return null;
  const card = el('div', 'fx-card' + (fxo.on === false ? ' off' : ''));
  card.innerHTML = `<div class="fx-top"><label class="fx-on"><input type="checkbox"></label><b></b><span style="flex:1"></span><button class="icon-btn small" data-a="up" data-tip="Move earlier">↑</button><button class="icon-btn small" data-a="rm" data-tip="Remove">×</button></div>`;
  $('b', card).textContent = t.name + (t.pro && !isPremium() ? ' 👑' : '');
  const cb = $('input', card); cb.checked = fxo.on !== false;
  cb.onchange = () => commit(() => { fxo.on = cb.checked; });
  $('[data-a=rm]', card).onclick = () => commit(() => { c.effects = c.effects.filter((x) => x !== fxo); });
  $('[data-a=up]', card).onclick = () => commit(() => { const i = c.effects.indexOf(fxo); if (i > 0) { c.effects.splice(i, 1); c.effects.splice(i - 1, 0, fxo); } });
  if (t.text) {
    const [tk, tl] = t.text;
    const row = el('div', 'field wide'); row.innerHTML = '<label></label><textarea rows="2" class="fx-text"></textarea>'; row.firstChild.textContent = tl;
    const ta = $('textarea', row); ta.value = fxo[tk] || '';
    ta.addEventListener('input', () => { beginEdit(); fxo[tk] = ta.value; requestDraw(); });
    ta.addEventListener('change', endEdit);
    card.appendChild(row);
  }
  if (t.font) {
    const [fk, fl] = t.font;
    const row = el('div', 'field wide'); row.innerHTML = '<label></label><select></select>'; row.firstChild.textContent = fl;
    const sel = $('select', row);
    const fonts = typeof ALL_FONTS !== 'undefined' ? ALL_FONTS.filter((f) => !f.pro || isPremium()).map((f) => f.name || f) : FONTS;
    for (const f of fonts) { const o = el('option'); o.value = o.textContent = f; sel.appendChild(o); }
    sel.value = fxo[fk];
    sel.onchange = () => { if (typeof ensureFont === 'function') ensureFont(sel.value); commit(() => { fxo[fk] = sel.value; }); };
    card.appendChild(row);
  }
  for (const [k, label, mn, mx, d] of t.params) slider(card, label, { min: mn, max: mx, get: () => fxo[k], set: (v) => (fxo[k] = v), fmt: (v) => Math.round(v), def: d, live: false });
  if (t.choice) {
    const [ck, cl, opts] = t.choice;
    const row = el('div', 'field'); row.innerHTML = '<label></label>'; row.firstChild.textContent = cl;
    chips(row, opts.map(([v, l]) => ({ label: l, value: v })), fxo[ck], (v) => commit(() => { fxo[ck] = v; }));
    card.appendChild(row);
  }
  for (const col of [t.color, t.color2]) {
    if (!col) continue;
    const row = el('div', 'field'); row.innerHTML = `<label>${col[1]}</label><input type="color">`;
    const ci = $('input', row); ci.value = fxo[col[0]] || col[2];
    ci.addEventListener('input', () => { beginEdit(); fxo[col[0]] = ci.value; requestDraw(); });
    ci.addEventListener('change', endEdit);
    card.appendChild(row);
  }
  for (const [k, label] of t.flags || []) chips(card, [{ label: (fxo[k] ? '✓ ' : '') + label, value: 1 }], fxo[k] ? 1 : null, () => commit(() => { fxo[k] = !fxo[k]; }), 'toggle-row');
  return card;
}

/* ---------- inspector: mask ---------- */
function maskInspector(body, c) {
  const m = c.mask || (c.mask = { shape: 'none', x: 0.5, y: 0.5, w: 0.6, h: 0.6, rot: 0, feather: 10, invert: false, round: 0, points: [] });
  const s = section(body, 'Mask', () => { c.mask = { shape: 'none', x: 0.5, y: 0.5, w: 0.6, h: 0.6, rot: 0, feather: 10, invert: false, round: 0, points: [] }; rt.maskEdit = null; });
  chips(s, [{ label: 'None', value: 'none' }, { label: 'Rectangle', value: 'rect' }, { label: 'Circle', value: 'ellipse' }, { label: 'Pen', value: 'pen' }], m.shape || 'none', (v) => {
    commit(() => { m.shape = v; });
    rt.maskEdit = v === 'none' ? null : c.id;
    if (v === 'pen' && !(m.points && m.points.length)) toast('Click on the preview to place points. Drag points to move them, right-click one to remove it.', { duration: 6000 });
    requestDraw();
  }, 'toggle-row');
  if (!m.shape || m.shape === 'none') { const p = el('p', 'hint'); p.textContent = 'Show only part of the clip - pick a shape, then drag it on the preview.'; s.appendChild(p); return; }
  {
    const row = el('div', 'chips');
    const ed = el('button', 'chip' + (rt.maskEdit === c.id ? ' active' : ''), rt.maskEdit === c.id ? '✓ Editing on preview' : 'Edit on preview');
    ed.dataset.tip = 'Drag the mask (or its points) right on the video';
    ed.onclick = () => { rt.maskEdit = rt.maskEdit === c.id ? null : c.id; renderInspector(); requestDraw(); };
    row.appendChild(ed);
    if (m.shape === 'pen') { const clr = el('button', 'chip', 'Clear points'); clr.onclick = () => commit(() => { m.points = []; }); row.appendChild(clr); }
    s.appendChild(row);
  }
  if (m.shape !== 'pen') {
    slider(s, 'Position X', { min: 0, max: 100, get: () => Math.round(m.x * 100), set: (v) => (m.x = v / 100), fmt: (v) => v, def: 50, live: false });
    slider(s, 'Position Y', { min: 0, max: 100, get: () => Math.round(m.y * 100), set: (v) => (m.y = v / 100), fmt: (v) => v, def: 50, live: false });
    slider(s, 'Width', { min: 1, max: 150, get: () => Math.round(m.w * 100), set: (v) => (m.w = v / 100), fmt: (v) => v + '%', def: 60, live: false });
    slider(s, 'Height', { min: 1, max: 150, get: () => Math.round(m.h * 100), set: (v) => (m.h = v / 100), fmt: (v) => v + '%', def: 60, live: false });
    slider(s, 'Rotate', { min: -180, max: 180, get: () => m.rot || 0, set: (v) => (m.rot = v), fmt: (v) => v + '°', def: 0, live: false });
    if (m.shape === 'rect') slider(s, 'Round corners', { min: 0, max: 100, get: () => m.round || 0, set: (v) => (m.round = v), fmt: (v) => v, def: 0, live: false });
  } else {
    const p = el('p', 'hint'); p.textContent = `${(m.points || []).length} points - click the preview to add, drag to move, right-click to remove.`; s.appendChild(p);
  }
  slider(s, 'Soft edge', { min: 0, max: 100, get: () => m.feather || 0, set: (v) => (m.feather = v), fmt: (v) => v, def: 10, live: false });
  chips(s, [{ label: m.invert ? '✓ Inverted (keep outside)' : 'Invert', value: 1 }], m.invert ? 1 : null, () => commit(() => { m.invert = !m.invert; }), 'toggle-row');
}

/* ---------- mask editing on the preview ---------- */
function maskBox(c) { return rt.hitBoxes.find((b) => b.id === c.id) || (c.kind === 'adjust' ? (() => { const [W, H] = refSize(); return { cx: W / 2, cy: H / 2, w: W, h: H, rot: 0 }; })() : null); }
function drawMaskOverlay(k) {
  const c = getClip(state.selectedId);
  if (!c || rt.maskEdit !== c.id || !c.mask || !c.mask.shape || c.mask.shape === 'none') return;
  const b = maskBox(c);
  if (!b) return;
  const m = c.mask, g = octx, px = (window.devicePixelRatio || 1) / k;
  g.save();
  g.setTransform(k, 0, 0, k, 0, 0);
  g.translate(b.cx, b.cy); g.rotate(b.rot); g.translate(-b.w / 2, -b.h / 2);
  g.lineWidth = 1.6 * px; g.strokeStyle = '#ffd23f'; g.fillStyle = 'rgba(255,210,63,.08)';
  g.beginPath();
  if (m.shape === 'pen') {
    (m.points || []).forEach(([u, v], i) => (i ? g.lineTo(u * b.w, v * b.h) : g.moveTo(u * b.w, v * b.h)));
    if ((m.points || []).length >= 3) g.closePath();
    g.stroke();
    g.fillStyle = '#ffd23f';
    for (const [u, v] of m.points || []) { g.beginPath(); g.arc(u * b.w, v * b.h, 5 * px, 0, Math.PI * 2); g.fill(); }
  } else {
    g.save(); g.translate(m.x * b.w, m.y * b.h); g.rotate(((m.rot || 0) * Math.PI) / 180);
    const mw = m.w * b.w, mh = m.h * b.h;
    g.beginPath();
    if (m.shape === 'ellipse') g.ellipse(0, 0, mw / 2, mh / 2, 0, 0, Math.PI * 2); else g.rect(-mw / 2, -mh / 2, mw, mh);
    g.fill(); g.stroke();
    g.fillStyle = '#ffd23f';
    for (const [sx, sy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) { g.beginPath(); g.arc((sx * mw) / 2, (sy * mh) / 2, 5 * px, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  g.restore();
}
function setupMaskEditing() {
  const host = overlay.parentElement;
  let drag = null;
  const toUV = (e, c) => {
    const b = maskBox(c); if (!b) return null;
    const r = overlay.getBoundingClientRect(); const [W, H] = refSize();
    const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
    const dx = x - b.cx, dy = y - b.cy, cs = Math.cos(-b.rot), sn = Math.sin(-b.rot);
    const lx = dx * cs - dy * sn, ly = dx * sn + dy * cs;
    return { u: lx / b.w + 0.5, v: ly / b.h + 0.5, b, pxU: (r.width / W) * b.w, pxV: (r.height / H) * b.h };
  };
  host.addEventListener('pointerdown', (e) => {
    const c = getClip(state.selectedId);
    if (!c || rt.maskEdit !== c.id || !c.mask || c.mask.shape === 'none' || e.target !== overlay) return;
    const p = toUV(e, c); if (!p) return;
    const m = c.mask;
    e.stopPropagation(); e.preventDefault();
    if (m.shape === 'pen') {
      const pts = m.points || (m.points = []);
      const hit = pts.findIndex(([u, v]) => Math.hypot((u - p.u) * p.pxU, (v - p.v) * p.pxV) < 9);
      if (e.button === 2) { if (hit >= 0) commit(() => { pts.splice(hit, 1); }); renderInspector(); return; }
      beginEdit();
      if (hit >= 0) drag = { kind: 'pt', i: hit };
      else { pts.push([p.u, p.v]); drag = { kind: 'pt', i: pts.length - 1 }; }
    } else {
      const lx = p.u - m.x, ly = p.v - m.y;
      const near = (sx, sy) => Math.hypot((lx - (sx * m.w) / 2) * p.pxU, (ly - (sy * m.h) / 2) * p.pxV) < 10;
      beginEdit();
      if ([[1, 1], [-1, -1], [1, -1], [-1, 1]].some(([sx, sy]) => near(sx, sy))) drag = { kind: 'size' };
      else drag = { kind: 'move', du: lx, dv: ly };
    }
    host.setPointerCapture(e.pointerId);
    requestDraw();
  }, true);
  host.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const c = getClip(state.selectedId); if (!c || !c.mask) return;
    const p = toUV(e, c); if (!p) return;
    const m = c.mask;
    if (drag.kind === 'pt') m.points[drag.i] = [clamp(p.u, -0.2, 1.2), clamp(p.v, -0.2, 1.2)];
    else if (drag.kind === 'move') { m.x = p.u - drag.du; m.y = p.v - drag.dv; }
    else { m.w = clamp(Math.abs(p.u - m.x) * 2, 0.01, 2); m.h = clamp(Math.abs(p.v - m.y) * 2, 0.01, 2); }
    requestDraw();
  }, true);
  const up = () => { if (drag) { drag = null; endEdit(); scheduleInspector(); renderInspector(); } };
  host.addEventListener('pointerup', up, true);
  host.addEventListener('contextmenu', (e) => { const c = getClip(state.selectedId); if (c && rt.maskEdit === c.id) e.preventDefault(); }, true);
}

// show the effect stack and mask under the regular Effects section
{
  const baseEffectsInspector = effectsInspector;
  effectsInspector = function (body, c) { baseEffectsInspector(body, c); fxInspector(body, c); maskInspector(body, c); };
}
setupMaskEditing();

// effects also show in the Filters tab (click = add to the selected clip)
const FX_SWATCH = { gaussian: 'blur(3px)', mosaic: 'contrast(1.1)', shadow: 'drop-shadow(4px 4px 3px #000)', lens: 'blur(2px) brightness(1.15)', directional: 'blur(2px)', radial: 'blur(1.5px) saturate(1.2)', zoom: 'blur(2px) contrast(1.1)', sharpen: 'contrast(1.4) saturate(1.1)', cctv: 'grayscale(1) contrast(1.4) sepia(.3) hue-rotate(60deg)', paper: 'sepia(.25)' };
{
  const baseFilterGrid = renderFilterGrid;
  renderFilterGrid = function () {
    baseFilterGrid();
    const box = $('#filterGrid');
    if (!box) return;
    const c = getClip(state.selectedId);
    const thumb = c && isVisual(c) ? rt.thumbs.get(c.mediaId) : null;
    const h = el('div', 'fx-grid-title', 'Effects & blurs');
    box.appendChild(h);
    for (const [id, t] of Object.entries(EFFECT_TYPES)) {
      const b = el('button', 'filter-chip');
      const sw = el('div', 'swatch');
      if (thumb) sw.style.backgroundImage = `url('${thumb}')`;
      sw.style.filter = FX_SWATCH[id] || 'none';
      if (id === 'mosaic') sw.style.imageRendering = 'pixelated', sw.style.backgroundSize = '400%';
      b.appendChild(sw);
      b.appendChild(document.createTextNode(t.name));
      if (t.pro && !isPremium()) b.insertAdjacentHTML('beforeend', ' ' + CROWN);
      b.onclick = () => addEffect(getClip(state.selectedId), id);
      box.appendChild(b);
    }
  };
}
