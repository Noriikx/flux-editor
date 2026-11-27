// Flux accounts server (runs on Netlify).
// Accounts are stored in Netlify Blobs. Premium = active Stripe subscription, or a gift from the admin panel.
// Settings on Netlify: STRIPE_SECRET_KEY (check subscriptions), GMAIL_APP_PASSWORD (send email codes),
// ANTHROPIC_API_KEY (AI Editor for Premium users).
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import nodemailer from 'nodemailer';
import { collabRoute, collabForget } from '../lib/collab.mjs';

export const config = { path: '/api/*' };

const ADMIN_EMAIL = 'noralenfloricica@gmail.com';
const TOKEN_DAYS = 120;
const AI_MODEL = 'claude-haiku-5-5';
const AI_DAILY_LIMIT = 60;
const STRIPE_CACHE_MS = 20 * 60 * 1000;
// Premium is not for sale right now (no payments are taken). Premium only comes from gifts in the admin panel.
// Set this to true again only once selling is set up properly - then the Stripe check below runs again.
const SALES_ON = false;
const scrypt = promisify(crypto.scrypt);

const HEADERS = {
  'content-type': 'application/json',
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization, x-flux-version, x-flux-os',
  'access-control-allow-methods': 'GET, POST, OPTIONS'
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const fail = (msg, status = 400) => json({ error: msg }, status);

const users = () => getStore({ name: 'users', consistency: 'strong' });
const names = () => getStore({ name: 'usernames', consistency: 'strong' });
const feedback = () => getStore({ name: 'feedback', consistency: 'strong' });
const limits = () => getStore({ name: 'ratelimit' });
const settingsStore = () => getStore({ name: 'config', consistency: 'strong' });
const uidStore = () => getStore({ name: 'uids', consistency: 'strong' });
const avatars = () => getStore({ name: 'avatars', consistency: 'strong' });
const tplStore = () => getStore({ name: 'templates', consistency: 'strong' });
const norm = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => e.length < 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const keyOf = (email) => encodeURIComponent(email);

async function getUser(email) { return (await users().get(keyOf(email), { type: 'json' })) || null; }
async function saveUser(u) { await users().setJSON(keyOf(u.email), u); }

// ---------- protection: limits on how often anyone can try things ----------
// A quick in-memory check stops floods instantly; the stored counters work across all server copies.
const burst = new Map();
function tooFast(ip) {
  const now = Date.now(), b = burst.get(ip) || { n: 0, t: now };
  if (now - b.t > 60000) { b.n = 0; b.t = now; }
  b.n++; burst.set(ip, b);
  if (burst.size > 5000) burst.clear();
  return b.n > 120;
}
const hashId = (x) => crypto.createHash('sha256').update('flux-rl:' + x).digest('hex').slice(0, 28);
async function limited(bucket, id, max, windowMs) {
  const k = bucket + '-' + hashId(id), now = Date.now();
  let r = null;
  try { r = await limits().get(k, { type: 'json' }); } catch {}
  if (!r || r.reset < now) r = { n: 0, reset: now + windowMs };
  r.n++;
  try { await limits().setJSON(k, r); } catch {}
  return r.n > max;
}
const ipOf = (req) => req.headers.get('x-nf-client-connection-ip') || String(req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
const SLOW = 'Too many tries. Please wait a few minutes and try again.';

// ---------- usernames ----------
const RESERVED = /^(admin|administrator|flux|fluxeditor|flux_editor|support|help|moderator|mod|owner|official|staff|system|root|null|undefined)$/;
// people pick the capitals they like ("NorEdits"); two names that only differ in capitals count as the same name
const cleanName = (n) => String(n || '').trim().replace(/^@/, '');
const nameKey = (n) => cleanName(n).toLowerCase();
function nameProblem(n) {
  if (!/^[A-Za-z0-9_.]{3,20}$/.test(n)) return 'Usernames are 3-20 characters: letters, numbers, _ and . only.';
  if (/^[._]|[._]$|\.\./.test(n)) return 'A username can\u2019t start or end with . or _';
  if (RESERVED.test(n.toLowerCase())) return 'That username isn\u2019t available.';
  return null;
}
async function nameFree(n, email) {
  const owner = await names().get(nameKey(n));
  if (!owner || owner === email) return true;
  // a name held by an account that never confirmed its email is freed after a day
  const u = await getUser(owner);
  return !u || nameKey(u.username) !== nameKey(n) || (!isVerified(u) && Date.now() - (u.createdAt || 0) > 86400000);
}
async function setName(u, n) {
  if (u.username && nameKey(u.username) !== nameKey(n)) { try { if ((await names().get(nameKey(u.username))) === u.email) await names().delete(nameKey(u.username)); } catch {} }
  u.username = n;
  await names().set(nameKey(n), u.email);
}
const userByName = async (n) => { const e = await names().get(nameKey(n)); return e ? getUser(e) : null; };

// ---------- profiles: a stable id, picture, badges, friends and followers (emails are never shown to others) ----------
const BADGES = ['founder', 'developer', 'verified', 'bughunter', 'contributor', 'support', 'sponsor', 'creator', 'educator'];
// limited themes people buy (or get from the owner) - kept on the account so they work on every computer
const SHOP_THEMES = ['xmas', 'candycane', 'snowfall'];
async function ensureUid(u) {
  if (u.uid) return false;
  u.uid = crypto.randomBytes(6).toString('hex');
  await uidStore().set(u.uid, u.email);
  return true;
}
const userByUid = async (id) => { if (!/^[a-f0-9]{12}$/.test(String(id || ''))) return null; const e = await uidStore().get(id); return e ? getUser(e) : null; };
const soc = (u) => (u.social = Object.assign({ friends: [], following: [], followers: [], reqIn: [], reqOut: [] }, u.social || {}));
const without = (arr, id) => (arr || []).filter((x) => x !== id);
const withId = (arr, id) => (arr || []).includes(id) ? arr : [...(arr || []), id].slice(-5000);
const privacyOf = (u) => Object.assign({ private: false, requests: 'everyone' }, u.privacy || {});
function badgesOf(u, prem) {
  const b = (u.badges || []).filter((x) => BADGES.includes(x));
  if (u.email === ADMIN_EMAIL) { if (!b.includes('founder')) b.unshift('founder'); if (!b.includes('developer')) b.push('developer'); }
  if (prem) b.push('premium');
  return b;
}
const avatarUrl = (u) => u.avatarV && u.uid ? `/api/avatar/${u.uid}?v=${u.avatarV}` : null;
// a small card: what anyone may see about someone
async function card(u) {
  const st = await status(u, false);
  return { uid: u.uid, username: u.username || 'user', avatar: avatarUrl(u), badges: badgesOf(u, st.premium) };
}
async function profileFor(u, viewer) {
  const s = soc(u), me = !!viewer && viewer.uid === u.uid, pv = privacyOf(u);
  const vs = viewer ? soc(viewer) : null;
  const friend = !!(vs && vs.friends.includes(u.uid));
  const out = { ...(await card(u)), joined: u.createdAt || null, me, private: pv.private, requestsOff: pv.requests === 'off',
    relation: viewer && !me ? { friend, following: vs.following.includes(u.uid), followsYou: vs.followers.includes(u.uid), requested: vs.reqOut.includes(u.uid), requestedYou: vs.reqIn.includes(u.uid) } : null };
  if (!pv.private || me || friend) Object.assign(out, { friends: s.friends.length, followers: s.followers.length, following: s.following.length });
  return out;
}
async function cards(ids, max = 200) {
  const out = [];
  for (const id of (ids || []).slice(-max).reverse()) { const u = await userByUid(id); if (u && !u.banned) out.push(await card(u)); }
  return out;
}

// ---------- app settings the owner controls (forced update / rollback) ----------
const VER = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
let cfgCache = null;
async function appConfig(fresh) {
  if (!fresh && cfgCache && Date.now() - cfgCache.t < 30000) return cfgCache.c;
  const c = (await settingsStore().get('app-config', { type: 'json' })) || { minVersion: '', pinVersion: '', message: '' };
  cfgCache = { c, t: Date.now() };
  return c;
}
const vnum = (v) => String(v || '0').split('.').map((x) => parseInt(x, 10) || 0);
const vLess = (a, b) => { const x = vnum(a), y = vnum(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i]; return false; };
// Apps older than 7.0 don't send their version and can't show the update screen: when an update is required,
// they're signed out and asked to download the newest Flux.
const OLD_APP = 'Flux has a required update. Download the newest version at flux-editor.netlify.app, then sign in there.';
async function outdated(req) {
  const c = await appConfig();
  if (!c.minVersion) return false;
  const v = String(req.headers.get('x-flux-version') || '');
  if (req.headers.get('x-flux-admin') === '1') return false;
  return !VER.test(v);
}

// ---------- sessions (signed tokens, no database needed) ----------
let cachedSecret = null;
async function secret() {
  if (cachedSecret) return cachedSecret;
  const s = settingsStore();
  let v = await s.get('session-secret');
  if (!v) { v = crypto.randomBytes(32).toString('hex'); await s.set('session-secret', v); }
  return (cachedSecret = v);
}
async function makeToken(email, v = 0) {
  const data = Buffer.from(JSON.stringify({ e: email, v, x: Date.now() + TOKEN_DAYS * 86400000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', await secret()).update(data).digest('base64url');
  return data + '.' + sig;
}
async function readToken(req) {
  const m = /^Bearer (.+)\.(.+)$/.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  const good = crypto.createHmac('sha256', await secret()).update(m[1]).digest('base64url');
  if (good.length !== m[2].length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(m[2]))) return null;
  let p; try { p = JSON.parse(Buffer.from(m[1], 'base64url').toString()); } catch { return null; }
  return p.x > Date.now() ? { email: norm(p.e), v: p.v || 0 } : null;
}

// ---------- passwords ----------
async function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: (await scrypt(pw, salt, 64)).toString('hex') };
}
async function checkPassword(pw, u) {
  if (!u.hash) return false;
  const { hash } = await hashPassword(pw, u.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.hash, 'hex'));
}


// ---------- email codes ----------
const MAIL_FROM = process.env.GMAIL_USER || 'flux.editing.app@gmail.com';
const codeHash = (email, code) => crypto.createHash('sha256').update(email + ':' + code).digest('hex');
async function sendCode(u, purpose) {
  if (!process.env.GMAIL_APP_PASSWORD) throw Object.assign(new Error('mail'), { userMsg: 'Email codes are not set up yet. Please try again later.' });
  if (u.codeSentAt && Date.now() - u.codeSentAt < 60000) return; // max 1 email per minute
  const code = String(crypto.randomInt(100000, 1000000));
  u.code = codeHash(u.email, code); u.codeExp = Date.now() + 15 * 60000; u.codeTries = 0; u.codeSentAt = Date.now(); u.codeFor = purpose;
  await saveUser(u);
  const t = nodemailer.createTransport({ service: 'gmail', auth: { user: MAIL_FROM, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s/g, '') } });
  const what = purpose === 'reset' ? 'reset your Flux password' : purpose === 'delete' ? 'DELETE your Flux account' : purpose === 'login' ? 'sign in to Flux (2-step verification)' : purpose === '2fa' ? 'turn on 2-step verification' : 'confirm your Flux account';
  await t.sendMail({
    from: `"Flux" <${MAIL_FROM}>`, to: u.email,
    subject: `${code} is your Flux code`,
    text: `Your code to ${what} is: ${code}\n\nIt works for 15 minutes. If you didn't ask for this, ignore this email.\n\n--\nFlux, a free video editor by an independent developer in Romania\nhttps://flux-editor.netlify.app · Privacy: https://flux-editor.netlify.app/privacy.html\nThis is a one-time account email. We never send marketing emails.`,
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:420px;margin:auto;padding:24px;text-align:center"><h2 style="margin:0 0 8px">Flux</h2><p style="color:#555">Your code to ${what}:</p><div style="font-size:34px;letter-spacing:8px;font-weight:700;background:#f2f0ff;border-radius:12px;padding:16px;margin:16px 0">${code}</div><p style="color:#888;font-size:13px">It works for 15 minutes. If you didn't ask for this, ignore this email.</p><p style="color:#aaa;font-size:11.5px;margin-top:22px;border-top:1px solid #eee;padding-top:12px">Flux, a free video editor by an independent developer in Romania · <a href="https://flux-editor.netlify.app" style="color:#888">flux-editor.netlify.app</a> · <a href="https://flux-editor.netlify.app/privacy.html" style="color:#888">Privacy</a><br>This is a one-time account email. We never send marketing emails.</p></div>`
  });
}
function checkCode(u, code, purpose) {
  if (!u || !u.code || u.codeFor !== purpose) return 'Ask for a new code.';
  if (Date.now() > u.codeExp) return 'That code expired. Ask for a new one.';
  if ((u.codeTries || 0) >= 6) return 'Too many wrong tries. Ask for a new code.';
  if (codeHash(u.email, String(code || '').trim()) !== u.code) { u.codeTries = (u.codeTries || 0) + 1; return 'Wrong code. Check the email and try again.'; }
  u.code = null; u.codeExp = 0; u.codeTries = 0; u.codeSentAt = 0;
  return null;
}
const isVerified = (u) => u.verified !== false;

