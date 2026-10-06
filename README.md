# متجر ملابس — Store + Admin

متجر ملابس أونلاين (رجالي، وحريمي، وأطفال، وأحذية، وإكسسوارات)، ومعاه لوحة تحكم على `/admin/`.

- **التقنية:** HTML + CSS + Vanilla JavaScript، من غير build step، و Firebase (Auth + Firestore) على الخطة المجانية Spark، والنشر على GitHub Pages.
- **التصميم الكامل:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- **قواعد الشغل:** [`AGENTS.md`](AGENTS.md).

> الحالة: **المرحلة 5 خلصت — السلة ومراجعة التوصيل جاهزين؛ مطلوب نشر قواعد المرحلة 5 يدويًا** (rules متجربة على الـ Emulator). الخطوات اللي هتعملها بإيدك في [`FIREBASE_SETUP.md`](FIREBASE_SETUP.md)، والتسليم للي هيكمل في [`docs/HANDOFF.md`](docs/HANDOFF.md).

## التشغيل محلياً
مش محتاج تسطّب أي حاجة:

```bash
python3 -m http.server 8080
# افتح http://localhost:8080
```

وممكن كمان تفتح `index.html` مباشرة من الملفات.

## الوضع التجريبي
لو `firebase-config.js` فيه `window.FIREBASE_CONFIG = null`، المتجر بيشتغل كامل على localStorage، ومعاه بيانات تجريبية من `data/demo-data.js`:
- أقسام.
- 12 منتج بألوان ومقاسات.
- أسعار شحن تجريبية.

وبيظهر شريط "المنتجات والأسعار المعروضة تجريبية".

علشان ترجّع البيانات التجريبية لأولها: افتح الـ console واكتب `App.DemoAdapter.reset()`.

**تجربة اللوحة في الوضع التجريبي:** افتح `/admin/` واختار مدير عام. مفيش باسورد في الوضع التجريبي؛ اللوحة مخصصة لصاحب المتجر فقط.

## الحسابات والصلاحيات
- **العملاء:** إيميل وباسورد، أو Google. بيعملوا كده من `account.html` (تسجيل، ودخول، ونسيت الباسورد، وتغيير الباسورد، والبروفايل، والعناوين).
- **الأدمن:** `admins/{uid}` فيه `role`، و `roles/{id}` فيه `permissions[]`، و `firestore.rules` بتتحقق منهم.
- **أول مدير عام:** بيتعمل بإيدك من Firebase Console، والخطوات في `FIREBASE_SETUP.md` (الخطوة 8). بعد كده بتعمل الآتي من اللوحة:
  - **تجهيز المتجر:** الأدوار، والأقسام، والألوان، والمقاسات، والإعدادات.
  - **المنتجات والأقسام والمخزون:** إدارة الصور والتركيبات والكميات وسجل الحركات.
  - **الإعدادات:** اسم المتجر والواتساب وأسعار الشحن لكل محافظة وحد المخزون القليل.

## الفحص قبل كل commit
```bash
node tools/check.mjs                                   # syntax + اختبارات الـ services + سلامة البيانات
python3 -m http.server 8080 &
NODE_PATH=$(npm root -g) node tests/smoke.mjs          # Playwright: موبايل + ديسكتوب، عربي/إنجليزي، فاتح/داكن
# الـ screenshots بتتحفظ في tests/screenshots/
```

`tools/` و `tests/` بس هما اللي بيستخدموا Node. الموقع نفسه مفيهوش npm.

## النشر (GitHub Pages)
مع كل push على `main`، الـ Action في `.github/workflows/deploy.yml` بيعمل الآتي:
1. يشغّل `tools/check.mjs`.
2. ينسخ ملفات الموقع لـ `_site`.
3. ينشرها.

**التفعيل (مرة واحدة):** GitHub ← الريبو ← **Settings** ← **Pages** ← **Source: GitHub Actions**.

## هيكل الملفات (مختصر)
```
index.html, 404.html, sw.js, manifest.webmanifest, firebase-config.js
assets/css/   tokens.css (الألوان والمسافات) · base.css · components.css · store.css
js/core/      core · config · i18n · money · validate · db (+ db-demo, db-firebase) · auth
js/services/  catalog · storefront · wishlist · catalog-admin · settings · settings-admin · images · governorates · addresses · audit
js/ui/        common (هيدر/فوتر) · product-card · forms · icons
js/pages/     home · shop · product · wishlist · cart · checkout · account · notfound
data/         demo-data.js (للوضع التجريبي بس)
admin/        لوحة التحكم: admin.js (الدخول والراوتر) · admin-ui · overview · products · categories · catalog-meta · inventory · settings · audit · setup
firestore.rules, firestore.indexes.json, firebase.json, FIREBASE_SETUP.md
tools/        check.mjs
tests/        smoke.mjs (تجريبي) · rules.test.mjs · live-emulator.mjs (Firebase Emulator)
```

## اللي لسه جاي
إرسال الطلبات، والدفع، والشحن، ولوحة التحكم، والتقارير، والكوبونات، والتقييمات، و SEO. التفاصيل في `docs/HANDOFF.md`. وفي آخر مرحلة هيتضاف لـ README:
- إعداد الدفع.
- ربط شركات الشحن.
- إنشاء حساب الأدمن.
- خطوات النشر بالتفصيل.


## صفحات المتجر الحالية
- `shop.html`: البحث والفلاتر والترتيب وصفحات النتائج.
- `product.html?slug=...`: الصور والألوان والمقاسات والسعر والمخزون المتاح.
- `wishlist.html`: مفضلة للزائر والحساب.
- تفاصيل التحقق: [`docs/STAGE4-VALIDATION.md`](docs/STAGE4-VALIDATION.md).

السلة ومراجعة العنوان والإجمالي جاهزين. إرسال الطلبات والدفع مراحل لاحقة؛ المرحلة الحالية لا تتيح إتمام شراء.


- `cart.html`: السلة والكميات والكوبون الاختياري وحساب الشحن.
- `checkout.html`: العنوان وملخص المراجعة بدون إرسال طلب.
- [التحقق من المرحلة 5](docs/STAGE5-VALIDATION.md).
- قبل الاستخدام: انسخ `firestore.rules` إلى Firebase Console ← Firestore Database ← Rules ← Publish.

## Excel للمنتجات

من اللوحة ← المنتجات: **استيراد Excel** مع قالب ومعاينة قبل الحفظ، و**تصدير البضاعة** كملف `.xlsx`. طريقة الاستخدام والحدود في [دليل Excel](docs/PRODUCT-EXCEL.md).
