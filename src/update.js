/* Flux — updates straight from the app (downloads the newest version from GitHub and installs it). */
'use strict';
const upd = { info: null, busy: false, cfg: null, version: '' };
const verNum = (v) => String(v || '0').split('.').map((x) => parseInt(x, 10) || 0);
const verNewer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };

async function checkForUpdates(silent) {
  if (!api || !api.updateCheck) { if (!silent) toast('Updates work in the Flux desktop app.'); return null; }
  const r = await api.updateCheck({ pin: upd.cfg && upd.cfg.pinVersion || '' });
  if (r.error) { if (!silent) toast(r.error, { error: true }); return null; }
  upd.info = r;
  showUpdatePill();
  if (!silent && !r.available) {
    if (r.preparing) toast(`Flux ${r.preparing} is almost ready - try again in a few minutes`, { duration: 6000 });
    else toast(`You have the newest version (Flux ${r.current})`);
  }
  if (r.available && silent && !upd.toasted) {
    upd.toasted = true;
    toast(`Flux ${r.latest} is ready to install`, { action: 'Update', onAction: openUpdateDialog, duration: 12000 });
  }
  if (r.available && !silent) openUpdateDialog();
  return r;
}

function showUpdatePill() {
  $$('.update-pill').forEach((p) => p.remove());
  if (!upd.info || !upd.info.available) return;
  for (const spot of [$('#homeSettings'), $('#btnHelp')]) {
    if (!spot) continue;
    const b = el('button', 'btn update-pill', `<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>Update`);
    b.dataset.tip = `Flux ${upd.info.latest} is available`;
    b.onclick = openUpdateDialog;
    spot.parentNode.insertBefore(b, spot);
  }
}

function openUpdateDialog() {
  const r = upd.info;
  if (!r || !r.available) return checkForUpdates(false);
  const notes = String(r.notes || '').trim();
  const size = r.size ? ` · ${(r.size / 1048576).toFixed(0)} MB` : '';
  const box = modal(`
    <h2>Update Flux</h2>
    <p class="sub">Version <b>${r.latest}</b> is ready (you have ${r.current})${size}.</p>
    ${notes ? '<div class="upd-notes"></div>' : ''}
    <div class="upd-progress" hidden><div class="progress"><div class="upd-bar" style="width:0%"></div></div><p class="hint upd-text">Downloading…</p></div>
    <p class="hint">Your projects are saved first. Flux closes, installs the update and opens again by itself.</p>
    <div class="footer"><button class="btn ghost" data-a="later">Later</button><button class="btn primary" data-a="go">Update now</button></div>`);
  if (notes) $('.upd-notes', box).textContent = notes;
  $('[data-a=later]', box).onclick = closeModal;
  $('[data-a=go]', box).onclick = async (e) => {
    if (upd.busy) return;
    upd.busy = true;
    e.target.disabled = true; e.target.textContent = 'Updating…';
    $('[data-a=later]', box).disabled = true;
    $('.upd-progress', box).hidden = false;
    try { if (state.inEditor && state.dirty) await saveNow({ sync: true }); } catch {}
    if (!upd.hooked && api.onUpdateProgress) {
      upd.hooked = true;
      api.onUpdateProgress((v) => {
        const bar = $('.upd-bar'), t = $('.upd-text');
        if (bar) bar.style.width = Math.round((v.value || 0) * 100) + '%';
        if (t) t.textContent = v.stage === 'install' ? 'Installing… Flux will open again in a moment.' : `Downloading… ${Math.round((v.value || 0) * 100)}%`;
      });
    }
    const res = await api.updateInstall({ pin: upd.cfg && upd.cfg.pinVersion || '' });
    if (res && res.error) {
      upd.busy = false;
      toast(res.error, { error: true, duration: 7000 });
      e.target.disabled = false; e.target.textContent = 'Try again';
      $('[data-a=later]', box).disabled = false;
    }
  };
}

/* ---- required updates: the owner can make everyone update (or roll everyone back) from the admin panel ---- */
async function checkRequiredUpdate() {
  if (typeof apiCall !== 'function' || !api || !api.updateCheck) return;
  if (!upd.version && api.appVersion) upd.version = await api.appVersion();
  const c = await apiCall('config');
  if (!c || c.error) return; // offline: keep working
  upd.cfg = c;
  const cur = upd.version;
  const need = c.pinVersion ? (c.pinVersion !== cur ? c.pinVersion : null) : (c.minVersion && verNewer(c.minVersion, cur) ? c.minVersion : null);
  if (!need) { const o = $('#forceUpd'); if (o) o.remove(); return; }
  showForcedUpdate(need, !!c.pinVersion && verNewer(cur, c.pinVersion), c.message || '');
}
function showForcedUpdate(ver, rollback, message) {
  let o = $('#forceUpd');
  if (!o) { o = el('div', 'force-upd'); o.id = 'forceUpd'; document.body.appendChild(o); }
  o.innerHTML = `<div class="force-card"><img src="logo.png" alt=""><h2></h2><p class="sub"></p><p class="force-msg"></p>
    <div class="force-prog" hidden><div class="enh-bar"><i style="width:0%"></i></div><small>Downloading…</small></div>
    <button class="btn primary force-go">${rollback ? 'Switch now' : 'Update now'}</button><small class="force-note">Your projects are saved and stay on this computer.</small></div>`;
  $('h2', o).textContent = rollback ? `Flux is moving back to ${ver}` : `Please update to Flux ${ver}`;
  $('.sub', o).textContent = rollback ? 'The newest version had a problem, so everyone is moving to a version that works well. It only takes a minute.' : 'This update is required to keep using Flux. It only takes a minute.';
  $('.force-msg', o).textContent = message;
  $('.force-msg', o).hidden = !message;
  const go = $('.force-go', o);
  go.onclick = async () => {
    go.disabled = true; go.textContent = 'Getting it…';
    const r = await checkForUpdates(true);
    if (!r || !r.available) {
      go.disabled = false; go.textContent = 'Try again';
      $('.force-note', o).textContent = r && r.preparing ? `Flux ${r.preparing} is being prepared - try again in a few minutes.` : 'Couldn\u2019t reach the update. Check your internet and try again.';
      return;
    }
    try { if (state.inEditor && state.dirty) await saveNow({ sync: true }); } catch {}
    $('.force-prog', o).hidden = false;
    if (!upd.forceHooked && api.onUpdateProgress) {
      upd.forceHooked = true;
      api.onUpdateProgress((v) => { const b = $('#forceUpd .enh-bar i'), t = $('#forceUpd .force-prog small'); if (b) b.style.width = Math.round((v.value || 0) * 100) + '%'; if (t) t.textContent = v.stage === 'install' ? 'Installing… Flux opens again in a moment.' : `Downloading… ${Math.round((v.value || 0) * 100)}%`; });
    }
    const res = await api.updateInstall({ pin: upd.cfg && upd.cfg.pinVersion || '' });
    if (res && res.error) { go.disabled = false; go.textContent = 'Try again'; $('.force-note', o).textContent = res.error; }
  };
}

function setupUpdates() {
  setTimeout(checkRequiredUpdate, 1500);
  setInterval(checkRequiredUpdate, 20 * 60000);
  window.addEventListener('focus', () => { if (Date.now() - (upd.lastReq || 0) > 120000) { upd.lastReq = Date.now(); checkRequiredUpdate(); } });
  // check quietly a few seconds after start, then every 6 hours
  setTimeout(() => checkForUpdates(true), 5000);
  setInterval(() => checkForUpdates(true), 6 * 3600 * 1000);
}
