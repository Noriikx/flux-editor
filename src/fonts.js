/* Flux — font library. Google Fonts download the first time they're used and then work offline.
   Fonts marked pro: true need Premium. */
'use strict';
// [name, category, weights, pro]
const FONT_LIB = [
  // ---- free ----
  ['Inter', 'Clean', [400, 700]], ['Roboto', 'Clean', [400, 700]], ['Montserrat', 'Clean', [400, 700]], ['Poppins', 'Clean', [400, 700]],
  ['Open Sans', 'Clean', [400, 700]], ['Lato', 'Clean', [400, 700]], ['Nunito', 'Clean', [400, 700]], ['Rubik', 'Clean', [400, 700]],
  ['Work Sans', 'Clean', [400, 700]], ['Raleway', 'Clean', [400, 700]],
  ['Oswald', 'Bold', [400, 700]], ['Bebas Neue', 'Bold', [400]], ['Anton', 'Bold', [400]], ['Archivo Black', 'Bold', [400]],
  ['Bangers', 'Fun', [400]], ['Lobster', 'Script', [400]], ['Pacifico', 'Script', [400]], ['Dancing Script', 'Script', [400, 700]],
  ['Caveat', 'Handwritten', [400, 700]], ['Permanent Marker', 'Handwritten', [400]], ['Shadows Into Light', 'Handwritten', [400]],
  ['Playfair Display', 'Elegant', [400, 700]], ['Merriweather', 'Classic', [400, 700]], ['Lora', 'Classic', [400, 700]],
  ['Roboto Mono', 'Retro', [400, 700]], ['Fredoka', 'Fun', [400, 700]], ['Comfortaa', 'Fun', [400, 700]], ['Righteous', 'Fun', [400]],
  ['Abril Fatface', 'Elegant', [400]], ['Press Start 2P', 'Retro', [400]],
  // ---- premium ----
  ['Bricolage Grotesque', 'Clean', [400, 700], true], ['Space Grotesk', 'Clean', [400, 700], true], ['Syne', 'Clean', [400, 700], true],
  ['Unbounded', 'Bold', [400, 700], true], ['Russo One', 'Bold', [400], true], ['Black Ops One', 'Bold', [400], true],
  ['Bowlby One SC', 'Bold', [400], true], ['Rubik Mono One', 'Bold', [400], true], ['Titan One', 'Fun', [400], true],
  ['Luckiest Guy', 'Fun', [400], true], ['Bungee', 'Fun', [400], true], ['Bungee Shade', 'Fun', [400], true], ['Shrikhand', 'Fun', [400], true],
  ['Creepster', 'Fun', [400], true], ['Rampart One', 'Fun', [400], true], ['Monoton', 'Retro', [400], true], ['Audiowide', 'Retro', [400], true],
  ['Orbitron', 'Retro', [400, 700], true], ['Chakra Petch', 'Retro', [400, 700], true], ['Silkscreen', 'Retro', [400, 700], true],
  ['VT323', 'Retro', [400], true], ['Major Mono Display', 'Retro', [400], true], ['Special Elite', 'Retro', [400], true],
  ['Cinzel', 'Elegant', [400, 700], true], ['Cormorant Garamond', 'Elegant', [400, 700], true], ['DM Serif Display', 'Elegant', [400], true],
  ['Rye', 'Elegant', [400], true], ['Fascinate', 'Elegant', [400], true],
  ['Great Vibes', 'Script', [400], true], ['Sacramento', 'Script', [400], true], ['Satisfy', 'Script', [400], true],
  ['Yellowtail', 'Script', [400], true], ['Kaushan Script', 'Script', [400], true],
  ['Rock Salt', 'Handwritten', [400], true], ['Gloria Hallelujah', 'Handwritten', [400], true],
  // ---- 200 more (checked against Google Fonts) ----
  ["DM Sans", "Clean", [400, 700], true], ["PT Sans", "Clean", [400, 700], false], ["Outfit", "Clean", [400, 700], false],
  ["Arimo", "Clean", [400, 700], true], ["Plus Jakarta Sans", "Clean", [400, 700], false], ["Roboto Condensed", "Bold", [400, 700], false],
  ["JetBrains Mono", "Retro", [400, 700], true], ["Kanit", "Clean", [400, 700], false], ["Smooch Sans", "Clean", [400, 700], false],
  ["Barlow Condensed", "Bold", [400, 700], true], ["Mulish", "Clean", [400, 700], false], ["Roboto Slab", "Classic", [400, 700], false],
  ["EB Garamond", "Classic", [400, 700], true], ["Manrope", "Clean", [400, 700], false], ["Saira", "Retro", [400, 700], false],
  ["Lobster Two", "Fun", [400, 700], true], ["Ubuntu", "Clean", [400, 700], false], ["Cabin", "Clean", [400, 700], false],
  ["Figtree", "Clean", [400, 700], true], ["Nunito Sans", "Clean", [400, 700], false], ["Titillium Web", "Clean", [400, 700], false],
  ["Overpass", "Clean", [400, 700], true], ["Archivo", "Clean", [400, 700], false], ["Changa One", "Bold", [400], true],
  ["Lexend", "Clean", [400, 700], true], ["PT Serif", "Classic", [400, 700], false], ["Source Sans 3", "Clean", [400, 700], false],
  ["Barlow", "Clean", [400, 700], true], ["Hanken Grotesk", "Clean", [400, 700], false], ["IBM Plex Sans", "Clean", [400, 700], false],
  ["Schibsted Grotesk", "Clean", [400, 700], true], ["Prompt", "Clean", [400, 700], false], ["Arvo", "Classic", [400, 700], false],
  ["Jost", "Clean", [400, 700], true], ["Inconsolata", "Retro", [400, 700], false], ["Libre Baskerville", "Classic", [400, 700], false],
  ["Fira Sans", "Clean", [400, 700], true], ["Rajdhani", "Clean", [400, 700], false], ["Quicksand", "Clean", [400, 700], false],
  ["Archivo Narrow", "Bold", [400, 700], true], ["Heebo", "Clean", [400, 700], false], ["Share Tech", "Retro", [400], false],
  ["ABeeZee", "Clean", [400], true], ["Karla", "Clean", [400, 700], false], ["Varela Round", "Clean", [400], false],
  ["Inter Tight", "Clean", [400, 700], true], ["League Spartan", "Clean", [400, 700], false], ["IBM Plex Mono", "Retro", [400, 700], false],
  ["Source Code Pro", "Retro", [400, 700], true], ["Josefin Sans", "Clean", [400, 700], false], ["Playfair", "Elegant", [400, 700], false],
  ["Encode Sans", "Clean", [400, 700], true], ["Libre Franklin", "Clean", [400, 700], false], ["Instrument Serif", "Elegant", [400], false],
  ["Fraunces", "Elegant", [400, 700], true], ["Spectral", "Classic", [400, 700], false], ["IBM Plex Serif", "Classic", [400, 700], false],
  ["Quantico", "Retro", [400, 700], true], ["Public Sans", "Clean", [400, 700], false], ["Sora", "Clean", [400, 700], false],
  ["Fira Sans Condensed", "Bold", [400, 700], true], ["Geist", "Clean", [400, 700], false], ["Crimson Pro", "Classic", [400, 700], false],
  ["Slabo 27px", "Classic", [400], true], ["Cairo", "Clean", [400, 700], false], ["Catamaran", "Clean", [400, 700], false],
  ["Fjalla One", "Bold", [400], true], ["Ultra", "Bold", [400], false], ["Courier Prime", "Retro", [400, 700], false],
  ["IBM Plex Sans Condensed", "Bold", [400, 700], true], ["Assistant", "Clean", [400, 700], false], ["Bitter", "Classic", [400, 700], false],
  ["Advent Pro", "Clean", [400, 700], true], ["Signika", "Clean", [400, 700], false], ["Urbanist", "Clean", [400, 700], false],
  ["Playball", "Fun", [400], true], ["Alfa Slab One", "Bold", [400], true], ["Gilda Display", "Elegant", [400], false],
  ["Merriweather Sans", "Clean", [400, 700], true], ["League Gothic", "Bold", [400], false], ["Roboto Flex", "Clean", [400, 700], false],
  ["Mukta", "Clean", [400, 700], true], ["Dosis", "Clean", [400, 700], false], ["Merienda", "Script", [400, 700], true],
  ["Newsreader", "Classic", [400, 700], true], ["Acme", "Clean", [400], false], ["Red Hat Display", "Clean", [400, 700], false],
  ["Source Serif 4", "Classic", [400, 700], true], ["Cormorant", "Elegant", [400, 700], false], ["Arapey", "Classic", [400], false],
  ["Instrument Sans", "Clean", [400, 700], true], ["Roboto Serif", "Classic", [400, 700], false], ["Unica One", "Fun", [400], true],
  ["Anek Telugu", "Clean", [400, 700], true], ["Mada", "Clean", [400, 700], false], ["Passion One", "Bold", [400, 700], true],
  ["Changa", "Clean", [400, 700], true], ["Radio Canada", "Clean", [400, 700], false], ["Zeyada", "Handwritten", [400], true],
  ["Antonio", "Bold", [400, 700], true], ["Hind", "Clean", [400, 700], false], ["Exo 2", "Retro", [400, 700], false],
  ["Geist Mono", "Retro", [400, 700], true], ["Share Tech Mono", "Retro", [400], false], ["Familjen Grotesk", "Clean", [400, 700], false],
  ["Hind Siliguri", "Clean", [400, 700], true], ["Crimson Text", "Classic", [400, 700], false], ["Epilogue", "Clean", [400, 700], false],
  ["Gloock", "Elegant", [400], true], ["Gruppo", "Clean", [400], false], ["Gabarito", "Fun", [400, 700], true],
  ["Monda", "Clean", [400, 700], true], ["Skranji", "Fun", [400, 700], true], ["Anek Latin", "Clean", [400, 700], false],
  ["DM Mono", "Retro", [400], true], ["PT Sans Narrow", "Bold", [400, 700], false], ["Domine", "Classic", [400, 700], false],
  ["Philosopher", "Clean", [400, 700], true], ["Azeret Mono", "Retro", [400, 700], false], ["Teko", "Bold", [400, 700], false],
  ["Cookie", "Script", [400], true], ["Mitr", "Clean", [400, 700], false], ["Libre Bodoni", "Elegant", [400, 700], false],
  ["Asap", "Clean", [400, 700], true], ["Coda", "Retro", [400], true], ["Abel", "Clean", [400], false],
  ["PT Mono", "Retro", [400], true], ["Maven Pro", "Clean", [400, 700], false], ["Electrolize", "Retro", [400], false],
  ["Goldman", "Retro", [400, 700], true], ["Basic", "Clean", [400], false], ["Host Grotesk", "Clean", [400, 700], false],
  ["Questrial", "Clean", [400], true], ["Rowdies", "Fun", [400, 700], true], ["Abhaya Libre", "Elegant", [400, 700], false],
  ["Be Vietnam Pro", "Clean", [400, 700], true], ["Oxygen", "Clean", [400, 700], false], ["Cormorant Infant", "Elegant", [400, 700], false],
  ["Lilita One", "Fun", [400], true], ["Concert One", "Fun", [400], true], ["Saira Condensed", "Retro", [400, 700], false],
  ["Fira Mono", "Retro", [400, 700], true], ["Onest", "Clean", [400, 700], false], ["Red Hat Mono", "Retro", [400, 700], false],
  ["Zilla Slab", "Classic", [400, 700], true], ["Sorts Mill Goudy", "Classic", [400], false], ["Marcellus", "Elegant", [400], false],
  ["Livvic", "Clean", [400, 700], true], ["Patua One", "Fun", [400], true], ["Hind Guntur", "Clean", [400, 700], false],
  ["Lexend Deca", "Clean", [400, 700], true], ["Barlow Semi Condensed", "Bold", [400, 700], false], ["Exo", "Retro", [400, 700], false],
  ["Sarala", "Clean", [400, 700], true], ["Play", "Clean", [400, 700], false], ["Amita", "Script", [400, 700], true],
  ["Baloo 2", "Fun", [400, 700], true], ["Anek Bangla", "Clean", [400, 700], false], ["News Cycle", "Clean", [400, 700], false],
  ["Pathway Extreme", "Clean", [400, 700], true], ["Berkshire Swash", "Script", [400], true], ["Doppio One", "Clean", [400], false],
  ["Gravitas One", "Bold", [400], true], ["Atkinson Hyperlegible", "Clean", [400, 700], false], ["Sigmar One", "Bold", [400], true],
  ["Bodoni Moda", "Elegant", [400, 700], true], ["Frank Ruhl Libre", "Classic", [400, 700], false], ["Geologica", "Clean", [400, 700], false],
  ["Balsamiq Sans", "Fun", [400, 700], true], ["Enriqueta", "Classic", [400, 700], false], ["Sanchez", "Classic", [400], false],
  ["Kalam", "Handwritten", [400, 700], true], ["Rosario", "Clean", [400, 700], false], ["Antic Didone", "Elegant", [400], false],
  ["Oleo Script", "Fun", [400, 700], true], ["Space Mono", "Retro", [400, 700], false], ["Fahkwang", "Clean", [400, 700], false],
  ["Indie Flower", "Handwritten", [400], true], ["Lexend Peta", "Clean", [400, 700], false], ["Rethink Sans", "Clean", [400, 700], false],
  ["Fira Code", "Retro", [400, 700], true], ["K2D", "Clean", [400, 700], false], ["Pridi", "Classic", [400, 700], false],
  ["Yanone Kaffeesatz", "Clean", [400, 700], true], ["Sofia Sans", "Clean", [400, 700], false], ["Cabin Condensed", "Bold", [400, 700], false],
  ["Cantata One", "Classic", [400], true], ["Sarabun", "Clean", [400, 700], false], ["Anuphan", "Clean", [400, 700], false],
  ["Literata", "Classic", [400, 700], true], ["Eczar", "Classic", [400, 700], false], ["Vollkorn", "Classic", [400, 700], false],
  ["Montserrat Alternates", "Clean", [400, 700], true], ["Delius", "Handwritten", [400], true], ["Waiting for the Sunrise", "Handwritten", [400], true],
  ["Hammersmith One", "Clean", [400], true], ["DM Serif Text", "Classic", [400], false], ["Bree Serif", "Classic", [400], false],
  ["Corben", "Fun", [400, 700], true], ["Marmelad", "Clean", [400], false]
].map(([name, cat, w, pro]) => ({ name, cat, w, pro: !!pro, web: true }));
// fonts already on the computer
const SYSTEM_FONTS = ['Segoe UI', 'Arial', 'Arial Black', 'Impact', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana', 'Courier New', 'Comic Sans MS', 'Tahoma']
  .map((name) => ({ name, cat: 'Classic', w: [400, 700], pro: false, web: false }));
const ALL_FONTS = [...FONT_LIB, ...SYSTEM_FONTS];
const FONT_CATS = ['All', 'Clean', 'Bold', 'Fun', 'Script', 'Handwritten', 'Elegant', 'Classic', 'Retro'];
const fontInfo = (name) => ALL_FONTS.find((f) => f.name === name);
const fontState = new Map(); // name -> 'loading' | 'ready' | 'error'

async function ensureFont(name) {
  const f = fontInfo(name);
  if (!f || !f.web) return true;
  const st = fontState.get(name);
  if (st === 'ready') return true;
  if (st && st.then) return st;
  if (!api || !api.fontGet) return false;
  const job = (async () => {
    const r = await api.fontGet({ family: f.name, weights: f.w });
    if (r.error || !r.faces) { fontState.set(name, 'error'); return false; }
    await Promise.all(r.faces.map(async (x) => {
      const desc = { weight: String(x.weight) };
      if (x.range) desc.unicodeRange = x.range;
      const face = new FontFace(f.name, `url("${api.mediaUrl(x.file)}")`, desc);
      await face.load();
      document.fonts.add(face);
    }));
    fontState.set(name, 'ready');
    if (typeof requestDraw === 'function') requestDraw();
    return true;
  })().catch(() => { fontState.set(name, 'error'); return false; });
  fontState.set(name, job);
  return job;
}
// load every font a project uses (called when a project opens and before export)
function ensureProjectFonts() {
  const names = new Set();
  for (const c of (typeof P !== 'undefined' && P && P.clips) || []) {
    if (c.kind === 'text' && c.text && c.text.font) names.add(c.text.font);
    for (const e of c.effects || []) if (e.font) names.add(e.font); // Text+ nodes
  }
  return Promise.all([...names].map(ensureFont));
}

/* ---------- font picker ---------- */
function fontPicker(current, onPick) {
  const wrap = el('div', 'font-pick');
  const btn = el('button', 'font-pick-btn');
  const label = () => { btn.innerHTML = '<span></span><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>'; btn.firstChild.textContent = current; btn.firstChild.style.fontFamily = `"${current}", "Segoe UI"`; };
  label();
  ensureFont(current).then(label);
  btn.onclick = (e) => { e.stopPropagation(); openFontMenu(btn, current, (name) => { current = name; label(); onPick(name); }); };
  wrap.appendChild(btn);
  return wrap;
}
function openFontMenu(anchor, current, onPick) {
  closeFontMenu();
  const pro = isPremium();
  const menu = el('div', 'font-menu');
  menu.innerHTML = `<input class="num-input font-search" placeholder="Search ${ALL_FONTS.length} fonts…"><div class="font-cats"></div><div class="font-list"></div>`;
  document.body.appendChild(menu);
  const r = anchor.getBoundingClientRect();
  const h = Math.min(440, window.innerHeight - 24);
  menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 300)) + 'px';
  menu.style.top = (r.bottom + h + 8 < window.innerHeight ? r.bottom + 4 : Math.max(8, r.top - h - 4)) + 'px';
  menu.style.height = h + 'px';
  let cat = 'All';
  const cats = $('.font-cats', menu), list = $('.font-list', menu), search = $('.font-search', menu);
  for (const c of FONT_CATS) { const b = el('button', 'chip', c); b.onclick = () => { cat = c; draw(); }; cats.appendChild(b); }
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) { const n = en.target.dataset.font; io.unobserve(en.target); ensureFont(n).then((ok) => { if (!ok) en.target.classList.add('fail'); }); }
  }, { root: list });
  const draw = () => {
    $$('.chip', cats).forEach((b) => b.classList.toggle('active', b.textContent === cat));
    const q = search.value.trim().toLowerCase();
    list.innerHTML = '';
    const fonts = ALL_FONTS.filter((f) => (cat === 'All' || f.cat === cat) && (!q || f.name.toLowerCase().includes(q)))
      .sort((a, b) => (a.pro - b.pro));
    for (const f of fonts) {
      const row = el('button', 'font-row' + (f.name === current ? ' on' : '') + (f.pro && !pro ? ' locked' : ''));
      row.dataset.font = f.name;
      row.innerHTML = `<span class="fr-name"></span><small></small>${f.pro ? CROWN : ''}`;
      row.firstChild.textContent = f.name;
      row.firstChild.style.fontFamily = `"${f.name}", "Segoe UI"`;
      row.children[1].textContent = f.web ? f.cat : 'On this PC';
      row.onclick = async () => {
        if (f.pro && !isPremium()) { closeFontMenu(); return openPremium(`The “${f.name}” font`); }
        row.classList.add('busy');
        const ok = await ensureFont(f.name);
        row.classList.remove('busy');
        if (!ok) return toast('Couldn’t download that font - check your internet connection', { error: true });
        closeFontMenu();
        onPick(f.name);
      };
      list.appendChild(row);
      if (f.web) io.observe(row);
    }
    if (!fonts.length) list.innerHTML = '<p class="hint" style="padding:12px">No fonts found</p>';
  };
  search.oninput = draw;
  draw();
  setTimeout(() => search.focus(), 30);
  setTimeout(() => document.addEventListener('pointerdown', onFontOutside, true), 0);
  menu._io = io;
}
function onFontOutside(e) { if (!e.target.closest('.font-menu')) closeFontMenu(); }
function closeFontMenu() {
  document.removeEventListener('pointerdown', onFontOutside, true);
  $$('.font-menu').forEach((m) => { if (m._io) m._io.disconnect(); m.remove(); });
}

