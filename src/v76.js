/* Flux 1.7.6 — copyright check for songs.
   Every song you bring in gets a small mark: "!" if it looks copyrighted, a check if it's free to use.
   It never stops you from using the song - it only tells you, so YouTube/TikTok claims aren't a surprise.
   The check reads the file's own tags on this computer (nothing is uploaded). */

const CR = new Map(); // mediaId -> { v: 'yes' | 'likely' | 'free' | 'unknown', why }
const crPending = new Set();
const CR_INFO = {
  yes: { mark: '!', title: 'Copyrighted song', note: 'You can still use it. YouTube, TikTok or Instagram may mute your video, show ads on it for the owner, or block it in some countries.' },
  likely: { mark: '!', title: 'Probably copyrighted', note: 'You can still use it. If it is a released song, YouTube or TikTok may claim or mute your video.' },
  free: { mark: '✓', title: 'Free to use', note: '' },
  unknown: { mark: '?', title: 'Flux can’t tell', note: 'If you didn’t make it or get it from a free music site, it’s probably copyrighted.' }
};
function crFor(m) {
  if (!m || (m.kind !== 'audio' && m.kind !== 'video')) return null;
  if (m.tag === 'voice' || m.tag === 'sfx') return null; // your own recordings and Flux sound effects
  if (m.tag === 'music' || m.credit) return { v: 'free', why: m.credit ? 'From Flux’s free music library. Give credit in your video description (see Credits).' : 'From Flux’s free music library.' };
  const r = CR.get(m.id);
  if (r) return r;
  if (!m.missing && m.path && !crPending.has(m.id) && api.copyrightCheck) {
    crPending.add(m.id);
    api.copyrightCheck(m.path).then((res) => {
      crPending.delete(m.id);
      CR.set(m.id, res || { v: 'unknown', why: '' });
      if (P.media.includes(m)) { crPaintMedia(); crPaintTimeline(); }
    }).catch(() => crPending.delete(m.id));
  }
  return null;
}
// videos only get a mark when their music looks copyrighted (most videos are your own footage)
const crShown = (m, r) => r && (m.kind === 'audio' || r.v === 'yes' || r.v === 'likely');
function crTip(r) {
  const i = CR_INFO[r.v] || CR_INFO.unknown;
  return [i.title, r.why, i.note].filter(Boolean).join(' - ');
}
function crPaintMedia() {
  const flagged = P.media.filter((m) => { const r = crFor(m); return r && (r.v === 'yes' || r.v === 'likely'); });
  for (const tile of $$('#mediaGrid [data-folder]')) {
    const fid = tile.dataset.folder;
    const n = flagged.filter((m) => m.folder && (m.folder === fid || (typeof isInside === 'function' && isInside(m.folder, fid)))).length;
    let b = $(':scope > .cr-badge, .thumb > .cr-badge', tile);
    if (!n) { if (b) b.remove(); continue; }
    if (!b) { b = el('span', 'cr-badge cr-yes cr-count'); (tile.querySelector('.thumb') || tile).appendChild(b); }
    b.textContent = '! ' + n;
    b.dataset.tip = `${n} song${n === 1 ? '' : 's'} in here ${n === 1 ? 'looks' : 'look'} copyrighted - open the folder to see which`;
  }
  for (const item of $$('#mediaGrid .media-item[data-id]')) {
    const m = getMedia(item.dataset.id);
    if (!m) continue;
    const r = crFor(m);
    let b = $('.cr-badge', item);
    if (!crShown(m, r)) { if (b) b.remove(); continue; }
    if (!b) { b = el('span', 'cr-badge'); const th = $('.thumb', item); if (!th) continue; th.appendChild(b); }
    b.className = 'cr-badge cr-' + r.v;
    b.textContent = CR_INFO[r.v].mark;
    b.dataset.tip = crTip(r);
  }
}
function crPaintTimeline() {
  for (const ce of $$('.clip')) {
    const c = getClip(ce.dataset.id);
    const m = c && c.mediaId ? getMedia(c.mediaId) : null;
    const r = m ? crFor(m) : null;
    const show = r && (r.v === 'yes' || r.v === 'likely');
    let b = $('.cr-clip', ce);
    ce.classList.toggle('has-cr', !!show);
    if (!show) { if (b) b.remove(); continue; }
    if (!b) { b = el('span', 'cr-clip'); b.textContent = '!'; ce.appendChild(b); }
    b.classList.toggle('sure', r.v === 'yes');
    b.dataset.tip = crTip(r);
  }
}
const _renderMedia76 = renderMedia;
renderMedia = function () { const r = _renderMedia76.apply(this, arguments); try { crPaintMedia(); } catch (e) { console.warn(e); } return r; };
const _renderTimeline76 = renderTimeline;
renderTimeline = function () { const r = _renderTimeline76.apply(this, arguments); try { crPaintTimeline(); } catch (e) { console.warn(e); } return r; };
// a relinked file is a different file: check it again
const _relink76 = relinkMedia;
relinkMedia = async function (m) { const r = await _relink76.apply(this, arguments); if (m) { CR.delete(m.id); crPaintMedia(); crPaintTimeline(); } return r; };
if (typeof decorateLibrary === 'function') {
  const _decorate76 = decorateLibrary;
  decorateLibrary = function () { const r = _decorate76.apply(this, arguments); try { crPaintMedia(); } catch {} return r; };
}
