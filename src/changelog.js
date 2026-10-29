/* Flux — changelog. Shown once after an update, and any time from Settings → About. */
'use strict';
const CHANGELOG = [
  { v: '5.0.0', date: '2026-10-29', items: [
    'New Audio FX tab next to Filters: every sound effect (ultra loud, distortion, chipmunk, robot, underwater…) in one place - click to add, or drag onto a clip. Also in the clip\u2019s right-click menu',
    'Fixed: voice changers playing the normal voice and the changed voice at the same time - effects on a video now go on its sound clip',
    'Make the editor your size: drag the border between the library, the preview and the inspector (and the top of the timeline). Double-click a border to reset',
    'Holding the scroll wheel on the timeline now always moves the view - it never grabs a clip or the volume line',
    '10 new caption styles: Sticker, Viral, Yellow pop, Gaming, Breaking, Cinematic, Minimal, Comic, Slide up and Fire',
    'New bleep sounds: anvil clang, bonk, quack, air horn, car horn, dolphin, boing, whistle, record scratch, buzzer and more - click one to hear it',
    'Bleeps can be dragged: pull the edges to make one shorter or longer, drag the pin to move it, right-click to remove. Right-click a clip → Bleep here to add your own',
    'Updates run quietly in the background - no black window',
    'Media library: the + and × buttons sit neatly together in the corner',
    'Music tab: the source buttons no longer overlap the search box'
  ] },
  { v: '4.15.0', date: '2026-10-29', items: [
    '19 new audio effects (select a clip with sound → Audio effects → + Add): Ultra loud (distorted), Distortion, Bitcrusher / 8-bit, Glitch, Pitch (chipmunk / deep voice), Robot, Telephone, Walkie-talkie, Megaphone, Underwater, Far away, Chorus, Flanger, Phaser, Tremolo, Wobble, Auto-pan, Bass boost and Lo-fi / vinyl',
    'They play live while you edit and are in your export. All free',
    'The audio effect menu is sorted into groups (Loud & broken, Voice changers, Movement, Tone, Space, Clean up)'
  ] },
  { v: '4.14.0', date: '2026-10-29', items: [
    'Updates no longer reinstall Flux: most updates now just swap in the new version when Flux restarts (much smaller download), and your taskbar / desktop shortcuts stay',
    'New in the Music tab: "Free for YouTube" - 882 hand-checked songs (Komiku, Monplaisir, Loyalty Freak Music, Audionautix, Rolemusic). Original music only, commercial use OK, most need no credit at all',
    'Removed the old public domain search (it had odd recordings and book readings)'
  ] },
  { v: '4.13.0', date: '2026-10-29', items: [
    'Zoom the timeline out much further - a 10-hour project fits on one screen',
    'Long videos (1 hour+) are smooth: no more mouse stutter while they import, optimize or get dragged around',
    'Long videos show real frames along the whole clip, and sharper frames load for the part you zoom in on (no more repeating picture)',
    'Background jobs (optimizing, thumbnails, waveforms) run at low priority and stop properly when you close Flux',
    'New: Sound effects in the Music tab - 47 whooshes, pops, booms, dings, risers, funny sounds and more. Made by Flux, free, no credit needed',
    'New effect: Glitch - short glitch bursts with calm pauses in between (choose the strength, pause and glitch length)',
    'Volume now goes up to +40 dB',
    'Faster waveforms for long sound'
  ] },
  { v: '4.12.0', date: '2026-10-25', items: [
    'Drag files onto a folder in the library to move them - now really works (also from File Explorer straight into a folder, and folders into other folders)',
    'Graph editor: keyframes you scrolled or zoomed past show as little arrows at the edges - click one to jump to it. Middle-drag (or Alt+drag) to scroll',
    'Graph editor: keyframes right at the start of the view no longer hide under the numbers, and the value labels stay readable when you zoom in',
    'New Terms of Service and Privacy Policy (Settings → About, or the links on the sign-in screen)',
    'You can delete your account yourself: Account → Delete my account',
    'Premium is "coming soon" - it can\u2019t be bought right now and no payments are taken. Everything free stays free'
  ] },
  { v: '4.11.0', date: '2026-10-25', items: [
    'Folders in the media library: Media and Music folders are made for you, and you can create, rename and delete your own (deleting a folder keeps its files)',
    'Drag files onto a folder to move them, or right-click → Move to…. New imports go into the folder you have open',
    'Smoother keyframes: zoomed-in clips now only draw the part you can see (up to 3x less work per frame)',
    'Faster editing copies: uses your graphics card to read the video too, and short videos (under 1 minute) don\u2019t need one at all'
  ] },
  { v: '4.10.0', date: '2026-10-25', items: [
    'Smooth editing copies (like DaVinci proxies): long videos and .mkv recordings get a light copy for editing, so playing and dragging the playhead back and forth is smooth. Exports always use the original. Turn off or delete them in Settings → Performance',
    'Fixed: .mkv recordings showing blocky / glitchy pictures',
    'Fixed: sound glitching or jumping when a video takes a moment to load - everything now waits together',
    'Fixed: the dB label disappearing when you raise the volume - it now follows your mouse and stays inside the clip'
  ] },
  { v: '4.9.0', date: '2026-10-25', items: [
    'New export engine: every single frame is saved - no more choppy 10 fps or blurry exports',
    'Simple edits (cuts of videos and photos) export super fast using your graphics card',
    'Sound is mixed separately, faster than real time, in high quality (320 kbps)',
    'No more waiting at 90% - the slow "converting" step is gone',
    'Export quality is set to Best by default',
    'Volume is now in decibels like CapCut (-∞ to +20 dB, 0 dB = original). Hold Shift while dragging the volume line for fine steps',
    'Fixed: waveforms of long sound clips turning into big blocky bars',
    'Fixed: level labels covering the clip name on sound clips',
    'Fixed: audio effects sometimes not starting'
  ] },
  { v: '4.8.0', date: '2026-10-24', items: [
    'New Fusion page (like DaVinci, but simple): switch Edit / Fusion at the bottom left. Your clip flows through nodes left → right',
    'Fusion nodes: Text+, Shape, Background, Transform, Color + every effect. Ready-made sets: Big title, Lower third, Picture in picture, Retro TV, Dreamy, Spotlight',
    'Smoother playback: Flux waits a moment for a video instead of stuttering',
    'Smoother high speeds (4x-10x): videos now play fast instead of jumping frame by frame',
    'Smoother transition previews'
  ] },
  { v: '4.7.0', date: '2026-10-24', items: [
    'Fixed: dragging the playhead now shows the video (no more black screen) - videos can jump to any moment instantly',
    'Text now goes on Media tracks (like DaVinci) - no separate Text track',
    'Video and sound are unlinked by default (turn linking back on in Settings → General, or right-click → Link)',
    'Drag on empty timeline space to box-select clips (Shift adds more). Middle mouse drags the view',
    'Make any track taller or shorter: drag the bottom edge of its name box',
    '36 new transitions, 30 new looks and 22 new effects (glow, RGB split, VHS, tilt-shift, duotone, neon edges, kaleidoscope…)',
    'Library: click to pick items (Shift for several), then press Delete or Backspace to remove them',
    'Fixed the × and + buttons on library items',
    'Black video background by default'
  ] },
  { v: '4.6.0', date: '2026-10-24', items: [
    'Compound clips: select clips (Shift+click), right-click → Make compound clip (Alt+C). Decompose puts them back',
    'Masks: rectangle, circle and pen - with soft edge and invert, drag them right on the video',
    'New effects: Gaussian, Lens, Directional, Radial, Mosaic and Zoom blur, Ultra sharpen, CCTV, Paper edge and Drop shadow',
    'Audio effects: Fairlight EQ, De-esser, Noise reduction, Delay, Limiter and Reverb',
    'Fade handles: drag the little handle at the top corner of any clip to fade in / out (like DaVinci)',
    'Transitions: drag their edges to make them longer or shorter, click × to delete, or right-click for more',
    'Playhead snaps to cuts when it gets close (hold Alt to stop snapping)',
    'Dragging the playhead plays the video along at the speed you move',
    'Graph editor: drag the playhead inside it, Shift+click or box-select several keyframes, type exact values, zoom with the wheel',
    'Shift+click to select several clips or keyframes - change the key in Settings → Keyboard',
    'Keyframes and the graph editor are now free',
    'Faster timeline with lots of clips'
  ] },
  { v: '4.5.1', date: '2026-10-23', items: [
    'Update button shows up as soon as a new version is really ready',
    'Opening Flux twice now just brings the open window to the front'
  ] },
  { v: '4.5.0', date: '2026-10-22', items: [
    'Text transitions, graph editor, adjustment clips, In / Out range, ripple trims, track lock, clip colors',
    'Keyboard map in Settings, 200+ fonts, hover previews, quick-mode AI editor that works offline'
  ] }
];
function changelogHtml(list = CHANGELOG) {
  return list.map((r) => `<div class="cl-rel"><div class="cl-head"><b>Flux ${r.v}</b><small>${new Date(r.date + 'T12:00:00').toLocaleDateString()}</small></div><ul>${r.items.map((i) => `<li>${i.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('')}</ul></div>`).join('');
}
function openChangelog(onlyNew) {
  const list = onlyNew ? CHANGELOG.slice(0, 1) : CHANGELOG;
  const box = modal(`<h2>${onlyNew ? 'What’s new in Flux ' + CHANGELOG[0].v : 'Changelog'}</h2><div class="cl-list">${changelogHtml(list)}</div>
    <div class="footer">${onlyNew ? '<button class="btn ghost" data-a="all">All versions</button>' : ''}<button class="btn primary" data-a="ok">Got it</button></div>`);
  $('[data-a=ok]', box).onclick = closeModal;
  const all = $('[data-a=all]', box);
  if (all) all.onclick = () => { closeModal(); openChangelog(false); };
}
function setupChangelog() {
  const cur = CHANGELOG[0].v, seen = settings.seenVersion;
  if ((seen && seen !== cur) || (!seen && settings.account)) setTimeout(() => openChangelog(true), 900);
  if (seen !== cur) { settings.seenVersion = cur; saveSettings(); }
}
{
  const baseAbout = settingsAbout;
  settingsAbout = function (body) {
    baseAbout(body);
    const h = el('h3', '', 'Changelog'); h.style.marginTop = '18px';
    const list = el('div', 'cl-list small'); list.innerHTML = changelogHtml();
    body.append(h, list);
  };
}
