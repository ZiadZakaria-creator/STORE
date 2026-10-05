// rules.test.mjs — اختبارات firestore.rules على الـ Emulator.
// التشغيل: npx firebase emulators:exec --only firestore "node tests/rules.test.mjs"
// (محتاج firebase-tools و @firebase/rules-unit-testing و firebase متسطّبين برّه الموقع، و NODE_PATH يشاور عليهم)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { setLogLevel, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, serverTimestamp } = require('firebase/firestore');

setLogLevel('silent');
const env = await initializeTestEnvironment({
  projectId: 'demo-store',
  firestore: { host: '127.0.0.1', port: 8085, rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') }
});

let passed = 0, failed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('✓ ' + name); }
  catch (e) { failed++; console.error('✗ ' + name + '\n   ' + (e.message || e)); }
}

// تجهيز: أدمنز بأدوار مختلفة (بيتكتبوا من غير rules زي ما بيتعملوا من الـ Console)
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'admins/boss'), { name: 'Boss', email: 'boss@x.com', role: 'super_admin', active: true });
  await setDoc(doc(db, 'admins/support'), { name: 'Sup', email: 'sup@x.com', role: 'customer_support', active: true });
  await setDoc(doc(db, 'admins/stockman'), { name: 'Stock', email: 'stock@x.com', role: 'inventory_manager', active: true });
  await setDoc(doc(db, 'admins/fired'), { name: 'Old', email: 'old@x.com', role: 'super_admin', active: false });
  await setDoc(doc(db, 'products/p1'), { name: { ar: 'تيشيرت' }, price: 100 });
  await setDoc(doc(db, 'users/alice'), { name: 'Alice', email: 'alice@x.com', phone: '01012345678', wishlist: [], createdAt: new Date() });
  await setDoc(doc(db, 'orders/o1'), { uid: 'alice', total: 100 });
  await setDoc(doc(db, 'orders/o2'), { uid: 'bob', total: 50 });
});

const as = (uid, email) => env.authenticatedContext(uid, { email: email || uid + '@x.com' }).firestore();
const anon = env.unauthenticatedContext().firestore();
const boss = as('boss', 'boss@x.com');
const support = as('support');
const stockman = as('stockman');
const fired = as('fired');
const alice = as('alice', 'alice@x.com');
const bob = as('bob', 'bob@x.com');

/* ---------- الكتالوج ---------- */
await t('anyone reads products', () => assertSucceeds(getDoc(doc(anon, 'products/p1'))));
await t('anyone reads settings', () => assertSucceeds(getDoc(doc(anon, 'settings/general'))));
await t('customer cannot write products', () => assertFails(setDoc(doc(alice, 'products/p2'), { price: 1 })));
await t('anon cannot write categories', () => assertFails(setDoc(doc(anon, 'categories/c'), { name: 'x' })));
await t('super admin (no roles docs yet) writes categories', () => assertSucceeds(setDoc(doc(boss, 'categories/men'), { name: { ar: 'رجالي', en: 'Men' } })));
await t('inactive admin cannot write', () => assertFails(setDoc(doc(fired, 'categories/x'), { name: 'x' })));
await t('support (role doc missing) cannot write products', () => assertFails(setDoc(doc(support, 'products/p3'), { price: 1 })));

/* ---------- تجهيز الأدوار ---------- */
await t('super admin creates super_admin role with [all]', () => assertSucceeds(setDoc(doc(boss, 'roles/super_admin'), { name: { ar: 'مدير عام', en: 'Super Admin' }, permissions: ['all'] })));
await t('super_admin role cannot be changed', () => assertFails(updateDoc(doc(boss, 'roles/super_admin'), { permissions: ['orders.read'] })));
await t('super_admin role cannot be deleted', () => assertFails(deleteDoc(doc(boss, 'roles/super_admin'))));
await t('super admin creates support role', () => assertSucceeds(setDoc(doc(boss, 'roles/customer_support'), { name: { ar: 'خدمة العملاء', en: 'Support' }, permissions: ['orders.read', 'orders.write', 'customers.read'] })));
await t('super admin creates inventory role', () => assertSucceeds(setDoc(doc(boss, 'roles/inventory_manager'), { name: { ar: 'مخزون', en: 'Inventory' }, permissions: ['products.write', 'inventory.write'] })));
await t('role with extra fields rejected', () => assertFails(setDoc(doc(boss, 'roles/x'), { name: { ar: 'x', en: 'x' }, permissions: [], hack: 1 })));
await t('support cannot edit roles', () => assertFails(updateDoc(doc(support, 'roles/customer_support'), { permissions: ['all'] })));
await t('admins read roles', () => assertSucceeds(getDoc(doc(support, 'roles/customer_support'))));
await t('customers cannot read roles', () => assertFails(getDoc(doc(alice, 'roles/customer_support'))));
await t('inventory manager writes products', () => assertSucceeds(setDoc(doc(stockman, 'products/p4'), { price: 5 })));
await t('support still cannot write products', () => assertFails(setDoc(doc(support, 'products/p5'), { price: 1 })));

