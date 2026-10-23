# Flux

A simple, friendly video editor for Windows (and Mac).

## Run it (no terminal needed)

1. Install **Node.js** (LTS) from https://nodejs.org (one time).
2. Double-click **`Install Flux.bat`** (one time). It sets Flux up and puts a **Flux** icon on your Desktop and in the Start menu.
3. From then on, just click the **Flux** icon.

**From VS Code:** open this folder, open the terminal (`Ctrl + ~`) and run:

```
npm install
npm start
```

(`npm install` is only needed the first time, and again after an update that adds new parts.)

You need **Node.js** (LTS) from https://nodejs.org.

## Make a real installer

```
npm run dist
```

This creates `dist/Flux Setup 2.0.0.exe` with the Flux icon, a desktop shortcut and a Start menu entry.

## What's in Flux

- **Project manager** - opens first. Every project saves itself automatically; create, rename, duplicate or delete projects from the home screen. Use the Flux logo menu for New project, All projects, Settings and Exit.
- **Full screen** - Flux starts full screen. Press `F11` (or the buttons at the top right) to switch. Turn it off in Settings → General.
- **Timeline** - video, overlay, text and audio tracks. Drag to move, drag edges to trim, `S` to split, markers (`M`), snapping, undo/redo.
- **Transitions** - 22 types (crossfade, fade to black, flash, slide, push, wipe, zoom, blur, circle, spin...). Click the ＋ between two clips, or drag one from the Transitions tab onto a cut.
- **Music tab** - free songs from Kevin MacLeod (incompetech.com, CC BY 4.0 - credit needed) and public domain / CC recordings from the Internet Archive. Listen, then add to the timeline. **Credits** collects the credit text for you.
- **Voice tab** - record voiceovers. Choose your microphone and which speakers/headphones you listen through, watch the level meter, optional 3-2-1 countdown, play the video while you talk, noise reduction and "hear myself".
- **Clip tools** - size, position, rotation, flip, crop, opacity, blend modes, blurred background (great for vertical videos), motion (zoom/pan/shake), 12 looks, color sliders, speed, volume, fades, detach audio, freeze frame.
- **Text** - 8 styles with animations, plus emoji stickers.
- **Keyboard shortcuts** - change any of them in Settings → Keyboard shortcuts (two per action).
- **Video sound** - a video's sound goes on its own track under it, linked (🔗) so they move/trim/split together. Hold Alt while dragging to move just one, or right-click → Unlink.
- **Right-click a clip** - Quality & frame rate (720p-4K, 24/30/60 fps), Balance sound (volume, left/right, EQ, ducking, auto-level), keyframes, and more.
- **Keyframes**, **green screen**, **vignette/grain**, **warmth/hue**.
- **Auto captions** (Text tab or right-click) - speech-to-text runs on your PC (Whisper); 10 styles.
- **Premium (€4.99)** - AI Editor, Time machine, auto-bleep swearing, remove silences, karaoke captions, 4K, keyframes, green screen, pro transitions, film effects, equalizer.
- **AI Editor** needs your own Anthropic API key (Settings → AI Editor).
- **Performance** - Settings → Performance lowers preview quality on older laptops. Unlocked on your copy: set `OWNER_UNLOCKED = false` in `src/pro.js` for copies you give others.
- **Export** - MP4 or WebM up to 4K / 60 fps, plus saving a frame as PNG.

## Where things are stored

Projects, voice recordings, freeze frames and downloaded music live in Flux's own folder:
`%APPDATA%\Flux` (Windows). Your original video/photo files stay where they are.

## Files

- `main.js` - the window, project storage, music downloads, export conversion
- `preload.js` - safe bridge between the window and your computer
- `src/app.js` - the editor (timeline, preview, inspector, transitions, export)
- `src/projects.js` - home screen / project manager
- `src/settings.js` - settings and keyboard shortcuts
- `src/music.js` - Music tab
- `src/voice.js` - Voice tab
- `src/index.html`, `src/styles.css` - layout and look
- `build/` - app icons

Press `F12` inside Flux to open developer tools.
