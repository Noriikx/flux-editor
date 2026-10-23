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
  if (!el) { el = document.createElement('section'); el.id = 'auth'; document.body.appendChild(el); }
  document.body.classList.add('needs-auth');
  let mode = 'login', email = '', msg = note || '', err = false;
  const titles = { login: ['Welcome back', 'Sign in to Flux'], signup: ['Create your account', 'Free account · Premium is optional'],
    code: ['Check your email', ''], forgot: ['Forgot password', 'We’ll email you a code'], reset: ['New password', ''] };
  const done = (r, text) => {
    storeAccount(r.token, r.account);
    el.remove(); document.body.classList.remove('needs-auth');
    toast(text);
  };
  const field = (name, label, type, extra = '') => `<label>${label}<input type="${type}" name="${name}" required ${extra}></label>`;
  const draw = () => {
    const [h, sub] = titles[mode];
    const body = {
      login: field('email', 'Email', 'email', 'autocomplete="email" placeholder="you@example.com"') + field('password', 'Password', 'password', 'autocomplete="current-password"'),
      signup: field('email', 'Email', 'email', 'autocomplete="email" placeholder="you@example.com"') + field('password', 'Password', 'password', 'minlength="8" autocomplete="new-password" placeholder="At least 8 characters"') + field('password2', 'Repeat password', 'password', 'autocomplete="new-password"'),
      code: field('code', 'Code', 'text', 'inputmode="numeric" maxlength="6" class="code-input" placeholder="000000" autocomplete="one-time-code"'),
      forgot: field('email', 'Email', 'email', 'autocomplete="email"'),
      reset: field('code', 'Code from the email', 'text', 'inputmode="numeric" maxlength="6" class="code-input" placeholder="000000"') + field('password', 'New password', 'password', 'minlength="8" autocomplete="new-password" placeholder="At least 8 characters"')
    }[mode];
    const btn = { login: 'Sign in', signup: 'Create account', code: 'Confirm', forgot: 'Send code', reset: 'Save new password' }[mode];
    el.innerHTML = `
      <div class="auth-card">
        <img src="logo.png" alt="" class="auth-logo">
        <h1>${h}</h1>
        <p class="sub">${sub || 'We sent a 6-digit code to <b>' + email.replace(/</g, '&lt;') + '</b>'}</p>
        ${mode === 'login' || mode === 'signup' ? `<div class="auth-tabs"><button data-m="login" class="${mode === 'login' ? 'on' : ''}">Sign in</button><button data-m="signup" class="${mode === 'signup' ? 'on' : ''}">Create account</button></div>` : '<div style="height:14px"></div>'}
        <form autocomplete="on">${body}
          <div class="auth-msg ${err ? 'err' : ''}"></div>
          <button class="btn primary auth-go" type="submit">${btn}</button>
        </form>
        <div class="auth-links">
          ${mode === 'login' ? '<a href="#" data-go="forgot">Forgot password?</a>' : ''}
          ${mode === 'code' ? '<a href="#" data-go="resend">Send the code again</a><a href="#" data-go="login">Back</a>' : ''}
          ${mode === 'forgot' || mode === 'reset' ? '<a href="#" data-go="login">Back to sign in</a>' : ''}
          ${mode === 'code' || mode === 'reset' ? '<span>Can’t find it? Check Spam.</span>' : ''}
        </div>
        <button class="auth-quit" data-a="quit">Exit Flux</button>
      </div>`;
    $('.auth-msg', el).textContent = msg;
    $$('.auth-tabs button', el).forEach((b) => b.onclick = () => { mode = b.dataset.m; msg = ''; draw(); });
    $$('[data-go]', el).forEach((a) => a.onclick = async (e) => {
      e.preventDefault();
      if (a.dataset.go === 'resend') { await apiCall('resend', { email }); msg = 'New code sent (you can ask once a minute).'; err = false; return draw(); }
      mode = a.dataset.go; msg = ''; draw();
    });
    $('[data-a=quit]', el).onclick = () => api && api.quit ? api.quit() : null;
    const f = $('form', el);
    if (f.email && email) f.email.value = email;
    setTimeout(() => (f.code || f.email).focus(), 30);
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (f.email) email = f.email.value.trim();
      if (mode === 'signup' && f.password.value !== f.password2.value) { msg = 'The two passwords are not the same.'; err = true; return draw(); }
      const go = $('.auth-go', el); go.disabled = true; go.textContent = 'Please wait…';
      const payload = { email, password: f.password && f.password.value, code: f.code && f.code.value };
      const path = { login: 'login', signup: 'signup', code: 'verify', forgot: 'forgot', reset: 'reset' }[mode];
      const r = await apiCall(path, payload);
      if (r.token) return done(r, mode === 'code' ? 'Account confirmed - welcome to Flux!' : mode === 'reset' ? 'Password changed - you’re signed in' : 'Signed in as ' + r.account.email);
      if (r.needCode || (r.status === 403 && mode === 'login')) { mode = 'code'; msg = ''; err = false; return draw(); }
      if (mode === 'forgot' && !r.error) { mode = 'reset'; msg = ''; err = false; return draw(); }
      msg = r.error || 'Something went wrong. Try again.'; err = true; draw();
    };
  };
  draw();
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
