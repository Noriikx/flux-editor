/* Flux 7.0 — reverse, close gaps (once), balance audio, media usage, favorite effects, blur / pixelate an area,
   more effects, filters, caption styles and audio effects, and project templates. */
'use strict';

/* ============================ REVERSE ============================ */
ENH.reverse = { title: 'Reverse', icon: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-4"/>', desc: 'Plays the clip backwards.', levels: [] };
TOOL_ICONS.reverse = ENH.reverse.icon;
async function reverseClip(c = getClip(state.selectedId)) {
  if (!c || !(c.kind === 'video' || c.kind === 'audio')) return toast('Select a video or sound clip to reverse');
  const snd = c.kind === 'video' ? soundClipOf(c) : null;
  // reversing a reversed clip simply brings the original back
  if (c.revOf) {
    commit(() => { for (const x of [c, snd].filter(Boolean)) if (x.revOf) { Object.assign(x, x.revOf); delete x.revOf; } });
    return toast('Playing forwards again');
  }
  if (!api || !api.enhRun) return toast('Reverse works in the Flux desktop app');
  if (enhBusy) return toast('Flux is still working on something - wait for it to finish');
  const id = 'r' + Date.now();
  enhBusy = { id, kind: 'reverse', clipId: c.id };
  enhShow('reverse', 'Reversing', 0);
  $('.enh-x', enhCard()).onclick = () => { if (enhBusy) { enhBusy.cancelled = true; api.enhCancel(enhBusy.id); } };
  try {
    const jobs = [[c, c.kind === 'video' ? 'reverse' : 'reverse-audio']];
    if (snd && !snd.revOf) jobs.push([snd, 'reverse-audio']);
    const done = [];
    for (const [clip, kind] of jobs) {
      const m = getMedia(clip.mediaId);
      if (!m || !m.path) throw new Error('The file for this clip is missing');
      enhBusy.id = id + kind;
      const r = await api.enhRun({ id: enhBusy.id, kind, file: m.path, start: clip.in, len: clip.out - clip.in });
      if (r.error) throw new Error(r.error);
      if (enhBusy.cancelled) throw new Error('cancelled');
      const [nm] = await importFiles([{ path: r.path, name: m.name.replace(/\.[^.]+$/, '') + ' (reversed)' + (r.path.match(/\.[^.]+$/) || [''])[0] }]);
      if (!nm) throw new Error('Flux couldn’t open the result');
      done.push([clip, nm, r.len]);
    }
    commit(() => {
      for (const [clip, nm, len] of done) {
        const x = getClip(clip.id); if (!x) continue;
        x.revOf = { mediaId: x.mediaId, in: x.in, out: x.out };
        x.mediaId = nm.id; x.in = 0; x.out = Math.min(nm.duration || len, len);
      }
    });
    for (const [, nm] of done) if (nm.kind === 'audio' && !rt.peaks.has(nm.id)) loadPeaks(nm);
    toast('Reversed - click Reverse again to play it forwards');
  } catch (e) {
    const msg = String(e && e.message || e);
    toast(msg === 'cancelled' ? 'Reverse cancelled' : 'Reverse failed: ' + msg, { error: msg !== 'cancelled' });
  } finally { enhBusy = null; enhHide(); }
}

/* ============================ CLOSE GAPS (once) ============================ */
// Removes the empty spots where nothing plays on any track - so captions, music and video all stay in sync.
function closeGapsNow() {
  const clips = P.clips;
  if (!clips.length) return toast('The timeline is empty');
  const iv = clips.map((c) => [c.start, endOf(c)]).sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let cur = 0;
  for (const [s, e] of iv) { if (s > cur + 0.04) gaps.push([cur, s]); cur = Math.max(cur, e); }
  if (!gaps.length) return toast('No gaps to close');
  const total = gaps.reduce((a, g) => a + g[1] - g[0], 0);
  commit(() => {
    for (const c of P.clips) {
      let shift = 0;
      for (const [a, b] of gaps) if (c.start >= b - 1e-6) shift += b - a;
      c.start = Math.max(0, c.start - shift);
    }
    for (const m of P.markers || []) { let shift = 0; for (const [a, b] of gaps) if (m.t >= b - 1e-6) shift += b - a; m.t = Math.max(0, m.t - shift); }
  });
  toast(`Closed ${gaps.length} gap${gaps.length > 1 ? 's' : ''} (${total.toFixed(1)}s)`);
}

/* ============================ BALANCE AUDIO ============================ */
// How loud someone is while they talk (pauses don't count), so a quiet speaker with pauses isn't over-boosted
loudness = function (c) {
  const pk = rt.peaksAbs.get(c.mediaId), m = getMedia(c.mediaId);
  if (!pk || !m || !m.duration) return null;
  const a = Math.floor((c.in / m.duration) * pk.length), b = Math.min(pk.length, Math.max(a + 1, Math.ceil((c.out / m.duration) * pk.length)));
  let max = 0; for (let i = a; i < b; i++) if (pk[i] > max) max = pk[i];
  if (max <= 0.0005) return null;
  const th = max * 0.18, act = [];
  for (let i = a; i < b; i++) if (pk[i] >= th) act.push(pk[i]);
  if (!act.length) return null;
  act.sort((x, y) => x - y);
  return act[Math.floor(act.length * 0.6)]; // a level most of the speech reaches
};
async function balanceAudioNow() {
  const list = soundClips();
  if (!list.length) return toast('There are no sound clips to balance');
  const need = [...new Set(list.map((c) => c.mediaId))].map(getMedia).filter((m) => m && !rt.peaksAbs.has(m.id) && !m.missing);
  if (need.length) {
    toast('Listening to the sound…');
    for (const m of need) loadPeaks(m);
    for (let i = 0; i < 80 && need.some((m) => !rt.peaksAbs.has(m.id)); i++) await new Promise((r) => setTimeout(r, 250));
  }
  const voices = list.filter((c) => clipRole(c) !== 'music');
  const levels = voices.map(loudness).filter((x) => x != null);
  if (!levels.length) return toast('Flux couldn’t hear any sound to balance', { error: true });
  // everyone ends up at the same talking level; music sits quietly underneath
  const target = Math.min(0.5, Math.max(0.08, levels.sort((x, y) => x - y)[Math.floor((levels.length - 1) / 2)]));
  let n = 0;
  commit(() => {
    for (const c of list) {
      const L = loudness(c); if (L == null) continue;
      const music = clipRole(c) === 'music';
      c.volume = clamp((music ? target * 0.32 : target) / Math.max(L, 0.002), 0.1, 6);
      if (c.keys && c.keys.volume) delete c.keys.volume;
      n++;
    }
  });
  toast(n ? `Balanced ${n} clip${n > 1 ? 's' : ''} - everyone is about equally loud now` : 'Nothing to balance');
}

/* ============================ TOOLBAR + CLIP TOOLS ============================ */
(function setupV7Toolbar() {
  const ripple = $('#btnRipple');
  if (!ripple || $('#btnCloseGaps')) return;
  const gaps = el('button', 'tool-btn', '<svg viewBox="0 0 24 24"><path d="M3 12h5M16 12h5"/><path d="m8 9 3 3-3 3M16 9l-3 3 3 3"/></svg>Close gaps');
  gaps.id = 'btnCloseGaps'; gaps.dataset.tip = 'Remove every empty space on the timeline now (once)';
  gaps.onclick = closeGapsNow;
  const bal = el('button', 'tool-btn', '<svg viewBox="0 0 24 24"><path d="M12 3v18M5 7h14"/><path d="m5 7-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/></svg>Balance audio');
  bal.id = 'btnBalance'; bal.dataset.tip = 'Make every voice about equally loud (a loud mic and a quiet one end up the same)';
  bal.onclick = balanceAudioNow;
  ripple.after(gaps, bal);
  ripple.childNodes.forEach((n) => { if (n.nodeType === 3 && /Auto-close gaps/.test(n.textContent)) n.textContent = 'Auto-close'; });
  const baseTools = clipTools;
  clipTools = function (c) {
    const list = baseTools(c);
    list.push({ id: 'reverse', g: 'edit', label: c && c.revOf ? 'Forward' : 'Reverse', tip: c && c.revOf ? 'Play forwards again' : 'Play this clip backwards', on: c && (c.kind === 'video' || c.kind === 'audio'), fn: () => reverseClip(c) });
    return list;
  };
})();

/* ============================ MEDIA USAGE ============================ */
function mediaUseCount() {
  const n = new Map();
  // a video's own sound clip doesn't count as a second use
  const walk = (clips) => { for (const c of clips || []) { const m = c.mediaId && getMedia(c.mediaId); if (m && !(c.kind === 'audio' && m.kind === 'video')) n.set(c.mediaId, (n.get(c.mediaId) || 0) + 1); if (c.sub) walk(c.sub.clips); } };
  walk(P && P.clips);
  return n;
}
function updateUsageBadges() {
  const grid = $('#mediaGrid');
  if (!grid || !P) return;
  const n = mediaUseCount();
  for (const it of grid.querySelectorAll('.media-item[data-id]')) {
    if (it.classList.contains('folder')) continue;
    const k = n.get(it.dataset.id) || 0;
    let b = it.querySelector('.mu-badge');
    if (!b) { b = el('span', 'mu-badge'); it.appendChild(b); }
    b.className = 'mu-badge' + (k ? ' used' : '');
    b.innerHTML = k ? `<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>${k > 1 ? '×' + k : ''}` : '';
    b.dataset.tip = k ? `Used ${k} time${k > 1 ? 's' : ''} on the timeline` : 'Not used on the timeline yet';
  }
}
{
  const baseMedia = renderMedia;
  renderMedia = function () { const r = baseMedia.apply(this, arguments); updateUsageBadges(); return r; };
  const baseLanes = renderLanes;
  renderLanes = function () { const r = baseLanes.apply(this, arguments); if (!rt.zoomLive) updateUsageBadges(); return r; };
}

/* ============================ FAVORITE EFFECTS ============================ */
// Click the ☆ on any filter, effect or audio effect: it's pinned in "Favorites" at the top.
if (!Array.isArray(settings.favs)) settings.favs = [];
function isFav(k) { return settings.favs.includes(k); }
function toggleFav(k) {
  settings.favs = isFav(k) ? settings.favs.filter((x) => x !== k) : [...settings.favs, k];
  saveSettings();
}
function decorateFavs(root, rerender) {
  if (!root) return;
  const chips = [...root.querySelectorAll('[data-fav]')];
  for (const b of chips) {
    if (b.querySelector('.fav-star')) continue;
    const s = el('span', 'fav-star' + (isFav(b.dataset.fav) ? ' on' : ''), '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>');
    s.dataset.tip = isFav(b.dataset.fav) ? 'Remove from favorites' : 'Add to favorites';
    s.onclick = (e) => { e.stopPropagation(); e.preventDefault(); toggleFav(b.dataset.fav); rerender(); };
    s.onpointerdown = (e) => e.stopPropagation();
    b.appendChild(s);
  }
  const favChips = chips.filter((b) => isFav(b.dataset.fav) && !b.closest('.fav-box'));
  let box = root.querySelector(':scope > .fav-box');
  if (box) box.remove();
  if (!favChips.length) return;
  box = el('div', 'fav-box');
  box.innerHTML = '<div class="fav-title"><svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>Favorites</div><div class="fav-grid"></div>';
  const grid = $('.fav-grid', box);
  for (const b of favChips) {
    const cl = b.cloneNode(true);
    cl.classList.add('fav-copy');
    cl.draggable = false;
    cl.onclick = (e) => { if (e.target.closest('.fav-star')) { toggleFav(b.dataset.fav); rerender(); return; } b.click(); };
    grid.appendChild(cl);
  }
  root.prepend(box);
}
{
  const baseF = renderFilterGrid;
  renderFilterGrid = function () { const r = baseF.apply(this, arguments); decorateFavs($('#filterGrid'), renderFilterGrid); return r; };
  const baseA = renderAfxTab;
  renderAfxTab = function () { const r = baseA.apply(this, arguments); decorateFavs(document.querySelector('[data-page=afx]'), renderAfxTab); return r; };
  if (typeof renderFxGrid === 'function') {
    const baseX = renderFxGrid;
    renderFxGrid = function () { const r = baseX.apply(this, arguments); decorateFavs($('#fxGrid'), renderFxGrid); return r; };
  }
}

/* ============================ NEW VIDEO EFFECTS ============================ */
Object.assign(EFFECT_TYPES, {
  blurArea: { name: 'Blur an area', params: [['x', 'Position X', 0, 100, 50], ['y', 'Position Y', 0, 100, 50], ['w', 'Width', 2, 100, 30], ['h', 'Height', 2, 100, 30], ['amount', 'Blur', 1, 80, 24], ['feather', 'Soft edge', 0, 50, 8]], choice: ['shape', 'Shape', [['rect', 'Rectangle'], ['ellipse', 'Oval']], 'ellipse'] },
  pixelArea: { name: 'Pixelate an area', params: [['x', 'Position X', 0, 100, 50], ['y', 'Position Y', 0, 100, 50], ['w', 'Width', 2, 100, 30], ['h', 'Height', 2, 100, 30], ['size', 'Pixel size', 4, 120, 24]], choice: ['shape', 'Shape', [['rect', 'Rectangle'], ['ellipse', 'Oval']], 'rect'] },
  pixelate: { name: 'Pixelate (whole clip)', params: [['size', 'Pixel size', 2, 80, 12]] },
  thermal: { name: 'Thermal camera', params: [['amount', 'Strength', 0, 100, 100]] },
  nightvision: { name: 'Night vision', params: [['amount', 'Strength', 0, 100, 100], ['noise', 'Noise', 0, 100, 40]] },
  colorpop: { name: 'Color pop (keep one color)', params: [['hue', 'Color to keep', 0, 360, 0], ['range', 'How much', 5, 90, 30]] },
  ripple: { name: 'Water ripple', params: [['amount', 'Strength', 0, 60, 14], ['size', 'Wave size', 5, 120, 40], ['speed', 'Speed', 0, 10, 3]] },
  spotlight: { name: 'Spotlight', params: [['x', 'Position X', 0, 100, 50], ['y', 'Position Y', 0, 100, 45], ['size', 'Size', 5, 100, 35], ['dark', 'Darkness', 0, 100, 75]] },
  speedlines: { name: 'Anime speed lines', params: [['amount', 'Amount', 0, 100, 60], ['hole', 'Clear center', 0, 90, 45]], color: ['color', 'Line color', '#ffffff'] },
  rain: { name: 'Rain', params: [['amount', 'Amount', 0, 100, 50], ['angle', 'Wind', -40, 40, 10], ['speed', 'Speed', 1, 10, 6]] }
});
function areaPath(g, e, w, h) {
  const rw = (e.w / 100) * w, rh = (e.h / 100) * h, cx = (e.x / 100) * w, cy = (e.y / 100) * h;
  g.beginPath();
  if (e.shape === 'ellipse') g.ellipse(cx, cy, rw / 2, rh / 2, 0, 0, Math.PI * 2);
  else g.rect(cx - rw / 2, cy - rh / 2, rw, rh);
}
function seeded(n) { let s = n * 9301 + 49297; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }
Object.assign(FX_EXTRA, {
  blurArea(g, src, e, w, h, k) {
    g.drawImage(src, 0, 0);
    const T = poolCanvas(7, w, h), t = T.getContext('2d');
    t.filter = `blur(${(e.amount * k).toFixed(1)}px)`; t.drawImage(src, 0, 0); t.filter = 'none';
    g.save();
    if (e.feather > 0) g.filter = `blur(${(e.feather * k).toFixed(1)}px)`;
    // soft edges: draw the blurred copy through a feathered mask
    const M = poolCanvas(8, w, h), mg = M.getContext('2d');
    mg.clearRect(0, 0, w, h); mg.filter = e.feather > 0 ? `blur(${(e.feather * k).toFixed(1)}px)` : 'none';
    mg.fillStyle = '#fff'; areaPath(mg, e, w, h); mg.fill(); mg.filter = 'none';
    mg.globalCompositeOperation = 'source-in'; mg.drawImage(T, 0, 0); mg.globalCompositeOperation = 'source-over';
    g.filter = 'none'; g.drawImage(M, 0, 0);
    g.restore();
  },
  pixelArea(g, src, e, w, h, k) {
    g.drawImage(src, 0, 0);
    const s = Math.max(2, e.size * k), tw = Math.max(1, Math.round(w / s)), th = Math.max(1, Math.round(h / s));
    const T = poolCanvas(7, tw, th); T.getContext('2d').drawImage(src, 0, 0, tw, th);
    g.save(); areaPath(g, e, w, h); g.clip();
    g.imageSmoothingEnabled = false; g.drawImage(T, 0, 0, tw, th, 0, 0, w, h);
    g.restore();
  },
  pixelate(g, src, e, w, h, k) {
    const s = Math.max(2, e.size * k), tw = Math.max(1, Math.round(w / s)), th = Math.max(1, Math.round(h / s));
    const T = poolCanvas(7, tw, th); T.getContext('2d').drawImage(src, 0, 0, tw, th);
    g.imageSmoothingEnabled = false; g.drawImage(T, 0, 0, tw, th, 0, 0, w, h);
  },
  thermal(g, src, e, w, h) {
    g.drawImage(src, 0, 0);
    const d = g.getImageData(0, 0, w, h), p = d.data, a = e.amount / 100;
    for (let i = 0; i < p.length; i += 4) {
      const l = (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11) / 255;
      // dark blue → purple → red → orange → yellow → white
      const r = Math.min(255, 255 * Math.min(1, l * 2.2)), gg = Math.min(255, 255 * Math.max(0, (l - 0.45) * 2.2)), b = 255 * Math.max(0, Math.min(1, l < 0.35 ? 0.4 + l : (0.6 - l) * 2 + (l > 0.85 ? (l - 0.85) * 6 : 0)));
      p[i] = p[i] + (r - p[i]) * a; p[i + 1] = p[i + 1] + (gg - p[i + 1]) * a; p[i + 2] = p[i + 2] + (b - p[i + 2]) * a;
    }
    g.putImageData(d, 0, 0);
  },
  nightvision(g, src, e, w, h, k, local) {
    g.filter = `grayscale(1) brightness(${1 + e.amount / 120}) contrast(1.25)`; g.drawImage(src, 0, 0); g.filter = 'none';
    g.globalCompositeOperation = 'multiply'; g.fillStyle = `rgba(60,255,90,${0.85 * e.amount / 100})`; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
    const rnd = seeded(Math.floor((local || 0) * 24) + 1), n = Math.round((w * h) / 900 * e.noise / 100);
    g.fillStyle = 'rgba(200,255,200,.22)'; for (let i = 0; i < n; i++) g.fillRect(rnd() * w, rnd() * h, 1.5 * k + 0.5, 1.5 * k + 0.5);
    const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.85)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  },
  colorpop(g, src, e, w, h) {
    g.drawImage(src, 0, 0);
    const d = g.getImageData(0, 0, w, h), p = d.data, H = e.hue, R = e.range;
    for (let i = 0; i < p.length; i += 4) {
      const r = p[i] / 255, gg = p[i + 1] / 255, b = p[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), c = mx - mn;
      let hue = 0;
      if (c > 0.0001) hue = mx === r ? 60 * (((gg - b) / c) % 6) : mx === gg ? 60 * ((b - r) / c + 2) : 60 * ((r - gg) / c + 4);
      if (hue < 0) hue += 360;
      const dist = Math.min(Math.abs(hue - H), 360 - Math.abs(hue - H));
      const keep = c < 0.12 ? 0 : Math.max(0, Math.min(1, (R - dist) / (R * 0.35)));
      const l = p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11;
      p[i] = l + (p[i] - l) * keep; p[i + 1] = l + (p[i + 1] - l) * keep; p[i + 2] = l + (p[i + 2] - l) * keep;
    }
    g.putImageData(d, 0, 0);
  },
  ripple(g, src, e, w, h, k, local) {
    const amp = e.amount * k, len = Math.max(4, e.size * k), ph = (local || 0) * e.speed * 2;
    const strip = Math.max(2, Math.round(3 * k));
    for (let y = 0; y < h; y += strip) {
      const dx = Math.sin(y / len + ph) * amp;
      g.drawImage(src, 0, y, w, strip, dx, y, w, strip);
    }
  },
  spotlight(g, src, e, w, h) {
    g.drawImage(src, 0, 0);
    const cx = (e.x / 100) * w, cy = (e.y / 100) * h, r = (e.size / 100) * Math.max(w, h) * 0.6;
    const gr = g.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${e.dark / 100})`);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  },
  speedlines(g, src, e, w, h, k, local) {
    g.drawImage(src, 0, 0);
    const rnd = seeded(Math.floor((local || 0) * 12) + 7), n = Math.round(30 + e.amount * 1.6), cx = w / 2, cy = h / 2, R = Math.hypot(w, h) / 2, hole = (e.hole / 100) * R;
    g.fillStyle = e.color || '#fff'; g.globalAlpha = 0.85;
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, wd = (0.004 + rnd() * 0.012), r0 = hole + rnd() * (R - hole) * 0.35;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 1.1, cy + Math.sin(a) * R * 1.1);
      g.lineTo(cx + Math.cos(a - wd) * r0, cy + Math.sin(a - wd) * r0); g.lineTo(cx + Math.cos(a + wd) * r0, cy + Math.sin(a + wd) * r0); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
  },
  rain(g, src, e, w, h, k, local) {
    g.drawImage(src, 0, 0);
    g.fillStyle = 'rgba(10,20,40,.18)'; g.fillRect(0, 0, w, h);
    const rnd = seeded(5), n = Math.round(e.amount * 6), t = (local || 0) * e.speed * 0.6, ang = (e.angle * Math.PI) / 180;
    g.strokeStyle = 'rgba(210,225,255,.45)'; g.lineWidth = Math.max(1, 1.2 * k);
    g.beginPath();
    for (let i = 0; i < n; i++) {
      const x0 = rnd() * w * 1.4 - w * 0.2, sp = 0.6 + rnd() * 0.8, L = (12 + rnd() * 22) * k;
      const y = (((rnd() + t * sp) % 1) * (h + L)) - L, x = x0 + Math.tan(ang) * y;
      g.moveTo(x, y); g.lineTo(x + Math.sin(ang) * L, y + Math.cos(ang) * L);
    }
    g.stroke();
  }
});
if (typeof FX_SWATCH !== 'undefined') Object.assign(FX_SWATCH, { blurArea: 'blur(1px)', pixelArea: 'contrast(1.1)', pixelate: 'contrast(1.15)', thermal: 'hue-rotate(200deg) saturate(3) contrast(1.4)', nightvision: 'grayscale(1) sepia(1) hue-rotate(70deg) saturate(3)', colorpop: 'grayscale(.85)', ripple: 'blur(.5px)', spotlight: 'brightness(.7) contrast(1.2)', speedlines: 'contrast(1.3)', rain: 'brightness(.8) saturate(.7)' });

/* ============================ NEW FILTERS ============================ */
FILTERS.push(
  { id: 'tealorange', name: 'Teal & orange', css: 'saturate(1.3) contrast(1.12)', tint: 'rgba(0,150,170,0.28)' },
  { id: 'goldenhour', name: 'Golden hour', css: 'saturate(1.25) brightness(1.06) contrast(1.04)', tint: 'rgba(255,175,60,0.4)' },
  { id: 'moonlight', name: 'Moonlight', css: 'saturate(0.6) brightness(0.9) contrast(1.15)', tint: 'rgba(70,110,255,0.35)' },
  { id: 'matte', name: 'Matte', css: 'contrast(0.82) brightness(1.08) saturate(0.85)' },
  { id: 'film400', name: 'Film 400', css: 'saturate(1.1) contrast(1.06) sepia(0.12)', tint: 'rgba(255,220,180,0.18)' },
  { id: 'arctic', name: 'Arctic', css: 'saturate(0.75) brightness(1.12) contrast(1.05)', tint: 'rgba(150,220,255,0.35)' },
  { id: 'rosewood', name: 'Rosewood', css: 'saturate(1.1) contrast(1.05)', tint: 'rgba(200,60,90,0.3)' },
  { id: 'cyber', name: 'Cyber', css: 'saturate(1.6) contrast(1.2) hue-rotate(-12deg)', tint: 'rgba(170,40,255,0.32)' },
  { id: 'evergreen', name: 'Evergreen', css: 'saturate(1.2) contrast(1.06)', tint: 'rgba(40,160,80,0.28)' },
  { id: 'bleach', name: 'Bleach bypass', css: 'saturate(0.45) contrast(1.45) brightness(1.04)' }
);

/* ============================ NEW CAPTION STYLES ============================ */
CAPTION_STYLES.push(
  { id: 'outline', name: 'Outline', t: { font: 'Segoe UI', size: 72, bold: true, color: '#ffffff', outline: true, outlineColor: '#000000', shadow: false, bg: false, anim: 'none' } },
  { id: 'subtitle', name: 'Subtitle', t: { font: 'Segoe UI', size: 50, bold: false, color: '#ffffff', shadow: true, outline: false, bg: true, bgColor: '#000000', bgOpacity: 0.45, anim: 'fade' } },
  { id: 'redbox', name: 'Red box', t: { font: 'Arial Black', size: 62, bold: false, color: '#ffffff', bg: true, bgColor: '#e0263c', bgOpacity: 1, shadow: false, outline: false, anim: 'pop' } },
  { id: 'retro', name: 'Retro 80s', t: { font: 'Trebuchet MS', size: 76, bold: true, color: '#ff4fd8', glow: true, outline: true, outlineColor: '#2b0a55', shadow: false, bg: false, anim: 'pop' } },
  { id: 'marker', name: 'Marker', t: { font: 'Comic Sans MS', size: 70, bold: true, color: '#111111', bg: true, bgColor: '#ffe94a', bgOpacity: 1, shadow: false, outline: false, anim: 'pop' } },
  { id: 'mint', name: 'Mint', t: { font: 'Verdana', size: 64, bold: true, color: '#7dffcf', outline: true, outlineColor: '#003b2a', shadow: true, bg: false, anim: 'none' } },
  { id: 'elegant', name: 'Elegant', t: { font: 'Georgia', size: 64, bold: false, italic: true, color: '#fff7e6', shadow: true, outline: false, bg: false, anim: 'fade' } },
  { id: 'bigpop', name: 'Big pop', t: { font: 'Impact', size: 104, bold: false, color: '#ffffff', outline: true, outlineColor: '#000000', shadow: true, bg: false, anim: 'pop' } }
);

/* ============================ NEW AUDIO EFFECTS ============================ */
Object.assign(AFX_TYPES, {
  cave: { name: 'Cave', group: 'Space', params: [['size', 'Size', 0, 100, 70, pct], ['mix', 'Mix', 0, 100, 45, pct]] },
  cathedral: { name: 'Cathedral', group: 'Space', params: [['size', 'Size', 0, 100, 85, pct], ['mix', 'Mix', 0, 100, 40, pct]] },
  slapback: { name: 'Slapback echo', group: 'Space', params: [['time', 'Time', 40, 250, 110, (v) => Math.round(v) + 'ms'], ['mix', 'Mix', 0, 100, 40, pct]] },
  intercom: { name: 'Intercom / PA', group: 'Tone', params: [['amount', 'Amount', 0, 100, 80, pct]] },
  oldtv: { name: 'Old TV', group: 'Tone', params: [['amount', 'Amount', 0, 100, 80, pct], ['hum', 'Hum', 0, 100, 30, pct]] },
  subbass: { name: 'Sub bass (808)', group: 'Tone', params: [['amount', 'Boost', 0, 18, 9, dbf]] },
  warmth: { name: 'Warm & cozy', group: 'Clean up', params: [['amount', 'Amount', 0, 100, 60, pct]] },
  chopper: { name: 'Helicopter chop', group: 'Movement', params: [['rate', 'Speed', 2, 30, 12, (v) => (+v).toFixed(0) + 'Hz'], ['depth', 'Depth', 0, 100, 90, pct]] },
  seasick: { name: 'Seasick / drunk', group: 'Movement', params: [['amount', 'Amount', 0, 100, 60, pct], ['rate', 'Speed', 0.1, 3, 0.6, (v) => (+v).toFixed(1) + 'Hz']] },
  tinyspeaker: { name: 'Tiny speaker', group: 'Loud & broken', params: [['amount', 'Amount', 0, 100, 85, pct]] }
});
const AFX7 = ['cave', 'cathedral', 'slapback', 'intercom', 'oldtv', 'subbass', 'warmth', 'chopper', 'seasick', 'tinyspeaker'];
Object.assign(AFX_SVG, {
  cave: '<path d="M3 20 8 8l4 5 3-4 6 11z"/><path d="M10 20c0-2 1-3 2-3s2 1 2 3"/>',
  cathedral: '<path d="M12 2v4M10 4h4M6 21V11l6-5 6 5v10"/><path d="M10 21v-5a2 2 0 0 1 4 0v5"/>',
  slapback: '<path d="M4 12h4M10 9v6M14 10v4M18 11v2"/>',
  intercom: '<rect x="6" y="3" width="12" height="18" rx="2"/><circle cx="12" cy="9" r="3"/><path d="M9 16h6"/>',
  oldtv: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="m8 3 4 4 4-4"/>',
  subbass: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
  warmth: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-3-10-2 2-4 3-5 6-1-1-1-2-1-3-2 2-3 4-3 7a6 6 0 0 0 6 6z"/>',
  chopper: '<path d="M3 6h18M12 6v4"/><path d="M6 14a6 4 0 0 0 12 0 6 4 0 0 0-12 0zM18 14h3"/>',
  seasick: '<path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 18c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/>',
  tinyspeaker: '<rect x="8" y="5" width="8" height="14" rx="2"/><circle cx="12" cy="14" r="2"/><path d="M12 8h.01"/>'
});
function roomIR(A, secs, dark, seed) {
  const n = Math.max(1, Math.floor(A.sampleRate * secs)), buf = A.createBuffer(2, n, A.sampleRate), rnd = seeded(seed);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = 0; i < n; i++) { const x = rnd() * 2 - 1; lp = lp + (x - lp) * (1 - dark); d[i] = lp * Math.pow(1 - i / n, 2.6); }
  }
  return buf;
}
{
  const base7 = makeUnit;
  makeUnit = function (e, A = actx, workletOk = afxWorkletReady === true, instant = false) {
    if (!AFX7.includes(e.type)) return base7(e, A, workletOk, instant);
    const nodes = [], mk = (n) => (nodes.push(n), n);
    const G = (v = 1) => { const g = mk(A.createGain()); g.gain.value = v; return g; };
    const biq = (type, f, q, gain) => { const b = mk(A.createBiquadFilter()); b.type = type; b.frequency.value = f; if (q != null) b.Q.value = q; if (gain != null) b.gain.value = gain; return b; };
    const set = (param, v) => { if (instant) { param.value = v; return; } if (Math.abs(param.value - v) > 1e-4) param.setTargetAtTime(v, A.currentTime, 0.02); };
    const inp = G(), out = G(), dry = G(), wet = G();
    const unit = (update) => ({ in: inp, out, nodes, update });
    const dryWet = () => { inp.connect(dry); dry.connect(out); wet.connect(out); };
    switch (e.type) {
      case 'cave': case 'cathedral': {
        const conv = mk(A.createConvolver()), cave = e.type === 'cave', tone = biq(cave ? 'lowpass' : 'highshelf', cave ? 1800 : 6000, 0.7, cave ? null : 3);
        let size = -1;
        dryWet(); inp.connect(conv); conv.connect(tone); tone.connect(wet);
        return unit((x) => {
          if (Math.round(x.size) !== size) { size = Math.round(x.size); conv.buffer = roomIR(A, (cave ? 1.2 : 2.5) + (size / 100) * (cave ? 2.5 : 4.5), cave ? 0.75 : 0.25, cave ? 11 : 23); }
          set(wet.gain, (x.mix / 100) * (cave ? 1.1 : 0.9)); set(dry.gain, 1 - (x.mix / 100) * 0.5);
        });
      }
      case 'slapback': {
        const d = mk(A.createDelay(0.5)), lp = biq('lowpass', 4500, 0.7);
        dryWet(); inp.connect(d); d.connect(lp); lp.connect(wet);
        return unit((x) => { set(d.delayTime, x.time / 1000); set(wet.gain, x.mix / 100); });
      }
      case 'intercom': {
        const hp = biq('highpass', 450, 0.9), lp = biq('lowpass', 3400, 1.2), pk = biq('peaking', 1800, 1.4, 8), sh = mk(A.createWaveShaper()), d = mk(A.createDelay(0.2)), echo = G(0.25), lvl = G(0.8);
        sh.curve = softClipCurve(12); sh.oversample = '2x'; d.delayTime.value = 0.07;
        dryWet(); inp.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(sh); sh.connect(lvl); lvl.connect(wet); sh.connect(d); d.connect(echo); echo.connect(wet);
        return unit((x) => { set(wet.gain, x.amount / 100); set(dry.gain, 1 - x.amount / 100); });
      }
      case 'oldtv': {
        const hp = biq('highpass', 300, 0.8), lp = biq('lowpass', 4200, 1), sh = mk(A.createWaveShaper()), hum = mk(A.createOscillator()), hg = G(0);
        sh.curve = softClipCurve(6); hum.type = 'sawtooth'; hum.frequency.value = 50; hum.start();
        const hlp = biq('lowpass', 400, 0.7);
        dryWet(); inp.connect(hp); hp.connect(lp); lp.connect(sh); sh.connect(wet); hum.connect(hlp); hlp.connect(hg); hg.connect(out);
        return unit((x) => { set(wet.gain, x.amount / 100); set(dry.gain, 1 - x.amount / 100); set(hg.gain, (x.hum / 100) * 0.03 * (x.amount / 100)); });
      }
      case 'subbass': {
        const ls = biq('lowshelf', 70, null, 9), pk = biq('peaking', 45, 1.2, 4), sh = mk(A.createWaveShaper()), lvl = G(0.9);
        sh.curve = softClipCurve(2.5);
        inp.connect(ls); ls.connect(pk); pk.connect(sh); sh.connect(lvl); lvl.connect(out);
        return unit((x) => { set(ls.gain, x.amount); set(pk.gain, x.amount * 0.45); set(lvl.gain, 1 / (1 + x.amount / 18)); });
      }
      case 'warmth': {
        const ls = biq('lowshelf', 220, null, 3), hs = biq('highshelf', 7500, null, -3), sh = mk(A.createWaveShaper()), c = mk(A.createDynamicsCompressor());
        sh.curve = softClipCurve(1.6); c.threshold.value = -24; c.ratio.value = 2.5; c.attack.value = 0.01; c.release.value = 0.2;
        dryWet(); inp.connect(ls); ls.connect(hs); hs.connect(sh); sh.connect(c); c.connect(wet);
        return unit((x) => { set(ls.gain, (x.amount / 100) * 5); set(hs.gain, -(x.amount / 100) * 5); set(wet.gain, x.amount / 100); set(dry.gain, 1 - (x.amount / 100) * 0.9); });
      }
      case 'chopper': {
        const vca = G(1), o = mk(A.createOscillator()), og = G(0.5), c = mk(A.createConstantSource());
        o.type = 'square'; o.start(); c.offset.value = 0.5; c.start();
        o.connect(og); og.connect(vca.gain); c.connect(vca.gain); vca.gain.value = 0;
        inp.connect(vca); vca.connect(out);
        return unit((x) => { set(o.frequency, x.rate); const dpt = x.depth / 100; set(og.gain, dpt / 2); set(c.offset, 1 - dpt / 2); });
      }
      case 'seasick': {
        const d = mk(A.createDelay(0.1)), o = mk(A.createOscillator()), og = G(0.004), c = mk(A.createConstantSource());
        o.type = 'sine'; o.start(); c.offset.value = 0.012; c.start();
        o.connect(og); og.connect(d.delayTime); c.connect(d.delayTime);
        const pan = mk(A.createStereoPanner()), po = mk(A.createOscillator()), pg = G(0.4);
        po.frequency.value = 0.23; po.start(); po.connect(pg); pg.connect(pan.pan);
        inp.connect(d); d.connect(pan); pan.connect(out);
        return unit((x) => { set(o.frequency, x.rate); set(og.gain, (x.amount / 100) * 0.008); set(pg.gain, (x.amount / 100) * 0.5); });
      }
      case 'tinyspeaker': {
        const hp = biq('highpass', 900, 1), lp = biq('lowpass', 6000, 0.8), pk = biq('peaking', 2500, 1, 6), sh = mk(A.createWaveShaper()), lvl = G(0.7);
        sh.curve = hardClipCurve(14);
        dryWet(); inp.connect(hp); hp.connect(lp); lp.connect(pk); pk.connect(sh); sh.connect(lvl); lvl.connect(wet);
        return unit((x) => { set(wet.gain, x.amount / 100); set(dry.gain, 1 - x.amount / 100); });
      }
    }
    return base7(e, A, workletOk, instant);
  };
}

/* ============================ A REAL ANVIL ============================ */
// A struck steel anvil: a hard hammer transient, a dense cluster of bright inharmonic modes that ring for a
// couple of seconds (real anvils "sing" around 1-3 kHz), slight beating, and a short room.
{
  const anv = BLEEP_SOUNDS.find((s) => s.id === 'anvil');
  if (anv) {
    anv.len = 2.4;
    anv.make = (c, o) => {
      const room = sfxReverb(c, o, 1.1, 0.16);
      const modes = [[1, 0.5, 2.1], [1.006, 0.35, 2.0], [1.58, 0.42, 1.6], [2.24, 0.32, 1.3], [2.71, 0.22, 1.1], [3.39, 0.18, 0.9], [4.15, 0.14, 0.7], [5.02, 0.1, 0.55], [6.3, 0.07, 0.4], [7.9, 0.05, 0.3]];
      const f0 = 1240;
      for (const [ratio, v, d] of modes) sfxOsc(c, 'sine', 0, [[0, f0 * ratio], [d, f0 * ratio * 0.9995]], [[0, 0.0001], [0.002, v], [d, 0.0001]], room);
      sfxClickNoise(c, room, 0, 0.012, 6500, 1.4);   // the hammer hit
      sfxClickNoise(c, room, 0.004, 0.03, 2600, 0.7);
      sfxKick(c, room, 0, 240, 120, 0.06, 0.35);      // the body thump
    };
    if (typeof bleepBufs !== 'undefined') bleepBufs.delete('anvil');
  }
}

/* ============================ TEMPLATES ============================ */
// Ready-made edits: the shape, the timing of each shot, transitions, looks, titles and text. Drop your clips in
// and press "Fill the template" - Flux puts them in the right spots.
const TEMPLATES = [
  { id: 'vlog', name: 'Daily vlog', sub: 'YouTube · 16:9', aspect: '16:9', color: '#ff8a4c', filter: 'film400',
    slots: [3, 2.5, 2.5, 3, 2.5, 3, 4], trans: 'fade', motion: ['zoomIn', 'none', 'panRight', 'none', 'zoomOut', 'none', 'zoomIn'],
    texts: [{ t: 0.3, d: 2.6, content: 'A DAY IN MY LIFE', size: 92, y: 0.5, anim: 'pop', font: 'Arial Black' }, { t: 16.5, d: 3.4, content: 'see you tomorrow', size: 56, y: 0.82, anim: 'fade' }] },
  { id: 'tiktok', name: 'Fast TikTok edit', sub: 'TikTok · 9:16', aspect: '9:16', color: '#ff4fd8', filter: 'vivid',
    slots: [1.2, 0.8, 0.8, 1.2, 0.8, 0.8, 1.2, 1.6], trans: 'zoomPunch', motion: ['zoomIn'],
    texts: [{ t: 0.1, d: 1.6, content: 'wait for it…', size: 70, y: 0.2, anim: 'pop', font: 'Impact' }] },
  { id: 'travel', name: 'Travel montage', sub: 'Any · 16:9', aspect: '16:9', color: '#4cb8ff', filter: 'goldenhour',
    slots: [3, 2, 2, 2, 3, 2, 2, 4], trans: 'slide', motion: ['panLeft', 'zoomIn', 'panRight', 'zoomOut'],
    texts: [{ t: 0.5, d: 2.5, content: 'SUMMER 2026', size: 110, y: 0.5, anim: 'fade', font: 'Georgia' }] },
  { id: 'gaming', name: 'Gaming highlights', sub: 'YouTube · 16:9', aspect: '16:9', color: '#7bd84a', filter: 'cyber',
    slots: [4, 4, 4, 4, 4], trans: 'white', motion: ['none'],
    texts: [{ t: 0.2, d: 3, content: 'BEST MOMENTS', size: 110, y: 0.18, anim: 'pop', font: 'Impact' }, { t: 16.2, d: 3.6, content: 'Subscribe for more!', size: 64, y: 0.85, anim: 'pop' }] },
  { id: 'product', name: 'Product promo', sub: 'Instagram · 1:1', aspect: '1:1', color: '#ffd23f', filter: 'matte',
    slots: [2.5, 2, 2, 2.5, 3], trans: 'zoom', motion: ['zoomIn'],
    texts: [{ t: 0.3, d: 2.2, content: 'NEW DROP', size: 120, y: 0.5, anim: 'pop', font: 'Arial Black' }, { t: 9.2, d: 2.8, content: 'Link in bio', size: 70, y: 0.8, anim: 'fade' }] },
  { id: 'birthday', name: 'Birthday wishes', sub: 'Any · 9:16', aspect: '9:16', color: '#ff6fae', filter: 'dreamy',
    slots: [3, 3, 3, 3, 4], trans: 'fade', motion: ['zoomIn', 'zoomOut'],
    texts: [{ t: 0.3, d: 3.5, content: 'HAPPY BIRTHDAY!', size: 96, y: 0.3, anim: 'pop', font: 'Trebuchet MS' }, { t: 12.4, d: 3.4, content: 'love you ❤', size: 72, y: 0.75, anim: 'fade' }] },
  { id: 'recap', name: 'Week recap', sub: 'Reels · 9:16', aspect: '9:16', color: '#3fdcb0', filter: 'film400',
    slots: [1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 2.5], trans: 'slideUp', motion: ['zoomIn'],
    texts: [{ t: 0.1, d: 1.8, content: 'my week', size: 90, y: 0.22, anim: 'pop', font: 'Georgia' }] },
  { id: 'cinematic', name: 'Cinematic intro', sub: 'YouTube · 16:9', aspect: '16:9', color: '#c4a7ff', filter: 'tealorange', bars: true,
    slots: [4, 3.5, 3.5, 5], trans: 'black', motion: ['zoomIn', 'panRight', 'zoomOut', 'zoomIn'],
    texts: [{ t: 11.6, d: 3.8, content: 'YOUR TITLE', size: 110, y: 0.5, anim: 'fade', font: 'Georgia' }] }
];
async function createFromTemplate(tp) {
  if (state.inEditor) await saveNow();
  await createProject(tp.name, tp.aspect);
  let t = 0;
  const slots = tp.slots.map((d, i) => { const s = { start: t, len: d, trans: i ? tp.trans : null, motion: tp.motion[i % tp.motion.length] }; t += d; return s; });
  commit(() => {
    P.template = { id: tp.id, filter: tp.filter, bars: !!tp.bars, slots };
    P.markers = slots.map((s, i) => ({ id: uid(), t: s.start, color: tp.color, label: 'Clip ' + (i + 1) }));
    for (const x of tp.texts) {
      const c = makeTextClip(x.t, { content: x.content, size: x.size, y: x.y, anim: x.anim, font: x.font || 'Segoe UI', bold: true, shadow: true });
      c.start = x.t; c.out = x.d;
      P.clips.push(c);
    }
  });
  showLibTab('media');
  templateBanner();
  toast('Template ready: import your clips, then press “Fill the template”', { duration: 7000 });
}
function fillTemplate() {
  const tp = P.template;
  if (!tp) return;
  const media = P.media.filter((m) => (m.kind === 'video' || m.kind === 'image') && !m.error && !m.loading && !m.missing);
  if (!media.length) return toast('Import some videos or photos first', { error: true });
  const used = new Set(P.clips.filter((c) => c.kind === 'video' || c.kind === 'image').map((c) => c.mediaId));
  const pool = [...media.filter((m) => !used.has(m.id)), ...media.filter((m) => used.has(m.id))];
  const tr = firstTrack('video');
  commit(() => {
    P.clips = P.clips.filter((c) => !(c.tplSlot != null));
    tp.slots.forEach((s, i) => {
      const m = pool[i % pool.length];
      const c = makeMediaClip(m, tr.id, s.start);
      c.start = s.start;
      if (m.kind === 'video') { const mid = Math.max(0, Math.min(m.duration - s.len, m.duration * 0.25)); c.in = mid; c.out = Math.min(m.duration, mid + s.len); }
      else c.out = s.len;
      c.fit = 'cover'; c.filter = tp.filter || 'none'; c.motion = s.motion || 'none'; c.tplSlot = i;
      if (s.trans) c.transition = { type: s.trans, duration: Math.min(0.5, s.len * 0.3) };
      if (tp.bars) c.effects = [newEffect('letterbox')];
      P.clips.push(c);
    });
  });
  toast(`Filled ${tp.slots.length} spots with your clips - drag any clip to swap it`);
  const b = $('.tpl-banner'); if (b) b.remove();
}
function templateBanner() {
  const page = document.querySelector('.tab-page[data-page=media]');
  if (!page || !P || !P.template) return;
  if (P.clips.some((c) => c.tplSlot != null)) return;
  let b = $('.tpl-banner', page);
  if (!b) { b = el('div', 'tpl-banner'); page.insertBefore(b, page.firstChild); }
  b.innerHTML = `<b>Template: ${P.template.slots.length} spots</b><small>1. Import your clips · 2. Press Fill - Flux cuts them to the beat of the template.</small><button class="btn primary">Fill the template</button>`;
  $('.btn', b).onclick = fillTemplate;
}
function openTemplates() {
  const box = modal(`<h2>Templates</h2><p class="sub">Pick a ready-made edit. Then add your clips and press <b>Fill the template</b>.</p><div class="tpl-grid"></div>
    <div class="footer"><button class="btn ghost" data-a="close">Close</button></div>`, { wide: true });
  const grid = $('.tpl-grid', box);
  for (const tp of TEMPLATES) {
    const card = el('button', 'tpl-card');
    const total = tp.slots.reduce((a, b) => a + b, 0);
    card.style.setProperty('--tc', tp.color);
    card.innerHTML = `<span class="tpl-prev tpl-${tp.aspect.replace(':', 'x')}"><span class="tpl-strip">${tp.slots.map((d) => `<i style="flex:${d}"></i>`).join('')}</span><b></b></span><span class="tpl-txt"><b></b><small>${tp.sub} · ${tp.slots.length} clips · ${Math.round(total)}s</small></span>`;
    $('.tpl-prev b', card).textContent = tp.texts[0] ? tp.texts[0].content : '';
    $('.tpl-txt b', card).textContent = tp.name;
    card.onclick = () => { closeModal(); createFromTemplate(tp); };
    grid.appendChild(card);
  }
  $('[data-a=close]', box).onclick = closeModal;
}
{
  // a Templates card on the home screen + in the menu; the banner comes back when a template project opens
  const row = document.querySelector('.start-row');
  if (row && !document.querySelector('.tpl-home')) {
    const b = el('button', 'quick-shape tpl-home', '<span class="shape-box"><svg viewBox="0 0 24 24" style="width:34px;height:34px"><rect x="3" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="8" height="7" rx="1.5"/><rect x="3" y="13" width="8" height="7" rx="1.5"/><rect x="13" y="13" width="8" height="7" rx="1.5"/></svg></span><b>Templates</b><small>Ready-made edits</small>');
    b.onclick = openTemplates;
    row.appendChild(b);
  }
  const baseShow = showLibTab;
  showLibTab = function (name) { const r = baseShow.apply(this, arguments); if (name === 'media') setTimeout(templateBanner, 0); return r; };
  const baseLoad = loadProjectData;
  loadProjectData = async function () { const r = await baseLoad.apply(this, arguments); setTimeout(templateBanner, 50); return r; };
}
