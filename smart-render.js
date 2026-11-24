// Flux — Smart Rendering.
// When a timeline is plain cuts of H.264 videos that already have the export size and frame rate, the untouched
// middle of every clip is copied straight from the original file (no re-encoding = faster, and no quality loss).
// Only the few frames around each cut (from the cut to the next keyframe) are encoded again.
// Everything is checked at the end; if anything looks wrong, Flux quietly falls back to the normal export.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(ff, args, { onTime, ms = 0, keep } = {}) {
  return new Promise((resolve) => {
    const p = spawn(ff, args, { windowsHide: true });
    if (keep) keep(p);
    let err = '';
    const t = ms ? setTimeout(() => { try { p.kill('SIGKILL'); } catch {} }, ms) : null;
    p.stderr.on('data', (d) => {
      const s = d.toString(); err = (err + s).slice(-200000);
      if (onTime) { const m = /time=(\d+):(\d+):(\d+\.\d+)/.exec(s); if (m) onTime(+m[1] * 3600 + +m[2] * 60 + parseFloat(m[3])); }
    });
    p.on('error', (e) => { if (t) clearTimeout(t); resolve({ code: -1, err: String(e) }); });
    p.on('close', (code) => { if (t) clearTimeout(t); resolve({ code, err }); });
  });
}

// what the video inside a file is (read from ffmpeg's own description)
const probeCache = new Map();
async function probe(ff, file) {
  let st; try { st = fs.statSync(file); } catch { return null; }
  const key = file + '|' + st.size + '|' + st.mtimeMs;
  if (probeCache.has(key)) return probeCache.get(key);
  const { err } = await run(ff, ['-hide_banner', '-i', file], { ms: 20000 });
  const line = (err.split('\n').find((l) => /Stream #\d+:\d+.*Video:/.test(l)) || '');
  const m = /Video: (\w+)(?: \(([^)]*)\))?.*?, (\w+)(?:\([^)]*\))?, (\d+)x(\d+)/.exec(line);
  const fps = /([\d.]+) fps/.exec(line), sar = /SAR (\d+):(\d+)/.exec(line), start = /start: (-?[\d.]+)/.exec(err);
  const info = m ? { codec: m[1], profile: m[2] || '', pix: m[3], w: +m[4], h: +m[5], fps: fps ? parseFloat(fps[1]) : 0,
    sarOk: !sar || sar[1] === sar[2], start: start ? parseFloat(start[1]) : 0, attached: /attached pic/.test(line) } : null;
  probeCache.set(key, info);
  return info;
}

// keyframe times between a and b (seconds from the start of the file, like the editor counts)
async function keyframes(ff, file, a, b, startOffset) {
  const from = Math.max(0, a - 0.5);
  const { err } = await run(ff, ['-hide_banner', '-nostats', '-skip_frame', 'nokey', '-ss', from.toFixed(3), '-t', (b - from + 0.5).toFixed(3), '-i', file,
    '-copyts', '-an', '-sn', '-dn', '-vf', 'showinfo', '-f', 'null', '-'], { ms: 120000 });
  const out = [];
  const re = /pts_time:\s*(-?[\d.]+)/g; let m;
  while ((m = re.exec(err))) out.push(parseFloat(m[1]) - (startOffset || 0));
  return [...new Set(out.map((x) => Math.round(x * 1e4) / 1e4))].sort((x, y) => x - y);
}

const eligible = (info, w, h, fps) => info && info.codec === 'h264' && info.pix === 'yuv420p' && info.w === w && info.h === h &&
  Math.abs(info.fps - fps) < 0.01 && info.sarOk && !info.attached && !/4:4:4|10|Hi422/i.test(info.profile);

/**
 * segs: the same plan the fast export uses ({type:'gap'|'clip', kind, file, in, dur, speed, fit}).
 * Returns { ok:true, path, copied } or null (then the caller does a normal export).
 */
