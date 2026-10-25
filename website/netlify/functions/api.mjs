// Flux accounts server (runs on Netlify).
// Accounts are stored in Netlify Blobs. Premium = active Stripe subscription, or a gift from the admin panel.
// Settings on Netlify: STRIPE_SECRET_KEY (check subscriptions), GMAIL_APP_PASSWORD (send email codes),
// ANTHROPIC_API_KEY (AI Editor for Premium users).
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import nodemailer from 'nodemailer';

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
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization',
  'access-control-allow-methods': 'GET, POST, OPTIONS'
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });
const fail = (msg, status = 400) => json({ error: msg }, status);

const users = () => getStore({ name: 'users', consistency: 'strong' });
const settingsStore = () => getStore({ name: 'config', consistency: 'strong' });
const norm = (e) => String(e || '').trim().toLowerCase();
const validEmail = (e) => e.length < 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const keyOf = (email) => encodeURIComponent(email);

async function getUser(email) { return (await users().get(keyOf(email), { type: 'json' })) || null; }
async function saveUser(u) { await users().setJSON(keyOf(u.email), u); }

// ---------- sessions (signed tokens, no database needed) ----------
let cachedSecret = null;
async function secret() {
  if (cachedSecret) return cachedSecret;
  const s = settingsStore();
  let v = await s.get('session-secret');
  if (!v) { v = crypto.randomBytes(32).toString('hex'); await s.set('session-secret', v); }
  return (cachedSecret = v);
}
async function makeToken(email) {
  const data = Buffer.from(JSON.stringify({ e: email, x: Date.now() + TOKEN_DAYS * 86400000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', await secret()).update(data).digest('base64url');
  return data + '.' + sig;
}
async function readToken(req) {
  const m = /^Bearer (.+)\.(.+)$/.exec(req.headers.get('authorization') || '');
  if (!m) return null;
  const good = crypto.createHmac('sha256', await secret()).update(m[1]).digest('base64url');
  if (good.length !== m[2].length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(m[2]))) return null;
  const p = JSON.parse(Buffer.from(m[1], 'base64url').toString());
  return p.x > Date.now() ? norm(p.e) : null;
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
  const what = purpose === 'reset' ? 'reset your Flux password' : 'confirm your Flux account';
  await t.sendMail({
    from: `"Flux" <${MAIL_FROM}>`, to: u.email,
    subject: `${code} is your Flux code`,
    text: `Your code to ${what} is: ${code}\n\nIt works for 15 minutes. If you didn't ask for this, ignore this email.`,
    html: `<div style="font-family:Segoe UI,Arial,sans-serif;max-width:420px;margin:auto;padding:24px;text-align:center"><h2 style="margin:0 0 8px">Flux</h2><p style="color:#555">Your code to ${what}:</p><div style="font-size:34px;letter-spacing:8px;font-weight:700;background:#f2f0ff;border-radius:12px;padding:16px;margin:16px 0">${code}</div><p style="color:#888;font-size:13px">It works for 15 minutes. If you didn't ask for this, ignore this email.</p></div>`
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
const publicUser = async (u, force) => ({ email: u.email, admin: u.email === ADMIN_EMAIL, termsVersion: u.termsVersion || null, ...(await status(u, force)) });

// ---------- routes ----------
export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: HEADERS });
  const route = new URL(req.url).pathname.replace(/^\/api\/?/, '');
  const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
  try {
    if (route === 'signup' && req.method === 'POST') {
      const email = norm(body.email), pw = String(body.password || '');
      if (!validEmail(email)) return fail('Please enter a real email address.');
      if (pw.length < 8) return fail('Your password needs at least 8 characters.');
      let u = await getUser(email);
      if (u && u.hash && isVerified(u)) return fail('There is already an account with this email. Sign in instead.', 409);
      u = { ...(u || {}), email, createdAt: (u && u.createdAt) || Date.now(), ...(await hashPassword(pw)), verified: false, codeSentAt: 0 };
      if (body.terms) u.termsAt = Date.now(), u.termsVersion = String(body.terms).slice(0, 20);
      await saveUser(u);
      await sendCode(u, 'verify');
      return json({ needCode: true, message: 'We emailed a 6-digit code to ' + email + '.' });
    }

    if (route === 'verify' && req.method === 'POST') {
      const u = await getUser(norm(body.email));
      const err = checkCode(u, body.code, 'verify');
      if (err) { if (u) await saveUser(u); return fail(err); }
      u.verified = true; u.lastLogin = Date.now();
      await saveUser(u);
      return json({ token: await makeToken(u.email), account: await publicUser(u, true) });
    }

    if (route === 'resend' && req.method === 'POST') {
      const u = await getUser(norm(body.email));
      if (u && u.hash && !isVerified(u)) await sendCode(u, 'verify');
      return json({ ok: true });
    }

    if (route === 'forgot' && req.method === 'POST') {
      const u = await getUser(norm(body.email));
      if (u && u.hash && isVerified(u)) await sendCode(u, 'reset');
      return json({ ok: true, message: 'If that email has a Flux account, a code is on its way.' });
    }

    if (route === 'reset' && req.method === 'POST') {
      const u = await getUser(norm(body.email));
      if (String(body.password || '').length < 8) return fail('Your new password needs at least 8 characters.');
      const err = checkCode(u, body.code, 'reset');
      if (err) { if (u) await saveUser(u); return fail(err); }
      Object.assign(u, await hashPassword(String(body.password)), { fails: 0, lockUntil: 0, lastLogin: Date.now() });
      await saveUser(u);
      return json({ token: await makeToken(u.email), account: await publicUser(u, true) });
    }

    if (route === 'login' && req.method === 'POST') {
      const email = norm(body.email), pw = String(body.password || '');
      const u = await getUser(email);
      if (!u || !u.hash) return fail('Wrong email or password.', 401);
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
      u.fails = 0; u.lockUntil = 0; u.lastLogin = Date.now();
      await saveUser(u);
      return json({ token: await makeToken(email), account: await publicUser(u, true) });
    }

    // everything below needs a signed-in user
    const email = await readToken(req);
    if (!email) return fail('Please sign in again.', 401);
    const me = await getUser(email);
    if (!me || !isVerified(me)) return fail('Please sign in again.', 401);

    if (route === 'me') return json({ account: await publicUser(me, new URL(req.url).searchParams.get('refresh') === '1') });

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
      if (!(await checkPassword(String(body.password || ''), me))) return fail('That password is wrong.', 401);
      await users().delete(keyOf(me.email));
      return json({ ok: true });
    }

    if (route === 'password' && req.method === 'POST') {
      if (!(await checkPassword(String(body.old || ''), me))) return fail('Your current password is wrong.', 401);
      if (String(body.password || '').length < 8) return fail('Your new password needs at least 8 characters.');
      Object.assign(me, await hashPassword(String(body.password)));
      await saveUser(me);
      return json({ ok: true });
    }

    // ---------- admin panel ----------
    if (route.startsWith('admin/')) {
      if (email !== ADMIN_EMAIL) return fail('Only the owner can do that.', 403);
      const action = route.slice(6);
      if (action === 'users') {
        const { blobs } = await users().list();
        const list = [];
        for (const b of blobs) {
          const u = await users().get(b.key, { type: 'json' });
          if (!u) continue;
          list.push({
            email: u.email, createdAt: u.createdAt, lastLogin: u.lastLogin || null, hasPassword: !!u.hash && isVerified(u),
            grantUntil: u.grantUntil || 0, subscription: u.stripe ? { active: !!u.stripe.active, until: u.stripe.until || null } : null
          });
        }
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return json({ users: list });
      }
      const target = norm(body.email);
      if (!validEmail(target)) return fail('Enter a valid email.');
      let u = (await getUser(target)) || { email: target, createdAt: Date.now() };
      if (action === 'grant') {
        const days = Number(body.days);
        u.grantUntil = days === 0 ? -1 : Date.now() + Math.max(1, days) * 86400000;
        await saveUser(u);
        return json({ ok: true, grantUntil: u.grantUntil });
      }
      if (action === 'revoke') { u.grantUntil = 0; await saveUser(u); return json({ ok: true }); }
      if (action === 'password') {
        if (String(body.password || '').length < 8) return fail('The new password needs at least 8 characters.');
        Object.assign(u, await hashPassword(String(body.password)), { fails: 0, lockUntil: 0 });
        await saveUser(u);
        return json({ ok: true });
      }
      if (action === 'refresh') { await stripeStatus(u, true); return json({ ok: true }); }
      if (action === 'delete') { await users().delete(keyOf(target)); return json({ ok: true }); }
    }
    return fail('Not found.', 404);
  } catch (e) {
    console.error(e);
    if (e.userMsg) return fail(e.userMsg, 503);
    if (e.code === 'EAUTH') return fail('The email sender isn\'t working right now. Please try again later.', 503);
    return fail('Something went wrong on the server. Try again.', 500);
  }
};
