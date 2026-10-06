// smoke.mjs — بيفتح الصفحات على موبايل وديسكتوب، وبياخد screenshots، وبيفشل لو فيه أخطاء console.
// التشغيل: python3 -m http.server 8080 & ثم: NODE_PATH=$(npm root -g) node tests/smoke.mjs [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://localhost:8080/';
const OUT = new URL('./screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = { mobile: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
// [اسم, مسار, دالة تحقق]
const PAGES = [
  ['home', 'index.html', async p => {
    await p.waitForSelector('.card');
    const cards = await p.$$eval('.card', n => n.length);
    if (cards < 4) throw new Error('home: expected product cards, got ' + cards);
    const logo = await p.textContent('.site-header .logo');
    if (!logo.trim()) throw new Error('home: empty logo');
    if (!(await p.isVisible('.demo-strip'))) throw new Error('home: demo strip missing in demo mode');
  }],
  ['404', '404.html', async p => { await p.waitForSelector('.notfound h1'); }],
  ['account', 'account.html', async p => { await p.waitForSelector('.auth-panel form'); }],
  ['admin-gate', 'admin/index.html', async p => { await p.waitForSelector('.gate [data-role]'); }]
];

const executablePath = process.env.CHROMIUM_PATH || undefined;
const browser = await chromium.launch(executablePath ? { executablePath } : {});
let failures = 0;

async function run(name, path, check, vpName, opts = {}) {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: !!process.env.IGNORE_HTTPS_ERRORS, viewport: VIEWPORTS[vpName], colorScheme: opts.dark ? 'dark' : 'light', serviceWorkers: 'block' });
  // الاختبارات دي للوضع التجريبي، حتى لو الموقع متوصل بـ Firebase
  await ctx.route(/\/firebase-config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: 'window.FIREBASE_CONFIG = null;' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(`${m.text()} @ ${m.location().url || ''}`); });
  page.on('pageerror', e => errors.push(e.message));
  if (opts.lang) await page.addInitScript(l => localStorage.setItem('cs:lang', JSON.stringify(l)), opts.lang);
  await page.goto(BASE + path, { waitUntil: 'load' });
  try {
    await check(page);
    // مفيش scroll أفقي
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) {
      const wide = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 || e.getBoundingClientRect().left < -1).slice(0, 3).map(e => e.tagName + '.' + e.className));
      throw new Error(`horizontal overflow ${overflow}px: ${wide.join(', ')}`);
    }
  } catch (e) { errors.push(e.message); }
  // خطوط Google ممكن تتمنع في بيئة الاختبار، دي مش أخطاء في الموقع
  const real = errors.filter(e => !/fonts\.(googleapis|gstatic)\.com/.test(e));
  const tag = [name, vpName, opts.lang || 'ar', opts.dark ? 'dark' : ''].filter(Boolean).join('-');
  await page.screenshot({ path: `${OUT}${tag}.png`, fullPage: true });
  if (real.length) { failures++; console.error(`✗ ${tag}\n   ${real.join('\n   ')}`); }
  else console.log(`✓ ${tag}`);
  await ctx.close();
}

for (const [name, path, check] of PAGES) {
  for (const vp of Object.keys(VIEWPORTS)) await run(name, path, check, vp);
}
// إنجليزي (LTR) وداكن على الرئيسية
await run('home', 'index.html', PAGES[0][2], 'mobile', { lang: 'en' });
await run('home', 'index.html', PAGES[0][2], 'desktop', { lang: 'en' });
await run('home', 'index.html', PAGES[0][2], 'mobile', { dark: true });
await run('home', 'index.html', PAGES[0][2], 'desktop', { dark: true });

// القائمة على الموبايل: تفتح، وزرار اللغة بيقلب الاتجاه
await run('menu', 'index.html', async p => {
  await p.waitForSelector('.card');
  await p.click('.only-mobile[aria-label]');
  await p.waitForSelector('#menu-drawer.open');
  await p.click('.menu-prefs button:first-child');
  await p.waitForFunction(() => document.documentElement.dir === 'ltr');
  const logo = await p.$eval('.site-header .logo', el => el.scrollWidth <= el.clientWidth);
  if (!logo) throw new Error('logo is truncated');
}, 'mobile');

