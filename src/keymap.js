/* Flux — keyboard map for the shortcut settings (like DaVinci's Keyboard Customization):
   see which keys are used, press a key on your keyboard (or click one) to see what it does, and assign it. */
'use strict';
const KEY_ROWS = [
  [['Escape', 'esc', 1.3], null, ['F1'], ['F2'], ['F3'], ['F4'], null, ['F5'], ['F6'], ['F7'], ['F8'], null, ['F9'], ['F10'], ['F11'], ['F12']],
  [['`'], ['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8'], ['9'], ['0'], ['-'], ['='], ['Backspace', 'backspace', 2]],
  [['Tab', 'tab', 1.5], ['Q'], ['W'], ['E'], ['R'], ['T'], ['Y'], ['U'], ['I'], ['O'], ['P'], ['['], [']'], ['\\', '\\', 1.5]],
  [['CapsLock', 'caps', 1.8], ['A'], ['S'], ['D'], ['F'], ['G'], ['H'], ['J'], ['K'], ['L'], [';'], ["'"], ['Enter', 'enter', 2.2]],
  [['ShiftL', 'shift', 2.3], ['Z'], ['X'], ['C'], ['V'], ['B'], ['N'], ['M'], [','], ['.'], ['/'], ['ShiftR', 'shift', 2.7]],
  [['CtrlL', 'ctrl', 1.5], ['AltL', 'alt', 1.3], ['Space', 'space', 6.4], ['AltR', 'alt', 1.3], ['CtrlR', 'ctrl', 1.5]]
];
const NAV_KEYS = [
  [['Insert', 'ins'], ['Home', 'home'], ['PageUp', 'pg up']],
  [['Delete', 'del'], ['End', 'end'], ['PageDown', 'pg dn']],
  [null, ['ArrowUp', '↑'], null],
  [['ArrowLeft', '←'], ['ArrowDown', '↓'], ['ArrowRight', '→']]
];
const MOD_IDS = { ShiftL: 'shift', ShiftR: 'shift', CtrlL: 'ctrl', CtrlR: 'ctrl', AltL: 'alt', AltR: 'alt' };

function comboOf(key, mods) {
  const printable = key.length === 1;
  const parts = [];
  if (mods.ctrl) parts.push('Ctrl');
  if (mods.alt) parts.push('Alt');
  if (mods.shift && (!printable || /[A-Z0-9]/.test(key))) parts.push('Shift');
  parts.push(key);
  return parts.join('+');
}
function actionsForCombo(combo) { return ACTIONS.filter((a) => (settings.keybinds[a.id] || []).includes(combo)); }

