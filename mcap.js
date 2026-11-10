// Minimal indexed MCAP reader over HTTP Range requests: summary + one chunk.
const td = new TextDecoder();

class Reader {
  constructor(buf) { this.b = buf; this.v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); this.o = 0; }
  u16() { const x = this.v.getUint16(this.o, true); this.o += 2; return x; }
  u32() { const x = this.v.getUint32(this.o, true); this.o += 4; return x; }
  u64() { const x = this.v.getBigUint64(this.o, true); this.o += 8; return Number(x); }
  str() { const n = this.u32(); const s = td.decode(this.b.subarray(this.o, this.o + n)); this.o += n; return s; }
  bytes(n) { const s = this.b.subarray(this.o, this.o + n); this.o += n; return s; }
}

function* records(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let o = 0;
  while (o + 9 <= buf.length) {
    const op = buf[o], len = Number(v.getBigUint64(o + 1, true));
    yield { op, body: buf.subarray(o + 9, o + 9 + len) };
    o += 9 + len;
  }
}

const FOOTER = 8 + 1 + 8 + 20; // magic + footer record

export async function readSummary(fetchRange, size) {
  const tailStart = Math.max(0, size - 512 * 1024);
  let tail = await fetchRange(tailStart, size - 1);
  const f = new Reader(tail.subarray(tail.length - FOOTER));
  if (f.b[0] !== 0x02) throw new Error('mcap footer');
  f.o = 9;
  const summaryStart = f.u64();
  if (!summaryStart) throw new Error('mcap without summary');
  let base = tailStart;
  if (summaryStart < tailStart) { tail = await fetchRange(summaryStart, size - 1); base = summaryStart; }
  const summary = tail.subarray(summaryStart - base, tail.length - FOOTER);
  const schemas = new Map(), channels = new Map(), chunks = [];
  let duration = 0;
  for (const { op, body } of records(summary)) {
    const r = new Reader(body);
    if (op === 0x03) {
      const id = r.u16(); schemas.set(id, { id, name: r.str(), encoding: r.str() });
    } else if (op === 0x04) {
      const id = r.u16(), schemaId = r.u16(); channels.set(id, { id, schemaId, topic: r.str(), encoding: r.str() });
    } else if (op === 0x08) {
      const start = r.u64(), end = r.u64(), offset = r.u64(), length = r.u64();
      const mapLen = r.u32(), ids = new Set();
      for (let i = 0; i < mapLen / 10; i++) { ids.add(r.u16()); r.u64(); }
      r.u64();
      chunks.push({ start, end, offset, length, ids, compression: r.str() });
    } else if (op === 0x0b) {
      r.u64(); r.u16(); r.u32(); r.u32(); r.u32(); r.u32();
      const start = r.u64(), end = r.u64();
      duration = (end - start) / 1e9;
    }
  }
  chunks.sort((a, b) => a.start - b.start);
  for (const c of channels.values()) c.schema = schemas.get(c.schemaId)?.name || '';
  return { channels, chunks, duration };
}

export async function readChunk(fetchRange, chunk, decompress) {
  const buf = await fetchRange(chunk.offset, chunk.offset + chunk.length - 1);
  const rec = records(buf).next().value;
  if (!rec || rec.op !== 0x06) throw new Error('mcap chunk');
  const r = new Reader(rec.body);
  r.u64(); r.u64(); const rawSize = r.u64(); r.u32();
  const compression = r.str();
  const data = r.bytes(r.u64());
  const raw = compression === '' ? data : compression === 'zstd' ? decompress(data, rawSize) : null;
  if (!raw) throw new Error('mcap compression ' + compression);
  const out = [];
  for (const { op, body } of records(raw)) {
    if (op !== 0x05) continue;
    const m = new Reader(body);
    out.push({ channel: m.u16(), seq: m.u32(), time: m.u64(), data: body.subarray(22) });
  }
  return out;
}

// Protobuf: top-level fields, last value per field number (LEN fields as bytes).
export function protoFields(buf) {
  const out = {};
  let o = 0;
  const varint = () => { let x = 0, s = 1; for (;;) { const b = buf[o++]; x += (b & 127) * s; if (b < 128) return x; s *= 128; } };
  while (o < buf.length) {
    const key = varint(), field = Math.floor(key / 8), wire = key & 7;
    if (wire === 0) out[field] = varint();
    else if (wire === 2) { const n = varint(); out[field] = buf.subarray(o, o + n); o += n; }
    else if (wire === 1) o += 8;
    else if (wire === 5) o += 4;
    else break;
  }
  return out;
}

