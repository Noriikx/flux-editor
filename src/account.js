/* Flux — accounts: sign in with email + password. Premium comes from the account
   (monthly subscription or a gift from the owner). Stays signed in after restarts. */
'use strict';
const API_BASE = 'https://flux-editor.netlify.app/api/';
const ADMIN_URL = 'https://flux-editor.netlify.app/admin.html';
const avatarSrc = (p) => (p ? (/^https?:|^data:/.test(p) ? p : API_BASE.replace(/\/api\/$/, '') + p) : '');
// Terms of Service + Privacy Policy. Bump TERMS_VERSION when they change in an important way:
// signed-in users are then asked once to accept the new version.
const TERMS_VERSION = '2026-11-24';
const TERMS_URL = 'https://flux-editor.netlify.app/terms.html';
const PRIVACY_URL = 'https://flux-editor.netlify.app/privacy.html';
function openLink(url) { if (api && api.openExternal) api.openExternal(url); else window.open(url); }
const legalLinks = () => `<a href="#" data-legal="terms">Terms of Service</a> and <a href="#" data-legal="privacy">Privacy Policy</a>`;
function wireLegal(root) { $$('[data-legal]', root).forEach((a) => a.onclick = (e) => { e.preventDefault(); openLink(a.dataset.legal === 'terms' ? TERMS_URL : PRIVACY_URL); }); }