// ---------- Stripe subscription check ----------
async function stripe(path) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const r = await fetch('https://api.stripe.com/v1/' + path, { headers: { Authorization: 'Bearer ' + key } });
  return r.ok ? r.json() : null;
}
const periodEnd = (s) => 1000 * (s.current_period_end || (s.items && s.items.data && s.items.data[0] && s.items.data[0].current_period_end) || 0);
async function subscriptionFor(email) {
  const subs = [];
  const customers = await stripe('customers?limit=10&email=' + encodeURIComponent(email));
  if (customers) {
    for (const c of customers.data || []) {
      const s = await stripe(`subscriptions?limit=10&status=all&customer=${c.id}`);
      if (s) subs.push(...(s.data || []));
    }
  }
  if (!subs.length) {
    const sessions = await stripe('checkout/sessions?limit=20&customer_details[email]=' + encodeURIComponent(email));
    for (const cs of (sessions && sessions.data) || []) {
      if (cs.subscription) { const s = await stripe('subscriptions/' + (cs.subscription.id || cs.subscription)); if (s) subs.push(s); }
    }
  }
  const live = subs.filter((s) => ['active', 'trialing', 'past_due'].includes(s.status));
  if (!live.length) return { active: false };
  return { active: true, until: Math.max(...live.map(periodEnd)) || null, cancelAtEnd: live.every((s) => s.cancel_at_period_end) };
}
async function stripeStatus(u, force) {
  if (!force && u.stripe && Date.now() - (u.stripe.checkedAt || 0) < STRIPE_CACHE_MS) return u.stripe;
  try {
    const s = await subscriptionFor(u.email);
    u.stripe = { ...s, checkedAt: Date.now() };
    await saveUser(u);
  } catch { /* keep the last known answer */ }
  return u.stripe || { active: false };
}