/* ---------- الأدمنز ---------- */
await t('admin reads own admin doc', () => assertSucceeds(getDoc(doc(support, 'admins/support'))));
await t('admin cannot read others without staff.manage', () => assertFails(getDoc(doc(support, 'admins/boss'))));
await t('customer reading admins/{self} (missing) allowed, others denied', async () => {
  await assertSucceeds(getDoc(doc(alice, 'admins/alice')));
  await assertFails(getDoc(doc(alice, 'admins/boss')));
});
await t('customer cannot make himself admin', () => assertFails(setDoc(doc(alice, 'admins/alice'), { name: 'A', email: 'alice@x.com', role: 'super_admin', active: true })));
await t('super admin adds a store admin', () => assertSucceeds(setDoc(doc(boss, 'admins/dave'), { name: 'D', email: 'dave@x.com', role: 'customer_support', active: true, createdAt: serverTimestamp() })));
await t('admin cannot change own role', () => assertFails(updateDoc(doc(support, 'admins/support'), { role: 'super_admin' })));
await t('super admin cannot edit himself', () => assertFails(updateDoc(doc(boss, 'admins/boss'), { active: false })));
await t('admin doc with extra fields rejected', () => assertFails(setDoc(doc(boss, 'admins/bob'), { name: 'B', email: 'b', role: 'customer_support', active: true, perms: ['all'] })));

// مدير بصلاحية staff.manage بس مش مدير عام
await env.withSecurityRulesDisabled(async ctx => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'roles/hr'), { name: { ar: 'HR', en: 'HR' }, permissions: ['staff.manage'] });
  await setDoc(doc(db, 'admins/hr'), { name: 'HR', email: 'hr@x.com', role: 'hr', active: true });
});
const hr = as('hr');
await t('staff.manage can add a support admin', () => assertSucceeds(setDoc(doc(hr, 'admins/bob'), { name: 'B', email: 'bob@x.com', role: 'customer_support', active: true })));
await t('staff.manage (not super) cannot create a super admin', () => assertFails(setDoc(doc(hr, 'admins/carol'), { name: 'C', email: 'c@x.com', role: 'super_admin', active: true })));
await t('staff.manage (not super) cannot promote to super admin', () => assertFails(updateDoc(doc(hr, 'admins/bob'), { role: 'super_admin' })));
await t('staff.manage (not super) cannot disable the super admin', () => assertFails(updateDoc(doc(hr, 'admins/boss'), { active: false })));
await t('staff.manage (not super) cannot delete the super admin', () => assertFails(deleteDoc(doc(hr, 'admins/boss'))));
await t('super admin removes an admin', () => assertSucceeds(deleteDoc(doc(boss, 'admins/bob'))));

