/* images.js — بيحوّل مرجع الصورة لـ src:
   fs:<id>          صورة متخزنة في Firestore (productImages)
   ph:<kind>:<CLR>  رسمة مولّدة للوضع التجريبي (مش صورة منتج حقيقي)
   https://...      لينك عادي */
(function (root) {
  'use strict';
  const App = root.App;

  // أشكال بسيطة على مساحة 200×250
  const SHAPES = {
    tshirt: 'M62 40 L40 52 L20 92 L46 104 L56 86 L56 214 L144 214 L144 86 L154 104 L180 92 L160 52 L138 40 Q128 58 100 58 Q72 58 62 40 Z',
    shirt: 'M64 38 L42 50 L24 120 L46 126 L58 90 L58 216 L142 216 L142 90 L154 126 L176 120 L158 50 L136 38 L118 52 L100 72 L82 52 Z M100 72 L100 216',
    hoodie: 'M70 46 Q72 22 100 20 Q128 22 130 46 L160 58 L182 150 L158 158 L146 104 L146 220 L54 220 L54 104 L42 158 L18 150 L40 58 Z',
    jacket: 'M66 40 L40 54 L22 160 L46 166 L58 104 L58 222 L142 222 L142 104 L154 166 L178 160 L160 54 L134 40 L100 70 Z M100 70 L100 222',
    pants: 'M58 30 L142 30 L150 226 L114 226 L100 100 L86 226 L50 226 Z',
    dress: 'M78 26 L122 26 L128 70 L118 96 L160 226 L40 226 L82 96 L72 70 Z',
    top: 'M70 44 L130 44 L146 70 L136 78 L136 196 L64 196 L64 78 L54 70 Z',
    shoe: 'M24 150 Q30 120 60 116 L96 110 Q110 92 132 96 L150 104 Q176 116 178 150 L178 170 L24 170 Z',
    bag: 'M50 92 L150 92 L162 220 L38 220 Z M74 92 Q74 46 100 46 Q126 46 126 92',
    belt: 'M18 112 L182 112 L182 140 L18 140 Z M120 104 L156 104 L156 148 L120 148 Z',
    cap: 'M40 150 Q40 80 100 78 Q160 80 160 150 Z M150 150 L196 160 L150 168 Z',
    wallet: 'M36 84 L164 84 L164 176 L36 176 Z M120 112 L164 112 L164 148 L120 148 Z',
    watch: 'M82 30 L118 30 L118 80 L82 80 Z M82 170 L118 170 L118 220 L82 220 Z M100 82 A44 44 0 1 0 100 170 A44 44 0 1 0 100 82 Z'
  };

  function colorHex(code) {
    const list = (App.catalog && App.catalog.colors) || (App.demoData && App.demoData.colors) || [];
    const c = list.find(x => x.id === code);
    return c ? c.hex : '#999999';
  }

  // لون أفتح للخلفية علشان الشكل يبان على الأسود والأبيض
  function placeholder(kind, code) {
    const fill = colorHex(code);
    const path = SHAPES[kind] || SHAPES.tshirt;
    const light = /^#(f|e|d)/i.test(fill);
    const bg = light ? '#e9e5de' : '#f3f1ed';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 250"><rect width="200" height="250" fill="${bg}"/>` +
      `<path d="${path}" fill="${fill}" stroke="rgba(0,0,0,.18)" stroke-width="1.5" stroke-linejoin="round" fill-rule="evenodd"/></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  const fsCache = {};
  App.img = {
    placeholder,
    isPlaceholder: ref => typeof ref === 'string' && ref.startsWith('ph:'),
    // للصور اللي محتاجة تتقري من Firestore بيرجع null، واستخدم App.img.load
    src(ref) {
      if (!ref) return placeholder('tshirt', 'GRY');
      if (ref.startsWith('ph:')) { const [, kind, code] = ref.split(':'); return placeholder(kind, code); }
      if (ref.startsWith('fs:')) return fsCache[ref.slice(3)] || null;
      return ref;
    },
    async load(ref) {
      const direct = App.img.src(ref);
      if (direct) return direct;
      const id = ref.slice(3);
      const doc = await App.db.get('productImages', id);
      if (doc && doc.data) fsCache[id] = doc.data;
      return fsCache[id] || placeholder('tshirt', 'GRY');
    },
    /* بيحط الصورة في <img>، ولو fs: بيحمّلها بعدين */
    apply(imgEl, ref) {
      const s = App.img.src(ref);
      if (s) { imgEl.src = s; return; }
      App.img.load(ref).then(u => { imgEl.src = u; });
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