let fluxVersion = '';
if (api && api.appVersion) api.appVersion().then((v) => { fluxVersion = v; }).catch(() => {});
async function apiCall(path, body, token) {
  if (!fluxVersion && api && api.appVersion) { try { fluxVersion = await api.appVersion(); } catch {} }
  const headers = { 'content-type': 'application/json', 'x-flux-version': fluxVersion || '', 'x-flux-os': api && api.platform ? api.platform : '' };
  if (token) headers.authorization = 'Bearer ' + token;
  let r;
  try {
    r = await fetch(API_BASE + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    return { offline: true, error: 'No internet connection. Check it and try again.' };
  }
  const j = await r.json().catch(() => ({}));
  if (r.status === 429) return { status: 429, error: j.error || 'Too many tries. Please wait a few minutes and try again.' };
  if (!r.ok) return { status: r.status, error: j.error || 'Something went wrong. Try again.', banned: !!j.banned };
  return j;
}

function storeAccount(token, a) {
  settings.account = { token, email: a.email, username: a.username || null, uid: a.uid || null, avatar: a.avatar || null, badges: a.badges || [], privacy: a.privacy || { private: false, requests: 'everyone' }, twoFactor: !!a.twoFactor, needAge: !!a.needAge, admin: !!a.admin, premium: !!a.premium, until: a.until || null, source: a.source || null, termsVersion: a.termsVersion || (settings.account && settings.account.termsVersion) || null, checkedAt: Date.now() };
  saveSettings();
  updatePremiumBadge(); updateAccountButton();
  if (!a.username || a.needAge) setTimeout(askProfile, 600);
}

// Ask the server for the latest Premium status. Offline = keep the last known one.
async function refreshAccount(force) {
  const a = settings.account;
  if (!a || !a.token) return;
  const r = await apiCall('me' + (force ? '?refresh=1' : ''), null, a.token);
  if (r.account) storeAccount(a.token, r.account);
  else if (r.banned) signOut(r.error);
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
  showAuth(typeof expired === 'string' ? expired : expired ? 'Your sign-in expired. Please sign in again.' : '');
}

/* ---------------- sign-in screen ---------------- */
function showAuth(note) {
  let el = $('#auth');
  if (!el) { el = document.createElement('section'); el.id = 'auth'; document.body.appendChild(el); }
  document.body.classList.add('needs-auth');
  let mode = 'login', email = '', msg = note || '', err = false;
  let pw = '';
  const titles = { twofa: ['2-step verification', 'Enter the 6-digit code we just emailed you'], login: ['Welcome back', 'Sign in to Flux'], signup: ['Create your account', 'Free account · no watermark'],
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
      signup: field('username', 'Username', 'text', 'minlength="3" maxlength="20" autocomplete="username" placeholder="e.g. alex.edits" pattern="[A-Za-z0-9_.]{3,20}"') + field('email', 'Email', 'email', 'autocomplete="email" placeholder="you@example.com"') + field('password', 'Password', 'password', 'minlength="8" autocomplete="new-password" placeholder="At least 8 characters"') + field('password2', 'Repeat password', 'password', 'autocomplete="new-password"') +
        birthField() +
        `<label class="auth-agree"><input type="checkbox" name="agree" required> <span>I accept the ${legalLinks()}</span></label>`,
      code: field('code', 'Code', 'text', 'inputmode="numeric" maxlength="6" class="code-input" placeholder="000000" autocomplete="one-time-code"'),
      twofa: field('code', 'Code', 'text', 'inputmode="numeric" maxlength="6" class="code-input" placeholder="000000" autocomplete="one-time-code"'),
      forgot: field('email', 'Email', 'email', 'autocomplete="email"'),
      reset: field('code', 'Code from the email', 'text', 'inputmode="numeric" maxlength="6" class="code-input" placeholder="000000"') + field('password', 'New password', 'password', 'minlength="8" autocomplete="new-password" placeholder="At least 8 characters"')
    }[mode];
    const btn = { twofa: 'Sign in', login: 'Sign in', signup: 'Create account', code: 'Confirm', forgot: 'Send code', reset: 'Save new password' }[mode];
    el.innerHTML = `
      <div class="auth-card">
        <img src="logo.png" alt="" class="auth-logo">
        <h1>${h}</h1>
        <p class="sub">${sub || 'We sent a 6-digit code to <b>' + email.replace(/</g, '&lt;') + '</b>'}</p>${mode === 'code' || mode === 'reset' || mode === 'twofa' ? '<div class="spam-note">📩 Can\u2019t see the email? <b>Check your spam folder</b> (and Promotions).</div>' : ''}
        ${mode === 'login' || mode === 'signup' ? `<div class="auth-tabs"><button data-m="login" class="${mode === 'login' ? 'on' : ''}">Sign in</button><button data-m="signup" class="${mode === 'signup' ? 'on' : ''}">Create account</button></div>` : '<div style="height:14px"></div>'}
        <form autocomplete="on">${body}
          <div class="auth-msg ${err ? 'err' : ''}"></div>
          <button class="btn primary auth-go" type="submit">${btn}</button>
        </form>
        <div class="auth-links">
          ${mode === 'login' ? '<a href="#" data-go="forgot">Forgot password?</a>' : ''}
          ${mode === 'code' ? '<a href="#" data-go="resend">Send the code again</a><a href="#" data-go="login">Back</a>' : ''}
          ${mode === 'twofa' ? '<a href="#" data-go="resend2">Send the code again</a><a href="#" data-go="login">Back</a>' : ''}
          ${mode === 'forgot' || mode === 'reset' ? '<a href="#" data-go="login">Back to sign in</a>' : ''}
        </div>
        <div class="auth-legal">${legalLinks()}</div>
        <button class="auth-quit" data-a="quit">Exit Flux</button>
      </div>`;
    $('.auth-msg', el).textContent = msg;
    wireLegal(el);
    $$('.auth-tabs button', el).forEach((b) => b.onclick = () => { mode = b.dataset.m; msg = ''; draw(); });
    $$('[data-go]', el).forEach((a) => a.onclick = async (e) => {
      e.preventDefault();
      if (a.dataset.go === 'resend2') { const r2 = await apiCall('login', { email, password: pw }); msg = r2.need2fa ? 'New code sent (you can ask once a minute).' : (r2.error || ''); err = !r2.need2fa; return draw(); }
      if (a.dataset.go === 'resend') { await apiCall('resend', { email }); msg = 'New code sent (you can ask once a minute).'; err = false; return draw(); }
      mode = a.dataset.go; msg = ''; draw();
    });
    $('[data-a=quit]', el).onclick = () => api && api.quit ? api.quit() : null;
    const f = $('form', el);
    if (f.email && email) f.email.value = email;
    wireBirth(f);
    setTimeout(() => (f.code || f.email).focus(), 30);
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (f.email) email = f.email.value.trim();
      if (mode === 'login' && f.password) pw = f.password.value;
      if (mode === 'signup' && f.password.value !== f.password2.value) { msg = 'The two passwords are not the same.'; err = true; return draw(); }
      const go = $('.auth-go', el); go.disabled = true; go.textContent = 'Please wait…';
      const payload = { email, password: f.password && f.password.value, code: f.code && f.code.value };
      if (mode === 'signup') {
        payload.terms = TERMS_VERSION; payload.username = f.username.value.trim(); payload.birthYear = +f.birthYear.value; payload.parent = !!(f.parent && f.parent.checked);
        const age = new Date().getFullYear() - payload.birthYear;
        if (!payload.birthYear) { msg = 'Please choose the year you were born.'; err = true; go.disabled = false; return draw(); }
        if (age < 13) { msg = 'Sorry, you need to be at least 13 to have a Flux account.'; err = true; return draw(); }
      }
      const path = { login: 'login', signup: 'signup', code: 'verify', forgot: 'forgot', reset: 'reset', twofa: 'login/2fa' }[mode];
      const r = await apiCall(path, payload);
      if (r.need2fa) { mode = 'twofa'; msg = ''; err = false; return draw(); }
      if (r.token) { pw = ''; return done(r, mode === 'code' ? 'Account confirmed - welcome to Flux!' : mode === 'reset' ? 'Password changed - you’re signed in' : 'Signed in as ' + (r.account.username ? '@' + r.account.username : r.account.email)); }
      if (r.needCode || (r.status === 403 && mode === 'login')) { mode = 'code'; msg = ''; err = false; return draw(); }
      if (mode === 'forgot' && !r.error) { mode = 'reset'; msg = ''; err = false; return draw(); }
      msg = r.error || 'Something went wrong. Try again.'; err = true; draw();
    };
  };
  draw();
}

