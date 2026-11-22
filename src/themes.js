/* Flux — colour themes for the whole interface.
   Loaded in <head> so the right colours are there before anything is drawn (no flash).
   Every colour in styles.css comes from the CSS variables set here. */
'use strict';
const THEMES = [
  { id: 'midnight', name: 'Midnight', sub: 'Flux violet', dark: true,
    c: { bg: '#07070b', panel: '#0f0f16', panel2: '#15151f', panel3: '#1c1c28', line: '#20202c', line2: '#2c2c3b', line3: '#3d3d52',
      text: '#ecedf6', text2: '#c4c6d8', muted: '#8a8ca3', faint: '#5c5e72', sunken: '#0a0a10',
      accent: '#8d7dff', accent2: '#c3cbff', deep: '#6c4bff', gradA: '#e6eaff', gradB: '#a59cff' } },
  { id: 'ocean', name: 'Ocean', sub: 'Cool blue', dark: true,
    c: { bg: '#05080d', panel: '#0c1219', panel2: '#111a23', panel3: '#17222e', line: '#1a2531', line2: '#243342', line3: '#34485c',
      text: '#e8f1f8', text2: '#bfd0de', muted: '#7f95a8', faint: '#526577', sunken: '#070b11',
      accent: '#4cb8ff', accent2: '#b5e3ff', deep: '#2a6fff', gradA: '#e3f6ff', gradB: '#7fd0ff' } },
  { id: 'aurora', name: 'Aurora', sub: 'Teal & mint', dark: true,
    c: { bg: '#050a09', panel: '#0b1312', panel2: '#101b19', panel3: '#162320', line: '#192724', line2: '#233531', line3: '#334b45',
      text: '#e7f5f1', text2: '#bcd6cf', muted: '#7d9a92', faint: '#506a63', sunken: '#070d0c',
      accent: '#3fdcb0', accent2: '#b2f5e0', deep: '#12a57e', gradA: '#e4fff6', gradB: '#7ff0cc' } },
  { id: 'ember', name: 'Ember', sub: 'Warm orange', dark: true,
    c: { bg: '#0b0806', panel: '#14100d', panel2: '#1b1612', panel3: '#231c17', line: '#2a211b', line2: '#382c24', line3: '#4f3f33',
      text: '#f7eee8', text2: '#dccbbf', muted: '#a08d80', faint: '#6f5f54', sunken: '#0e0b08',
      accent: '#ff8a4c', accent2: '#ffd2b5', deep: '#f0472a', gradA: '#fff0e3', gradB: '#ffae7a' } },
  { id: 'rose', name: 'Rose', sub: 'Pink & berry', dark: true,
    c: { bg: '#0b0609', panel: '#140c11', panel2: '#1b1118', panel3: '#24161f', line: '#2a1a24', line2: '#382431', line3: '#4f3445',
      text: '#f8ebf2', text2: '#dcc4d1', muted: '#a3889a', faint: '#705a68', sunken: '#0e080c',
      accent: '#ff6fae', accent2: '#ffc4df', deep: '#d6337f', gradA: '#ffe9f4', gradB: '#ff9fcb' } },
  { id: 'graphite', name: 'Graphite', sub: 'Clean grey', dark: true,
    c: { bg: '#09090a', panel: '#121214', panel2: '#18181b', panel3: '#202024', line: '#232327', line2: '#2f2f35', line3: '#45454d',
      text: '#ededf0', text2: '#c7c7cd', muted: '#8c8c95', faint: '#5d5d65', sunken: '#0c0c0d',
      accent: '#e4e4ea', accent2: '#ffffff', deep: '#9a9aa6', gradA: '#ffffff', gradB: '#d4d4dc' } },
  { id: 'nord', name: 'Nordic', sub: 'Frost blue-grey', dark: true,
    c: { bg: '#1c2029', panel: '#242a35', panel2: '#2a313d', panel3: '#323a47', line: '#323a47', line2: '#3d4655', line3: '#536073',
      text: '#eceff4', text2: '#d8dee9', muted: '#99a3b5', faint: '#6b7588', sunken: '#20252f',
      accent: '#88c0d0', accent2: '#cfe9f1', deep: '#5e81ac', gradA: '#eef8fb', gradB: '#a9d5e2' } },
  { id: 'mocha', name: 'Mocha', sub: 'Cozy coffee', dark: true,
    c: { bg: '#15110e', panel: '#1e1814', panel2: '#251e19', panel3: '#2e251f', line: '#31281f', line2: '#3f3429', line3: '#57493b',
      text: '#f3e9df', text2: '#dccbb9', muted: '#a8927d', faint: '#776553', sunken: '#18130f',
      accent: '#d9a066', accent2: '#f6d9b8', deep: '#b0703a', gradA: '#fff3e6', gradB: '#e8bb8a' } },
  { id: 'neon', name: 'Neon', sub: 'Cyber night', dark: true,
    c: { bg: '#05040c', panel: '#0c0a19', panel2: '#120f24', panel3: '#19152f', line: '#1d1838', line2: '#2a2350', line3: '#3e3470',
      text: '#f1eeff', text2: '#cfc8f0', muted: '#8f86bb', faint: '#5e5788', sunken: '#070612',
      accent: '#ff3dc8', accent2: '#ffb0ec', deep: '#9b2cff', gradA: '#9ff6ff', gradB: '#ff6bd6' } },
  { id: 'forest', name: 'Forest', sub: 'Deep green', dark: true,
    c: { bg: '#070b07', panel: '#0e140e', panel2: '#131b13', panel3: '#1a241a', line: '#1c271c', line2: '#273527', line3: '#3a4d3a',
      text: '#eaf3e8', text2: '#c6d8c2', muted: '#86a081', faint: '#586c54', sunken: '#091009',
      accent: '#7bd84a', accent2: '#c9f2b0', deep: '#3f9e2a', gradA: '#f0ffe6', gradB: '#a6ea7c' } },
  { id: 'sakura', name: 'Sakura', sub: 'Soft pink light', dark: false,
    c: { bg: '#f6ecef', panel: '#fffafb', panel2: '#fbf1f4', panel3: '#f5e6eb', line: '#efdde3', line2: '#e4cbd3', line3: '#cfaab6',
      text: '#2a1820', text2: '#533b45', muted: '#8a6b77', faint: '#b497a2', sunken: '#f8eef1',
      accent: '#e5528f', accent2: '#c23a74', deep: '#c93b78', gradA: '#ff9cc3', gradB: '#f06aa2' } },
  { id: 'paper', name: 'Paper', sub: 'Warm light', dark: false,
    c: { bg: '#ece7de', panel: '#fbf8f2', panel2: '#f5f0e7', panel3: '#ede6da', line: '#e3dccf', line2: '#d6cdbd', line3: '#bdb19c',
      text: '#24211b', text2: '#4a4438', muted: '#7d7464', faint: '#a89e8b', sunken: '#f3eee5',
      accent: '#d9622b', accent2: '#b84d1c', deep: '#c0521f', gradA: '#ffb38a', gradB: '#ec7d47' } },
  { id: 'crimson', name: 'Crimson', sub: 'Bold red', dark: true,
    c: { bg: '#0b0506', panel: '#15090b', panel2: '#1c0d10', panel3: '#251216', line: '#2b1418', line2: '#3a1c22', line3: '#552a33',
      text: '#f9ecee', text2: '#dfc5c9', muted: '#a78a8f', faint: '#735c60', sunken: '#0e0708',
      accent: '#ff4d5e', accent2: '#ffb3bb', deep: '#d01f36', gradA: '#ffe5e8', gradB: '#ff8592' } },
  { id: 'sunset', name: 'Sunset', sub: 'Orange to pink', dark: true,
    c: { bg: '#0d0709', panel: '#170c10', panel2: '#1f1015', panel3: '#29151b', line: '#2e171d', line2: '#3e2028', line3: '#5a2f3a',
      text: '#fbeee9', text2: '#e2c9c1', muted: '#ad8e88', faint: '#7a5f5a', sunken: '#10080a',
      accent: '#ff7a59', accent2: '#ffc9b5', deep: '#e83e8c', gradA: '#ffe0a8', gradB: '#ff8a65' } },
  { id: 'lavender', name: 'Lavender', sub: 'Soft purple', dark: true,
    c: { bg: '#0b0a10', panel: '#15131e', panel2: '#1b1826', panel3: '#231f31', line: '#262236', line2: '#332d48', line3: '#4b4366',
      text: '#f1eefb', text2: '#d3cdea', muted: '#9c95b8', faint: '#6b6587', sunken: '#0e0d15',
      accent: '#b69cff', accent2: '#e3d9ff', deep: '#8a63f0', gradA: '#f3eeff', gradB: '#cbb8ff' } },
  { id: 'matrix', name: 'Matrix', sub: 'Hacker green', dark: true,
    c: { bg: '#020503', panel: '#060c08', panel2: '#09120c', panel3: '#0d1a11', line: '#0f1f14', line2: '#163020', line3: '#225030',
      text: '#d8ffe4', text2: '#a8dcb6', muted: '#5f9c70', faint: '#3c6649', sunken: '#030704',
      accent: '#2bff6a', accent2: '#b4ffcb', deep: '#0fbf45', gradA: '#e0ffe9', gradB: '#6dff9a' } },
  { id: 'gold', name: 'Gold', sub: 'Black & gold', dark: true,
    c: { bg: '#080705', panel: '#121009', panel2: '#18150d', panel3: '#201c12', line: '#262115', line2: '#352d1c', line3: '#50442a',
      text: '#f8f1e1', text2: '#ded2b6', muted: '#a8997a', faint: '#766b55', sunken: '#0b0a07',
      accent: '#e6b84a', accent2: '#f7e2a8', deep: '#b8862a', gradA: '#fff4d6', gradB: '#f0cc72' } },
  { id: 'cobalt', name: 'Cobalt', sub: 'Deep blue', dark: true,
    c: { bg: '#04060f', panel: '#0a0f20', panel2: '#0e1529', panel3: '#141c35', line: '#16203b', line2: '#202c50', line3: '#2f4072',
      text: '#e9efff', text2: '#c3ceee', muted: '#8391bb', faint: '#566287', sunken: '#060915',
      accent: '#4d7cff', accent2: '#b9cbff', deep: '#2350e0', gradA: '#e4ecff', gradB: '#8aa8ff' } },
  { id: 'slate', name: 'Slate', sub: 'Calm blue-grey', dark: true,
    c: { bg: '#0d1014', panel: '#151a20', panel2: '#1b2129', panel3: '#232a33', line: '#262e38', line2: '#323c48', line3: '#4a5767',
      text: '#eef2f6', text2: '#cdd5de', muted: '#8f9bab', faint: '#606b7a', sunken: '#10141a',
      accent: '#7aa7d9', accent2: '#cde0f5', deep: '#4f7fb5', gradA: '#eef5ff', gradB: '#a7c6ea' } },
  { id: 'mint', name: 'Mint', sub: 'Fresh light', dark: false,
    c: { bg: '#e6f2ee', panel: '#fbfffd', panel2: '#f0f8f5', panel3: '#e4f1ec', line: '#d6e8e1', line2: '#c3dbd2', line3: '#9fc2b5',
      text: '#122019', text2: '#344a40', muted: '#5f7a6e', faint: '#8fa89d', sunken: '#eef7f3',
      accent: '#14a776', accent2: '#0d8a60', deep: '#0f9467', gradA: '#6fe3b9', gradB: '#2cc48f' } },
  { id: 'sky', name: 'Sky', sub: 'Airy blue light', dark: false,
    c: { bg: '#e7eef8', panel: '#fdfeff', panel2: '#f1f6fc', panel3: '#e6eef8', line: '#d8e3f1', line2: '#c5d4e8', line3: '#a0b6d3',
      text: '#121a26', text2: '#344257', muted: '#5f6f87', faint: '#8f9db1', sunken: '#eff4fa',
      accent: '#2f7cf6', accent2: '#1e5fc7', deep: '#1f66dc', gradA: '#8dbaff', gradB: '#4b8ef8' } },
  { id: 'peach', name: 'Peach', sub: 'Warm soft light', dark: false,
    c: { bg: '#f6ece6', panel: '#fffbf8', panel2: '#fbf2ec', panel3: '#f6e8df', line: '#efddd2', line2: '#e4cbbc', line3: '#cfa995',
      text: '#2a1a12', text2: '#523a2e', muted: '#8a6a5a', faint: '#b4978a', sunken: '#faf1eb',
      accent: '#f0703c', accent2: '#c9531f', deep: '#de5a27', gradA: '#ffb58f', gradB: '#f6875a' } },
  { id: 'light', name: 'Daylight', sub: 'Light mode', dark: false,
    c: { bg: '#e9ebf1', panel: '#ffffff', panel2: '#f4f5f9', panel3: '#eaecf2', line: '#e0e2ea', line2: '#d1d4de', line3: '#b6bac8',
      text: '#16171f', text2: '#3b3e4d', muted: '#686c80', faint: '#9599ab', sunken: '#eef0f5',
      accent: '#6b4dff', accent2: '#5236e0', deep: '#5a37f0', gradA: '#a897ff', gradB: '#8064ff' } }
];
const ACCENTS = ['#8d7dff', '#4cb8ff', '#3fdcb0', '#7bd84a', '#ffd23f', '#ff8a4c', '#ff5c7a', '#ff6fae', '#c77dff', '#e4e4ea'];

