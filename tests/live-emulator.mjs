// live-emulator.mjs — بيجرب الموقع في وضع Firebase الحقيقي (مش الوضع التجريبي) على Firebase Emulator.
// المتطلبات (برّه الموقع): firebase-tools و playwright، وملفات Firebase SDK 10.14.1 في SDK_DIR.
// التشغيل:
//   python3 -m http.server 8080 &
//   SDK_DIR=/path/to/sdk npx firebase emulators:exec --project demo-store --only firestore,auth "node tests/live-emulator.mjs"
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const SDK_DIR = process.env.SDK_DIR;
const PROJECT = 'demo-store';
const FS = 'http://127.0.0.1:8085';
const AUTH = 'http://127.0.0.1:9099';
const OUT = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const CONFIG = `window.FIREBASE_CONFIG = ${JSON.stringify({
  apiKey: 'demo-key', authDomain: 'localhost', projectId: PROJECT, appId: 'demo-app',
  emulators: { firestore: '127.0.0.1:8085', auth: AUTH }
})};`;

/* REST على الـ Emulator بصلاحية "owner" (بيتخطى الـ rules) — بيمثل اللي بتعمله من Firebase Console */
const docUrl = path => `${FS}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
async function consoleGet(path) { const r = await fetch(docUrl(path), { headers: owner }); return r.ok ? r.json() : null; }
async function consoleList(path) { const r = await fetch(docUrl(path) + '?pageSize=300', { headers: owner }); const j = await r.json(); return j.documents || []; }
async function consoleSet(path, fields) {
  const enc = v => typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) };
  const body = { fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, enc(v)])) };
  const r = await fetch(docUrl(path), { method: 'PATCH', headers: owner, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('consoleSet ' + (await r.text()));
}
async function uidOf(email) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`, { method: 'POST', headers: owner, body: JSON.stringify({}) });
  const j = await r.json();
  const u = (j.userInfo || []).find(x => x.email === email);
  return u && u.localId;
}

// الصفحة بتكلم الـ Emulator على 127.0.0.1، فبنقفل حماية الشبكة المحلية في Chrome للاختبار ده بس
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'] });
let passed = 0, failed = 0;
const errorsByPage = [];
const pages = [];

async function newPage(viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, serviceWorkers: 'block' });
  // SDK من نسخة محلية، و config بتاع الـ Emulator، وشيل CSP علشان يتوصل بـ 127.0.0.1
  await ctx.route('https://www.gstatic.com/firebasejs/**', route => {
    const name = route.request().url().split('/').pop();
    route.fulfill({ contentType: 'text/javascript', body: readFileSync(`${SDK_DIR}/${name}`) });
  });
  await ctx.route('**/fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
  await ctx.route(/\/firebase-config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: CONFIG }));
  await ctx.route(/\.html(\?.*)?$|\/admin\/$/, async route => {
    const res = await route.fetch();
    const body = (await res.text()).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
    route.fulfill({ response: res, body });
  });
  const page = await ctx.newPage();
  pages.push(page);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if(process.env.DEBUG)page.on('response',r=>{if(r.status()===403){const u=new URL(r.url());console.log('DEBUG 403 '+u.origin+u.pathname);}});
  page.on('requestfailed', r => errors.push('requestfailed ' + r.url() + ' ' + (r.failure() || {}).errorText));
  page.on('console', m => { if (m.type() === 'error' && !/PERMISSION_DENIED.*admins|favicon/.test(m.text())) errors.push(m.text()); });
  errorsByPage.push(errors);
  return { ctx, page, errors };
}

async function step(name, fn) {
  try { await fn(); passed++; console.log('✓ ' + name); }
  catch (e) {
    failed++; console.error('✗ ' + name + '\n   ' + (e.message || e).split('\n')[0]);
    if (process.env.DEBUG) {
      for (const errs of errorsByPage) if (errs.length) console.error('   page errors: ' + errs.filter(x => !/ERR_ABORTED|404/.test(x)).slice(-3).join(' | '));
      for (const [i, pg] of pages.entries()) await pg.screenshot({ path: `${OUT}fail-${name.slice(0, 20).replace(/\W+/g, '_')}-${i}.png` }).catch(() => {});
    }
  }
}

