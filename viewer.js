// In-page episode player: streams MCAP chunks over HTTP Range, decodes every camera with WebCodecs,
// keeps the cameras in sync on one clock, and plots arm joints as data arrives.
import { readSummary, readChunk, protoFields, protoDoubles, text, isKeyframe, codecString } from './mcap.js';

const CAMERA_ORDER = ['/top-left-camera', '/top-camera', '/top-right-camera', '/left-wrist-camera', '/right-wrist-camera'];
const PARALLEL_CHUNKS = 6;
const JOINT_COLORS = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#76b7b2'];
const $ = id => document.getElementById(id);

const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function createViewer({ sign, range, decompress, onAuthError }) {
  let session = null;

  async function open(ep, { title, subtitle, onPrev, onNext }) {
    close();
    const s = session = { ep, closed: false, abort: new AbortController() };
    $('pv-title').textContent = title;
    $('pv-id').textContent = subtitle;
    $('pv-instruction').textContent = '';
    $('pv-status').textContent = '…';
    $('pv-cams').innerHTML = '';
    $('pv-prev').disabled = !onPrev; $('pv-prev').onclick = onPrev;
    $('pv-next').disabled = !onNext; $('pv-next').onclick = onNext;
    const dlg = $('player');
    if (!dlg.open) dlg.showModal();
    try {
      await load(s);
    } catch (e) {
      if (s.closed) return;
      if (e.name === 'AuthError') return onAuthError(e);
      $('pv-status').textContent = e.message;
    }
  }

  function close() {
    const s = session;
    session = null;
    if (!s) return;
    s.closed = true;
    s.abort.abort();
    cancelAnimationFrame(s.raf);
    for (const cam of s.cams || []) {
      try { cam.dec?.close(); } catch { /* already closed */ }
      cam.out.forEach(f => f.close());
      cam.out = [];
    }
  }

  // ---------- loading ----------
  async function load(s) {
    let signed = await sign(s.ep + '/episode.mcap');
    const fetchRange = async (a, b) => {
      try { return await range(signed, a, b, s.abort.signal); }
      catch (e) {
        if (s.closed || !/40[13]/.test(e.message)) throw e;
        signed = await sign(s.ep + '/episode.mcap', true); // signed CDN URL expired
        return range(signed, a, b, s.abort.signal);
      }
    };
    s.fetchRange = fetchRange;
    const meta = await readSummary(fetchRange, signed.size);
    if (s.closed) return;
    s.start = meta.start;
    s.duration = meta.duration || (meta.chunks.at(-1).end - meta.start) / 1e9;
    s.size = signed.size;
    s.chunks = meta.chunks.map(c => ({ ...c, state: 'idle', samples: null, telemetry: null }));
    const channels = [...meta.channels.values()];
    const video = channels.filter(c => c.schema.endsWith('CompressedVideo'))
      .sort((a, b) => (CAMERA_ORDER.indexOf(a.topic) + 1 || 99) - (CAMERA_ORDER.indexOf(b.topic) + 1 || 99));
    if (!video.length) throw new Error('No camera streams');
    if (!('VideoDecoder' in window)) throw new Error('This browser has no WebCodecs');
    s.byChannel = new Map();
    const grid = $('pv-cams');
    grid.style.setProperty('--cols', video.length === 4 ? 2 : Math.min(video.length, 3));
    s.cams = video.map((c, i) => {
      const box = document.createElement('figure');
      box.innerHTML = `<canvas></canvas><figcaption>${c.topic.replace(/^\//, '').replace(/-camera$/, '')}</figcaption>`;
      grid.appendChild(box);
      const cam = { i, channel: c.id, topic: c.topic, canvas: box.querySelector('canvas'), box, out: [], keyframes: [], inflight: 0, cursor: null, target: 0, waiting: false, ended: false, drawn: null, cfg: null, dec: null };
      cam.ctx = cam.canvas.getContext('2d');
      s.byChannel.set(c.id, { kind: 'video', cam });
      return cam;
    });
    for (const c of channels) {
      const m = /^\/(left|right)-(arm|ee)-state$/.exec(c.topic);
      if (m) s.byChannel.set(c.id, { kind: 'tele', side: m[1], part: m[2] });
      if (c.topic === '/instruction') s.byChannel.set(c.id, { kind: 'instruction' });
    }
    s.instructions = [];
    s.playhead = 0; s.playing = false; s.speed = +$('pv-speed').value || 1; s.focus = 0; s.active = 0;
    s.lastTick = performance.now();
    setupControls(s);
    for (let i = 0; i < PARALLEL_CHUNKS; i++) pumpFetch(s);
    seek(s, 0);
    s.playing = true;
    s.raf = requestAnimationFrame(t => tick(s, t));
  }

  function nextChunkIndex(s) {
    const n = s.chunks.length;
    for (let k = 0; k < n; k++) { const i = (s.focus + k) % n; if (s.chunks[i].state === 'idle') return i; }
    return -1;
  }

  async function pumpFetch(s) {
    while (!s.closed) {
      const i = nextChunkIndex(s);
      if (i < 0) return;
      const chunk = s.chunks[i];
      chunk.state = 'loading';
      try {
        const messages = await readChunk(s.fetchRange, chunk, decompress);
        if (s.closed) return;
        ingest(s, i, messages);
        chunk.state = 'done';
        s.loaded = (s.loaded || 0) + chunk.length;
        for (const cam of s.cams) if (cam.waiting) feed(s, cam);
        s.dirtyChart = true;
      } catch (e) {
        if (s.closed) return;
        chunk.state = 'idle';
        if (e.name === 'AuthError') return onAuthError(e);
        $('pv-status').textContent = e.message;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }

  function ingest(s, ci, messages) {
    const samples = new Map(), tele = { left: { arm: [], ee: [] }, right: { arm: [], ee: [] } };
    for (const m of messages) {
      const role = s.byChannel.get(m.channel);
      if (!role) continue;
      const t = (m.time - s.start) / 1e3; // µs
      if (role.kind === 'video') {
        const f = protoFields(m.data);
        const data = f[3];
        if (!data) continue;
        const format = text(f[4]).toLowerCase() === 'h264' ? 'h264' : 'h265';
        const key = isKeyframe(format, data);
        let list = samples.get(role.cam.i);
        if (!list) samples.set(role.cam.i, list = []);
        if (key) role.cam.keyframes.push({ t, ci, j: list.length, codec: codecString(format, data) });
        list.push({ t, key, data });
      } else if (role.kind === 'tele') {
        const list = tele[role.side][role.part];
        if (!list.length || t - list[list.length - 1][0] >= 50e3) list.push([t, protoDoubles(m.data, 2)]);
      } else if (role.kind === 'instruction') {
        const said = text(protoFields(m.data)[2]);
        if (said) s.instructions.push([t, said]);
      }
    }
    for (const cam of s.cams) cam.keyframes.sort((a, b) => a.t - b.t);
    s.instructions.sort((a, b) => a[0] - b[0]);
    s.chunks[ci].samples = samples;
    s.chunks[ci].telemetry = tele;
  }

  // ---------- decoding ----------
  const chunkAt = (s, t) => { const i = s.chunks.findIndex(c => (c.end - s.start) / 1e3 >= t); return i < 0 ? s.chunks.length - 1 : i; };

  function seek(s, t) {
    s.playhead = Math.max(0, Math.min(t, s.duration * 1e6));
    s.focus = chunkAt(s, s.playhead - 2.5e6); // keyframes are ~2 s apart
    for (const cam of s.cams) restart(s, cam);
  }

  function restart(s, cam) {
    cam.out.forEach(f => f.close());
    cam.out = [];
    cam.inflight = 0;
    cam.drawn = null;
    cam.ended = false;
    cam.cursor = null;
    cam.waiting = true;
    cam.target = s.playhead - 40e3;
    if (cam.failed) return;
    let kf = null;
    for (const k of cam.keyframes) { if (k.t <= s.playhead + 1) kf = k; else break; }
    let p = chunkAt(s, s.playhead);
    if (!kf && cam.keyframes.length) { kf = cam.keyframes[0]; p = kf.ci; } // camera starts slightly after the episode clock
    if (!kf) return;
    // Every chunk between that keyframe and the playhead must be here, otherwise a closer keyframe may still be missing.
    if (kf.t > s.playhead) for (let i = 0; i < kf.ci; i++) if (s.chunks[i].state !== 'done') return;
    for (let i = kf.ci; i <= p; i++) if (s.chunks[i].state !== 'done') return;
    const support = codecSupport(kf.codec);
    if (support.ok === undefined) { support.promise.then(() => { if (!s.closed && cam.waiting) restart(s, cam); }); return; }
    if (!support.ok) return fail(s, cam, `${kf.codec.startsWith('avc') ? 'H.264' : 'H.265'} decoding is not supported in this browser`);
    if (!cam.dec) {
      cam.dec = new VideoDecoder({ output: frame => onFrame(s, cam, frame), error: e => fail(s, cam, e.message) });
    }
    if (cam.dec.state === 'closed') return;
    if (cam.dec.state === 'configured') cam.dec.reset();
    try { cam.dec.configure({ codec: kf.codec, optimizeForLatency: true }); } catch (e) { return fail(s, cam, e.message); }
    cam.cursor = { ci: kf.ci, j: kf.j };
    cam.waiting = false;
    feed(s, cam);
  }

  function fail(s, cam, message) {
    cam.failed = true;
    cam.box.dataset.err = message.slice(0, 80);
    if (s.cams.every(c => c.failed)) s.abort.abort(); // nothing can play: stop downloading
  }

  const supportCache = new Map();
  function codecSupport(codec) {
    let v = supportCache.get(codec);
    if (!v) {
      v = { ok: undefined };
      v.promise = VideoDecoder.isConfigSupported({ codec }).then(r => { v.ok = !!r.supported; }, () => { v.ok = false; });
      supportCache.set(codec, v);
    }
    return v;
  }

  function onFrame(s, cam, frame) {
    cam.inflight = Math.max(0, cam.inflight - 1);
    if (s.closed || frame.timestamp < cam.target) { frame.close(); }
    else cam.out.push(frame);
    feed(s, cam);
  }

  function feed(s, cam) {
    if (s.closed) return;
    if (!cam.cursor) { restart(s, cam); if (!cam.cursor) return; }
    if (cam.dec?.state !== 'configured') return;
    while (cam.inflight + cam.out.length < 10 && cam.dec.decodeQueueSize < 4) {
      const chunk = s.chunks[cam.cursor.ci];
      if (!chunk) { cam.ended = true; if (cam.inflight) cam.dec.flush().catch(() => {}); return; }
      if (chunk.state !== 'done') { cam.waiting = true; return; }
      const list = chunk.samples.get(cam.i) || [];
      if (cam.cursor.j >= list.length) { cam.cursor = { ci: cam.cursor.ci + 1, j: 0 }; continue; }
      const sample = list[cam.cursor.j++];
      cam.waiting = false;
      try {
        cam.dec.decode(new EncodedVideoChunk({ type: sample.key ? 'key' : 'delta', timestamp: Math.round(sample.t), data: sample.data }));
        cam.inflight++;
      } catch (e) { return fail(s, cam, e.message); }
    }
  }

  // ---------- playback ----------
  function tick(s, now) {
    if (s.closed) return;
    const dt = Math.min(100, now - s.lastTick);
    s.lastTick = now;
    const end = s.duration * 1e6;
    const buffering = s.playing && s.cams.some(c => !c.ended && !c.failed && !c.out.some(f => f.timestamp > s.playhead));
    if (s.playing && !buffering) {
      s.playhead += dt * 1e3 * s.speed;
      if (s.playhead >= end) { s.playhead = end; s.playing = false; }
      s.focus = chunkAt(s, s.playhead);
    }
    for (const cam of s.cams) {
      while (cam.out.length > 1 && cam.out[1].timestamp <= s.playhead) cam.out.shift().close();
      const f = cam.out[0];
      if (f && f !== cam.drawn && f.timestamp <= s.playhead + 50e3) {
        if (cam.canvas.width !== f.displayWidth) { cam.canvas.width = f.displayWidth; cam.canvas.height = f.displayHeight; }
        cam.ctx.drawImage(f, 0, 0);
        cam.drawn = f;
        cam.box.classList.add('live');
      }
      feed(s, cam);
    }
    renderControls(s, buffering);
    s.raf = requestAnimationFrame(t => tick(s, t));
  }

  function setupControls(s) {
    $('pv-play').onclick = () => togglePlay(s);
    const seekBar = $('pv-seek');
    seekBar.max = String(s.duration);
    seekBar.oninput = () => { s.scrubbing = true; s.playhead = +seekBar.value * 1e6; };
    seekBar.onchange = () => { s.scrubbing = false; seek(s, +seekBar.value * 1e6); };
    $('pv-speed').onchange = () => { s.speed = +$('pv-speed').value; };
    $('pv-total').textContent = fmtTime(s.duration);
    for (const side of ['left', 'right']) {
      const c = $(`pv-chart-${side}`);
      c.onclick = e => { const r = c.getBoundingClientRect(); seek(s, (e.clientX - r.left) / r.width * s.duration * 1e6); };
    }
  }

  function togglePlay(s) {
    if (s.playhead >= s.duration * 1e6 - 1e4) seek(s, 0);
    s.playing = !s.playing;
  }

  function renderControls(s, buffering) {
    $('pv-play').textContent = s.playing ? '❚❚' : '▶';
    if (!s.scrubbing) $('pv-seek').value = String(s.playhead / 1e6);
    $('pv-time').textContent = fmtTime(s.playhead / 1e6);
    const pct = Math.round(100 * s.chunks.filter(c => c.state === 'done').length / s.chunks.length);
    $('pv-status').textContent = s.cams.every(c => c.failed) ? ''
      : buffering ? `buffering · ${pct}%` : pct < 100 ? `${pct}%` : '';
    drawLoaded(s);
    let said = '';
    for (const [t, x] of s.instructions) { if (t <= s.playhead + 1) said = x; else break; }
    if (!said && s.instructions.length) said = s.instructions[0][1];
    if ($('pv-instruction').textContent !== said) $('pv-instruction').textContent = said;
    const now = performance.now();
    if (s.dirtyChart || now - (s.chartAt || 0) > 100) { drawCharts(s); s.chartAt = now; s.dirtyChart = false; }
  }

  function drawLoaded(s) {
    const c = $('pv-loaded');
    const w = c.clientWidth;
    if (c.width !== w) c.width = w;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = getComputedStyle(c).color;
    const span = s.duration * 1e9;
    for (const ch of s.chunks) {
      if (ch.state !== 'done') continue;
      const a = (ch.start - s.start) / span, b = (ch.end - s.start) / span;
      ctx.fillRect(Math.floor(a * w), 0, Math.ceil((b - a) * w) + 1, c.height);
    }
  }

  function drawCharts(s) {
    for (const side of ['left', 'right']) {
      const arm = [], ee = [];
      for (const ch of s.chunks) if (ch.telemetry) { arm.push(...ch.telemetry[side].arm); ee.push(...ch.telemetry[side].ee); }
      arm.sort((a, b) => a[0] - b[0]); ee.sort((a, b) => a[0] - b[0]);
      const c = $(`pv-chart-${side}`);
      const dpr = devicePixelRatio || 1, w = c.clientWidth * dpr, h = c.clientHeight * dpr;
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      const ctx = c.getContext('2d');
      const css = getComputedStyle(c);
      ctx.clearRect(0, 0, w, h);
      const span = s.duration * 1e6, pad = 4 * dpr;
      let lo = Infinity, hi = -Infinity;
      for (const [, v] of arm) for (let j = 0; j < Math.min(6, v.length); j++) { lo = Math.min(lo, v[j]); hi = Math.max(hi, v[j]); }
      if (lo < hi) {
        const y = v => h - pad - (v - lo) / (hi - lo) * (h - 2 * pad);
        ctx.lineWidth = 1.5 * dpr;
        for (let j = 0; j < 6; j++) {
          ctx.strokeStyle = JOINT_COLORS[j];
          ctx.beginPath();
          let pen = false, prev = -Infinity;
          for (const [t, v] of arm) {
            if (v.length <= j) continue;
            const x = t / span * w;
            if (pen && t - prev > 300e3) pen = false; // gap: chunk not loaded yet
            pen ? ctx.lineTo(x, y(v[j])) : ctx.moveTo(x, y(v[j]));
            pen = true; prev = t;
          }
          ctx.stroke();
        }
      }
      let gHi = 0;
      for (const [, v] of ee) gHi = Math.max(gHi, v[0] || 0);
      if (gHi > 0) {
        ctx.strokeStyle = css.color; ctx.setLineDash([4 * dpr, 3 * dpr]); ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        let pen = false, prev = -Infinity;
        for (const [t, v] of ee) {
          const x = t / span * w, yy = h - pad - (v[0] || 0) / gHi * (h - 2 * pad);
          if (pen && t - prev > 300e3) pen = false;
          pen ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
          pen = true; prev = t;
        }
        ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.strokeStyle = css.getPropertyValue('--cursor') || '#e15759';
      ctx.lineWidth = 1.5 * dpr;
      const cx = s.playhead / span * w;
      ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    }
  }

  // ---------- keyboard ----------
  document.addEventListener('keydown', e => {
    const s = session;
    if (!s || !$('player').open || e.target.tagName === 'SELECT' || !s.cams) return;
    if (e.key === ' ') { e.preventDefault(); togglePlay(s); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); seek(s, s.playhead + (e.shiftKey ? 10e6 : 2e6)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); seek(s, s.playhead - (e.shiftKey ? 10e6 : 2e6)); }
    else if (e.key === 'ArrowDown' || e.key === ']') { e.preventDefault(); $('pv-next').click(); }
    else if (e.key === 'ArrowUp' || e.key === '[') { e.preventDefault(); $('pv-prev').click(); }
  });
  $('player').addEventListener('close', close);
  $('pv-close').onclick = () => $('player').close();

  return { open, close };
}
