import fs from 'node:fs/promises';
import path from 'node:path';

const MB = 1024 * 1024;
const now = () => Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mem() {
  const m = process.memoryUsage();
  return {
    rss: m.rss,
    heapUsed: m.heapUsed,
    mb: {
      rss: +(m.rss / MB).toFixed(2),
      heapUsed: +(m.heapUsed / MB).toFixed(2),
    },
  };
}

class Cache {
  constructor() {
    this.map = new Map();
    this.size = 0;
  }

  set(key, value, ttl = 60000) {
    const size = Buffer.byteLength(JSON.stringify(value));
    const t = now();

    this.map.set(key, {
      value,
      size,
      exp: t + ttl,
      last: t,
    });

    this.size += size;
  }

  get(key) {
    const e = this.map.get(key);
    if (!e) return;

    if (e.exp <= now()) {
      this.delete(key);
      return;
    }

    e.last = now();
    return e.value;
  }

  delete(key) {
    const e = this.map.get(key);
    if (!e) return;
    this.size -= e.size;
    this.map.delete(key);
  }

  sweep(limit = 100) {
    let n = 0;
    for (const [k, v] of this.map) {
      if (n >= limit) break;
      if (v.exp <= now()) {
        this.delete(k);
        n++;
      }
    }
    return n;
  }

  evict(n = 10) {
    let i = 0;
    for (const k of this.map.keys()) {
      if (i >= n) break;
      this.delete(k);
      i++;
    }
    return i;
  }

  evictRatio(r = 0.1) {
    return this.evict(Math.floor(this.map.size * r));
  }
}

export default async function cleaner(config = {}) {
  const tempRoot =
    config.tempRoot || path.resolve(process.cwd(), 'storage/temp');

  const cache = new Cache();

  const cooldown = {
    gc: 0,
    medium: 0,
    aggressive: 0,
  };

  const COOLDOWN = {
    gc: 60000,
    medium: 20000,
    aggressive: 45000,
  };

  function can(key, time) {
    return now() - cooldown[key] >= time;
  }

  function mark(key) {
    cooldown[key] = now();
  }

  function rssLevel(v) {
    if (v < 200 * MB) return 'normal';
    if (v < 250 * MB) return 'light';
    if (v < 300 * MB) return 'medium';
    return 'aggressive';
  }

  function heapLevel(v) {
    if (v < 50 * MB) return 'normal';
    if (v < 100 * MB) return 'light';
    if (v < 200 * MB) return 'medium';
    return 'aggressive';
  }

  async function forceGC(ctx) {
    if (!global.gc) return;
    if (!can('gc', COOLDOWN.gc)) return;

    const before = mem();
    global.gc();
    mark('gc');

    global.logger.success('GC executed', {
      ctx,
      before: before.mb,
      after: mem().mb,
    });
  }

  /* ================= RSS ================= */

  async function optimizeRssLight(m) {
    global.logger.info('RSS light', m.mb);

    cache.sweep(20);
    cache.evict(5);
  }

  async function optimizeRssMedium(m) {
    global.logger.warn('RSS medium', m.mb);

    cache.sweep(50);

    if (can('medium', COOLDOWN.medium)) {
      cache.evictRatio(0.1);
      mark('medium');
    }

    await sleep(10);
  }

  async function optimizeRssAggressive(m) {
    global.logger.warn('RSS aggressive', m.mb);

    cache.sweep(100);

    if (can('aggressive', COOLDOWN.aggressive)) {
      cache.evictRatio(0.25);
      mark('aggressive');
    }

    await forceGC('rss');
  }

  /* ================= HEAP ================= */

  async function optimizeHeapLight(m) {
    global.logger.info('Heap light', m.mb);

    cache.sweep(20);
    cache.evict(10);
  }

  async function optimizeHeapMedium(m) {
    global.logger.warn('Heap medium', m.mb);

    cache.sweep(60);

    if (can('medium', COOLDOWN.medium)) {
      cache.evictRatio(0.15);
      mark('medium');
    }

    await forceGC('heap-medium');
  }

  async function optimizeHeapAggressive(m) {
    global.logger.warn('Heap aggressive', m.mb);

    cache.sweep(120);

    if (can('aggressive', COOLDOWN.aggressive)) {
      cache.evictRatio(0.3);
      mark('aggressive');
    }

    await forceGC('heap-aggressive');
  }

  async function memorySweep() {
    const m = mem();

    cache.sweep(200);

    switch (rssLevel(m.rss)) {
      case 'light':
        await optimizeRssLight(m);
        break;
      case 'medium':
        await optimizeRssMedium(m);
        break;
      case 'aggressive':
        await optimizeRssAggressive(m);
        break;
    }

    switch (heapLevel(m.heapUsed)) {
      case 'light':
        await optimizeHeapLight(m);
        break;
      case 'medium':
        await optimizeHeapMedium(m);
        break;
      case 'aggressive':
        await optimizeHeapAggressive(m);
        break;
    }

    global.logger.success('Memory sweep done', {
      rss: rssLevel(m.rss),
      heap: heapLevel(m.heapUsed),
      memory: m.mb,
    });
  }

  /* ================= TEMP ================= */

  async function cleanupTemp() {
    try {
      const list = await fs.readdir(tempRoot, { withFileTypes: true });

      let count = 0;

      for (const f of list) {
        const p = path.join(tempRoot, f.name);
        const stat = await fs.stat(p);

        const age = now() - Math.max(stat.mtimeMs, stat.ctimeMs);

        if (age < 6 * 60 * 60 * 1000) continue;

        if (f.isFile()) {
          await fs.unlink(p);
        } else {
          await fs.rm(p, { recursive: true, force: true });
        }

        count++;

        if (count % 20 === 0) {
          await sleep(25);
        }
      }

      if (count > 0) {
        global.logger.success('Temp cleaned', { count });
      }
    } catch (e) {
      global.logger.error('Temp cleanup error', { error: e?.message });
    }
  }

  /* ================= SCHEDULE ================= */

  setInterval(memorySweep, 30000);
  setInterval(cleanupTemp, 120000);

  await memorySweep();
  await cleanupTemp();

  global.logger.success('Cleaner started', {
    tempRoot,
  });

  return {
    cache,
  };
}