/* ============ 1) المتجر في وضع Firebase ============ */
const A = await newPage();
await step('home loads in live mode (no demo strip)', async () => {
  await A.page.goto(BASE + 'index.html');
  await A.page.waitForSelector('.site-header .logo');
  await A.page.waitForTimeout(800);
  if (await A.page.$('.demo-strip')) throw new Error('demo strip visible in live mode');
});

/* ============ 2) تسجيل صاحب المتجر ============ */
await step('owner registers (Firebase Auth + users/{uid})', async () => {
  const p = A.page;
  await p.goto(BASE + 'account.html');
  await p.click('.tabs .tab:nth-child(2)');
  await p.fill('[name=name]', 'Store Owner');
  await p.fill('[name=email]', 'owner@shop.test');
  await p.fill('[name=phone]', '01012345678');
  await p.fill('[name=password]', 'ownerpass1');
  await p.click('button[type=submit]');
  await p.waitForSelector('.account-head', { timeout: 15000 });
  const uid = await uidOf('owner@shop.test');
  const prof = await consoleGet('users/' + uid);
  if (!prof || prof.fields.phone.stringValue !== '01012345678') throw new Error('profile not saved in Firestore');
});

await step('customer cannot open admin before being made admin', async () => {
  await A.page.goto(BASE + 'admin/index.html');
  await A.page.waitForSelector('text=مش عنده صلاحية', { timeout: 15000 });
});

/* ============ 3) أول مدير عام (زي الخطوة اليدوية في Console) ============ */
const ownerUid = await uidOf('owner@shop.test');
await consoleSet('admins/' + ownerUid, { name: 'Store Owner', email: 'owner@shop.test', role: 'super_admin', active: true });

await step('super admin opens admin and seeds the store', async () => {
  const p = A.page;
  await p.goto(BASE + 'admin/index.html#/setup');
  await p.reload();
  await p.waitForSelector('text=جهّز البيانات الناقصة', { timeout: 15000 });
  await p.click('text=جهّز البيانات الناقصة');
  await p.waitForSelector('.toast', { timeout: 20000 });
  await p.waitForFunction(() => !document.querySelector('.chip.off'), null, { timeout: 15000 });
  const roles = await consoleList('roles');
  const cats = await consoleList('categories');
  const settings = await consoleList('settings');
  if (roles.length !== 5 || cats.length < 20 || settings.length !== 3) throw new Error(`seed counts roles=${roles.length} cats=${cats.length} settings=${settings.length}`);
  await p.screenshot({ path: OUT + 'live-admin-setup.png', fullPage: true });
});

await step('seeding is idempotent (button disabled when nothing missing)', async () => {
  await A.page.goto(BASE + 'admin/index.html#/setup');
  await A.page.waitForSelector('text=جهّز البيانات الناقصة');
  if (!(await A.page.isDisabled('text=جهّز البيانات الناقصة'))) throw new Error('button should be disabled');
});

await step('store shows categories read from Firestore REST', async () => {
  await A.page.goto(BASE + 'index.html');
  await A.page.waitForSelector('.cat-tile', { timeout: 15000 });
  const n = await A.page.$$eval('.cat-tile', x => x.length);
  if (n !== 5) throw new Error('expected 5 top categories, got ' + n);
  await A.page.screenshot({ path: OUT + 'live-home.png', fullPage: true });
});

