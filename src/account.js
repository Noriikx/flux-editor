/* Flux — accounts: sign in with email + password. Premium comes from the account
   (monthly subscription or a gift from the owner). Stays signed in after restarts. */
'use strict';
const API_BASE = 'https://flux-editor.netlify.app/api/';
const ADMIN_URL = 'https://flux-editor.netlify.app/admin.html';
// Terms of Service + Privacy Policy. Bump TERMS_VERSION when they change in an important way:
// signed-in users are then asked once to accept the new version.
const TERMS_VERSION = '2026-10-25';
const TERMS_URL = 'https://flux-editor.netlify.app/terms.html';
const PRIVACY_URL = 'https://flux-editor.netlify.app/privacy.html';
function openLink(url) { if (api && api.openExternal) api.openExternal(url); else window.open(url); }
const legalLinks = () => `<a href="#" data-legal="terms">Terms of Service</a> and <a href="#" data-legal="privacy">Privacy Policy</a>`;
function wireLegal(root) { $$('[data-legal]', root).forEach((a) => a.onclick = (e) => { e.preventDefault(); openLink(a.dataset.legal === 'terms' ? TERMS_URL : PRIVACY_URL); }); }

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
  settings.account = { token, email: a.email, admin: !!a.admin, premium: !!a.premium, until: a.until || null, source: a.source || null, termsVersion: a.termsVersion || (settings.account && settings.account.termsVersion) || null, checkedAt: Date.now() };
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
  showAuth(typeof expired === 'string' ? expired : expired ? 'Your sign-in expired. Please sign in again.' : '');
}

/* ---------------- sign-in screen ---------------- */
function showAuth(note) {
  let el = $('#auth');
  if (!el) { el = document.createElement('section'); el.id = 'auth'; document.body.appendChild(el); }
  document.body.classList.add('needs-auth');
  let mode = 'login', email = '', msg = note || '', err = false;
  const titles = { login: ['Welcome back', 'Sign in to Flux'], signup: ['Create your account', 'Free account · no watermark'],
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
      signup: field('email', 'Email', 'email', 'autocomplete="email" placeholder="you@example.com"') + field('password', 'Password', 'password', 'minlength="8" autocomplete="new-password" placeholder="At least 8 characters"') + field('password2', 'Repeat password', 'password', 'autocomplete="new-password"') +
        `<label class="auth-agree"><input type="checkbox" name="agree" required> <span>I’m 16 or older (or my parent agrees) and I accept the ${legalLinks()}</span></label>`,
      code: field('code', 'Code', 'text', 'inputmode="numeric" maxlength="6" class="code-input" placeholder="000000" autocomplete="one-time-code"'),
      forgot: field('email', 'Email', 'email', 'autocomplete="email"'),
      reset: field('code', 'Code from the email', 'text', 'inputmode="numeric" maxlength="6" class="code-input" placeholder="000000"') + field('password', 'New password', 'password', 'minlength="8" autocomplete="new-password" placeholder="At least 8 characters"')
    }[mode];
    const btn = { login: 'Sign in', signup: 'Create account', code: 'Confirm', forgot: 'Send code', reset: 'Save new password' }[mode];
    el.innerHTML = `
      <div class="auth-card">
        <img src="logo.png" alt="" class="auth-logo">
        <h1>${h}</h1>
        <p class="sub">${sub || 'We sent a 6-digit code to <b>' + email.replace(/</g, '&lt;') + '</b>'}</p>${mode === 'code' || mode === 'reset' ? '<div class="spam-note">📩 Can\u2019t see the email? <b>Check your spam folder</b> (and Promotions).</div>' : ''}
        ${mode === 'login' || mode === 'signup' ? `<div class="auth-tabs"><button data-m="login" class="${mode === 'login' ? 'on' : ''}">Sign in</button><button data-m="signup" class="${mode === 'signup' ? 'on' : ''}">Create account</button></div>` : '<div style="height:14px"></div>'}
        <form autocomplete="on">${body}
          <div class="auth-msg ${err ? 'err' : ''}"></div>
          <button class="btn primary auth-go" type="submit">${btn}</button>
        </form>
        <div class="auth-links">
          ${mode === 'login' ? '<a href="#" data-go="forgot">Forgot password?</a>' : ''}
          ${mode === 'code' ? '<a href="#" data-go="resend">Send the code again</a><a href="#" data-go="login">Back</a>' : ''}
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
      if (mode === 'signup') payload.terms = TERMS_VERSION;
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
  // ask once to accept the Terms / Privacy Policy (waits until no other window is open)
  const termsWatch = setInterval(() => { const a = settings.account; if (a && a.termsVersion === TERMS_VERSION) return clearInterval(termsWatch); if (!document.body.classList.contains('needs-auth')) checkTermsAccepted(); }, 4000);
  // re-check every 30 minutes and when the window comes back into focus
  setInterval(() => refreshAccount(false), 30 * 60000);
  let last = 0;
  window.addEventListener('focus', () => { if (Date.now() - last > 60000) { last = Date.now(); refreshAccount(false); } });
}

/* ---------------- delete account (GDPR) ---------------- */
function deleteAccountDialog() {
  const a = settings.account; if (!a) return;
  const box = modal(`<h2>Delete your account?</h2>
    <p class="sub">This removes your Flux account (<b>${a.email.replace(/</g, '&lt;')}</b>) and everything we store about it from our server. It can’t be undone.<br>Your projects and videos on this computer are <b>not</b> touched.</p>
    <label class="field">Type your password to confirm<input type="password" class="num-input" data-f="pw" autocomplete="current-password"></label>
    <div class="auth-msg err" style="min-height:18px"></div>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn danger" data-a="yes">Delete my account</button></div>`);
  const pw = $('[data-f=pw]', box), msg = $('.auth-msg', box), yes = $('[data-a=yes]', box);
  setTimeout(() => pw.focus(), 30);
  $('[data-a=no]', box).onclick = closeModal;
  const go = async () => {
    yes.disabled = true; yes.textContent = 'Deleting…';
    const r = await apiCall('delete', { password: pw.value }, a.token);
    if (r.ok) { closeModal(); signOut('Your account was deleted. Thanks for trying Flux.'); return; }
    msg.textContent = r.error || 'Something went wrong. Try again.'; yes.disabled = false; yes.textContent = 'Delete my account';
  };
  yes.onclick = go;
  pw.onkeydown = (e) => { if (e.key === 'Enter') go(); };
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