/* ---------------- age + username ---------------- */
function birthField() {
  const y = new Date().getFullYear();
  let opts = '<option value="">Year</option>';
  for (let v = y - 5; v >= y - 100; v--) opts += `<option value="${v}">${v}</option>`;
  return `<label>Year you were born<select name="birthYear" class="auth-select" required>${opts}</select></label>
    <label class="auth-agree auth-parent" hidden><input type="checkbox" name="parent"> <span>I’m under 16 and my parent or guardian agrees to me using Flux</span></label>
    <div class="auth-young" hidden>Sorry - you need to be at least 13 to have a Flux account.</div>`;
}
function wireBirth(f) {
  if (!f || !f.birthYear) return;
  const sync = () => {
    const age = f.birthYear.value ? new Date().getFullYear() - +f.birthYear.value : null;
    const p = f.parent.closest('.auth-parent'), y = f.querySelector('.auth-young');
    p.hidden = !(age !== null && age >= 13 && age < 16);
    f.parent.required = !p.hidden;
    y.hidden = !(age !== null && age < 13);
  };
  f.birthYear.onchange = sync; sync();
}
// accounts made before usernames / ages: choose them once
let profileOpen = false;
function askProfile() {
  const a = settings.account;
  if (!a || !a.token || (a.username && !a.needAge) || profileOpen || document.body.classList.contains('needs-auth')) return;
  if (document.querySelector('.modal')) { setTimeout(askProfile, 3000); return; }
  profileOpen = true;
  const box = modal(`<h2>${a.username ? 'One more thing' : 'Pick your username'}</h2>
    <p class="sub">${a.username ? 'Please tell us the year you were born.' : 'Flux accounts now have usernames. Pick yours - you can change it later in Settings → Account.'}</p>
    <form class="auth-form-lite">${a.username ? '' : '<label class="field">Username<input class="num-input" name="username" maxlength="20" placeholder="e.g. alex.edits" autocomplete="username"></label>'}${a.needAge ? birthField() : ''}
    <div class="auth-msg err" style="min-height:18px"></div>
    <div class="footer"><button class="btn primary" type="submit">Save</button></div></form>`, { onClose: () => { profileOpen = false; } });
  const f = $('form', box);
  if (f.username && a.email) f.username.value = a.email.split('@')[0].replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20);
  wireBirth(f);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', f); btn.disabled = true;
    const r = await apiCall('username', { username: f.username ? f.username.value.trim() : a.username, birthYear: f.birthYear ? +f.birthYear.value : undefined, parent: !!(f.parent && f.parent.checked) }, a.token);
    btn.disabled = false;
    if (r.error) { $('.auth-msg', f).textContent = r.error; return; }
    profileOpen = false; closeModal();
    storeAccount(a.token, r.account);
    toast('Welcome, @' + r.account.username + '!');
  };
}

