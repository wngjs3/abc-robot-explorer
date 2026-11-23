import { decompress, Decompress } from 'https://cdn.jsdelivr.net/npm/fzstd@0.1.1/+esm';
import { firstFrame } from './mcap.js';
import { createViewer } from './viewer.js';

const REPO = 'XDOF/ABC-130k';
const HF = `https://huggingface.co/datasets/${REPO}`;
const API = `https://huggingface.co/api/datasets/${REPO}`;
const SPLIT_ORDER = ['train', 'val', 'sim', 'dagger', 'eval'];
const WEEK = 7 * 864e5;

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = p => p.split('/').map(encodeURIComponent).join('/');
const label = s => s.replace(/_/g, ' ');
const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const fmt = n => n == null ? '–' : n.toLocaleString('en-US');
const ls = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del: k => { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

let token = ls.get('hf_token');
const auth = () => ({ Authorization: 'Bearer ' + token });

// ---------- HTTP + cache ----------
class AuthError extends Error { name = 'AuthError'; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function hf(url, opts = {}) {
  let r;
  for (let attempt = 0; ; attempt++) {
    r = await fetch(url, { ...opts, headers: { ...auth(), ...(opts.headers || {}) } });
    if (r.status !== 429 || attempt === 4) break;
    await sleep((+r.headers.get('retry-after') || 2 ** attempt) * 1000);
  }
  if (r.status === 401 || r.status === 403) throw new AuthError(String(r.status));
  if (!r.ok) throw new Error(`${r.status} ${url.replace(HF, '').replace(API, '')}`);
  return r;
}

const CACHE = 'abc-explorer-v1';
const ckey = k => new URL('__cache/' + encodeURIComponent(k), location.href).href;
async function cacheGet(key, maxAge) {
  try {
    const r = await (await caches.open(CACHE)).match(ckey(key));
    if (!r || (maxAge && Date.now() - +r.headers.get('x-time') > maxAge)) return null;
    return r;
  } catch { return null; }
}
async function cachePut(key, body, type, extra = {}) {
  try {
    await (await caches.open(CACHE)).put(ckey(key),
      new Response(body, { headers: { 'content-type': type, 'x-time': String(Date.now()), ...extra } }));
  } catch { /* cache unavailable */ }
}

async function listDir(path, { limit = 0, onPage } = {}) {
  const key = `list:${path}:${limit}`;
  const hit = await cacheGet(key, WEEK);
  if (hit) return hit.json();
  const out = [];
  let url = `${API}/tree/main/${enc(path)}?limit=${limit ? Math.min(limit, 1000) : 1000}`;
  while (url) {
    const r = await hf(url);
    for (const it of await r.json()) out.push({ dir: it.type === 'directory', name: it.path.split('/').pop(), size: it.size });
    onPage?.(out.length);
    if (limit && out.length >= limit) break;
    url = /<([^>]+)>;\s*rel="next"/.exec(r.headers.get('link') || '')?.[1];
  }
  await cachePut(key, JSON.stringify(out), 'application/json');
  return out;
}

// Every file under a task: episode dirs with episode.mcap size and whether annotation.mcap exists.
async function listEpisodes(path, onPage) {
  const key = `tree:${path}`;
  const hit = await cacheGet(key, WEEK);
  if (hit) return hit.json();
  const eps = new Map();
  const get = name => { let e = eps.get(name); if (!e) eps.set(name, e = { name, size: 0, annotated: false }); return e; };
  let url = `${API}/tree/main/${enc(path)}?recursive=true&limit=1000`;
  while (url) {
    const r = await hf(url);
    for (const it of await r.json()) {
      const rel = it.path.slice(path.length + 1).split('/');
      if (!rel[0].startsWith('episode')) continue;
      const e = get(rel[0]);
      if (rel[1] === 'episode.mcap') e.size = it.size;
      if (rel[1] === 'annotation.mcap') e.annotated = true;
    }
    onPage?.(eps.size);
    url = /<([^>]+)>;\s*rel="next"/.exec(r.headers.get('link') || '')?.[1];
  }
  const out = [...eps.values()];
  await cachePut(key, JSON.stringify(out), 'application/json');
  return out;
}

async function report(split) {
  const key = `report:${split}`;
  let text = await (await cacheGet(key, WEEK))?.text();
  if (!text) {
    try { text = await (await hf(`${HF}/resolve/main/meta/${split}_report.txt`)).text(); } catch (e) { if (e instanceof AuthError) throw e; return null; }
    await cachePut(key, text, 'text/plain');
  }
  const tasks = new Map();
  let total = null;
  for (const line of text.split('\n')) {
    const p = line.trim().split(/\s+/);
    if (p.length < 4) continue;
    const [episodes, annotated, hours] = p.slice(-3).map(Number);
    if ([episodes, annotated, hours].some(Number.isNaN)) continue;
    const name = p.slice(0, -3).join(' ');
    if (name === 'TOTAL') total = { episodes, annotated, hours };
    else tasks.set(norm(name), { episodes, annotated, hours });
  }
  return { tasks, total };
}

const signed = new Map();
async function sign(path, force = false) {
  const c = signed.get(path);
  if (c && !force && Date.now() - c.t < 40 * 60e3) return c;
  const r = await hf(`${HF}/resolve/main/${enc(path)}`, { headers: { Range: 'bytes=0-0' } });
  const size = +(r.headers.get('content-range') || '').split('/')[1];
  await r.arrayBuffer();
  const v = { url: r.url, size, t: Date.now(), direct: r.url.startsWith('https://huggingface.co/') };
  signed.set(path, v);
  return v;
}
async function range(s, a, b, signal) {
  const r = await fetch(s.url, { signal, headers: { ...(s.direct ? auth() : {}), Range: `bytes=${a}-${b}` } });
  if (r.status !== 206 && r.status !== 200) throw new Error('range ' + r.status);
  const u = new Uint8Array(await r.arrayBuffer());
  return r.status === 200 ? u.subarray(a, b + 1) : u;
}

// ---------- thumbnails ----------
async function decodeToJpeg(f) {
  if (!('VideoDecoder' in window)) throw new Error('WebCodecs');
  const cfg = { codec: f.codec, optimizeForLatency: true };
  if (!(await VideoDecoder.isConfigSupported(cfg)).supported) throw new Error(f.format.toUpperCase());
  const frame = await new Promise((resolve, reject) => {
    let got = false;
    const d = new VideoDecoder({ output: fr => { if (got) fr.close(); else { got = true; resolve(fr); } }, error: reject });
    d.configure(cfg);
    d.decode(new EncodedVideoChunk({ type: 'key', timestamp: 0, data: f.data }));
    d.flush().then(() => { d.close(); if (!got) reject(new Error('no frame')); }, reject);
  });
  const w = 480, h = Math.round(frame.displayHeight * w / frame.displayWidth);
  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext('2d').drawImage(frame, 0, 0, w, h);
  frame.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
}

const thumbs = new Map(); // episode path -> {url, instruction, duration}
async function thumbnail(ep) {
  if (thumbs.has(ep)) return thumbs.get(ep);
  const key = 'thumb:' + ep;
  const hit = await cacheGet(key);
  let v;
  if (hit) {
    v = { url: URL.createObjectURL(await hit.blob()), instruction: decodeURIComponent(hit.headers.get('x-instr') || ''), duration: +hit.headers.get('x-dur') };
  } else {
    const s = await sign(ep + '/episode.mcap');
    const f = await firstFrame((a, b) => range(s, a, b), s.size, d => decompress(d), Decompress);
    const blob = f.kind === 'image' ? new Blob([f.data], { type: 'image/' + (f.format || 'jpeg') }) : await decodeToJpeg(f);
    await cachePut(key, blob, blob.type, { 'x-instr': encodeURIComponent(f.instruction), 'x-dur': String(f.duration) });
    v = { url: URL.createObjectURL(blob), instruction: f.instruction, duration: f.duration };
  }
  thumbs.set(ep, v);
  return v;
}

// Parallel thumbnail loading: only cards near the viewport are queued; they start in on-screen order.
const PARALLEL = 16;
const pending = new Set();
let active = 0;
const observer = new IntersectionObserver(entries => {
  for (const e of entries) e.isIntersecting ? pending.add(e.target) : pending.delete(e.target);
  pump();
}, { rootMargin: '400px' });
function pump() {
  while (active < PARALLEL && pending.size) {
    const el = pending.values().next().value;
    pending.delete(el);
    observer.unobserve(el);
    if (!el.isConnected) continue;
    active++;
    (async () => {
      try {
        const ep = el._episode || await el._resolve();
        const t = await thumbnail(ep);
        if (!el.isConnected) return;
        el.querySelector('img').src = t.url;
        el.classList.add('loaded');
        if (t.instruction) (el.closest('.ep, tr, .card') || el).title = t.instruction;
        const d = el.querySelector('.dur');
        if (d && t.duration) d.textContent = t.duration.toFixed(0) + 's';
      } catch (e) {
        if (e instanceof AuthError) return showGate(e.message);
        el.classList.add('failed');
        el.dataset.err = e.message.slice(0, 20);
      } finally { active--; pump(); }
    })();
  }
}
function lazyThumb(el, episodeOrResolver) {
  if (typeof episodeOrResolver === 'string') el._episode = episodeOrResolver; else el._resolve = episodeOrResolver;
  observer.observe(el);
}

// ---------- data model ----------
const state = { splits: null, data: {}, view: ls.get('view') || 'grid', sort: ls.get('sort') || 'hours', dir: -1 };

// Precomputed by tools/build_index.py: per-split task stats, so the overview needs no HF listing.
let summaryP = null;
const loadSummary = () => summaryP ??= fetch('index/summary.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);

async function loadSplits() {
  if (state.splits) return state.splits;
  const sum = await loadSummary();
  const dirs = sum ? Object.keys(sum.splits) : (await listDir('data')).filter(d => d.dir).map(d => d.name);
  state.splits = dirs.sort((a, b) => (SPLIT_ORDER.indexOf(a) + 1 || 99) - (SPLIT_ORDER.indexOf(b) + 1 || 99));
  return state.splits;
}

async function loadSplit(split) {
  if (state.data[split]) return state.data[split];
  const sum = (await loadSummary())?.splits[split];
  if (sum) {
    const tasks = Object.entries(sum).map(([name, s]) => ({ name, episodes: s.episodes, annotated: s.annotated, hours: s.hours, operators: s.operators, first: s.first, last: s.last, cover: s.cover }));
    return state.data[split] = { split, tasks, total: null, report: true };
  }
  const [dirs, rep] = await Promise.all([listDir('data/' + split), report(split)]);
  const tasks = dirs.filter(d => d.dir).map(d => {
    const s = rep?.tasks.get(norm(d.name));
    return { name: d.name, episodes: s?.episodes ?? null, annotated: s?.annotated ?? null, hours: s?.hours ?? null };
  });
  state.data[split] = { split, tasks, total: rep?.total, report: !!rep };
  return state.data[split];
}

const firstEpisode = async (split, task) => {
  const cover = state.data[split]?.tasks.find(t => t.name === task)?.cover;
  if (cover) return `data/${split}/${task}/${cover}`;
  const items = await listDir(`data/${split}/${task}`, { limit: 1 });
  const d = items.find(x => x.dir);
  if (!d) throw new Error('empty');
  return `data/${split}/${task}/${d.name}`;
};

let counting = null;
async function countEpisodes(data) {
  if (counting === data.split) return;
  counting = data.split;
  const todo = data.tasks.filter(t => t.episodes == null);
  const worker = async () => {
    while (todo.length && counting === data.split) {
      const t = todo.shift();
      try {
        t.episodes = (await listDir(`data/${data.split}/${t.name}`)).filter(x => x.dir).length;
        document.querySelectorAll(`[data-count="${CSS.escape(t.name)}"]`).forEach(el => { el.textContent = fmt(t.episodes); });
        renderStats(data);
      } catch (e) { if (e instanceof AuthError) return showGate(e.message); }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (counting === data.split) counting = null;
}

// ---------- rendering ----------
const msg = t => { $('message').textContent = t || ''; };

function renderNav(active, users = false) {
  const pre = users ? '#/users/' : '#/';
  $('splits').innerHTML = state.splits.map(s => `<a href="${pre}${esc(s)}" class="${s === active ? 'active' : ''}">${esc(s)}</a>`).join('')
    + `<span class="modes"><a href="#/${esc(active)}" class="${users ? '' : 'on'}">tasks</a><a href="#/users/${esc(active)}" class="${users ? 'on' : ''}">users</a></span>`;
}

function renderStats(data) {
  const t = data.tasks;
  const sum = k => t.reduce((a, x) => a + (x[k] || 0), 0);
  const episodes = data.total?.episodes ?? sum('episodes');
  const hours = data.total?.hours ?? (data.report ? sum('hours') : null);
  const annotated = data.total?.annotated ?? (data.report ? sum('annotated') : null);
  const cells = [
    ['tasks', fmt(t.length)],
    ['episodes', fmt(episodes) + (!data.report && t.some(x => x.episodes == null) ? '…' : '')],
    ['hours', hours == null ? '–' : hours.toFixed(1)],
    ['annotated', annotated == null || !episodes ? '–' : (100 * annotated / episodes).toFixed(1) + '%'],
    ['min / ep', hours == null || !episodes ? '–' : (hours * 60 / episodes).toFixed(2)],
  ];
  $('stats').innerHTML = cells.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('');
}

const avg = t => t.hours != null && t.episodes ? t.hours * 60 / t.episodes : null;
const SORTS = {
  name: t => t.name, episodes: t => t.episodes ?? -1, hours: t => t.hours ?? -1,
  annotated: t => t.episodes ? (t.annotated ?? -1) / t.episodes : -1, avg: t => avg(t) ?? -1,
  operators: t => t.operators ?? -1, last: t => t.last ?? -1,
};

function sortedTasks(data) {
  const q = norm($('search').value);
  const key = SORTS[state.sort] || SORTS.hours;
  const dir = state.sort === 'name' ? -state.dir : state.dir;
  return data.tasks.filter(t => !q || t.name.includes(q))
    .sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * dir; });
}

function renderTasks(data) {
  const rows = sortedTasks(data);
  const box = $('tasks');
  box.className = state.view;
  if (state.view === 'table') {
    const th = (k, l) => `<th data-sort="${k}" class="${state.sort === k ? 'on' : ''}">${l}</th>`;
    box.innerHTML = `<table><thead><tr><th></th>${th('name', 'task')}${th('episodes', 'episodes')}${th('annotated', 'annotated')}${th('hours', 'hours')}${th('avg', 'min/ep')}${th('operators', 'users')}<th>recorded</th></tr></thead><tbody>${rows.map(t =>
      `<tr data-task="${esc(t.name)}"><td class="thumb"><img alt=""></td><td>${esc(label(t.name))}</td><td data-count="${esc(t.name)}">${fmt(t.episodes)}</td><td>${t.annotated == null ? '–' : t.episodes ? Math.round(100 * t.annotated / t.episodes) + '%' : '–'}</td><td>${t.hours == null ? '–' : t.hours.toFixed(1)}</td><td>${avg(t) == null ? '–' : avg(t).toFixed(2)}</td><td>${t.operators ?? '–'}</td><td>${t.first ? `${fmtDay(t.first)} – ${fmtDay(t.last)}` : '–'}</td></tr>`).join('')}</tbody></table>`;
    box.querySelectorAll('th[data-sort]').forEach(h => h.onclick = () => setSort(h.dataset.sort, data));
    box.querySelectorAll('tr[data-task]').forEach(tr => { tr.onclick = () => { location.hash = `#/${data.split}/${tr.dataset.task}`; }; lazyThumb(tr.querySelector('.thumb'), () => firstEpisode(data.split, tr.dataset.task)); });
  } else {
    const maxHours = Math.max(...rows.map(t => t.hours || 0), 1);
    box.innerHTML = rows.map((t, i) => `<a class="card" href="#/${esc(data.split)}/${esc(t.name)}"><div class="cover"><img alt=""><span class="rank">${i + 1}</span><h3>${esc(label(t.name))}</h3></div><div class="info"><p><b data-count="${esc(t.name)}">${fmt(t.episodes)}</b> ep${t.hours == null ? '' : ` · <b>${t.hours.toFixed(1)}</b> h`}${avg(t) == null ? '' : ` · ${avg(t).toFixed(1)} min/ep`}${t.annotated == null || !t.episodes ? '' : ` · ${Math.round(100 * t.annotated / t.episodes)}% ann`}${t.operators ? ` · ${t.operators} users` : ''}${t.first ? `<br><small>${fmtDay(t.first)} – ${fmtDay(t.last)}</small>` : ''}</p>${t.hours == null ? '' : `<i class="bar" style="--w:${(100 * t.hours / maxHours).toFixed(1)}%"></i>`}</div></a>`).join('');
    box.querySelectorAll('.card').forEach((a, i) => lazyThumb(a.querySelector('.cover'), () => firstEpisode(data.split, rows[i].name)));
  }
  msg(rows.length ? '' : '—');
}

function setSort(k, data) {
  if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = -1; }
  ls.set('sort', state.sort);
  $('sort').value = state.sort;
  renderTasks(data);
}

let episodeView = null;
async function renderTask(split, task, user, day, ndays = 1) {
  const data = await loadSplit(split);
  const t = data.tasks.find(x => x.name === task) || { name: task };
  $('task-title').textContent = label(task);
  $('task-hf').href = `${HF}/tree/main/data/${enc(split)}/${enc(task)}`;
  const meta = () => [t.episodes != null && `${fmt(t.episodes)} ep`, t.hours != null && `${t.hours.toFixed(1)} h`, avg(t) != null && `${avg(t).toFixed(2)} min/ep`, t.annotated != null && t.episodes && `${Math.round(100 * t.annotated / t.episodes)}% ann`].filter(Boolean).join(' · ');
  $('task-meta').textContent = meta();
  $('episodes').innerHTML = '';
  $('dash').classList.add('hidden');
  const view = episodeView = { split, task, items: [], shown: 0, list: [], cards: new Map(), filter: { from: day ? Date.parse(day + 'T00:00:00Z') : null, to: day ? Date.parse(day + 'T00:00:00Z') + ndays * DAY : null, ops: new Set(user ? [user] : []) }, index: null };
  $('ep-annotated').checked = false;
  msg('…');
  const index = await fetchIndex(split, task);
  if (episodeView !== view) return;
  const items = index ? Object.entries(index).map(([name, x]) => ({ name, size: x.size || 0, annotated: !!x.annotated }))
    : await listEpisodes(`data/${split}/${task}`, n => { if (episodeView === view) msg(`… ${fmt(n)}`); });
  if (episodeView !== view) return;
  view.index = index;
  view.items = items;
  if (t.episodes == null) { t.episodes = items.length; $('task-meta').textContent = meta(); }
  msg(items.length ? '' : '—');
  if (!items.length) return;
  $('dash').classList.remove('hidden');
  applyIndex(view);
  resetGrid();
  renderDash();
}

// ---------- per-episode info: precomputed index/<split>/<task>.json ----------
// { "episode_<uuid>": { "start": ms, "duration": s, "operator": "<id>", "annotated": bool } }
async function fetchIndex(split, task) {
  try {
    const r = await fetch(`index/${enc(split)}/${enc(task)}.json`, { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}
function applyIndex(view) {
  if (!view.index) return;
  for (const it of view.items) {
    const x = view.index[it.name];
    if (!x || !x.start) continue;
    it.info = { start: +x.start || 0, duration: +x.duration || 0, operator: x.operator || '' };
    if (x.annotated) it.annotated = true;
  }
  rankOperators(view.items);
}

// ---------- filtering + sorting ----------
const DAY = 864e5;
const dayStart = ms => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
const weekStart = ms => { const d = new Date(dayStart(ms)); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); };
const fmtDay = ms => new Date(ms).toLocaleDateString('sv-SE');
const fmtStamp = ms => new Date(ms).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
const opShort = op => op ? `${op.slice(0, 8)}…${op.slice(-4)}` : '(none)';
const PALETTE = ['#4e79a7', '#f28e2b', '#59a14f', '#e15759', '#b07aa1', '#76b7b2', '#edc948', '#ff9da7', '#9c755f', '#3b8bd4', '#8cd17d', '#d37295'];
// Colors by user rank within the task (most episodes first), so the top users never share a color.
let opRank = new Map();
const opColor = op => { const i = op ? opRank.get(op) : undefined; return i === undefined || i >= PALETTE.length ? '#9a9a9a' : PALETTE[i]; };
function rankOperators(items) {
  const n = new Map();
  for (const it of items) if (it.info?.operator) n.set(it.info.operator, (n.get(it.info.operator) || 0) + 1);
  opRank = new Map([...n].sort((a, b) => b[1] - a[1]).map(([op], i) => [op, i]));
}
const isAnnotated = it => !!it.annotated;

const EP_SORTS = {
  'date-desc': [it => it.info?.start, -1], 'date-asc': [it => it.info?.start, 1],
  op: [it => it.info ? it.info.operator || '￿' : undefined, 1],
  'dur-desc': [it => it.info?.duration, -1], 'dur-asc': [it => it.info?.duration, 1],
  name: [it => it.name, 1],
};
state.epSort = EP_SORTS[ls.get('ep-sort')] ? ls.get('ep-sort') : 'date-desc';

// skip: filter dimensions to ignore ('date', 'op'), so each chart cross-filters by the others
function passes(it, ...skip) {
  const v = episodeView, f = v.filter, q = $('search').value.trim().toLowerCase();
  if (q && !it.name.toLowerCase().includes(q) && !(it.info?.operator || '').toLowerCase().includes(q)) return false;
  if ($('ep-annotated').checked && !isAnnotated(it)) return false;
  if (!skip.includes('date') && f.from != null && !(it.info?.start >= f.from && it.info.start < f.to)) return false;
  if (!skip.includes('op') && f.ops.size && !(it.info && f.ops.has(it.info.operator))) return false;
  return true;
}

function filteredEpisodes() {
  const [key, dir] = EP_SORTS[state.epSort];
  return episodeView.items.filter(it => passes(it)).sort((a, b) => {
    const x = key(a), y = key(b);
    if (x === y) return a.name < b.name ? -1 : 1;
    if (x === undefined) return 1; // unknown last
    if (y === undefined) return -1;
    return (x < y ? -1 : 1) * dir;
  });
}

function resetGrid() {
  const v = episodeView;
  if (!v) return;
  v.list = filteredEpisodes();
  v.shown = 0;
  v.cards = new Map();
  $('episodes').innerHTML = '';
  msg(v.list.length ? '' : '—');
  renderMoreEpisodes();
}

function cardMeta(it) {
  const i = it.info;
  return `<i style="--c:${i ? opColor(i.operator) : 'var(--line)'}"></i><span>${i?.start ? fmtStamp(i.start) : '…'}</span><span>${i ? esc(opShort(i.operator)) : ''}</span>${isAnnotated(it) ? '<em>ann</em>' : ''}`;
}

function renderMoreEpisodes() {
  const v = episodeView;
  if (!v) return;
  const items = v.list;
  const next = items.slice(v.shown, v.shown + 60);
  const box = $('episodes');
  next.forEach((it, k) => {
    const ep = `data/${v.split}/${v.task}/${it.name}`;
    const el = document.createElement('button');
    el.className = 'ep';
    el.innerHTML = `<div class="cover"><img alt=""><span class="dur"></span></div><code>${esc(it.name.replace(/^episode_/, '').slice(0, 13))}</code><div class="meta">${cardMeta(it)}</div>`;
    const index = v.shown + k;
    el.onclick = () => openEpisodeAt(items, index);
    box.appendChild(el);
    v.cards.set(it.name, el);
    lazyThumb(el.querySelector('.cover'), ep);
  });
  v.shown += next.length;
  // The observer only fires on enter/leave; on wide screens 60 cards may not push the sentinel out of range.
  if (v.shown < items.length) requestAnimationFrame(() => {
    if (episodeView === v && $('sentinel').getBoundingClientRect().top < innerHeight + 800) renderMoreEpisodes();
  });
}
new IntersectionObserver(es => { if (es[0].isIntersecting && episodeView) renderMoreEpisodes(); }, { rootMargin: '800px' }).observe($('sentinel'));

// ---------- dashboard ----------
state.metric = ls.get('metric') === 'hours' ? 'hours' : 'episodes';
const metricOf = it => state.metric === 'hours' ? (it.info?.duration || 0) / 3600 : 1;
const fmtMetric = v => state.metric === 'hours' ? (v < 10 ? v.toFixed(2) : v.toFixed(1)) + ' h' : fmt(Math.round(v)) + ' ep';

let dashTimer = null;
function scheduleDash() { if (!dashTimer) dashTimer = setTimeout(() => { dashTimer = null; renderDash(); }, 400); }

function renderDash() {
  const v = episodeView;
  if (!v || !v.items.length) return;
  const f = v.filter;
  const all = v.items, known = all.filter(it => it.info?.start);
  const sel = all.filter(it => passes(it));
  const selKnown = sel.filter(it => it.info);
  const hours = selKnown.reduce((a, it) => a + (it.info.duration || 0), 0) / 3600;
  const ops = new Set(selKnown.map(it => it.info.operator));
  const times = selKnown.map(it => it.info.start).filter(Boolean);
  const first = times.length ? times.reduce((x, y) => Math.min(x, y)) : null, last = times.length ? times.reduce((x, y) => Math.max(x, y)) : null;
  const filtered = f.from != null || f.ops.size || $('ep-annotated').checked || $('search').value.trim();
  const kpi = [
    ['episodes', fmt(sel.length) + (filtered ? `<small> / ${fmt(all.length)}</small>` : '')],
    ['hours', hours.toFixed(1)],
    ['users', fmt(ops.size)],
    ['annotated', fmt(sel.filter(isAnnotated).length)],
    ['period', first ? `<small>${fmtDay(first)} – ${fmtDay(last)}</small>` : '–'],
  ];
  $('dash-kpis').innerHTML = kpi.map(([k, x]) => `<div><b>${x}</b><span>${k}</span></div>`).join('');
  $('dash-reset').classList.toggle('hidden', !(f.from != null || f.ops.size));
  $('dash-range').textContent = f.from != null ? `${fmtDay(f.from)}${f.to - f.from > DAY ? ' – ' + fmtDay(f.to - 1) : ''}` : '';
  const missing = all.length - all.filter(it => it.info).length;
  $('dash-progress').textContent = !v.index ? `no index (index/${v.split}/${v.task}.json)`
    : missing ? `${fmt(missing)} episodes are missing from the index` : '';
  drawHistogram(v, known);
  drawOperators(v);
}

function drawHistogram(v, known) {
  const box = $('dash-hist');
  if (!known.length) { box.innerHTML = '<p class="hint">no recording times</p>'; return; }
  const times = known.map(it => it.info.start);
  const lo = times.reduce((x, y) => Math.min(x, y)), hi = times.reduce((x, y) => Math.max(x, y));
  const weekly = (hi - lo) / DAY > 180;
  const binOf = weekly ? weekStart : dayStart;
  const step = d => { const x = new Date(d); x.setDate(x.getDate() + (weekly ? 7 : 1)); return x.getTime(); };
  const bins = [];
  for (let b = binOf(lo); b <= hi; b = step(b)) bins.push({ t: b, end: step(b), v: 0, all: 0, ops: new Map() });
  const idx = new Map(bins.map((b, i) => [b.t, i]));
  const opFiltered = v.filter.ops.size > 0;
  for (const it of known) {
    const b = bins[idx.get(binOf(it.info.start))];
    if (!b) continue;
    const m = metricOf(it);
    if (passes(it, 'date')) { b.v += m; b.ops.set(it.info.operator, (b.ops.get(it.info.operator) || 0) + m); }
    // ghost bars: everyone (operator filter ignored), so the selected users show against the whole
    if (opFiltered && passes(it, 'date', 'op')) b.all += m;
  }
  const W = box.clientWidth || 600, H = box.clientHeight || 200, L = 40, R = 6, T = 8, B = 22;
  const iw = W - L - R, ih = H - T - B, n = bins.length, bw = iw / n;
  const max = Math.max(...bins.map(b => Math.max(b.v, b.all)), state.metric === 'hours' ? 0.1 : 1);
  const tick = niceStep(max / 4);
  const top = Math.ceil(max / tick) * tick;
  const y = x => T + ih - x / top * ih;
  let svg = '';
  for (let g = 0; g <= top + 1e-9; g += tick) svg += `<line class="grid-l" x1="${L}" x2="${W - R}" y1="${y(g)}" y2="${y(g)}"/><text class="axis" x="${L - 6}" y="${y(g) + 3}" text-anchor="end">${state.metric === 'hours' ? +g.toFixed(2) : fmt(g)}</text>`;
  const f = v.filter, gap = bw > 6 ? Math.min(2, bw * 0.2) : 0;
  bins.forEach((b, i) => {
    const x = L + i * bw + gap / 2, w = Math.max(1, bw - gap);
    const out = f.from != null && !(b.t >= f.from && b.t < f.to);
    if (f.ops.size && b.all > b.v) svg += `<rect class="b ghost" x="${x}" y="${y(b.all)}" width="${w}" height="${ih + T - y(b.all)}" rx="1.5"/>`;
    if (b.v) svg += `<rect class="b${out ? ' dim' : ''}" x="${x}" y="${y(b.v)}" width="${w}" height="${ih + T - y(b.v)}" rx="1.5"/>`;
  });
  const multiYear = new Date(lo).getFullYear() !== new Date(hi).getFullYear();
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 70))));
  bins.forEach((b, i) => {
    if (i % every) return;
    const d = new Date(b.t), lab = `${multiYear ? String(d.getFullYear()).slice(2) + '/' : ''}${d.getMonth() + 1}/${d.getDate()}`;
    svg += `<text class="axis" x="${L + (i + 0.5) * bw}" y="${H - 6}" text-anchor="middle">${lab}</text>`;
  });
  if (f.from != null) {
    const a = bins.findIndex(b => b.t >= f.from), z = bins.findLastIndex(b => b.t < f.to);
    if (a >= 0 && z >= a) svg += `<rect class="brush" x="${L + a * bw}" y="${T}" width="${(z - a + 1) * bw}" height="${ih}" rx="3"/>`;
  }
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><rect class="hover" id="hist-hover" x="0" y="${T}" width="0" height="${ih}"/>${svg}<rect id="hist-drag" class="brush hidden" x="0" y="${T}" width="0" height="${ih}" rx="3"/></svg><div class="tip hidden"></div>`;
  const el = box.querySelector('svg'), tip = box.querySelector('.tip'), hover = box.querySelector('#hist-hover'), drag = box.querySelector('#hist-drag');
  const at = e => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left - L * r.width / W) / (bw * r.width / W)))); };
  let down = null;
  el.onpointerdown = e => { down = at(e); el.setPointerCapture(e.pointerId); };
  el.onpointermove = e => {
    const i = at(e), b = bins[i];
    hover.setAttribute('x', L + i * bw); hover.setAttribute('width', bw);
    if (down != null && i !== down) {
      const a = Math.min(i, down), z = Math.max(i, down);
      drag.classList.remove('hidden'); drag.setAttribute('x', L + a * bw); drag.setAttribute('width', (z - a + 1) * bw);
    }
    const topOps = [...b.ops].sort((p, q) => q[1] - p[1]).slice(0, 4);
    tip.innerHTML = `<b>${weekly ? 'week of ' + fmtDay(b.t) : fmtDay(b.t)}</b> · ${fmtMetric(b.v)}${topOps.map(([op, m]) => `<br><i style="background:${opColor(op)}"></i>${esc(opShort(op))} ${fmtMetric(m)}`).join('')}${b.ops.size > 4 ? `<br>+${b.ops.size - 4} more` : ''}`;
    tip.classList.remove('hidden');
    const r = el.getBoundingClientRect(), px = e.clientX - r.left;
    tip.style.left = Math.min(px + 12, r.width - tip.offsetWidth - 4) + 'px';
    tip.style.top = '4px';
  };
  el.onpointerleave = () => { tip.classList.add('hidden'); hover.setAttribute('width', 0); };
  el.onpointerup = e => {
    if (down == null) return;
    const i = at(e), a = Math.min(i, down), z = Math.max(i, down);
    down = null;
    const from = bins[a].t, to = bins[z].end;
    if (a === z && f.from === from && f.to === to) { f.from = f.to = null; } else { f.from = from; f.to = to; }
    applyFilter();
  };
  el.ondblclick = () => { f.from = f.to = null; applyFilter(); };
}
function niceStep(x) {
  if (x <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(x)), m = x / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

function drawOperators(v) {
  const rows = new Map();
  for (const it of v.items) {
    if (!it.info || !passes(it, 'op')) continue;
    const op = it.info.operator, r = rows.get(op) || { op, v: 0, n: 0, h: 0, last: 0 };
    r.v += metricOf(it); r.n++; r.h += (it.info.duration || 0) / 3600; r.last = Math.max(r.last, it.info.start || 0);
    rows.set(op, r);
  }
  const list = [...rows.values()].sort((a, b) => b.v - a.v);
  for (const op of v.filter.ops) if (!rows.has(op)) list.push({ op, v: 0, n: 0, h: 0, last: 0 });
  const max = Math.max(1e-9, ...list.map(r => r.v));
  const sel = v.filter.ops;
  const one = sel.size === 1 ? [...sel][0] : null;
  $('dash-ops-note').innerHTML = !list.length ? '' : one ? `<a href="#/users/${esc(v.split)}/${encodeURIComponent(one)}">${esc(opShort(one))} user page →</a>`
    : `${fmt(list.length)} users · click to filter (multiple allowed)`;
  $('dash-ops').innerHTML = list.length ? list.map(r => `<button class="op${sel.size ? sel.has(r.op) ? ' on' : ' off' : ''}" data-op="${esc(r.op)}" style="--c:${opColor(r.op)};--w:${(100 * r.v / max).toFixed(1)}%" title="${esc(r.op || '(no operator_id)')}\n${fmt(r.n)} ep · ${r.h.toFixed(2)} h${r.last ? '\nlast recorded ' + fmtStamp(r.last) : ''}"><i></i><code>${esc(opShort(r.op))}</code><span>${fmt(r.n)} ep · ${r.h < 1 ? Math.round(r.h * 60) + ' min' : r.h.toFixed(1) + ' h'}</span></button>`).join('')
    : '<p class="hint">no user info</p>';
  $('dash-ops').querySelectorAll('.op').forEach(b => b.onclick = e => {
    const op = b.dataset.op;
    if (e.metaKey || e.ctrlKey || e.shiftKey || sel.size) { sel.has(op) ? sel.delete(op) : sel.add(op); }
    else sel.add(op);
    applyFilter();
  });
}

function applyFilter() { resetGrid(); renderDash(); }

$('ep-sort').value = state.epSort;
$('ep-sort').onchange = () => { state.epSort = $('ep-sort').value; ls.set('ep-sort', state.epSort); resetGrid(); };
$('ep-annotated').onchange = applyFilter;
$('dash-reset').onclick = () => { const f = episodeView?.filter; if (!f) return; f.from = f.to = null; f.ops.clear(); applyFilter(); };
$('dash-metric').querySelectorAll('button').forEach(b => {
  b.classList.toggle('on', b.dataset.m === state.metric);
  b.onclick = () => { state.metric = b.dataset.m; ls.set('metric', state.metric); $('dash-metric').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); renderDash(); };
});
let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderDash, 150); });

const player = createViewer({
  sign, range, decompress: d => decompress(d),
  onAuthError: e => { $('player').close(); showGate(e.message); },
});

function openEpisodeAt(items, i) {
  const v = episodeView, it = items[i];
  if (!v || !it) return;
  const ep = `data/${v.split}/${v.task}/${it.name}`;
  const extra = it.info ? [it.info.start && fmtStamp(it.info.start), it.info.operator && `user ${opShort(it.info.operator)}`].filter(Boolean).join(' · ') : '';
  player.open(ep, {
    title: label(v.task),
    subtitle: `${v.split} · ${it.name.replace(/^episode_/, '')} · ${i + 1} / ${items.length}${extra ? ' · ' + extra : ''}`,
    annotation: it.annotated,
    onPrev: i > 0 ? () => openEpisodeAt(items, i - 1) : null,
    onNext: i < items.length - 1 ? () => openEpisodeAt(items, i + 1) : null,
  });
}

// ---------- users: index/users.json (tools/build_index.py merge) ----------
// { split: { operator: { e, h, a, days, f, l, t: { task: [episodes, hours, annotated, first, last] }, daily: { 'YYYY-MM-DD' (UTC): hours } } } }
let usersP = null;
const loadUsers = () => usersP ??= fetch('index/users.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
const fmtH = h => h < 1 ? `${Math.round(h * 60)} min` : h < 10 ? h.toFixed(1) + ' h' : Math.round(h) + ' h';
const pct = x => x == null ? '–' : x < .01 && x > 0 ? '<1%' : Math.round(100 * x) + '%';
const usort = { users: ls.get('usort') || 'h', user: 'h', dir: -1 };
const sortTh = (k, l, cur, cls = '') => `<th data-k="${k}" class="${cls}${cur === k ? ' on' : ''}">${l}</th>`;
const kpis = cells => `<div class="ukpis">${cells.map(([k, v]) => `<div><b>${v}</b><span>${k}</span></div>`).join('')}</div>`;

async function renderUsers(split) {
  const box = $('users');
  const U = (await loadUsers())?.[split];
  if (!U || !Object.keys(U).length) { box.innerHTML = `<p class="hint">no user info for ${esc(split)} (index/users.json).</p>`; msg(''); return; }
  const q = $('search').value.trim().toLowerCase();
  const all = Object.entries(U).map(([op, u]) => ({ op, ...u, n: Object.keys(u.t).length, hpd: u.h / u.days, ann: u.e ? u.a / u.e : 0, span: (u.l - u.f) / DAY }));
  const total = all.reduce((a, r) => a + r.h, 0);
  const byH = [...all].sort((a, b) => b.h - a.h); byH.forEach((r, i) => { r.rank = i + 1; });
  const top = k => byH.slice(0, k).reduce((a, r) => a + r.h, 0) / total;
  const rows = all.filter(r => !q || r.op.toLowerCase().includes(q) || opShort(r.op).toLowerCase().includes(q) || Object.keys(r.t).some(t => label(t).toLowerCase().includes(q)));
  const key = { h: r => r.h, e: r => r.e, n: r => r.n, days: r => r.days, hpd: r => r.hpd, ann: r => r.ann, f: r => r.f, l: r => r.l, span: r => r.span, op: r => r.op }[usort.users] || (r => r.h);
  rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * (usort.users === 'op' ? 1 : usort.dir); });
  const maxH = byH[0].h;
  box.innerHTML = kpis([['users', fmt(all.length)], ['hours', total.toFixed(0)], ['top 10 share', pct(top(10))], ['top 20 share', pct(top(20))], ['median hours / user', fmtH(byH[Math.floor(byH.length / 2)].h)]])
    + `<div class="scroll"><table class="tbl"><thead><tr><th>#</th>${sortTh('op', 'user', usort.users, 'l')}${sortTh('h', 'hours', usort.users)}<th>share</th>${sortTh('e', 'episodes', usort.users)}${sortTh('n', 'tasks', usort.users)}${sortTh('days', 'days', usort.users)}${sortTh('hpd', 'h / day', usort.users)}${sortTh('ann', 'annotated', usort.users)}${sortTh('f', 'first', usort.users)}${sortTh('l', 'last', usort.users)}${sortTh('span', 'span', usort.users)}<th class="l grow">top tasks</th></tr></thead><tbody>`
    + rows.map(r => {
      const tops = Object.entries(r.t).sort((a, b) => b[1][1] - a[1][1]).slice(0, 3).map(([t, x]) => `${esc(label(t))} <small>${pct(x[1] / r.h)}</small>`).join(' · ');
      return `<tr data-op="${esc(r.op)}"><td class="muted">${r.rank}</td><td class="l"><code>${esc(opShort(r.op))}</code></td><td>${fmtH(r.h)}<span class="hbar"><i style="--w:${(100 * r.h / maxH).toFixed(1)}%"></i></span></td><td>${pct(r.h / total)}</td><td>${fmt(r.e)}</td><td>${r.n}</td><td>${r.days}</td><td>${r.hpd.toFixed(1)}</td><td>${pct(r.ann)}</td><td>${fmtDay(r.f)}</td><td>${fmtDay(r.l)}</td><td>${Math.round(r.span)}d</td><td class="l grow small">${tops}</td></tr>`;
    }).join('') + '</tbody></table></div>';
  box.querySelectorAll('th[data-k]').forEach(h => h.onclick = () => {
    if (usort.users === h.dataset.k) usort.dir = -usort.dir; else { usort.users = h.dataset.k; usort.dir = -1; ls.set('usort', usort.users); }
    renderUsers(split);
  });
  box.querySelectorAll('tr[data-op]').forEach(tr => tr.onclick = () => { location.hash = `#/users/${split}/${encodeURIComponent(tr.dataset.op)}`; });
  msg(rows.length ? '' : '—');
}

