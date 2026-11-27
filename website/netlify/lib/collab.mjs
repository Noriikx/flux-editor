// Flux Collaboration: several people editing one project at the same time.
// Everything lives in the "collab" blob store:
//   m/<cid>        who owns the project, who can edit it, who's invited
//   s/<cid>        the project as of a point in time ("snapshot")
//   o/<cid>/<key>  each change someone made after that (keys sort by time, so everyone applies them in the same order)
//   p/<cid>/<uid>  who's in the project right now (and where their playhead is)
//   i/<uid>        the projects someone owns, can edit, or is invited to
// Videos and pictures are NOT uploaded: everyone uses their own copy of the files (Flux asks for any that are missing).

const MAX_EDITORS = 10, MAX_SHARED = 30, MAX_BODY = 4_500_000, COMPACT_AT = 120, LIVE_MS = 20_000;
const okId = (s) => /^[a-z0-9]{6,40}$/i.test(String(s || ''));
// a change written a moment before someone else's list can land just behind their bookmark, so each list looks
// 8 seconds back and the app skips the ones it already has
const lookBack = (k) => { const t = parseInt(String(k || '').split('-')[0], 36); return t ? Math.max(0, t - 8000).toString(36).padStart(9, '0') : ''; };
const opKey = () => Date.now().toString(36).padStart(9, '0') + '-' + Math.random().toString(36).slice(2, 8);

// the same rules the app uses to apply a change
export function applyOps(doc, ops) {
  for (const op of ops || []) {
    if (!Array.isArray(op)) continue;
    const [t, a, b] = op;
    if (t === 'k' && ['name', 'tracks', 'aspect', 'background', 'markers', 'output', 'folders'].includes(a)) doc[a] = b;
    else if ((t === 'u' || t === 'd') && (a === 'clips' || a === 'media')) {
      const arr = Array.isArray(doc[a]) ? doc[a] : (doc[a] = []);
      const id = t === 'u' ? b && b.id : b;
      const i = arr.findIndex((x) => x && x.id === id);
      if (t === 'd') { if (i >= 0) arr.splice(i, 1); }
      else if (b && b.id) { if (i >= 0) arr[i] = b; else arr.push(b); }
    }
  }
  return doc;
}

