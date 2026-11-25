// Flux Mobile: turns speech into words in the background, so the app never freezes while it listens.
let pipeP = null, pipeName = '';
function getPipe(size, tf) {
  const name = 'Xenova/whisper-' + (size === 'base' ? 'base' : 'tiny');
  if (pipeP && pipeName === name) return pipeP;
  pipeName = name;
  pipeP = (async () => {
    const T = await import(tf);
    T.env.allowLocalModels = false;
    const files = {};
    return T.pipeline('automatic-speech-recognition', name, {
      dtype: 'q8', device: 'wasm',
      progress_callback: (p) => {
        if (p.status === 'progress' && p.total) {
          files[p.file] = [p.loaded, p.total];
          const all = Object.values(files);
          self.postMessage({ type: 'progress', p: all.reduce((a, f) => a + f[0], 0) / all.reduce((a, f) => a + f[1], 0) });
        }
      }
    });
  })();
  pipeP.catch(() => { pipeP = null; pipeName = ''; });
  return pipeP;
}
self.onmessage = async (e) => {
  const { id, size, audio, tf } = e.data;
  try {
    const asr = await getPipe(size, tf);
    if (!audio) return self.postMessage({ id, ok: true, chunks: [] });
    let out, wordLevel = true;
    try { out = await asr(audio, { return_timestamps: 'word', chunk_length_s: 30 }); }
    catch { wordLevel = false; out = await asr(audio, { return_timestamps: true, chunk_length_s: 30 }); }
    self.postMessage({ id, ok: true, wordLevel, chunks: (out.chunks || []).map((c) => ({ text: c.text, timestamp: c.timestamp })) });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String((err && err.message) || err) });
  }
};