async function smartRender({ ff, dir, target, fps, w, h, bg, segs, audio, duration, quality, onProgress, keep, cancelled }) {
  if (!ff || !segs || !segs.length) return null;
  const frame = 1 / fps;
  const parts = []; // {kind:'copy'|'enc', ...}
  let copySecs = 0;
  // 1. plan: which pieces can be copied
  for (const sg of segs) {
    if (cancelled()) return null;
    if (sg.type === 'clip' && sg.kind === 'video' && Math.abs((sg.speed || 1) - 1) < 1e-6) {
      const info = await probe(ff, sg.file);
      if (eligible(info, w, h, fps)) {
        const a = sg.in, b = sg.in + sg.dur;
        const ks = await keyframes(ff, sg.file, a, b, info.start);
        const k1 = ks.find((k) => k >= a - frame / 2), k2 = [...ks].reverse().find((k) => k <= b - frame / 2);
        if (k1 !== undefined && k2 !== undefined && k2 - k1 >= 1.5) {
          if (k1 - a > frame / 2) parts.push({ kind: 'enc', sg: { ...sg, in: a, dur: k1 - a } });
          parts.push({ kind: 'copy', file: sg.file, in: k1, dur: k2 - k1, end: b, sg });
          copySecs += k2 - k1;
          continue;
        }
      }
    }
    parts.push({ kind: 'enc', sg });
  }
  // only worth it when a good part of the video can be copied
  if (copySecs < Math.max(2, duration * 0.3)) return null;

  // 2. make every piece as an MPEG-TS file (keeps the H.264 settings inside the stream, so pieces can be joined)
  const col = (bg || '#000000').replace('#', '0x');
  const crf = { high: '14', standard: '16' }[quality] || '16';
  const enc = ['-c:v', 'libx264', '-preset', 'faster', '-crf', crf, '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', String(Math.round(fps * 2)), '-bf', '0', '-x264-params', 'repeat-headers=1'];
  const list = [];
  let done = 0, frames = 0;
  const total = parts.reduce((t, p) => t + (p.kind === 'copy' ? p.dur * 0.05 + (p.end - p.in - p.dur) : (p.sg.dur || 0)), 0) || 1;
  const want = Math.round(duration * fps);
  // frames really written so far vs. where the timeline says we are: every piece is sized to keep them equal
  // count the pictures in a piece (one line per picture, no decoding needed)
  const framesIn = async (f) => {
    const crc = f + '.crc';
    const r = await run(ff, ['-y', '-hide_banner', '-i', f, '-map', '0:v:0', '-c', 'copy', '-f', 'framecrc', crc], { ms: 60000 });
    if (r.code !== 0) return 0;
    try { return fs.readFileSync(crc, 'utf8').split('\n').filter((l) => l && l[0] !== '#').length; } catch { return 0; }
  };
  for (let i = 0; i < parts.length; i++) {
    if (cancelled()) return null;
    const p = parts[i], out = path.join(dir, `part${String(i).padStart(4, '0')}.mp4`);
    let args, nFrames = 0;
    if (p.kind === 'copy') {
      // copy from keyframe k1 up to (not including) keyframe k2; pictures stored past the cut are dropped
      args = ['-y', '-hide_banner', '-ss', p.in.toFixed(4), '-i', p.file, '-t', (p.dur + 0.5).toFixed(4), '-map', '0:v:0', '-an', '-sn', '-dn', '-c:v', 'copy',
        '-bsf:v', `noise=drop=gte((pts-startpts)*tb\\,${(p.dur - frame / 2).toFixed(4)})`, '-avoid_negative_ts', 'make_zero', '-f', 'mp4', out];
    } else {
      const sg = p.sg, segEnd = frames / fps + sg.dur;
      nFrames = Math.max(1, Math.round(segEnd * fps) - frames);
      const d = (nFrames / fps).toFixed(4);
      if (sg.type === 'gap') {
        args = ['-y', '-hide_banner', '-f', 'lavfi', '-i', `color=c=${col}:s=${w}x${h}:r=${fps}:d=${(+d + 1).toFixed(3)}`, '-vf', 'format=yuv420p,setsar=1', ...enc, '-frames:v', String(nFrames), '-f', 'mp4', out];
      } else {
        const fit = sg.fit === 'cover'
          ? `scale=${w}:${h}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w}:${h}`
          : `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${col}`;
        const input = sg.kind === 'image' ? ['-loop', '1', '-framerate', String(fps), '-t', (+d + 1).toFixed(3), '-i', sg.file] : ['-ss', Math.max(0, sg.in).toFixed(4), '-t', (+d * (sg.speed || 1) + 0.25).toFixed(4), '-i', sg.file];
        const sp = sg.kind === 'image' ? 'setpts=PTS-STARTPTS' : `setpts=(PTS-STARTPTS)/${sg.speed || 1}`;
        args = ['-y', '-hide_banner', ...input, '-map', '0:v:0', '-an', '-sn', '-dn', '-vf', `${sp},fps=${fps},${fit},setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=1,setpts=PTS-STARTPTS`, ...enc, '-frames:v', String(nFrames), '-f', 'mp4', out];
      }
    }
    const share = p.kind === 'copy' ? p.dur * 0.05 : p.sg.dur;
    const r = await run(ff, args, { keep, onTime: (t) => onProgress && onProgress(Math.min(0.85, (0.85 * (done + Math.min(t, share))) / total)) });
    if (r.code !== 0 || !fs.existsSync(out)) return null;
    const got = await framesIn(out);
    if (!got || (nFrames && got !== nFrames) || (p.kind === 'copy' && got !== Math.round(p.dur * fps))) { if (process.env.SMART_DEBUG) console.log('frames mismatch', i, p.kind, got, nFrames); return null; }
    frames += got; done += share;
    list.push(out);
    // after a copied middle: the rest of the clip (from where the copy really ended) is encoded next
    if (p.kind === 'copy') {
      const tailIn = p.in + got / fps, tailDur = p.end - tailIn;
      if (tailDur > frame / 2) parts.splice(i + 1, 0, { kind: 'enc', sg: { ...p.sg, in: tailIn, dur: tailDur } });
    }
  }
  if (Math.abs(frames - want) > 1) return null;
  if (cancelled()) return null;
  // 3. join the pieces one after another + add the sound (the picture is not encoded again)
  const joined = path.join(dir, 'list.txt');
  fs.writeFileSync(joined, list.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n'));
  const tmpOut = target + '.smart.mp4';
  const r = await run(ff, ['-y', '-hide_banner', '-f', 'concat', '-safe', '0', '-i', joined, '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', audio,
    '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-tag:v', 'avc3', '-c:a', 'aac', '-b:a', '320k',
    '-t', duration.toFixed(3), '-movflags', '+faststart', tmpOut], { keep, onTime: (t) => onProgress && onProgress(0.85 + 0.1 * Math.min(1, t / duration)) });
  if (r.code !== 0) { try { fs.unlinkSync(tmpOut); } catch {} return null; }
  // 4. check the result: it must decode cleanly and be the right length
  const chk = await run(ff, ['-hide_banner', '-v', 'error', '-i', tmpOut, '-map', '0:v:0', '-f', 'null', '-'], { keep, ms: Math.max(60000, duration * 2000) });
  const info = await run(ff, ['-hide_banner', '-i', tmpOut], { ms: 20000 });
  const dm = /Duration: (\d+):(\d+):([\d.]+)/.exec(info.err);
  const outDur = dm ? +dm[1] * 3600 + +dm[2] * 60 + parseFloat(dm[3]) : 0;
  const bad = chk.code !== 0 || /error|corrupt|missing|non-existing|unavailable/i.test(chk.err) || Math.abs(outDur - duration) > Math.max(0.15, 2 / fps);
  if (bad) { try { fs.unlinkSync(tmpOut); } catch {} return null; }
  try { fs.renameSync(tmpOut, target); } catch { try { fs.copyFileSync(tmpOut, target); fs.unlinkSync(tmpOut); } catch { return null; } }
  onProgress && onProgress(1);
  return { ok: true, path: target, copied: copySecs };
}

module.exports = { smartRender, probe, keyframes };
