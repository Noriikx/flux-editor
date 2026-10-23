/* Flux — updates straight from the app (downloads the newest version from GitHub and installs it). */
'use strict';
const upd = { info: null, busy: false };

async function checkForUpdates(silent) {
  if (!api || !api.updateCheck) { if (!silent) toast('Updates work in the Flux desktop app.'); return null; }
  const r = await api.updateCheck();
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
    const res = await api.updateInstall();
    if (res && res.error) {
      upd.busy = false;
      toast(res.error, { error: true, duration: 7000 });
      e.target.disabled = false; e.target.textContent = 'Try again';
      $('[data-a=later]', box).disabled = false;
    }
  };
}

function setupUpdates() {
  // check quietly a few seconds after start, then every 6 hours
  setTimeout(() => checkForUpdates(true), 5000);
  setInterval(() => checkForUpdates(true), 6 * 3600 * 1000);
}