await step('demo products: add (visible in store) then remove', async () => {
  const p = A.page;
  await p.goto(BASE + 'admin/index.html#/setup');
  await p.reload();
  await p.waitForSelector('text=ضيف منتجات تجريبية', { timeout: 15000 });
  await p.click('text=ضيف منتجات تجريبية');
  await p.waitForSelector('text=اتضاف 16', { timeout: 30000 });
  const prods = await consoleList('products');
  if (prods.length !== 12 || !prods.every(d => d.fields.demo.booleanValue && d.fields.soldCount.integerValue === '0')) throw new Error('demo products not stored correctly');
  await p.goto(BASE + 'index.html');
  await p.waitForSelector('.card', { timeout: 15000 });
  await p.screenshot({ path: OUT + 'live-home-demo-products.png', fullPage: true });
  await p.goto(BASE + 'admin/index.html#/setup');
  await p.reload();
  await p.click('text=امسح المنتجات التجريبية');
  await p.click('.modal-foot .btn-primary');
  await p.waitForSelector('text=اتمسح 16', { timeout: 30000 });
  if ((await consoleList('products')).length !== 0 || (await consoleList('brands')).length !== 0) throw new Error('demo not removed');
});

/* ============ 4) عميل تاني ← موظف ============ */
const B = await newPage({ width: 1440, height: 900 });
await step('second user registers and adds an address', async () => {
  const p = B.page;
  await p.goto(BASE + 'account.html');
  await p.click('.tabs .tab:nth-child(2)');
  await p.fill('[name=name]', 'Sara Support');
  await p.fill('[name=email]', 'sara@shop.test');
  await p.fill('[name=phone]', '01112345678');
  await p.fill('[name=password]', 'sarapass12');
  await p.click('button[type=submit]');
  await p.waitForSelector('.account-head', { timeout: 15000 });
  await p.click('a[href="#addresses"]');
  await p.click('text=إضافة عنوان');
  await p.selectOption('[name=governorate]', 'alexandria');
  for (const [k, v] of [['city', 'Sidi Gaber'], ['area', 'Sporting'], ['street', 'Port Said St'], ['building', '20']]) await p.fill(`[name=${k}]`, v);
  await p.click('form.panel button[type=submit]');
  await p.waitForSelector('.address-card.is-default', { timeout: 15000 });
  const uid = await uidOf('sara@shop.test');
  if ((await consoleList(`users/${uid}/addresses`)).length !== 1) throw new Error('address not in Firestore');
});

await step('profile update and password change', async () => {
  const p = B.page;
  await p.click('a[href="#profile"]');
  await p.fill('[name=name]', 'Sara S.');
  await p.click('button[type=submit]');
  await p.waitForSelector('.toast', { timeout: 15000 });
  await p.click('a[href="#security"]');
  await p.fill('[name=current]', 'sarapass12');
  await p.fill('[name=next]', 'sarapass34');
  await p.click('button[type=submit]');
  await p.waitForSelector('text=الباسورد اتغير', { timeout: 15000 });
});

await step('single-owner admin has no staff controls', async () => {
  const p=A.page; await p.goto(BASE+'admin/index.html');await p.waitForSelector('.side-nav',{state:'attached'});
  if(await p.$('a[data-route="staff"]'))throw new Error('Staff controls are visible');
  await B.page.goto(BASE+'admin/index.html');await B.page.waitForSelector('text=مش عنده صلاحية');
});