async function renderUser(split, op) {
  const box = $('users');
  const [Us, sum] = await Promise.all([loadUsers(), loadSummary()]);
  const U = Us?.[split] || {}, u = U[op];
  if (!u) { box.innerHTML = `<p class="hint">user ${esc(op)} not found in ${esc(split)}.</p>`; return; }
  const rank = Object.values(U).filter(x => x.h > u.h).length + 1;
  const T = sum?.splits?.[split] || {};
  const q = $('search').value.trim().toLowerCase();
  const rows = Object.entries(u.t).map(([t, x]) => ({ t, e: x[0], h: x[1], a: x[2], f: x[3], l: x[4], ofUser: x[1] / u.h, ofTask: T[t]?.hours ? x[1] / T[t].hours : null, taskUsers: T[t]?.operators }))
    .filter(r => !q || label(r.t).toLowerCase().includes(q));
  const key = { t: r => r.t, e: r => r.e, h: r => r.h, ofTask: r => r.ofTask ?? -1, a: r => r.e ? r.a / r.e : 0, f: r => r.f, l: r => r.l }[usort.user] || (r => r.h);
  rows.sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * (usort.user === 't' ? 1 : usort.dir); });
  const eff = 1 / Object.values(u.t).reduce((a, x) => a + (x[1] / u.h) ** 2, 0);
  const maxH = Math.max(...rows.map(r => r.h), 1e-9);
  box.innerHTML = `<div class="task-head"><a href="#/users/${esc(split)}" class="back">←</a><h1><code>${esc(opShort(op))}</code></h1><span class="muted">#${rank} / ${Object.keys(U).length} · <code class="full">${esc(op)}</code></span></div>`
    + kpis([['hours', fmtH(u.h)], ['episodes', fmt(u.e)], ['tasks', Object.keys(u.t).length], ['effective tasks', eff.toFixed(1)], ['days', u.days], ['h / day', (u.h / u.days).toFixed(1)], ['annotated', pct(u.a / u.e)], ['period', `${fmtDay(u.f)} – ${fmtDay(u.l)}`]])
    + `<figure class="panel"><figcaption><b>Hours per day, colored by task</b><span id="u-range"></span></figcaption><div id="u-daily"></div><div id="u-legend"></div><p class="hint">UTC days · one bar = one day (one week if the span exceeds 500 days) · a single color = one task that day · click a bar to list that day's tasks</p><div id="u-day" data-split="${esc(split)}" data-op="${esc(op)}"></div></figure>`
    + `<div class="scroll"><table class="tbl utasks"><thead><tr>${sortTh('t', 'task', usort.user, 'l grow')}${sortTh('e', 'episodes', usort.user)}${sortTh('h', 'hours', usort.user)}<th title="share of this user's total hours spent on this task">% of user</th>${sortTh('ofTask', '% of task', usort.user)}<th title="number of users who recorded this task">task users</th>${sortTh('a', 'annotated', usort.user)}${sortTh('f', 'first', usort.user)}${sortTh('l', 'last', usort.user)}</tr></thead><tbody>`
    + rows.map(r => `<tr data-t="${esc(r.t)}"><td class="l grow">${esc(label(r.t))}</td><td>${fmt(r.e)}</td><td>${fmtH(r.h)}<span class="hbar"><i style="--w:${(100 * r.h / maxH).toFixed(1)}%"></i></span></td><td>${pct(r.ofUser)}</td><td title="share of this task's total hours recorded by this user">${pct(r.ofTask)}</td><td>${r.taskUsers ?? '–'}</td><td>${pct(r.e ? r.a / r.e : null)}</td><td>${fmtDay(r.f)}</td><td>${fmtDay(r.l)}</td></tr>`).join('')
    + '</tbody></table></div><p class="hint">Click a task to open its episodes filtered to this user.</p>';
  box.querySelectorAll('th[data-k]').forEach(h => h.onclick = () => { if (usort.user === h.dataset.k) usort.dir = -usort.dir; else { usort.user = h.dataset.k; usort.dir = -1; } renderUser(split, op); });
  box.querySelectorAll('tr[data-t]').forEach(tr => tr.onclick = () => { location.hash = `#/${split}/${encodeURIComponent(tr.dataset.t)}?u=${encodeURIComponent(op)}`; });
  drawDaily(u);
  msg('');
}

