/* Flux 5.1 — a few more transitions and looks. */
'use strict';
/* ---------- transitions ---------- */
const T51 = [
  // [id, name, pro, demo animation]
  ['zoomPunch', 'Zoom punch', false, 'tZoom'],
  ['slideBounce', 'Slide bounce', false, 'tSlide'],
  ['squeeze', 'Squeeze', false, 'tFlip'],
  ['dreamFade', 'Dream fade', false, 'tBlur'],
  ['spinBlur', 'Spin blur', true, 'tSpin'],
  ['slamDown', 'Slam down', true, 'tSlideUp']
];
TRANSITIONS.push(...T51.map(([id, name, pro]) => (pro ? { id, name, pro: true } : { id, name })));
{
  const st = document.createElement('style');
  st.textContent = T51.map(([id, , , demo]) => `.t-${id} .b { animation-name: ${demo}; }`).join('\n');
  document.head.appendChild(st);
  const prevFx = transitionFx;
  const bounce = (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2);
  transitionFx = function (type, p, role, W, H) {
    if (!T51.some((t) => t[0] === type)) return prevFx.apply(this, arguments);
    const e = easeInOut(clamp(p, 0, 1)), q = clamp(p, 0, 1), isIn = role === 'in';
    const fx = { alpha: 1, dx: 0, dy: 0, scale: 1, rot: 0, blur: 0, clip: null, cover: null };
    const mid = 1 - Math.abs(2 * e - 1);
    switch (type) {
      case 'zoomPunch': // the old clip punches in, a quick flash, the new one settles back from a zoom
        if (isIn) { fx.alpha = q >= 0.5 ? 1 : 0; fx.scale = 1 + (1 - e) * 0.5; fx.blur = (1 - e) * 14; }
        else { fx.alpha = q < 0.5 ? 1 : 0; fx.scale = 1 + e * 0.6; fx.blur = e * 14; }
        fx.cover = { color: '#ffffff', alpha: Math.max(0, 1 - Math.abs(q - 0.5) * 6) * 0.85 };
        return fx;
      case 'slideBounce':
        if (isIn) fx.dx = (1 - bounce(q)) * W; else fx.dx = -e * W * 0.3;
        return fx;
      case 'squeeze':
        if (isIn) { fx.flipX = Math.max(0.02, q < 0.5 ? 0.02 : (q - 0.5) * 2); fx.alpha = q < 0.5 ? 0 : 1; }
        else { fx.flipX = Math.max(0.02, q < 0.5 ? 1 - q * 2 : 0.02); fx.alpha = q < 0.5 ? 1 : 0; }
        return fx;
      case 'dreamFade':
        if (isIn) fx.alpha = e;
        fx.blur = mid * 18; fx.scale = 1 + mid * 0.04;
        fx.cover = { color: '#ffe9f6', alpha: mid * 0.35 };
        return fx;
      case 'spinBlur':
        if (isIn) { fx.alpha = q >= 0.5 ? 1 : 0; fx.rot = -(1 - e) * Math.PI * 0.5; fx.scale = 1 + (1 - e) * 0.3; }
        else { fx.alpha = q < 0.5 ? 1 : 0; fx.rot = e * Math.PI * 0.5; fx.scale = 1 + e * 0.3; }
        fx.blur = mid * 22;
        return fx;
      case 'slamDown':
        if (isIn) { fx.dy = -(1 - Math.min(1, q * 1.25)) * H; fx.scale = 1 + Math.max(0, 1 - Math.abs(q - 0.8) * 8) * 0.06; }
        else fx.scale = 1 - e * 0.08;
        fx.cover = { color: '#000', alpha: q > 0.8 ? Math.max(0, 1 - (q - 0.8) * 5) * 0.25 : 0 };
        return fx;
    }
    return fx;
  };
}

/* ---------- looks (filters) ---------- */
FILTERS.push(
  { id: 'y2k', name: 'Y2K', css: 'saturate(1.4) contrast(1.05) brightness(1.08)', tint: 'rgba(120,180,255,0.22)' },
  { id: 'vapor', name: 'Vaporwave', css: 'saturate(1.5) contrast(1.05) hue-rotate(-20deg)', tint: 'rgba(255,90,220,0.3)' },
  { id: 'peach', name: 'Peach', css: 'saturate(1.1) brightness(1.08) contrast(0.95)', tint: 'rgba(255,170,140,0.28)' },
  { id: 'nightcity', name: 'Night city', css: 'saturate(1.3) contrast(1.25) brightness(0.85)', tint: 'rgba(0,120,255,0.3)' },
  { id: 'moodygreen', name: 'Moody green', css: 'saturate(0.8) contrast(1.2) brightness(0.9)', tint: 'rgba(40,110,70,0.32)' },
  { id: 'hollywood', name: 'Blockbuster', css: 'contrast(1.25) saturate(1.15) brightness(0.95)', tint: 'rgba(0,140,160,0.2)' },
  { id: 'cleanbright', name: 'Clean & bright', css: 'brightness(1.12) contrast(1.05) saturate(1.1)' },
  { id: 'velvet', name: 'Velvet', css: 'saturate(1.2) contrast(1.05) brightness(0.98)', tint: 'rgba(150,60,200,0.25)' },
  { id: 'goldfilm', name: 'Gold film', css: 'sepia(0.3) saturate(1.3) contrast(1.1)', tint: 'rgba(255,190,60,0.25)' },
  { id: 'bleak', name: 'Bleak', css: 'saturate(0.35) contrast(1.25) brightness(0.92)', tint: 'rgba(90,110,130,0.2)' }
);
if (typeof renderFilterGrid === 'function') { try { renderFilterGrid(); } catch {} }
if (typeof renderTransitionGrid === 'function') { try { renderTransitionGrid(); } catch {} }
