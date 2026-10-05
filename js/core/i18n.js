/* i18n.js — كل النصوص اللي العميل بيشوفها (عربي + إنجليزي). */
(function (root) {
  'use strict';
  const App = root.App;

  const dict = {
    ar: {
      'nav.home': 'الرئيسية',
      'nav.shop': 'كل المنتجات',
      'nav.search': 'ابحث عن منتج...',
      'nav.cart': 'السلة',
      'nav.wishlist': 'المفضلة',
      'nav.account': 'حسابي',
      'nav.menu': 'القائمة',
      'nav.close': 'إغلاق',
      'nav.lang': 'English',
      'nav.theme': 'تغيير المظهر',
      'nav.track': 'تتبع طلبك',
      'home.hero.kicker': 'مجموعة جديدة',
      'home.hero.title': 'لبسك اليومي، بجودة تستاهل',
      'home.hero.text': 'تشكيلة رجالي وحريمي وأطفال، وأحذية وإكسسوارات.',
      'home.hero.cta': 'تسوّق دلوقتي',
      'home.hero.delivery': 'بنوصّل لـ: {list}',
      'home.categories': 'تسوق حسب القسم',
      'home.new': 'وصل حديثاً',
      'home.viewAll': 'عرض الكل',
      'product.add': 'أضف للسلة',
      'product.soldOut': 'نفد',
      'product.sale': 'خصم',
      'product.new': 'جديد',
      'product.colors': '{n} ألوان',
      'footer.rights': 'كل الحقوق محفوظة',
      'footer.policies': 'السياسات',
      'footer.contact': 'تواصل معانا',
      'footer.whatsapp': 'واتساب',
      'demo.badge': 'وضع تجريبي',
      'demo.note': 'المنتجات والأسعار المعروضة تجريبية',
      'common.loading': 'جاري التحميل...',
      'common.error': 'حصلت مشكلة، جرب تاني',
      'common.currency.EGP': 'ج.م',
      '404.title': 'الصفحة مش موجودة',
      '404.text': 'اللينك ده ممكن يكون اتغير أو اتشال.',
      '404.back': 'ارجع للرئيسية'
    },
    en: {
      'nav.home': 'Home',
      'nav.shop': 'Shop all',
      'nav.search': 'Search products...',
      'nav.cart': 'Cart',
      'nav.wishlist': 'Wishlist',
      'nav.account': 'Account',
      'nav.menu': 'Menu',
      'nav.close': 'Close',
      'nav.lang': 'العربية',
      'nav.theme': 'Toggle theme',
      'nav.track': 'Track order',
      'home.hero.kicker': 'New collection',
      'home.hero.title': 'Everyday wear, made to last',
      'home.hero.text': 'Men, women and kids — plus shoes and accessories.',
      'home.hero.cta': 'Shop now',
      'home.hero.delivery': 'We deliver to: {list}',
      'home.categories': 'Shop by category',
      'home.new': 'New arrivals',
      'home.viewAll': 'View all',
      'product.add': 'Add to cart',
      'product.soldOut': 'Sold out',
      'product.sale': 'Sale',
      'product.new': 'New',
      'product.colors': '{n} colors',
      'footer.rights': 'All rights reserved',
      'footer.policies': 'Policies',
      'footer.contact': 'Contact us',
      'footer.whatsapp': 'WhatsApp',
      'demo.badge': 'Demo mode',
      'demo.note': 'Products and prices shown are demo data',
      'common.loading': 'Loading...',
      'common.error': 'Something went wrong, try again',
      'common.currency.EGP': 'EGP',
      '404.title': 'Page not found',
      '404.text': 'This link may have changed or been removed.',
      '404.back': 'Back to home'
    }
  };

  const SUPPORTED = ['ar', 'en'];
  let lang = App.store.get('lang') || 'ar';
  if (!SUPPORTED.includes(lang)) lang = 'ar';

  App.i18n = {
    dict,
    supported: SUPPORTED,
    get lang() { return lang; },
    get dir() { return lang === 'ar' ? 'rtl' : 'ltr'; },
    setLang(next) {
      if (!SUPPORTED.includes(next) || next === lang) return;
      lang = next;
      App.store.set('lang', lang);
      App.i18n.apply();
      App.emit('lang', lang);
    },
    toggle() { App.i18n.setLang(lang === 'ar' ? 'en' : 'ar'); },
    // بيترجم [data-i18n] و [data-i18n-placeholder] و [data-i18n-aria]
    apply(el) {
      const doc = root.document;
      doc.documentElement.lang = lang;
      doc.documentElement.dir = App.i18n.dir;
      const scope = el || doc;
      scope.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = App.t(n.dataset.i18n); });
      scope.querySelectorAll('[data-i18n-placeholder]').forEach(n => { n.placeholder = App.t(n.dataset.i18nPlaceholder); });
      scope.querySelectorAll('[data-i18n-aria]').forEach(n => { n.setAttribute('aria-label', App.t(n.dataset.i18nAria)); });
    }
  };

  /* App.t('home.hero.delivery', {list: '...'}) */
  App.t = (key, vars) => {
    let s = (dict[lang] && dict[lang][key]) ?? dict.ar[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  };

  /* بيختار النص المناسب من حقل {ar, en} جاي من البيانات */
  App.tx = v => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    return v[lang] || v.ar || v.en || '';
  };
})(typeof window !== 'undefined' ? window : globalThis);
