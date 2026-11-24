/* =====================================================================
   Flux 1.7.1 — home tabs (Projects · Templates · Achievements · Friends · Trash), template previews and
   community templates, profiles (picture, badges, friends, following, privacy, 2-step verification),
   achievements & stats, theme brightness and Smart Rendering settings.
   ===================================================================== */
'use strict';
const esc71 = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const signedIn = () => !!(settings.account && settings.account.token);

/* ============================ badges ============================ */
const BADGE_INFO = {
  founder: { name: 'Founder', desc: 'Created Flux', color: '#f2c94c', icon: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>' },
  developer: { name: 'Developer', desc: 'Builds Flux', color: '#4cb8ff', icon: '<path d="m8 8-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14"/>' },
  verified: { name: 'Verified', desc: 'A verified creator', color: '#3fa9ff', icon: '<path d="M12 2.5l2.4 1.8 3-.3 1 2.8 2.6 1.6-.9 2.9.9 2.9-2.6 1.6-1 2.8-3-.3L12 21.5l-2.4-1.8-3 .3-1-2.8L3 15.6l.9-2.9L3 9.8l2.6-1.6 1-2.8 3 .3z"/><path d="m8.5 12 2.4 2.4 4.6-4.8"/>' },
  bughunter: { name: 'Bug Hunter', desc: 'Found and reported bugs that got fixed', color: '#7bd84a', icon: '<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M12 7V5M9 4l1.5 2M15 4l-1.5 2M4 11h4M16 11h4M4 16h4M16 16h4"/>' },
  contributor: { name: 'Contributor', desc: 'Helped make Flux better', color: '#c77dff', icon: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>' },
  support: { name: 'Support Team', desc: 'Helps people with Flux', color: '#3fdcb0', icon: '<path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19a3 3 0 0 1-3 3h-3"/>' },
  sponsor: { name: 'Sponsor', desc: 'Supports Flux', color: '#ff6fae', icon: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>' },
  creator: { name: 'Content Creator', desc: 'Makes videos with Flux', color: '#ff8a4c', icon: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>' },
  educator: { name: 'Educator', desc: 'Creates official Flux tutorials', color: '#ffd23f', icon: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>' },
  premium: { name: 'Premium', desc: 'Has Flux Premium', color: '#d8b674', icon: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M12 21 8 9l4-6 4 6z"/>' }
};
function badgesHtml(list, big) {
  return (list || []).filter((b) => BADGE_INFO[b]).map((b) => {
    const x = BADGE_INFO[b];
    return `<span class="fx-badge${big ? ' big' : ''}" style="--bc:${x.color}" data-tip="${esc71(x.name + ' - ' + x.desc)}"><svg viewBox="0 0 24 24">${x.icon}</svg>${big ? `<b>${esc71(x.name)}</b>` : ''}</span>`;
  }).join('');
}
function avatarHtml(u, size = 40) {
  const name = (u && u.username) || '?';
  const src = u && u.avatar ? avatarSrc(u.avatar) : '';
  return `<span class="fx-av" style="--s:${size}px">${src ? `<img src="${esc71(src)}" alt="">` : esc71(name[0].toUpperCase())}</span>`;
}

/* ============================ stats (for achievements) ============================ */
const STATS_KEY = 'flux.stats';
function loadStats() { try { return Object.assign({ days: {} }, JSON.parse(localStorage.getItem(STATS_KEY) || '{}')); } catch { return { days: {} }; } }
let fluxStats = loadStats();
let statsTimer = null;
function saveStats() { clearTimeout(statsTimer); statsTimer = setTimeout(() => { try { localStorage.setItem(STATS_KEY, JSON.stringify(fluxStats)); } catch {} }, 400); }
function bump(k, n = 1) { fluxStats[k] = (fluxStats[k] || 0) + n; saveStats(); }
function maxStat(k, v) { if (v > (fluxStats[k] || 0)) { fluxStats[k] = v; saveStats(); } }
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function markActive() {
  const d = new Date(), k = dayKey(d);
  if (!fluxStats.days[k]) {
    fluxStats.days[k] = 1;
    const keys = Object.keys(fluxStats.days).sort();
    if (keys.length > 800) for (const x of keys.slice(0, keys.length - 800)) delete fluxStats.days[x];
  }
  const h = d.getHours();
  if (h < 4) fluxStats.nightOwl = 1;
  if (h >= 5 && h < 7) fluxStats.earlyBird = 1;
  if (d.getDay() === 6) fluxStats.sat = 1;
  if (d.getDay() === 0) fluxStats.sun = 1;
  saveStats();
}
function streaks() {
  const days = Object.keys(fluxStats.days || {}).sort();
  let best = 0, cur = 0, prev = null;
  for (const k of days) {
    const t = new Date(k + 'T12:00:00').getTime();
    cur = prev !== null && Math.round((t - prev) / 864e5) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur); prev = t;
  }
  const today = new Date(dayKey() + 'T12:00:00').getTime();
  const live = prev !== null && Math.round((today - prev) / 864e5) <= 1 ? cur : 0;
  return { best, live, days: days.length };
}
// count things as they happen (wrapping the app's own functions, so nothing else changes)
function hook(name, fn) {
  const base = window[name];
  if (typeof base !== 'function') return;
  window[name] = function () { try { fn.apply(this, arguments); } catch {} return base.apply(this, arguments); };
}
hook('createProject', () => bump('projects'));
hook('splitAt', () => bump('splits'));
hook('addText', () => bump('texts'));
hook('setTransition', (c, type) => { if (type && type !== 'none') bump('transitions'); });
hook('addEffect', () => bump('effects'));
hook('reverseClip', () => bump('reversed'));
hook('stopRecording', () => bump('voiceovers'));
hook('freezeFrame', () => bump('freezes'));
hook('undo', () => bump('undos'));
hook('runCaptions', () => bump('captions'));
hook('addTrackToTimeline', () => bump('songs'));
hook('createFromTemplate', () => bump('templatesUsed'));
hook('shCreate', () => bump('shorts'));
hook('toggleKeyframe', () => bump('keyframes'));
hook('importFiles', (files) => bump('imports', (files && files.length) || 1));
{
  const baseDone = window.exportDone;
  if (typeof baseDone === 'function') window.exportDone = function (res) {
    try {
      if (res && res.ok) {
        bump('exports'); bump('exportSecs', Math.round(typeof projectDuration === 'function' ? projectDuration() : 0));
        if (res.smart) { bump('smartExports'); res.note = (res.note ? res.note + '\n' : '') + `Smart Rendering copied ${Math.round(res.copied || 0)} s of your original video without re-encoding (faster, no quality loss).`; }
        if (window.P) { maxStat('maxClips', P.clips.length); maxStat('maxDuration', Math.round(projectDuration())); }
      }
    } catch {}
    return baseDone.apply(this, arguments);
  };
  const baseApi = window.apiCall;
  if (typeof baseApi === 'function') window.apiCall = async function (path, body) {
    const r = await baseApi.apply(this, arguments);
    try {
      if (!r.error && path === 'feedback') bump(body && body.kind === 'bug' ? 'bugReports' : 'ideas');
      if (!r.error && path === 'templates/submit') bump('tplShared');
    } catch {}
    return r;
  };
  const baseTheme = window.applyTheme;
  if (typeof baseTheme === 'function') window.applyTheme = function (id) { try { if (id) { const t = new Set(fluxStats.themes || []); if (!t.has(id)) { t.add(id); fluxStats.themes = [...t]; saveStats(); } } } catch {} return baseTheme.apply(this, arguments); };
}
// time spent editing: counted in 30-second steps while you're actually working
let lastInput = Date.now();
['pointerdown', 'keydown', 'wheel'].forEach((ev) => window.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
setInterval(() => {
  if (!state.inEditor || document.hidden || Date.now() - lastInput > 120000) return;
  bump('editSecs', 30); markActive();
  if (window.P) maxStat('maxClips', P.clips.length);
}, 30000);
markActive();

/* ============================ achievements ============================ */
const ACH = [
  // getting started
  ['first-project', 'Fresh start', 'Make your first project', 'projects', 1, 'spark'],
  ['projects-10', 'Busy bee', 'Make 10 projects', 'projects', 10, 'stack'],
  ['projects-50', 'Studio boss', 'Make 50 projects', 'projects', 50, 'stack'],
  ['import-100', 'Collector', 'Import 100 files', 'imports', 100, 'box'],
  // exporting
  ['export-1', 'It’s alive!', 'Export your first video', 'exports', 1, 'film'],
  ['export-10', 'On a roll', 'Export 10 videos', 'exports', 10, 'film'],
  ['export-50', 'Export machine', 'Export 50 videos', 'exports', 50, 'film'],
  ['export-100', 'Legend', 'Export 100 videos', 'exports', 100, 'crown'],
  ['minutes-10', 'Short film', 'Export 10 minutes of video', 'exportSecs', 600, 'clock'],
  ['minutes-60', 'Feature film', 'Export 1 hour of video', 'exportSecs', 3600, 'clock'],
  ['minutes-300', 'Film festival', 'Export 5 hours of video', 'exportSecs', 18000, 'clock'],
  ['smart', 'Work smarter', 'Export with Smart Rendering', 'smartExports', 1, 'bolt'],
  // editing
  ['split-10', 'Snip snip', 'Split clips 10 times', 'splits', 10, 'cut'],
  ['split-100', 'Scissor hands', 'Split clips 100 times', 'splits', 100, 'cut'],
  ['split-1000', 'Cutting master', 'Split clips 1,000 times', 'splits', 1000, 'cut'],
  ['text-1', 'Say something', 'Add your first text', 'texts', 1, 'text'],
  ['text-50', 'Wordsmith', 'Add 50 texts', 'texts', 50, 'text'],
  ['trans-1', 'Smooth move', 'Add a transition', 'transitions', 1, 'swap'],
  ['trans-100', 'Smooth operator', 'Add 100 transitions', 'transitions', 100, 'swap'],
  ['fx-1', 'Abracadabra', 'Add an effect', 'effects', 1, 'wand'],
  ['fx-50', 'Effects wizard', 'Add 50 effects', 'effects', 50, 'wand'],
  ['kf-10', 'Animator', 'Set 10 keyframes', 'keyframes', 10, 'diamond'],
  ['reverse', 'Rewind', 'Reverse a clip', 'reversed', 1, 'rewind'],
  ['freeze', 'Freeze!', 'Make a freeze frame', 'freezes', 1, 'snow'],
  ['undo-100', 'Second thoughts', 'Press undo 100 times', 'undos', 100, 'undo'],
  ['big-project', 'Epic edit', 'Have 100 clips in one project', 'maxClips', 100, 'stack'],
  ['long-project', 'Marathon', 'Make a project 10 minutes long', 'maxDuration', 600, 'clock'],
  // sound & words
  ['captions-1', 'Subtitled', 'Make auto captions', 'captions', 1, 'cc'],
  ['captions-20', 'Caption king', 'Make auto captions 20 times', 'captions', 20, 'cc'],
  ['voice-1', 'On air', 'Record a voiceover', 'voiceovers', 1, 'mic'],
  ['voice-25', 'Narrator', 'Record 25 voiceovers', 'voiceovers', 25, 'mic'],
  ['song-1', 'DJ', 'Add a song from the music library', 'songs', 1, 'note'],
  ['song-50', 'Playlist', 'Add 50 songs', 'songs', 50, 'note'],
  // templates & shorts
  ['tpl-1', 'Quick start', 'Use a template', 'templatesUsed', 1, 'grid'],
  ['tpl-share', 'Trendsetter', 'Share your own template', 'tplShared', 1, 'share'],
  ['shorts-1', 'Gone viral', 'Make a Viral Short', 'shorts', 1, 'bolt'],
  ['shorts-25', 'Shorts factory', 'Make 25 Viral Shorts', 'shorts', 25, 'bolt'],
  // time & habits
  ['hours-1', 'Getting into it', 'Edit for 1 hour', 'editSecs', 3600, 'clock'],
  ['hours-10', 'Dedicated', 'Edit for 10 hours', 'editSecs', 36000, 'clock'],
  ['hours-50', 'Pro editor', 'Edit for 50 hours', 'editSecs', 180000, 'clock'],
  ['hours-100', 'No life (in a good way)', 'Edit for 100 hours', 'editSecs', 360000, 'crown'],
  ['days-7', 'Regular', 'Use Flux on 7 different days', '#days', 7, 'cal'],
  ['days-30', 'Part of the routine', 'Use Flux on 30 different days', '#days', 30, 'cal'],
  ['streak-3', 'Warming up', 'Edit 3 days in a row', '#streak', 3, 'fire'],
  ['streak-7', 'On fire', 'Edit 7 days in a row', '#streak', 7, 'fire'],
  ['streak-30', 'Unstoppable', 'Edit 30 days in a row', '#streak', 30, 'fire'],
  ['night', 'Night owl', 'Edit after midnight', 'nightOwl', 1, 'moon'],
  ['early', 'Early bird', 'Edit between 5 and 7 in the morning', 'earlyBird', 1, 'sun'],
  ['weekend', 'Weekend warrior', 'Edit on a Saturday and a Sunday', '#weekend', 2, 'cal'],
  ['themes-5', 'Interior designer', 'Try 5 different themes', '#themes', 5, 'palette'],
  // community
  ['bug-1', 'Bug spotter', 'Send a bug report', 'bugReports', 1, 'bug'],
  ['idea-1', 'Idea machine', 'Request a feature', 'ideas', 1, 'spark'],
  ['friend-1', 'Not alone', 'Make a friend on Flux', '#friends', 1, 'people'],
  ['friend-10', 'Popular', 'Have 10 friends', '#friends', 10, 'people'],
  ['followers-10', 'Influencer', 'Get 10 followers', '#followers', 10, 'people'],
  ['avatar', 'Say cheese', 'Add a profile picture', '#avatar', 1, 'cam'],
  ['twofa', 'Safety first', 'Turn on 2-step verification', '#twofa', 1, 'lock']
];
const ACH_ICONS = {
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>', stack: '<rect x="4" y="4" width="12" height="12" rx="2"/><path d="M8 20h10a2 2 0 0 0 2-2V8"/>',
  box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/>', film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  cut: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>', text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  swap: '<rect x="2" y="6" width="9" height="12" rx="1.5"/><rect x="13" y="6" width="9" height="12" rx="1.5"/>', wand: '<path d="m4 20 12-12M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>',
  diamond: '<path d="M12 3 21 12 12 21 3 12z"/>', rewind: '<path d="M11 19 2 12l9-7zM22 19l-9-7 9-7z"/>', snow: '<path d="M12 2v20M4 6l16 12M20 6 4 18"/>', undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  cc: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 10.5a2 2 0 1 0 0 3M17 10.5a2 2 0 1 0 0 3"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  fire: '<path d="M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-5 5-5 8-1-1-2-2-2-4-2 2-2 5-2 8 0 4 3 7 7 7z"/>', moon: '<path d="M20 15A8 8 0 1 1 9 4a7 7 0 0 0 11 11z"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-2 0-3 3 0 4-1 3-3 3-6a9 9 0 0 0-9-6z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="11" cy="7.5" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/>',
  bug: '<rect x="8" y="7" width="8" height="12" rx="4"/><path d="M12 7V5M4 11h4M16 11h4M4 16h4M16 16h4"/>', people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 6 5"/>',
  cam: '<rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l2-3h4l2 3"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'
};
let socialCounts = null;
function statValue(k) {
  const s = fluxStats, st = streaks(), a = settings.account || {};
  switch (k) {
    case '#days': return st.days;
    case '#streak': return st.best;
    case '#weekend': return (s.sat ? 1 : 0) + (s.sun ? 1 : 0);
    case '#themes': return (s.themes || []).length;
    case '#friends': return socialCounts ? socialCounts.friends : (s.friendsSeen || 0);
    case '#followers': return socialCounts ? socialCounts.followers : (s.followersSeen || 0);
    case '#avatar': return a.avatar ? 1 : 0;
    case '#twofa': return a.twoFactor ? 1 : 0;
    case 'projects': return Math.max(s.projects || 0, typeof homeProjects !== 'undefined' ? homeProjects.length : 0);
    default: return s[k] || 0;
  }
}
const fmtDur = (sec) => { sec = Math.round(sec || 0); if (sec < 60) return sec + ' s'; if (sec < 3600) return Math.round(sec / 60) + ' min'; return (sec / 3600).toFixed(sec < 36000 ? 1 : 0) + ' h'; };
function renderAchievements(page) {
  if (signedIn() && !socialCounts) apiCall('profile', null, settings.account.token).then((r) => { if (r.profile) { socialCounts = { friends: r.profile.friends || 0, followers: r.profile.followers || 0 }; fluxStats.friendsSeen = socialCounts.friends; fluxStats.followersSeen = socialCounts.followers; saveStats(); if (page.isConnected && page.classList.contains('on')) renderAchievements(page); } });
  const st = streaks();
  const got = ACH.filter((x) => statValue(x[3]) >= x[4]);
  const nums = [
    ['Projects made', statValue('projects')], ['Videos exported', fluxStats.exports || 0], ['Video exported', fmtDur(fluxStats.exportSecs)],
    ['Time editing', fmtDur(fluxStats.editSecs)], ['Cuts', fluxStats.splits || 0], ['Texts', fluxStats.texts || 0],
    ['Transitions', fluxStats.transitions || 0], ['Effects', fluxStats.effects || 0], ['Captions made', fluxStats.captions || 0],
    ['Voiceovers', fluxStats.voiceovers || 0], ['Songs added', fluxStats.songs || 0], ['Viral Shorts', fluxStats.shorts || 0],
    ['Days with Flux', st.days], ['Best streak', st.best + (st.best === 1 ? ' day' : ' days')], ['Current streak', st.live + (st.live === 1 ? ' day' : ' days')], ['Files imported', fluxStats.imports || 0]
  ];
  page.innerHTML = `<div class="hp-head"><div><h1>Achievements</h1><p>Your Flux stats and the badges you’ve earned. Just for fun - they unlock quietly as you edit.</p></div>
    <div class="ach-total"><b>${got.length}</b><small>of ${ACH.length} unlocked</small><span class="ach-ring" style="--p:${(got.length / ACH.length) * 100}"></span></div></div>
    <h2 class="hp-h2">Your stats</h2><div class="stat-grid">${nums.map(([n, v]) => `<div class="stat-card"><b>${esc71(typeof v === 'number' ? v.toLocaleString() : v)}</b><small>${esc71(n)}</small></div>`).join('')}</div>
    <h2 class="hp-h2">Achievements</h2><div class="ach-grid"></div>`;
  const grid = $('.ach-grid', page);
  const sorted = [...ACH].sort((a, b) => (statValue(b[3]) >= b[4]) - (statValue(a[3]) >= a[4]));
  for (const [id, name, desc, k, goal, icon] of sorted) {
    const v = statValue(k), done = v >= goal, pct = Math.min(100, (v / goal) * 100);
    const c = el('div', 'ach' + (done ? ' done' : ''));
    c.dataset.id = id;
    const show = (x) => k === 'exportSecs' || k === 'editSecs' || k === 'maxDuration' ? fmtDur(x) : Math.round(x).toLocaleString();
    c.innerHTML = `<span class="ach-ico"><svg viewBox="0 0 24 24">${ACH_ICONS[icon] || ACH_ICONS.spark}</svg></span><span class="ach-txt"><b>${esc71(name)}</b><small>${esc71(desc)}</small>
      ${done ? '<em>Unlocked</em>' : `<span class="ach-bar"><i style="width:${pct}%"></i></span><small class="ach-prog">${show(Math.min(v, goal))} / ${show(goal)}</small>`}</span>`;
    grid.appendChild(c);
  }
}

/* ============================ home tabs ============================ */
const HOME_TABS = [['projects', 'Projects'], ['templates', 'Templates'], ['achievements', 'Achievements'], ['friends', 'Friends'], ['trash', 'Trash']];
let homePage = 'projects';
function setupHomeTabs() {
  const inner = $('.home-inner');
  if (!inner || $('.home-nav')) return;
  const proj = el('div', 'home-page on'); proj.dataset.hp = 'projects';
  while (inner.firstChild) proj.appendChild(inner.firstChild);
  const nav = el('nav', 'home-nav');
  nav.innerHTML = HOME_TABS.map(([k, n]) => `<button data-hp="${k}" class="${k === 'projects' ? 'on' : ''}">${n}${k === 'friends' ? '<i class="hn-dot" hidden></i>' : ''}${k === 'trash' ? '<span class="hn-count" hidden></span>' : ''}</button>`).join('');
  inner.appendChild(nav); inner.appendChild(proj);
  for (const [k] of HOME_TABS.slice(1)) { const p = el('div', 'home-page'); p.dataset.hp = k; inner.appendChild(p); }
  $$('button', nav).forEach((b) => (b.onclick = () => showHomePage(b.dataset.hp)));
  const tplCard = $('.tpl-home'); if (tplCard) tplCard.onclick = () => showHomePage('templates');
}
function showHomePage(k) {
  homePage = k;
  $$('.home-nav button').forEach((b) => b.classList.toggle('on', b.dataset.hp === k));
  $$('.home-page').forEach((p) => p.classList.toggle('on', p.dataset.hp === k));
  const page = $(`.home-page[data-hp="${k}"]`);
  const sc = $('.home-scroll'); if (sc) sc.scrollTop = 0;
  if (k === 'templates') renderTemplatesPage(page);
  else if (k === 'achievements') renderAchievements(page);
  else if (k === 'friends') renderFriends(page);
  else if (k === 'trash') renderTrash(page);
  else refreshHome();
}

/* ============================ trash ============================ */
const hasTrash = () => !!(api && api.projectTrash);
async function updateTrashCount() {
  const c = $('.hn-count'); if (!c || !hasTrash()) return;
  try { const l = await api.trashList(); c.hidden = !l.length; c.textContent = l.length; } catch {}
}
deleteProjectDialog = function (p) {
  if (!hasTrash()) return deleteForeverDialog(p);
  const box = modal(`<h2>Move “<span class="n"></span>” to the Trash?</h2>
    <p class="sub">You can bring it back from <b>Trash</b> on the home screen for 30 days. After that it’s deleted for good. Your video, photo and music files are never touched.</p>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn danger" data-a="yes">Move to Trash</button></div>`);
  $('.n', box).textContent = p.name || 'Untitled project';
  $('[data-a=no]', box).onclick = closeModal;
  $('[data-a=yes]', box).onclick = async () => {
    closeModal();
    if (state.inEditor && P.id === p.id) { await saveNow(); state.inEditor = false; await goHome(); }
    const ok = await api.projectTrash(p.id);
    if (!ok) { toast('Couldn’t move that project to the Trash - close any program that might be using it and try again', { error: true }); return refreshHome(); }
    await refreshHome(); updateTrashCount();
    toast('Moved to the Trash', { action: 'Undo', onAction: async () => { const id = await api.trashRestore(p.id); if (id) { await refreshHome(); updateTrashCount(); toast('Project restored'); } } });
  };
};
function deleteForeverDialog(p, fromTrash) {
  const box = modal(`<h2>Delete “<span class="n"></span>” for good?</h2>
    <p class="sub">This can’t be undone. Your original video, photo and music files are not touched.</p>
    <div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn danger" data-a="yes">Delete forever</button></div>`);
  $('.n', box).textContent = p.name || 'Untitled project';
  $('[data-a=no]', box).onclick = closeModal;
  $('[data-a=yes]', box).onclick = async () => {
    closeModal();
    const ok = fromTrash ? await api.trashPurge(p.id) : await projectStore.remove(p.id);
    if (ok === false) return toast('Couldn’t delete that project', { error: true });
    toast('Deleted for good');
    if (fromTrash) renderTrash($('.home-page[data-hp=trash]')); else refreshHome();
    updateTrashCount();
  };
}
async function renderTrash(page) {
  page.innerHTML = `<div class="hp-head"><div><h1>Trash</h1><p>Deleted projects wait here for 30 days, so nothing is lost by accident.</p></div><button class="btn ghost" data-a="empty">Empty trash</button></div><div class="proj-grid trash-grid"></div>`;
  const grid = $('.trash-grid', page);
  if (!hasTrash()) { grid.innerHTML = '<p class="hp-empty">The Trash works in the Flux desktop app.</p>'; return; }
  let list = [];
  try { list = await api.trashList(); } catch {}
  $('[data-a=empty]', page).disabled = !list.length;
  $('[data-a=empty]', page).onclick = () => {
    const box = modal(`<h2>Empty the Trash?</h2><p class="sub">${list.length} project${list.length === 1 ? '' : 's'} will be deleted for good. This can’t be undone.</p><div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn danger" data-a="yes">Empty trash</button></div>`);
    $('[data-a=no]', box).onclick = closeModal;
    $('[data-a=yes]', box).onclick = async () => { closeModal(); await api.trashEmpty(); toast('Trash emptied'); renderTrash(page); updateTrashCount(); };
  };
  if (!list.length) { grid.outerHTML = `<div class="hp-empty"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg><h3>The Trash is empty</h3><p>Projects you delete show up here for 30 days.</p></div>`; return; }
  for (const p of list) {
    const [W, H] = ASPECTS[p.aspect] || ASPECTS['16:9'];
    const card = el('div', 'proj-card trash-card');
    card.innerHTML = `<div class="proj-thumb"><div class="proj-frame" style="aspect-ratio:${W}/${H}">${p.thumb ? `<img src="${p.thumb}" alt="">` : '<img src="logo.png" class="ph" alt="">'}</div><span class="proj-ar">${esc71(p.aspect || '16:9')}</span></div>
      <div class="proj-meta"><div class="proj-name"></div><div class="proj-sub">Deleted ${timeAgo(p.deletedAt)} · ${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'} left</div>
      <div class="trash-actions"><button class="btn sm" data-a="restore">Restore</button><button class="btn sm ghost danger-text" data-a="purge">Delete forever</button></div></div>`;
    $('.proj-name', card).textContent = p.name || 'Untitled project';
    $('[data-a=restore]', card).onclick = async () => { const id = await api.trashRestore(p.id); if (!id) return toast('Couldn’t restore it', { error: true }); toast('“' + (p.name || 'Project') + '” is back in your projects'); renderTrash(page); updateTrashCount(); };
    $('[data-a=purge]', card).onclick = () => deleteForeverDialog(p, true);
    grid.appendChild(card);
  }
}

/* ============================ templates: previews, community, sharing ============================ */
// an animated preview of a template: coloured "shots" with its timing, motion, transitions, look and titles
const niceName = (k) => { const x = String(k).replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()); return { 'Film400': 'Film 400', 'Tealorange': 'Teal & orange', 'Goldenhour': 'Golden hour', 'White': 'White flash', 'Black': 'Fade to black' }[x] || x; };
function tplTotal(tp) { return tp.slots.reduce((a, b) => a + b, 0); }
function hexToHsl(hex) {
  const n = parseInt(String(hex || '#888888').slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0; const l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60 + 360) % 360, Math.round(s * 100), Math.round(l * 100)];
}
const FILTER_TINT = { film400: 'rgba(255,190,120,.12)', vivid: 'rgba(255,0,150,.06)', goldenhour: 'rgba(255,170,60,.18)', cyber: 'rgba(0,255,200,.1)', matte: 'rgba(240,230,220,.12)', dreamy: 'rgba(255,190,240,.14)', tealorange: 'rgba(0,150,160,.14)' };
function drawShot(ctx, w, h, tp, i, k) {
  const [hue] = hexToHsl(tp.color), hh = (hue + i * 37) % 360;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, `hsl(${hh} 70% ${30 + (i % 3) * 6}%)`); g.addColorStop(1, `hsl(${(hh + 40) % 360} 60% ${12 + (i % 2) * 6}%)`);
  ctx.fillStyle = g; ctx.fillRect(-w * 0.1, -h * 0.1, w * 1.2, h * 1.2);
  // a simple "scene": sun + hills, different for every shot
  ctx.fillStyle = `hsla(${(hh + 180) % 360} 90% 80% / .85)`;
  ctx.beginPath(); ctx.arc(w * (0.25 + ((i * 0.31) % 0.5)), h * (0.3 + (i % 2) * 0.08), Math.min(w, h) * 0.09, 0, 7); ctx.fill();
  ctx.fillStyle = `hsla(${hh} 50% 8% / .75)`;
  ctx.beginPath(); ctx.moveTo(-w * 0.1, h);
  for (let x = 0; x <= 6; x++) ctx.lineTo(-w * 0.1 + (x / 6) * w * 1.2, h * (0.62 + 0.12 * Math.sin(x * 1.7 + i * 2.1)));
  ctx.lineTo(w * 1.1, h); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = `700 ${Math.round(Math.min(w, h) * 0.07)}px system-ui, sans-serif`; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('Clip ' + (i + 1), Math.min(w, h) * 0.05, Math.min(w, h) * 0.05);
  void k;
}
function drawTemplateFrame(cv, tp, t) {
  const ctx = cv.getContext('2d'), w = cv.width, h = cv.height;
  const total = tplTotal(tp);
  t = ((t % total) + total) % total;
  let acc = 0, i = 0;
  while (i < tp.slots.length - 1 && t >= acc + tp.slots[i]) { acc += tp.slots[i]; i++; }
  const local = t - acc, len = tp.slots[i], k = local / len;
  const motion = tp.motion[i % tp.motion.length] || 'none';
  const paint = (idx, kk, alpha, dx = 0, dy = 0, sc = 1) => {
    const m = tp.motion[idx % tp.motion.length] || 'none';
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(w / 2 + dx, h / 2 + dy);
    let z = sc, px = 0;
    if (m === 'zoomIn') z *= 1 + 0.12 * kk; else if (m === 'zoomOut') z *= 1.12 - 0.12 * kk; else if (m === 'panRight') px = -w * 0.05 + w * 0.1 * kk; else if (m === 'panLeft') px = w * 0.05 - w * 0.1 * kk;
    ctx.scale(z, z); ctx.translate(-w / 2 + px, -h / 2);
    drawShot(ctx, w, h, tp, idx, kk);
    ctx.restore();
  };
  ctx.clearRect(0, 0, w, h);
  const td = Math.min(0.5, len * 0.3);
  if (i > 0 && local < td && tp.trans) {
    const p = local / td, prev = i - 1, ty = tp.trans;
    if (ty === 'slide') { paint(prev, 1, 1, -w * p); paint(i, k, 1, w * (1 - p)); }
    else if (ty === 'slideUp') { paint(prev, 1, 1, 0, -h * p); paint(i, k, 1, 0, h * (1 - p)); }
    else if (ty === 'zoom' || ty === 'zoomPunch') { paint(prev, 1, 1 - p, 0, 0, 1 + p * 0.4); paint(i, k, p, 0, 0, 1.25 - 0.25 * p); }
    else if (ty === 'white' || ty === 'black') { paint(p < 0.5 ? prev : i, p < 0.5 ? 1 : k, 1); ctx.fillStyle = ty === 'white' ? '#fff' : '#000'; ctx.globalAlpha = 1 - Math.abs(p - 0.5) * 2; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; }
    else { paint(prev, 1, 1); paint(i, k, p); }
  } else paint(i, k, 1);
  void motion;
  if (FILTER_TINT[tp.filter]) { ctx.fillStyle = FILTER_TINT[tp.filter]; ctx.fillRect(0, 0, w, h); }
  if (tp.bars) { ctx.fillStyle = '#000'; const bh = h * 0.11; ctx.fillRect(0, 0, w, bh); ctx.fillRect(0, h - bh, w, bh); }
  // titles
  for (const x of tp.texts || []) {
    if (t < x.t || t > x.t + x.d) continue;
    const lt = t - x.t, inK = Math.min(1, lt / 0.35), outK = Math.min(1, (x.t + x.d - t) / 0.3);
    let sc = 1, al = Math.min(inK, outK);
    if (x.anim === 'pop') { sc = inK < 1 ? 0.6 + 0.55 * inK - 0.15 * Math.sin(inK * Math.PI) : 1; al = Math.min(1, outK); }
    const size = Math.max(9, (x.size / 1080) * Math.min(w, h) * (h > w ? 1.6 : 1));
    ctx.save(); ctx.globalAlpha = al; ctx.translate(w / 2, h * x.y); ctx.scale(sc, sc);
    ctx.font = `900 ${size}px ${x.font ? `"${x.font}", ` : ''}system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = size * 0.25; ctx.fillStyle = '#fff';
    const words = String(x.content).split(' '), lines = []; let cur = '';
    for (const wd of words) { const tr = cur ? cur + ' ' + wd : wd; if (ctx.measureText(tr).width > w * 0.86 && cur) { lines.push(cur); cur = wd; } else cur = tr; }
    lines.push(cur);
    lines.forEach((ln, j) => ctx.fillText(ln, 0, (j - (lines.length - 1) / 2) * size * 1.05));
    ctx.restore();
  }
  // timeline strip
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, h - 4, w, 4);
  ctx.fillStyle = tp.color; ctx.fillRect(0, h - 4, w * (t / total), 4);
}
function tplCanvas(tp, longSide) {
  const [aw, ah] = (tp.aspect || '16:9').split(':').map(Number);
  const cv = document.createElement('canvas');
  const sc = longSide / Math.max(aw, ah);
  cv.width = Math.round(aw * sc); cv.height = Math.round(ah * sc);
  return cv;
}
const tplAnims = new Set();
function animateTpl(cv, tp, autoplay) {
  const st = { cv, tp, t: 0.6, playing: !!autoplay, last: 0 };
  drawTemplateFrame(cv, tp, st.t);
  const tick = (now) => {
    if (!cv.isConnected) { tplAnims.delete(st); return; }
    if (st.playing) { if (st.last) st.t += (now - st.last) / 1000; st.last = now; drawTemplateFrame(cv, tp, st.t); }
    else st.last = 0;
    requestAnimationFrame(tick);
  };
  tplAnims.add(st); requestAnimationFrame(tick);
  return st;
}
let communityTpls = null, communityAt = 0;
async function loadCommunityTemplates(force) {
  if (!force && communityTpls && Date.now() - communityAt < 120000) return communityTpls;
  try {
    const r = await fetch(API_BASE + 'templates');
    const j = await r.json();
    communityTpls = (j.items || []).map((x) => ({ ...x.tpl, id: 'c-' + x.id, name: x.name, desc: x.desc, by: x.by, sub: (x.tpl.aspect || '16:9') + ' · by @' + x.by, community: true }));
    communityAt = Date.now();
  } catch { communityTpls = communityTpls || null; }
  return communityTpls;
}
function tplCard(tp) {
  const card = el('div', 'tplx-card');
  card.style.setProperty('--tc', tp.color || '#d8b674');
  const cv = tplCanvas(tp, 320);
  const total = tplTotal(tp);
  card.innerHTML = `<div class="tplx-prev"><span class="tplx-play"><svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7z"/></svg></span></div>
    <div class="tplx-meta"><b></b><small></small></div>`;
  $('.tplx-prev', card).prepend(cv);
  $('.tplx-meta b', card).textContent = tp.name;
  $('.tplx-meta small', card).textContent = `${tp.sub || tp.aspect} · ${tp.slots.length} clips · ${Math.round(total)}s`;
  const st = animateTpl(cv, tp, false);
  card.onmouseenter = () => { st.playing = true; };
  card.onmouseleave = () => { st.playing = false; st.t = 0.6; drawTemplateFrame(cv, tp, st.t); };
  card.onclick = () => openTemplatePreview(tp);
  return card;
}
function openTemplatePreview(tp) {
  const total = tplTotal(tp);
  const box = modal(`<div class="tplx-view"><div class="tplx-big"></div><div class="tplx-side">
      <span class="tplx-kicker">${tp.community ? 'Community template' : 'Flux template'}</span><h2></h2><p class="sub tplx-desc"></p>
      <ul class="tplx-facts"><li><b>${esc71(tp.aspect)}</b> shape</li><li><b>${tp.slots.length}</b> clips · <b>${Math.round(total)}s</b></li><li>Transitions: <b>${esc71(niceName(tp.trans || 'cut'))}</b></li><li>Look: <b>${esc71(niceName(tp.filter || 'none'))}</b></li>${(tp.texts || []).length ? `<li><b>${tp.texts.length}</b> title${tp.texts.length === 1 ? '' : 's'}</li>` : ''}</ul>
      <p class="hint">After you open it: import your clips and press <b>Fill the template</b>. Flux cuts them to the template’s timing.</p>
      <div class="footer"><button class="btn ghost" data-a="close">Close</button><button class="btn primary" data-a="use">Use this template</button></div></div></div>`, { wide: true });
  $('h2', box).textContent = tp.name;
  $('.tplx-desc', box).textContent = tp.desc || (tp.community ? 'Made by @' + tp.by : tp.sub);
  const cv = tplCanvas(tp, 520);
  $('.tplx-big', box).appendChild(cv);
  animateTpl(cv, tp, true);
  $('[data-a=close]', box).onclick = closeModal;
  $('[data-a=use]', box).onclick = () => { closeModal(); createFromTemplate(tp); };
}
async function renderTemplatesPage(page) {
  page.innerHTML = `<div class="hp-head"><div><h1>Templates</h1><p>Ready-made edits. Hover to preview, click to see it big, then add your own clips.</p></div><button class="btn primary" data-a="share"><svg viewBox="0 0 24 24"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>Share your template</button></div>
    <div class="tplx-filter"><button data-f="all" class="on">All</button><button data-f="16:9">16:9</button><button data-f="9:16">9:16</button><button data-f="1:1">1:1</button><input class="num-input" placeholder="Search templates…"></div>
    <h2 class="hp-h2">Flux templates</h2><div class="tplx-grid" data-g="flux"></div>
    <h2 class="hp-h2">Community <small>made by Flux users, checked by us</small></h2><div class="tplx-grid" data-g="community"><p class="hp-empty">Loading…</p></div>
    <div class="tplx-mine" hidden><h2 class="hp-h2">Your shared templates</h2><div class="tplx-mine-list"></div></div>`;
  let filt = 'all', q = '';
  const fill = (grid, list) => {
    grid.innerHTML = '';
    const shown = list.filter((tp) => (filt === 'all' || tp.aspect === filt) && (!q || (tp.name + ' ' + (tp.desc || '') + ' ' + (tp.by || '')).toLowerCase().includes(q)));
    if (!shown.length) { grid.innerHTML = `<p class="hp-empty">${list.length ? 'No templates match.' : 'No community templates yet - share the first one!'}</p>`; return; }
    shown.forEach((tp) => grid.appendChild(tplCard(tp)));
  };
  const redraw = () => { fill($('[data-g=flux]', page), TEMPLATES); if (communityTpls) fill($('[data-g=community]', page), communityTpls); };
  $$('.tplx-filter button', page).forEach((b) => (b.onclick = () => { filt = b.dataset.f; $$('.tplx-filter button', page).forEach((x) => x.classList.toggle('on', x === b)); redraw(); }));
  $('.tplx-filter input', page).oninput = (e) => { q = e.target.value.trim().toLowerCase(); redraw(); };
  $('[data-a=share]', page).onclick = shareTemplateDialog;
  redraw();
  const list = await loadCommunityTemplates();
  if (!page.isConnected) return;
  if (list) fill($('[data-g=community]', page), list); else $('[data-g=community]', page).innerHTML = '<p class="hp-empty">Couldn’t load community templates - check your internet.</p>';
  if (signedIn()) {
    const r = await apiCall('templates/mine', null, settings.account.token);
    if (r.items && r.items.length && page.isConnected) {
      $('.tplx-mine', page).hidden = false;
      $('.tplx-mine-list', page).innerHTML = r.items.map((x) => `<div class="tplx-mine-row"><b>${esc71(x.name)}</b><span class="tplx-st ${esc71(x.status)}">${x.status === 'pending' ? 'Waiting for review' : x.status === 'approved' ? 'Approved - everyone can use it' : 'Not approved'}</span>${x.note ? `<small>${esc71(x.note)}</small>` : ''}</div>`).join('');
    }
  }
}
// turn a project into a template: the timing of the clips on the main video track, transitions, motion, look and titles
function templateFromProject(d) {
  // the main track = the video track with the most video / photo clips on it
  const len = (c) => c.kind === 'image' || c.kind === 'text' ? +c.out || 0 : ((+c.out || 0) - (+c.in || 0)) / (+c.speed || 1);
  const vis = (d.clips || []).filter((c) => c.kind === 'video' || c.kind === 'image');
  const per = {}; vis.forEach((c) => { per[c.trackId] = (per[c.trackId] || 0) + 1; });
  const main = Object.keys(per).sort((a, b) => per[b] - per[a])[0];
  if (!main) return null;
  const clips = vis.filter((c) => c.trackId === main).sort((a, b) => a.start - b.start);
  if (clips.length < 2) return null;
  const tc = {}; clips.forEach((c) => { if (c.transition && c.transition.type) tc[c.transition.type] = (tc[c.transition.type] || 0) + 1; });
  const trans = Object.keys(tc).sort((a, b) => tc[b] - tc[a])[0] || 'fade';
  const texts = (d.clips || []).filter((c) => c.kind === 'text' && c.text && String(c.text.content || '').trim()).slice(0, 8)
    .map((c) => ({ t: Math.max(0, c.start), d: Math.max(0.3, len(c)), content: String(c.text.content).slice(0, 80), size: c.text.size || 80, y: c.text.y == null ? 0.5 : c.text.y, anim: c.text.anim || 'fade', font: c.text.font }));
  return { aspect: d.aspect || '16:9', color: '#d8b674', filter: clips[0].filter || 'none', bars: clips.some((c) => (c.effects || []).some((e) => e.type === 'letterbox')),
    slots: clips.slice(0, 40).map((c) => Math.round(Math.max(0.3, len(c)) * 100) / 100), trans, motion: clips.slice(0, 40).map((c) => c.motion || 'none'), texts };
}
async function shareTemplateDialog() {
  if (!signedIn()) return toast('Sign in to share templates', { error: true });
  let projects = [];
  try { projects = (await projectStore.list()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); } catch {}
  if (!projects.length) return toast('Make a project first - its cuts, transitions and titles become the template', { error: true });
  const box = modal(`<h2>Share your template</h2><p class="sub">Pick one of your projects. Its <b>timing, transitions, motion, look and titles</b> become a template - your videos and photos are <b>not</b> shared. We check every template before others can see it.</p>
    <div class="row"><label>Project</label><label class="select-wrap"><select class="sh-proj">${projects.map((p) => `<option value="${esc71(p.id)}">${esc71(p.name || 'Untitled project')}</option>`).join('')}</select></label></div>
    <div class="row"><label>Template name</label><input class="num-input sh-name" maxlength="40" style="font-family:var(--font);height:36px"></div>
    <div class="row"><label>Short description</label><input class="num-input sh-desc" maxlength="160" placeholder="e.g. fast cuts for gym videos" style="font-family:var(--font);height:36px"></div>
    <div class="sh-prev"></div><div class="auth-msg err sh-msg"></div>
    <div class="footer"><button class="btn ghost" data-a="close">Cancel</button><button class="btn primary" data-a="send">Send for review</button></div>`, { wide: true });
  let tpl = null;
  const sel = $('.sh-proj', box), name = $('.sh-name', box), prev = $('.sh-prev', box), msg = $('.sh-msg', box);
  const load = async () => {
    const d = await projectStore.load(sel.value);
    tpl = d ? templateFromProject(d) : null;
    prev.innerHTML = '';
    if (!name.value || name.dataset.auto) { name.value = ((d && d.name) || '').slice(0, 40); name.dataset.auto = '1'; }
    if (!tpl) { msg.textContent = 'This project needs at least 2 clips on its main video track.'; return; }
    msg.textContent = '';
    const cv = tplCanvas(tpl, 340); prev.appendChild(cv); animateTpl(cv, { ...tpl, name: name.value }, true);
    prev.insertAdjacentHTML('beforeend', `<small>${tpl.slots.length} clips · ${Math.round(tplTotal(tpl))}s · ${esc71(niceName(tpl.trans))} · ${tpl.texts.length} titles</small>`);
  };
  name.oninput = () => { delete name.dataset.auto; };
  sel.onchange = load; load();
  $('[data-a=close]', box).onclick = closeModal;
  $('[data-a=send]', box).onclick = async (e) => {
    if (!tpl) return;
    e.target.disabled = true;
    const r = await apiCall('templates/submit', { name: name.value.trim(), desc: $('.sh-desc', box).value.trim(), tpl }, settings.account.token);
    e.target.disabled = false;
    if (r.error) { msg.textContent = r.error; return; }
    closeModal(); toast('Thanks! Your template was sent - it shows up for everyone once it’s approved.', { duration: 6000 });
    const pg = $('.home-page[data-hp=templates]'); if (pg && pg.classList.contains('on')) renderTemplatesPage(pg);
  };
}

/* ============================ friends & profiles ============================ */
let socialCache = null;
async function renderFriends(page) {
  if (!signedIn()) { page.innerHTML = '<div class="hp-head"><div><h1>Friends</h1><p>Sign in to add friends and follow other creators.</p></div></div>'; return; }
  const a = settings.account;
  page.innerHTML = `<div class="hp-head"><div><h1>Friends</h1><p>Find other Flux creators by username. Nobody ever sees your email.</p></div><button class="btn ghost" data-a="privacy">Privacy settings</button></div>
    <div class="me-card">${avatarHtml(a, 56)}<div><b>@${esc71(a.username || '')}</b><span class="me-badges">${badgesHtml(a.badges, true)}</span></div><button class="btn sm" data-a="me">View my profile</button></div>
    <div class="fr-search"><input class="num-input" placeholder="Search by username…" maxlength="20"><div class="fr-results"></div></div>
    <div class="fr-cols"><section data-s="requestsIn"><h2 class="hp-h2">Friend requests</h2><div class="fr-list"></div></section>
      <section data-s="friends"><h2 class="hp-h2">Friends</h2><div class="fr-list"></div></section>
      <section data-s="following"><h2 class="hp-h2">Following</h2><div class="fr-list"></div></section>
      <section data-s="followers"><h2 class="hp-h2">Followers</h2><div class="fr-list"></div></section>
      <section data-s="requestsOut"><h2 class="hp-h2">Requests you sent</h2><div class="fr-list"></div></section></div>`;
  $('[data-a=privacy]', page).onclick = () => openSettings('account');
  $('[data-a=me]', page).onclick = () => openProfile(a.username);
  const inp = $('.fr-search input', page), res = $('.fr-results', page);
  let tmr = null;
  inp.oninput = () => {
    clearTimeout(tmr);
    const q = inp.value.trim().replace(/^@/, '');
    if (q.length < 2) { res.innerHTML = ''; return; }
    tmr = setTimeout(async () => {
      const r = await apiCall('users/search?q=' + encodeURIComponent(q), null, a.token);
      if (inp.value.trim().replace(/^@/, '') !== q) return;
      res.innerHTML = '';
      if (r.error) { res.innerHTML = `<p class="hp-empty">${esc71(r.error)}</p>`; return; }
      if (!r.users.length) { res.innerHTML = '<p class="hp-empty">No one with that username.</p>'; return; }
      r.users.forEach((u) => res.appendChild(userRow(u, [])));
    }, 300);
  };
  const r = await apiCall('social', null, a.token);
  if (!page.isConnected) return;
  if (r.error) { $('.fr-cols', page).innerHTML = `<p class="hp-empty">${esc71(r.error)}</p>`; return; }
  socialCache = r; socialCounts = { friends: r.friends.length, followers: r.followers.length };
  const dot = $('.hn-dot'); if (dot) dot.hidden = !r.requestsIn.length;
  const fill = (key, list, actions, empty) => {
    const sec = $(`[data-s=${key}]`, page), box = $('.fr-list', sec);
    $('h2', sec).insertAdjacentHTML('beforeend', list.length ? ` <small>${list.length}</small>` : '');
    if (!list.length) { if (key === 'requestsIn' || key === 'requestsOut') sec.hidden = true; else box.innerHTML = `<p class="hp-empty">${empty}</p>`; return; }
    list.forEach((u) => box.appendChild(userRow(u, actions)));
  };
  const act = async (path, u, done) => { const x = await apiCall(path, { uid: u.uid }, a.token); if (x.error) return toast(x.error, { error: true }); if (done) toast(done); renderFriends(page); };
  fill('requestsIn', r.requestsIn, [['Accept', (u) => act('friends/accept', u, 'You and @' + u.username + ' are now friends'), 'primary'], ['Decline', (u) => act('friends/decline', u)]]);
  fill('friends', r.friends, [['Remove', (u) => act('friends/remove', u)]], 'No friends yet - search for a username above.');
  fill('following', r.following, [['Unfollow', (u) => act('unfollow', u)]], 'You don’t follow anyone yet.');
  fill('followers', r.followers, [], 'No followers yet.');
  fill('requestsOut', r.requestsOut, [['Cancel', (u) => act('friends/cancel', u)]]);
}
function userRow(u, actions) {
  const row = el('div', 'fr-row');
  row.innerHTML = `${avatarHtml(u, 38)}<span class="fr-name"><b>@${esc71(u.username)}</b><span>${badgesHtml(u.badges)}</span></span><span class="fr-acts"></span>`;
  $('.fr-name', row).onclick = () => openProfile(u.username);
  row.querySelector('.fx-av').onclick = () => openProfile(u.username);
  for (const [label, fn, cls] of actions) { const b = el('button', 'btn sm ' + (cls || 'ghost'), esc71(label)); b.onclick = (e) => { e.stopPropagation(); fn(u); }; $('.fr-acts', row).appendChild(b); }
  return row;
}
async function openProfile(username) {
  if (!signedIn()) return toast('Sign in first', { error: true });
  const a = settings.account;
  const r = await apiCall('profile?u=' + encodeURIComponent(username), null, a.token);
  if (r.error) return toast(r.error, { error: true });
  const p = r.profile;
  const draw = (p) => {
    const rel = p.relation;
    const joined = p.joined ? new Date(p.joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) : '';
    const box = modal(`<div class="prof"><div class="prof-cover"></div>${avatarHtml(p, 92)}
      <h2>@${esc71(p.username)}</h2>${joined ? `<small class="prof-joined">On Flux since ${esc71(joined)}</small>` : ''}
      <div class="prof-badges">${badgesHtml(p.badges, true) || ''}</div>
      ${p.friends !== undefined ? `<div class="prof-counts"><span><b>${p.friends}</b>friends</span><span><b>${p.followers}</b>followers</span><span><b>${p.following}</b>following</span></div>` : '<div class="prof-private"><svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>This account is private</div>'}
      <div class="prof-acts"></div></div><div class="footer"><button class="btn ghost" data-a="close">Close</button></div>`);
    $('[data-a=close]', box).onclick = closeModal;
    const acts = $('.prof-acts', box);
    const go = async (path, okMsg) => { const x = await apiCall(path, { uid: p.uid }, a.token); if (x.error) return toast(x.error, { error: true }); if (okMsg) toast(okMsg); closeModal(); draw(x.profile); const pg = $('.home-page[data-hp=friends]'); if (pg && pg.classList.contains('on')) renderFriends(pg); };
    const btn = (label, cls, fn) => { const b = el('button', 'btn ' + cls, label); b.onclick = fn; acts.appendChild(b); };
    if (p.me) { btn('Edit profile', 'primary', () => { closeModal(); openSettings('account'); }); return; }
    if (rel.friend) btn('✓ Friends', '', () => contextMenu(acts.getBoundingClientRect().left, acts.getBoundingClientRect().bottom + 4, [{ label: 'Remove friend', danger: true, fn: () => go('friends/remove') }]));
    else if (rel.requestedYou) { btn('Accept friend request', 'primary', () => go('friends/accept', 'You and @' + p.username + ' are now friends')); btn('Decline', 'ghost', () => go('friends/decline')); }
    else if (rel.requested) btn('Request sent · Cancel', 'ghost', () => go('friends/cancel'));
    else if (!p.requestsOff) btn('Add friend', 'primary', () => go('friends/request', 'Friend request sent to @' + p.username));
    if (rel.following) btn('Following', '', () => go('unfollow'));
    else if (!p.private || rel.friend) btn('Follow', rel.friend || p.requestsOff ? 'primary' : '', () => go('follow', 'You follow @' + p.username));
    if (p.requestsOff && !rel.friend && !rel.requestedYou) acts.insertAdjacentHTML('beforeend', '<small class="prof-note">Not accepting friend requests</small>');
  };
  draw(p);
}

/* ============================ account window ============================ */
openAccount = function () {
  const a = settings.account;
  if (!a) return showAuth();
  const when = (t) => new Date(t).toLocaleDateString();
  const status = isPremium()
    ? (a.source === 'owner' ? 'Premium · owner' : a.source === 'gift' ? (a.until ? 'Premium (gift) until ' + when(a.until) : 'Premium (gift) forever') : 'Premium · renews ' + (a.until ? when(a.until) : 'monthly'))
    : 'Free plan';
  const box = modal(`<div class="acct-head"><button class="acct-pic" data-a="pic" data-tip="Change profile picture">${avatarHtml(a, 64)}<i><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="12" cy="13.5" r="3.5"/><path d="M8 7l2-3h4l2 3"/></svg></i></button>
      <div><h2>@${esc71(a.username || 'no username yet')}</h2><small>${esc71(a.email)} · only you can see this</small><small class="${isPremium() ? 'acct-pro' : ''}">${status}</small><div class="me-badges">${badgesHtml(a.badges, true)}</div></div></div>
    <div class="acct-grid">
      <button class="acct-tile" data-a="profile"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><b>My profile</b><small>What others see</small></button>
      <button class="acct-tile" data-a="friends"><svg viewBox="0 0 24 24">${ACH_ICONS.people}</svg><b>Friends</b><small>Requests & following</small></button>
      <button class="acct-tile" data-a="ach"><svg viewBox="0 0 24 24">${ACH_ICONS.crown}</svg><b>Achievements</b><small>Stats & badges</small></button>
      <button class="acct-tile" data-a="settings"><svg viewBox="0 0 24 24">${ACH_ICONS.lock}</svg><b>Privacy & security</b><small>${a.twoFactor ? '2-step on' : '2-step off'} · ${a.privacy && a.privacy.private ? 'private' : 'public'}</small></button>
    </div>
    <div class="acct-actions">
      ${isPremium() ? '' : PREMIUM_FOR_SALE ? '<button class="btn primary" data-a="buy">Get Premium - €4.99/month</button>' : '<button class="btn" data-a="buy">Premium - coming soon</button>'}
      <button class="btn" data-a="refresh">Check Premium status</button>
      <button class="btn" data-a="pw">Change password</button>
      ${a.admin ? '<button class="btn" data-a="admin">Open admin panel</button>' : ''}
    </div>
    <p class="hint acct-legal">${legalLinks()}${a.admin ? '' : ' · <a href="#" data-a="delete" class="danger-link">Delete my account</a>'}</p>
    <div class="footer"><button class="btn ghost" data-a="out">Sign out</button><button class="btn" data-a="close">Close</button></div>`);
  wireLegal(box);
  const on = (k, fn) => { const b = $(`[data-a=${k}]`, box); if (b) b.onclick = fn; };
  on('delete', (e) => { e.preventDefault(); deleteAccountDialog(); });
  on('close', closeModal);
  on('out', () => { closeModal(); signOut(); });
  on('buy', () => { closeModal(); openCheckout(); });
  on('admin', () => { closeModal(); openAdminPanel(); });
  on('refresh', async (e) => { e.target.textContent = 'Checking…'; await refreshAccount(true); openAccount(); });
  on('pic', () => pickAvatar(() => { closeModal(); openAccount(); }));
  on('profile', () => { closeModal(); openProfile(a.username); });
  on('friends', () => { closeModal(); if (state.inEditor) goHome().then(() => showHomePage('friends')); else showHomePage('friends'); });
  on('ach', () => { closeModal(); if (state.inEditor) goHome().then(() => showHomePage('achievements')); else showHomePage('achievements'); });
  on('settings', () => { closeModal(); openSettings('account'); });
  on('pw', () => {
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
  });
};
// profile picture: cropped to a square and shrunk here, so only a small picture is uploaded
function pickAvatar(done) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp,image/gif';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return toast('That picture is too big', { error: true });
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
      const s = Math.min(img.naturalWidth, img.naturalHeight), ctx = cv.getContext('2d');
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, S, S);
      ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, S, S);
      let q = 0.86, data = cv.toDataURL('image/jpeg', q);
      while (data.length > 85000 && q > 0.4) { q -= 0.12; data = cv.toDataURL('image/jpeg', q); }
      const r = await apiCall('profile/avatar', { image: data }, settings.account.token);
      if (r.error) return toast(r.error, { error: true });
      storeAccount(settings.account.token, r.account); bump('avatarSet');
      toast('Profile picture updated');
      if (done) done();
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Couldn’t read that picture', { error: true }); };
    img.src = url;
  };
  inp.click();
}

/* ============================ settings additions ============================ */
{
  const baseAcct = settingsAccount;
  settingsAccount = function (body) {
    baseAcct(body);
    const a = settings.account;
    if (!a) return;
    const card = $('.set-acct', body);
    if (card) { const av = $('.acct-avatar', card); if (av) av.outerHTML = avatarHtml(a, 46); card.insertAdjacentHTML('beforeend', `<span class="me-badges">${badgesHtml(a.badges)}</span>`); }
    const after = $('.set-row', body);
    const add = (html) => { const r = el('div', 'set-row'); r.innerHTML = html; if (after) body.insertBefore(r, after.nextSibling ? after.nextSibling : null); else body.appendChild(r); return r; };
    const pv = a.privacy || {};
    const twofa = add(`<div><b>2-step verification</b><small>After your password, Flux also asks for a code we email you - so nobody can get in with just your password.</small></div><label class="switch"><input type="checkbox" ${a.twoFactor ? 'checked' : ''}><i></i></label>`);
    const req = add(`<div><b>Friend requests</b><small>Let anyone send you friend requests. Turn off to stop new requests.</small></div><label class="switch"><input type="checkbox" ${pv.requests !== 'off' ? 'checked' : ''}><i></i></label>`);
    const priv = add(`<div><b>Private account</b><small>Only friends see your friends and followers, and only friends can follow you. Your username, picture and badges stay visible.</small></div><label class="switch"><input type="checkbox" ${pv.private ? 'checked' : ''}><i></i></label>`);
    const pic = add(`<div><b>Profile picture</b><small>A square picture others see next to your username.</small></div><div class="set-inline">${avatarHtml(a, 36)}<button class="btn" data-a="pic">${a.avatar ? 'Change' : 'Add picture'}</button>${a.avatar ? '<button class="btn ghost" data-a="rm">Remove</button>' : ''}</div>`);
    $('[data-a=pic]', pic).onclick = () => pickAvatar(() => settingsAccount(body));
    const rm = $('[data-a=rm]', pic); if (rm) rm.onclick = async () => { const r = await apiCall('profile/avatar', { remove: true }, a.token); if (r.error) return toast(r.error, { error: true }); storeAccount(a.token, r.account); settingsAccount(body); };
    const savePriv = async (patch, inp) => {
      inp.disabled = true;
      const r = await apiCall('profile/privacy', patch, a.token);
      inp.disabled = false;
      if (r.error) { inp.checked = !inp.checked; return toast(r.error, { error: true }); }
      storeAccount(a.token, r.account); toast('Saved');
    };
    const pi = $('input', priv); pi.onchange = () => savePriv({ private: pi.checked }, pi);
    const ri = $('input', req); ri.onchange = () => savePriv({ requests: ri.checked ? 'everyone' : 'off' }, ri);
    const ti = $('input', twofa);
    ti.onchange = () => {
      const want = ti.checked; ti.checked = !want;
      const box = modal(`<h2>${want ? 'Turn on' : 'Turn off'} 2-step verification</h2><p class="sub">${want ? 'Enter your password. Then we email you a code to make sure your email works.' : 'Enter your password to turn it off.'}</p>
        <label class="field">Password<input type="password" class="num-input" data-f="pw"></label><label class="field" hidden>Code from the email<input class="num-input code-input" data-f="code" maxlength="6" inputmode="numeric" placeholder="000000"></label>
        <div class="auth-msg err"></div><div class="footer"><button class="btn ghost" data-a="no">Cancel</button><button class="btn primary" data-a="ok">${want ? 'Send code' : 'Turn off'}</button></div>`);
      const pw = $('[data-f=pw]', box), code = $('[data-f=code]', box), ok = $('[data-a=ok]', box), m = $('.auth-msg', box);
      setTimeout(() => pw.focus(), 30);
      $('[data-a=no]', box).onclick = closeModal;
      ok.onclick = async () => {
        ok.disabled = true; m.textContent = '';
        const r = await apiCall('2fa', { on: want, password: pw.value, code: code.closest('label').hidden ? undefined : code.value.trim() }, a.token);
        ok.disabled = false;
        if (r.error) { m.textContent = r.error; return; }
        if (r.needCode) { code.closest('label').hidden = false; pw.closest('label').hidden = true; ok.textContent = 'Turn on'; m.textContent = ''; $('.sub', box).textContent = r.message + ' Check your spam folder too.'; setTimeout(() => code.focus(), 30); return; }
        storeAccount(a.token, r.account); closeModal(); toast(want ? '2-step verification is on' : '2-step verification is off');
        settingsAccount(body);
      };
    };
  };
  const baseLook = settingsLook;
  settingsLook = function (body) {
    baseLook(body);
    const row = el('div', 'set-row col bright-row');
    const v = Number(settings.bright) || 0;
    row.innerHTML = `<b>Brightness</b><small>Make the whole interface lighter or darker. Text stays easy to read.</small>
      <div class="bright-ctl"><svg viewBox="0 0 24 24"><path d="M20 15A8 8 0 1 1 9 4a7 7 0 0 0 11 11z"/></svg><input type="range" min="-50" max="50" step="1" value="${v}"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></svg><span class="bright-val">${v > 0 ? '+' : ''}${v}</span><button class="btn sm ghost">Reset</button></div>`;
    const accent = $('.accent-row', body);
    body.insertBefore(row, accent ? accent.nextSibling : null);
    const r = $('input', row), val = $('.bright-val', row);
    const apply = (save) => { settings.bright = +r.value; val.textContent = (settings.bright > 0 ? '+' : '') + settings.bright; applyTheme(settings.theme, settings.accent, settings.motion, settings.bright); if (save) { saveSettings(); if (typeof requestDraw === 'function') requestDraw(); window.dispatchEvent(new Event('flux-theme')); } };
    r.oninput = () => apply(false); r.onchange = () => apply(true);
    $('button', row).onclick = () => { r.value = 0; apply(true); };
  };
  const basePerf = settingsPerf;
  settingsPerf = function (body) {
    basePerf(body);
    toggleRow(body, 'Smart Rendering', 'When a video is mostly plain cuts of your original clips, Flux copies the unchanged parts instead of encoding them again - faster exports with no quality loss. Used for MP4 at Standard or High quality.',
      () => settings.smartRender !== false, (v) => { settings.smartRender = v; saveSettings(); });
  };
}

/* ============================ start ============================ */
setupHomeTabs();
updateTrashCount();
{
  const baseRefresh = refreshHome;
  refreshHome = async function () { const r = await baseRefresh.apply(this, arguments); updateTrashCount(); return r; };
}
// friend requests waiting: a dot on the Friends tab (checked now and then)
async function checkRequests() {
  if (!signedIn() || document.hidden) return;
  const r = await apiCall('social', null, settings.account.token);
  if (r && r.requestsIn) { const d = $('.hn-dot'); if (d) d.hidden = !r.requestsIn.length; socialCounts = { friends: r.friends.length, followers: r.followers.length }; fluxStats.friendsSeen = socialCounts.friends; fluxStats.followersSeen = socialCounts.followers; saveStats(); }
}
setTimeout(checkRequests, 5000);
setInterval(checkRequests, 10 * 60000);
