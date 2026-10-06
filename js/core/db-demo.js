/* db-demo.js — DemoAdapter: كل البيانات في localStorage. بيشتغل لما firebase-config.js فاضي.
   أول مرة بيحمّل البيانات التجريبية من data/demo-data.js. */
(function (root) {
  'use strict';
  const App = root.App;
  const KEY = path => 'db:' + path;
  const SEED_KEY = 'db:__seeded';

  const read = path => App.store.get(KEY(path), {}) || {};
  const write = (path, map) => {
    if (!App.store.set(KEY(path), map)) throw new Error('localStorage full');
    notify(path);
  };

  /* ---------- المتابعة اللحظية ---------- */
  const watchers = [];
  function notify(path) {
    watchers.filter(w => w.path === path).forEach(w => w.fire());
  }
  if (root.addEventListener) {
    // تغيير من تاب تاني (مثلاً اللوحة مفتوحة في تاب والمتجر في تاب)
    root.addEventListener('storage', e => {
      if (e.key && e.key.startsWith('cs:db:')) notify(e.key.slice('cs:db:'.length));
    });
  }

  /* بيطبق القيم الخاصة (inc, now, del ...) على مستند */
  function applyPatch(doc, patch) {
    const out = App.clone(doc) || {};
    for (const [path, v] of Object.entries(patch)) {
      const keys = path.split('.');
      let o = out;
      for (let i = 0; i < keys.length - 1; i++) {
        if (o[keys[i]] == null || typeof o[keys[i]] !== 'object') o[keys[i]] = {};
        o = o[keys[i]];
      }
      const k = keys[keys.length - 1];
      if (App.db.isOp(v)) {
        switch (v.__op) {
          case 'inc': o[k] = (Number(o[k]) || 0) + v.val; break;
          case 'now': o[k] = App.nowISO(); break;
          case 'del': delete o[k]; break;
          case 'union': o[k] = Array.from(new Set([...(Array.isArray(o[k]) ? o[k] : []), ...v.val])); break;
          case 'remove': o[k] = (Array.isArray(o[k]) ? o[k] : []).filter(x => !v.val.includes(x)); break;
        }
      } else {
        o[k] = App.clone(v);
      }
    }
    return out;
  }

  // set كامل: القيم الخاصة جوه الكائن نفسه (مش dotted)
  function resolveDeep(data) {
    if (App.db.isOp(data)) return applyPatch({}, { x: data }).x;
    if (Array.isArray(data)) return data.map(resolveDeep);
    if (data && typeof data === 'object') {
      const o = {};
      for (const [k, v] of Object.entries(data)) {
        const r = resolveDeep(v);
        if (r !== undefined) o[k] = r;
      }
      return o;
    }
    return data;
  }

  const withId = (id, d) => (d ? Object.assign({ id }, App.clone(d)) : null);

  let transactionQueue = Promise.resolve();
  const Demo = {
    name: 'demo',
    init() {
      if (!App.store.get(SEED_KEY) && App.demoData) Demo.seed();
    },
    seed() {
      const data = App.demoData || {};
      for (const [path, docs] of Object.entries(data)) {
        const map = {};
        for (const d of docs) {
          const { id, ...rest } = d;
          map[id] = rest;
        }
        App.store.set(KEY(path), map);
      }
      App.store.set(SEED_KEY, App.nowISO());
    },
    // بيمسح كل بيانات الوضع التجريبي ويرجّع البيانات الأصلية
    reset() {
      App.store.keys().filter(k => k.startsWith('db:')).forEach(k => App.store.remove(k));
      Demo.seed();
      Object.keys(App.demoData || {}).forEach(notify);
    },

    async list(path, q) {
      const map = read(path);
      const docs = Object.entries(map).map(([id, d]) => withId(id, d));
      return App.db.runQuery(docs, q);
    },
    async get(path, id) {
      return withId(id, read(path)[id]);
    },
    async add(path, data) {
      const id = App.randomId(20);
      const map = read(path);
      map[id] = resolveDeep(data);
      write(path, map);
      return id;
    },
    async set(path, id, data, opts) {
      const map = read(path);
      if (opts.merge && map[id]) {
        const flat = {};
        for (const [k, v] of Object.entries(data)) flat[k] = v;
        map[id] = applyPatch(map[id], flat);
      } else {
        map[id] = resolveDeep(data);
      }
      write(path, map);
    },
    async update(path, id, patch) {
      const map = read(path);
      if (!map[id]) throw new Error(`not-found: ${path}/${id}`);
      map[id] = applyPatch(map[id], patch);
      write(path, map);
    },
    async remove(path, id) {
      const map = read(path);
      delete map[id];
      write(path, map);
    },
    // localStorage متزامن، فالـ transaction بتتنفذ مرة واحدة: القراءات الأول وبعدها الكتابات
    async tx(fn) {
      const run = async () => {
        const staged = new Map(), originals = new Map();
        const map = path => {
          if (!staged.has(path)) { const data = read(path); originals.set(path, App.clone(data)); staged.set(path, App.clone(data)); }
          return staged.get(path);
        };
        const t = {
          get: async (path, id) => withId(id, map(path)[id]),
          set: (path, id, data, opts) => { const m = map(path); m[id] = opts?.merge && m[id] ? applyPatch(m[id], data) : resolveDeep(data); },
          update: (path, id, patch) => { const m = map(path); if (!m[id]) throw new Error('not-found'); m[id] = applyPatch(m[id], patch); },
          remove: (path, id) => { delete map(path)[id]; }
        };
        const result = await fn(t);
        const saved = [];
        for (const [path, data] of staged) {
          if (!App.store.set(KEY(path), data)) {
            saved.forEach(p => App.store.set(KEY(p), originals.get(p)));
            throw new Error('localStorage full');
          }
          saved.push(path);
        }
        saved.forEach(notify);
        return result;
      };
      const pending = transactionQueue.then(run);
      transactionQueue = pending.catch(() => {});
      return pending;
    },
    watch(path, q, cb) {
      const w = { path, fire: () => Demo.list(path, q).then(cb) };
      watchers.push(w);
      w.fire();
      return () => { const i = watchers.indexOf(w); if (i >= 0) watchers.splice(i, 1); };
    }
  };

  App.DemoAdapter = Demo;
})(typeof window !== 'undefined' ? window : globalThis);
