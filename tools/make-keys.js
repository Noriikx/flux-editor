// Creates your licence signing keys (one time) and a Premium key for you.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const privFile = path.join(root, 'PRIVATE-KEY.txt');
let privB64;
if (fs.existsSync(privFile)) {
  privB64 = fs.readFileSync(privFile, 'utf8').trim();
  console.log('Using your existing keys (PRIVATE-KEY.txt).');
} else {
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  privB64 = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
  fs.writeFileSync(privFile, privB64 + '\n');
  console.log('Made new keys.');
}
const priv = crypto.createPrivateKey({ key: Buffer.from(privB64, 'base64'), format: 'der', type: 'pkcs8' });
const pubB64 = crypto.createPublicKey(priv).export({ format: 'der', type: 'spki' }).toString('base64');
const proFile = path.join(root, 'src', 'pro.js');
fs.writeFileSync(proFile, fs.readFileSync(proFile, 'utf8').replace(/const LICENSE_PUBLIC_KEY = '[^']*';/, `const LICENSE_PUBLIC_KEY = '${pubB64}';`));
const data = Buffer.from(JSON.stringify({ e: 'owner', s: 'owner', p: 'premium' }));
const myKey = 'FLUX-' + data.toString('base64url') + '.' + crypto.sign(null, data, priv).toString('base64url');
fs.writeFileSync(path.join(root, 'MY-PREMIUM-KEY.txt'), myKey + '\n');
console.log('\nYour own Premium key (also saved in MY-PREMIUM-KEY.txt):\n\n' + myKey + '\n');
console.log('NEVER share PRIVATE-KEY.txt or upload it anywhere except Netlify.');
