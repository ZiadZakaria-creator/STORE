/* settings.js — بيقرا settings/* مرة واحدة، وبيحفظها في localStorage (stale-while-revalidate). */
(function (root) {
  'use strict';
  const App = root.App;
  const CACHE = 'cache:settings';

  App.settings = Object.assign({}, App.config.defaults, (App.store.get(CACHE) || {}).data);

  App.loadSettings = async function (force = false) {
    const cached = App.store.get(CACHE);
    const fresh = cached && Date.now() - cached.at < App.config.catalogCacheMs;
    const fetchIt = async () => {
      const docs = await App.db.list('settings');
      const data = {};
      docs.forEach(d => { const { id, ...rest } = d; data[id] = rest; });
      data.general = Object.assign({}, App.config.defaults.general, data.general);
      App.store.set(CACHE, { at: Date.now(), data });
      App.settings = Object.assign({}, App.config.defaults, data);
      App.emit('settings', App.settings);
      return App.settings;
    };
    if (fresh && !force) return App.settings;
    if (cached && !force) { fetchIt().catch(e => console.warn('settings refresh', e)); return App.settings; }
    return fetchIt();
  };

  App.storeName = () => App.tx(App.settings.general.storeName);
})(typeof window !== 'undefined' ? window : globalThis);