// رحلة العميل: تسجيل ← عنوان ← خروج ← دخول ← تغيير باسورد
await run('account-flow', 'account.html', async p => {
  await p.waitForSelector('.auth-panel');
  await p.click('.tabs .tab:nth-child(2)');
  await p.click('button[type=submit]');                       // فاضي ← أخطاء
  if (!(await p.textContent('[data-error-for="email"]')).trim()) throw new Error('validation errors not shown');
  await p.fill('[name=name]', 'Mona Ahmed');
  await p.fill('[name=email]', 'mona@test.com');
  await p.fill('[name=phone]', '01012345678');
  await p.fill('[name=password]', 'secret123');
  await p.click('button[type=submit]');
  await p.waitForSelector('.account-head');
  await p.click('a[href="#addresses"]');
  await p.click('text=إضافة عنوان');
  await p.selectOption('[name=governorate]', 'giza');
  for (const [k, v] of [['city', '6 October'], ['area', 'Hay 7'], ['street', 'Central Axis'], ['building', '5']]) await p.fill(`[name=${k}]`, v);
  await p.click('form.panel button[type=submit]');
  await p.waitForSelector('.address-card.is-default');
  await p.evaluate(() => scrollTo(0,0)); await p.screenshot({ path: OUT + 'account-addresses-mobile.png', fullPage: true });
  await p.click('text=تسجيل الخروج');
  await p.waitForSelector('.auth-panel');
  await p.click('.tabs .tab:nth-child(1)');
  await p.fill('[name=email]', 'mona@test.com');
  await p.fill('[name=password]', 'wrongpass');
  await p.click('button[type=submit]');
  await p.waitForSelector('.alert-error');
  await p.fill('[name=password]', 'secret123');
  await p.click('button[type=submit]');
  await p.waitForSelector('.account-head');
  await p.click('a[href="#security"]');
  await p.fill('[name=current]', 'secret123');
  await p.fill('[name=next]', 'newsecret1');
  await p.click('button[type=submit]');
  await p.waitForSelector('.toast');
}, 'mobile');

// Google ← طلب رقم الموبايل مرة واحدة
await run('account-google', 'account.html', async p => {
  await p.waitForSelector('.auth-panel');
  await p.click('.btn-google');
  await p.waitForSelector('[name=phone]');
  await p.fill('[name=phone]', '01112345678');
  await p.click('button[type=submit]');
  await p.waitForSelector('.account-head');
  if (await p.isVisible('a[href="#security"]')) { await p.click('a[href="#security"]'); await p.waitForSelector('text=Google'); }
}, 'desktop');