/* ---------------- account button + window ---------------- */
// owner only: the admin panel in its own window, already signed in
function openAdminPanel() {
  const a = settings.account;
  if (!a || !a.admin || !a.token) return;
  if (api && api.openAdmin) api.openAdmin(a.token); else window.open(ADMIN_URL);
}
function updateAccountButton() {
  const b = $('#btnAccount');
  if (!b) return;
  const a = settings.account;
  b.querySelector('span').textContent = a ? ((a.username || a.email)[0] || '?').toUpperCase() : '?';
  let im = b.querySelector('img');
  if (a && a.avatar) { if (!im) { im = document.createElement('img'); im.alt = ''; b.appendChild(im); } im.src = avatarSrc(a.avatar); } else if (im) im.remove();
  b.dataset.tip = a ? (a.username ? '@' + a.username + ' · ' : '') + a.email : 'Account';
  b.classList.toggle('pro', isPremium());
  // owner: a shield button next to the account button opens the admin panel
  let ad = $('#btnAdmin');
  if (a && a.admin) {
    if (!ad) { ad = el('button', 'icon-btn admin-btn', '<svg viewBox="0 0 24 24"><path d="M12 3 4 6v6c0 4.6 3.4 8.3 8 9 4.6-.7 8-4.4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>'); ad.id = 'btnAdmin'; ad.dataset.tip = 'Admin panel (only you can see this)'; ad.onclick = openAdminPanel; b.parentNode.insertBefore(ad, b); }
  } else if (ad) ad.remove();
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
    <div class="acct-row"><div class="acct-avatar">${(a.username || a.email)[0].toUpperCase()}</div><div><b>${a.username ? '@' + a.username.replace(/</g, '&lt;') : a.email.replace(/</g, '&lt;')}</b>${a.username ? `<small>${a.email.replace(/</g, '&lt;')}</small>` : ''}<small class="${isPremium() ? 'acct-pro' : ''}">${status}</small></div></div>
    <div class="acct-actions">
      ${isPremium() ? '' : PREMIUM_FOR_SALE ? '<button class="btn primary" data-a="buy">Get Premium - €4.99/month</button>' : '<button class="btn" data-a="buy">Premium - coming soon</button>'}
      <button class="btn" data-a="refresh">Check Premium status</button>
      <button class="btn" data-a="pw">Change password</button>
      ${a.admin ? '<button class="btn" data-a="admin">Open admin panel</button>' : ''}
    </div>
    ${a.source === 'subscription' ? '<p class="hint">To cancel your subscription, use the link in the Stripe receipt email you got after paying.</p>' : ''}
    <p class="hint acct-legal">${legalLinks()}${a.admin ? '' : ' · <a href="#" data-a="delete" class="danger-link">Delete my account</a>'}</p>
    <div class="footer"><button class="btn ghost" data-a="out">Sign out</button><button class="btn" data-a="close">Close</button></div>`);
  wireLegal(box);
  const delA = $('[data-a=delete]', box); if (delA) delA.onclick = (e) => { e.preventDefault(); deleteAccountDialog(); };
  $('[data-a=close]', box).onclick = closeModal;
  $('[data-a=out]', box).onclick = () => { closeModal(); signOut(); };
  const buy = $('[data-a=buy]', box); if (buy) buy.onclick = () => { closeModal(); openCheckout(); };
  const adm = $('[data-a=admin]', box); if (adm) adm.onclick = () => { closeModal(); openAdminPanel(); };
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
      if (r.token) { a.token = r.token; saveSettings(); }
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
  // ask once to accept the Terms / Privacy Policy (waits until no other window is open)
  const termsWatch = setInterval(() => { const a = settings.account; if (a && a.termsVersion === TERMS_VERSION) return clearInterval(termsWatch); if (!document.body.classList.contains('needs-auth')) checkTermsAccepted(); }, 4000);
  // re-check every 30 minutes and when the window comes back into focus
  setInterval(() => refreshAccount(false), 30 * 60000);
  let last = 0;
  window.addEventListener('focus', () => { if (Date.now() - last > 60000) { last = Date.now(); refreshAccount(false); } });
}

/* ---------------- delete account (GDPR) - confirmed with a code from your email ---------------- */
function deleteAccountDialog() {
  const a = settings.account; if (!a) return;
  const box = modal(`<h2>Delete your account?</h2>
    <p class="sub">This removes your Flux account (<b>${a.email.replace(/</g, '&lt;')}</b>) and everything we store about it from our server. It can’t be undone.<br>Your projects and videos on this computer are <b>not</b> touched.</p>
    <div class="del-step1"><p class="hint">To make sure it’s really you, we’ll email you a 6-digit code.</p></div>
    <label class="field del-step2" hidden>Code from the email<input class="num-input code-input" data-f="code" inputmode="numeric" maxlength="6" placeholder="000000" autocomplete="one-time-code"></label>
    <div class="auth-msg err" style="min-height:18px"></div>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn danger" data-a="yes">Email me a code</button></div>`);
  const code = $('[data-f=code]', box), msg = $('.auth-msg', box), yes = $('[data-a=yes]', box);
  let step = 1;
  $('[data-a=no]', box).onclick = closeModal;
  const go = async () => {
    msg.textContent = '';
    yes.disabled = true;
    if (step === 1) {
      yes.textContent = 'Sending…';
      const r = await apiCall('delete/start', {}, a.token);
      yes.disabled = false;
      if (r.error) { msg.textContent = r.error; yes.textContent = 'Email me a code'; return; }
      step = 2;
      $('.del-step1', box).innerHTML = `<p class="hint">We sent a code to <b>${a.email.replace(/</g, '&lt;')}</b>. Can’t see it? Check your spam folder.</p>`;
      $('.del-step2', box).hidden = false; yes.textContent = 'Delete my account forever';
      setTimeout(() => code.focus(), 30);
      return;
    }
    yes.textContent = 'Deleting…';
    const r = await apiCall('delete', { code: code.value.trim() }, a.token);
    if (r.ok) { closeModal(); signOut('Your account was deleted. Thanks for trying Flux.'); return; }
    msg.textContent = r.error || 'Something went wrong. Try again.'; yes.disabled = false; yes.textContent = 'Delete my account forever';
  };
  yes.onclick = go;
  code.onkeydown = (e) => { if (e.key === 'Enter') go(); };
}

/* ---------------- new Terms: ask signed-in users once ---------------- */
function checkTermsAccepted() {
  const a = settings.account;
  if (!a || !a.token || a.termsVersion === TERMS_VERSION || document.querySelector('.modal')) return;
  const box = modal(`<h2>Terms of Service &amp; Privacy Policy</h2>
    <p class="sub">Flux now has ${legalLinks()}. In short: Flux is free, your videos stay on your computer, we only keep your email and a hashed password for your account, and there are no ads or tracking.</p>
    <p class="hint">By continuing to use Flux you accept them. Not okay with that? You can delete your account in Account → Delete my account.</p>
    <div class="footer"><button class="btn primary" data-a="ok">I accept</button></div>`);
  wireLegal(box);
  $('[data-a=ok]', box).onclick = async () => {
    closeModal();
    a.termsVersion = TERMS_VERSION; saveSettings();
    await apiCall('terms', { version: TERMS_VERSION }, a.token);
  };
}
