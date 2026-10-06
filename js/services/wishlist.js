/* مفضلة الزائر محلية؛ الحساب بيتحدث بمعاملة تحفظ تعديلات النوافذ التانية. */
(function (root) {
  'use strict';
  const App = root.App, KEY = 'wishlist:guest';
  const clean = rows => [...new Set((Array.isArray(rows) ? rows : []).filter(id => typeof id === 'string' && id.length > 0 && id.length <= 100))].slice(0, 200);
  let ids = [], owner, queue = Promise.resolve();
  const enqueue = work => { const pending = queue.then(work); queue = pending.catch(() => {}); return pending; };
  const publish = () => App.emit('wishlist', ids.slice());
  async function sync() {
    const uid = App.auth.user?.uid || null;
    if (owner === uid) return;
    ids = []; owner = undefined; publish();
    const guest = clean(App.store.get(KEY, []));
    if (!uid) { ids = guest; owner = null; publish(); return; }
    const merged = await App.db.tx(async t => {
      const profile = await t.get('users', uid);
      if (!profile) throw new Error(App.t('common.error'));
      const saved = clean(profile.wishlist), next = clean([...saved, ...guest]);
      if (JSON.stringify(saved) !== JSON.stringify(next)) t.update('users', uid, {wishlist:next,updatedAt:App.db.now()});
      return next;
    });
    if ((App.auth.user?.uid || null) !== uid) return;
    ids = merged; owner = uid;
    // لو الحساب مليان، نخلي الزيادة محفوظة للزائر بدل فقدها.
    App.store.set(KEY, guest.filter(id => !merged.includes(id)));
    publish();
  }
  App.wishlist = {
    get ids() { return ids.slice(); },
    has: id => ids.includes(id),
    async init() { await App.auth.init(); return enqueue(sync); },
    set(id, wanted) {
      return enqueue(async () => {
        await sync();
        if (typeof id !== 'string' || !id || id.length > 100) throw new Error(App.t('common.error'));
        const uid = App.auth.user?.uid || null;
        const change = current => {
          const rows = clean(current).filter(v => v !== id);
          if (wanted) { if (rows.length >= 200) throw new Error(App.t('wish.limit')); rows.push(id); }
          return rows;
        };
        let next;
        if (uid) next = await App.db.tx(async t => {
          const profile = await t.get('users', uid);
          if (!profile) throw new Error(App.t('common.error'));
          const rows = change(profile.wishlist);
          t.update('users', uid, {wishlist:rows,updatedAt:App.db.now()});
          return rows;
        });
        else { next = change(App.store.get(KEY, [])); if (!App.store.set(KEY, next)) throw new Error(App.t('wish.storage')); }
        if ((App.auth.user?.uid || null) === uid) { ids = next; publish(); }
        return wanted;
      });
    }
  };
  App.on('auth', () => {
    ids = []; owner = undefined; publish();
    App.wishlist.init().catch(() => App.toast?.(App.t('wish.syncError')));
  });
  if (root.addEventListener) root.addEventListener('storage', event => {
    if (event.key === 'cs:' + KEY && !App.auth.user) { owner = undefined; App.wishlist.init().catch(() => {}); }
  });
})(typeof window !== 'undefined' ? window : globalThis);
