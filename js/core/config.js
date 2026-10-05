/* config.js — الوضع (تجريبي / متصل) والإعدادات الافتراضية للمتجر.
   الإعدادات الحقيقية (الاسم، الواتساب، الشحن ...) بتتقري من settings/* وبتتعدل من اللوحة. */
(function (root) {
  'use strict';
  const App = root.App;
  const fb = root.FIREBASE_CONFIG;
  const live = !!(fb && fb.apiKey && fb.projectId);

  App.config = {
    mode: live ? 'live' : 'demo',
    isDemo: !live,
    firebase: live ? fb : null,
    // قيم افتراضية بس، لحد ما الإعدادات تتقري. مفيش أسعار هنا.
    defaults: {
      general: {
        storeName: { ar: 'اسم المتجر', en: 'Store name' },
        tagline: { ar: '', en: '' },
        whatsapp: '',            // فاضي = زرار الواتساب مش بيظهر
        email: '',
        orderPrefix: 'CL',
        currency: 'EGP',
        defaultLang: 'ar'
      }
    },
    catalogCacheMs: 5 * 60 * 1000
  };
})(typeof window !== 'undefined' ? window : globalThis);