// المرحلة ٣: مدير عام واحد، وإدارة المنتجات والأقسام والمخزون والإعدادات.
async function stageThree(p, viewport) {
  await p.click('.gate [data-role="super_admin"]');
  await p.waitForSelector('.kpis');
  if (await p.$('a[data-route="staff"]')) throw new Error('Staff management must not be exposed');
  const go = async route => { await p.evaluate(r => { location.hash = '#/' + r; },route); await p.waitForFunction(r => document.querySelector('.side-nav a[data-route="'+r.split('/')[0]+'"]').getAttribute('aria-current') === 'page',route); };
  await go('products'); await p.click('a[href="#/products/new"]');
  await p.waitForSelector('.product-editor');
  await p.fill('[name=nameAr]','قميص اختبار المرحلة الثالثة'); await p.fill('[name=nameEn]','Stage three shirt');
  await p.fill('[name=slug]','stage-three-shirt'); await p.fill('[name=sku]','STAGE-UI');
  await p.selectOption('[name=categoryId]','men');
  await p.fill('[name=price]','450');
  const png=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=300;c.height=400;const x=c.getContext('2d');x.fillStyle='#456';x.fillRect(0,0,300,400);return c.toDataURL('image/png').split(',')[1];});
  await p.setInputFiles('[name=photos]',{name:'test-shirt.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await p.waitForSelector('text=الصور اترفعت. احفظ المنتج لإرفاقها.');
  await p.click('text=إضافة تركيبة');
  await p.fill('[name=vsku0]','STAGE-UI-BLK-M'); await p.fill('[name=vstock0]','5');
  await p.check('[name=featured]');
  await p.evaluate(() => scrollTo(0,0)); await p.screenshot({path:OUT+'stage3-product-editor-'+viewport+'.png',fullPage:true});
  await p.click('button:has-text("حفظ المنتج")');
  await p.waitForSelector('tbody tr:has-text("قميص اختبار المرحلة الثالثة")');
  const stored=await p.evaluate(async()=> (await App.db.list('products')).find(p=>p.slug==='stage-three-shirt'));
  if(!stored?.images[0].startsWith('fs:'))throw new Error('Image upload not persisted');
  await p.evaluate(() => scrollTo(0,0)); await p.screenshot({path:OUT+'stage3-products-'+viewport+'.png',fullPage:true});
  await go('inventory'); await p.waitForSelector('[aria-label="بحث المخزون"]');
  await p.fill('[aria-label="بحث المخزون"]','STAGE-UI');
  await p.click('button:has-text("تعديل المخزون")');
  await p.fill('.modal [name=stock]','9'); await p.fill('.modal [name=reason]','جرد تجريبي');
  await p.click('.modal button:has-text("حفظ المخزون")'); await p.waitForSelector('.modal',{state:'detached'});
  const updated=await p.evaluate(async id=>App.db.get('products',id),stored.id);
  if(updated.variants[0].stock!==9)throw new Error('Inventory was not saved');
  await p.evaluate(() => scrollTo(0,0)); await p.screenshot({path:OUT+'stage3-inventory-'+viewport+'.png',fullPage:true});
  await go('categories'); await p.click('button:has-text("إضافة قسم")');
  await p.fill('.modal [name=nameAr]','قسم اختبار'); await p.fill('.modal [name=slug]','stage-three-category');
  await p.click('.modal button:has-text("حفظ القسم")'); await p.waitForSelector('tbody tr:has-text("قسم اختبار")');
  const beforeOrder=await p.evaluate(async()=> (await App.db.list('categories')).find(c=>c.slug==='stage-three-category').order);
  await p.locator('tbody tr:has-text("قسم اختبار") button[aria-label^="تحريك لأعلى"]').click();
  await p.waitForFunction(async before => (await App.db.list('categories')).find(c=>c.slug==='stage-three-category').order < before,beforeOrder);
  await p.evaluate(() => scrollTo(0,0)); await p.screenshot({path:OUT+'stage3-categories-'+viewport+'.png',fullPage:true});
  await go('catalog-meta'); await p.waitForSelector('button:has-text("إضافة — الألوان")');
  await p.click('button:has-text("إضافة — الألوان")'); await p.fill('.modal [name=nameAr]','لون اختبار');
  await p.fill('.modal [name=nameEn]','Test color'); await p.click('.modal button[type=submit]');
  await p.waitForSelector('tbody tr:has-text("لون اختبار")');
  await p.evaluate(() => scrollTo(0,0)); await p.screenshot({path:OUT+'stage3-meta-'+viewport+'.png',fullPage:true});
  await go('settings'); await p.waitForSelector('[name=storeNameAr]');
  await p.fill('[name=storeNameAr]','متجر اختبار المرحلة الثالثة'); await p.fill('[name=whatsapp]','01012345678');
  await p.fill('[name=lowStockThreshold]','0'); await p.uncheck('[name=enabled_giza]');
  await p.fill('[name=price_cairo]','70'); await p.fill('[name=freeShippingOver]','');
  await p.click('button:has-text("حفظ الإعدادات")');
  await p.waitForFunction(()=>App.settings.general.whatsapp==='201012345678' && App.settings.inventory.lowStockThreshold===0);
  if(await p.evaluate(()=>App.settings.shipping.governorates.giza.enabled))throw new Error('Disabled governorate remained enabled');
  await p.evaluate(() => scrollTo(0,0)); await p.screenshot({path:OUT+'stage3-settings-'+viewport+'.png',fullPage:true});
  await go('audit'); await p.waitForSelector('text=settings.save');
  await p.evaluate(() => scrollTo(0,0)); await p.screenshot({path:OUT+'stage3-audit-'+viewport+'.png',fullPage:true});
  await p.goto(BASE+'index.html',{waitUntil:'load'}); await p.waitForSelector('.card');
  if(!(await p.textContent('.site-header .logo')).includes('متجر اختبار المرحلة الثالثة'))throw new Error('Updated name missing in storefront');
  if(!(await p.textContent('body')).includes('قميص اختبار المرحلة الثالثة'))throw new Error('Product not visible in storefront');
  await p.goto(BASE+'admin/index.html#/products',{waitUntil:'load'});
  await p.waitForSelector('tbody tr:has-text("قميص اختبار المرحلة الثالثة")');
  await p.locator('tbody tr:has-text("قميص اختبار المرحلة الثالثة") button:has-text("إخفاء")').click();
  await p.waitForSelector('tbody tr:has-text("قميص اختبار المرحلة الثالثة") button:has-text("إظهار")');
  await p.goto(BASE+'index.html',{waitUntil:'load'});await p.waitForSelector('.card');
  if((await p.textContent('body')).includes('قميص اختبار المرحلة الثالثة'))throw new Error('Hidden product still visible');
}
for (const viewport of ['mobile','desktop']) await run('stage3-flow','admin/index.html',p=>stageThree(p,viewport),viewport);

await run('admin-mobile','admin/index.html',async p=>{
  await p.click('.gate [data-role="super_admin"]');await p.waitForSelector('.kpis');await p.click('.burger');
  await p.waitForSelector('.sidebar.open');await p.click('a[data-route="settings"]');await p.waitForSelector('[name=storeNameAr]');
  if(await p.isVisible('.sidebar.open'))throw new Error('Mobile menu did not close');
},'mobile');

// المرحلة ٤: تصفح فعلي، فلاتر وروابط، واختيارات التركيبة والمفضلة.
async function stageFourFlow(p,vp) {
  await p.waitForSelector('.shop-results .card');
  const count=await p.locator('.shop-results .card').count();if(count!==12)throw new Error('Expected 12 initial products');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:OUT+`stage4-shop-${vp}.png`,fullPage:true});
  if(!await p.locator('.filter-panel').evaluate(e=>e.open))await p.click('.filter-panel summary');
  await p.fill('.shop-filters [name=q]','oversized');await p.click('.shop-filters button[type=submit]');
  await p.waitForURL('**/shop.html?q=oversized**');await p.waitForSelector('.shop-results .card');
  if(await p.locator('.shop-results .card').count()!==1)throw new Error('Search should match one product');
  await p.click('.card-title a');await p.waitForSelector('.product-layout');
  await p.locator('[data-color]:not([disabled])').first().click();
  await p.locator('[data-size]:not([disabled])').first().click();
  await p.waitForFunction(()=>document.querySelector('.product-sku').textContent.length>0);
  const selected=await p.evaluate(()=>{
    const product=App.catalog.product(new URLSearchParams(location.search).get('slug'));
    const color=document.querySelector('[data-color][aria-pressed=true]').dataset.color;
    const size=document.querySelector('[data-size][aria-pressed=true]').dataset.size;
    const v=product.variants.find(v=>v.color===color&&v.size===size);
    return {price:App.money.format(App.catalog.price(product,v)),available:App.catalog.available(v)};
  });
  if(!(await p.textContent('.product-price')).includes(selected.price))throw new Error('Wrong variant price');
  if(!(await p.textContent('.product-stock')).includes(String(selected.available)))throw new Error('Wrong available quantity');
  await p.locator('.product-thumbs button').last().click();
  await p.click('.product-image-button');await p.waitForSelector('dialog[open]');await p.keyboard.press('Escape');
  await p.waitForSelector('dialog',{state:'detached'});
  await p.click('.product-actions [data-wish]');await p.waitForSelector('.product-actions [aria-pressed="true"]');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:OUT+`stage4-product-${vp}.png`,fullPage:true});
  await p.goto(BASE+'wishlist.html');await p.waitForSelector('.wishlist-grid .card');
  if(await p.locator('.wishlist-grid .card').count()!==1)throw new Error('Guest wishlist missing');
  await p.reload();await p.waitForSelector('.wishlist-grid .card');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:OUT+`stage4-wishlist-${vp}.png`,fullPage:true});
  await p.goto(BASE+'account.html');await p.waitForSelector('.auth-panel');await p.click('.tabs .tab:nth-child(2)');
  await p.fill('[name=name]','Wishlist Customer');await p.fill('[name=email]',`wishlist-${vp}@test.com`);await p.fill('[name=phone]','01012345678');await p.fill('[name=password]','wishlist123');await p.click('button[type=submit]');
  await p.waitForSelector('.account-head');
  await p.waitForFunction(async()=>{const profile=await App.db.get('users',App.auth.user.uid);return profile.wishlist.length===1;});
  await p.goto(BASE+'wishlist.html');await p.waitForSelector('.wishlist-grid .card');
  await p.click('.wishlist-grid [data-wish]');await p.waitForSelector('.empty');
  const saved=await p.evaluate(async()=> (await App.db.get('users',App.auth.user.uid)).wishlist);
  if(saved.length)throw new Error('Account wishlist removal was not saved');
  await p.goto(BASE+'shop.html?cat=men&stock=1&sort=price-asc');await p.waitForSelector('.shop-results .card');
  const valid=await p.evaluate(()=>{
    const ids=[...document.querySelectorAll('.shop-results [data-wish]')].map(b=>b.dataset.wish),rows=ids.map(id=>App.catalog.product(id));
    return rows.every((row,i)=>App.catalog.inCategory(row,'men')&&App.catalog.inStock(row)&&(!i||App.catalog.priceRange(rows[i-1]).min<=App.catalog.priceRange(row).min));
  });if(!valid)throw new Error('Category/stock/sort filters incorrect');
  await p.goto(BASE+'shop.html?q=zz-no-results');await p.waitForSelector('.empty');
  if(await p.locator('.shop-results .card').count())throw new Error('Empty search returned cards');
  await p.goto(BASE+'product.html?slug=not-a-product');await p.waitForSelector('.notfound');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:OUT+`stage4-missing-${vp}.png`,fullPage:true});
}
for(const vp of ['mobile','desktop'])await run('stage4-flow','shop.html',p=>stageFourFlow(p,vp),vp);
for(const vp of ['mobile','desktop'])await run('stage4-english-dark','shop.html?sort=price-desc',async p=>{
  await p.waitForSelector('.shop-results .card');
  if(await p.textContent('h1')!=='Shop all')throw new Error('Shop translation missing');
  await p.click('.shop-results .card-title a');await p.waitForSelector('.product-layout');
  if(await p.textContent('.product-description h2')!=='Product details')throw new Error('Product translation missing');
},vp,{lang:'en',dark:true});

