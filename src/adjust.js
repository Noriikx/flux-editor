/* Flux — Adjustment clips: put one on a Media track above your video and its color & effect settings
   change everything below it, for as long as the clip lasts. */
'use strict';
KIND_COLOR.adjust = '#3fa7a0';
ICON.adjust = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/></svg>';
function addAdjustmentClip(at = state.time) {
  let c;
  commit(() => {
    const d = 5;
    // top-most media track that's free here, or a new one on top
    const vids = P.tracks.filter((t) => t.type === 'video');
    let tr = vids.find((t) => Math.abs(findFreeStart(t.id, at, d) - at) < 1e-6 && !t.locked);
    if (!tr || tr === vids[vids.length - 1]) {
      // keep the bottom track for the video itself: prefer a new track on top
      const top = vids[0];
      if (top && top !== vids[vids.length - 1] && Math.abs(findFreeStart(top.id, at, d) - at) < 1e-6 && !top.locked) tr = top;
      else {
        tr = { id: 'v' + uid().slice(0, 4), type: 'video', name: '', auto: true, hidden: false, muted: false, locked: false };
        const i = P.tracks.findIndex((t) => t.type === 'video');
        P.tracks.splice(i < 0 ? 0 : i, 0, tr);
        autoNameTracks();
      }
    }
    c = {
      id: uid(), trackId: tr.id, kind: 'adjust', start: at, in: 0, out: d, speed: 1, fadeIn: 0, fadeOut: 0, opacity: 1,
      filter: 'none', brightness: 100, contrast: 100, saturation: 120, blur: 0, hue: 0, temp: 0, tint: 0, vignette: 0, grain: 0
    };
    P.clips.push(c);
    state.selectedId = c.id;
  });
  toast('Adjustment clip added - change its color & effects to change everything under it');
  return c;
}
// Called while drawing the picture, at the adjustment clip's place in the track order.
function applyAdjustment(g, c, local, W, H, k) {
  const amount = clamp(kv(c, 'opacity', local) * fadeEnv(c, local), 0, 1);
  if (amount <= 0.001) return;
  const cv = g.canvas;
  const tmp = rt.adjCanvas || (rt.adjCanvas = document.createElement('canvas'));
  if (tmp.width !== cv.width || tmp.height !== cv.height) { tmp.width = cv.width; tmp.height = cv.height; }
  const tg = tmp.getContext('2d');
  tg.setTransform(1, 0, 0, 1, 0, 0);
  tg.clearRect(0, 0, tmp.width, tmp.height);
  tg.drawImage(cv, 0, 0);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = amount;
  g.filter = buildFilter(c, k);
  g.drawImage(tmp, 0, 0);
  g.filter = 'none';
  g.restore();
  // color washes, vignette and grain on top of the whole frame
  g.save();
  g.translate(W / 2, H / 2);
  g.globalAlpha = amount;
  const f = filterById(c.filter);
  if (f.tint) { g.globalCompositeOperation = 'soft-light'; g.fillStyle = f.tint; g.fillRect(-W / 2, -H / 2, W, H); }
  drawEffects(g, c, W, H, local);
  g.restore();
}
function adjustInspector(body, c) {
  const col = section(body, 'Color', () => Object.assign(c, { filter: 'none', brightness: 100, contrast: 100, saturation: 100, blur: 0, hue: 0, temp: 0, tint: 0 }));
  const fsel = el('div', 'field wide');
  fsel.innerHTML = `<label>Look</label><select></select>`;
  const sel = $('select', fsel);
  for (const f of FILTERS) { const o = el('option'); o.value = f.id; o.textContent = f.name; sel.appendChild(o); }
  sel.value = c.filter || 'none';
  sel.onchange = () => commit(() => { c.filter = sel.value; });
  col.appendChild(fsel);
  slider(col, 'Brightness', { min: 0, max: 200, get: () => c.brightness, set: (v) => (c.brightness = v), fmt: (v) => v, def: 100, live: false });
  slider(col, 'Contrast', { min: 0, max: 200, get: () => c.contrast, set: (v) => (c.contrast = v), fmt: (v) => v, def: 100, live: false });
  slider(col, 'Saturation', { min: 0, max: 200, get: () => c.saturation, set: (v) => (c.saturation = v), fmt: (v) => v, def: 100, live: false });
  slider(col, 'Warmth', { min: -100, max: 100, get: () => c.temp || 0, set: (v) => (c.temp = v), fmt: (v) => v, def: 0, live: false });
  slider(col, 'Tint', { min: -100, max: 100, get: () => c.tint || 0, set: (v) => (c.tint = v), fmt: (v) => v, def: 0, live: false });
  slider(col, 'Hue', { min: -180, max: 180, get: () => c.hue || 0, set: (v) => (c.hue = v), fmt: (v) => v + '°', def: 0, live: false });
  slider(col, 'Blur', { min: 0, max: 30, get: () => c.blur, set: (v) => (c.blur = v), fmt: (v) => v, def: 0, live: false });
  const mix = section(body, 'Strength', () => { c.opacity = 1; if (c.keys) delete c.keys.opacity; });
  slider(mix, 'Amount', { min: 0, max: 100, get: () => Math.round(kvNow(c, 'opacity') * 100), set: (v) => setProp(c, 'opacity', v / 100), fmt: (v) => v + '%', def: 100, live: false, kf: [c, 'opacity'] });
  slider(mix, 'Fade in', { min: 0, max: 5, step: 0.1, get: () => c.fadeIn || 0, set: (v) => (c.fadeIn = v), fmt: (v) => v.toFixed(1) + 's', def: 0, live: false });
  slider(mix, 'Fade out', { min: 0, max: 5, step: 0.1, get: () => c.fadeOut || 0, set: (v) => (c.fadeOut = v), fmt: (v) => v.toFixed(1) + 's', def: 0, live: false });
  lengthField(mix, c);
  effectsInspector(body, c);
  const p = el('p', 'hint');
  p.textContent = 'Everything on the tracks below this clip gets these settings while it plays. Drag its edges to make it longer or shorter.';
  body.appendChild(p);
}