await step('Firestore catalog transaction, image upload, stock audit and settings', async () => {
  const p=A.page;await p.goto(BASE+'admin/index.html#/products');await p.waitForSelector('text=إضافة منتج');
  const result=await p.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=120;canvas.height=160;canvas.getContext('2d').fillRect(0,0,120,160);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    const image=await App.img.upload(new File([blob],'test.png',{type:'image/png'}));
    const sample=App.clone(App.demoData.products[0]);
    const product={...sample,id:undefined,brandId:'',slug:'live-stage3-shirt',sku:'LIVE-STAGE3',images:[image],variants:[{...sample.variants[0],sku:'LIVE-STAGE3-V',stock:6,reserved:0,sold:0}]};
    const id=await App.catalogAdmin.saveProduct(product);
    await App.catalogAdmin.setStock(id,'LIVE-STAGE3-V',9,'جرد على المحاكي',6);
    let staleRejected=false;
    try{await App.catalogAdmin.setStock(id,'LIVE-STAGE3-V',2,'جرد قديم',6);}catch(e){staleRejected=/اتغير/.test(e.message);}
    const row=await App.db.get('products',id);
    const logs=await App.db.list('inventoryLogs');
    await App.loadSettings(true);
    const settings=App.settings;
    await App.saveStoreSettings({storeName:{ar:'متجر المحاكي',en:'Emulated store'},whatsapp:'01012345678',lowStockThreshold:0,freeShippingOver:'',etaMin:2,etaMax:4,governorates:{cairo:{enabled:true,price:80}},revisions:Object.fromEntries(['general','shipping','inventory'].map(k=>[k,settings[k]?.revision||0]))});
    return {stock:row.variants[0].stock,staleRejected,logs:logs.filter(log=>log.productId===id).length,threshold:App.settings.inventory.lowStockThreshold,image};
  });
  if(result.stock!==9||!result.staleRejected||result.logs!==2||result.threshold!==0||!result.image.startsWith('fs:'))throw new Error(JSON.stringify(result));
  await p.goto(BASE+'admin/index.html#/inventory');await p.waitForSelector('text=LIVE-STAGE3-V');
  await p.screenshot({path:OUT+'live-stage3-inventory.png',fullPage:true});
});

await step('storefront product and wishlist persist with Firebase rules', async () => {
  const p=B.page;
  await p.goto(BASE+'shop.html?q=LIVE-STAGE3');await p.waitForFunction(()=>window.App?.catalog?.loadedAt);
  await p.evaluate(()=>App.catalog.refresh());await p.waitForSelector('.shop-results .card');
  await p.click('.card-title a');await p.waitForSelector('.product-layout');
  await p.locator('[data-color]:not([disabled])').first().click();await p.locator('[data-size]:not([disabled])').first().click();
  if(!(await p.textContent('.product-stock')).includes('9'))throw new Error('Live stock mismatch');
  await p.click('.product-actions [data-wish]');await p.waitForSelector('.product-actions [aria-pressed="true"]');
  const uid=await uidOf('sara@shop.test');
  const profile=await consoleGet('users/'+uid);
  if(profile.fields.wishlist.arrayValue.values.length!==1)throw new Error('Wishlist was not saved in Firestore');
  await p.goto(BASE+'wishlist.html');await p.waitForSelector('.wishlist-grid .card');await p.reload();await p.waitForSelector('.wishlist-grid .card');
  await p.screenshot({path:OUT+'live-stage4-wishlist.png',fullPage:true});
  await p.click('.wishlist-grid [data-wish]');await p.waitForSelector('.empty');
  const after=await consoleGet('users/'+uid);
  if(after.fields.wishlist.arrayValue.values?.length)throw new Error('Wishlist removal was not persisted');
});

await step('Firebase cart, coupon, shipping and checkout review', async () => {
  await A.page.evaluate(()=>App.db.set('coupons','LIVE10',{type:'percent',value:10,minOrder:0,active:true,usedCount:0,usageLimit:10}));
  const p=B.page;
  await p.goto(BASE+'product.html?slug=live-stage3-shirt');await p.waitForSelector('.product-layout');
  await p.locator('[data-color]:not([disabled])').first().click();await p.locator('[data-size]:not([disabled])').first().click();
  await p.fill('.product-quantity','2');await p.click('.product-add');await p.waitForSelector('#cart-drawer.open');
  await p.click('#cart-drawer a[href="cart.html"]');await p.waitForSelector('.cart-line');await p.reload();await p.waitForSelector('.cart-line');
  if(await p.inputValue('.cart-quantity')!=='2')throw new Error('Firebase cart quantity did not persist');
  await p.selectOption('[name=governorate]','cairo');
  await p.fill('[name=coupon]','LIVE10');await p.click('.coupon-form [type=submit]');await p.waitForFunction(()=>App.cart.state.couponCode==='LIVE10');
  await p.waitForSelector('a[href^="checkout.html"]');await p.click('a[href^="checkout.html"]');await p.waitForSelector('.checkout-form');
  for(const [field,value] of Object.entries({name:'Sara Customer',phone:'01012345678',city:'Cairo',area:'Nasr City',street:'Test Street',building:'12'}))await p.fill('.checkout-form [name='+field+']',value);
  await p.selectOption('.checkout-form [name=governorate]','cairo');await p.click('.checkout-form [type=submit]');await p.waitForSelector('.checkout-review h2');
  const result=await p.evaluate(async()=>({cart:await App.db.get('carts',App.auth.user.uid),coupon:await App.db.get('coupons','LIVE10')}));
  if(result.cart.items.length!==1||result.coupon.usedCount!==0)throw new Error('Review mutated coupon usage or lost cart');
  if((await consoleList('orders')).length)throw new Error('Review created orders prematurely');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:OUT+'live-stage5-checkout.png',fullPage:true});
});

