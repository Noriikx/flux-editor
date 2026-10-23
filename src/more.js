/* Flux — the big pack: extra transitions, looks (filters) and effects. */
'use strict';

/* ============================ TRANSITIONS ============================ */
const MORE_TRANSITIONS = [
  // [id, name, pro, demo animation]
  ['popIn', 'Pop in', false, 'tZoom'], ['dropIn', 'Drop in', false, 'tSlideUp'], ['rise', 'Rise up', false, 'tSlideUp'],
  ['slideDiag', 'Slide diagonal', false, 'tSlide'], ['pushDiag', 'Push diagonal', false, 'tSlide'], ['smoothLeft', 'Smooth left', false, 'tSlide'],
  ['smoothRight', 'Smooth right', false, 'tSlide'], ['blurPush', 'Blur push', false, 'tBlur'], ['splitV', 'Curtain', false, 'tBarn'],
  ['cornerBox', 'Corner wipe', false, 'tWipe'], ['wipeDown', 'Wipe down', false, 'tSlideUp'], ['circleCorner', 'Corner circle', false, 'tCircle'],
  ['ellipse', 'Oval', false, 'tCircle'], ['roundBox', 'Rounded box', false, 'tIris'], ['blindsV', 'Vertical blinds', false, 'tBarn'],
  ['dipBlue', 'Dip to color', false, 'tFade'], ['stretch', 'Stretch', false, 'tFlip'], ['zoomRotate', 'Zoom rotate', false, 'tSpin'],
  ['triangle', 'Triangle', true, 'tCircle'], ['hexagon', 'Hexagon', true, 'tCircle'], ['cross', 'Cross', true, 'tIris'],
  ['radial2', 'Double clock', true, 'tCircle'], ['zigzag', 'Zigzag wipe', true, 'tWipe'], ['wave', 'Wave wipe', true, 'tWipe'],
  ['dots', 'Dissolve dots', true, 'tFade'], ['rollIn', 'Roll in', true, 'tSpin'], ['tiltIn', 'Tilt in', true, 'tSpin'],
  ['doorway', 'Doorway', true, 'tBarn'], ['spiral', 'Spiral', true, 'tSpin'], ['pixelFade', 'Pixel fade', true, 'tBlur'],
  ['filmRoll', 'Film roll', true, 'tSlideUp'], ['colorFlash', 'Color flash', true, 'tFade'], ['cubeLeft', 'Cube', true, 'tSlide'],
  ['shutter', 'Shutter', true, 'tBarn'], ['ripple', 'Ripple', true, 'tCircle'], ['tvOff', 'TV switch', true, 'tFlip']
];
TRANSITIONS.push(...MORE_TRANSITIONS.map(([id, name, pro]) => (pro ? { id, name, pro: true } : { id, name })));
{
  const st = document.createElement('style');
  st.textContent = MORE_TRANSITIONS.map(([id, , , demo]) => `.t-${id} .b { animation-name: ${demo}; }`).join('\n') + '\n.t-dipBlue { background: #2b3cff; } .t-colorFlash { background: #ff5cf0; }';
  document.head.appendChild(st);
}
const polyClip = (g, pts) => { pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
const backOut = (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
{
  const prevFx = transitionFx;
  transitionFx = function (type, p, role, W, H) {
    const e = easeInOut(clamp(p, 0, 1)), q = clamp(p, 0, 1);
    const isIn = role === 'in';
    const fx = { alpha: 1, dx: 0, dy: 0, scale: 1, rot: 0, blur: 0, clip: null, cover: null };
    const half = () => { fx.alpha = isIn ? (p >= 0.5 ? 1 : 0) : (p < 0.5 ? 1 : 0); };
    const mid = 1 - Math.abs(2 * e - 1); // 0 → 1 → 0
    const R = Math.hypot(W, H);
    switch (type) {
      case 'popIn': if (isIn) { fx.scale = Math.max(0.01, backOut(q)); fx.alpha = clamp(q * 3, 0, 1); } return fx;
      case 'dropIn': if (isIn) fx.dy = -(1 - backOut(q)) * H; return fx;
      case 'rise': if (isIn) { fx.dy = (1 - e) * H * 0.35; fx.alpha = e; } return fx;
      case 'slideDiag': if (isIn) { fx.dx = (1 - e) * W; fx.dy = (1 - e) * H; } return fx;
      case 'pushDiag': fx.dx = isIn ? (1 - e) * W : -e * W; fx.dy = isIn ? (1 - e) * H : -e * H; return fx;
      case 'smoothLeft': fx.dx = isIn ? (1 - e) * W : -e * W; fx.scale = 1 - mid * 0.12; return fx;
      case 'smoothRight': fx.dx = isIn ? -(1 - e) * W : e * W; fx.scale = 1 - mid * 0.12; return fx;
      case 'blurPush': fx.dx = isIn ? (1 - e) * W : -e * W; fx.blur = mid * 25; return fx;
      case 'splitV': if (isIn) fx.clip = (g) => { g.rect(0, 0, (e * W) / 2, H); g.rect(W - (e * W) / 2, 0, (e * W) / 2 + 0.5, H); }; return fx;
      case 'cornerBox': if (isIn) fx.clip = (g) => g.rect(0, 0, e * W, e * H); return fx;
      case 'wipeDown': if (isIn) fx.clip = (g) => g.rect(0, 0, W, e * H); return fx;
      case 'circleCorner': if (isIn) fx.clip = (g) => g.arc(0, 0, e * R + 0.01, 0, Math.PI * 2); return fx;
      case 'ellipse': if (isIn) fx.clip = (g) => g.ellipse(W / 2, H / 2, e * W * 0.75 + 0.01, e * H * 0.75 + 0.01, 0, 0, Math.PI * 2); return fx;
      case 'roundBox': if (isIn) fx.clip = (g) => { const w = e * W, h = e * H; roundRect(g, W / 2 - w / 2, H / 2 - h / 2, w + 0.01, h + 0.01, Math.min(w, h) * 0.18); }; return fx;
      case 'blindsV': if (isIn) fx.clip = (g) => { for (let i = 0; i < 12; i++) g.rect((i * W) / 12, 0, (e * W) / 12 + 0.5, H); }; return fx;
      case 'dipBlue': half(); fx.cover = { color: '#2b3cff', alpha: mid }; return fx;
      case 'colorFlash': half(); fx.cover = { color: ['#ff5cf0', '#4cc3ff', '#ffd23f'][Math.floor(q * 9) % 3], alpha: mid * 0.9 }; return fx;
      case 'stretch': if (isIn) { fx.flipX = Math.max(0.02, e); fx.alpha = clamp(e * 2, 0, 1); } return fx;
      case 'zoomRotate':
        if (isIn) { fx.alpha = e; fx.scale = 1.6 - 0.6 * e; fx.rot = (1 - e) * 0.6; } else { fx.scale = 1 + e * 0.4; fx.rot = -e * 0.4; fx.alpha = 1 - e * 0.5; }
        return fx;
      case 'triangle': if (isIn) fx.clip = (g) => { const s = e * R * 1.6; polyClip(g, [[W / 2, H / 2 - s * 0.6], [W / 2 + s * 0.55, H / 2 + s * 0.4], [W / 2 - s * 0.55, H / 2 + s * 0.4]]); }; return fx;
      case 'hexagon': if (isIn) fx.clip = (g) => { const r = e * R * 0.62 + 0.01; polyClip(g, Array.from({ length: 6 }, (_, i) => [W / 2 + Math.cos((i * Math.PI) / 3) * r, H / 2 + Math.sin((i * Math.PI) / 3) * r])); }; return fx;
      case 'cross': if (isIn) fx.clip = (g) => { const a = e * W, b = e * H; g.rect(W / 2 - a / 2, H / 2 - b * 0.15, a, b * 0.3); g.rect(W / 2 - a * 0.15, H / 2 - b / 2, a * 0.3, b); if (e > 0.6) g.rect(0, 0, W * ((e - 0.6) / 0.4), H); }; return fx;
      case 'radial2': if (isIn) fx.clip = (g) => { for (const s of [-Math.PI / 2, Math.PI / 2]) { g.moveTo(W / 2, H / 2); g.arc(W / 2, H / 2, R, s, s + e * Math.PI); g.closePath(); } }; return fx;
      case 'zigzag': if (isIn) fx.clip = (g) => { const x = e * (W + 80) - 40, n = 10, pts = [[0, 0], [x, 0]]; for (let i = 0; i <= n; i++) pts.push([x + (i % 2 ? 40 : 0), (i * H) / n]); pts.push([0, H]); polyClip(g, pts); }; return fx;
      case 'wave': if (isIn) fx.clip = (g) => { const x = e * (W + 80) - 40, pts = [[0, 0]]; for (let i = 0; i <= 24; i++) { const y = (i * H) / 24; pts.push([x + Math.sin(i * 0.8 + q * 10) * 40, y]); } pts.push([0, H]); polyClip(g, pts); }; return fx;
      case 'dots': if (isIn) fx.clip = (g) => { const n = 16, m = 9, cw = W / n, ch = H / m; for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) { const r = clamp(e * 1.6 - tHash(y * n + x) * 0.6, 0, 1) * Math.max(cw, ch) * 0.75; if (r > 0) { g.moveTo(x * cw + cw / 2 + r, y * ch + ch / 2); g.arc(x * cw + cw / 2, y * ch + ch / 2, r, 0, Math.PI * 2); } } }; return fx;
      case 'rollIn': if (isIn) { fx.dx = -(1 - e) * W; fx.rot = -(1 - e) * Math.PI * 2; fx.alpha = e; } return fx;
      case 'tiltIn': if (isIn) { fx.rot = (1 - e) * 0.35; fx.dy = (1 - e) * H * 0.25; fx.alpha = e; fx.scale = 0.9 + 0.1 * e; } return fx;
      case 'doorway': if (isIn) { fx.scale = 0.7 + 0.3 * e; fx.alpha = e; } else fx.clip = (g) => { g.rect(0, 0, (W / 2) * (1 - e), H); g.rect(W / 2 + (W / 2) * e, 0, (W / 2) * (1 - e), H); }; return fx;
      case 'spiral': if (isIn) { fx.alpha = e; fx.scale = e; fx.rot = -(1 - e) * Math.PI * 3; } else { fx.alpha = 1 - e; fx.scale = 1 - e * 0.5; fx.rot = e * Math.PI * 2; } return fx;
      case 'pixelFade': fx.pixel = 1 + mid * 40; if (isIn) fx.alpha = e; return fx;
      case 'filmRoll': fx.dy = isIn ? (1 - e) * H : -e * H; fx.blur = mid * 18; return fx;
      case 'cubeLeft': fx.dx = isIn ? (1 - e) * W : -e * W; fx.flipX = isIn ? 0.3 + 0.7 * e : 1 - 0.7 * e; return fx;
      case 'shutter': half(); fx.cover = { color: '#000', alpha: mid * 0.85 }; if (isIn) fx.clip = (g) => { for (let i = 0; i < 8; i++) g.rect(0, (i * H) / 8, W, (e * H) / 8 + 0.5); }; return fx;
      case 'ripple': if (isIn) { fx.clip = (g) => g.arc(W / 2, H / 2, e * R * 0.55 + 0.01, 0, Math.PI * 2); fx.scale = 1 + (1 - e) * 0.08 * Math.sin(q * 30); } return fx;
      case 'tvOff': half(); { const k = isIn ? clamp((q - 0.5) * 2, 0, 1) : clamp(1 - q * 2, 0, 1); fx.clip = (g) => { const h = Math.max(2, H * k * k), w = W * clamp(k * 3, 0.02, 1); g.rect(W / 2 - w / 2, H / 2 - h / 2, w, h); }; fx.cover = { color: '#fff', alpha: mid * 0.5 }; } return fx;
    }
    return prevFx(type, p, role, W, H);
  };
}

/* ============================ LOOKS (filters) ============================ */
FILTERS.push(
  { id: 'tealorange', name: 'Teal & orange', css: 'saturate(1.25) contrast(1.12)', tint: 'rgba(0,150,170,0.28)' },
  { id: 'moody', name: 'Moody', css: 'contrast(1.2) saturate(0.7) brightness(0.88)', tint: 'rgba(40,60,90,0.3)' },
  { id: 'matte', name: 'Matte', css: 'contrast(0.85) brightness(1.08) saturate(0.85)' },
  { id: 'kodak', name: 'Kodak', css: 'sepia(0.2) saturate(1.35) contrast(1.08)', tint: 'rgba(255,190,90,0.2)' },
  { id: 'polaroid', name: 'Polaroid', css: 'sepia(0.25) contrast(0.95) brightness(1.12) saturate(1.1)', tint: 'rgba(120,200,255,0.15)' },
  { id: 'cyberpunk', name: 'Cyberpunk', css: 'saturate(1.6) contrast(1.15) hue-rotate(-15deg)', tint: 'rgba(255,0,200,0.32)' },
  { id: 'arctic', name: 'Arctic', css: 'saturate(0.65) brightness(1.12) contrast(1.05)', tint: 'rgba(150,220,255,0.38)' },
  { id: 'golden', name: 'Golden hour', css: 'saturate(1.3) brightness(1.06)', tint: 'rgba(255,175,40,0.42)' },
  { id: 'desert', name: 'Desert', css: 'sepia(0.35) saturate(1.2) contrast(1.05)', tint: 'rgba(230,140,60,0.25)' },
  { id: 'forest', name: 'Forest', css: 'saturate(1.2) contrast(1.05) hue-rotate(10deg)', tint: 'rgba(40,140,60,0.3)' },
  { id: 'pastel', name: 'Pastel', css: 'saturate(0.7) brightness(1.18) contrast(0.85)', tint: 'rgba(255,190,230,0.25)' },
  { id: 'neonnight', name: 'Neon night', css: 'saturate(1.8) contrast(1.25) brightness(0.85)', tint: 'rgba(90,40,255,0.35)' },
  { id: 'bleach', name: 'Bleach bypass', css: 'saturate(0.45) contrast(1.45) brightness(1.04)' },
  { id: 'crossproc', name: 'Cross process', css: 'saturate(1.4) contrast(1.2) hue-rotate(12deg)', tint: 'rgba(200,255,90,0.22)' },
  { id: 'lomo', name: 'Lomo', css: 'saturate(1.6) contrast(1.35) brightness(0.95)' },
  { id: 'sepia', name: 'Sepia', css: 'sepia(0.9) contrast(1.05)' },
  { id: 'silver', name: 'Silver', css: 'grayscale(1) contrast(1.15) brightness(1.15)' },
  { id: 'infrared', name: 'Infrared', css: 'hue-rotate(180deg) saturate(1.6) contrast(1.1)' },
  { id: 'underwater', name: 'Underwater', css: 'saturate(1.1) brightness(0.95)', tint: 'rgba(0,140,200,0.45)' },
  { id: 'rose', name: 'Rose', css: 'saturate(1.15) brightness(1.05)', tint: 'rgba(255,90,150,0.3)' },
  { id: 'autumn', name: 'Autumn', css: 'saturate(1.3) contrast(1.06) hue-rotate(-12deg)', tint: 'rgba(220,100,30,0.3)' },
  { id: 'winter', name: 'Winter', css: 'saturate(0.6) brightness(1.1)', tint: 'rgba(170,200,255,0.35)' },
  { id: 'chrome', name: 'Chrome', css: 'saturate(1.25) contrast(1.3) brightness(1.05)' },
  { id: 'monoblue', name: 'Mono blue', css: 'grayscale(1) contrast(1.1)', tint: 'rgba(40,90,255,0.55)' },
  { id: 'monored', name: 'Mono red', css: 'grayscale(1) contrast(1.15)', tint: 'rgba(255,40,60,0.5)' },
  { id: 'highkey', name: 'High key', css: 'brightness(1.3) contrast(0.85) saturate(0.9)' },
  { id: 'lowkey', name: 'Low key', css: 'brightness(0.75) contrast(1.35)' },
  { id: 'retro80', name: 'Retro 80s', css: 'saturate(1.5) contrast(1.1) sepia(0.15)', tint: 'rgba(255,60,180,0.3)' },
  { id: 'cinema', name: 'Cinematic', css: 'contrast(1.15) saturate(0.9) brightness(0.95)', tint: 'rgba(0,110,130,0.22)' },
  { id: 'sunrise', name: 'Sunrise', css: 'saturate(1.25) brightness(1.08)', tint: 'rgba(255,120,120,0.3)' }
);

/* ============================ EFFECTS ============================ */
function svgFilterUrl(id, inner) {
  let svg = $('#fluxSvgFilters');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'fluxSvgFilters'; svg.setAttribute('width', '0'); svg.setAttribute('height', '0'); svg.style.position = 'absolute';
    document.body.appendChild(svg);
  }
  if (!document.getElementById(id)) {
    const f = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
    f.id = id; f.setAttribute('color-interpolation-filters', 'sRGB'); f.innerHTML = inner; svg.appendChild(f);
  }
  return `url(#${id})`;
}
const fxHexRgb = (h) => { h = (h || '#000000').replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255 || 0, parseInt(h.slice(2, 4), 16) / 255 || 0, parseInt(h.slice(4, 6), 16) / 255 || 0]; };
Object.assign(EFFECT_TYPES, {
  glow: { name: 'Glow', params: [['amount', 'Strength', 0, 100, 50], ['radius', 'Size', 1, 80, 25]] },
  chroma: { name: 'RGB split', params: [['amount', 'Amount', 0, 60, 12], ['angle', 'Angle', -180, 180, 0]] },
  mirror: { name: 'Mirror', params: [], choice: ['mode', 'Mirror', [['h', 'Left ↔ right'], ['v', 'Top ↕ bottom'], ['quad', '4-way']], 'h'] },
  letterbox: { name: 'Cinema bars', params: [['size', 'Bar size', 0, 40, 12]], color: ['color', 'Bar color', '#000000'] },
  rounded: { name: 'Rounded corners', params: [['radius', 'Roundness', 0, 100, 20]] },
  border: { name: 'Border', params: [['width', 'Width', 1, 80, 14]], color: ['color', 'Color', '#ffffff'] },
  invert: { name: 'Invert', params: [['amount', 'Amount', 0, 100, 100]] },
  scanlines: { name: 'Scan lines', params: [['amount', 'Darkness', 0, 100, 40], ['size', 'Line size', 1, 12, 3]] },
  shake: { name: 'Camera shake', params: [['amount', 'Amount', 0, 100, 30], ['speed', 'Speed', 1, 60, 18]] },
  pulse: { name: 'Zoom pulse', params: [['amount', 'Amount', 0, 50, 10], ['bpm', 'Beats per minute', 30, 240, 120]] },
  tiltshift: { name: 'Tilt-shift', pro: true, params: [['amount', 'Blur', 0, 40, 12], ['focus', 'Focus position', 0, 100, 50], ['band', 'Focus size', 5, 80, 30]] },
  vhs: { name: 'VHS', pro: true, params: [['amount', 'Strength', 0, 100, 60]] },
  duotone: { name: 'Duotone', pro: true, params: [], color: ['dark', 'Shadows', '#1b1464'], color2: ['light', 'Highlights', '#ff8fd8'] },
  posterize: { name: 'Posterize', pro: true, params: [['levels', 'Colors', 2, 12, 4]] },
  threshold: { name: 'Threshold', pro: true, params: [['level', 'Level', 1, 99, 50]] },
  emboss: { name: 'Emboss', pro: true, params: [['amount', 'Strength', 10, 300, 100]] },
  edges: { name: 'Neon edges', pro: true, params: [['amount', 'Strength', 10, 400, 150]], color: ['color', 'Glow color', '#7df9ff'] },
  sketch: { name: 'Pencil sketch', pro: true, params: [['amount', 'Strength', 10, 200, 60]] },
  halftone: { name: 'Halftone', pro: true, params: [['size', 'Dot size', 3, 40, 10]] },
  kaleido: { name: 'Kaleidoscope', pro: true, params: [['spin', 'Spin', -180, 180, 0]] },
  lightleak: { name: 'Light leak', pro: true, params: [['amount', 'Strength', 0, 100, 55], ['speed', 'Movement', 0, 100, 30]], color: ['color', 'Color', '#ff8a3d'] },
  dreamglow: { name: 'Dream glow', pro: true, params: [['amount', 'Strength', 0, 100, 50]] }
});
Object.assign(FX_SWATCH, {
  glow: 'brightness(1.25) blur(1px)', chroma: 'saturate(1.6) hue-rotate(15deg)', mirror: 'none', letterbox: 'contrast(1.1)', rounded: 'none', border: 'none',
  invert: 'invert(1)', scanlines: 'contrast(1.2)', shake: 'blur(1px)', pulse: 'saturate(1.2)', tiltshift: 'saturate(1.4) contrast(1.1)', vhs: 'saturate(1.5) hue-rotate(-10deg) blur(.5px)',
  duotone: 'grayscale(1) sepia(1) hue-rotate(230deg) saturate(3)', posterize: 'contrast(1.6) saturate(1.6)', threshold: 'grayscale(1) contrast(6)', emboss: 'grayscale(1) contrast(1.4)',
  edges: 'invert(1) hue-rotate(180deg) contrast(2)', sketch: 'grayscale(1) invert(1) contrast(1.5)', halftone: 'contrast(1.5) grayscale(.5)', kaleido: 'saturate(1.4)',
  lightleak: 'sepia(.4) brightness(1.2) saturate(1.4)', dreamglow: 'brightness(1.15) saturate(1.2) blur(.6px)'
});
const conv = (k) => `<feConvolveMatrix order="3" preserveAlpha="true" kernelMatrix="${k.join(' ')}"/>`;
// each one draws `src` (the clip so far) into `g` (a fresh canvas the same size)
Object.assign(FX_EXTRA, {
  glow(g, src, e, w, h, k) {
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'screen'; g.globalAlpha = e.amount / 100; g.filter = `blur(${(e.radius * k).toFixed(1)}px) brightness(1.2)`;
    g.drawImage(src, 0, 0);
  },
  dreamglow(g, src, e, w, h, k) {
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = (e.amount / 100) * 0.5; g.filter = `blur(${(18 * k).toFixed(1)}px) saturate(1.3)`;
    g.drawImage(src, 0, 0);
  },
  chroma(g, src, e, w, h, k) {
    const a = (e.angle * Math.PI) / 180, d = e.amount * k, dx = Math.cos(a) * d, dy = Math.sin(a) * d;
    const ch = (col, x, y) => {
      const T = poolCanvas(5, w, h), tg = T.getContext('2d');
      tg.drawImage(src, 0, 0); tg.globalCompositeOperation = 'multiply'; tg.fillStyle = col; tg.fillRect(0, 0, w, h);
      tg.globalCompositeOperation = 'destination-in'; tg.drawImage(src, 0, 0);
      g.drawImage(T, x, y);
    };
    g.globalCompositeOperation = 'lighter';
    ch('#ff0000', -dx, -dy); ch('#00ff00', 0, 0); ch('#0000ff', dx, dy);
  },
  mirror(g, src, e, w, h) {
    if (e.mode === 'v') { g.drawImage(src, 0, 0, w, h / 2, 0, 0, w, h / 2); g.save(); g.translate(0, h); g.scale(1, -1); g.drawImage(src, 0, 0, w, h / 2, 0, 0, w, h / 2); g.restore(); return; }
    g.drawImage(src, 0, 0, w / 2, h, 0, 0, w / 2, h); g.save(); g.translate(w, 0); g.scale(-1, 1); g.drawImage(src, 0, 0, w / 2, h, 0, 0, w / 2, h); g.restore();
    if (e.mode === 'quad') { const T = poolCanvas(5, w, h); T.getContext('2d').drawImage(g.canvas, 0, 0); g.clearRect(0, 0, w, h); g.drawImage(T, 0, 0, w, h / 2, 0, 0, w, h / 2); g.save(); g.translate(0, h); g.scale(1, -1); g.drawImage(T, 0, 0, w, h / 2, 0, 0, w, h / 2); g.restore(); }
  },
  letterbox(g, src, e, w, h) { g.drawImage(src, 0, 0); const b = (e.size / 100) * h; g.fillStyle = e.color || '#000'; g.fillRect(0, 0, w, b); g.fillRect(0, h - b, w, b); },
  rounded(g, src, e, w, h) { g.save(); roundRect(g, 0, 0, w, h, (e.radius / 100) * Math.min(w, h) / 2); g.clip(); g.drawImage(src, 0, 0); g.restore(); },
  border(g, src, e, w, h, k) { g.drawImage(src, 0, 0); const b = e.width * k; g.strokeStyle = e.color || '#fff'; g.lineWidth = b * 2; g.strokeRect(0, 0, w, h); },
  invert(g, src, e) { g.filter = `invert(${e.amount / 100})`; g.drawImage(src, 0, 0); },
  scanlines(g, src, e, w, h, k) { g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgba(0,0,0,${e.amount / 100 * 0.6})`; const s = Math.max(1, e.size * k); for (let y = 0; y < h; y += s * 2) g.fillRect(0, y, w, s); },
  shake(g, src, e, w, h, k, local) {
    const t = (local || 0) * e.speed, a = (e.amount / 100) * Math.min(w, h) * 0.04;
    const n = (i) => Math.sin(t * 1.7 + i) * 0.6 + Math.sin(t * 3.1 + i * 2) * 0.4;
    g.translate(w / 2 + n(1) * a, h / 2 + n(5) * a); g.rotate(n(9) * a * 0.0008); g.scale(1 + (e.amount / 100) * 0.08, 1 + (e.amount / 100) * 0.08); g.drawImage(src, -w / 2, -h / 2);
  },
  pulse(g, src, e, w, h, k, local) {
    const beat = ((local || 0) * e.bpm / 60) % 1, s = 1 + (e.amount / 100) * Math.pow(1 - beat, 3);
    g.translate(w / 2, h / 2); g.scale(s, s); g.drawImage(src, -w / 2, -h / 2);
  },
  tiltshift(g, src, e, w, h, k) {
    g.filter = `blur(${(e.amount * k).toFixed(1)}px) saturate(1.25)`; g.drawImage(src, 0, 0); g.filter = 'none';
    const M = poolCanvas(5, w, h), mg = M.getContext('2d');
    const c = (e.focus / 100) * h, b = (e.band / 100) * h / 2;
    const gr = mg.createLinearGradient(0, 0, 0, h);
    const st = (y) => clamp(y / h, 0, 1);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(st(c - b * 1.8), 'rgba(0,0,0,0)'); gr.addColorStop(st(c - b), '#000'); gr.addColorStop(st(c + b), '#000'); gr.addColorStop(st(c + b * 1.8), 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    mg.drawImage(src, 0, 0); mg.globalCompositeOperation = 'destination-in'; mg.fillStyle = gr; mg.fillRect(0, 0, w, h);
    g.drawImage(M, 0, 0);
  },
  vhs(g, src, e, w, h, k, local) {
    const a = e.amount / 100;
    g.filter = `saturate(${1 + a * 0.6}) contrast(${1 + a * 0.15}) blur(${(a * 1.2 * k).toFixed(2)}px)`; g.drawImage(src, 0, 0); g.filter = 'none';
    g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.35 * a; g.drawImage(src, 4 * k * a, 0);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-atop';
    g.fillStyle = `rgba(0,0,0,${0.18 * a})`; for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
    const band = ((local || 0) * 0.15 % 1) * h; g.fillStyle = `rgba(255,255,255,${0.08 * a})`; g.fillRect(0, band, w, h * 0.06);
    const jy = Math.floor(tHash(Math.floor((local || 0) * 8)) * h); g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, jy, w, 6 * k, 8 * k * a, jy, w, 6 * k);
  },
  duotone(g, src, e) {
    const [r1, g1, b1] = fxHexRgb(e.dark), [r2, g2, b2] = fxHexRgb(e.light);
    const id = 'fluxDuo' + (e.dark + e.light).replace(/#/g, '');
    g.filter = svgFilterUrl(id, `<feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="${r1} ${r2}"/><feFuncG type="table" tableValues="${g1} ${g2}"/><feFuncB type="table" tableValues="${b1} ${b2}"/></feComponentTransfer>`);
    g.drawImage(src, 0, 0);
  },
  posterize(g, src, e) {
    const n = Math.round(e.levels), vals = Array.from({ length: n }, (_, i) => (i / (n - 1)).toFixed(3)).join(' ');
    g.filter = svgFilterUrl('fluxPost' + n, `<feComponentTransfer><feFuncR type="discrete" tableValues="${vals}"/><feFuncG type="discrete" tableValues="${vals}"/><feFuncB type="discrete" tableValues="${vals}"/></feComponentTransfer>`);
    g.drawImage(src, 0, 0);
  },
  threshold(g, src, e) {
    const L = Math.round(e.level), n = 100, vals = Array.from({ length: n }, (_, i) => (i < L ? 0 : 1)).join(' ');
    g.filter = svgFilterUrl('fluxThr' + L, `<feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="discrete" tableValues="${vals}"/><feFuncG type="discrete" tableValues="${vals}"/><feFuncB type="discrete" tableValues="${vals}"/></feComponentTransfer>`);
    g.drawImage(src, 0, 0);
  },
  emboss(g, src, e) {
    const a = Math.round(e.amount) / 100;
    g.filter = svgFilterUrl('fluxEmb' + Math.round(e.amount), `<feColorMatrix type="saturate" values="0"/>${conv([-2 * a, -a, 0, -a, 1, a, 0, a, 2 * a])}`);
    g.drawImage(src, 0, 0);
  },
  edges(g, src, e) {
    const a = Math.round(e.amount) / 100, [r, gg, b] = fxHexRgb(e.color);
    g.fillStyle = '#000'; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.filter = svgFilterUrl('fluxEdg' + Math.round(e.amount) + (e.color || '').replace('#', ''), `<feColorMatrix type="saturate" values="0"/>${conv([-a, -a, -a, -a, 8 * a, -a, -a, -a, -a])}<feColorMatrix type="matrix" values="${r} 0 0 0 0  0 ${gg} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0"/>`);
    g.drawImage(src, 0, 0); g.filter = 'none';
    const T = poolCanvas(5, g.canvas.width, g.canvas.height); T.getContext('2d').drawImage(g.canvas, 0, 0);
    g.globalCompositeOperation = 'lighter'; g.filter = 'blur(4px)'; g.globalAlpha = 0.8; g.drawImage(T, 0, 0);
  },
  sketch(g, src, e) {
    const a = Math.round(e.amount) / 100;
    g.fillStyle = '#fff'; g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    g.filter = svgFilterUrl('fluxSk' + Math.round(e.amount), `<feColorMatrix type="saturate" values="0"/><feGaussianBlur stdDeviation="0.9"/>${conv([-a, -a, -a, -a, 8 * a, -a, -a, -a, -a])}<feComponentTransfer><feFuncR type="linear" slope="-1" intercept="1"/><feFuncG type="linear" slope="-1" intercept="1"/><feFuncB type="linear" slope="-1" intercept="1"/></feComponentTransfer>`);
    g.globalCompositeOperation = 'multiply'; g.drawImage(src, 0, 0);
  },
  halftone(g, src, e, w, h, k) {
    const s = Math.max(3, e.size * k), cols = Math.ceil(w / s), rows = Math.ceil(h / s);
    const T = poolCanvas(5, cols, rows), tg = T.getContext('2d'); tg.drawImage(src, 0, 0, cols, rows);
    let d; try { d = tg.getImageData(0, 0, cols, rows).data; } catch { g.drawImage(src, 0, 0); return; }
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4; if (d[i + 3] < 10) continue;
      const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255, r = (1 - lum) * s * 0.62;
      if (r < 0.3) continue;
      g.fillStyle = `rgb(${d[i] * 0.6 | 0},${d[i + 1] * 0.6 | 0},${d[i + 2] * 0.6 | 0})`;
      g.beginPath(); g.arc(x * s + s / 2, y * s + s / 2, r, 0, Math.PI * 2); g.fill();
    }
  },
  kaleido(g, src, e, w, h, k, local) {
    const T = poolCanvas(5, w, h), tg = T.getContext('2d');
    tg.translate(w / 2, h / 2); tg.rotate((e.spin * Math.PI / 180) * (local || 0)); tg.drawImage(src, -w / 2, -h / 2);
    const R = Math.hypot(w, h) / 2;
    for (let i = 0; i < 8; i++) {
      g.save(); g.translate(w / 2, h / 2);
      if (i % 2) { g.rotate(((i + 1) * Math.PI) / 4); g.scale(1, -1); } else g.rotate((i * Math.PI) / 4);
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -0.012, Math.PI / 4 + 0.012); g.closePath(); g.clip();
      g.drawImage(T, -w / 2, -h / 2); g.restore();
    }
  },
  lightleak(g, src, e, w, h, k, local) {
    g.drawImage(src, 0, 0);
    const t = (local || 0) * (e.speed / 100) * 0.6, x = (0.5 + Math.sin(t) * 0.5) * w, y = (0.3 + Math.cos(t * 0.7) * 0.3) * h;
    const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * 0.7);
    const [r, gg, b] = fxHexRgb(e.color).map((v) => Math.round(v * 255));
    gr.addColorStop(0, `rgba(${r},${gg},${b},${e.amount / 100})`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
});
