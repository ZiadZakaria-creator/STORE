/* money.js — تنسيق العملة. الافتراضي ج.م، وأي عملة جديدة تتضاف في CURRENCIES. */
(function (root) {
  'use strict';
  const App = root.App;

  const CURRENCIES = {
    EGP: { decimals: 2, symbol: { ar: 'ج.م', en: 'EGP' }, symbolAfter: { ar: true, en: false } }
  };

  // تقريب لأقرب قرش من غير أخطاء الـ floating point
  const round = (n, d = 2) => {
    const f = Math.pow(10, d);
    return Math.round((Number(n) + Number.EPSILON) * f) / f;
  };

  App.money = {
    currencies: CURRENCIES,
    round,
    format(amount, currency) {
      const code = currency || (App.settings && App.settings.general && App.settings.general.currency) || 'EGP';
      const c = CURRENCIES[code] || CURRENCIES.EGP;
      const lang = App.i18n ? App.i18n.lang : 'ar';
      const n = round(amount || 0, c.decimals);
      const whole = Number.isInteger(n);
      const num = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
        minimumFractionDigits: whole ? 0 : c.decimals,
        maximumFractionDigits: c.decimals
      }).format(n);
      const sym = c.symbol[lang] || c.symbol.en;
      return c.symbolAfter[lang] ? `${num} ${sym}` : `${sym} ${num}`;
    },
    // نسبة الخصم بين السعر الأصلي وسعر البيع
    percentOff(price, sale) {
      if (!(price > 0) || !(sale >= 0) || sale >= price) return 0;
      return Math.round((1 - sale / price) * 100);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