for(const vp of ['mobile','desktop'])await run('stage4-edge','shop.html',async p=>{
  await p.waitForSelector('.shop-results .card');
  const soldOut=await p.evaluate(()=>App.catalog.products.find(p=>!App.catalog.inStock(p)).slug);
  await p.goto(BASE+'product.html?slug='+soldOut);await p.waitForSelector('.product-layout');
  if(await p.locator('.variant-option:not([disabled])').count())throw new Error('Sold-out product has selectable variants');
  if(await p.textContent('.product-stock')!=='نفد')throw new Error('Sold-out status missing');
  await p.screenshot({path:OUT+`stage4-soldout-${vp}.png`,fullPage:true});
  await p.evaluate(async()=>{
    const sample=App.clone(App.catalog.products[0]);delete sample.id;
    for(let n=0;n<14;n++)await App.db.set('products','page-fixture-'+n,{...sample,slug:'page-fixture-'+n,sku:'PAGE-'+n,name:{ar:'منتج صفحات '+n,en:'Page product '+n},createdAt:'2026-01-01T00:00:00.000Z'});
    await App.catalog.refresh();
  });
  await p.goto(BASE+'shop.html?q=page');await p.waitForSelector('.pagination');
  if(await p.locator('.shop-results .card').count()!==12)throw new Error('First page count incorrect');
  await p.click('.pagination a:has-text("التالي")');await p.waitForURL('**page=2');await p.waitForSelector('.pagination');
  if(await p.locator('.shop-results .card').count()!==2)throw new Error('Second page count incorrect');
  if(!new URL(p.url()).searchParams.get('q'))throw new Error('Pagination lost query');
  await p.goBack();await p.waitForSelector('.pagination');
  if(await p.locator('.shop-results .card').count()!==12)throw new Error('Back did not restore first page');
  if(!await p.locator('.filter-panel').evaluate(e=>e.open))await p.click('.filter-panel summary');
  await p.fill('.shop-filters [name=min]','500');await p.fill('.shop-filters [name=max]','100');await p.click('.shop-filters button[type=submit]');
  if(!(await p.textContent('.shop-filters [role=alert]')))throw new Error('Invalid range missing error');
},vp);

