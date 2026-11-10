import { decompress } from 'https://cdn.jsdelivr.net/npm/fzstd@0.1.1/+esm';
import { firstFrame } from './mcap.js';

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
class AuthError extends Error {}
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
async function sign(path) {
  const c = signed.get(path);
  if (c && Date.now() - c.t < 40 * 60e3) return c;
  const r = await hf(`${HF}/resolve/main/${enc(path)}`, { headers: { Range: 'bytes=0-0' } });
  const size = +(r.headers.get('content-range') || '').split('/')[1];
  await r.arrayBuffer();
  const v = { url: r.url, size, t: Date.now(), direct: r.url.startsWith('https://huggingface.co/') };
  signed.set(path, v);
  return v;
}
async function range(s, a, b) {
  const r = await fetch(s.url, { headers: { ...(s.direct ? auth() : {}), Range: `bytes=${a}-${b}` } });
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
    const f = await firstFrame((a, b) => range(s, a, b), s.size, d => decompress(d));
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

async function loadSplits() {
  if (state.splits) return state.splits;
  const dirs = (await listDir('data')).filter(d => d.dir).map(d => d.name);
  state.splits = dirs.sort((a, b) => (SPLIT_ORDER.indexOf(a) + 1 || 99) - (SPLIT_ORDER.indexOf(b) + 1 || 99));
  return state.splits;
}

async function loadSplit(split) {
  if (state.data[split]) return state.data[split];
  const [dirs, rep] = await Promise.all([listDir('data/' + split), report(split)]);
  const tasks = dirs.filter(d => d.dir).map(d => {
    const s = rep?.tasks.get(norm(d.name));
    return { name: d.name, episodes: s?.episodes ?? null, annotated: s?.annotated ?? null, hours: s?.hours ?? null };
  });
  state.data[split] = { split, tasks, total: rep?.total, report: !!rep };
  return state.data[split];
}

const firstEpisode = async (split, task) => {
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

function renderNav(active) {
  $('splits').innerHTML = state.splits.map(s => `<a href="#/${esc(s)}" class="${s === active ? 'active' : ''}">${esc(s)}</a>`).join('');
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
    box.innerHTML = `<table><thead><tr><th></th>${th('name', 'task')}${th('episodes', 'episodes')}${th('annotated', 'annotated')}${th('hours', 'hours')}${th('avg', 'min/ep')}</tr></thead><tbody>${rows.map(t =>
      `<tr data-task="${esc(t.name)}"><td class="thumb"><img alt=""></td><td>${esc(label(t.name))}</td><td data-count="${esc(t.name)}">${fmt(t.episodes)}</td><td>${t.annotated == null ? '–' : t.episodes ? Math.round(100 * t.annotated / t.episodes) + '%' : '–'}</td><td>${t.hours == null ? '–' : t.hours.toFixed(1)}</td><td>${avg(t) == null ? '–' : avg(t).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
    box.querySelectorAll('th[data-sort]').forEach(h => h.onclick = () => setSort(h.dataset.sort, data));
    box.querySelectorAll('tr[data-task]').forEach(tr => { tr.onclick = () => { location.hash = `#/${data.split}/${tr.dataset.task}`; }; lazyThumb(tr.querySelector('.thumb'), () => firstEpisode(data.split, tr.dataset.task)); });
  } else {
    box.innerHTML = rows.map(t => `<a class="card" href="#/${esc(data.split)}/${esc(t.name)}"><div class="cover"><img alt=""></div><div class="info"><h3>${esc(label(t.name))}</h3><p><span data-count="${esc(t.name)}">${fmt(t.episodes)}</span> ep${t.hours == null ? '' : ` · ${t.hours.toFixed(1)} h`}${t.annotated == null || !t.episodes ? '' : ` · ${Math.round(100 * t.annotated / t.episodes)}% ann`}</p></div></a>`).join('');
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
async function renderTask(split, task) {
  const data = await loadSplit(split);
  const t = data.tasks.find(x => x.name === task) || { name: task };
  $('task-title').textContent = label(task);
  $('task-hf').href = `${HF}/tree/main/data/${enc(split)}/${enc(task)}`;
  const meta = () => [t.episodes != null && `${fmt(t.episodes)} ep`, t.hours != null && `${t.hours.toFixed(1)} h`, avg(t) != null && `${avg(t).toFixed(2)} min/ep`, t.annotated != null && t.episodes && `${Math.round(100 * t.annotated / t.episodes)}% ann`].filter(Boolean).join(' · ');
  $('task-meta').textContent = meta();
  $('episodes').innerHTML = '';
  const view = episodeView = { split, task, items: [], shown: 0 };
  msg('…');
  const items = (await listDir(`data/${split}/${task}`, { onPage: n => { if (episodeView === view) msg(`… ${fmt(n)}`); } })).filter(x => x.dir);
  if (episodeView !== view) return;
  view.items = items;
  if (t.episodes == null) { t.episodes = items.length; $('task-meta').textContent = meta(); }
  msg(items.length ? '' : '—');
  renderMoreEpisodes();
}

function filteredEpisodes() {
  const q = $('search').value.trim().toLowerCase();
  return q ? episodeView.items.filter(x => x.name.toLowerCase().includes(q)) : episodeView.items;
}

function renderMoreEpisodes() {
  const v = episodeView;
  if (!v) return;
  const items = filteredEpisodes();
  const next = items.slice(v.shown, v.shown + 60);
  const box = $('episodes');
  for (const it of next) {
    const ep = `data/${v.split}/${v.task}/${it.name}`;
    const el = document.createElement('button');
    el.className = 'ep';
    el.innerHTML = `<div class="cover"><img alt=""><span class="dur"></span></div><code>${esc(it.name.replace(/^episode_/, '').slice(0, 13))}</code>`;
    el.onclick = () => openEpisode(ep);
    box.appendChild(el);
    lazyThumb(el.querySelector('.cover'), ep);
  }
  v.shown += next.length;
}
new IntersectionObserver(es => { if (es[0].isIntersecting && episodeView) renderMoreEpisodes(); }, { rootMargin: '800px' }).observe($('sentinel'));

async function openEpisode(ep) {
  const w = window.open('', '_blank');
  try {
    const s = await sign(ep + '/episode.mcap');
    const u = new URL('viewer/', location.href);
    u.searchParams.set('ds', 'remote-file');
    u.searchParams.set('ds.url', s.url);
    if (w) w.location.href = u.href; else location.href = u.href;
  } catch (e) {
    w?.close();
    if (e instanceof AuthError) showGate(e.message); else msg(e.message);
  }
}

// ---------- routing ----------
async function route() {
  if (!token) return showGate();
  const [split, task] = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  try {
    const splits = await loadSplits();
    if (!split || !splits.includes(split)) { location.replace('#/' + splits[0]); return; }
    renderNav(split);
    const data = await loadSplit(split);
    renderStats(data);
    $('tasks').classList.toggle('hidden', !!task);
    $('stats').classList.toggle('hidden', !!task);
    $('task').classList.toggle('hidden', !task);
    $('sort').classList.toggle('hidden', !!task || state.view === 'table');
    if (task) { await renderTask(split, task); scrollTo(0, 0); }
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
    if (episodeView) { episodeView.shown = 0; $('episodes').innerHTML = ''; renderMoreEpisodes(); }
    else { const split = location.hash.split('/')[1]; if (state.data[split]) renderTasks(state.data[split]); }
  }, 200);
};

function start() {
  $('gate').classList.add('hidden');
  $('top').classList.remove('hidden');
  $('main').classList.remove('hidden');
  route();
}
window.addEventListener('hashchange', () => { $('search').value = ''; route(); });
if (token) start(); else showGate();