/* ---------- العملاء ---------- */
await t('user creates own profile', () => assertSucceeds(setDoc(doc(bob, 'users/bob'), { name: 'Bob', email: 'bob@x.com', phone: '', wishlist: [], createdAt: serverTimestamp() })));
await t('user cannot create profile with another email', () => assertFails(setDoc(doc(as('eve', 'eve@x.com'), 'users/eve'), { name: 'E', email: 'boss@x.com', phone: '', wishlist: [], createdAt: serverTimestamp() })));
await t('user cannot create profile for someone else', () => assertFails(setDoc(doc(bob, 'users/zed'), { name: 'Z', email: 'bob@x.com', phone: '', wishlist: [], createdAt: serverTimestamp() })));
await t('profile with extra field (role) rejected', () => assertFails(setDoc(doc(as('dan', 'dan@x.com'), 'users/dan'), { name: 'D', email: 'dan@x.com', phone: '', wishlist: [], createdAt: serverTimestamp(), role: 'super_admin' })));
await t('user updates name/phone', () => assertSucceeds(updateDoc(doc(bob, 'users/bob'), { name: 'Bob B', phone: '01112345678', updatedAt: serverTimestamp() })));
await t('invalid phone rejected', () => assertFails(updateDoc(doc(bob, 'users/bob'), { phone: '123' })));
await t('user cannot change own email', () => assertFails(updateDoc(doc(bob, 'users/bob'), { email: 'boss@x.com' })));
await t('user cannot read another user', () => assertFails(getDoc(doc(bob, 'users/alice'))));
await t('support (customers.read) reads users', () => assertSucceeds(getDoc(doc(support, 'users/alice'))));
await t('staff query users by email', () => assertSucceeds(getDocs(query(collection(hr, 'users'), where('email', '==', 'alice@x.com')))));
await t('customer cannot list users', () => assertFails(getDocs(collection(bob, 'users'))));

const addr = { name: 'Bob', phone: '01012345678', governorate: 'cairo', city: 'Nasr City', area: 'Zone 8', street: 'Abbas', building: '12', isDefault: true, createdAt: serverTimestamp() };
await t('user adds own address', () => assertSucceeds(setDoc(doc(bob, 'users/bob/addresses/a1'), addr)));
await t('address with bad phone rejected', () => assertFails(setDoc(doc(bob, 'users/bob/addresses/a2'), { ...addr, phone: '1' })));
await t('address missing street rejected', () => assertFails(setDoc(doc(bob, 'users/bob/addresses/a3'), { ...addr, street: '' })));
await t('cannot add address to another user', () => assertFails(setDoc(doc(bob, 'users/alice/addresses/x'), addr)));
await t('cannot read another user addresses', () => assertFails(getDocs(collection(bob, 'users/alice/addresses'))));
await t('user deletes own address', () => assertSucceeds(deleteDoc(doc(bob, 'users/bob/addresses/a1'))));

/* ---------- سجل العمليات ---------- */
await t('admin writes audit log as self', () => assertSucceeds(addDoc(collection(support, 'auditLogs'), { by: 'support', byName: 'Sup', action: 'x', entity: 'orders', entityId: '1', before: null, after: null, summary: '', at: serverTimestamp() })));
await t('audit log impersonation rejected', () => assertFails(addDoc(collection(support, 'auditLogs'), { by: 'boss', action: 'x', entity: 'orders', at: serverTimestamp() })));
await t('customer cannot write audit log', () => assertFails(addDoc(collection(alice, 'auditLogs'), { by: 'alice', action: 'x', entity: 'orders', at: serverTimestamp() })));
await t('audit log cannot be deleted even by super admin', async () => {
  const ref = await addDoc(collection(boss, 'auditLogs'), { by: 'boss', action: 'x', entity: 'roles', at: serverTimestamp() });
  await assertFails(deleteDoc(doc(boss, 'auditLogs/' + ref.id)));
  await assertFails(updateDoc(doc(boss, 'auditLogs/' + ref.id), { action: 'y' }));
});
await t('support cannot read audit log', () => assertFails(getDocs(collection(support, 'auditLogs'))));
await t('super admin reads audit log', () => assertSucceeds(getDocs(collection(boss, 'auditLogs'))));

/* ---------- الطلبات ---------- */
await t('customer reads own orders by query', () => assertSucceeds(getDocs(query(collection(alice, 'orders'), where('uid', '==', 'alice')))));
await t('customer cannot read others orders', () => assertFails(getDoc(doc(alice, 'orders/o2'))));
await t('customer cannot list all orders', () => assertFails(getDocs(collection(alice, 'orders'))));
await t('support reads all orders', () => assertSucceeds(getDocs(collection(support, 'orders'))));

/* ---------- أي حاجة تانية ---------- */
await t('unknown collection closed', () => assertFails(getDoc(doc(boss, 'secrets/x'))));
await t('unknown collection write closed', () => assertFails(setDoc(doc(boss, 'secrets/x'), { a: 1 })));

await env.cleanup();
console.log(`rules: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