// Hours per UTC day (per week when the span is long), stacked by task: the user's 7 biggest tasks get fixed
// colors (by the user's own task order, so a task keeps its color on every day), the rest is "other".
const TASK_COLORS = 7;
function drawDaily(u) {
  const el = $('u-daily'); if (!el) return;
  const days = Object.keys(u.daily).sort(); if (!days.length) return;
  const t0 = Date.parse(days[0] + 'T00:00:00Z'), t1 = Date.parse(days.at(-1) + 'T00:00:00Z');
  const weekly = (t1 - t0) / DAY > 500, step = weekly ? 7 * DAY : DAY;
  const bins = new Map();  // bin start -> Map(task index -> hours)
  let multi = 0, ntasks = 0;
  for (const d of days) {
    const arr = u.daily[d], t = Date.parse(d + 'T00:00:00Z'), k = t0 + Math.floor((t - t0) / step) * step;
    const m = bins.get(k) || new Map(); bins.set(k, m);
    for (let i = 0; i < arr.length; i += 3) m.set(arr[i], (m.get(arr[i]) || 0) + arr[i + 1]);
    ntasks += arr.length / 3; if (arr.length > 3) multi++;
  }
  const slot = i => i < TASK_COLORS ? i : TASK_COLORS;  // 7 = other
  const n = Math.floor((t1 - t0) / step) + 1, W = el.clientWidth || 800, Hh = 170, pad = 30, bw = Math.max(1, (W - pad) / n);
  const tot = m => [...m.values()].reduce((a, v) => a + v, 0);
  const max = Math.max(...[...bins.values()].map(tot));
  const sy = v => (Hh - 26) * v / max, base = Hh - 18;
  let bars = '';
  for (const [k, m] of bins) {
    const i = Math.round((k - t0) / step), x = pad + i * bw + (bw > 3 ? 1 : 0), w = Math.max(1, bw - (bw > 3 ? 2 : 0));
    const parts = new Map(); for (const [ti, h] of m) parts.set(slot(ti), (parts.get(slot(ti)) || 0) + h);
    let y = base;
    bars += `<g class="day" data-k="${k}">` + [...parts].sort((a, b) => a[0] - b[0]).map(([c, h]) => {
      const hh = sy(h), gap = hh > 3 ? 1 : 0; y -= hh;
      return `<rect class="s${c}" x="${x}" y="${y}" width="${w}" height="${Math.max(.5, hh - gap)}"/>`;
    }).join('') + `<rect class="hit" x="${pad + i * bw}" y="0" width="${bw}" height="${base}"/></g>`;
  }
  let labels = '', lastM = '';
  for (let i = 0; i < n; i++) {
    const m = new Date(t0 + i * step).toISOString().slice(0, 7);
    if (m !== lastM) { labels += `<text class="axis" x="${pad + i * bw}" y="${Hh - 4}">${m}</text>`; lastM = m; }
  }
  const grid = [0.5, 1].map(f => `<line class="grid-l" x1="${pad}" x2="${W}" y1="${base - sy(max * f)}" y2="${base - sy(max * f)}"/><text class="axis" x="0" y="${base - sy(max * f) + 3}">${fmtH(max * f)}</text>`).join('');
  el.innerHTML = `<svg viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none">${grid}${bars}${labels}</svg><div class="tip hidden"></div>`;
  $('u-range').textContent = `${days.length} days · ${weekly ? 'weekly bars' : 'daily bars'} · multi-task days ${multi} (${pct(multi / days.length)}) · ${(ntasks / days.length).toFixed(1)} tasks/day`;
  const big = u.tn.slice(0, TASK_COLORS), other = u.tn.length - big.length;
  $('u-legend').innerHTML = big.map((t, i) => `<span><i class="s${i}"></i>${esc(label(t))}</span>`).join('') + (other ? `<span><i class="s7"></i>other (${other} tasks)</span>` : '');
  const tip = el.querySelector('.tip');
  el.querySelectorAll('g.day').forEach(g => {
    g.onmouseenter = () => {
      const k = +g.dataset.k, m = bins.get(k), d = new Date(k).toISOString().slice(0, 10);
      const rows = [...m].sort((a, b) => b[1] - a[1]);
      tip.innerHTML = `<b>${weekly ? 'week of ' + d : d}</b> · ${fmtH(tot(m))} · ${rows.length} task${rows.length > 1 ? 's' : ''}` + rows.slice(0, 8).map(([ti, h]) => `<br><i class="s${slot(ti)}"></i>${esc(label(u.tn[ti]))} ${fmtH(h)}`).join('') + (rows.length > 8 ? `<br>+${rows.length - 8} more` : '');
      tip.classList.remove('hidden');
      const bx = g.getBoundingClientRect(), ex = el.getBoundingClientRect();
      tip.style.left = Math.max(0, Math.min(ex.width - tip.offsetWidth, bx.left - ex.left + bx.width + 8)) + 'px'; tip.style.top = '0px';
    };
    g.onmouseleave = () => tip.classList.add('hidden');
    g.onclick = () => { el.querySelectorAll('g.day.sel').forEach(x => x.classList.remove('sel')); g.classList.add('sel'); showDay(u, +g.dataset.k, step, days); };
  });
  const sel = dayPick.get(u) ?? days.at(-1);  // default: the last recording day
  const k0 = t0 + Math.floor((Date.parse(sel + 'T00:00:00Z') - t0) / step) * step;
  el.querySelector(`g.day[data-k="${k0}"]`)?.classList.add('sel');
  showDay(u, k0, step, days);
}

