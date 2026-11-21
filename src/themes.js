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