export const text = b => (b instanceof Uint8Array ? td.decode(b) : '');

// Annex B NAL units.
export function nals(data) {
  const starts = [];
  for (let i = 0; i + 3 <= data.length; i++) {
    if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) { starts.push(i + 3); i += 2; }
  }
  return starts.map((s, k) => {
    let e = k + 1 < starts.length ? starts[k + 1] - 3 : data.length;
    if (e > s && data[e - 1] === 0) e--;
    return data.subarray(s, e);
  });
}

const unescape = n => {
  const out = [];
  for (let i = 0; i < n.length; i++) {
    if (i >= 2 && n[i] === 3 && n[i - 1] === 0 && n[i - 2] === 0) continue;
    out.push(n[i]);
  }
  return Uint8Array.from(out);
};
const hex = (n, w = 2) => n.toString(16).toUpperCase().padStart(w, '0');

export function codecString(format, data) {
  const units = nals(data);
  if (format === 'h264') {
    const sps = units.find(n => (n[0] & 31) === 7);
    return sps ? 'avc1.' + hex(sps[1]) + hex(sps[2]) + hex(sps[3]) : 'avc1.640028';
  }
  const sps = units.find(n => ((n[0] >> 1) & 63) === 33);
  if (!sps) return 'hev1.1.6.L120.90';
  const p = unescape(sps).subarray(3); // 2-byte NAL header + vps/max_sub_layers byte
  const space = ['', 'A', 'B', 'C'][p[0] >> 6], tier = (p[0] >> 5) & 1, profile = p[0] & 31;
  let compat = (p[1] << 24 | p[2] << 16 | p[3] << 8 | p[4]) >>> 0, rev = 0;
  for (let i = 0; i < 32; i++) { rev = (rev << 1 | (compat & 1)) >>> 0; compat >>>= 1; }
  const cons = Array.from(p.subarray(5, 11));
  while (cons.length > 1 && cons[cons.length - 1] === 0) cons.pop();
  return `hev1.${space}${profile}.${rev.toString(16).toUpperCase()}.${tier ? 'H' : 'L'}${p[11]}.${cons.map(c => hex(c)).join('.')}`;
}

export function isKeyframe(format, data) {
  return nals(data).some(n => format === 'h264' ? (n[0] & 31) === 5 : (((n[0] >> 1) & 63) >= 16 && ((n[0] >> 1) & 63) <= 21));
}

const CAMERA_ORDER = ['/top-left-camera', '/top-camera', '/top-right-camera', '/left-wrist-camera', '/right-wrist-camera'];

// First decodable camera frame (+ first instruction) of an episode, reading only summary + first chunk.
export async function firstFrame(fetchRange, size, decompress) {
  const meta = await readSummary(fetchRange, size);
  const cams = [...meta.channels.values()].filter(c => /Compressed(Video|Image)$/.test(c.schema));
  if (!cams.length) throw new Error('no camera');
  cams.sort((a, b) => (CAMERA_ORDER.indexOf(a.topic) + 1 || 99) - (CAMERA_ORDER.indexOf(b.topic) + 1 || 99));
  const cam = cams[0];
  const instr = [...meta.channels.values()].find(c => c.topic === '/instruction');
  const chunk = meta.chunks.find(c => c.ids.has(cam.id));
  if (!chunk) throw new Error('no chunk');
  const messages = await readChunk(fetchRange, chunk, decompress);
  let instruction = '';
  if (instr) { const m = messages.find(x => x.channel === instr.id); if (m) instruction = text(protoFields(m.data)[2]); }
  const frames = messages.filter(m => m.channel === cam.id).map(m => protoFields(m.data));
  if (cam.schema.endsWith('CompressedImage')) {
    const f = frames[0];
    return { kind: 'image', format: text(f[4]), data: f[3], topic: cam.topic, instruction, duration: meta.duration, cameras: cams.length };
  }
  const f = frames.find(x => isKeyframe(text(x[4]).toLowerCase(), x[3]));
  if (!f) throw new Error('no keyframe');
  const format = text(f[4]).toLowerCase() === 'h264' ? 'h264' : 'h265';
  return { kind: 'video', format, data: f[3], codec: codecString(format, f[3]), topic: cam.topic, instruction, duration: meta.duration, cameras: cams.length };
}