async function stageFive(p,vp){
  await p.waitForSelector('.shop-results .card');
  const fixture=await p.evaluate(async()=>{
    await App.db.update('settings','shipping',{freeShippingOver:900,freeShippingBasis:'afterCoupon',governorates:{cairo:{enabled:true,price:80},giza:{enabled:false,price:0}}});
    await App.db.set('coupons','TEST10',{type:'percent',value:10,minOrder:0,active:true,usedCount:0,usageLimit:10});
    await App.loadSettings(true);
    const product=App.catalog.products.find(p=>p.variants.some(v=>App.catalog.available(v)>=3));
    const variant=product.variants.find(v=>App.catalog.available(v)>=3);
    return {slug:product.slug,id:product.id,sku:variant.sku,color:variant.color,size:variant.size,price:App.catalog.price(product,variant),stock:variant.stock};
  });
  await p.goto(BASE+'product.html?slug='+fixture.slug);await p.waitForSelector('.product-add');
  if(!await p.isDisabled('.product-add'))throw new Error('Add enabled before choosing variant');
  await p.click(`[data-color="${fixture.color}"]`);await p.click(`[data-size="${fixture.size}"]`);
  await p.fill('.product-quantity','2');await p.click('.product-add');await p.waitForSelector('#cart-drawer.open');
  if(await p.textContent('[data-count=cart]')!=='2')throw new Error('Cart badge quantity incorrect');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:OUT+`stage5-drawer-${vp}.png`,fullPage:true});
  await p.click('#cart-drawer a[href="cart.html"]');await p.waitForSelector('.cart-line');
  await p.reload();await p.waitForSelector('.cart-line');
  if(await p.inputValue('.cart-quantity')!=='2')throw new Error('Guest cart did not persist');
  await p.selectOption('[name=governorate]','cairo');await p.waitForSelector('.order-summary');
  if(!await p.locator('[name=governorate] option[value=giza]').isDisabled())throw new Error('Disabled governorate selectable');
  await p.fill('[name=coupon]','BADCODE');await p.click('.coupon-form [type=submit]');
  await p.waitForFunction(()=>document.querySelector('.coupon-form .field-error').textContent.length>0);
  await p.fill('[name=coupon]','TEST10');await p.click('.coupon-form [type=submit]');
  await p.waitForFunction(()=>App.cart.state.couponCode==='TEST10');await p.waitForSelector('.grand-total');
  const discounted=Math.round(fixture.price*2*0.9*100)/100,shipping=discounted>=900?0:80;
  const expected=await p.evaluate(amount=>App.money.format(amount),discounted+shipping);
  if(!(await p.textContent('.grand-total')).includes(expected))throw new Error('Cart total incorrect');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:OUT+`stage5-cart-${vp}.png`,fullPage:true});
  await p.click('a[href^="checkout.html"]');await p.waitForSelector('.checkout-form');
  await p.click('.checkout-form [type=submit]');
  if(!(await p.textContent('[data-error-for=name]')))throw new Error('Checkout did not validate recipient');
  for(const [field,value] of Object.entries({name:'عميل اختبار',phone:'01012345678',city:'القاهرة',area:'مدينة نصر',street:'شارع اختبار',building:'12',floor:'2',apartment:'4',notes:'علامة اختبار'}))await p.fill('.checkout-form [name='+field+']',value);
  await p.selectOption('.checkout-form [name=governorate]','cairo');
  await p.click('.checkout-form [type=submit]');await p.waitForSelector('.checkout-review h2');
  if(!(await p.textContent('.checkout-review .grand-total')).includes(expected))throw new Error('Review total incorrect');
  const effects=await p.evaluate(async({id,sku})=>({orders:(await App.db.list('orders')).length,stock:(await App.db.get('products',id)).variants.find(v=>v.sku===sku).stock,used:(await App.db.get('coupons','TEST10')).usedCount}),fixture);
  if(effects.orders||effects.stock!==fixture.stock||effects.used!==0)throw new Error('Review created an order, consumed stock or consumed coupon');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:OUT+`stage5-checkout-${vp}.png`,fullPage:true});
  await p.goto(BASE+'account.html');await p.waitForSelector('.auth-panel');await p.click('.tabs .tab:nth-child(2)');
  await p.fill('[name=name]','Cart Customer');await p.fill('[name=email]',`cart-${vp}@test.com`);await p.fill('[name=phone]','01012345678');await p.fill('[name=password]','cartpass123');await p.click('button[type=submit]');await p.waitForSelector('.account-head');
  await p.waitForFunction(async()=>{const cart=await App.db.get('carts',App.auth.user.uid);return cart?.items?.length===1;});
  await p.evaluate(()=>App.addresses.save(App.auth.user.uid,{label:'البيت',name:'Saved Recipient',phone:'01112345678',governorate:'cairo',city:'Saved City',area:'Saved Area',street:'Saved Street',building:'3',floor:'1',apartment:'2',notes:''}));
  await p.goto(BASE+'checkout.html');await p.waitForSelector('[aria-label="عنوان محفوظ"]');
  const savedId=await p.locator('[aria-label="عنوان محفوظ"] option').nth(1).getAttribute('value');await p.selectOption('[aria-label="عنوان محفوظ"]',savedId);
  if(await p.inputValue('.checkout-form [name=city]')!=='Saved City'||await p.inputValue('.checkout-form [name=phone]')!=='01112345678')throw new Error('Saved address was not applied');
  await p.goto(BASE+'cart.html');await p.waitForSelector('.cart-line');await p.fill('.cart-quantity','1');await p.locator('.cart-quantity').press('Tab');
  await p.waitForFunction(()=>App.cart.count===1);
  await p.evaluate(async({id,sku})=>{const product=await App.db.get('products',id);await App.db.update('products',id,{variants:product.variants.map(v=>v.sku===sku?{...v,stock:0,reserved:0}:v)});await App.catalog.refresh();},fixture);
  await p.waitForSelector('.cart-line .field-error');
  if(await p.locator('a[href^="checkout.html"]').count())throw new Error('Checkout offered with invalid cart');
  await p.click('.cart-line .text-link');await p.waitForSelector('#main .empty');
  const remote=await p.evaluate(()=>App.db.get('carts',App.auth.user.uid));if(remote.items.length)throw new Error('Remote cart removal failed');
}
for(const vp of ['mobile','desktop'])await run('stage5-flow','shop.html',p=>stageFive(p,vp),vp);
await run('stage5-english-dark','cart.html',async p=>{
  await p.waitForSelector('#main .empty');if(await p.textContent('h1')!=='Cart')throw new Error('Cart English missing');
  await p.evaluate(async()=>{const product=App.catalog.products.find(p=>App.catalog.inStock(p)),variant=product.variants.find(v=>App.catalog.available(v)>0);await App.cart.add(product.id,variant.sku,1);});
  await p.waitForSelector('.cart-line');await p.goto(BASE+'checkout.html');await p.waitForSelector('.checkout-form');
  if(!(await p.textContent('h1')).includes('Delivery details'))throw new Error('Checkout English missing');
},'mobile',{lang:'en',dark:true});

