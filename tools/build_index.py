"""Precompute per-episode metadata for the explorer (recording start, duration, operator, annotation, size).

Three steps:
  plan   list every episode on HF (tree API) -> <work>/plan.jsonl
  scan   read each episode's MCAP summary + metadata over HTTP range requests (a few hundred KB each),
         skipping episodes already known from earlier local analyses or from previous scan output.
         Run several shards in parallel: --shard i --nshards n  -> <work>/scan/shard-<i>.jsonl
  merge  seeds + scan output -> <repo>/index/<split>/<task>.json and <repo>/index/summary.json

Needs HF_TOKEN (the dataset is gated). Work dir default: /home/juheon/data/abc-robot-explorer/index-build
"""
import argparse, csv, hashlib, io, json, os, shutil, sys, threading, time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests
from mcap.reader import make_reader

REPO = 'XDOF/ABC-130k'
API = f'https://huggingface.co/api/datasets/{REPO}'
HF = f'https://huggingface.co/datasets/{REPO}'
WORK = Path('/home/juheon/data/abc-robot-explorer/index-build')
SITE = Path(__file__).resolve().parent.parent
ANALYSIS = Path('/home/juheon/data/abc-vlm-analysis')
SEED_FILES = [ANALYSIS / 'human-behavior/meta.jsonl', ANALYSIS / 'fruit-bowl/meta_all.jsonl', ANALYSIS / 'beverage-shelf/meta_all.jsonl']

_local = threading.local()


class TokenPool:
    """Round-robin over several HF accounts. Each account has its own quota (5000 resolver requests / 5 min);
    on a 429 the token rests for the server's retry-after and the request moves on to the next token."""

    def __init__(self, tokens):
        self.tokens, self.rest, self.i, self.lock = tokens, [0.0] * len(tokens), 0, threading.Lock()

    def take(self):
        while True:
            with self.lock:
                now = time.time()
                for k in range(len(self.tokens)):
                    j = (self.i + k) % len(self.tokens)
                    if self.rest[j] <= now:
                        self.i = j + 1
                        return j
                wait = min(self.rest) - now
            time.sleep(max(1.0, min(wait, 30)))

    def cool(self, j, seconds):
        with self.lock: self.rest[j] = max(self.rest[j], time.time() + seconds)


def _tokens():
    toks = [os.environ[k] for k in ('HF_TOKEN', 'HF_TOKEN_2', 'HF_TOKEN_3', 'HF_TOKEN_4', 'HF_TOKEN_5') if os.environ.get(k)]
    return list(dict.fromkeys(toks))


POOL = None


def session():
    s = getattr(_local, 's', None)
    if s is None: s = _local.s = requests.Session()
    return s


def get(url, **kw):
    global POOL
    if POOL is None: POOL = TokenPool(_tokens())
    hf = 'huggingface.co' in url  # signed CDN urls need no token and have no resolver quota
    for attempt in range(12):
        j = POOL.take() if hf else None
        headers = {**kw.get('headers', {}), **({'Authorization': f'Bearer {POOL.tokens[j]}'} if hf else {})}
        try:
            r = session().get(url, timeout=60, **{**kw, 'headers': headers})
            if r.status_code == 429:
                POOL.cool(j, float(r.headers.get('retry-after') or 60) if hf else 0)
                if not hf: time.sleep(5)
                continue
            if r.status_code in (500, 502, 503, 504):
                time.sleep(min(30, 2 ** attempt)); continue
            r.raise_for_status()
            return r
        except requests.RequestException:
            if attempt == 11: raise
            time.sleep(min(30, 2 ** attempt))
    raise RuntimeError(f'gave up: {url}')


def tree(path, recursive=False):
    url = f'{API}/tree/main/{path}?limit=1000' + ('&recursive=true' if recursive else '')
    while url:
        r = get(url)
        yield from r.json()
        url = r.links.get('next', {}).get('url')


# ---------- plan ----------
def plan(args):
    WORK.mkdir(parents=True, exist_ok=True)
    tmp = Path(args.scratch) / 'plan.jsonl'
    n = 0
    with open(tmp, 'w') as f:
        for sp in [x['path'].split('/')[-1] for x in tree('data') if x['type'] == 'directory']:
            for task in [x['path'].split('/')[-1] for x in tree(f'data/{sp}') if x['type'] == 'directory']:
                eps = defaultdict(lambda: {'size': 0, 'annotated': False})
                for it in tree(f'data/{sp}/{task}', recursive=True):
                    rel = it['path'].split('/')[3:]
                    if len(rel) != 2 or not rel[0].startswith('episode'): continue
                    if rel[1] == 'episode.mcap': eps[rel[0]]['size'] = it['size']
                    elif rel[1] == 'annotation.mcap': eps[rel[0]]['annotated'] = True
                for ep, v in sorted(eps.items()):
                    if v['size']: f.write(json.dumps({'split': sp, 'task': task, 'episode': ep, **v}) + '\n'); n += 1
                print(f'{sp}/{task}: {len(eps)}  (total {n})', flush=True)
    shutil.copy(tmp, WORK / 'plan.jsonl')
    print('PLAN DONE', n)


