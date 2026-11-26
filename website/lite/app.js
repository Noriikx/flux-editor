'use strict';
/* Flux Mobile: account, friends + profiles, achievements, templates, Viral Shorts, auto captions,
   motion and transitions. Loaded after the editor (index.html) and shared.js (code shared with the desktop app). */
const API_BASE = location.hostname === 'flux-editor.netlify.app' ? '/api/' : 'https://flux-editor.netlify.app/api/';
const SITE = 'https://flux-editor.netlify.app';
const APP_VERSION = '7.4.0';
const TERMS_VERSION = '2026-11-24';
const TF_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const isPhone = matchMedia('(pointer: coarse)').matches;
// tells the Flux server this is Flux Mobile (and which kind of phone), so it shows up in the admin panel
const MOBILE_OS = window.FluxNative ? 'android-app' : /android/i.test(navigator.userAgent) ? 'android' : /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) ? 'ios' : 'web';
const ico = (d, c = 'i') => `<svg class="${c}" viewBox="0 0 24 24">${d}</svg>`;

/* ============================ account ============================ */
let acct = null;
try { acct = JSON.parse(localStorage.getItem('flux.account') || 'null'); } catch {}
const signedIn = () => !!(acct && acct.token);
const hasPremium = () => !!(acct && acct.token && acct.premium && (!acct.until || acct.until > Date.now()));
function storeAccount(token, a) {
  acct = { token, email: a.email, username: a.username || null, uid: a.uid || null, avatar: a.avatar || null, badges: a.badges || [], privacy: a.privacy || {}, twoFactor: !!a.twoFactor, premium: !!a.premium, until: a.until || null, source: a.source || null, needAge: !!a.needAge };
  try { localStorage.setItem('flux.account', JSON.stringify(acct)); } catch {}
  updateNavMe();
}
function signOut(msg) {
  acct = null; socialCounts = null;
  try { localStorage.removeItem('flux.account'); } catch {}
  updateNavMe(); if (msg) toast(msg);
  if (curPage !== 'create' && curPage !== 'templates') renderPage(curPage);
}
async function api(path, body) {
  const headers = { 'content-type': 'application/json', 'x-flux-version': APP_VERSION, 'x-flux-os': MOBILE_OS };
  if (acct && acct.token) headers.authorization = 'Bearer ' + acct.token;
  let r;
  try { r = await fetch(API_BASE + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { return { offline: true, error: 'No internet connection. Check it and try again.' }; }
  const j = await r.json().catch(() => ({}));
  if (r.status === 429) return { status: 429, error: j.error || 'Too many tries. Please wait a few minutes and try again.' };
  if (r.status === 401 && headers.authorization) { signOut('Please sign in again'); return { status: 401, error: j.error || 'Please sign in again.' }; }
  if (!r.ok) return { status: r.status, error: j.error || 'Something went wrong. Try again.', banned: !!j.banned };
  return j;
}
const avatarSrc = (p) => (p ? (/^https?:|^data:/.test(p) ? p : SITE + p) : '');
function avatarHtml(u, size = 40) {
  const name = (u && u.username) || '?', src = u && u.avatar ? avatarSrc(u.avatar) : '';
  return `<span class="fx-av" style="--s:${size}px">${src ? `<img src="${esc(src)}" alt="">` : esc(name[0].toUpperCase())}</span>`;
}
function badgesHtml(list, big) {
  return (list || []).filter((b) => BADGE_INFO[b]).map((b) => { const x = BADGE_INFO[b]; return `<span class="fx-badge${big ? ' big' : ''}" style="--bc:${x.color}" title="${esc(x.name + ' - ' + x.desc)}"><svg viewBox="0 0 24 24">${x.icon}</svg>${big ? `<b>${esc(x.name)}</b>` : ''}</span>`; }).join('');
}
function updateNavMe() {
  const b = $('#navMe'); if (!b) return;
  b.querySelector('svg, .fx-av').outerHTML = signedIn() ? avatarHtml(acct, 24) : ico('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>');
}
function sheet(html) {
  const b = $('#sheetBody'); b.innerHTML = html;
  $('#sheet').classList.add('on'); $('#sheetBg').classList.add('on'); $('#sheet').scrollTop = 0;
  return b;
}

/* ---------- sign in / create account ---------- */
function birthOptions() { const y = new Date().getFullYear(); let o = '<option value="">Year</option>'; for (let v = y - 5; v >= y - 100; v--) o += `<option value="${v}">${v}</option>`; return o; }
function showAuth(mode = 'login', then) {
  let email = '', pw = '', msg = '', ok = false;
  const draw = () => {
    const head = { login: ['Sign in', 'Welcome back to Flux.'], signup: ['Create your account', 'Free. Your account works on your phone and in the Windows / Mac app.'], code: ['Check your email', 'We sent a 6-digit code to <b>' + esc(email) + '</b>. Can’t see it? Check your spam folder.'], twofa: ['2-step verification', 'We sent a 6-digit code to <b>' + esc(email) + '</b>. Can’t see it? Check your spam folder.'], forgot: ['Forgot your password?', 'Enter your email and we’ll send you a code to make a new password.'], reset: ['Make a new password', 'Enter the code we emailed you and your new password.'] }[mode];
    let f = '';
    if (mode === 'login' || mode === 'signup' || mode === 'forgot') f += `<label class="field">Email<input name="email" type="email" autocomplete="email" required></label>`;
    if (mode === 'signup') f += `<label class="field">Username<input name="username" autocomplete="username" maxlength="20" required placeholder="letters, numbers, _ and ."></label>`;
    if (mode === 'login') f += `<label class="field">Password<input name="password" type="password" autocomplete="current-password" required></label>`;
    if (mode === 'signup') f += `<label class="field">Password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label class="field">Password again<input name="password2" type="password" autocomplete="new-password" required></label>
      <label class="field">Year you were born<select name="birthYear" required>${birthOptions()}</select></label>
      <label class="check" data-parent hidden><input type="checkbox" name="parent"><span>I’m under 16 and my parent or guardian agrees to me using Flux</span></label>
      <label class="check"><input type="checkbox" name="agree" required><span>I agree to the <a href="/terms.html" target="_blank">Terms</a> and <a href="/privacy.html" target="_blank">Privacy Policy</a></span></label>`;
    if (mode === 'code' || mode === 'twofa' || mode === 'reset') f += `<label class="field">6-digit code<input name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required placeholder="000000"></label>`;
    if (mode === 'reset') f += `<label class="field">New password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label>`;
    const tabs = mode === 'login' || mode === 'signup' ? `<div class="tabs2"><button type="button" data-m="login" class="${mode === 'login' ? 'on' : ''}">Sign in</button><button type="button" data-m="signup" class="${mode === 'signup' ? 'on' : ''}">Create account</button></div>` : '';
    const links = mode === 'login' ? '<a href="#" class="linkbtn" data-go="forgot">Forgot password?</a>' : mode === 'code' ? '<a href="#" class="linkbtn" data-go="resend">Send a new code</a>' : mode === 'twofa' ? '<a href="#" class="linkbtn" data-go="resend2">Send a new code</a>' : mode !== 'signup' ? '<a href="#" class="linkbtn" data-go="login">Back to sign in</a>' : '';
    const b = sheet(`${tabs}<h3>${head[0]}</h3><p class="hint" style="margin-top:-8px">${head[1]}</p><form novalidate>${f}<p class="err-msg${ok ? ' ok-msg' : ''}">${esc(msg)}</p><button class="btn gold wide" type="submit">${{ login: 'Sign in', signup: 'Create account', code: 'Confirm', twofa: 'Sign in', forgot: 'Send code', reset: 'Save password' }[mode]}</button></form><div class="links">${links}<span></span></div>`);
    const form = $('form', b);
    if (form.email) form.email.value = email;
    if (form.birthYear) form.birthYear.onchange = () => { const age = new Date().getFullYear() - +form.birthYear.value; $('[data-parent]', b).hidden = !(form.birthYear.value && age >= 13 && age < 16); };
    $$('[data-m]', b).forEach((x) => (x.onclick = () => { mode = x.dataset.m; msg = ''; draw(); }));
    $$('[data-go]', b).forEach((x) => (x.onclick = async (e) => {
      e.preventDefault();
      if (x.dataset.go === 'resend') { const r = await api('resend', { email }); msg = r.error || 'New code sent (you can ask once a minute).'; ok = !r.error; return draw(); }
      if (x.dataset.go === 'resend2') { const r = await api('login', { email, password: pw }); msg = r.need2fa ? 'New code sent (you can ask once a minute).' : r.error || ''; ok = !!r.need2fa; return draw(); }
      mode = x.dataset.go; msg = ''; draw();
    }));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const go = $('button[type=submit]', form);
      if (form.email) email = form.email.value.trim();
      if (mode === 'login') pw = form.password.value;
      const bad = (m) => { msg = m; ok = false; draw(); };
      if (form.email && !/^\S+@\S+\.\S+$/.test(email)) return bad('Please enter your email.');
      const payload = { email, password: form.password ? form.password.value : undefined, code: form.code ? form.code.value.trim() : undefined };
      if (mode === 'signup') {
        if (!form.username.value.trim()) return bad('Please choose a username.');
        if (form.password.value.length < 8) return bad('Your password needs at least 8 characters.');
        if (form.password.value !== form.password2.value) return bad('The two passwords are not the same.');
        if (!form.birthYear.value) return bad('Please choose the year you were born.');
        const age = new Date().getFullYear() - +form.birthYear.value;
        if (age < 13) return bad('Sorry, you need to be at least 13 to have a Flux account.');
        if (age < 16 && !form.parent.checked) return bad('Please ask a parent or guardian, then tick the box.');
        if (!form.agree.checked) return bad('Please agree to the Terms and Privacy Policy.');
        Object.assign(payload, { username: form.username.value.trim(), birthYear: +form.birthYear.value, parent: !!form.parent.checked, terms: TERMS_VERSION });
      }
      if ((mode === 'code' || mode === 'twofa' || mode === 'reset') && !/^\d{6}$/.test(payload.code || '')) return bad('Enter the 6-digit code from the email.');
      go.disabled = true; go.textContent = 'Please wait…';
      const r = await api({ login: 'login', signup: 'signup', code: 'verify', forgot: 'forgot', reset: 'reset', twofa: 'login/2fa' }[mode], payload);
      if (r.need2fa) { mode = 'twofa'; msg = ''; return draw(); }
      if (r.token) {
        storeAccount(r.token, r.account); closeSheet(); markActive();
        toast(mode === 'code' ? 'Account confirmed - welcome to Flux!' : mode === 'reset' ? 'Password changed - you’re signed in' : 'Signed in as ' + (r.account.username ? '@' + r.account.username : r.account.email));
        if (!acct.username || acct.needAge) setTimeout(askUsername, 400);
        refreshMe(); checkRequests();
        return then ? then() : renderPage(curPage);
      }
      if (r.needCode || (r.status === 403 && mode === 'login')) { mode = 'code'; msg = ''; return draw(); }
      if (mode === 'forgot' && !r.error) { mode = 'reset'; msg = ''; return draw(); }
      bad(r.error || 'Something went wrong. Try again.');
    };
  };
  draw();
}
function askUsername() {
  const b = sheet(`<h3>Pick your username</h3><p class="hint" style="margin-top:-8px">This is how friends find you. Letters, numbers, _ and . (3 to 20).</p><form>
    ${acct.username ? '' : '<label class="field">Username<input name="username" maxlength="20" required></label>'}
    ${acct.needAge ? `<label class="field">Year you were born<select name="birthYear" required>${birthOptions()}</select></label><label class="check" data-parent hidden><input type="checkbox" name="parent"><span>I’m under 16 and my parent or guardian agrees to me using Flux</span></label>` : ''}
    <p class="err-msg"></p><button class="btn gold wide">Save</button></form>`);
  const f = $('form', b);
  if (f.username && acct.email) f.username.value = acct.email.split('@')[0].replace(/[^A-Za-z0-9_.]/g, '').slice(0, 20);
  if (f.birthYear) f.birthYear.onchange = () => { const age = new Date().getFullYear() - +f.birthYear.value; $('[data-parent]', b).hidden = !(f.birthYear.value && age >= 13 && age < 16); };
  f.onsubmit = async (e) => {
    e.preventDefault();
    const r = await api('username', { username: f.username ? f.username.value.trim() : acct.username, birthYear: f.birthYear ? +f.birthYear.value : undefined, parent: !!(f.parent && f.parent.checked) });
    if (r.error) { $('.err-msg', f).textContent = r.error; return; }
    storeAccount(acct.token, r.account); closeSheet(); toast('Welcome, @' + r.account.username + '!'); renderPage(curPage);
  };
}
async function refreshMe() {
  if (!signedIn()) return;
  const r = await api('me');
  if (r.account && acct) { storeAccount(acct.token, r.account); if (curPage === 'me' || curPage === 'shorts') renderPage(curPage); }
}
function needSignIn(page, what) {
  page.innerHTML = `<h1 class="ph1">${what[0]}</h1><p class="sub2">${what[1]}</p>
    <div class="card"><p class="muted" style="margin:0 0 14px">Sign in with your Flux account - the same one you use in the Windows / Mac app.</p>
    <div style="display:flex;gap:10px"><button class="btn gold" style="flex:1" data-a="in">Sign in</button><button class="btn" style="flex:1" data-a="up">Create account</button></div></div>`;
  $('[data-a=in]', page).onclick = () => showAuth('login');
  $('[data-a=up]', page).onclick = () => showAuth('signup');
}

/* ============================ pages + bottom bar ============================ */
let curPage = 'create';
function go(p) {
  curPage = p;
  $$('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.p === p));
  $$('#home .page').forEach((x) => x.classList.toggle('on', x.dataset.p === p));
  renderPage(p);
  const pg = $(`#home .page[data-p=${p}]`); if (pg) pg.scrollTop = 0;
}
function renderPage(p) {
  const page = $(`#home .page[data-p=${p}]`); if (!page) return;
  if (p === 'create') return renderHome();
  if (p === 'templates') return renderTemplates(page);
  if (p === 'shorts') return renderShorts(page);
  if (p === 'friends') return renderFriends(page);
  if (p === 'me') return renderMe(page);
}
$('#nav').onclick = (e) => { const b = e.target.closest('button'); if (b) go(b.dataset.p); };

/* ============================ me: profile, settings, stats, achievements ============================ */
let socialCounts = null;
const DESKTOP_ONLY = new Set(['smartExports', 'transitions', 'keyframes', 'reversed', 'freezes', 'voiceovers', '#themes', 'bugReports', 'ideas', 'tplShared']);
function statValue(k) {
  const s = fluxStats, st = streaks();
  switch (k) {
    case '#days': return st.days;
    case '#streak': return st.best;
    case '#weekend': return (s.sat ? 1 : 0) + (s.sun ? 1 : 0);
    case '#themes': return 0;
    case '#friends': return socialCounts ? socialCounts.friends : s.friendsSeen || 0;
    case '#followers': return socialCounts ? socialCounts.followers : s.followersSeen || 0;
    case '#avatar': return acct && acct.avatar ? 1 : 0;
    case '#twofa': return acct && acct.twoFactor ? 1 : 0;
    default: return s[k] || 0;
  }
}
function renderMe(page) {
  const st = streaks(), s = fluxStats;
  let top;
  if (signedIn()) {
    const a = acct;
    const plan = a.premium ? '<span class="pro">Premium</span>' : 'Free plan · Premium coming soon';
    top = `<div class="me-top">${avatarHtml(a, 72)}<div style="min-width:0"><h1>@${esc(a.username || 'no username yet')}</h1><small>${esc(a.email || '')} · only you can see this</small><small>${plan}</small></div></div>
      ${a.badges && a.badges.length ? `<div class="me-badges">${badgesHtml(a.badges, true)}</div>` : ''}
      <div class="sec-h"><h2>Account</h2></div>
      <div class="card" style="padding:2px 16px">
        <div class="set-row"><div><b>Profile picture</b><small>A square picture others see next to your username.</small></div><button class="btn sm" data-a="pic">${a.avatar ? 'Change' : 'Add'}</button>${a.avatar ? '<button class="btn sm ghost red" data-a="rmpic">Remove</button>' : ''}</div>
        <div class="set-row"><div><b>2-step verification</b><small>After your password, Flux also asks for a code we email you.</small></div><label class="switch"><input type="checkbox" data-a="2fa" ${a.twoFactor ? 'checked' : ''}><i></i></label></div>
        <div class="set-row"><div><b>Friend requests</b><small>Let anyone send you friend requests.</small></div><label class="switch"><input type="checkbox" data-a="req" ${(a.privacy || {}).requests !== 'off' ? 'checked' : ''}><i></i></label></div>
        <div class="set-row"><div><b>Private account</b><small>Only friends see your friends and followers, and only friends can follow you.</small></div><label class="switch"><input type="checkbox" data-a="priv" ${(a.privacy || {}).private ? 'checked' : ''}><i></i></label></div>
        <div class="set-row"><div><b>My profile</b><small>See your profile the way others see it.</small></div><button class="btn sm" data-a="prof">Open</button></div>
      </div>`;
  } else {
    top = `<h1 class="ph1">You</h1><p class="sub2">Sign in to add friends, get badges and keep your profile.</p>
      <div class="card"><div style="display:flex;gap:10px"><button class="btn gold" style="flex:1" data-a="in">Sign in</button><button class="btn" style="flex:1" data-a="up">Create account</button></div></div>`;
  }
  const doneN = ACH.filter((x) => statValue(x[3]) >= x[4]).length;
  const achHtml = ACH.map(([id, name, desc, key, target, icon]) => {
    const v = statValue(key), done = v >= target, pc = Math.min(100, (v / target) * 100);
    return `<div class="ach${done ? ' done' : ''}" data-id="${id}"><span class="ic"><svg viewBox="0 0 24 24">${ACH_ICONS[icon] || ACH_ICONS.spark}</svg></span><div><b>${esc(name)}</b><small>${esc(desc)}${DESKTOP_ONLY.has(key) ? ' · Windows / Mac app' : ''}</small>${done ? '' : `<div class="bar"><i style="width:${pc}%"></i></div>`}</div><small class="n">${done ? '✓' : Math.min(v, target) + '/' + target}</small></div>`;
  }).join('');
  page.innerHTML = `${top}
    <div class="sec-h"><h2>Your stats</h2><small>on this device</small></div>
    <div class="stats">
      <div class="stat"><b>${s.exports || 0}</b><small>videos exported</small></div>
      <div class="stat"><b>${s.projects || 0}</b><small>projects</small></div>
      <div class="stat"><b>${s.shorts || 0}</b><small>Shorts made</small></div>
      <div class="stat"><b>${Math.round((s.exportSecs || 0) / 60)}</b><small>minutes exported</small></div>
      <div class="stat"><b>${st.live}</b><small>day streak</small></div>
      <div class="stat"><b>${st.days}</b><small>days on Flux</small></div>
    </div>
    <div class="sec-h"><h2>Achievements</h2><small>${doneN} / ${ACH.length}</small></div>
    ${achHtml}
    <div class="sec-h"><h2>More</h2></div>
    <div class="card" style="padding:2px 16px">
      <div class="set-row"><div><b>Flux for Windows and Mac</b><small>80+ transitions, effects, YouTube and Twitch links for Viral Shorts.</small></div><a class="btn sm" href="/#download">Get it</a></div>
      <div class="set-row"><div><b>Privacy and terms</b><small>How Flux keeps your stuff safe.</small></div><a class="btn sm ghost" href="/privacy.html">Privacy</a><a class="btn sm ghost" href="/terms.html">Terms</a></div>
      ${signedIn() ? '<div class="set-row"><div><b>Sign out</b><small>Your projects stay on this device.</small></div><button class="btn sm red" data-a="out">Sign out</button></div>' : ''}
    </div>
    <p class="hint" style="text-align:center;margin-top:18px">Flux Mobile ${esc(displayVerM(APP_VERSION))}</p>`;
  const on = (k, fn) => { const el = $(`[data-a="${k}"]`, page); if (el) el[el.tagName === 'INPUT' ? 'onchange' : 'onclick'] = fn; };
  on('in', () => showAuth('login')); on('up', () => showAuth('signup'));
  on('out', () => { if (confirm('Sign out of Flux on this device?')) { signOut('Signed out'); renderMe(page); } });
  on('prof', () => openProfile(acct.username));
  on('pic', () => pickAvatar(() => renderMe(page)));
  on('rmpic', async () => { const r = await api('profile/avatar', { remove: true }); if (r.error) return toast(r.error); storeAccount(acct.token, r.account); renderMe(page); });
  const priv = async (patch, inp) => { inp.disabled = true; const r = await api('profile/privacy', patch); inp.disabled = false; if (r.error) { inp.checked = !inp.checked; return toast(r.error); } storeAccount(acct.token, r.account); toast('Saved'); };
  on('req', (e) => priv({ requests: e.target.checked ? 'everyone' : 'off' }, e.target));
  on('priv', (e) => priv({ private: e.target.checked }, e.target));
  on('2fa', (e) => { const want = e.target.checked; e.target.checked = !want; twoStep(want, () => renderMe(page)); });
}
function displayVerM(v) { const [a, b, c] = String(v).split('.').map(Number); return '1.' + a + (b ? '.' + b : '') + (c ? '.' + c : ''); }
function twoStep(want, done) {
  const b = sheet(`<h3>${want ? 'Turn on' : 'Turn off'} 2-step verification</h3><p class="hint sub3" style="margin-top:-8px">${want ? 'Enter your password. Then we email you a code to make sure your email works.' : 'Enter your password to turn it off.'}</p>
    <label class="field" data-pw>Password<input type="password" autocomplete="current-password"></label><label class="field" data-code hidden>Code from the email<input inputmode="numeric" maxlength="6" placeholder="000000"></label>
    <p class="err-msg"></p><button class="btn gold wide" data-a="ok">${want ? 'Send code' : 'Turn off'}</button>`);
  const pw = $('[data-pw] input', b), code = $('[data-code] input', b), ok = $('[data-a=ok]', b), m = $('.err-msg', b);
  ok.onclick = async () => {
    ok.disabled = true; m.textContent = '';
    const r = await api('2fa', { on: want, password: pw.value, code: $('[data-code]', b).hidden ? undefined : code.value.trim() });
    ok.disabled = false;
    if (r.error) { m.textContent = r.error; return; }
    if (r.needCode) { $('[data-code]', b).hidden = false; $('[data-pw]', b).hidden = true; ok.textContent = 'Turn on'; $('.sub3', b).textContent = (r.message || 'We emailed you a code.') + ' Check your spam folder too.'; return; }
    storeAccount(acct.token, r.account); closeSheet(); toast(want ? '2-step verification is on' : '2-step verification is off'); done && done();
  };
}
function pickAvatar(done) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (f.size > 25 * 1024 * 1024) return toast('That picture is too big');
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
      const s = Math.min(img.naturalWidth, img.naturalHeight), x = c.getContext('2d');
      x.fillStyle = '#111'; x.fillRect(0, 0, S, S);
      x.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, S, S);
      let q = 0.86, data = c.toDataURL('image/jpeg', q);
      while (data.length > 85000 && q > 0.4) { q -= 0.12; data = c.toDataURL('image/jpeg', q); }
      toast('Uploading…');
      const r = await api('profile/avatar', { image: data });
      if (r.error) return toast(r.error);
      storeAccount(acct.token, r.account); bump('avatarSet'); toast('Profile picture updated'); done && done();
    };
    img.onerror = () => toast('Couldn’t open that picture');
    img.src = url;
  };
  inp.click();
}

