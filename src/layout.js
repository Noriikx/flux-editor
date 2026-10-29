/* Flux — make the editor the size you like: drag the borders between the library, the preview and the
   inspector (left/right panels), and the top edge of the timeline (that one already existed). Double-click a border to reset. */
'use strict';
(function setupPanelResize() {
  const ws = document.getElementById('workspace');
  if (!ws) return;
  const DEF = { lib: 330, insp: 320 };
  let L = { ...DEF };
  try { Object.assign(L, JSON.parse(localStorage.getItem('flux.layout') || '{}')); } catch {}
  const apply = () => {
    const W = ws.clientWidth || window.innerWidth;
    // keep at least ~360px for the preview
    L.lib = clamp(L.lib, 200, Math.max(200, W - L.insp - 360));
    L.insp = clamp(L.insp, 240, Math.max(240, W - L.lib - 360));
    ws.style.gridTemplateColumns = `${Math.round(L.lib)}px minmax(0, 1fr) ${Math.round(L.insp)}px`;
    place();
  };
  const save = () => { try { localStorage.setItem('flux.layout', JSON.stringify(L)); } catch {} };
  ws.style.position = 'relative';
  const mkGrip = (side) => {
    const g = document.createElement('div');
    g.className = 'panel-grip ' + side;
    g.dataset.tip = 'Drag to resize · double-click to reset';
    ws.appendChild(g);
    let start = null, raf = 0;
    g.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      start = { x: e.clientX, v: L[side] };
      document.body.classList.add('resizing-panels');
    });
    g.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      L[side] = side === 'lib' ? start.v + dx : start.v - dx;
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; apply(); window.dispatchEvent(new Event('resize')); });
    });
    const end = () => { if (!start) return; start = null; document.body.classList.remove('resizing-panels'); save(); window.dispatchEvent(new Event('resize')); };
    g.addEventListener('pointerup', end);
    g.addEventListener('pointercancel', end);
    g.addEventListener('dblclick', () => { L[side] = DEF[side]; apply(); save(); window.dispatchEvent(new Event('resize')); });
    return g;
  };
  const gl = mkGrip('lib'), gi = mkGrip('insp');
  function place() {
    const lib = document.getElementById('library'), insp = document.getElementById('inspector');
    if (lib) gl.style.left = (lib.offsetLeft + lib.offsetWidth - 3) + 'px';
    if (insp) gi.style.left = (insp.offsetLeft - 4) + 'px';
  }
  apply();
  window.addEventListener('resize', () => { if (!document.body.classList.contains('resizing-panels')) { apply(); } else place(); });
  new ResizeObserver(() => place()).observe(ws);
})();