async function status(u, force) {
  const now = Date.now();
  if (u.email === ADMIN_EMAIL) return { premium: true, source: 'owner', until: null };
  let best = { premium: false, source: null, until: null };
  if (u.grantUntil === -1 || (u.grantUntil && u.grantUntil > now)) best = { premium: true, source: 'gift', until: u.grantUntil === -1 ? null : u.grantUntil };
  if (SALES_ON && (best.until !== null || !best.premium)) {
    const s = await stripeStatus(u, force);
    if (s.active && (!best.premium || (s.until && s.until > best.until))) best = { premium: true, source: 'subscription', until: s.until, cancelAtEnd: s.cancelAtEnd };
  }
  return best;
}
const publicUser = async (u, force) => {
  if (await ensureUid(u)) await saveUser(u);
  const st = await status(u, force);
  return { email: u.email, username: u.username || null, uid: u.uid, avatar: avatarUrl(u), badges: badgesOf(u, st.premium), privacy: privacyOf(u), twoFactor: !!u.twoFA,
    needAge: !u.birthYear && u.email !== ADMIN_EMAIL, admin: u.email === ADMIN_EMAIL, termsVersion: u.termsVersion || null, themes: (u.themes || []).filter((x) => SHOP_THEMES.includes(x)), ...st };
};
const tokenFor = (u) => makeToken(u.email, u.tv || 0);
const banned = (u) => fail('This account is banned' + (u.banned && u.banned.reason ? ': ' + u.banned.reason : '.') + ' Questions? flux.editing.app@gmail.com', 403);

