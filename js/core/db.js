/* db.js — الواجهة الموحدة للبيانات. كل الصفحات بتكلم App.db بس، وتحتها adapter من اتنين:
   DemoAdapter (localStorage) أو FirebaseAdapter. نفس الدوال ونفس شكل الرد في الاتنين.

   query = { where: [[field, op, value], ...], orderBy: [field, 'asc'|'desc'], limit: n, after: [values] }
   ops: == != < <= > >= in array-contains
   المستندات بترجع ومعاها id، والتواريخ ISO strings. */
(function (root) {
  'use strict';
  const App = root.App;

  /* قيم خاصة في update/set */
  const op = (kind, val) => ({ __op: kind, val });
  const sentinels = {
    inc: n => op('inc', n),
    now: () => op('now'),
    del: () => op('del'),
    arrayUnion: (...v) => op('union', v),
    arrayRemove: (...v) => op('remove', v)
  };
  const isOp = v => v && typeof v === 'object' && typeof v.__op === 'string';

  /* بيقرا حقل متداخل 'shipment.status' */
  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  /* بيطبق where/orderBy/limit/after على array (الوضع التجريبي + الفلترة المحلية في المتجر) */
  function runQuery(docs, q = {}) {
    let out = docs.slice();
    for (const [field, o, value] of q.where || []) {
      out = out.filter(d => {
        const v = getPath(d, field);
        switch (o) {
          case '==': return v === value;
          case '!=': return v !== value && v !== undefined;
          case '<': return v < value;
          case '<=': return v <= value;
          case '>': return v > value;
          case '>=': return v >= value;
          case 'in': return Array.isArray(value) && value.includes(v);
          case 'array-contains': return Array.isArray(v) && v.includes(value);
          default: throw new Error('Unsupported op ' + o);
        }
      });
    }
    if (q.orderBy) {
      const [field, dir = 'asc'] = q.orderBy;
      const m = dir === 'desc' ? -1 : 1;
      out.sort((a, b) => {
        const x = getPath(a, field), y = getPath(b, field);
        if (x === y) return 0;
        if (x === undefined) return 1;
        if (y === undefined) return -1;
        return x > y ? m : -m;
      });
      if (q.after && q.after.length) {
        const cursor = q.after[0];
        out = out.filter(d => {
          const v = getPath(d, field);
          return dir === 'desc' ? v < cursor : v > cursor;
        });
      }
    }
    if (q.limit) out = out.slice(0, q.limit);
    return out;
  }

  let adapter = null;
  let readyPromise = null;

  App.db = {
    ...sentinels,
    runQuery,
    getPath,
    isOp,
    get adapter() { return adapter; },
    get mode() { return App.config.mode; },

    init() {
      if (readyPromise) return readyPromise;
      adapter = App.config.isDemo ? App.DemoAdapter : App.FirebaseAdapter;
      if (!adapter) throw new Error('DB adapter not loaded');
      readyPromise = Promise.resolve(adapter.init ? adapter.init() : null);
      return readyPromise;
    },

    async list(path, q) { await App.db.init(); return adapter.list(path, q || {}); },
    async get(path, id) { await App.db.init(); return adapter.get(path, id); },
    async add(path, data) { await App.db.init(); return adapter.add(path, data); },
    async set(path, id, data, opts) { await App.db.init(); return adapter.set(path, id, data, opts || {}); },
    async update(path, id, patch) { await App.db.init(); return adapter.update(path, id, patch); },
    async remove(path, id) { await App.db.init(); return adapter.remove(path, id); },
    /* tx(async t => { const d = await t.get(path,id); t.update(path,id,{...}); }) */
    async tx(fn) { await App.db.init(); return adapter.tx(fn); },
    /* بيرجع دالة لإلغاء المتابعة */
    watch(path, q, cb) {
      let unsub = null, cancelled = false;
      App.db.init().then(() => {
        if (!cancelled) unsub = adapter.watch(path, q || {}, cb);
      });
      return () => { cancelled = true; if (unsub) unsub(); };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
