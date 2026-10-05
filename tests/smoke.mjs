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
  ['404', '404.html', async p => { await p.waitForSelector('.notfound h1'); }]
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
    if (overflow > 1) throw new Error(`horizontal overflow ${overflow}px`);
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

await browser.close();
console.log(failures ? `${failures} failed` : 'all passed');
process.exit(failures ? 1 : 0);
