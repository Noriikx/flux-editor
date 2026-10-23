// Runs on Netlify after someone pays with Stripe.
// It checks the payment with Stripe, then returns a signed Flux Premium licence key.
// Needs two Netlify environment variables: STRIPE_SECRET_KEY and FLUX_PRIVATE_KEY.
import crypto from 'node:crypto';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default async (req) => {
  const id = new URL(req.url).searchParams.get('session_id') || '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json({ error: 'Missing purchase id.' }, 400);
  const secret = process.env.STRIPE_SECRET_KEY, priv = process.env.FLUX_PRIVATE_KEY;
  if (!secret || !priv) return json({ error: 'The shop is not fully set up yet.' }, 500);

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions/' + id, { headers: { Authorization: 'Bearer ' + secret } });
  const s = await r.json();
  if (!r.ok) return json({ error: 'We could not find that purchase.' }, 404);
  if (s.payment_status !== 'paid') return json({ error: 'This payment has not gone through yet. Refresh in a minute.' }, 402);

  const email = (s.customer_details && s.customer_details.email) || '';
  // Same purchase always gives the same key, so reopening this page is safe.
  const data = Buffer.from(JSON.stringify({ e: email, s: id.slice(-12), p: 'premium' }));
  const key = crypto.createPrivateKey({ key: Buffer.from(priv.trim(), 'base64'), format: 'der', type: 'pkcs8' });
  const sig = crypto.sign(null, data, key);
  return json({ key: 'FLUX-' + data.toString('base64url') + '.' + sig.toString('base64url'), email });
};
