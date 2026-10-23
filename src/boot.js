/* Flux — start everything once all the pieces have loaded. */
'use strict';
(function boot() {
  setupHome();
  setupMusic();
  setupVoice();
  initEditor();
  setupSmartTools();
  $('#btnRecTl').onclick = () => toggleRecording();
  $('#transAll').onclick = () => applyTransitionToAll('fade');
  $('#transNone').onclick = () => applyTransitionToAll('none');
  const td = $('#transDefault');
  td.oninput = () => { settings.transitionDur = +td.value; $('#transDefaultVal').textContent = (+td.value).toFixed(1) + 's'; setRangeFill(td); };
  td.onchange = saveSettings;
  $('#btnPremium').onclick = () => openPremium();
  updatePremiumBadge();
  recheckLicense();
  if (api && api.setStartFullscreen) api.setStartFullscreen(!!settings.startFullscreen);
  if (api && api.isFullscreen) api.isFullscreen().then((fs) => document.body.classList.toggle('is-fullscreen', !!fs));
  goHome();
})();
