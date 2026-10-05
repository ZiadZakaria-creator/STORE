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
const browser = await chromium.launch({ args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,BlockInsecurePrivateNetworkRequests'] });
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

await step('owner adds Sara as customer support (and it is audited)', async () => {
  const p = A.page;
  await p.goto(BASE + 'admin/index.html#/staff');
  await p.waitForSelector('text=+ إضافة أدمن', { timeout: 15000 });
  await p.click('text=+ إضافة أدمن');
  await p.fill('.modal [name=email]', 'sara@shop.test');
  await p.selectOption('.modal [name=role]', 'customer_support');
  await p.click('.modal-foot .btn-primary');
  await p.waitForSelector('tbody >> text=sara@shop.test', { timeout: 15000 });
  await p.goto(BASE + 'admin/index.html#/audit');
  await p.waitForSelector('text=sara@shop.test', { timeout: 15000 });
  await p.screenshot({ path: OUT + 'live-admin-audit.png', fullPage: true });
});

await step('Sara signs out, back in with new password, sees limited admin', async () => {
  const p = B.page;
  await p.goto(BASE + 'account.html');
  await p.click('text=تسجيل الخروج');
  await p.waitForSelector('.auth-panel');
  await p.fill('[name=email]', 'sara@shop.test');
  await p.fill('[name=password]', 'sarapass34');
  await p.click('button[type=submit]');
  await p.waitForSelector('.account-head', { timeout: 15000 });
  await p.goto(BASE + 'admin/index.html');
  await p.waitForSelector('.side-nav', { timeout: 15000 });
  const routes = await p.$$eval('.side-nav a', a => a.map(x => x.dataset.route));
  if (routes.includes('staff') || routes.includes('setup') || routes.includes('audit')) throw new Error('support sees: ' + routes.join(','));
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
