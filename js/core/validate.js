/* validate.js — التحقق من المدخلات في المتصفح. نفس القواعد متكررة في firestore.rules. */
(function (root) {
  'use strict';
  const App = root.App;

  // بيحوّل الأرقام العربية/الفارسية لإنجليزي (العميل ممكن يكتب ٠١٠...)
  const toLatinDigits = s => String(s == null ? '' : s)
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x06f0);

  const V = {
    toLatinDigits,
    // موبايل مصري: 010 / 011 / 012 / 015 + 8 أرقام، ويقبل +20 أو 0020
    normalizePhoneEG(s) {
      let p = toLatinDigits(s).replace(/[\s\-()]/g, '');
      if (p.startsWith('+20')) p = '0' + p.slice(3);
      else if (p.startsWith('0020')) p = '0' + p.slice(4);
      else if (p.startsWith('20') && p.length === 12) p = '0' + p.slice(2);
      return p;
    },
    phoneEG: s => /^01[0125]\d{8}$/.test(V.normalizePhoneEG(s)),
    email: s => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(String(s || '').trim()),
    required: s => String(s == null ? '' : s).trim().length > 0,
    length: (s, min, max) => { const n = String(s == null ? '' : s).trim().length; return n >= min && n <= max; },
    positiveNumber: n => typeof n === 'number' && isFinite(n) && n >= 0,
    integer: n => Number.isInteger(n),
    slug: s => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(s || '')),
    // واتساب بالصيغة الدولية من غير +: 2010xxxxxxxx
    whatsapp: s => /^20(10|11|12|15)\d{8}$/.test(String(s || ''))
  };

  App.validate = V;
})(typeof window !== 'undefined' ? window : globalThis);