await step('Excel bulk import transaction at 50 products / 150 variants', async () => {
  const p=A.page;await p.goto(BASE+'admin/index.html#/products');await p.waitForSelector('text=تصدير البضاعة');
  const result=await p.evaluate(async()=>{
    const source=(await App.catalogAdmin.load()).products.find(p=>p.sku==='LIVE-STAGE3');
    const combinations=App.demoData.products[0].variants.slice(0,3);
    const batch=Array.from({length:50},(_,i)=>({...source,id:undefined,revision:0,row:i+2,sku:'BULK-'+i,slug:'bulk-'+i,hidden:true,variants:combinations.map((v,j)=>({...v,sku:`BULK-${i}-${j}`,stock:3,reserved:0,sold:0}))}));
    const before=(await App.db.list('products')).length;
    await App.catalogAdmin.previewImport(batch);
    const previewCount=(await App.db.list('products')).length;
    const count=await App.catalogAdmin.importProducts(batch);
    const after=await App.db.list('products'), imported=after.filter(p=>p.sku.startsWith('BULK-'));
    const logs=(await App.db.list('inventoryLogs')).filter(l=>l.reason==='products.import');
    const audit=(await App.db.list('auditLogs')).filter(l=>l.action==='products.import');
    let rejected=false;try{await App.catalogAdmin.importProducts(batch);}catch(e){rejected=true;}
    return {before,previewCount,count,added:after.length-before,products:imported.length,logs:logs.length,audit:audit.length,rejected};
  });
  if(result.before!==result.previewCount||result.count!==50||result.added!==50||result.products!==50||result.logs!==150||result.audit!==1||!result.rejected)throw new Error(JSON.stringify(result));
});

await step('wrong password shows an error', async () => {
  const C = await newPage();
  await C.page.goto(BASE + 'account.html');
  await C.page.fill('[name=email]', 'owner@shop.test');
  await C.page.fill('[name=password]', 'nope-nope');
  await C.page.click('button[type=submit]');
  await C.page.waitForSelector('.alert-error', { timeout: 15000 });
  C.errors.length = 0; // رسالة الـ 400 من Auth متوقعة
  await C.ctx.close();
});

await step('forgot password sends reset email (emulator)', async () => {
  const C = await newPage();
  await C.page.goto(BASE + 'account.html');
  await C.page.click('text=نسيت الباسورد؟');
  await C.page.fill('[name=email]', 'owner@shop.test');
  await C.page.click('button[type=submit]');
  await C.page.waitForSelector('.alert-success', { timeout: 15000 });
  const r = await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const j = await r.json();
  if (!(j.oobCodes || []).some(c => c.email === 'owner@shop.test' && c.requestType === 'PASSWORD_RESET')) throw new Error('no reset email');
  await C.ctx.close();
});

const consoleErrors = errorsByPage.flat().filter(e => !/ERR_ABORTED|Failed to fetch/.test(e));
await step('no console errors', async () => { if (consoleErrors.length) throw new Error(consoleErrors.slice(0, 3).join(' | ')); });

await browser.close();
console.log(`live: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