export async function collabRoute(route, x) {
  if (!route.startsWith('collab/')) return null;
  const { req, body, me, json, fail, store, userByUid, userByName, getUser, card, ensureUid, saveUser, isVerified } = x;
  if (await ensureUid(me)) await saveUser(me);
  const U = me.uid, st = store();
  const idx = async (uid) => Object.assign({ own: [], member: [], invites: [] }, (await st.get('i/' + uid, { type: 'json' })) || {});
  const saveIdx = (uid, v) => st.setJSON('i/' + uid, v);
  const meta = async (cid) => (okId(cid) ? await st.get('m/' + cid, { type: 'json' }) : null);
  const can = (m) => m && (m.owner === U || (m.members || []).includes(U));
  const people = async (m) => {
    const out = [];
    for (const uid of [m.owner, ...(m.members || [])]) { const u = await userByUid(uid); if (u && !u.banned) out.push({ ...(await card(u)), owner: uid === m.owner }); }
    const invites = [];
    for (const uid of m.invites || []) {
      if ((m.via || {})[uid] === 'email') invites.push({ uid, hidden: true }); // added by email: who it is stays private until they accept
      else { const u = await userByUid(uid); if (u) invites.push(await card(u)); }
    }
    return { members: out, invites };
  };
  const listOps = async (cid, after) => {
    const { blobs } = await st.list({ prefix: 'o/' + cid + '/' });
    const keys = blobs.map((b) => b.key.slice(('o/' + cid + '/').length)).filter((k) => !after || k > after).sort();
    return keys;
  };
  const presence = async (cid) => {
    const { blobs } = await st.list({ prefix: 'p/' + cid + '/' });
    const out = [];
    for (const b of blobs) {
      const p = await st.get(b.key, { type: 'json' });
      if (!p || Date.now() - p.at > LIVE_MS) continue;
      const uid = b.key.split('/').pop(), u = await userByUid(uid);
      if (u) out.push({ ...(await card(u)), time: p.time || 0, sel: p.sel || null, at: p.at, me: uid === U });
    }
    return out;
  };
  const post = req.method === 'POST';

  // start sharing a project (or update the copy on the server)
  if (route === 'collab/share' && post) {
    const cid = String(body.cid || '');
    if (!okId(cid)) return fail('That project can’t be shared.');
    const raw = JSON.stringify(body.doc || {});
    if (raw.length > MAX_BODY) return fail('This project is too big to share.');
    let m = await meta(cid);
    if (m && m.owner !== U) return fail('Only the owner can do that.', 403);
    const ix = await idx(U);
    if (!m) {
      if (ix.own.length >= MAX_SHARED) return fail(`You can share up to ${MAX_SHARED} projects. Stop sharing an old one first.`);
      m = { id: cid, owner: U, name: String(body.name || 'Project').slice(0, 80), members: [], invites: [], via: {}, created: Date.now() };
      ix.own = [...new Set([...ix.own, cid])]; await saveIdx(U, ix);
      await st.setJSON('s/' + cid, { doc: JSON.parse(raw), upto: '' });
    }
    m.name = String(body.name || m.name).slice(0, 80); m.updated = Date.now();
    await st.setJSON('m/' + cid, m);
    return json({ ok: true, cid, ...(await people(m)) });
  }
  // what's shared with me
  if (route === 'collab/list') {
    const ix = await idx(U), out = { own: [], member: [], invites: [] };
    for (const k of ['own', 'member', 'invites']) {
      for (const cid of ix[k]) {
        const m = await meta(cid); if (!m) continue;
        if (k !== 'invites' && !can(m)) continue;
        const owner = await userByUid(m.owner);
        out[k].push({ cid, name: m.name, owner: owner ? await card(owner) : null, editors: (m.members || []).length + 1, updated: m.updated || m.created, live: (await presence(cid)).filter((p) => !p.me).length });
      }
    }
    return json(out);
  }
  if (route === 'collab/members') {
    const m = await meta(body.cid || new URL(req.url).searchParams.get('cid'));
    if (!can(m)) return fail('You don’t have access to this project.', 403);
    if (!post) return json(await people(m));
    if (m.owner !== U) return fail('Only the owner can change who edits this project.', 403);
    if (body.remove) {
      const R = String(body.remove);
      m.members = (m.members || []).filter((u) => u !== R); m.invites = (m.invites || []).filter((u) => u !== R);
      const ix = await idx(R); ix.member = ix.member.filter((c) => c !== m.id); ix.invites = ix.invites.filter((c) => c !== m.id); await saveIdx(R, ix);
      await st.delete('p/' + m.id + '/' + R).catch(() => {});
    } else if (body.add || body.uid) {
      if ((m.members || []).length + (m.invites || []).length >= MAX_EDITORS) return fail(`Up to ${MAX_EDITORS} people can edit a project.`);
      const raw = String(body.add || '').trim(), byEmail = raw.includes('@') && !raw.startsWith('@');
      const other = body.uid ? await userByUid(body.uid) : byEmail ? await getUser(raw.toLowerCase()) : await userByName(raw.replace(/^@/, ''));
      const real = other && !other.banned && other.hash && isVerified(other);
      if (!real) { if (byEmail) return json({ ok: true, invited: true, ...(await people(m)) }); return fail('No one has that username.', 404); }
      await ensureUid(other);
      if (other.uid === U) return fail('That’s you!');
      if ((m.members || []).includes(other.uid)) return fail('They can already edit this project.');
      m.invites = [...new Set([...(m.invites || []), other.uid])];
      m.via = { ...(m.via || {}), [other.uid]: byEmail ? 'email' : 'name' };
      const ix = await idx(other.uid); ix.invites = [...new Set([...ix.invites, m.id])]; await saveIdx(other.uid, ix);
    } else return fail('Nothing to change.');
    await st.setJSON('m/' + m.id, m);
    return json({ ok: true, invited: !!(body.add || body.uid), ...(await people(m)) });
  }
  if ((route === 'collab/accept' || route === 'collab/decline' || route === 'collab/leave') && post) {
    const m = await meta(body.cid); if (!m) return fail('That project isn’t shared any more.', 404);
    const ix = await idx(U);
    ix.invites = ix.invites.filter((c) => c !== m.id);
    m.invites = (m.invites || []).filter((u) => u !== U);
    if (route === 'collab/accept') {
      if (!(m.via || {})[U] && !(m.members || []).includes(U)) return fail('That invite is gone.');
      m.members = [...new Set([...(m.members || []), U])]; ix.member = [...new Set([...ix.member, m.id])];
    } else { m.members = (m.members || []).filter((u) => u !== U); ix.member = ix.member.filter((c) => c !== m.id); await st.delete('p/' + m.id + '/' + U).catch(() => {}); }
    if (m.via) delete m.via[U];
    await saveIdx(U, ix); await st.setJSON('m/' + m.id, m);
    return json({ ok: true });
  }
  if (route === 'collab/stop' && post) {
    const m = await meta(body.cid); if (!m) return json({ ok: true });
    if (m.owner !== U) return fail('Only the owner can stop sharing.', 403);
    for (const uid of [m.owner, ...(m.members || []), ...(m.invites || [])]) { const ix = await idx(uid); for (const k of ['own', 'member', 'invites']) ix[k] = ix[k].filter((c) => c !== m.id); await saveIdx(uid, ix); }
    for (const pre of ['o/' + m.id + '/', 'p/' + m.id + '/']) { const { blobs } = await st.list({ prefix: pre }); for (const b of blobs) await st.delete(b.key).catch(() => {}); }
    await st.delete('s/' + m.id).catch(() => {}); await st.delete('m/' + m.id).catch(() => {});
    return json({ ok: true });
  }
  // open a shared project: the snapshot plus every change since
  if (route === 'collab/open') {
    const m = await meta(body.cid || new URL(req.url).searchParams.get('cid'));
    if (!can(m)) return fail('You don’t have access to this project (the owner may have removed you).', 403);
    const snap = (await st.get('s/' + m.id, { type: 'json' })) || { doc: {}, upto: '' };
    const keys = await listOps(m.id, snap.upto);
    for (const k of keys) { const o = await st.get('o/' + m.id + '/' + k, { type: 'json' }); if (o) applyOps(snap.doc, o.ops); }
    return json({ cid: m.id, name: m.name, owner: m.owner === U, ownerUid: m.owner, doc: snap.doc, cursor: keys[keys.length - 1] || snap.upto || '', seen: keys.slice(-60), ...(await people(m)) });
  }
  // the heartbeat: send my changes, get everyone else's, and say I'm here
  if (route === 'collab/sync' && post) {
    const m = await meta(body.cid);
    if (!can(m)) return json({ gone: true });
    const ops = Array.isArray(body.ops) ? body.ops : [];
    let mine = null;
    if (ops.length) {
      if (JSON.stringify(ops).length > MAX_BODY) return fail('That change is too big to send.');
      mine = opKey();
      await st.setJSON('o/' + m.id + '/' + mine, { by: U, ops });
    }
    await st.setJSON('p/' + m.id + '/' + U, { at: Date.now(), time: +body.time || 0, sel: body.sel ? String(body.sel).slice(0, 40) : null });
    const keys = await listOps(m.id, lookBack(body.cursor));
    const out = [];
    for (const k of keys) { const o = await st.get('o/' + m.id + '/' + k, { type: 'json' }); if (o) out.push({ k, by: o.by, ops: o.ops }); }
    // fold old changes into the snapshot now and then, so opening stays fast
    const all = await listOps(m.id, '');
    if (all.length > COMPACT_AT) {
      const snap = (await st.get('s/' + m.id, { type: 'json' })) || { doc: {}, upto: '' };
      const fold = all.slice(0, all.length - 20).filter((k) => k > (snap.upto || ''));
      if (fold.length) {
        for (const k of fold) { const o = await st.get('o/' + m.id + '/' + k, { type: 'json' }); if (o) applyOps(snap.doc, o.ops); }
        snap.upto = fold[fold.length - 1];
        await st.setJSON('s/' + m.id, snap);
        for (const k of fold) await st.delete('o/' + m.id + '/' + k).catch(() => {});
      }
    }
    return json({ cursor: [String(body.cursor || ''), ...keys].sort().pop(), ops: out, mine, presence: await presence(m.id), name: m.name, editors: (m.members || []).length + 1, owner: m.owner === U });
  }
  return fail('Not found.', 404);
}