// Tasks the user recorded on the clicked day (or week): episodes, hours; a row opens that task filtered to the user and day.
const dayPick = new WeakMap();
function showDay(u, k, step, days) {
  const box = $('u-day'); if (!box) return;
  const inBin = days.filter(d => { const t = Date.parse(d + 'T00:00:00Z'); return t >= k && t < k + step; });
  dayPick.set(u, inBin[0]);
  const per = new Map();
  for (const d of inBin) { const a = u.daily[d]; for (let i = 0; i < a.length; i += 3) { const r = per.get(a[i]) || { h: 0, n: 0 }; r.h += a[i + 1]; r.n += a[i + 2]; per.set(a[i], r); } }
  const rows = [...per].sort((a, b) => b[1].h - a[1].h), tot = rows.reduce((s, [, r]) => s + r.h, 0), totN = rows.reduce((s, [, r]) => s + r.n, 0);
  const d0 = new Date(k).toISOString().slice(0, 10), d1 = new Date(k + step - DAY).toISOString().slice(0, 10);
  const { split, op } = box.dataset;
  box.innerHTML = `<h3>${step > DAY ? `${d0} – ${d1} (week)` : d0} <span class="muted">· ${fmtH(tot)} · ${fmt(totN)} ep · ${rows.length} task${rows.length > 1 ? 's' : ''}${step > DAY ? ` · ${inBin.length} recording days` : ''}</span></h3>`
    + `<div class="scroll"><table class="tbl"><tbody>${rows.map(([ti, r]) => `<tr data-t="${esc(u.tn[ti])}"><td class="l"><i class="sw s${ti < TASK_COLORS ? ti : TASK_COLORS}"></i></td><td class="l grow">${esc(label(u.tn[ti]))}</td><td>${fmt(r.n)} ep</td><td>${fmtH(r.h)}<span class="hbar"><i style="--w:${(100 * r.h / rows[0][1].h).toFixed(1)}%"></i></span></td><td>${pct(r.h / tot)}</td></tr>`).join('')}</tbody></table></div>`
    + `<p class="hint">Click a task to open its episodes filtered to this user and ${step > DAY ? 'week' : 'day'}.</p>`;
  box.querySelectorAll('tr[data-t]').forEach(tr => tr.onclick = () => {
    location.hash = `#/${split}/${encodeURIComponent(tr.dataset.t)}?u=${encodeURIComponent(op)}&d=${d0}${step > DAY ? '&days=7' : ''}`;
  });
}