function keyboardMap(container, onChange) {
  const st = { mods: { ctrl: false, shift: false, alt: false }, key: null };
  container.innerHTML = `
    <div class="kb-wrap">
      <div class="kb-mods"><button data-m="shift">Shift</button><button data-m="ctrl">Ctrl</button><button data-m="alt">Alt</button></div>
      <div class="kb-board"><div class="kb-main"></div><div class="kb-nav"></div></div>
    </div>
    <div class="kb-info"></div>`;
  const main = $('.kb-main', container), nav = $('.kb-nav', container), info = $('.kb-info', container);
  const keyBtn = (k) => {
    if (!k) { const sp = el('span', 'kb-gap'); return sp; }
    const [id, label, w] = k;
    const b = el('button', 'kb-key');
    b.dataset.key = id;
    b.style.flex = `${w || 1} 0 0`;
    b.innerHTML = `<span class="kb-l"></span><i class="kb-n"></i>`;
    b.firstChild.textContent = label || id;
    b.onclick = () => {
      if (MOD_IDS[id]) { st.mods[MOD_IDS[id]] = !st.mods[MOD_IDS[id]]; draw(); return; }
      st.key = id; st.frozen = true; draw();
    };
    return b;
  };
  for (const row of KEY_ROWS) { const r = el('div', 'kb-row'); for (const k of row) r.appendChild(keyBtn(k)); main.appendChild(r); }
  for (const row of NAV_KEYS) { const r = el('div', 'kb-row'); for (const k of row) r.appendChild(keyBtn(k)); nav.appendChild(r); }
  $$('.kb-mods button', container).forEach((b) => (b.onclick = () => { st.mods[b.dataset.m] = !st.mods[b.dataset.m]; draw(); }));

  const draw = () => {
    $$('.kb-mods button', container).forEach((b) => b.classList.toggle('on', st.mods[b.dataset.m]));
    for (const b of $$('.kb-key', container)) {
      const id = b.dataset.key;
      if (MOD_IDS[id]) { b.classList.toggle('mod-on', st.mods[MOD_IDS[id]]); continue; }
      const n = actionsForCombo(comboOf(id, st.mods)).length;
      b.classList.toggle('used', n > 0);
      b.classList.toggle('sel', st.key === id);
      b.lastChild.textContent = n > 1 ? n : '';
    }
    if (!st.key) { info.innerHTML = '<p class="hint">Press any key on your keyboard (or click one) to see what it does. Hold Ctrl / Shift / Alt, or click them on the left, to see those shortcuts.</p>'; return; }
    const combo = comboOf(st.key, st.mods);
    const acts = actionsForCombo(combo);
    info.innerHTML = `<div class="kb-sel"><kbd></kbd><span class="kb-acts"></span></div>
      <div class="kb-assign"><select class="dev-select"><option value="">Give this key to…</option></select><button class="btn small" data-a="assign">Assign</button>${acts.length ? '<button class="btn ghost small" data-a="clear">Remove</button>' : ''}</div>`;
    $('kbd', info).textContent = prettyCombo(combo);
    $('.kb-acts', info).textContent = acts.length ? acts.map((a) => a.label).join(' · ') : 'Not used';
    const sel = $('select', info);
    let group = null, og = null;
    for (const a of ACTIONS) {
      if (a.group !== group) { group = a.group; og = el('optgroup'); og.label = group; sel.appendChild(og); }
      const o = el('option'); o.value = a.id; o.textContent = a.label; og.appendChild(o);
    }
    $('[data-a=assign]', info).onclick = () => {
      const a = actionById(sel.value);
      if (!a) return;
      for (const x of ACTIONS) { const i = settings.keybinds[x.id].indexOf(combo); if (i >= 0) settings.keybinds[x.id].splice(i, 1); }
      const arr = settings.keybinds[a.id];
      if (arr.length >= 2) arr.shift();
      arr.push(combo);
      saveSettings(); draw(); if (onChange) onChange();
      toast(`${prettyCombo(combo)} → ${a.label}`);
    };
    const clr = $('[data-a=clear]', info);
    if (clr) clr.onclick = () => {
      for (const x of ACTIONS) { const i = settings.keybinds[x.id].indexOf(combo); if (i >= 0) settings.keybinds[x.id].splice(i, 1); }
      saveSettings(); draw(); if (onChange) onChange();
    };
  };
  // pressing a real key shows it on the map (unless you're typing or setting a shortcut)
  const onKey = (e) => {
    if (!container.isConnected) { window.removeEventListener('keydown', onKey, true); return; }
    if (keyCapture) return;
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.key === 'Escape') return; // let Escape close the window
    e.preventDefault(); e.stopPropagation();
    st.mods = { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey };
    if (['Control', 'Shift', 'Alt', 'Meta', 'AltGraph'].includes(e.key)) { st.frozen = false; draw(); return; }
    st.frozen = true; // keep showing this combo after the keys are released
    let k = e.key;
    if (k === ' ' || k === 'Spacebar') k = 'Space';
    if (k.length === 1) k = k.toUpperCase();
    // symbols typed with Shift (like "{") - use the key's own name
    const byCode = { BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Minus: '-', Equal: '=', Backquote: '`', Backslash: '\\' };
    if (byCode[e.code]) k = byCode[e.code];
    if (/^Digit\d$/.test(e.code)) k = e.code.slice(5);
    st.key = k;
    draw();
  };
  const onKeyUp = (e) => {
    if (!container.isConnected) { window.removeEventListener('keyup', onKeyUp, true); return; }
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key) && !keyCapture && !st.frozen) { st.mods = { ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey }; draw(); }
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKeyUp, true);
  draw();
  return { redraw: draw };
}