// when someone deletes their account: their shared projects are deleted, and they leave everyone else's
export async function collabForget(uid, st) {
  const ix = Object.assign({ own: [], member: [], invites: [] }, (await st.get('i/' + uid, { type: 'json' })) || {});
  for (const cid of ix.own) {
    const m = await st.get('m/' + cid, { type: 'json' });
    if (m && m.owner === uid) {
      for (const u of [...(m.members || []), ...(m.invites || [])]) {
        const o = await st.get('i/' + u, { type: 'json' });
        if (o) { for (const k of ['own', 'member', 'invites']) o[k] = (o[k] || []).filter((c) => c !== cid); await st.setJSON('i/' + u, o); }
      }
    }
    for (const pre of ['o/' + cid + '/', 'p/' + cid + '/']) { const { blobs } = await st.list({ prefix: pre }); for (const b of blobs) await st.delete(b.key).catch(() => {}); }
    await st.delete('s/' + cid).catch(() => {}); await st.delete('m/' + cid).catch(() => {});
  }
  for (const cid of [...ix.member, ...ix.invites]) {
    const m = await st.get('m/' + cid, { type: 'json' });
    if (!m) continue;
    m.members = (m.members || []).filter((u) => u !== uid); m.invites = (m.invites || []).filter((u) => u !== uid);
    if (m.via) delete m.via[uid];
    await st.setJSON('m/' + cid, m);
    await st.delete('p/' + cid + '/' + uid).catch(() => {});
  }
  await st.delete('i/' + uid).catch(() => {});
}
