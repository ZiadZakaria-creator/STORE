/* core.js — namespace مشترك وأدوات عامة. لازم يتحمّل قبل أي ملف تاني. */
(function (root) {
  'use strict';
  const App = root.App || (root.App = {});

  /* ---------- localStorage آمن (ممكن يكون مقفول في وضع التصفح الخفي) ---------- */
  const PREFIX = 'cs:';
  App.store = {
    get(key, fallback = null) {
      try {
        const raw = root.localStorage.getItem(PREFIX + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { root.localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    },
    remove(key) {
      try { root.localStorage.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    },
    keys() {
      try { return Object.keys(root.localStorage).filter(k => k.startsWith(PREFIX)).map(k => k.slice(PREFIX.length)); }
      catch (e) { return []; }
    }
  };

  /* ---------- DOM ---------- */
  App.$ = (sel, el = root.document) => el.querySelector(sel);
  App.$$ = (sel, el = root.document) => Array.from(el.querySelectorAll(sel));

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  App.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ESC[c]);

  /* بيبني عنصر: h('a', {href, class, onclick}, [children]) — النصوص بتتحط كـ textContent فمفيش XSS */
  App.h = function h(tag, attrs, children) {
    const el = root.document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v; // للـ SVG الثابت بتاعنا بس
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const c of [].concat(children == null ? [] : children)) {
      if (c == null || c === false) continue;
      el.append(c instanceof root.Node ? c : root.document.createTextNode(String(c)));
    }
    return el;
  };

  /* ---------- أدوات ---------- */
  App.debounce = (fn, ms = 250) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };
  App.sleep = ms => new Promise(r => setTimeout(r, ms));
  App.clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));

  const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // من غير 0/O و 1/I علشان متتلخبطش
  App.randomId = (len = 20, alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') => {
    const bytes = new Uint8Array(len);
    root.crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
  };
  App.readableCode = (len = 5) => App.randomId(len, ALPHA);

  App.slugify = s => String(s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  App.nowISO = () => new Date().toISOString();

  /* ---------- event bus بسيط ---------- */
  const handlers = {};
  App.on = (name, fn) => { (handlers[name] || (handlers[name] = [])).push(fn); return () => App.off(name, fn); };
  App.off = (name, fn) => { handlers[name] = (handlers[name] || []).filter(f => f !== fn); };
  App.emit = (name, data) => { (handlers[name] || []).slice().forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); };

  App.ready = fn => {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', fn, { once: true });
    else fn();
  };
})(typeof window !== 'undefined' ? window : globalThis);
