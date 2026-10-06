// smoke.mjs — بيفتح الصفحات على موبايل وديسكتوب، وبياخد screenshots، وبيفشل لو فيه أخطاء console.
// التشغيل: python3 -m http.server 8080 & ثم: NODE_PATH=$(npm root -g) node tests/smoke.mjs [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
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

await browser.close();
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