# ---------- seeds from earlier analyses ----------
def load_seeds():
    """episode (uuids are unique across tasks) -> {start, duration, operator}."""
    seeds = {}
    for p in SEED_FILES:
        if not p.exists(): continue
        for line in open(p):
            d = json.loads(line)
            if d.get('error') or not d.get('start_ns') or d.get('duration_s') is None: continue
            seeds[d['episode']] = {'start': d['start_ns'] // 1_000_000, 'duration': round(d['duration_s'], 2), 'operator': d.get('operator_id') or d.get('operator') or ''}
    return seeds


EXTRA_SCAN = []  # extra dirs with shard files, e.g. fetched straight from S3 when the mount lags behind other pods


def load_scanned():
    done = {}
    for p in sorted(q for d in [WORK / 'scan', *EXTRA_SCAN] for q in Path(d).glob('shard-*.jsonl')):
        for line in open(p):
            try: d = json.loads(line)
            except json.JSONDecodeError: continue  # partially copied last line
            if 'error' not in d: done[(d['split'], d['task'], d['episode'])] = d
    return done


# ---------- scan ----------
class HttpFile:
    """Seekable read-only view of a remote file: prefetches the tail (summary section), fetches
    anything else in >=64 KB range requests and keeps every fetched chunk."""
    MIN = 64 << 10

    def __init__(self, url, size, tail=256 << 10):
        self.url, self.size, self.pos, self.chunks, self.nreq = url, size, 0, [], 0
        self._fetch(max(0, size - tail), size)

    def _fetch(self, a, b):
        r = get(self.url, headers={'Range': f'bytes={a}-{b - 1}'})
        self.nreq += 1
        if 'huggingface.co' not in r.url: self.url = r.url  # reuse the signed CDN url
        self.chunks.append((a, r.content))

    def _read(self, a, b):
        for ca, cd in self.chunks:
            if ca <= a and b <= ca + len(cd): return cd[a - ca:b - ca]
        self._fetch(a, min(self.size, max(b, a + self.MIN)))
        ca, cd = self.chunks[-1]
        return cd[a - ca:b - ca]

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self.size + off
        return self.pos

    def read(self, n=-1):
        b = self.size if n is None or n < 0 else min(self.size, self.pos + n)
        if b <= self.pos: return b''
        out = self._read(self.pos, b)
        self.pos += len(out)
        return out

    def readinto(self, buf):
        d = self.read(len(buf)); buf[:len(d)] = d; return len(d)


def read_episode(e):
    path = f"data/{e['split']}/{e['task']}/{e['episode']}/episode.mcap"
    try:
        f = HttpFile(f'{HF}/resolve/main/{path}', e['size'])
        r = make_reader(f)
        s = r.get_summary()
        meta = {}
        for m in r.iter_metadata(): meta.update(m.metadata)
        st = s.statistics
        return {**e, 'start': st.message_start_time // 1_000_000, 'duration': round((st.message_end_time - st.message_start_time) / 1e9, 2),
                'operator': meta.get('operator_id') or meta.get('operator-id') or '', 'requests': f.nreq}
    except Exception as ex:
        return {**e, 'error': repr(ex)[:300]}


def scan(args):
    plan_rows = [json.loads(l) for l in open(WORK / 'plan.jsonl')]
    seeds, done = load_seeds(), load_scanned()
    mine = [e for e in plan_rows
            if int(hashlib.md5(e['episode'].encode()).hexdigest(), 16) % args.nshards == args.shard
            and e['episode'] not in seeds and (e['split'], e['task'], e['episode']) not in done]
    if args.reverse: mine.reverse()  # helper from the other end of a shard another process is already scanning
    if args.limit: mine = mine[:args.limit]
    out_dir = WORK / 'scan'; out_dir.mkdir(parents=True, exist_ok=True)
    name = f'shard-{args.tag}{args.shard}' + ('-rev' if args.reverse else '')
    final = out_dir / f'{name}.jsonl'
    local = Path(args.scratch) / f'{name}.jsonl'
    if final.exists() and not local.exists(): shutil.copy(final, local)  # resume: keep earlier rows
    print(f'shard {args.shard}/{args.nshards}: {len(mine)} to scan ({len(seeds)} seeded, {len(done)} already scanned)', flush=True)
    t0, last_copy, n, err = time.time(), time.time(), 0, 0
    # Re-read the other shards' output every 2 min and skip what they already did, so a --reverse helper
    # stops where it meets the forward scanner instead of redoing its half.
    seen = {'keys': set(done), 't': time.time()}
    lock = threading.Lock()
    def work(e):
        with lock:
            if time.time() - seen['t'] > 120:
                seen['keys'] = set(load_scanned()); seen['t'] = time.time()
            if (e['split'], e['task'], e['episode']) in seen['keys']: return None
        return read_episode(e)
    with ThreadPoolExecutor(args.workers) as ex, open(local, 'a') as f:
        for row in ex.map(work, mine):
            if row is None: n += 1; continue
            f.write(json.dumps(row) + '\n'); n += 1; err += 'error' in row
            if n % 500 == 0 or time.time() - last_copy > 120:
                f.flush(); shutil.copy(local, final); last_copy = time.time()
                rate = n / (time.time() - t0)
                print(f'{n}/{len(mine)}  {rate:.1f} ep/s  errors {err}  eta {(len(mine) - n) / rate / 60:.0f} min', flush=True)
    shutil.copy(local, final)
    print(f'SCAN DONE shard {args.shard}: {n} rows, {err} errors, {time.time() - t0:.0f}s', flush=True)


# ---------- merge ----------
def merge(args):
    plan_rows = [json.loads(l) for l in open(WORK / 'plan.jsonl')]
    seeds, done = load_seeds(), load_scanned()
    out = SITE / 'index'
    by_task = defaultdict(dict)
    missing = Counter()
    for e in plan_rows:
        info = done.get((e['split'], e['task'], e['episode'])) or seeds.get(e['episode'])
        rec = {'size': e['size'], 'annotated': e['annotated']}
        if info: rec.update(start=info['start'], duration=info['duration'], operator=info['operator'])
        else: missing[(e['split'], e['task'])] += 1
        by_task[(e['split'], e['task'])][e['episode']] = rec
    if out.exists(): shutil.rmtree(out)
    summary = {'generated': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'dataset': REPO, 'splits': {}}
    for (sp, task), eps in sorted(by_task.items()):
        (out / sp).mkdir(parents=True, exist_ok=True)
        with open(out / sp / f'{task}.json', 'w') as f: json.dump(eps, f, separators=(',', ':'))
        known = [v for v in eps.values() if 'start' in v]
        ops = Counter(v['operator'] for v in known if v['operator'])
        days = Counter(time.strftime('%Y-%m-%d', time.gmtime(v['start'] / 1000)) for v in known)
        summary['splits'].setdefault(sp, {})[task] = {
            'episodes': len(eps), 'annotated': sum(v['annotated'] for v in eps.values()),
            'hours': round(sum(v.get('duration', 0) for v in known) / 3600, 2), 'bytes': sum(v['size'] for v in eps.values()),
            'indexed': len(known), 'operators': len(ops), 'top_operators': ops.most_common(5),
            'first': min((v['start'] for v in known), default=None), 'last': max((v['start'] for v in known), default=None),
            'days': len(days), 'cover': min(eps)}
    with open(out / 'summary.json', 'w') as f: json.dump(summary, f, separators=(',', ':'))
    tot = sum(len(v) for v in by_task.values())
    print(f'MERGE DONE {len(by_task)} tasks, {tot} episodes, {tot - sum(missing.values())} with metadata, {sum(missing.values())} missing')
    for k, v in missing.most_common(10): print('  missing', k, v)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('step', choices=['plan', 'scan', 'merge'])
    ap.add_argument('--shard', type=int, default=0)
    ap.add_argument('--nshards', type=int, default=1)
    ap.add_argument('--workers', type=int, default=32)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--reverse', action='store_true')
    ap.add_argument('--extra-scan', action='append', default=[], help='extra dir with shard-*.jsonl (merge)')
    ap.add_argument('--tag', default='', help='output name prefix when re-partitioning the remaining work')
    ap.add_argument('--scratch', default=os.environ.get('RISELAB_SCRATCH', '/tmp'))
    a = ap.parse_args()
    if a.step != 'merge' and not _tokens(): sys.exit('HF_TOKEN not set')
    Path(a.scratch).mkdir(parents=True, exist_ok=True)
    EXTRA_SCAN.extend(a.extra_scan)
    {'plan': plan, 'scan': scan, 'merge': merge}[a.step](a)