function themeById(id) { return THEMES.find((t) => t.id === id) || THEMES[0]; }

// read straight from storage so this works before settings.js has loaded
function storedLook() {
  try { const s = JSON.parse(localStorage.getItem('flux.settings') || '{}'); return { theme: s.theme, accent: s.accent, motion: s.motion }; } catch { return {}; }
}

function applyTheme(id, accent, motion) {
  const t = themeById(id), c = { ...t.c };
  // a custom accent colour overrides the theme's own; the lighter / deeper shades are mixed from it
  const custom = accent && /^#[0-9a-f]{6}$/i.test(accent) ? accent : null;
  const root = document.documentElement, st = root.style;
  const set = (k, v) => st.setProperty(k, v);
  set('--bg', c.bg); set('--panel', c.panel); set('--panel-2', c.panel2); set('--panel-3', c.panel3);
  set('--line', c.line); set('--line-2', c.line2); set('--line-3', c.line3);
  set('--text', c.text); set('--text-2', c.text2); set('--muted', c.muted); set('--faint', c.faint); set('--sunken', c.sunken);
  if (custom) {
    set('--accent', custom);
    set('--accent-2', t.dark ? `color-mix(in srgb, ${custom} 50%, #fff)` : `color-mix(in srgb, ${custom} 80%, #000)`);
    set('--accent-deep', `color-mix(in srgb, ${custom} 78%, #000)`);
    set('--grad', `linear-gradient(135deg, color-mix(in srgb, ${custom} 25%, #fff) 0%, color-mix(in srgb, ${custom} 70%, #fff) 45%, ${custom} 100%)`);
  } else {
    set('--accent', c.accent); set('--accent-2', c.accent2); set('--accent-deep', c.deep);
    set('--grad', `linear-gradient(135deg, ${c.gradA} 0%, ${c.gradB} 45%, ${c.deep} 100%)`);
  }
  set('--on-accent', t.dark ? '#0d0b1f' : '#ffffff');
  // text on a solid accent background: dark for very light accents (Graphite, yellow), white otherwise
  const accHex = custom || c.accent, lum = (h) => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  set('--on-solid', lum(accHex) > 0.72 ? '#14141a' : '#ffffff');
  // video / text clips and their track icons take on the theme colour
  set('--c-video', `color-mix(in srgb, var(--accent-deep) 62%, ${t.dark ? '#1b1b2c' : '#3a3a55'})`);
  set('--playhead', t.dark ? '#ffffff' : '#16171f');
  set('--scroll', c.line2);
  set('--tick', c.line2); set('--lane-line', c.line);
  set('--backdrop', t.dark ? 'rgba(3,3,7,.62)' : 'rgba(30,32,45,.28)');
  set('--shadow', t.dark ? '0 18px 50px rgba(0,0,0,.55)' : '0 18px 50px rgba(30,32,60,.16)');
  set('--shadow-sm', t.dark ? '0 2px 10px rgba(0,0,0,.35)' : '0 2px 10px rgba(30,32,60,.08)');
  root.dataset.theme = t.id;
  root.dataset.tone = t.dark ? 'dark' : 'light';
  root.style.colorScheme = t.dark ? 'dark' : 'light';
  root.classList.toggle('calm', motion === 'off');
}

(function bootTheme() {
  const s = storedLook();
  applyTheme(s.theme, s.accent, s.motion);
})();
