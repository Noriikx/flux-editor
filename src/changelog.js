/* Flux — changelog. Shown once after an update, and any time from Settings → About. */
'use strict';
const CHANGELOG = [
  { v: '7.4.0', date: '2026-11-25', items: [
    'Thumbnail Studio is now its own place: Home → Thumbnails. Add your own pictures (choose, drop or paste them), text, shapes and stickers - each one is a layer you can hide, lock, rename, drag up or down, fade and blend, like a simple Photoshop. Move, resize and rotate things right on the picture, undo anything, and your thumbnails save by themselves',
    'Sizes for YouTube thumbnails, Shorts / TikTok covers, square posts, channel banners and X headers',
    'Pictures can get an outline (great for cut-out PNGs), a shadow, and brightness, contrast, color and blur',
    'A brand new Premium screen'
  ] },
  { v: '7.3.0', date: '2026-11-25', items: [
    'Viral Shorts from YouTube links no longer download the whole video: Flux reads the video’s captions and YouTube’s “most replayed” moments, then downloads only the moments you turn into Shorts. Twitch streams without captions download only the sound (deleted after 2 days)',
    'Audio Mixer (Mixer button above the timeline): a fader, pan, 3-band EQ, mute and solo for every track, live level meters, and a master with Glue and a Limiter. Your mix is used in the export too',
    'Thumbnail Studio (Thumbnail button): pick any frame of your video or a picture, add big outlined text, arrows, circles and stickers, choose a style, and save it for YouTube, Shorts or square',
    'New theme for Premium: Golden Hour - warm without being too bright',
    'Limited Christmas themes: Christmas Eve, Candy Cane and Snowfall (with falling snow). Once a theme is yours you keep it on every computer',
    'Fixed: some coloured buttons (like “Share your template”) turned completely black when you hovered over them'
  ] },
  { v: '7.2.0', date: '2026-11-25', items: [
    'Viral Shorts from a link: paste a YouTube or Twitch link (a video or a past stream) and Flux downloads it and finds the best moments. Only use videos you own or have permission to use',
    'Flux Mobile: the phone version now has Viral Shorts with captions, auto captions, templates, motion and transitions, plus your account, friends, profiles and achievements - open flux-editor.netlify.app/lite on your phone'
  ] },
  { v: '7.1.0', date: '2026-11-24', items: [
    'New version names: Flux now counts 1.6, 1.7, 1.7.1… (this is 1.7.1)',
    'Templates fixed: the Templates button opened an empty project instead of the templates. Now there’s a whole Templates tab with live animated previews - hover to play, click to see it big',
    'Share your own templates: turn any project into a template (only the timing, transitions, looks and titles - never your videos). Approved ones show up for everyone under Community',
    'Smart Rendering: when your video is mostly plain cuts, Flux copies the untouched parts of your clips instead of encoding them again - faster exports with no quality loss (Settings → Performance)',
    'Trash: deleted projects go to the Trash for 30 days, so you can bring them back. Undo right after deleting, too',
    'Brightness slider for themes (Settings → Appearance)',
    'Profiles: add a profile picture, see badges (Founder, Developer, Verified, Bug Hunter, Contributor, Support Team, Sponsor, Content Creator, Educator and Premium)',
    'Friends: send friend requests, follow creators, search by username. Private account and friend-request settings in Settings → Account. Your email is never shown to anyone',
    '2-step verification: after your password, Flux can also ask for a code from your email',
    'Usernames can have capital letters now',
    'Achievements tab: 57 achievements and your stats (videos exported, time editing, streaks…). They unlock quietly - no pop-ups',
    'Viral Shorts is faster and smarter: a quick scan of the whole video, then only the best moments are listened to closely. Silent parts are skipped, and changing the clip length is instant. Better hooks, endings and picks spread over the whole video',
    'New Community Guidelines, and the Privacy Policy and Terms are updated for profiles, friends and shared templates'
  ] },
  { v: '7.0.0', date: '2026-11-22', items: [
    'Templates: 8 ready-made edits (vlog, fast TikTok, travel, gaming, product promo, birthday, week recap, cinematic). Add your clips and press "Fill the template"',
    'Reverse: play any video or sound clip backwards (Clip tools → Edit, or right-click → Enhance). Press it again to go back',
    'Close gaps button: removes every empty space on the timeline in one click (Auto-close is still there too)',
    'Balance audio: one click makes every voice about equally loud - a loud mic and a quiet one end up the same, and music sits underneath',
    'Blur or pixelate just one part of the video (faces, plates, names) - plus 8 more effects: Pixelate, Thermal camera, Night vision, Color pop, Water ripple, Spotlight, Anime speed lines and Rain',
    'Favorites: click the ☆ on any filter, effect or audio effect to pin it at the top',
    'You can now see which imported files are already used on the timeline (a ✓ on the file)',
    '10 new filters, 8 new caption styles, 10 new audio effects and 10 new themes',
    'The anvil bleep now sounds like a real anvil',
    'Usernames: pick yours (Settings → Account). New accounts also ask the year you were born',
    'Settings → Request a feature and Report a bug: send ideas and problems straight to us',
    'Delete account now asks for a code from your email first, so nobody else can do it',
    'Better protection: limits on sign-in tries and on how fast the account server can be called',
    'Fixed: "Untitled project" cards that couldn\u2019t be deleted (they were old version-history files)'
  ] },
  { v: '6.0.1', date: '2026-11-22', items: [
    'Viral Shorts is now a Premium feature'
  ] },
  { v: '6.0.0', date: '2026-11-22', items: [
    'Viral Shorts (new tab): drop in a long video or podcast - or paste a link to a video file or podcast feed - and Flux finds the best 30-60 second moments. It looks for a strong first line, a complete thought, emotion, energy and no dead air, then gives each moment a score',
    'One click turns a moment into a ready vertical Short: cut, reframed to 9:16, captions and the hook as a title. "Make all" makes every Short at once. Podcasts without video become captioned audiograms',
    'Studio sound: removes background noise, hum and echo and makes voices clear and even (right-click a clip → Enhance, or Clip tools → Smart)',
    'Improve quality: cleans up grain and blocky compression, sharpens details and livens up colors',
    'AI upscale: makes videos and photos 2× or 4× bigger and sharper, using the Real-ESRGAN AI on your graphics card',
    'AI slow motion: 2×, 4× or 8× slower and still perfectly smooth - AI (RIFE) creates the in-between frames',
    'Zooming the timeline is now smooth, even with lots of clips',
    '6 new themes: Nordic, Mocha, Neon, Forest, Sakura and Paper (Settings → Appearance)',
    'Springier, smoother buttons, switches and menus everywhere'
  ] },
  { v: '5.3.0', date: '2026-11-22', items: [
    'A fresh new look: the panels now float with rounded corners and soft shadows, and buttons, cards and sliders are cleaner',
    'Themes: pick Midnight, Ocean, Aurora, Ember, Rose, Graphite or the new light mode, Daylight (Settings → Appearance)',
    'Choose your own accent color - pick from 10 colors or any color you like',
    'Smoother everywhere: tabs, menus, pop-ups and messages glide in, and hovering gives gentle feedback. Prefer it still? Turn off Smooth animations in Settings → Appearance',
    'The library tabs moved to a tidy side bar, so every name fits (no more squashed "Audio FX" and "Transitions")'
  ] },
  { v: '5.2.0', date: '2026-11-11', items: [
    'A new export engine: your videos are now read straight from the files frame by frame, instead of being played back in the background. Exports are usually faster, especially longer videos',
    'Exported videos are smooth: every frame is exactly the right one (before, frames could be repeated or skipped, which made exports look laggy)',
    'Trimmed clips, sped-up clips and transitions all export frame-perfect',
    'Privacy: Flux now asks before it downloads fonts from Google Fonts (change it any time in Settings → General)',
    'New Licenses & credits page (Settings → About) for the open-source software, music, fonts and voices in Flux. The Privacy Policy and Terms are updated to match'
  ] },
  { v: '5.1.1', date: '2026-11-08', items: [
    'Fixed transitions: hovering a transition previews it properly again, and after you apply one the video no longer jumps back or gets stuck around the cut',
    'Playing through a transition no longer freezes for a moment when a clip uses its whole video'
  ] },
  { v: '5.1.0', date: '2026-11-05', items: [
    'Text to speech: type anything and one of 10 natural AI voices reads it out loud (Voice tab → Text to speech). Auto captions are added for it right away. The voices run on your computer, work offline and are free to use in your videos',
    'A much smarter AI Editor that works without any account or key: say several things at once (“cut the first 3s, add a title and make it warmer”), point at clips (“the music”, “the 2nd clip”, “intro.mp4”) and times (“at 0:05”, “from 3 to 8s”, “every cut”). It does 40+ kinds of edits and answers “how do I…” questions',
    '17 new audio effects in every group: Overdrive, Blown speaker, Stutter, Alien, Monster, Ghost, Rotating speaker, Auto-wah, Treble boost, Muffled, Old radio, Canyon echo, Ping-pong delay, Stadium, Podcast voice, Compressor and Speech clarity',
    'Audio FX have real icons now instead of emojis',
    '6 new transitions (Zoom punch, Slide bounce, Squeeze, Dream fade, Spin blur, Slam down) and 10 new looks (Y2K, Vaporwave, Peach, Night city, Moody green, Blockbuster, Clean & bright, Velvet, Gold film, Bleak)',
    'Hovering transitions previews them smoothly - no more lag when you move from one to the next',
    'Clip tools are sorted into Edit, Animate, Sound and Smart, with names under every button',
    'The right-click menu on clips is much shorter: things are grouped into Edit, Sound, Smart and Clip',
    'The Premium list now says “Auto captions” for the animated caption styles'
  ] },
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
  return list.map((r) => `<div class="cl-rel"><div class="cl-head"><b>Flux ${displayVer(r.v)}</b><small>${new Date(r.date + 'T12:00:00').toLocaleDateString()}</small></div><ul>${r.items.map((i) => `<li>${i.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</li>`).join('')}</ul></div>`).join('');
}
function openChangelog(onlyNew) {
  const list = onlyNew ? CHANGELOG.slice(0, 1) : CHANGELOG;
  const box = modal(`<h2>${onlyNew ? 'What’s new in Flux ' + displayVer(CHANGELOG[0].v) : 'Changelog'}</h2><div class="cl-list">${changelogHtml(list)}</div>
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
