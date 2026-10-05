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
  const ctx = await browser.newContext({ viewport: VIEWPORTS[vpName], colorScheme: opts.dark ? 'dark' : 'light', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(`${m.text()} @ ${m.location().url || ''}`); });
  page.on('pageerror', e => errors.push(e.message));
  if (opts.lang) await page.addInitScript(l => localStorage.setItem('cs:lang', JSON.stringify(l)), opts.lang);
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
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
  await p.screenshot({ path: OUT + 'account-addresses-mobile.png', fullPage: true });
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

// اللوحة: دخول كمدير عام ← الموظفين ← تغيير دور ← السجل
await run('admin-flow', 'admin/index.html', async p => {
  await p.click('.gate [data-role="customer_support"]');
  await p.waitForSelector('.side-nav');
  if (await p.$('a[data-route="staff"]')) throw new Error('customer support should not see staff');
  await p.click('text=خروج');
  await p.click('.gate [data-role="super_admin"]');
  await p.waitForSelector('.kpis');
  await p.screenshot({ path: OUT + 'admin-overview-desktop.png', fullPage: true });
  await p.click('a[data-route="staff"]');
  await p.waitForSelector('text=الأدوار والصلاحيات');
  // الأدمن التاني (customer support) ← محاسب
  const select = await p.$('tbody tr:has-text("customer.support") select');
  await select.selectOption('accountant');
  await p.waitForSelector('.toast');
  await p.screenshot({ path: OUT + 'admin-staff-desktop.png', fullPage: true });
  await p.click('a[data-route="audit"]');
  await p.waitForSelector('text=محاسب');
  await p.screenshot({ path: OUT + 'admin-audit-desktop.png', fullPage: true });
}, 'desktop');

await run('admin-mobile', 'admin/index.html', async p => {
  await p.click('.gate [data-role="super_admin"]');
  await p.waitForSelector('.kpis');
  await p.click('.burger');
  await p.waitForSelector('.sidebar.open');
  await p.click('a[data-route="staff"]');
  await p.waitForSelector('text=الأدوار والصلاحيات');
}, 'mobile');

await browser.close();
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
