/* Flux — smooth-editing copies (proxies), like DaVinci's "proxy media".
   Long game recordings and .mkv files are slow (or glitchy) to jump around in, so Flux quietly makes a light copy
   with a keyframe every half second and edits with that. Exports always use the original file at full quality. */
'use strict';
const NEEDS_REMUX = /\.(mkv|flv|avi|ts|m2ts|mts|wmv|3gp|mpg|mpeg|vob)$/i;
const proxyState = new Map(); // media id -> { p, remux }
function wantsProxy(m) {
  if (!m || m.kind !== 'video' || !m.path || m.missing || m.error) return false;
  if (settings.proxies === false) return false;
  return NEEDS_REMUX.test(m.path) || (m.duration || 0) > 60 || (m.height || 0) > 1440;
}
// which file the editor plays (exports use m.full / the original)
function playPathOf(m) {
  if (rt.exp2) return m.full || m.path;
  if (settings.proxies !== false && m.proxy) return m.proxy;
  return m.full || m.path;
}
function reloadPlayersFor(m) {
  for (const [id] of Array.from(rt.players.entries())) {
    const c = getClip(id) || (typeof compoundInnerIds === 'function' && null);
    if (c && c.mediaId === m.id) destroyPlayer(id);
  }
  requestDraw();
}
async function ensureProxy(m) {
  if (!api || !api.mediaProxy || !m || m.kind !== 'video' || !m.path) return;
  if (proxyState.has(m.id)) return;
  proxyState.set(m.id, { p: 0 });
  try {
    if (NEEDS_REMUX.test(m.path)) {
      proxyState.set(m.id, { p: 0, remux: true });
      renderMediaBadges();
      const r = await api.mediaProxy({ file: m.path, id: m.id, remux: true });
      if (r && r.path && m.full !== r.path) { m.full = r.path; reloadPlayersFor(m); markDirty(); }
    }
    if (wantsProxy(m)) {
      proxyState.set(m.id, { p: 0 });
      renderMediaBadges();
      const r = await api.mediaProxy({ file: m.path, id: m.id });
      if (r && r.path && m.proxy !== r.path) { m.proxy = r.path; if (settings.proxies !== false) reloadPlayersFor(m); markDirty(); }
    }
  } catch (e) { console.warn('proxy', e); }
  proxyState.delete(m.id);
  renderMediaBadges();
}
function renderMediaBadges() {
  for (const item of $$('#mediaGrid .media-item')) {
    const id = item.dataset.id, st = proxyState.get(id), m = getMedia(id);
    let b = $('.px-badge', item);
    const txt = st ? (st.remux ? 'Preparing…' : `Optimizing ${Math.round((st.p || 0) * 100)}%`) : m && m.proxy && settings.proxies !== false ? 'Smooth' : '';
    if (!txt) { if (b) b.remove(); continue; }
    if (!b) { b = el('span', 'px-badge'); $('.thumb', item).appendChild(b); }
    b.textContent = txt;
    b.classList.toggle('done', !st);
    b.dataset.tip = st ? 'Flux is making a light copy of this video so editing is smooth. Your export still uses the original.' : 'Editing with a smooth copy - exports use the original';
  }
}
if (api && api.onProxyProgress) api.onProxyProgress((v) => {
  const st = proxyState.get(v.id);
  if (st) { st.p = v.p; renderMediaBadges(); }
});
function setupProxies() {
  // after a file is imported and read
  const baseProbe = probeMedia;
  probeMedia = async function (m) {
    // .mkv / .flv / .avi: make the full-quality .mp4 copy first so the editor can read it at all
    if (api && api.mediaProxy && m.path && NEEDS_REMUX.test(m.path)) {
      proxyState.set(m.id, { p: 0, remux: true }); renderMediaBadges();
      try { const r = await api.mediaProxy({ file: m.path, id: m.id, remux: true }); if (r && r.path) m.full = r.path; } catch {}
      proxyState.delete(m.id);
    }
    const r = await baseProbe.apply(this, arguments);
    if (m.kind === 'video') setTimeout(() => ensureProxy(m), 300);
    return r;
  };
  const baseRender = renderMedia;
  renderMedia = function () { const r = baseRender.apply(this, arguments); renderMediaBadges(); return r; };
  // projects that are opened: make sure the copies are there (instant if they already are)
  const baseLoad = loadProjectData;
  loadProjectData = async function () {
    const r = await baseLoad.apply(this, arguments);
    proxyState.clear();
    for (const m of P.media) if (m.kind === 'video') { delete m.proxy; ensureProxy(m); }
    return r;
  };
}