let tplCache = null;
// what a template may contain - nothing else is stored
const TPL_WORD = /^[a-zA-Z0-9]{1,24}$/;
function cleanTemplate(t) {
  t = t && typeof t === 'object' ? t : {};
  const num = (x, a, b) => Math.min(b, Math.max(a, Number(x) || 0));
  const slots = (Array.isArray(t.slots) ? t.slots : []).slice(0, 40).map((x) => Math.round(num(x, 0.3, 30) * 100) / 100);
  if (slots.length < 2) return null;
  const motion = (Array.isArray(t.motion) ? t.motion : []).slice(0, 40).map((x) => String(x || 'none')).filter((x) => TPL_WORD.test(x));
  const texts = (Array.isArray(t.texts) ? t.texts : []).slice(0, 8).map((x) => ({
    t: num(x && x.t, 0, 600), d: num(x && x.d, 0.2, 60), content: String((x && x.content) || '').slice(0, 80), size: Math.round(num(x && x.size, 12, 300)),
    y: num(x && x.y, 0, 1), anim: TPL_WORD.test(String(x && x.anim)) ? String(x.anim) : 'fade', font: String((x && x.font) || '').replace(/[^\w .'-]/g, '').slice(0, 40) || undefined
  })).filter((x) => x.content.trim());
  return { aspect: ['16:9', '9:16', '1:1', '4:5'].includes(t.aspect) ? t.aspect : '16:9', color: /^#[0-9a-fA-F]{6}$/.test(t.color) ? t.color : '#d8b674',
    filter: TPL_WORD.test(String(t.filter)) ? String(t.filter) : 'none', bars: !!t.bars, slots,
    trans: TPL_WORD.test(String(t.trans)) ? String(t.trans) : 'fade', motion: motion.length ? motion : ['none'], texts };
}

async function allUsers() {
  const { blobs } = await users().list();
  const out = [];
  // read in small batches (fast, without flooding the store)
  for (let i = 0; i < blobs.length; i += 25) {
    const part = await Promise.all(blobs.slice(i, i + 25).map((b) => users().get(b.key, { type: 'json' }).catch(() => null)));
    for (const u of part) if (u) out.push(u);
  }
  return out;
}

// ---------- routes ----------
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  const route = new URL(req.url).pathname.replace(/^\/api\/?/, '');
  if (+(req.headers.get('content-length') || 0) > 100000) return fail('Too big.', 413);
  const ip = ipOf(req);
  if (tooFast(ip)) return fail(SLOW, 429);
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  try {
    // the app asks this at start: is an update required / has an update been rolled back?
    if (route === 'config') return json(await appConfig(true));

    // profile pictures are public images (only the picture, nothing else)
    if (route.startsWith('avatar/')) {
      const id = route.slice(7);
      if (!/^[a-f0-9]{12}$/.test(id)) return fail('Not found.', 404);
      const d = await avatars().get(id);
      if (!d) return fail('Not found.', 404);
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(d);
      if (!m) return fail('Not found.', 404);
      return new Response(Buffer.from(m[2], 'base64'), { status: 200, headers: { 'content-type': m[1], 'cache-control': 'public, max-age=31536000, immutable', 'access-control-allow-origin': '*', 'x-content-type-options': 'nosniff' } });
    }

    // community templates the owner approved (anyone can see and use them)
    if (route === 'templates') {
      const now = Date.now();
      if (!tplCache || now - tplCache.at > 60000) {
        const { blobs } = await tplStore().list();
        const items = [];
        for (const b of blobs) { const t = await tplStore().get(b.key, { type: 'json' }).catch(() => null); if (t && t.status === 'approved') items.push({ id: t.id, name: t.name, desc: t.desc, by: t.byName, at: t.reviewedAt || t.at, tpl: t.tpl }); }
        items.sort((a, b) => b.at - a.at);
        tplCache = { at: now, items: items.slice(0, 300) };
      }
      return json({ items: tplCache.items });
    }

    if (route === 'signup' && req.method === 'POST') {
      const email = norm(body.email), pw = String(body.password || '');
      if (!validEmail(email)) return fail('Please enter a real email address.');
      if (pw.length < 8 || pw.length > 200) return fail('Your password needs at least 8 characters.');
      if (await limited('signup', ip, 6, 3600000)) return fail(SLOW, 429);
      // age: under 13 can't have an account; 13-15 need a parent or guardian to agree
      const by = Math.round(Number(body.birthYear)), year = new Date().getFullYear();
      if (!(by >= year - 120 && by <= year)) return fail('Please choose the year you were born.');
      const age = year - by;
      if (age < 13) return fail('Sorry, you need to be at least 13 to have a Flux account.');
      if (age < 16 && !body.parent) return fail('Because you\u2019re under 16, a parent or guardian needs to agree. Tick the box once they have.');
      const uname = cleanName(body.username), np = nameProblem(uname);
      if (np) return fail(np);
      if (!(await nameFree(uname, email))) return fail('That username is taken - try another one.', 409);
      let u = await getUser(email);
      if (u && u.banned) return banned(u);
      if (u && u.hash && isVerified(u)) return fail('There is already an account with this email. Sign in instead.', 409);
      u = { ...(u || {}), email, createdAt: (u && u.createdAt) || Date.now(), ...(await hashPassword(pw)), verified: false, codeSentAt: 0, birthYear: by, parentConsent: age < 16 };
      await setName(u, uname);
      if (body.terms) u.termsAt = Date.now(), u.termsVersion = String(body.terms).slice(0, 20);
      await saveUser(u);
      await sendCode(u, 'verify');
      return json({ needCode: true, message: 'We emailed a 6-digit code to ' + email + '.' });
    }

    if (route === 'verify' && req.method === 'POST') {
      if (await limited('verify', ip, 30, 900000)) return fail(SLOW, 429);
      const u = await getUser(norm(body.email));
      const err = checkCode(u, body.code, 'verify');
      if (err) { if (u) await saveUser(u); return fail(err); }
      u.verified = true; u.lastLogin = Date.now();
      await saveUser(u);
      return json({ token: await tokenFor(u), account: await publicUser(u, true) });
    }

    if (route === 'resend' && req.method === 'POST') {
      if (await limited('mail', ip, 10, 3600000)) return fail(SLOW, 429);
      const u = await getUser(norm(body.email));
      if (u && u.hash && !isVerified(u)) await sendCode(u, 'verify');
      return json({ ok: true });
    }

    if (route === 'forgot' && req.method === 'POST') {
      if (await limited('mail', ip, 10, 3600000)) return fail(SLOW, 429);
      const u = await getUser(norm(body.email));
      if (u && u.hash && isVerified(u)) await sendCode(u, 'reset');
      return json({ ok: true, message: 'If that email has a Flux account, a code is on its way.' });
    }

    if (route === 'reset' && req.method === 'POST') {
      if (await limited('verify', ip, 30, 900000)) return fail(SLOW, 429);
      const u = await getUser(norm(body.email));
      if (String(body.password || '').length < 8) return fail('Your new password needs at least 8 characters.');
      const err = checkCode(u, body.code, 'reset');
      if (err) { if (u) await saveUser(u); return fail(err); }
      if (u.banned) return banned(u);
      Object.assign(u, await hashPassword(String(body.password)), { fails: 0, lockUntil: 0, lastLogin: Date.now(), tv: (u.tv || 0) + 1 });
      await saveUser(u);
      return json({ token: await tokenFor(u), account: await publicUser(u, true) });
    }

    if (route === 'login' && req.method === 'POST') {
      const email = norm(body.email), pw = String(body.password || '').slice(0, 200);
      if (await limited('login-ip', ip, 30, 900000) || await limited('login-mail', email, 12, 900000)) return fail(SLOW, 429);
      const u = await getUser(email);
      if (!u || !u.hash) return fail('Wrong email or password.', 401);
      if (u.banned) return banned(u);
      if (email !== ADMIN_EMAIL && (await outdated(req))) return fail(OLD_APP, 426);
      if (u.lockUntil && u.lockUntil > Date.now()) return fail('Too many tries. Wait 15 minutes and try again.', 429);
      if (!(await checkPassword(pw, u))) {
        u.fails = (u.fails || 0) + 1;
        if (u.fails >= 8) { u.lockUntil = Date.now() + 15 * 60000; u.fails = 0; }
        await saveUser(u);
        return fail('Wrong email or password.', 401);
      }
      if (!isVerified(u)) {
        await sendCode(u, 'verify');
        return json({ needCode: true, message: 'Confirm your email first. We sent a code to ' + email + '.' }, 403);
      }
      u.fails = 0; u.lockUntil = 0;
      // 2-step verification: the right password is not enough, a code from the email is needed too
      if (u.twoFA) {
        u.codeSentAt = 0;
        await sendCode(u, 'login');
        return json({ need2fa: true, message: 'Enter the 6-digit code we just emailed you.' });
      }
      u.lastLogin = Date.now();
      await saveUser(u);
      return json({ token: await tokenFor(u), account: await publicUser(u, true) });
    }

    if (route === 'login/2fa' && req.method === 'POST') {
      if (await limited('verify', ip, 30, 900000)) return fail(SLOW, 429);
      const u = await getUser(norm(body.email));
      if (!u || !u.twoFA) return fail('Sign in again.', 401);
      if (u.banned) return banned(u);
      const err = checkCode(u, body.code, 'login');
      if (err) { await saveUser(u); return fail(err); }
      u.lastLogin = Date.now();
      await saveUser(u);
      return json({ token: await tokenFor(u), account: await publicUser(u, true) });
    }

    // everything below needs a signed-in user
    const tok = await readToken(req);
    if (!tok) return fail('Please sign in again.', 401);
    const email = tok.email;
    const me = await getUser(email);
    if (!me || !isVerified(me) || (me.tv || 0) !== tok.v) return fail('Please sign in again.', 401);
    if (me.banned) return json({ error: 'This account is banned' + (me.banned.reason ? ': ' + me.banned.reason : '.'), banned: true }, 403);
    if (me.email !== ADMIN_EMAIL && (await outdated(req))) return fail('Please sign in again.', 401);
    // which version people use + who was active today (saved at most once an hour per person)
    const ver = String(req.headers.get('x-flux-version') || ''), os = String(req.headers.get('x-flux-os') || '').slice(0, 12);
    // Flux Mobile (phones and browsers) is counted on its own, so it doesn't hide which computer app someone has
    const mobile = /^(android|ios|web)/.test(os);
    if (VER.test(ver) && mobile) { if (os !== me.mobileOs || Date.now() - (me.mobileSeen || 0) > 3600000) { me.mobileOs = os; me.mobileSeen = Date.now(); me.lastSeen = Date.now(); await saveUser(me); } }
    else if (VER.test(ver) && (ver !== me.version || Date.now() - (me.lastSeen || 0) > 3600000)) { me.version = ver; me.os = os; me.lastSeen = Date.now(); await saveUser(me); }

    if (route === 'me') return json({ account: await publicUser(me, new URL(req.url).searchParams.get('refresh') === '1') });

    // ---------- profile, friends, following ----------
    if (route === 'profile') {
      const q = new URL(req.url).searchParams.get('u');
      if (await ensureUid(me)) await saveUser(me);
      const u = q ? await userByName(q) : me;
      if (!u || u.banned || !u.hash || !isVerified(u)) return fail('No one has that username.', 404);
      if (await ensureUid(u)) await saveUser(u);
      return json({ profile: await profileFor(u, me) });
    }
    if (route === 'users/search') {
      if (await limited('search', email, 300, 3600000)) return fail(SLOW, 429);
      const q = nameKey(new URL(req.url).searchParams.get('q') || '').replace(/[^a-z0-9_.]/g, '');
      if (q.length < 2) return json({ users: [] });
      const { blobs } = await names().list({ prefix: q });
      const out = [];
      for (const b of blobs.slice(0, 25)) {
        const u = await getUser(await names().get(b.key));
        if (!u || u.banned || !u.hash || !isVerified(u) || nameKey(u.username) !== b.key) continue;
        if (await ensureUid(u)) await saveUser(u);
        out.push(await card(u));
      }
      return json({ users: out });
    }
    if (route.startsWith('collab/')) {
      if (await limited('collab', email, 20000, 86400000)) return fail(SLOW, 429);
      return collabRoute(route, { req, body, me, json, fail, store: () => getStore({ name: 'collab', consistency: 'strong' }), userByUid, userByName, getUser, card, ensureUid, saveUser, isVerified });
    }
    if (route === 'social') {
      const s = soc(me);
      return json({ friends: await cards(s.friends), requestsIn: await cards(s.reqIn), requestsOut: await cards(s.reqOut), following: await cards(s.following), followers: await cards(s.followers) });
    }
    if (route.startsWith('friends/') || route === 'follow' || route === 'unfollow') {
      if (req.method !== 'POST') return fail('Not found.', 404);
      if (await limited('social', email, 300, 86400000)) return fail(SLOW, 429);
      if (await ensureUid(me)) await saveUser(me);
      const other = body.uid ? await userByUid(body.uid) : await userByName(body.username || '');
      if (!other || other.banned || !other.hash || !isVerified(other)) return fail('No one has that username.', 404);
      if (other.email === me.email) return fail('That’s you!');
      await ensureUid(other);
      const a = soc(me), b = soc(other), A = me.uid, B = other.uid;
      if (route === 'friends/request') {
        if (a.friends.includes(B)) return fail('You’re already friends.');
        if (a.reqIn.includes(B)) { // they already asked you: that makes you friends
          a.reqIn = without(a.reqIn, B); b.reqOut = without(b.reqOut, A); a.friends = withId(a.friends, B); b.friends = withId(b.friends, A);
        } else {
          if (privacyOf(other).requests === 'off') return fail('This person isn’t accepting friend requests.');
          if (b.reqIn.length >= 500) return fail('This person has too many requests waiting.');
          a.reqOut = withId(a.reqOut, B); b.reqIn = withId(b.reqIn, A);
        }
      } else if (route === 'friends/accept') {
        if (!a.reqIn.includes(B)) return fail('That request is gone.');
        a.reqIn = without(a.reqIn, B); b.reqOut = without(b.reqOut, A); a.friends = withId(a.friends, B); b.friends = withId(b.friends, A);
      } else if (route === 'friends/decline' || route === 'friends/cancel') {
        a.reqIn = without(a.reqIn, B); a.reqOut = without(a.reqOut, B); b.reqIn = without(b.reqIn, A); b.reqOut = without(b.reqOut, A);
      } else if (route === 'friends/remove') {
        a.friends = without(a.friends, B); b.friends = without(b.friends, A);
      } else if (route === 'follow') {
        if (privacyOf(other).private && !a.friends.includes(B)) return fail('This account is private. Send a friend request instead.');
        a.following = withId(a.following, B); b.followers = withId(b.followers, A);
      } else if (route === 'unfollow') {
        a.following = without(a.following, B); b.followers = without(b.followers, A);
      } else return fail('Not found.', 404);
      await saveUser(other); await saveUser(me);
      return json({ ok: true, profile: await profileFor(other, me) });
    }
    if (route === 'profile/privacy' && req.method === 'POST') {
      const pv = privacyOf(me);
      if (body.private !== undefined) pv.private = !!body.private;
      if (body.requests !== undefined) pv.requests = body.requests === 'off' ? 'off' : 'everyone';
      me.privacy = pv; await saveUser(me);
      return json({ account: await publicUser(me) });
    }
    if (route === 'profile/avatar' && req.method === 'POST') {
      if (await limited('avatar', email, 20, 86400000)) return fail('You changed your picture a lot today. Try again tomorrow.', 429);
      if (await ensureUid(me)) await saveUser(me);
      if (body.remove) { await avatars().delete(me.uid); me.avatarV = 0; await saveUser(me); return json({ account: await publicUser(me) }); }
      const img = String(body.image || '');
      if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(img) || img.length > 90000) return fail('Use a JPG or PNG picture (it’s shrunk automatically).');
      await avatars().set(me.uid, img); me.avatarV = Date.now(); await saveUser(me);
      return json({ account: await publicUser(me) });
    }

    // 2-step verification on / off: needs the password; turning it on also proves the email works
    if (route === '2fa' && req.method === 'POST') {
      if (!(await checkPassword(String(body.password || ''), me))) return fail('Your password is wrong.', 401);
      if (!body.on) { me.twoFA = false; await saveUser(me); return json({ account: await publicUser(me) }); }
      if (!body.code) { me.codeSentAt = 0; await sendCode(me, '2fa'); return json({ needCode: true, message: 'We emailed a 6-digit code to ' + me.email + '.' }); }
      const err = checkCode(me, body.code, '2fa');
      if (err) { await saveUser(me); return fail(err); }
      me.twoFA = true; await saveUser(me);
      return json({ account: await publicUser(me) });
    }

    // share your own template: it waits for the owner to approve it
    if (route === 'templates/submit' && req.method === 'POST') {
      if (await limited('tpl', email, 5, 86400000)) return fail('You can share 5 templates a day. Try again tomorrow.', 429);
      const name = String(body.name || '').trim().slice(0, 40), desc = String(body.desc || '').trim().slice(0, 160);
      if (name.length < 3) return fail('Give your template a name (3+ characters).');
      const tpl = cleanTemplate(body.tpl);
      if (!tpl) return fail('A template needs at least 2 clips on the main video track.');
      if (await ensureUid(me)) await saveUser(me);
      const id = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
      await tplStore().setJSON(id, { id, status: 'pending', name, desc, tpl, by: me.uid, byName: me.username || 'user', at: Date.now() });
      return json({ ok: true });
    }
    if (route === 'templates/mine') {
      const { blobs } = await tplStore().list(); const items = [];
      for (const b of blobs) { const t = await tplStore().get(b.key, { type: 'json' }).catch(() => null); if (t && t.by === me.uid) items.push({ id: t.id, name: t.name, status: t.status, note: t.note || '', at: t.at }); }
      return json({ items: items.sort((a, b) => b.at - a.at) });
    }

    // pick or change your username
    if (route === 'username' && req.method === 'POST') {
      if (await limited('name', email, 10, 86400000)) return fail(SLOW, 429);
      const n = cleanName(body.username), np = nameProblem(n);
      if (np) return fail(np);
      if (!(await nameFree(n, email))) return fail('That username is taken - try another one.', 409);
      // accounts from before ages were asked: the year you were born comes with it
      if (!me.birthYear && me.email !== ADMIN_EMAIL) {
        const by = Math.round(Number(body.birthYear)), year = new Date().getFullYear();
        if (!(by >= year - 120 && by <= year)) return fail('Please choose the year you were born.');
        if (year - by < 13) return fail('Sorry, you need to be at least 13 to have a Flux account.');
        if (year - by < 16 && !body.parent) return fail('Because you\u2019re under 16, a parent or guardian needs to agree. Tick the box once they have.');
        me.birthYear = by; me.parentConsent = year - by < 16;
      }
      await setName(me, n); await saveUser(me);
      return json({ account: await publicUser(me) });
    }

    // feature requests + bug reports: only the owner can read them (admin panel)
    if (route === 'feedback' && req.method === 'POST') {
      const kind = body.kind === 'bug' ? 'bug' : 'feature';
      const text = String(body.text || '').trim().slice(0, 4000), title = String(body.title || '').trim().slice(0, 120);
      if (text.length < 10) return fail('Please write a bit more (at least 10 characters).');
      if (await limited('feedback', email, 10, 86400000)) return fail('You\u2019ve sent a lot today - thank you! Try again tomorrow.', 429);
      const id = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex');
      await feedback().setJSON(id, { id, kind, title, text, email, username: me.username || null, version: VER.test(String(body.version || '')) ? body.version : me.version || '', os: String(body.os || me.os || '').slice(0, 20), at: Date.now(), done: false });
      return json({ ok: true });
    }

    // deleting your account needs a code from your email (step 1: send it)
    if (route === 'delete/start' && req.method === 'POST') {
      if (me.email === ADMIN_EMAIL) return fail('The owner account can\u2019t be deleted from the app.');
      me.codeSentAt = 0;
      await sendCode(me, 'delete');
      return json({ ok: true, message: 'We emailed a 6-digit code to ' + me.email + '.' });
    }

    // ---------- AI Editor (Premium) ----------
    if (route === 'ai' && req.method === 'POST') {
      const st = await status(me, false);
      if (!st.premium) return fail('The AI Editor is a Premium feature.', 402);
      if (!process.env.ANTHROPIC_API_KEY) return fail('The AI Editor isn\'t switched on yet. Please try again later.', 503);
      const day = new Date().toISOString().slice(0, 10);
      if (me.aiDay !== day) { me.aiDay = day; me.aiCount = 0; }
      if (me.email !== ADMIN_EMAIL && me.aiCount >= AI_DAILY_LIMIT) return fail(`You've used the AI Editor ${AI_DAILY_LIMIT} times today. It resets tomorrow.`, 429);
      const system = String(body.system || '');
      if (!system.startsWith('You are the AI editor inside Flux')) return fail('Bad request.');
      const messages = (Array.isArray(body.messages) ? body.messages : []).slice(-10)
        .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 60000) }));
      if (!messages.length) return fail('Bad request.');
      me.aiCount = (me.aiCount || 0) + 1;
      await saveUser(me);
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: AI_MODEL, max_tokens: 2500, system: system.slice(0, 20000), messages })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { console.error('anthropic', r.status, j); return fail('The AI is busy right now. Try again in a minute.', 502); }
      return json({ text: (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'), left: me.email === ADMIN_EMAIL ? null : AI_DAILY_LIMIT - me.aiCount });
    }

    // accept the current Terms / Privacy Policy (shown once to existing users)
    if (route === 'terms' && req.method === 'POST') {
      me.termsAt = Date.now(); me.termsVersion = String(body.version || '').slice(0, 20);
      await saveUser(me);
      return json({ ok: true });
    }

    // delete your own account and everything we store about it (GDPR right to erasure)
    if (route === 'delete' && req.method === 'POST') {
      if (me.email === ADMIN_EMAIL) return fail('The owner account can\'t be deleted from the app.');
      const err = checkCode(me, body.code, 'delete');
      if (err) { await saveUser(me); return fail(err); }
      if (me.username) { try { if ((await names().get(nameKey(me.username))) === me.email) await names().delete(nameKey(me.username)); } catch {} }
      if (me.uid) { try { await uidStore().delete(me.uid); await avatars().delete(me.uid); } catch {} }
      if (me.uid) { try { await collabForget(me.uid, getStore({ name: 'collab', consistency: 'strong' })); } catch {} }
      await users().delete(keyOf(me.email));
      return json({ ok: true });
    }

    if (route === 'password' && req.method === 'POST') {
      if (!(await checkPassword(String(body.old || ''), me))) return fail('Your current password is wrong.', 401);
      if (String(body.password || '').length < 8) return fail('Your new password needs at least 8 characters.');
      Object.assign(me, await hashPassword(String(body.password)), { tv: (me.tv || 0) + 1 });
      await saveUser(me);
      return json({ ok: true, token: await tokenFor(me) });
    }

    // ---------- admin panel ----------
    if (route.startsWith('admin/')) {
      if (email !== ADMIN_EMAIL) return fail('Only the owner can do that.', 403);
      const action = route.slice(6);
      if (action === 'earnings') {
        // money from Stripe (if a Stripe key is set on Netlify) + simple user numbers
        const { blobs } = await users().list();
        let total = 0, gifts = 0, newThisMonth = 0;
        const now = Date.now(), monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        for (const b of blobs) {
          const u = await users().get(b.key, { type: 'json' });
          if (!u) continue;
          total++;
          if (u.grantUntil === -1 || u.grantUntil > now) gifts++;
          if ((u.createdAt || 0) >= monthStart) newThisMonth++;
        }
        const out = { salesOn: SALES_ON, stripe: false, users: total, gifts, newThisMonth };
        if (process.env.STRIPE_SECRET_KEY) {
          out.stripe = true;
          const bal = await stripe('balance');
          const sum = (arr) => { const m = {}; for (const x of arr || []) m[x.currency] = (m[x.currency] || 0) + x.amount; return m; };
          if (bal) { out.available = sum(bal.available); out.pending = sum(bal.pending); }
          const tally = { month: {}, all: {} }; let after = null, pages = 0, charges = 0;
          do {
            const page = await stripe('charges?limit=100' + (after ? '&starting_after=' + after : ''));
            if (!page) break;
            for (const ch of page.data || []) {
              if (ch.status !== 'succeeded' || !ch.paid) continue;
              const net = (ch.amount_captured || ch.amount) - (ch.amount_refunded || 0);
              charges++;
              tally.all[ch.currency] = (tally.all[ch.currency] || 0) + net;
              if (ch.created * 1000 >= monthStart) tally.month[ch.currency] = (tally.month[ch.currency] || 0) + net;
            }
            after = page.has_more && page.data.length ? page.data[page.data.length - 1].id : null;
          } while (after && ++pages < 10);
          out.month = tally.month; out.all = tally.all; out.charges = charges;
        }
        return json(out);
      }
      if (action === 'users') {
        const list = (await allUsers()).map((u) => ({
          email: u.email, username: u.username || null, badges: (u.badges || []).filter((x) => BADGES.includes(x)), avatar: avatarUrl(u), twoFactor: !!u.twoFA, createdAt: u.createdAt, lastLogin: u.lastLogin || null, lastSeen: u.lastSeen || null,
          version: u.version || null, os: u.os || null, hasPassword: !!u.hash && isVerified(u), banned: u.banned || null, themes: u.themes || [],
          mobileOs: u.mobileOs || null, mobileSeen: u.mobileSeen || null,
          grantUntil: u.grantUntil || 0, subscription: u.stripe ? { active: !!u.stripe.active, until: u.stripe.until || null } : null
        }));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return json({ users: list });
      }
      // the dashboard: users, active today, Premium, downloads and which versions people run
      if (action === 'stats') {
        const all = await allUsers(), now = Date.now(), day0 = new Date(new Date().toISOString().slice(0, 10)).getTime();
        const real = all.filter((u) => u.hash && isVerified(u));
        const versions = {};
        for (const u of real) if (u.version) versions[u.version] = (versions[u.version] || 0) + 1;
        const out = {
          users: real.length, unconfirmed: all.length - real.length,
          activeToday: real.filter((u) => (u.lastSeen || u.lastLogin || 0) >= day0).length,
          active7: real.filter((u) => (u.lastSeen || u.lastLogin || 0) >= now - 7 * 86400000).length,
          premium: real.filter((u) => u.email === ADMIN_EMAIL || u.grantUntil === -1 || u.grantUntil > now).length,
          banned: all.filter((u) => u.banned).length,
          mobile: real.filter((u) => u.mobileSeen).length,
          mobileToday: real.filter((u) => (u.mobileSeen || 0) >= day0).length,
          newToday: real.filter((u) => (u.createdAt || 0) >= day0).length,
          new7: real.filter((u) => (u.createdAt || 0) >= now - 7 * 86400000).length,
          versions, config: await appConfig(), downloads: null
        };
        try {
          const r = await fetch('https://api.github.com/repos/Noriikx/flux-editor/releases?per_page=100', { headers: { 'User-Agent': 'Flux-admin', Accept: 'application/vnd.github+json' } });
          if (r.ok) {
            const rels = (await r.json()).filter((x) => !x.draft);
            const inst = (x) => (x.assets || []).filter((a) => /\.(exe|dmg)$/i.test(a.name)).reduce((t, a) => t + a.download_count, 0);
            const quick = (x) => (x.assets || []).filter((a) => a.name === 'Flux-app.asar').reduce((t, a) => t + a.download_count, 0);
            out.downloads = { installs: rels.reduce((t, x) => t + inst(x), 0), updates: rels.reduce((t, x) => t + quick(x), 0),
              releases: rels.slice(0, 12).map((x) => ({ v: String(x.tag_name).replace(/^v/, ''), at: x.published_at, installs: inst(x), updates: quick(x) })) };
          }
        } catch {}
        return json(out);
      }
      // forced update (everyone below minVersion must update) and rollback (everyone goes to pinVersion)
      if (action === 'config') {
        const c = await appConfig();
        if (body.minVersion !== undefined) { const v = String(body.minVersion || '').trim(); if (v && !VER.test(v)) return fail('Versions look like 6.0.1'); c.minVersion = v; }
        if (body.pinVersion !== undefined) { const v = String(body.pinVersion || '').trim(); if (v && !VER.test(v)) return fail('Versions look like 6.0.1'); c.pinVersion = v; }
        if (body.message !== undefined) c.message = String(body.message || '').slice(0, 300);
        c.changedAt = Date.now();
        await settingsStore().setJSON('app-config', c); cfgCache = null;
        return json({ ok: true, config: c });
      }
      if (action === 'feedback') {
        const { blobs } = await feedback().list();
        const items = [];
        for (const b of blobs.slice(-600)) { const f = await feedback().get(b.key, { type: 'json' }); if (f) items.push(f); }
        items.sort((a, b) => b.at - a.at);
        return json({ items });
      }
      if (action === 'feedback/done' || action === 'feedback/delete') {
        const id = String(body.id || '');
        if (!/^[a-z0-9]+-[a-f0-9]{8}$/.test(id)) return fail('Bad id');
        if (action === 'feedback/delete') { await feedback().delete(id); return json({ ok: true }); }
        const f = await feedback().get(id, { type: 'json' });
        if (f) { f.done = !!body.done; await feedback().setJSON(id, f); }
        return json({ ok: true });
      }
      if (action === 'templates') {
        const { blobs } = await tplStore().list(); const items = [];
        for (const b of blobs) { const t = await tplStore().get(b.key, { type: 'json' }).catch(() => null); if (t) items.push(t); }
        const order = { pending: 0, approved: 1, rejected: 2 };
        items.sort((a, b) => (order[a.status] - order[b.status]) || b.at - a.at);
        return json({ items });
      }
      if (action === 'templates/review' || action === 'templates/delete') {
        const id = String(body.id || '');
        if (!/^[a-z0-9]+-[a-f0-9]{8}$/.test(id)) return fail('Bad id');
        if (action === 'templates/delete') { await tplStore().delete(id); tplCache = null; return json({ ok: true }); }
        const t = await tplStore().get(id, { type: 'json' });
        if (!t) return fail('That template is gone.');
        t.status = ['approved', 'rejected', 'pending'].includes(body.status) ? body.status : 'pending';
        t.note = String(body.note || '').slice(0, 200); t.reviewedAt = Date.now();
        await tplStore().setJSON(id, t); tplCache = null;
        return json({ ok: true });
      }
      // the others take an email - or a username
      let target = norm(body.email);
      if (target && (!target.includes('@') || target.startsWith('@'))) { const owner = await names().get(nameKey(target)); if (owner) target = owner; }
      if (!validEmail(target)) return fail('Enter a valid email or username.');
      let u = (await getUser(target)) || { email: target, createdAt: Date.now() };
      if (action === 'ban' || action === 'unban') {
        if (target === ADMIN_EMAIL) return fail('You can\u2019t ban yourself.');
        if (!(await getUser(target))) return fail('No account with that email / username.');
        if (action === 'ban') { u.banned = { at: Date.now(), reason: String(body.reason || '').slice(0, 200) }; u.tv = (u.tv || 0) + 1; }
        else delete u.banned;
        await saveUser(u);
        return json({ ok: true });
      }
      if (action === 'grant') {
        const days = Number(body.days);
        u.grantUntil = days === 0 ? -1 : Date.now() + Math.max(1, days) * 86400000;
        await saveUser(u);
        return json({ ok: true, grantUntil: u.grantUntil });
      }
      if (action === 'badge') {
        if (!(await getUser(target))) return fail('No account with that email / username.');
        const b = String(body.badge || '');
        if (!BADGES.includes(b)) return fail('Badges: ' + BADGES.join(', '));
        const set = new Set(u.badges || []);
        if (body.on === false) set.delete(b); else set.add(b);
        u.badges = BADGES.filter((x) => set.has(x));
        await saveUser(u);
        return json({ ok: true, badges: u.badges });
      }
      if (action === 'theme') {
        if (!(await getUser(target))) return fail('No account with that email / username.');
        const t = String(body.theme || '');
        if (!SHOP_THEMES.includes(t)) return fail('Themes: ' + SHOP_THEMES.join(', '));
        const set = new Set(u.themes || []);
        if (body.on === false) set.delete(t); else set.add(t);
        u.themes = SHOP_THEMES.filter((x) => set.has(x));
        await saveUser(u);
        return json({ ok: true, themes: u.themes });
      }
      if (action === 'revoke') { u.grantUntil = 0; await saveUser(u); return json({ ok: true }); }
      if (action === 'password') {
        if (String(body.password || '').length < 8) return fail('The new password needs at least 8 characters.');
        Object.assign(u, await hashPassword(String(body.password)), { fails: 0, lockUntil: 0, tv: (u.tv || 0) + 1 });
        await saveUser(u);
        return json({ ok: true });
      }
      if (action === 'refresh') { await stripeStatus(u, true); return json({ ok: true }); }
      if (action === 'delete') {
        if (target === ADMIN_EMAIL) return fail('You can\u2019t delete the owner account.');
        if (u.username) { try { if ((await names().get(nameKey(u.username))) === u.email) await names().delete(nameKey(u.username)); } catch {} }
        if (u.uid) { try { await uidStore().delete(u.uid); await avatars().delete(u.uid); } catch {} }
        await users().delete(keyOf(target)); return json({ ok: true });
      }
    }
    return fail('Not found.', 404);
  } catch (e) {
    console.error(e);
    if (e.userMsg) return fail(e.userMsg, 503);
    if (e.code === 'EAUTH') return fail('The email sender isn\'t working right now. Please try again later.', 503);
    return fail('Something went wrong on the server. Try again.', 500);
  }
};
