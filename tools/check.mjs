// check.mjs — فحص سريع قبل كل commit وفي الـ Action:
// 1) syntax لكل ملفات JS   2) كل ملف في sw.js موجود   3) اختبارات الـ services والبيانات التجريبية
// التشغيل: node tools/check.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

const ROOT = new URL('..', import.meta.url).pathname;
let failed = 0, passed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.error('  ✗ ' + msg); } };
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg}\n      expected ${JSON.stringify(b)}\n      got      ${JSON.stringify(a)}`);

/* ---------- 1) syntax ---------- */
const SKIP = new Set(['.git', 'node_modules', '_site', 'tests', 'docs']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(m?js)$/.test(name)) out.push(p);
  }
  return out;
}
const files = walk(ROOT);
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); passed++; }
  catch (e) { failed++; console.error(`  ✗ syntax ${relative(ROOT, f)}\n${e.stderr}`); }
}
console.log(`syntax: ${files.length} files`);

/* ---------- 2) sw.js CORE ---------- */
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const core = JSON.parse('[' + sw.match(/const CORE = \[([\s\S]*?)\];/)[1].replace(/'/g, '"') + ']');
for (const f of core) if (f !== './') ok(existsSync(join(ROOT, f)), `sw.js CORE file missing: ${f}`);
ok(/const VERSION = 'v\d+';/.test(sw), 'sw.js VERSION format');

/* كل <script src> و <link href> محلي في صفحات HTML موجود */
for (const page of readdirSync(ROOT).filter(n => n.endsWith('.html'))) {
  const html = readFileSync(join(ROOT, page), 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|data:)/.test(ref) || ref === '/') continue;
    if (/\.(js|css|svg|webmanifest|png)$/.test(ref)) ok(existsSync(join(ROOT, ref)), `${page}: missing ${ref}`);
  }
}

/* ---------- 3) unit tests ---------- */
function makeContext() {
  const mem = new Map();
  const localStorage = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k),
    key: i => [...mem.keys()][i],
    get length() { return mem.size; }
  };
  // Object.keys(localStorage) في المتصفح بيرجع المفاتيح
  const lsProxy = new Proxy(localStorage, { ownKeys: () => [...mem.keys()], getOwnPropertyDescriptor: (t, k) => (mem.has(k) ? { enumerable: true, configurable: true, value: mem.get(k) } : undefined) });
  const ctx = { console, crypto: webcrypto, localStorage: lsProxy, Intl, setTimeout, clearTimeout, URL, fetch: undefined };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}
function load(ctx, rel) { vm.runInContext(readFileSync(join(ROOT, rel), 'utf8'), ctx, { filename: rel }); }

const ctx = makeContext();
['firebase-config.js', 'js/core/core.js', 'js/core/config.js', 'js/core/i18n.js', 'js/core/money.js', 'js/core/validate.js',
  'js/core/db.js', 'js/core/db-demo.js', 'js/core/db-firebase.js', 'data/demo-data.js',
  'js/services/governorates.js', 'js/services/settings.js', 'js/services/catalog.js', 'js/services/images.js'
].forEach(f => load(ctx, f));
const App = ctx.App;

// config
eq(App.config.mode, 'demo', 'empty firebase-config → demo mode');

// money
eq(App.money.format(450), '450 ج.م', 'money ar whole');
eq(App.money.format(99.5), '99.50 ج.م', 'money ar decimals');
eq(App.money.round(0.1 + 0.2), 0.3, 'money round');
eq(App.money.percentOff(450, 380), 16, 'percentOff');
eq(App.money.percentOff(450, 500), 0, 'percentOff invalid sale');

// validate
ok(App.validate.phoneEG('01012345678'), 'phone valid');
ok(App.validate.phoneEG('+201112345678'), 'phone +20');
ok(App.validate.phoneEG('٠١٢١٢٣٤٥٦٧٨'), 'phone arabic digits');
ok(!App.validate.phoneEG('01312345678'), 'phone bad prefix');
ok(!App.validate.phoneEG('0101234567'), 'phone short');
ok(App.validate.email('a@b.co'), 'email ok');
ok(!App.validate.email('a@b'), 'email bad');
ok(App.validate.slug('black-oversized-tshirt'), 'slug ok');
ok(!App.validate.slug('Black Tee'), 'slug bad');

// i18n
eq(App.t('home.hero.delivery', { list: 'القاهرة' }), 'بنوصّل لـ: القاهرة', 't vars');
eq(App.tx({ ar: 'أ', en: 'A' }), 'أ', 'tx ar');
eq(App.t('missing.key'), 'missing.key', 't missing key');

// slug
eq(App.slugify('Black Oversized T-Shirt!'), 'black-oversized-t-shirt', 'slugify');

// demo db
await App.db.init();
const prods = await App.db.list('products');
ok(prods.length === App.demoData.products.length, 'demo seeded products');
const men = await App.db.list('products', { where: [['categoryId', '==', 'men']], orderBy: ['price', 'desc'] });
ok(men.length > 0 && men.every(p => p.categoryId === 'men'), 'where ==');
ok(men.every((p, i) => i === 0 || men[i - 1].price >= p.price), 'orderBy desc');
const page1 = await App.db.list('products', { orderBy: ['price', 'asc'], limit: 3 });
const page2 = await App.db.list('products', { orderBy: ['price', 'asc'], limit: 3, after: [page1[2].price] });
ok(page1.length === 3 && page2.every(p => p.price > page1[2].price), 'pagination after');
const inQ = await App.db.list('products', { where: [['brandId', 'in', ['stride', 'coastline']]] });
ok(inQ.length > 0 && inQ.every(p => ['stride', 'coastline'].includes(p.brandId)), 'where in');
const ac = await App.db.list('products', { where: [['colors', 'array-contains', 'OLV']] });
ok(ac.length >= 1 && ac.every(p => p.colors.includes('OLV')), 'array-contains');

const id = await App.db.add('orders', { total: 100, createdAt: App.db.now(), items: [] });
let o = await App.db.get('orders', id);
ok(o && o.id === id && typeof o.createdAt === 'string', 'add + now sentinel');
await App.db.update('orders', id, { total: App.db.inc(50), 'shipment.status': 'shipped', tags: App.db.arrayUnion('a', 'b') });
o = await App.db.get('orders', id);
eq([o.total, o.shipment.status, o.tags], [150, 'shipped', ['a', 'b']], 'update inc + dotted + union');
await App.db.update('orders', id, { tags: App.db.arrayRemove('a'), total: App.db.del() });
o = await App.db.get('orders', id);
eq([o.tags, 'total' in o], [['b'], false], 'arrayRemove + del');
let watched = null;
const unwatch = App.db.watch('orders', {}, docs => { watched = docs.length; });
await new Promise(r => setTimeout(r, 0));
eq(watched, 1, 'watch initial');
await App.db.add('orders', { total: 1 });
await new Promise(r => setTimeout(r, 0));
eq(watched, 2, 'watch on add');
unwatch();
const txRes = await App.db.tx(async t => {
  const d = await t.get('orders', id);
  t.update('orders', id, { n: (d.n || 0) + 1 });
  return 'done';
});
eq([txRes, (await App.db.get('orders', id)).n], ['done', 1], 'tx');
await App.db.remove('orders', id);
eq(await App.db.get('orders', id), null, 'remove');
let threw = false;
try { await App.db.update('orders', 'nope', { a: 1 }); } catch (e) { threw = true; }
ok(threw, 'update missing doc throws');

// firestore REST encode/decode
const F = App.FirebaseAdapter._test;
const sample = { a: 1, b: 1.5, c: 'x', d: true, e: null, f: [1, 'y'], g: { h: 2 } };
eq(Object.fromEntries(Object.entries(F.encode(sample).mapValue.fields).map(([k, v]) => [k, F.decode(v)])), sample, 'REST encode/decode roundtrip');
eq(F.decode({ timestampValue: '2025-01-02T03:04:05Z' }), '2025-01-02T03:04:05.000Z', 'REST timestamp');
const sq = F.structuredQuery('products', { where: [['categoryId', '==', 'men'], ['price', '<', 500]], orderBy: ['price', 'desc'], limit: 5 });
eq([sq.from[0].collectionId, sq.where.compositeFilter.filters.length, sq.orderBy[0].direction, sq.limit], ['products', 2, 'DESCENDING', 5], 'structuredQuery');

/* ---------- 4) سلامة البيانات التجريبية ---------- */
const D = App.demoData;
const ids = k => new Set(D[k].map(x => x.id));
const catIds = ids('categories'), colorIds = ids('colors'), sizeIds = ids('sizes'), brandIds = ids('brands');
for (const c of D.categories) ok(!c.parentId || catIds.has(c.parentId), `category ${c.id} parent exists`);
const skus = new Set();
for (const p of D.products) {
  ok(catIds.has(p.categoryId) && catIds.has(p.subcategoryId), `product ${p.id} categories exist`);
  ok(D.categories.find(c => c.id === p.subcategoryId).parentId === p.categoryId, `product ${p.id} subcategory under category`);
  ok(brandIds.has(p.brandId), `product ${p.id} brand exists`);
  ok(App.validate.slug(p.slug), `product ${p.id} slug valid`);
  ok(p.salePrice == null || p.salePrice < p.price, `product ${p.id} sale < price`);
  ok(p.variants.length === p.colors.length * p.sizes.length, `product ${p.id} variants = colors × sizes`);
  for (const v of p.variants) {
    ok(colorIds.has(v.color) && sizeIds.has(v.size), `variant ${v.sku} color/size exist`);
    ok(!skus.has(v.sku), `variant sku unique ${v.sku}`); skus.add(v.sku);
    ok(Number.isInteger(v.stock) && v.stock >= 0, `variant ${v.sku} stock int`);
  }
}
ok(D.products.some(p => p.variants.every(v => v.stock === 0)), 'demo has a sold-out product');
eq(App.governorates.length, 27, '27 governorates');

/* ---------- النتيجة ---------- */
console.log(`checks: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
