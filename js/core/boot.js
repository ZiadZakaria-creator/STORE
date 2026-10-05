/* boot.js — بيتحمّل في <head> قبل الرسم: بيحط اللغة والاتجاه والثيم علشان الصفحة متتهزش. */
(function () {
  'use strict';
  var lang = 'ar', theme = '';
  try {
    lang = JSON.parse(localStorage.getItem('cs:lang')) || 'ar';
    theme = JSON.parse(localStorage.getItem('cs:theme')) || '';
  } catch (e) { /* ignore */ }
  var html = document.documentElement;
  html.lang = lang === 'en' ? 'en' : 'ar';
  html.dir = lang === 'en' ? 'ltr' : 'rtl';
  if (theme === 'dark' || theme === 'light') html.setAttribute('data-theme', theme);
})();
