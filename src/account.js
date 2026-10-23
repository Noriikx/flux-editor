/* Flux — accounts: sign in with email + password. Premium comes from the account
   (monthly subscription or a gift from the owner). Stays signed in after restarts. */
'use strict';
const API_BASE = 'https://flux-editor.netlify.app/api/';
const ADMIN_URL = 'https://flux-editor.netlify.app/admin.html';

async function apiCall(path, body, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  let r;
  try {
    r = await fetch(API_BASE + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    return { offline: true, error: 'No internet connection. Check it and try again.' };
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { status: r.status, error: j.error || 'Something went wrong. Try again.' };
  return j;
}

function storeAccount(token, a) {
  settings.account = { token, email: a.email, admin: !!a.admin, premium: !!a.premium, until: a.until || null, source: a.source || null, checkedAt: Date.now() };
  saveSettings();
  updatePremiumBadge(); updateAccountButton();
}

// Ask the server for the latest Premium status. Offline = keep the last known one.
async function refreshAccount(force) {
  const a = settings.account;
  if (!a || !a.token) return;
  const r = await apiCall('me' + (force ? '?refresh=1' : ''), null, a.token);
  if (r.account) storeAccount(a.token, r.account);
  else if (r.status === 401) signOut(true);
  else if (r.offline && a.checkedAt && Date.now() - a.checkedAt > 30 * 86400000) { a.premium = false; saveSettings(); updatePremiumBadge(); }
  if (typeof renderInspector === 'function' && document.querySelector('#inspector')) try { renderInspector(); } catch {}
}

let premiumWatch = null;
function waitForPremium() {
  clearInterval(premiumWatch);
  let n = 0;
  premiumWatch = setInterval(async () => {
    if (++n > 40 || isPremium()) return clearInterval(premiumWatch);
    await refreshAccount(true);
    if (isPremium()) { clearInterval(premiumWatch); toast('Premium is on - thank you!'); }
  }, 15000);
}

function signOut(expired) {
  settings.account = null; saveSettings();
  updatePremiumBadge(); updateAccountButton();
  showAuth(expired ? 'Your sign-in expired. Please sign in again.' : '');
}

/* ---------------- sign-in screen ---------------- */
function showAuth(note) {
  let el = $('#auth');
  if (!el) {
    el = document.createElement('section');
    el.id = 'auth';
    document.body.appendChild(el);
  }
  let mode = 'login';
  const draw = (msg, err) => {
    el.innerHTML = `
      <div class="auth-card">
        <img src="logo.png" alt="" class="auth-logo">
        <h1>${mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p class="sub">${mode === 'login' ? 'Sign in to Flux' : 'Free account · Premium is optional'}</p>
        <div class="auth-tabs"><button data-m="login" class="${mode === 'login' ? 'on' : ''}">Sign in</button><button data-m="signup" class="${mode === 'signup' ? 'on' : ''}">Create account</button></div>
        <form autocomplete="on">
          <label>Email<input type="email" name="email" required autocomplete="email" placeholder="you@example.com"></label>
          <label>Password<input type="password" name="password" required minlength="${mode === 'signup' ? 8 : 1}" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" placeholder="${mode === 'signup' ? 'At least 8 characters' : ''}"></label>
          ${mode === 'signup' ? '<label>Repeat password<input type="password" name="password2" required autocomplete="new-password"></label>' : ''}
          <div class="auth-msg ${err ? 'err' : ''}">${msg || ''}</div>
          <button class="btn primary auth-go" type="submit">${mode === 'login' ? 'Sign in' : 'Create account'}</button>
        </form>
        ${mode === 'login' ? '<p class="hint">Forgot your password? Email the Flux owner from your account email and they can reset it.</p>' : ''}
        <button class="auth-quit" data-a="quit">Exit Flux</button>
      </div>`;
    $$('.auth-tabs button', el).forEach((b) => b.onclick = () => { mode = b.dataset.m; draw(); });
    $('[data-a=quit]', el).onclick = () => api && api.quit ? api.quit() : null;
    const f = $('form', el);
    setTimeout(() => f.email.focus(), 30);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const email = f.email.value.trim(), password = f.password.value;
      if (mode === 'signup' && password !== f.password2.value) return draw('The two passwords are not the same.', true);
      const go = $('.auth-go', el); go.disabled = true; go.textContent = 'Please wait…';
      const r = await apiCall(mode, { email, password });
      if (r.error) { draw(r.error, true); f.email.value = email; return; }
      storeAccount(r.token, r.account);
      el.remove();
      document.body.classList.remove('needs-auth');
      toast(mode === 'signup' ? 'Account created - welcome to Flux!' : 'Signed in as ' + r.account.email);
    };
  };
  document.body.classList.add('needs-auth');
  draw(note);
}

/* ---------------- account button + window ---------------- */
function updateAccountButton() {
  const b = $('#btnAccount');
  if (!b) return;
  const a = settings.account;
  b.querySelector('span').textContent = a ? (a.email[0] || '?').toUpperCase() : '?';
  b.dataset.tip = a ? a.email : 'Account';
  b.classList.toggle('pro', isPremium());
}

function openAccount() {
  const a = settings.account;
  if (!a) return showAuth();
  const when = (t) => new Date(t).toLocaleDateString();
  const status = isPremium()
    ? (a.source === 'owner' ? 'Premium · owner' : a.source === 'gift' ? (a.until ? 'Premium (gift) until ' + when(a.until) : 'Premium (gift) forever') : 'Premium · renews ' + (a.until ? when(a.until) : 'monthly'))
    : 'Free plan';
  const box = modal(`
    <h2>Your account</h2>
    <div class="acct-row"><div class="acct-avatar">${a.email[0].toUpperCase()}</div><div><b>${a.email.replace(/</g, '&lt;')}</b><small class="${isPremium() ? 'acct-pro' : ''}">${status}</small></div></div>
    <div class="acct-actions">
      ${isPremium() ? '' : '<button class="btn primary" data-a="buy">Get Premium - €4.99/month</button>'}
      <button class="btn" data-a="refresh">Check Premium status</button>
      <button class="btn" data-a="pw">Change password</button>
      ${a.admin ? '<button class="btn" data-a="admin">Open admin panel</button>' : ''}
    </div>
    <p class="hint">To cancel your subscription, use the link in the Stripe receipt email you got after paying.</p>
    <div class="footer"><button class="btn ghost" data-a="out">Sign out</button><button class="btn" data-a="close">Close</button></div>`);
  $('[data-a=close]', box).onclick = closeModal;
  $('[data-a=out]', box).onclick = () => { closeModal(); signOut(); };
  const buy = $('[data-a=buy]', box); if (buy) buy.onclick = () => { closeModal(); openCheckout(); };
  const adm = $('[data-a=admin]', box); if (adm) adm.onclick = () => api && api.openExternal ? api.openExternal(ADMIN_URL) : window.open(ADMIN_URL);
  $('[data-a=refresh]', box).onclick = async (e) => { e.target.textContent = 'Checking…'; await refreshAccount(true); openAccount(); };
  $('[data-a=pw]', box).onclick = () => {
    const b2 = modal(`<h2>Change password</h2>
      <label class="field">Current password<input type="password" class="num-input" data-f="old"></label>
      <label class="field">New password<input type="password" class="num-input" data-f="new" placeholder="At least 8 characters"></label>
      <div class="footer"><button class="btn ghost" data-a="close">Cancel</button><button class="btn primary" data-a="save">Save</button></div>`);
    $('[data-a=close]', b2).onclick = closeModal;
    $('[data-a=save]', b2).onclick = async () => {
      const r = await apiCall('password', { old: $('[data-f=old]', b2).value, password: $('[data-f=new]', b2).value }, a.token);
      if (r.error) return toast(r.error, { error: true });
      closeModal(); toast('Password changed');
    };
  };
}

function setupAccount() {
  const holder = document.createElement('button');
  holder.className = 'icon-btn acct-btn';
  holder.id = 'btnAccount';
  holder.innerHTML = '<span>?</span>';
  holder.onclick = openAccount;
  const set = $('#homeSettings');
  if (set) set.parentNode.insertBefore(holder, set);
  updateAccountButton();
  if (!settings.account || !settings.account.token) showAuth();
  else refreshAccount(false);
  // re-check every 30 minutes and when the window comes back into focus
  setInterval(() => refreshAccount(false), 30 * 60000);
  let last = 0;
  window.addEventListener('focus', () => { if (Date.now() - last > 60000) { last = Date.now(); refreshAccount(false); } });
}