// ملف مضغوط مثل Excel: إعادة ضغط ZIP المخزن لاختبار deflate-raw.
function compressedWorkbook(bytes) {
  const parts=[],central=[];let p=0,offset=0;
  while(bytes.readUInt32LE(p)===0x04034b50){
    const n=bytes.readUInt16LE(p+26),extra=bytes.readUInt16LE(p+28),size=bytes.readUInt32LE(p+18);
    const name=bytes.subarray(p+30,p+30+n),raw=bytes.subarray(p+30+n+extra,p+30+n+extra+size),packed=deflateRawSync(raw);
    const header=Buffer.from(bytes.subarray(p,p+30+n));header.writeUInt16LE(8,8);header.writeUInt32LE(packed.length,18);
    const c=Buffer.alloc(46+n);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(header.readUInt32LE(14),16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(raw.length,24);c.writeUInt16LE(n,28);c.writeUInt32LE(offset,42);name.copy(c,46);
    parts.push(header,packed);central.push(c);offset+=header.length+packed.length;p+=30+n+extra+size;
  }
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length,8);end.writeUInt16LE(central.length,10);end.writeUInt32LE(central.reduce((n,b)=>n+b.length,0),12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...parts,...central,end]);
}
for(const vp of ['mobile','desktop'])await run('product-excel','admin/index.html',async p=>{
  await p.click('.gate [data-role="super_admin"]');await p.waitForSelector('.kpis');
  await p.evaluate(()=>{location.hash='#/products';});await p.getByRole('button',{name:'تصدير البضاعة',exact:true}).waitFor();
  await p.screenshot({path:OUT+`excel-buttons-${vp}.png`,fullPage:true});
  // التصدير يشمل المنتجات المخفية ولا يتأثر بالفلتر.
  await p.fill('[aria-label="بحث المنتجات"]','does-not-exist');
  const [download]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'تصدير البضاعة',exact:true}).click()]);
  const exportPath=OUT+`products-${vp}.xlsx`;await download.saveAs(exportPath);
  const bytes=readFileSync(exportPath);if(bytes.readUInt32LE(0)!==0x04034b50)throw new Error('Export is not a real XLSX ZIP');
  await p.getByRole('link',{name:'استيراد Excel',exact:true}).click();
  const [template]=await Promise.all([p.waitForEvent('download'),p.getByRole('button',{name:'تحميل قالب Excel',exact:true}).click()]);
  if(template.suggestedFilename()!=='products-template.xlsx')throw new Error('Missing Excel template');
  const countBefore=await p.evaluate(async()=>(await App.db.list('products')).length);
  const upload=buffer=>p.getByLabel('ملف Excel للمنتجات').setInputFiles({name:'products.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer});
  await upload(Buffer.from('invalid file'));await p.waitForFunction(()=>document.querySelector('[data-sheet-error]')?.textContent.length>0);
  if(!await p.getByRole('button',{name:'تأكيد الاستيراد',exact:true}).isDisabled())throw new Error('Malformed file can be saved');
  // إنشاء ملف جديد من قالب التصدير، بدون أسعار أو صور وهمية في المشروع الحقيقي.
  const fixture=await p.evaluate(async()=>{
    const data=await App.catalogAdmin.load(),source=data.products[0];
    const product={...source,id:'',revision:'',sku:'EXCEL-UI',slug:'excel-ui',name:{ar:'قميص مستورد <اختبار>',en:'=HYPERLINK("https://example.com")'},hidden:false,variants:[{...source.variants[0],sku:'EXCEL-UI-V',stock:6,reserved:0,sold:0}]};
    const sheets=App.productSheet.sheets({...data,products:[product]});
    // معادلة السعر دي نص حرفي آمن في ملف التصدير، مش صيغة Excel.
    const blob=App.excel.write(sheets);return {bytes:[...new Uint8Array(await blob.arrayBuffer())],rows:sheets[0].rows};
  });
  await upload(compressedWorkbook(Buffer.from(fixture.bytes)));
  await p.getByRole('button',{name:'تأكيد الاستيراد',exact:true}).waitFor();
  await p.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='تأكيد الاستيراد').disabled);
  if((await p.evaluate(async()=>(await App.db.list('products')).length))!==countBefore)throw new Error('Preview wrote products');
  const clipped=await p.evaluate(()=>Array.from(document.querySelectorAll('.product-sheet > p,.product-sheet > input,.product-sheet > button')).some(e=>{const r=e.getBoundingClientRect();return r.left<0||r.right>innerWidth;}));
  if(clipped)throw new Error('Excel preview controls or instructions clipped');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:OUT+`excel-preview-${vp}.png`,fullPage:true});
  await p.getByRole('button',{name:'تأكيد الاستيراد',exact:true}).click();
  await p.waitForFunction(()=>Array.from(document.querySelectorAll('[role=status]')).some(e=>e.textContent.includes('تم استيراد 1')));
  const imported=await p.evaluate(async()=>{
    const product=(await App.db.list('products')).find(p=>p.sku==='EXCEL-UI');
    if(!product||product.variants[0].stock!==6)throw new Error('Imported stock not saved');
    const data=await App.catalogAdmin.load(),sheets=App.productSheet.sheets({...data,products:[product]});
    const rows=sheets[0].rows;rows[1][App.productSheet.columns.findIndex(c=>c[0]==='stock')]=8;
    return {id:product.id,slug:product.slug,color:product.variants[0].color,size:product.variants[0].size,bytes:[...new Uint8Array(await App.excel.write(sheets).arrayBuffer())]};
  });
  await upload(Buffer.from(imported.bytes));await p.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='تأكيد الاستيراد').disabled);
  await p.getByRole('button',{name:'تأكيد الاستيراد',exact:true}).click();await p.waitForFunction(()=>Array.from(document.querySelectorAll('[role=status]')).some(e=>e.textContent.includes('تم استيراد 1')));
  if(await p.evaluate(async id=>(await App.db.get('products',id)).variants[0].stock,imported.id)!==8)throw new Error('Existing product not updated');
  await upload(Buffer.from(imported.bytes));await p.waitForFunction(()=>document.querySelector('[data-sheet-error]')?.textContent.includes('اتغيرت'));
  if(!await p.getByRole('button',{name:'تأكيد الاستيراد',exact:true}).isDisabled())throw new Error('Stale sheet accepted');
  await p.screenshot({path:OUT+`excel-stale-${vp}.png`,fullPage:true});
  // المنتج المستورد فعليًا يظهر في المتجر ويتضاف للسلة والمراجعة الحالية.
  await p.goto(BASE+'product.html?slug='+imported.slug);await p.waitForSelector('.product-add');
  await p.click(`[data-color="${imported.color}"]`);await p.click(`[data-size="${imported.size}"]`);await p.click('.product-add');await p.waitForSelector('#cart-drawer.open');
  await p.goto(BASE+'checkout.html');await p.waitForSelector('.checkout-form');
  await p.evaluate(async()=>{await App.db.set('settings','shipping',{governorates:{cairo:{enabled:true,price:50}},freeShippingOver:null,eta:{min:2,max:5}});});
  await p.reload();await p.waitForSelector('.checkout-form');
  for(const [field,value] of Object.entries({name:'عميل الشيت',phone:'01012345678',city:'القاهرة',area:'مدينة نصر',street:'شارع الاختبار',building:'1'}))await p.fill('.checkout-form [name='+field+']',value);
  await p.selectOption('.checkout-form [name=governorate]','cairo');await p.click('.checkout-form [type=submit]');await p.waitForSelector('.checkout-review h2');
  if(!(await p.textContent('.checkout-review')).includes('قميص مستورد'))throw new Error('Imported product missing from checkout');
},vp);

await browser.close();
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
