# متجر ملابس — Store + Admin

متجر ملابس أونلاين (رجالي، وحريمي، وأطفال، وأحذية، وإكسسوارات)، ومعاه لوحة تحكم على `/admin/`.

- **التقنية:** HTML + CSS + Vanilla JavaScript، من غير build step، و Firebase (Auth + Firestore) على الخطة المجانية Spark، والنشر على GitHub Pages.
- **التصميم الكامل:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
- **قواعد الشغل:** [`AGENTS.md`](AGENTS.md).

> الحالة: **المرحلة 1 (الأساس)**. باقي المراحل في `docs/ARCHITECTURE.md` (الجزء 12).

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
js/core/      core · config · i18n · money · validate · db (+ db-demo, db-firebase)
js/services/  catalog · settings · images · governorates
js/ui/        common (هيدر/فوتر) · product-card · icons
js/pages/     home · notfound
data/         demo-data.js (للوضع التجريبي بس)
admin/        لوحة التحكم (المرحلة 2 وما بعدها)
tools/        check.mjs
tests/        smoke.mjs
```

## اللي لسه جاي
الدخول، والمنتجات والمخزون، والمتجر الكامل، والسلة، والـ checkout، والطلبات، والدفع، والشحن، ولوحة التحكم، والتقارير، والكوبونات، والتقييمات، و Firebase الحقيقي، و SEO. وفي آخر مرحلة هيتضاف لـ README:
- إعداد الدفع.
- ربط شركات الشحن.
- إنشاء حساب الأدمن.
- خطوات النشر بالتفصيل.