/* ---------- Fonts in the Text tab ---------- */
function setupTextFonts() {
  const box = $('#textFonts');
  if (!box) return;
  box.innerHTML = `<p class="page-intro" style="margin:0 0 8px">Click a font to use it on the selected text, or to add new text with it.</p>
    <input class="num-input search tf-search" placeholder="Search ${ALL_FONTS.length} fonts…"><div class="chips small tf-cats"></div><div class="tf-grid"></div>`;
  let cat = 'All';
  const grid = $('.tf-grid', box), cats = $('.tf-cats', box), search = $('.tf-search', box);
  for (const c of FONT_CATS) { const b = el('button', 'chip', c); b.onclick = () => { cat = c; draw(); }; cats.appendChild(b); }
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) if (en.isIntersecting) { io.unobserve(en.target); ensureFont(en.target.dataset.font).then((ok) => { if (!ok) en.target.classList.add('fail'); }); }
  });
  const draw = () => {
    $$('.chip', cats).forEach((b) => b.classList.toggle('active', b.textContent === cat));
    const q = search.value.trim().toLowerCase();
    const sel = getClip(state.selectedId);
    const cur = sel && sel.kind === 'text' ? sel.text.font : null;
    grid.innerHTML = '';
    for (const f of ALL_FONTS.filter((x) => (cat === 'All' || x.cat === cat) && (!q || x.name.toLowerCase().includes(q))).sort((a, b) => a.pro - b.pro)) {
      const b = el('button', 'tf-item' + (f.name === cur ? ' on' : '') + (f.pro && !isPremium() ? ' locked' : ''));
      b.dataset.font = f.name;
      b.dataset.tip = f.name + (f.pro ? ' (Premium)' : '');
      b.innerHTML = `<span class="tf-aa">Aa</span><small></small>${f.pro ? '<i class="tf-crown">' + CROWN + '</i>' : ''}`;
      b.firstChild.style.fontFamily = `"${f.name}", "Segoe UI"`;
      b.children[1].textContent = f.name;
      b.onclick = async () => {
        if (f.pro && !isPremium()) return openPremium(`The “${f.name}” font`);
        b.classList.add('busy');
        const ok = await ensureFont(f.name);
        b.classList.remove('busy');
        if (!ok) return toast('Couldn’t download that font - check your internet connection', { error: true });
        const c = getClip(state.selectedId);
        if (c && c.kind === 'text') { commit(() => { c.text.font = f.name; }); toast('Font changed to ' + f.name); }
        else addText({ content: 'Your text', font: f.name, size: 110, bold: false, shadow: true, anim: 'pop' });
        draw();
      };
      grid.appendChild(b);
      if (f.web) io.observe(b);
    }
  };
  search.oninput = draw;
  draw();
  rt.redrawTextFonts = draw;
}
