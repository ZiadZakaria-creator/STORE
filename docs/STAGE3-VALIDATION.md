# التحقق من المرحلة 3

تم التحقق على الوضع التجريبي ومحاكي Firebase، بدون كتابة في `store-4cfd5` الحقيقي.

- `node tools/check.mjs`: 747 اختبار ناجح، وصحة syntax لـ40 ملف JavaScript. تشمل التعارض بين الكتابات، والأكواد المكررة، والنماذج القديمة، وسلامة حذف البيانات التجريبية، والإعدادات والصلاحيات.
- `CHROMIUM_PATH=/usr/bin/chromium node tests/smoke.mjs http://127.0.0.1:8080/`: 18 رحلة على موبايل 390×844 وديسكتوب 1440×900؛ إضافة منتج وصورة وتركيبة، وتعديل المخزون، وترتيب الأقسام، وإضافة لون، وحفظ الإعدادات، وظهور التغيير في الرئيسية، وإخفاء المنتج، وسجل العمليات. لا أخطاء console أو خروج أفقي للصفحات.
- `NODE_PATH=/tmp/store-rule-tools/node_modules node tests/rules.test.mjs`: 82 اختبار قواعد ناجح على Firestore Emulator (8085).
- `CHROMIUM_PATH=/usr/bin/chromium SDK_DIR=/tmp/store-firebase-sdk BASE_URL=http://127.0.0.1:8080/ node tests/live-emulator.mjs`: 14 رحلة ناجحة باستخدام Auth Emulator (9099) وFirestore Emulator (8085)، وتشمل SDK الحقيقي ورفع الصور والمعاملات وسجل المخزون ومنع دخول العملاء للوحة.

الاختبارات تحتاج أدوات Node/Playwright وFirebase للاختبار فقط؛ الموقع نفسه لا يحتاج npm أو build. `SDK_DIR` يحتوي ملفات Firebase SDK 10.14.1 المحلية لتشغيل الاختبارات عند تعذر gstatic.

الصور في `tests/screenshots/` (مخرجات محلية غير مضافة إلى Git): `stage3-products-*` و`stage3-editor-*` و`stage3-categories-*` و`stage3-meta-*` و`stage3-inventory-*` و`stage3-settings-*` و`stage3-audit-*` و`live-stage3-inventory.png`. تمت معاينة صور الموبايل والديسكتوب.

رحلة السلة والدفع والطلبات لم تُختبر لأنها غير منفذة بعد؛ تخص المراحل 5–8. هذه المرحلة تتحقق من إدارة الكتالوج وظهوره في الرئيسية الحالية.

القواعد الجديدة لا تُنشر مع GitHub Pages. يجب نسخ `firestore.rules` بالكامل إلى Firebase Console ← Firestore Database ← Rules ← Publish قبل استخدام الإدارة الجديدة.