// ---------- routing ----------
async function route() {
  if (!token) return showGate();
  const [path, query] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').map(decodeURIComponent);
  const users = parts[0] === 'users';
  const [split, task] = users ? parts.slice(1) : parts;
  try {
    const splits = await loadSplits();
    if (!split || !splits.includes(split)) { location.replace((users ? '#/users/' : '#/') + splits[0]); return; }
    renderNav(split, users);
    $('users').classList.toggle('hidden', !users);
    $('view-toggle').classList.toggle('hidden', users);
    if (users) {
      episodeView = null;
      for (const id of ['tasks', 'stats', 'task', 'sort']) $(id).classList.add('hidden');
      await (task ? renderUser(split, task) : renderUsers(split));
      if (task) scrollTo(0, 0);
      return;
    }
    $('view-toggle').classList.remove('hidden');
    const data = await loadSplit(split);
    renderStats(data);
    $('tasks').classList.toggle('hidden', !!task);
    $('stats').classList.toggle('hidden', !!task);
    $('task').classList.toggle('hidden', !task);
    $('sort').classList.toggle('hidden', !!task || state.view === 'table');
    const qp = new URLSearchParams(query || '');
    if (task) { await renderTask(split, task, qp.get('u'), qp.get('d'), +qp.get('days') || 1); scrollTo(0, 0); }
    else { episodeView = null; renderTasks(data); countEpisodes(data); }
  } catch (e) {
    if (e instanceof AuthError) showGate(e.message); else msg(e.message);
  }
}

