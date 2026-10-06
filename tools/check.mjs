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
const htmlPages = [...readdirSync(ROOT).filter(n => n.endsWith('.html')), 'admin/index.html'];
for (const page of htmlPages) {
  const html = readFileSync(join(ROOT, page), 'utf8');
  const dir = join(ROOT, page, '..');
  for (const m of html.matchAll(/(?:src|href)="([^"#?]+)"/g)) {
    const ref = m[1];
    if (/^(https?:|mailto:|data:)/.test(ref) || ref === '/') continue;
    if (/\.(js|css|svg|webmanifest|png)$/.test(ref)) ok(existsSync(join(dir, ref)), `${page}: missing ${ref}`);
  }
  ok(!/<script>[\s\S]*?<\/script>/.test(html), `${page}: inline <script> breaks CSP`);
}
ok(/noindex/.test(readFileSync(join(ROOT, 'admin/index.html'), 'utf8')), 'admin has noindex');
for (const page of readdirSync(ROOT).filter(n => n.endsWith('.html'))) ok(!/admin\//.test(readFileSync(join(ROOT, page), 'utf8')), `${page}: no link to admin`);

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
  const ctx = { console, crypto: webcrypto, TextEncoder, localStorage: lsProxy, Intl, setTimeout, clearTimeout, URL, fetch: undefined };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}
function load(ctx, rel) { vm.runInContext(readFileSync(join(ROOT, rel), 'utf8'), ctx, { filename: rel }); }

// firebase-config.js لازم يبقى null أو فيه apiKey و projectId
{
  const c = makeContext();
  load(c, 'firebase-config.js');
  const fb = c.FIREBASE_CONFIG;
  ok(fb === null || (typeof fb.apiKey === 'string' && typeof fb.projectId === 'string' && !fb.emulators), 'firebase-config.js valid (and no emulators in repo)');
}

// الاختبارات بتشتغل على الوضع التجريبي دايماً، أياً كان firebase-config.js
const ctx = makeContext();
ctx.FIREBASE_CONFIG = null;
['js/core/core.js', 'js/core/config.js', 'js/core/i18n.js', 'js/core/money.js', 'js/core/validate.js',
  'js/core/db.js', 'js/core/db-demo.js', 'js/core/db-firebase.js', 'js/core/auth.js', 'data/demo-data.js',
  'js/services/governorates.js', 'js/services/settings.js', 'js/services/catalog.js', 'js/services/storefront.js', 'js/services/images.js',
  'js/services/addresses.js', 'js/services/coupons.js', 'js/services/shipping.js', 'js/services/audit.js', 'js/services/catalog-admin.js', 'js/services/settings-admin.js'
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

/* ---------- الدخول (وضع تجريبي) ---------- */
const A = App.auth;
eq(await A.init(), null, 'auth: signed out at start');
const rejects = async (fn, code, msg) => { try { await fn(); ok(false, msg + ' (no error)'); } catch (e) { eq(e.code || e.message, code, msg); } };
await rejects(() => A.register({ name: 'Ali', email: 'bad', phone: '01012345678', password: '12345678' }), 'auth/invalid-email', 'register bad email');
await rejects(() => A.register({ name: 'Ali', email: 'ali@test.com', phone: '01012345678', password: '123' }), 'auth/weak-password', 'register weak pw');
await rejects(() => A.register({ name: '', email: 'ali@test.com', phone: '01012345678', password: '12345678' }), 'auth/invalid-name', 'register no name');
const u = await A.register({ name: 'Ali', email: 'Ali@Test.com', phone: '+201012345678', password: '12345678' });
eq([u.email, u.name, u.phone], ['ali@test.com', 'Ali', '01012345678'], 'register creates normalized profile');
const accounts = App.store.get('auth:demoAccounts');
ok(accounts['ali@test.com'].hash && !JSON.stringify(accounts).includes('12345678'), 'password stored hashed, not plain');
await rejects(() => A.register({ name: 'Ali', email: 'ali@test.com', phone: '01012345678', password: '12345678' }), 'auth/email-already-in-use', 'register duplicate');
await A.logout();
eq(A.user, null, 'logout');
await rejects(() => A.login('ali@test.com', 'wrongpass'), 'auth/invalid-credential', 'login wrong password');
await A.login('ali@test.com', '12345678');
eq(A.user && A.user.email, 'ali@test.com', 'login ok');
await rejects(() => A.changePassword('nope', 'abcdefgh'), 'auth/invalid-credential', 'change pw wrong current');
await A.changePassword('12345678', 'abcdefgh');
await A.logout();
await rejects(() => A.login('ali@test.com', '12345678'), 'auth/invalid-credential', 'old pw rejected');
await A.login('ali@test.com', 'abcdefgh');
await A.updateProfile({ name: 'Ali Hassan', phone: '01112345678' });
eq([A.user.name, A.user.phone], ['Ali Hassan', '01112345678'], 'update profile');
await A.loginGoogle();
ok(A.needsPhone(), 'google user needs phone');

// العناوين
const aUid = A.user.uid;
const addr = { name: 'Ali', phone: '01012345678', governorate: 'cairo', city: 'Nasr City', area: 'Zone 8', street: 'Abbas El Akkad', building: '12' };
eq(Object.keys(App.addresses.validate(addr)), [], 'address valid');
eq(Object.keys(App.addresses.validate({ ...addr, phone: '123', governorate: 'mars' })).sort(), ['governorate', 'phone'], 'address invalid fields');
const a1 = await App.addresses.save(aUid, addr);
const a2 = await App.addresses.save(aUid, { ...addr, label: 'Work' });
let alist = await App.addresses.list(aUid);
eq(alist.map(x => [x.id, !!x.isDefault]), [[a1, true], [a2, false]], 'first address is default');
await App.addresses.setDefault(aUid, a2);
alist = await App.addresses.list(aUid);
eq(alist[0].id, a2, 'setDefault moves default first');
await App.addresses.remove(aUid, a2);
alist = await App.addresses.list(aUid);
eq(alist.map(x => [x.id, !!x.isDefault]), [[a1, true]], 'removing default promotes next');

// الأدمن والصلاحيات
await A.demoAdmin('customer_support');
await A.loadAdmin();
ok(App.can('orders.write') && !App.can('staff.manage') && !App.can('products.write'), 'RBAC: customer support perms');
await A.demoAdmin('super_admin');
await A.loadAdmin();
ok(App.can('staff.manage') && App.can('anything.at.all'), 'RBAC: super admin all');
await App.db.update('admins', A.user.uid, { active: false });
eq(await A.loadAdmin(), null, 'inactive admin denied');
await App.db.update('admins', A.user.uid, { active: true });
await A.loadAdmin();
await App.audit.log({ action: 'test', entity: 'roles', entityId: 'x', before: { a: 1 }, after: { a: 2 }, summary: 's' });
const logs = await App.db.list('auditLogs');
eq(logs.map(l => [l.by, l.action, l.after.a]), [[A.user.uid, 'test', 2]], 'audit log written');
await A.logout();
eq([A.user, A.admin, App.can('staff.manage')], [null, null, false], 'logout clears admin');

/* ---------- المرحلة ٣: الكتالوج والمخزون والإعدادات ---------- */
await A.demoAdmin('super_admin'); await A.loadAdmin();
const sampleProduct = App.clone(prods[0]);
const created = {...sampleProduct,id:undefined,slug:'stage-three-test',sku:'STAGE-THREE',name:{ar:'منتج اختبار',en:'Test'},variants:[{...sampleProduct.variants[0],sku:'STAGE-THREE-BLK-M',stock:4,reserved:0,sold:0}],ratingCount:0,ratingAvg:0,soldCount:0};
const pid = await App.catalogAdmin.saveProduct(created);
let saved = await App.db.get('products',pid);
eq([saved.ratingCount,saved.ratingAvg,saved.soldCount],[0,0,0],'new products do not inherit fake sales or reviews');
eq(saved.variants[0].stock,4,'save product stock');
const rejectMessage = async (fn, re, label) => { try { await fn(); ok(false,label); } catch(e) { ok(re.test(e.message),label+': '+e.message); } };
await rejectMessage(()=>App.catalogAdmin.saveProduct({...created,sku:'OTHER'}),/مستخدم/,'duplicate slug rejected');
await rejectMessage(()=>App.catalogAdmin.saveProduct({...created,slug:'another-product',sku:'OTHER'}),/مستخدم/,'duplicate variant SKU rejected');
await rejectMessage(()=>App.catalogAdmin.saveProduct({...saved,salePrice:saved.price+1}),/سعر/,'invalid discount rejected');
await App.catalogAdmin.setStock(pid,saved.variants[0].sku,8,'جرد اختبار',4);
await rejectMessage(()=>App.catalogAdmin.setStock(pid,saved.variants[0].sku,10,'جرد قديم',4),/اتغير/,'stale stock rejected');
await rejectMessage(()=>App.catalogAdmin.saveProduct({...saved,name:{ar:'تعديل قديم',en:''}}),/اتغيرت/,'stale product editor rejected');
saved = await App.db.get('products',pid);
await App.catalogAdmin.saveProduct({...saved,hidden:true});
ok(!App.catalog.products.some(p=>p.id===pid),'hidden product excluded from storefront cache');
const copyId=await App.catalogAdmin.duplicateProduct(pid);
const copied=await App.db.get('products',copyId);
eq([copied.hidden,copied.variants[0].stock,copied.variants[0].reserved,copied.variants[0].sold],[true,0,0,0],'duplicate starts hidden with no inventory or sales');
await App.catalogAdmin.removeProduct(copyId);
const same=await Promise.allSettled([0,1].map(()=>App.catalogAdmin.saveProduct({...created,slug:'parallel-product',sku:'PARALLEL',variants:[{...created.variants[0],sku:'PARALLEL-V'}]})));
eq(same.filter(r=>r.status==='fulfilled').length,1,'concurrent catalog writes cannot duplicate slug/SKU');
for(const r of same)if(r.status==='fulfilled')await App.catalogAdmin.removeProduct(r.value);
const c1=await App.catalogAdmin.saveMeta('categories',{name:{ar:'اختبار',en:'Test'},slug:'test-cat'});
const c2=await App.catalogAdmin.saveMeta('categories',{name:{ar:'فرعي',en:'Sub'},slug:'test-sub',parentId:c1});
await rejectMessage(async()=>App.catalogAdmin.saveMeta('categories',{...(await App.db.get('categories',c1)),parentId:c2}),/تابع لنفسه/,'category cycle rejected');
await rejectMessage(()=>App.catalogAdmin.removeMeta('categories',c1),/فرعية/,'parent with children cannot be deleted');
await rejectMessage(()=>App.catalogAdmin.removeMeta('colors',sampleProduct.variants[0].color),/مستخدم/,'referenced color cannot be deleted');
await App.catalogAdmin.removeMeta('categories',c2); await App.catalogAdmin.removeMeta('categories',c1);
const oldSettings=App.clone(App.settings);
const settingInput={storeName:{ar:'متجر اختبار',en:'Test shop'},whatsapp:'+201012345678',lowStockThreshold:0,freeShippingOver:'',etaMin:2,etaMax:5,governorates:{cairo:{enabled:true,price:65}}};
await App.saveStoreSettings(settingInput);
eq([App.settings.general.whatsapp,App.settings.inventory.lowStockThreshold,App.settings.shipping.freeShippingOver],['201012345678',0,null],'settings normalize phone, preserve zero threshold and disabled free shipping');
eq(Object.values(App.settings.shipping.governorates).filter(g=>g.enabled).length,1,'only explicitly enabled governorates deliver');
await rejectMessage(()=>App.saveStoreSettings(settingInput),/اتغيرت/,'stale settings form rejected');
await rejectMessage(()=>App.saveStoreSettings({...settingInput,whatsapp:'123'}),/واتساب/,'invalid whatsapp rejected');
ok((await App.db.list('inventoryLogs')).some(l=>l.productId===pid&&l.delta.stock===4),'inventory movements persisted');
ok((await App.db.list('auditLogs')).some(l=>l.action==='settings.save'),'settings audit recorded');
await App.db.update('brands',saved.brandId,{demo:true});
await App.db.update('products',pid,{demo:false});
const demoBrand=saved.brandId;
await App.catalogAdmin.removeDemoCatalog();
ok(!!await App.db.get('products',pid),'demo cleanup preserves real products');
ok(!!await App.db.get('brands',demoBrand),'demo cleanup preserves brands referenced by real products');
const beforeSeed=await App.db.get('products',pid);
eq(await App.catalogAdmin.seedMissing('products',pid,{name:{ar:'replacement'}}),false,'setup never overwrites existing products');
eq((await App.db.get('products',pid)).name,beforeSeed.name,'existing product unchanged by setup');
await App.catalogAdmin.removeProduct(pid);
await A.logout();
await rejectMessage(()=>App.catalogAdmin.saveProduct(created),/للمدير العام/,'signed out catalog write denied');

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

/* ---------- المرحلة ٤: الفلاتر والتركيبات والمفضلة ---------- */
await App.catalog.refresh();
const C=App.catalog;
const fixture={id:'filter-test',categoryId:'men',subcategoryId:'men-tshirts',name:{ar:'أحمر قطن',en:'Red cotton'},sku:'FILTER',price:100,salePrice:80,variants:[{sku:'R-S',color:'RED',size:'S',stock:2,reserved:2,priceDelta:0},{sku:'B-M',color:'BLK',size:'M',stock:4,reserved:1,priceDelta:30}]};
eq(C.query({color:'RED',size:'M'},[fixture]).length,0,'color and size must match the same variant');
eq(C.query({color:'RED',stock:true},[fixture]).length,0,'reserved units are not available');
eq(C.query({color:'BLK',min:105,max:115,stock:true},[fixture]).length,1,'price filters include variant delta and sale price');
eq(C.query({max:100,color:'BLK'},[fixture]).length,0,'price cannot match a different color');
eq(C.query({q:'احمر قطن'},[fixture]).length,1,'Arabic search normalizes alef and combines terms');
eq(C.query({q:'COTTON'},[fixture]).length,1,'search is case insensitive across languages');
eq(C.query({cat:'missing'},[fixture]).length,0,'unknown category does not expose all products');
eq(C.priceRange(fixture),{min:80,max:110},'price range includes all variant deltas');
eq(C.paginate(Array.from({length:25},(_,i)=>i),99),{items:[24],page:3,pages:3,total:25},'pagination clamps oversized page');
eq(C.paginate([],0).page,1,'empty pagination remains valid');
const menCategory=await App.db.get('categories','men');
await App.db.update('categories','men',{hidden:true});await C.refresh();
ok(!C.categories.some(c=>c.parentId==='men')&&!C.products.some(p=>p.categoryId==='men'),'hidden category hides descendants and products');
await App.db.update('categories','men',{hidden:menCategory.hidden||false});await C.refresh();
load(ctx,'js/services/wishlist.js');
await App.wishlist.init();
await App.wishlist.set('guest-product',true);
eq(App.wishlist.ids,['guest-product'],'guest wishlist persists locally');
await A.register({name:'Wishlist Owner',email:'wish@test.com',phone:'01012345678',password:'password123'});await App.wishlist.init();
const wishUid=A.user.uid;
eq((await App.db.get('users',wishUid)).wishlist,['guest-product'],'guest wishlist merged on registration');
eq(App.store.get('wishlist:guest'),[],'merged guest IDs cleared to prevent account leakage');
await App.db.update('users',wishUid,{wishlist:['guest-product','other-tab']});
await App.wishlist.set('new-product',true);
eq((await App.db.get('users',wishUid)).wishlist,['guest-product','other-tab','new-product'],'wishlist update preserves another tab changes');
await App.wishlist.set('guest-product',false);
ok(!App.wishlist.has('guest-product'),'remove saved product');
const originalTx=App.db.tx,previousWishlist=App.wishlist.ids;
App.db.tx=async()=>{throw new Error('offline');};
await rejectMessage(()=>App.wishlist.set('failed-product',true),/offline/,'failed write is reported');
eq(App.wishlist.ids,previousWishlist,'failed write does not falsely update wishlist');App.db.tx=originalTx;
await A.logout();await App.wishlist.init();eq(App.wishlist.ids,[],'logout does not expose account wishlist');
await A.register({name:'Other Owner',email:'other-wish@test.com',phone:'01012345678',password:'password123'});await App.wishlist.init();
eq(App.wishlist.ids,[],'different account starts with its own wishlist');
await A.logout();await App.wishlist.init();
await A.login('wish@test.com','password123');await App.wishlist.init();
eq(App.wishlist.ids,previousWishlist,'wishlist restored on login');
await A.logout();await App.wishlist.init();

/* ---------- المرحلة ٥: سلة وكوبونات وشحن ---------- */
load(ctx,'js/services/cart.js');await App.cart.init();await App.catalog.refresh();
const cartProduct=App.catalog.products.find(p=>p.variants.some(v=>App.catalog.available(v)>2));
const cartVariant=cartProduct.variants.find(v=>App.catalog.available(v)>2);
await App.cart.add(cartProduct.id,cartVariant.sku,1);await App.cart.add(cartProduct.id,cartVariant.sku,1);
eq(App.cart.state.items.length,1,'same variant combines into one cart line');eq(App.cart.count,2,'cart combines quantities');
await rejectMessage(()=>App.cart.add(cartProduct.id,cartVariant.sku,100000),/الكمية|كمية/,'cart quantity bounded');
await rejectMessage(()=>App.cart.setQuantity(cartProduct.id,cartVariant.sku,App.catalog.available(cartVariant)+1),/المخزون/,'cart cannot exceed available stock');
await rejectMessage(()=>App.cart.setQuantity(cartProduct.id,cartVariant.sku,1.5),/كمية/,'cart rejects fractional quantity');
await App.db.set('coupons','TEST10',{type:'percent',value:10,minOrder:0,maxDiscount:30,startsAt:'2020-01-01',expiresAt:'2099-01-01',active:true,usedCount:0,usageLimit:10,perCustomerLimit:null,allowedUids:[]});
eq((await App.coupons.check('test10',{subtotal:500})).discount,30,'percent coupon honors max discount');
await App.db.set('coupons','FIXED',{type:'fixed',value:1000,active:true});eq((await App.coupons.check('FIXED',{subtotal:50})).discount,50,'fixed coupon never makes subtotal negative');
await App.db.set('coupons','EXPIRED',{type:'fixed',value:10,active:true,expiresAt:'2020-01-01'});await rejectMessage(()=>App.coupons.check('EXPIRED',{subtotal:50}),/انتهت/,'expired coupon rejected');
await App.db.set('coupons','USED',{type:'fixed',value:10,active:true,usageLimit:1,usedCount:1});await rejectMessage(()=>App.coupons.check('USED',{subtotal:50}),/الاستخدام/,'exhausted coupon rejected');
await App.db.set('coupons','PERSONAL',{type:'fixed',value:10,active:true,perCustomerLimit:1});await rejectMessage(()=>App.coupons.check('PERSONAL',{subtotal:50}),/سجل دخول/,'per-customer coupon requires login');
const shippingFixture={governorates:{cairo:{enabled:true,price:70},giza:{enabled:false,price:30}},freeShippingOver:100,etaDays:{min:2,max:4}};
eq(App.shipping.quote({governorate:'giza',subtotal:500},shippingFixture).available,false,'disabled governorate never eligible for free shipping');
eq(App.shipping.quote({governorate:'unknown',subtotal:500},shippingFixture).available,false,'unknown governorate rejected');
eq(App.shipping.quote({governorate:'cairo',subtotal:110,afterCoupon:90},shippingFixture).price,70,'free shipping evaluated after coupon by default');
eq(App.shipping.quote({governorate:'cairo',subtotal:110,afterCoupon:90},{...shippingFixture,freeShippingBasis:'beforeCoupon'}).price,0,'owner can choose before-coupon free shipping');
eq(App.shipping.quote({governorate:'cairo',subtotal:50},{...shippingFixture,freeShippingOver:null}).price,70,'null threshold disables free shipping');
eq(App.shipping.quote({governorate:'cairo',subtotal:50},{...shippingFixture,freeShippingOver:0}).price,0,'zero threshold preserved');
await App.cart.setCoupon('TEST10');await A.login('wish@test.com','password123');await App.cart.init();
const cartUid=A.user.uid;eq((await App.db.get('carts',cartUid)).items[0],cartProduct.id+':'+cartVariant.sku+':2','guest cart merges into account');eq(App.store.get('cart:guest'),null,'merged guest cart cleared');
await App.db.update('carts',cartUid,{items:[cartProduct.id+':'+cartVariant.sku+':1']});
await App.cart.add(cartProduct.id,cartVariant.sku,1);eq(App.cart.count,2,'cart mutation reads latest quantity from other tab');
await App.db.set('users/'+cartUid+'/couponUsage','PERSONAL',{count:1});await rejectMessage(()=>App.coupons.check('PERSONAL',{subtotal:50}),/الاستخدام/,'per-customer usage limit checked');
const savedCart=App.cart.state,realTx=App.db.tx;App.db.tx=async()=>{throw new Error('offline');};
await rejectMessage(()=>App.cart.remove(cartProduct.id,cartVariant.sku),/offline/,'failed remote cart removal reported');eq(App.cart.state,savedCart,'failed cart write does not show false success');App.db.tx=realTx;
await A.logout();await App.cart.init();eq(App.cart.count,0,'logout hides account cart');await A.login('wish@test.com','password123');await App.cart.init();eq(App.cart.count,2,'account cart restored');
const originalProduct=await App.db.get('products',cartProduct.id);await App.db.update('products',cartProduct.id,{hidden:true});await App.catalog.refresh();ok(!!App.cart.lines()[0].issue,'hidden product flagged in saved cart');
await App.db.update('products',cartProduct.id,{hidden:originalProduct.hidden||false});await App.catalog.refresh();
await App.cart.clear();await A.logout();await App.cart.init();

/* ---------- النتيجة ---------- */
console.log(`checks: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
