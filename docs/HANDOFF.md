# تسليم المشروع — الحالة الحالية واللي جاي

> الملف ده للي هيكمل الشغل (Codex أو غيره). اقرا `AGENTS.md` الأول، وبعده `docs/ARCHITECTURE.md`، وبعده الملف ده.

## اللي خلص
| المرحلة | الحالة |
|---|---|
| 1 — الأساس | ✓ tokens، و core، وطبقة `App.db` (Demo + Firebase)، والبيانات التجريبية، والرئيسية المبدئية، والنشر، و PWA |
| 2 — الدخول والمستخدمين | ✓ `auth.js` (إيميل/باسورد + Google)، و `account.html`، والعناوين، وشكل اللوحة كله، و RBAC، والموظفين والأدوار، و Audit log |
| Firebase الحقيقي (من المرحلة 11) | ✓ `firestore.rules` لكل الـ collections الحالية ومتجربة على الـ Emulator (61 اختبار)، والموقع متجرب كامل في وضع Firebase على الـ Emulator (13 خطوة)، و `FIREBASE_SETUP.md`، وقسم **تجهيز المتجر** في اللوحة |

## حالة Firebase الحقيقي (مشروع `store-4cfd5`)
- **`firebase-config.js`** فيه إعدادات المشروع، والموقع شغال في وضع Firebase.
- **القواعد:** `firestore.rules` منشورة. أي تعديل فيها لازم صاحب المتجر يلصقه في Console ← Firestore ← Rules ← Publish.
- **الدخول:** Email/Password و Google متفعّلين، و `ziadzakaria-creator.github.io` في Authorized domains.
- **أدمن واحد بس:** مدير عام (`admins/{uid}` بـ `role: super_admin`). صاحب المتجر مش عايز موظفين تانيين.
- **"تجهيز المتجر" اتعمل:** 29 قسم، و 10 ألوان، و 28 مقاس، و 3 إعدادات، و 5 أدوار. مفيش منتجات ولا ماركات لسه.
- **الإعدادات لسه فاضية:**
  - `settings/general`: الاسم ما زال "اسم المتجر"، والواتساب فاضي.
  - `settings/shipping`: كل المحافظات مقفولة لحد ما تتحط أسعار.
- **الـ Indexes** المطلوبة في `FIREBASE_SETUP.md` (الخطوة 6). لو ناقص index، الـ console هيطلع لينك يعمله.
- **الاختبارات بتفضل على الوضع التجريبي:** `tools/check.mjs` و `tests/smoke.mjs` بيجبروا `FIREBASE_CONFIG = null`.

## المراحل الجاية (بالترتيب، التفاصيل في `docs/ARCHITECTURE.md`)
3. **المنتجات والأقسام والمخزون من اللوحة:** `admin-products.js`، و `admin-categories.js`، و `admin-catalog-meta.js`، و `admin-inventory.js`، ورفع الصور (`js/services/images.js` ← `productImages` و `fs:<id>`).
4. **واجهة المتجر:** `shop.html` (فلترة وترتيب)، و `product.html`، و `wishlist.html`، ورفوف الرئيسية.
5. **السلة والـ checkout:** `cart.js`، و `coupons.js`، و `shipping.js`.
6. **الطلبات:** `orders.js`. محتاجة rules جديدة لـ `orders` (create بعد التحقق) و `tracking`.
7. **الدفع:** `payment.js` (COD + تحويل بصورة `paymentProofs`).
8. **الشحن والتتبع:** `track.html` و `tracking/{number}`.
9. **باقي اللوحة:** Overview كامل، والطلبات، والعملاء.
10. **التقارير، والكوبونات، والتقييمات، والعروض.**
11. **الأمان والأداء:** باقي الـ rules، و App Check، و Lighthouse.
12. **SEO و PWA والنشر النهائي.**

## قواعد لازم تفضل ماشية
- **أي collection جديد** لازم:
  - rule صريحة في `firestore.rules`.
  - اختبارات في `tests/rules.test.mjs` (اللي يتسمح واللي يترفض).
- **أي ملف JS/CSS جديد** في المتجر:
  - يتضاف في الصفحات بالترتيب الصح.
  - يتضاف في `CORE` جوه `sw.js`، و `tools/check.mjs` بيتأكد من ده.
  - تزوّد `VERSION`.
- **الصفحات بتكلم `App.db` بس**، عمرها ما تكلم Firestore أو localStorage مباشرة. كده الوضع التجريبي ووضع Firebase بيفضلوا شغالين بنفس الكود.
- **عمليات الأدمن المهمة** بتتسجل بـ `App.audit.log(...)`.
- **الصلاحيات في الواجهة** بـ `App.can('perm')`، ونفس الاسم لازم يبقى في `firestore.rules` و `App.PERMISSIONS`.
- **المدير العام** (`role: 'super_admin'`) عنده كل الصلاحيات حتى لو `roles/` فاضي. ده مقصود، علشان أول تجهيز للمتجر.

## الاختبارات
```bash
node tools/check.mjs                                  # لازم يعدّي قبل أي commit (والـ Action بيشغله)
python3 -m http.server 8080 &
NODE_PATH=$(npm root -g) node tests/smoke.mjs         # الوضع التجريبي: موبايل + ديسكتوب
# وضع Firebase على الـ Emulator، والتفاصيل في آخر FIREBASE_SETUP.md:
#   tests/rules.test.mjs   ← قواعد الأمان
#   tests/live-emulator.mjs ← الموقع كامل في وضع Firebase
```

## ملاحظات معروفة
- **`data/demo-data.js`** بيتحمّل في كل الصفحات. بيستخدم في الوضع التجريبي، وفي زرار "تجهيز المتجر" في اللوحة. ممكن بعدين يتحمّل بس وقت الحاجة.
- **اللوحة عربي بس.** النصوص اللي العميل بيشوفها في `js/core/i18n.js` (عربي + إنجليزي).
- **طلباتي في حسابي** بتعرض رقم الطلب والإجمالي بس. التفاصيل في المرحلة 6.
- **روابط لسه مش شغالة:** `shop.html` و `cart.html` و `wishlist.html` و `track.html` و `policies.html`. هتتعمل في المراحل 4–8.