function showGate(err) {
  $('gate').classList.remove('hidden');
  $('top').classList.add('hidden');
  $('main').classList.add('hidden');
  $('gate-error').textContent = err ? `HF ${err}` : '';
  $('gate-token').focus();
}

$('gate-form').onsubmit = async e => {
  e.preventDefault();
  const value = $('gate-token').value.trim();
  if (!value) return;
  token = value;
  $('gate-error').textContent = '…';
  try {
    await (await hf(`${HF}/resolve/main/meta/val_report.txt`, { headers: { Range: 'bytes=0-0' } })).arrayBuffer();
  } catch (err) { $('gate-error').textContent = `HF ${err.message}`; return; }
  ls.set('hf_token', token);
  $('gate-token').value = '';
  start();
};

$('logout').onclick = async () => {
  ls.del('hf_token');
  try { await caches.delete(CACHE); } catch { /* ignore */ }
  location.hash = '';
  location.reload();
};

$('view-toggle').onclick = () => {
  state.view = state.view === 'grid' ? 'table' : 'grid';
  ls.set('view', state.view);
  route();
};

$('sort').value = state.sort;
$('sort').onchange = () => { state.sort = $('sort').value; state.dir = -1; ls.set('sort', state.sort); route(); };

let searchTimer;
$('search').oninput = () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (episodeView) applyFilter();
    else if (location.hash.startsWith('#/users/')) route();
    else { const split = location.hash.split('/')[1]; if (state.data[split]) renderTasks(state.data[split]); }
  }, 200);
};

function start() {
  $('gate').classList.add('hidden');
  $('top').classList.remove('hidden');
  $('main').classList.remove('hidden');
  route();
}
window.addEventListener('hashchange', () => { $('search').value = ''; if ($('player').open) $('player').close(); route(); });
if (token) start(); else showGate();