/* ============================ friends + profiles ============================ */
async function renderFriends(page) {
  if (!signedIn()) return needSignIn(page, ['Friends', 'Add friends, follow creators and see their badges.']);
  if (!acct.username) { page.innerHTML = '<h1 class="ph1">Friends</h1><p class="sub2">Pick a username first so friends can find you.</p><button class="btn gold" data-a="u">Pick username</button>'; $('[data-a=u]', page).onclick = askUsername; return; }
  page.innerHTML = `<h1 class="ph1">Friends</h1><p class="sub2">Find people by their username.</p>
    <div class="search">${ico('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>')}<input type="search" placeholder="Search @username" autocomplete="off" autocapitalize="off"></div>
    <div class="fr-results card" hidden style="margin-top:10px;padding:4px 14px"></div>
    <div class="fr-body"><div class="busy" style="margin-top:20px"><i class="spin"></i>Loading…</div></div>`;
  const inp = $('.search input', page), res = $('.fr-results', page);
  let tmr = null;
  inp.oninput = () => {
    clearTimeout(tmr);
    const q = inp.value.trim().replace(/^@/, '');
    if (q.length < 2) { res.hidden = true; res.innerHTML = ''; return; }
    tmr = setTimeout(async () => {
      const r = await api('users/search?q=' + encodeURIComponent(q));
      if (inp.value.trim().replace(/^@/, '') !== q) return;
      res.hidden = false; res.innerHTML = '';
      if (r.error) { res.innerHTML = `<p class="empty2">${esc(r.error)}</p>`; return; }
      if (!r.users.length) { res.innerHTML = '<p class="empty2">No one with that username.</p>'; return; }
      r.users.forEach((u) => res.appendChild(userRow(u, [])));
    }, 300);
  };
  const r = await api('social');
  if (!page.isConnected || curPage !== 'friends') return;
  const body = $('.fr-body', page);
  if (r.error) { body.innerHTML = `<p class="empty2" style="margin-top:20px">${esc(r.error)}</p>`; return; }
  socialCounts = { friends: r.friends.length, followers: r.followers.length };
  fluxStats.friendsSeen = r.friends.length; fluxStats.followersSeen = r.followers.length; saveStats();
  $('#nav .dot').hidden = !r.requestsIn.length;
  body.innerHTML = '';
  const act = async (path, u, done) => { const x = await api(path, { uid: u.uid }); if (x.error) return toast(x.error); if (done) toast(done); renderFriends(page); };
  const sec = (title, list, actions, empty) => {
    if (!list.length && !empty) return;
    const s = document.createElement('div');
    s.innerHTML = `<div class="sec-h"><h2>${title}</h2><small>${list.length || ''}</small></div><div class="card" style="padding:4px 14px"></div>`;
    const box = $('.card', s);
    if (!list.length) box.innerHTML = `<p class="empty2">${empty}</p>`;
    list.forEach((u) => box.appendChild(userRow(u, actions)));
    body.appendChild(s);
  };
  sec('Friend requests', r.requestsIn, [['Accept', (u) => act('friends/accept', u, 'You and @' + u.username + ' are now friends'), 'gold'], ['Decline', (u) => act('friends/decline', u)]]);
  sec('Friends', r.friends, [], 'No friends yet - search for a username above.');
  sec('Following', r.following, [['Unfollow', (u) => act('unfollow', u)]], 'You don’t follow anyone yet.');
  sec('Followers', r.followers, [], 'No followers yet.');
  sec('Requests you sent', r.requestsOut, [['Cancel', (u) => act('friends/cancel', u)]]);
}
function userRow(u, actions) {
  const row = document.createElement('div'); row.className = 'fr-row';
  row.innerHTML = `${avatarHtml(u, 40)}<span class="fr-name"><b>@${esc(u.username)}</b><span>${badgesHtml(u.badges)}</span></span><span class="fr-acts"></span>`;
  row.onclick = () => openProfile(u.username);
  for (const [label, fn, cls] of actions) { const b = document.createElement('button'); b.className = 'btn sm ' + (cls || ''); b.textContent = label; b.onclick = (e) => { e.stopPropagation(); fn(u); }; $('.fr-acts', row).appendChild(b); }
  return row;
}
async function openProfile(username) {
  if (!signedIn()) return showAuth('login');
  const r = await api('profile?u=' + encodeURIComponent(username));
  if (r.error) return toast(r.error);
  const draw = (p) => {
    const rel = p.relation || {};
    const joined = p.joined ? new Date(p.joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '';
    const b = sheet(`<div class="prof">${avatarHtml(p, 92)}<h3>@${esc(p.username)}</h3>${joined ? `<small class="muted">On Flux since ${esc(joined)}</small>` : ''}
      <div class="badges">${badgesHtml(p.badges, true)}</div>
      ${p.friends !== undefined ? `<div class="counts"><span><b>${p.friends}</b>friends</span><span><b>${p.followers}</b>followers</span><span><b>${p.following}</b>following</span></div>` : '<p class="muted" style="margin:16px 0">🔒 This account is private</p>'}
      <div class="acts2"></div></div>`);
    const acts = $('.acts2', b);
    const doIt = async (path, okMsg) => { const x = await api(path, { uid: p.uid }); if (x.error) return toast(x.error); if (okMsg) toast(okMsg); if (x.profile) draw(x.profile); else openProfile(p.username); if (curPage === 'friends') renderFriends($('#home .page[data-p=friends]')); };
    const btn = (label, cls, fn) => { const x = document.createElement('button'); x.className = 'btn ' + cls; x.textContent = label; x.onclick = fn; acts.appendChild(x); };
    if (p.me) { btn('Edit profile', 'gold', () => { closeSheet(); go('me'); }); return; }
    if (rel.friend) btn('✓ Friends · Remove', '', () => { if (confirm('Remove @' + p.username + ' from your friends?')) doIt('friends/remove'); });
    else if (rel.requestedYou) { btn('Accept friend request', 'gold', () => doIt('friends/accept', 'You and @' + p.username + ' are now friends')); btn('Decline', '', () => doIt('friends/decline')); }
    else if (rel.requested) btn('Request sent · Cancel', '', () => doIt('friends/cancel'));
    else if (!p.requestsOff) btn('Add friend', 'gold', () => doIt('friends/request', 'Friend request sent to @' + p.username));
    if (rel.following) btn('Following', '', () => doIt('unfollow'));
    else if (!p.private || rel.friend) btn('Follow', rel.friend || p.requestsOff ? 'gold' : '', () => doIt('follow', 'You follow @' + p.username));
    if (p.requestsOff && !rel.friend && !rel.requestedYou) acts.insertAdjacentHTML('beforeend', '<small class="muted" style="width:100%">Not accepting friend requests</small>');
  };
  draw(r.profile);
}
async function checkRequests() {
  if (!signedIn() || !acct.username) return;
  const r = await api('social');
  if (r.requestsIn) { $('#nav .dot').hidden = !r.requestsIn.length; socialCounts = { friends: r.friends.length, followers: r.followers.length }; }
}

/* ============================ templates ============================ */
const TPL_FILTER = { film400: 'film', vivid: 'vivid', goldenhour: 'gold', cyber: 'cool', matte: 'fade', dreamy: 'dream', tealorange: 'warm', bw: 'bw', noir: 'noir', punch: 'punch', warm: 'warm', cool: 'cool' };
const TPL_TRANS = { fade: 'dip', black: 'dip', white: 'flash', flash: 'flash', zoom: 'zoom', slide: 'zoom', none: 'none' };
let communityTpls = null, communityAt = 0;
async function loadCommunity() {
  if (communityTpls && Date.now() - communityAt < 120000) return communityTpls;
  try {
    const j = await (await fetch(API_BASE + 'templates')).json();
    communityTpls = (j.items || []).filter((x) => x.tpl && Array.isArray(x.tpl.slots)).map((x) => ({ ...x.tpl, id: 'c-' + x.id, name: x.name, desc: x.desc, by: x.by, sub: (x.tpl.aspect || '16:9') + ' · by @' + x.by, community: true }));
    communityAt = Date.now();
  } catch {}
  return communityTpls;
}
function tplCard(tp) {
  const c = document.createElement('button'); c.className = 'tcard';
  c.innerHTML = `<div class="cvw"></div><div class="m"><b>${esc(tp.name)}</b><small>${esc(tp.sub || tp.aspect)} · ${tp.slots.length} clips · ${Math.round(tplTotal(tp))}s</small></div>`;
  const cv2 = tplCanvas(tp, 360);
  try { drawTemplateFrame(cv2, tp, Math.min(tplTotal(tp) - 0.1, (tp.texts && tp.texts[0] ? tp.texts[0].t + 0.9 : 1))); } catch {}
  $('.cvw', c).appendChild(cv2);
  c.onclick = () => previewTemplate(tp);
  return c;
}
async function renderTemplates(page) {
  page.innerHTML = `<h1 class="ph1">Templates</h1><p class="sub2">Pick a style, choose your clips, and Flux builds the edit for you.</p>
    <div class="tgrid" data-g="b"></div><div class="sec-h"><h2>From the community</h2><small></small></div><div class="tgrid" data-g="c"><p class="empty" style="grid-column:1/-1">Loading…</p></div>
    <p class="hint" style="margin-top:14px">Want to share your own template? Make it in the Windows / Mac app (Templates → Share).</p>`;
  const gb = $('[data-g=b]', page); TEMPLATES.forEach((tp) => gb.appendChild(tplCard(tp)));
  const list = await loadCommunity();
  if (!page.isConnected || curPage !== 'templates') return;
  const gc = $('[data-g=c]', page); gc.innerHTML = '';
  if (!list) gc.innerHTML = '<p class="empty">Couldn’t load community templates. Check your internet.</p>';
  else if (!list.length) gc.innerHTML = '<p class="empty">No community templates yet.</p>';
  else list.forEach((tp) => gc.appendChild(tplCard(tp)));
}
let tplRaf = 0;
function previewTemplate(tp) {
  const b = sheet(`<div class="tprev"></div><h3 style="margin:14px 0 2px">${esc(tp.name)}</h3><p class="hint">${esc(tp.desc || tp.sub || '')} · ${tp.slots.length} clips · ${Math.round(tplTotal(tp))} seconds</p>
    <p class="hint">Choose up to ${tp.slots.length} videos or photos - Flux cuts them to the beat of the template and adds the text and color.</p>
    <div class="acts"><button class="btn" data-a="x">Close</button><button class="btn gold" data-a="use">Use template</button></div>`);
  const cv2 = tplCanvas(tp, 720); $('.tprev', b).appendChild(cv2);
  const T = tplTotal(tp), t0 = performance.now();
  cancelAnimationFrame(tplRaf);
  const loop = (now) => { if (!cv2.isConnected || !$('#sheet').classList.contains('on')) return; try { drawTemplateFrame(cv2, tp, ((now - t0) / 1000) % T); } catch {} tplRaf = requestAnimationFrame(loop); };
  tplRaf = requestAnimationFrame(loop);
  $('[data-a=x]', b).onclick = closeSheet;
  $('[data-a=use]', b).onclick = () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/*,image/*'; inp.multiple = true;
    inp.onchange = () => { const files = [...inp.files]; if (files.length) buildFromTemplate(tp, files); };
    inp.click();
  };
}
async function buildFromTemplate(tp, files) {
  closeSheet(); toast('Building your video…', 6000);
  const [W, H] = SIZES[tp.aspect] || SIZES['16:9'];
  const loaded = [];
  for (const f of files.slice(0, Math.max(tp.slots.length, 1) + 10)) {
    if (f.size > 1.5e9) continue;
    const id = uid(); await putFile(id, f);
    const m = await loadMedia(id); if (m && m.kind !== 'audio') loaded.push({ id, m, name: f.name });
  }
  if (!loaded.length) return toast('Couldn’t read those files');
  const filter = TPL_FILTER[tp.filter] || 'none', clips = [];
  tp.slots.forEach((slot, i) => {
    const src = loaded[i % loaded.length], isImg = src.m.kind === 'image';
    // reuse a video more than once? take a different part of it each time
    const round = Math.floor(i / loaded.length), start = isImg ? 0 : Math.min(Math.max(0, src.m.dur - slot), round * slot);
    clips.push({ id: uid(), file: src.id, kind: src.m.kind, name: src.name, in: start, out: isImg ? slot : Math.min(src.m.dur, start + slot), speed: 1, volume: 1, filter, motion: (tp.motion && tp.motion[i]) || 'none' });
  });
  loaded.slice(tp.slots.length).forEach((src) => clips.push({ id: uid(), file: src.id, kind: src.m.kind, name: src.name, in: 0, out: src.m.kind === 'image' ? 3 : Math.min(src.m.dur, 3), speed: 1, volume: 1, filter, motion: 'none' }));
  const texts = (tp.texts || []).map((t) => ({ id: uid(), content: String(t.content || ''), style: t.bg ? 'box' : /yellow|#ff[de]/i.test(t.color || '') ? 'yellow' : /black/i.test(t.font || '') || t.anim === 'pop' ? 'bold' : 'clean', size: Math.max(0.03, Math.min(0.2, (t.size || 64) / 1080)), y: t.y != null ? t.y : 0.5, start: t.t || 0, end: (t.t || 0) + (t.d || 3) }));
  const p = { id: uid(), name: tp.name, aspect: SIZES[tp.aspect] ? tp.aspect : '16:9', fit: 'cover', trans: TPL_TRANS[tp.trans] || 'dip', clips, texts, music: null, createdAt: Date.now(), updatedAt: Date.now() };
  p.duration = clips.reduce((a, c) => a + (c.out - c.in), 0);
  void W; void H;
  await putProject(p); bump('projects'); bump('templatesUsed'); bump('imports', loaded.length);
  await openProject(p); setProjectThumb();
  toast('Done! Tap play to watch it');
}

/* ============================ speech to text (runs on the device) ============================ */
let asrW = null, asrSeq = 0, asrProg = null;
const asrWait = {};
function asrWorker() {
  if (asrW) return asrW;
  asrW = new Worker('asr-worker.js', { type: 'module' });
  asrW.onmessage = (e) => { const m = e.data; if (m.type === 'progress') { if (asrProg) asrProg(m.p); return; } const w = asrWait[m.id]; if (!w) return; delete asrWait[m.id]; m.ok ? w[0](m) : w[1](new Error(m.error)); };
  asrW.onerror = (e) => { for (const k of Object.keys(asrWait)) { asrWait[k][1](new Error('network: ' + (e.message || 'speech model failed'))); delete asrWait[k]; } asrW = null; };
  return asrW;
}
function asrRun(size, audio) { return new Promise((res, rej) => { const id = ++asrSeq; asrWait[id] = [res, rej]; asrWorker().postMessage({ id, size, audio, tf: TF_URL }); }); }
// the sound of a video as 16 kHz mono (what the speech model wants)
async function decodeAudio(blob) {
  const buf = await blob.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  let ac; try { ac = new AC({ sampleRate: 16000 }); } catch { ac = new AC(); }
  let ab;
  try { ab = await new Promise((res, rej) => { const p = ac.decodeAudioData(buf, res, rej); if (p && p.then) p.then(res, rej); }); }
  finally { try { ac.close(); } catch {} }
  let data;
  if (ab.numberOfChannels === 1) data = ab.getChannelData(0);
  else { const a = ab.getChannelData(0), b = ab.getChannelData(1); data = new Float32Array(a.length); for (let i = 0; i < a.length; i++) data[i] = (a[i] + b[i]) * 0.5; }
  if (ab.sampleRate !== 16000) {
    const off = new OfflineAudioContext(1, Math.ceil(ab.duration * 16000), 16000), src = off.createBufferSource();
    const mono = off.createBuffer(1, data.length, ab.sampleRate); mono.copyToChannel(data, 0);
    src.buffer = mono; src.connect(off.destination); src.start();
    data = (await off.startRendering()).getChannelData(0);
  }
  return data;
}
function peaksOf(data) { const n = Math.ceil(data.length / 400), out = new Float32Array(n); for (let i = 0; i < n; i++) { let m = 0; const e = Math.min(data.length, (i + 1) * 400); for (let j = i * 400; j < e; j++) { const v = Math.abs(data[j]); if (v > m) m = v; } out[i] = m; } return out; }
function rms(a) { let s = 0; for (let i = 0; i < a.length; i += 4) s += a[i] * a[i]; return Math.sqrt(s / Math.max(1, a.length / 4)); }
// listens 30 seconds at a time so we can show progress and skip quiet parts
async function transcribe(data, size, prog, isCancelled) {
  asrProg = (p) => prog('Getting the speech model ready (only the first time)…', p);
  prog('Getting the speech model ready…', 0);
  await asrRun(size, null);
  asrProg = null;
  const W = 30 * 16000, words = [];
  for (let off = 0; off < data.length; off += W) {
    if (isCancelled()) throw new Error('cancelled');
    prog('Listening… ' + fmtMin(off / 16000) + ' of ' + fmtMin(data.length / 16000), off / data.length);
    const slice = data.subarray(off, Math.min(data.length, off + W));
    if (slice.length < 8000 || rms(slice) < 0.003) continue;
    const t0 = off / 16000;
    const out = await asrRun(size, slice.slice()), wordLevel = out.wordLevel;
    for (const ch of out.chunks || []) {
      const [s, e0] = ch.timestamp || [0, 0], text = String(ch.text || '').trim();
      if (!text || /^\[.*\]$|^\(.*\)$/.test(text)) continue;
      const e = e0 == null ? s + 0.5 : e0;
      if (wordLevel) { words.push({ w: text, s: s + t0, e: e + t0 }); continue; }
      const parts = text.split(/\s+/), tot = parts.reduce((a, w) => a + w.length + 1, 0); let t = s;
      for (const w of parts) { const d = ((e - s) * (w.length + 1)) / tot; words.push({ w, s: t + t0, e: t + d + t0 }); t += d; }
    }
  }
  prog('Listening… done', 1);
  return words;
}
const fmtMin = (s) => { s = Math.round(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
let wakeLock = null;
async function keepAwake(on) { try { if (window.FluxNative) FluxNative.keepAwake(!!on); } catch {} try { if (on && 'wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; } } catch {} }

/* ---------- captions ---------- */
const CAP_STYLES = [['viral', 'Viral', 'yellow', true], ['bold', 'Bold', 'bold', true], ['box', 'Box', 'box', false], ['clean', 'Clean', 'clean', false], ['gold', 'Gold', 'gold', false]];
function captionTexts(words, from, to, styleKey, place, mapT) {
  const st = CAP_STYLES.find((x) => x[0] === styleKey) || CAP_STYLES[0], out = [];
  let cur = [];
  const flush = () => {
    if (!cur.length) return;
    let content = cur.map((w) => w.w).join(' ').replace(/\s+([,.!?…])/g, '$1');
    if (st[3]) content = content.toUpperCase().replace(/[.,]$/, '');
    out.push({ id: uid(), content, style: st[2], size: place.size, y: place.y, start: mapT(cur[0].s), end: mapT(cur[cur.length - 1].e), auto: true });
    cur = [];
  };
  for (const w of words) {
    if (w.e < from || w.s > to) continue;
    const last = cur[cur.length - 1];
    if (last && (w.s - last.e > 0.6 || cur.length >= 3 || w.e - cur[0].s > 1.6)) flush();
    cur.push(w);
    if (/[.!?…,]$/.test(w.w)) flush();
  }
  flush();
  for (let i = 0; i < out.length; i++) {
    const t = out[i], nx = out[i + 1];
    if (t.end - t.start < 0.3) t.end = t.start + 0.3;
    if (nx && nx.start - t.end < 0.7) t.end = Math.max(t.end, nx.start - 0.01);
  }
  return out.filter((t) => t.end > 0);
}

/* ============================ Viral Shorts ============================ */
let SHS = { file: null, fileId: null, dur: 0, words: null, peaks: null, results: [], busy: false, cancel: false, url: '' };
let shOpts = { range: 'mid', style: 'viral', size: isPhone ? 'tiny' : 'base' };
try { Object.assign(shOpts, JSON.parse(localStorage.getItem('flux.mshorts') || '{}')); } catch {}
const saveShOpts = () => { try { localStorage.setItem('flux.mshorts', JSON.stringify(shOpts)); } catch {} };
const chipsHtml = (list, val, key) => `<div class="chips" data-k="${key}">${list.map(([k, n]) => `<button class="chip${k === val ? ' on' : ''}" data-v="${k}">${n}</button>`).join('')}</div>`;
function renderShorts(page) {
  if (SHS.busy) return;
  // Viral Shorts needs a Flux account with Premium
  if (!signedIn()) return needSignIn(page, ['Viral Shorts', 'Turn long videos into vertical Shorts with captions. Sign in to use it - Viral Shorts is part of Flux Premium.']);
  if (!hasPremium()) {
    page.innerHTML = `<div class="sh-hero"><span class="pm-badge">👑 Premium</span><h1>Viral Shorts</h1><p>Choose a long video - a podcast, stream or vlog - and Flux finds the best moments and turns them into vertical Shorts with captions.</p>
      <div class="pm-list"><span>✓ Finds the most viral moments</span><span>✓ Word-by-word captions in 5 styles</span><span>✓ Vertical crop, ready to post</span></div>
      <div class="card" style="margin-top:16px"><b style="display:block;margin-bottom:4px">Viral Shorts is part of Flux Premium</b><span class="muted" style="font-size:13.5px">Premium isn’t for sale yet - it’s coming soon. You’re signed in as @${esc(acct.username || acct.email)}; when Premium is on your account, Viral Shorts unlocks here by itself.</span></div>
      <button class="btn wide" style="margin-top:12px" data-a="chk">Check again</button></div>`;
    $('[data-a=chk]', page).onclick = async () => { await refreshMe(); if (hasPremium()) { toast('Premium is on - enjoy Viral Shorts!'); } else toast('No Premium on this account yet'); renderShorts(page); };
    return;
  }
  page.innerHTML = `<div class="sh-hero"><h1>Viral Shorts</h1><p>Choose a long video - a podcast, stream, vlog or interview. Flux finds the best moments and turns them into vertical Shorts with captions.</p>
      <button class="btn gold wide" data-a="pick">${ico('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 9v6M9 12h6"/>')}Choose a video</button>
      <div class="sh-link"><input type="url" placeholder="Or paste a YouTube or Twitch link" autocomplete="off" autocapitalize="off"><button class="btn" data-a="link">Go</button></div>
      <p class="sh-note">${window.FluxNative ? 'Paste a YouTube video or a past Twitch stream - Flux downloads only the moments you keep. Only use videos you own or have permission to use.' : 'Everything happens on your phone - your video isn’t uploaded anywhere.'}</p></div>
    <div class="opt"><label>How long should each Short be?</label>${chipsHtml(Object.entries(SH_RANGES).map(([k, v]) => [k, v[2] + ' · ' + v[3]]), shOpts.range, 'range')}</div>
    <div class="opt"><label>Caption style</label>${chipsHtml(CAP_STYLES.map((x) => [x[0], x[1]]), shOpts.style, 'style')}</div>
    <div class="opt"><label>Listening</label>${chipsHtml([['tiny', 'Fast'], ['base', 'Most accurate']], shOpts.size, 'size')}<p class="sh-note">“Most accurate” is slower and downloads a bigger speech model (about 80 MB, only once).</p></div>
    <div class="sh-out"></div>`;
  $$('.chips', page).forEach((g) => (g.onclick = (e) => { const c = e.target.closest('.chip'); if (!c) return; shOpts[g.dataset.k] = c.dataset.v; saveShOpts(); $$('.chip', g).forEach((x) => x.classList.toggle('on', x === c)); if (g.dataset.k === 'range' && SHS.words) showShortResults(page, true); }));
  $('[data-a=pick]', page).onclick = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'video/*,audio/*'; inp.onchange = () => inp.files[0] && runShorts(page, inp.files[0]); inp.click(); };
  const li = $('.sh-link input', page);
  $('[data-a=link]', page).onclick = () => shortsLink(page, li.value.trim());
  li.onkeydown = (e) => { if (e.key === 'Enter') shortsLink(page, li.value.trim()); };
  if (SHS.results.length) showShortResults(page);
}
async function shortsLink(page, url) {
  if (!url) return toast('Paste a link first');
  let u; try { u = new URL(/^https?:/i.test(url) ? url : 'https://' + url); } catch { return toast('That doesn’t look like a link'); }
  if (/(^|\.)(youtube\.com|youtu\.be|twitch\.tv)$/i.test(u.hostname) && window.FluxNative && FluxNative.linkInfo) return nativeLink(page, u.href);
  if (/(^|\.)(youtube\.com|youtu\.be|twitch\.tv)$/i.test(u.hostname)) {
    const b = sheet(`<h3>YouTube and Twitch links</h3>
      <p class="hint" style="font-size:14px">Phones and browsers aren’t allowed to download videos from YouTube or Twitch, so links work in the <b>Flux app for Windows and Mac</b>: paste the link in Viral Shorts there and it does everything for you.</p>
      <p class="hint" style="font-size:14px">On your phone you can still choose a video you saved, like a stream download or a screen recording. Only use videos you own or have permission to use.</p>
      <div class="acts"><a class="btn" href="/#download">Get the computer app</a><button class="btn gold" data-a="pick">Choose a video</button></div>`);
    $('[data-a=pick]', b).onclick = () => { closeSheet(); $('[data-a=pick]', page).click(); };
    return;
  }
  // a direct link to a video file (if that site allows it)
  toast('Downloading the video…', 8000);
  try {
    const r = await fetch(u.href); if (!r.ok) throw new Error();
    const blob = await r.blob();
    if (!/^(video|audio)\//.test(blob.type) && !/\.(mp4|m4a|mp3|webm|mov|wav)$/i.test(u.pathname)) throw new Error();
    runShorts(page, new File([blob], decodeURIComponent(u.pathname.split('/').pop() || 'video.mp4'), { type: blob.type || 'video/mp4' }));
  } catch { toast('Couldn’t download that link here. Save the video to your phone, then choose it.', 5000); }
}
async function runShorts(page, file) {
  if (SHS.busy) return;
  if (!hasPremium()) return renderShorts(page);
  if (SHS.url) URL.revokeObjectURL(SHS.url);
  SHS = { file, fileId: null, dur: 0, words: null, peaks: null, results: [], busy: true, cancel: false, url: URL.createObjectURL(file) };
  const out = $('.sh-out', page);
  out.innerHTML = `<div class="card" style="margin-top:18px"><b style="display:block;margin-bottom:4px">${esc(file.name)}</b><div class="busy"><i class="spin"></i><span class="st">Opening the video…</span></div><div class="prog"><i></i></div><p class="hint">Keep Flux open and the screen on. This can take a few minutes for long videos.</p><div class="acts" style="margin-top:10px"><button class="btn" data-a="stop">Stop</button></div></div>`;
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const prog = (msg, p) => { if (!out.isConnected) return; $('.st', out).textContent = msg; if (p != null) $('.prog i', out).style.width = Math.round(p * 100) + '%'; };
  $('[data-a=stop]', out).onclick = () => { SHS.cancel = true; prog('Stopping…'); };
  keepAwake(true);
  try {
    SHS.dur = await new Promise((res) => { const v = document.createElement('video'); v.preload = 'metadata'; v.onloadedmetadata = () => res(isFinite(v.duration) ? v.duration : 0); v.onerror = () => res(0); v.src = SHS.url; setTimeout(() => res(0), 10000); });
    const limit = isPhone ? 60 * 60 : 3 * 3600;
    if (SHS.dur && SHS.dur < 20) throw new Error('That video is too short - choose one longer than 20 seconds.');
    if (SHS.dur > limit) throw new Error('On phones Flux can do videos up to 1 hour. For longer ones, use the Windows / Mac app.');
    const key = 'flux.mwords.' + file.name + '.' + file.size + '.' + shOpts.size;
    let cached = null; try { cached = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
    prog('Reading the sound…', 0.02);
    const data = await decodeAudio(file).catch(() => { throw new Error('Couldn’t read the sound of this video. Try an MP4 file.'); });
    if (!SHS.dur) SHS.dur = data.length / 16000;
    SHS.peaks = peaksOf(data);
    if (cached) SHS.words = cached.map(([w, s, e]) => ({ w, s, e }));
    else {
      SHS.words = await transcribe(data, shOpts.size, prog, () => SHS.cancel);
      try {
        for (const k of Object.keys(localStorage).filter((k) => k.startsWith('flux.mwords.')).slice(0, -2)) localStorage.removeItem(k);
        localStorage.setItem(key, JSON.stringify(SHS.words.map((x) => [x.w, Math.round(x.s * 100) / 100, Math.round(x.e * 100) / 100])));
      } catch {}
    }
    if (SHS.words.length < 30) throw new Error('Flux couldn’t hear enough talking in this video. Viral Shorts works best with podcasts, streams and videos where people talk.');
    SHS.busy = false;
    showShortResults(page, true);
  } catch (e) {
    SHS.busy = false;
    const m = e && e.message === 'cancelled' ? 'Stopped.' : (e && e.message) || 'Something went wrong.';
    if (/fetch|network|import/i.test(m)) out.innerHTML = '<div class="card" style="margin-top:18px">Couldn’t download the speech model. Check your internet and try again.</div>';
    else out.innerHTML = `<div class="card" style="margin-top:18px">${esc(m)}</div>`;
  } finally { keepAwake(false); }
}
function showShortResults(page, again) {
  const out = $('.sh-out', page); if (!out) return;
  if (again) SHS.results = shAnalyze(SHS.words, SHS.peaks, SHS.dur, { range: shOpts.range, count: 0 });
  if (!SHS.results.length) { out.innerHTML = '<div class="card" style="margin-top:18px">No good moments found for this length. Try another length.</div>'; return; }
  out.innerHTML = `<div class="sec-h"><h2>${SHS.results.length} Shorts found</h2><button class="btn sm gold" data-a="all">Make all</button></div>
    ${SHS.remote ? `<p class="sh-note">From: ${esc(SHS.name || '')} · Flux downloads only the moments you make into Shorts.</p>` : `<video class="sh-vid" playsinline controls preload="metadata" src="${SHS.url}"></video>`}<div style="height:10px"></div>`;
  const vid = $('video', out);
  SHS.results.forEach((r, i) => {
    const d = document.createElement('div'); d.className = 'sh-res';
    d.innerHTML = `<span class="score${r.viral >= 75 ? ' hot' : ''}">${r.viral}<small>SCORE</small></span><div><b>${esc(r.title || 'Short ' + (i + 1))}</b><small class="t">${fmtMin(r.s)} - ${fmtMin(r.e)} · ${Math.round(r.e - r.s)}s${r.why && r.why.length ? ' · ' + esc(r.why.join(', ')) : ''}</small>
      <div class="a"><button class="btn sm" data-a="play">${ico('<path d="M7 4l13 8-13 8z"/>')}Watch</button><button class="btn sm gold" data-a="make">Make Short</button></div></div>`;
    $('[data-a=play]', d).onclick = () => { if (SHS.remote) return FluxNative.openUrl(SHS.site === 'yt' ? `https://www.youtube.com/watch?v=${encodeURIComponent(SHS.id)}&t=${Math.floor(r.s)}s` : `https://www.twitch.tv/videos/${SHS.id}?t=${Math.floor(r.s / 3600)}h${Math.floor((r.s % 3600) / 60)}m${Math.floor(r.s % 60)}s`); vid.currentTime = r.s; vid.play().catch(() => {}); vid.scrollIntoView({ behavior: 'smooth', block: 'center' }); const stop = () => { if (vid.currentTime >= r.e) { vid.pause(); vid.removeEventListener('timeupdate', stop); } }; vid.addEventListener('timeupdate', stop); };
    $('[data-a=make]', d).onclick = () => makeShort(r, true);
    out.appendChild(d);
  });
  $('[data-a=all]', out).onclick = async () => { for (const r of SHS.results) { if ((await makeShort(r, false)) === false) return; } toast(SHS.results.length + ' Shorts are in your projects'); go('create'); };
}
async function makeShort(r, open) {
  let fileId = SHS.fileId, fileName = SHS.file ? SHS.file.name : SHS.name, shift = 0;
  if (SHS.remote) {
    // download only this moment, straight to the phone
    const busy = sheet(`<h3>Making your Short</h3><div class="busy"><i class="spin"></i><span class="st">Downloading just this moment…</span></div><div class="prog"><i></i></div><div class="acts"><button class="btn" data-a="x">Stop</button></div>`);
    $('[data-a=x]', busy).onclick = () => FluxNative.linkCancel();
    keepAwake(true);
    try {
      const cut = await nativeCall('linkCut', [SHS.url, Math.max(0, r.s - 1), Math.min(SHS.dur || r.e + 1, r.e + 1)], (st, v) => { $('.st', busy).textContent = st + '… ' + Math.round(v * 100) + '%'; $('.prog i', busy).style.width = Math.round(v * 100) + '%'; });
      const blob = await (await fetch('/native/' + cut.path)).blob();
      fileId = uid(); fileName = (SHS.name || 'Video') + ' ' + fmtMin(r.s) + '.mp4';
      await putFile(fileId, new File([blob], fileName, { type: 'video/mp4' }));
      shift = cut.start;
      closeSheet();
    } catch (e) { closeSheet(); toast(/cancel/i.test(e.message) ? 'Stopped' : 'Couldn’t download that moment: ' + e.message, 6000); return false; }
    finally { keepAwake(false); }
  } else if (!fileId) { fileId = SHS.fileId = uid(); await putFile(fileId, SHS.file); }
  const m = await loadMedia(fileId);
  const s = Math.max(0, r.s - 0.15), e = Math.min(SHS.dur || (m.dur + shift), r.e + 0.35), d = e - s;
  const caps = captionTexts(SHS.words, s, e, shOpts.style, { size: 0.085, y: 0.7 }, (t) => Math.max(0, Math.min(d, t - s)));
  const title = r.title || 'Short';
  const texts = [{ id: uid(), content: title, style: 'box', size: 0.058, y: 0.16, start: 0, end: Math.min(d, 3.2) }, ...caps];
  const p = { id: uid(), name: title.slice(0, 60), aspect: '9:16', fit: 'cover', trans: 'dip', clips: [{ id: uid(), file: fileId, kind: m.kind === 'audio' ? 'video' : m.kind, name: fileName, in: Math.max(0, s - shift), out: Math.min(m.dur, e - shift), speed: 1, volume: 1, filter: 'none', motion: 'none' }], texts, music: null, duration: d, createdAt: Date.now(), updatedAt: Date.now(), short: true };
  await putProject(p); bump('shorts'); bump('projects');
  if (open) { await openProject(p); setProjectThumb(); toast('Your Short is ready - tap Export to save it'); }
}

/* ---------- YouTube / Twitch links in the Android app ---------- */
const nativeCalls = {};
window.__fluxCb = (id, err, data) => { const c = nativeCalls[id]; if (!c) return; delete nativeCalls[id]; err ? c.rej(new Error(err)) : c.res(data); };
window.__fluxProg = (id, st, v) => { const c = nativeCalls[id]; if (c && c.prog) c.prog(st, v); };
function nativeCall(method, args, prog) { return new Promise((res, rej) => { const id = 'c' + Date.now() + Math.random().toString(36).slice(2); nativeCalls[id] = { res, rej, prog }; FluxNative[method](id, ...args); }); }
async function nativeLink(page, url) {
  if (SHS.busy) return;
  if (!hasPremium()) return renderShorts(page);
  if (SHS.url) URL.revokeObjectURL(SHS.url);
  SHS = { remote: true, url, file: null, fileId: null, dur: 0, words: null, peaks: null, results: [], busy: true, cancel: false };
  const out = $('.sh-out', page);
  out.innerHTML = `<div class="card" style="margin-top:18px"><b style="display:block;margin-bottom:4px">${esc(url)}</b><div class="busy"><i class="spin"></i><span class="st">Opening the link…</span></div><div class="prog"><i></i></div><p class="hint">Flux reads the video’s captions - it doesn’t download the whole video.</p><div class="acts" style="margin-top:10px"><button class="btn" data-a="stop">Stop</button></div></div>`;
  out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const prog = (msg, p) => { if (!out.isConnected) return; $('.st', out).textContent = msg; if (p != null) $('.prog i', out).style.width = Math.round(p * 100) + '%'; };
  $('[data-a=stop]', out).onclick = () => { SHS.cancel = true; FluxNative.linkCancel(); prog('Stopping…'); };
  keepAwake(true);
  try {
    const info = await nativeCall('linkInfo', [url], (st, v) => prog(st + '…', v));
    if (info.live) throw new Error('That’s a live stream. Wait until it’s over, then paste the link of the saved stream.');
    Object.assign(SHS, { site: info.site, id: info.id, name: info.name, dur: info.duration });
    if (SHS.dur && SHS.dur < 20) throw new Error('That video is too short - choose one longer than 20 seconds.');
    if (info.words) SHS.words = info.words.map(([w, s, e]) => ({ w, s, e }));
    else {
      // no captions (most Twitch streams): get only the sound and listen to it here
      if (SHS.dur > 3 * 3600) throw new Error('This stream has no captions and is over 3 hours - too long to listen to on a phone.');
      const snd = await nativeCall('linkSound', [url], (st, v) => prog(st + '… ' + Math.round(v * 100) + '%', v));
      prog('Reading the sound…', 0.02);
      const data = await decodeAudio(await (await fetch('/native/' + snd.path)).blob());
      SHS.peaks = peaksOf(data);
      SHS.words = await transcribe(data, shOpts.size, prog, () => SHS.cancel);
    }
    if (!SHS.words || SHS.words.length < 30) throw new Error('Flux couldn’t find enough talking in this video.');
    SHS.busy = false;
    showShortResults(page, true);
  } catch (e) {
    SHS.busy = false;
    out.innerHTML = `<div class="card" style="margin-top:18px">${esc(/cancel/i.test(e.message) ? 'Stopped.' : e.message || 'Something went wrong.')}</div>`;
  } finally { keepAwake(false); }
}

/* ============================ editor: captions, motion, transitions ============================ */
const audioCache = {};
$('#tools').addEventListener('click', (e) => {
  const b = e.target.closest('.tool'); if (!b || b.disabled) return;
  const t = b.dataset.t;
  if (t !== 'captions' && t !== 'motion' && t !== 'trans') return;
  e.stopImmediatePropagation(); pause();
  if (t === 'captions') return captionsSheet();
  if (t === 'trans') return transSheet();
  const c = selClip(); if (c) motionSheet(c);
}, true);
function motionSheet(c) {
  const b = sheet(`<h3>Motion</h3><p class="hint" style="margin-top:-8px">Slowly zoom or pan this clip - great for photos.</p>${chipsHtml([['none', 'None'], ['zoomIn', 'Zoom in'], ['zoomOut', 'Zoom out'], ['panLeft', 'Pan left'], ['panRight', 'Pan right']], c.motion || 'none', 'mo')}<div class="acts"><button class="btn gold" data-a="done">Done</button></div>`);
  $('.chips', b).onclick = (e) => { const ch = e.target.closest('.chip'); if (!ch) return; snapshot(); c.motion = ch.dataset.v; $$('.chip', b).forEach((x) => x.classList.toggle('on', x === ch)); bump('effects'); play(); setTimeout(() => { const s = startOf(c); if (playing && time > s + clipDur(c)) pause(); }, clipDur(c) * 1000 + 200); };
  $('[data-a=done]', b).onclick = closeSheet;
}
function transSheet() {
  const b = sheet(`<h3>Transitions</h3><p class="hint" style="margin-top:-8px">How one clip changes to the next, for the whole video.</p>${chipsHtml([['dip', 'Fade'], ['flash', 'Flash'], ['zoom', 'Zoom punch'], ['none', 'Hard cut']], P.trans || 'dip', 'tr')}<div class="acts"><button class="btn gold" data-a="done">Done</button></div>`);
  $('.chips', b).onclick = (e) => { const ch = e.target.closest('.chip'); if (!ch) return; snapshot(); P.trans = ch.dataset.v; P.fade = true; $$('.chip', b).forEach((x) => x.classList.toggle('on', x === ch)); const c = P.clips[1]; if (c) { seek(Math.max(0, startOf(c) - 0.6)); setTimeout(play, 50); } };
  $('[data-a=done]', b).onclick = closeSheet;
}
function captionsSheet() {
  const vids = P.clips.filter((c) => c.kind === 'video');
  if (!vids.length) return toast('Add a video with talking first');
  const had = P.texts.some((t) => t.auto);
  let st = shOpts.style, size = shOpts.size, run = false, cancel = false;
  const b = sheet(`<h3>Auto captions</h3><p class="hint" style="margin-top:-8px">Flux listens to your video and writes the words on screen. It all happens on your phone.</p>
    <div class="opt"><label>Style</label>${chipsHtml(CAP_STYLES.map((x) => [x[0], x[1]]), st, 'st')}</div>
    <div class="opt"><label>Where</label>${chipsHtml([['0.7', 'Low'], ['0.5', 'Middle'], ['0.25', 'High']], String(P.capY || 0.7), 'y')}</div>
    <div class="opt"><label>Listening</label>${chipsHtml([['tiny', 'Fast'], ['base', 'Most accurate']], size, 'sz')}</div>
    <div class="cap-run" hidden><div class="busy" style="margin-top:14px"><i class="spin"></i><span class="st">Starting…</span></div><div class="prog"><i></i></div></div>
    <p class="err-msg"></p>
    <div class="acts">${had ? '<button class="btn" data-a="rm">Remove captions</button>' : '<button class="btn" data-a="x">Cancel</button>'}<button class="btn gold" data-a="go">${had ? 'Make again' : 'Make captions'}</button></div>`);
  $$('.chips', b).forEach((g) => (g.onclick = (e) => { const c = e.target.closest('.chip'); if (!c || run) return; if (g.dataset.k === 'st') st = c.dataset.v; else if (g.dataset.k === 'sz') size = c.dataset.v; else P.capY = +c.dataset.v; $$('.chip', g).forEach((x) => x.classList.toggle('on', x === c)); }));
  const x = $('[data-a=x]', b); if (x) x.onclick = closeSheet;
  const rm = $('[data-a=rm]', b); if (rm) rm.onclick = () => { snapshot(); P.texts = P.texts.filter((t) => !t.auto); closeSheet(); toast('Captions removed'); };
  $('[data-a=go]', b).onclick = async () => {
    if (run) { cancel = true; return; }
    run = true; $('.cap-run', b).hidden = false; $('[data-a=go]', b).textContent = 'Stop';
    const prog = (m, p) => { $('.st', b).textContent = m; if (p != null) $('.prog i', b).style.width = Math.round(p * 100) + '%'; };
    keepAwake(true);
    try {
      const all = [];
      for (let i = 0; i < P.clips.length; i++) {
        const c = P.clips[i]; if (c.kind !== 'video') continue;
        prog(`Reading the sound of clip ${i + 1}…`, 0);
        if (!audioCache[c.file]) { const blob = (media[c.file] && media[c.file].blob) || (await getFile(c.file)); audioCache[c.file] = await decodeAudio(blob).catch(() => null); }
        const data = audioCache[c.file]; if (!data) continue;
        const part = data.subarray(Math.floor(c.in * 16000), Math.ceil(c.out * 16000));
        const words = await transcribe(part, size, (m, p) => prog(P.clips.length > 1 ? `Clip ${i + 1}: ${m}` : m, p), () => cancel);
        const start = startOf(c), sp = c.speed || 1, len = clipDur(c);
        all.push(...captionTexts(words, 0, c.out - c.in, st, { size: 0.08, y: P.capY || 0.7 }, (t) => Math.max(0, Math.min(len, t / sp)) + start));
      }
      snapshot();
      P.texts = P.texts.filter((t) => !t.auto).concat(all);
      bump('captions'); shOpts.style = st; shOpts.size = size; saveShOpts();
      closeSheet(); toast(all.length ? `Added ${all.length} captions` : 'Flux couldn’t hear any talking');
    } catch (e) {
      run = false; $('[data-a=go]', b).textContent = 'Make captions'; $('.cap-run', b).hidden = true;
      $('.err-msg', b).textContent = e && e.message === 'cancelled' ? 'Stopped.' : /fetch|import|network/i.test(String(e && e.message)) ? 'Couldn’t download the speech model. Check your internet and try again.' : 'Something went wrong: ' + ((e && e.message) || e);
    } finally { keepAwake(false); }
  };
}

/* ============================ the Android app ============================ */
// sends a finished video to the phone in pieces, then saves it to the gallery or opens the share menu
async function nativeFile(blob, name, what) {
  try {
    toast(what === 'share' ? 'Getting it ready…' : 'Saving…', 8000);
    const id = FluxNative.begin(name, blob.type || 'video/mp4'); if (!id) throw new Error();
    const CH = 768 * 1024;
    for (let o = 0; o < blob.size; o += CH) {
      const buf = new Uint8Array(await blob.slice(o, o + CH).arrayBuffer());
      let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
      if (!FluxNative.append(id, btoa(bin))) throw new Error();
    }
    if (what === 'share') { FluxNative.share(id); return; }
    toast(FluxNative.save(id) === 'ok' ? 'Saved to your gallery (Movies › Flux)' : 'Couldn’t save it', 4000);
  } catch { toast('Couldn’t save it - try again', 4000); }
}
if (window.FluxNative) {
  document.documentElement.classList.add('in-app');
  // "Save" buttons go to the phone's gallery instead of a browser download
  document.addEventListener('click', async (e) => {
    const a = e.target.closest('a[download]'); if (!a) return;
    e.preventDefault();
    const blob = await (await fetch(a.href)).blob();
    nativeFile(blob, a.getAttribute('download') || 'Flux video.mp4', 'save');
  }, true);
  // the phone's Back button: close what's open first
  window.fluxBack = () => {
    if ($('#sheet').classList.contains('on')) { if (typeof exporting !== 'undefined' && exporting) return true; closeSheet(); return true; }
    if ($('#editor').classList.contains('on')) { $('#back').click(); return true; }
    if (curPage !== 'create') { go('create'); return true; }
    return false;
  };
}

/* ============================ start ============================ */
markActive();
setInterval(() => { if (!document.hidden && $('#editor').classList.contains('on')) bump('editSecs', 15); }, 15000);
const _sheetBgClick = $('#sheetBg').onclick;
$('#sheetBg').onclick = () => { if ($('#editor').classList.contains('on')) return _sheetBgClick(); if (!SHS.busy) closeSheet(); };
updateNavMe();
if (signedIn()) { refreshMe(); checkRequests(); }
// the owner's admin panel opens a sent-in template here to check it (coloured cards stand in for clips)
async function tryTemplateFromLink(raw) {
  let tp; try { tp = JSON.parse(decodeURIComponent(raw)); } catch { return toast('That template link is broken'); }
  if (!tp || !Array.isArray(tp.slots) || !tp.slots.length) return;
  const [W, H] = SIZES[tp.aspect] || SIZES['16:9'], k = 720 / Math.max(W, H), files = [];
  for (let i = 0; i < tp.slots.length; i++) {
    const c = document.createElement('canvas'); c.width = Math.round(W * k); c.height = Math.round(H * k);
    const x = c.getContext('2d'), hue = (i * 47 + 210) % 360, g = x.createLinearGradient(0, 0, c.width, c.height);
    g.addColorStop(0, `hsl(${hue} 70% 46%)`); g.addColorStop(1, `hsl(${(hue + 40) % 360} 75% 28%)`); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    const s = Math.min(c.width, c.height); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `800 ${Math.round(s * 0.16)}px sans-serif`; x.fillText('Clip ' + (i + 1), c.width / 2, c.height / 2);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    files.push(new File([blob], `Clip ${i + 1}.png`, { type: 'image/png' }));
  }
  window.history.replaceState(null, '', location.pathname);
  await buildFromTemplate({ ...tp, name: 'Review · ' + (tp.name || 'Template') }, files);
}
if ((location.hash || '').startsWith('#trytpl=')) setTimeout(() => tryTemplateFromLink(location.hash.slice(8)), 300);
// open a page straight from a link, like /lite/#shorts
const startPage = (location.hash || '').slice(1);
if (['templates', 'shorts', 'friends', 'me'].includes(startPage)) go(startPage);
