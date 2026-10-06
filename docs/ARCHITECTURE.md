> تحديث المرحلة 3: اللوحة مخصصة لمدير عام واحد؛ لا توجد إدارة موظفين في الواجهة. جدول الأدوار أدناه توثيق للتصميم القديم والتوافق فقط. تفاصيل التنفيذ الحالية في HANDOFF.md.

# معمارية متجر الملابس

> الملف ده بيوصف التصميم النهائي قبل التنفيذ. القرارات الأساسية اتاخدت مع صاحب المتجر:
> - **الأدوات:** نفس أدوات GTECH: HTML + CSS + Vanilla JS، و Firebase (Auth + Firestore) على خطة Spark المجانية، والنشر على GitHub Pages. من غير Next.js ولا Prisma ولا build step.
> - **الدفع:** الدفع عند الاستلام + التحويل (إنستاباي / فودافون كاش) مع رفع صورة التحويل. الكود هيبقى جاهز إن Paymob و Stripe يتضافوا بعدين.
>
> القواعد الثابتة موجودة في `AGENTS.md`، ولها الأولوية على أي حاجة هنا.

---

## 1) تحليل المتطلبات

### اللي هيتنفذ كامل بالأدوات دي
| المتطلب | إزاي هيتنفذ |
|---|---|
| كتالوج بأقسام وأقسام فرعية من غير حد | collection اسمه `categories` وفيه `parentId` و `order`. الأدمن يضيف ويعدل ويمسح ويرتب بالسحب |
| منتج بألوان ومقاسات ومخزون لكل تركيبة | `variants[]` جوه المنتج، ولكل variant: `sku` و `stock` و `reserved` و `sold` |
| بحث وفلترة وترتيب | بيتعمل في المتصفح على نسخة الكتالوج المحفوظة (سريع ومن غير قراءات زيادة) |
| سلة محفوظة، وكوبون، وشحن حسب المحافظة | السلة في localStorage، ونسخة منها في Firestore للعميل اللي عامل دخول (علشان السلات المتروكة) |
| Checkout بكل حقول العنوان المصري | 27 محافظة، والمحافظات اللي مش بنوصلها بتبقى مقفولة من الإعدادات |
| حسابات العملاء | Firebase Auth: تسجيل، ودخول، وخروج، ونسيت الباسورد، وتغيير الباسورد، و Google. ومعاه بروفايل وأكتر من عنوان |
| تتبع الطلب برقم الطلب أو من الحساب | collection عام اسمه `tracking` من غير أي بيانات شخصية، و timeline مرسوم |
| لوحة تحكم على `/admin/` بصلاحيات (RBAC) | `admins/{uid}` فيه `role`، و `roles/{id}` فيه `permissions[]`، و `firestore.rules` بتتحقق منهم |
| مخزون، وتنبيهات مخزون قليل بحد بيحدده الأدمن | `lowStockThreshold` عام في الإعدادات، وممكن يتغير لكل منتج |
| طلبات: تغيير حالة، وتأكيد دفع، ورقم شحنة، وملاحظات، وفاتورة | صفحة الطلبات في اللوحة، والفاتورة صفحة للطباعة |
| عملاء: عدد الطلبات وإجمالي الصرف وتاريخ الطلبات | بيتحسبوا من `orders` |
| كوبونات بكل الأنواع المطلوبة | `coupons/{CODE}` |
| عروض: Sale و Flash sale وخصم قسم وخصم منتج وبانرات وحملات | `promotions` وبتاريخ بداية ونهاية **حقيقيين** (ممنوع عدادات وهمية) |
| تقييمات من اللي اشتروا بس، والأدمن يوافق أو يخفي أو يمسح | `reviews`، والـ rules بتتأكد إن الطلب بتاع نفس العميل واتوصل |
| تقارير بفلاتر زمنية، وتصدير CSV / Excel | بتتحسب في اللوحة. التصدير CSV بـ UTF-8 BOM، وده بيفتح في Excel بالعربي صح |
| Audit log | `auditLogs` بيتكتب مع كل عملية مهمة للأدمن، ومحدش يقدر يعدله أو يمسحه |
| عربي/إنجليزي، و RTL، والعملة ج.م | `i18n.js`، والحقول اللي بتتكتب بلغتين بتتخزن كده `{ar, en}`، والعملة من الإعدادات |
| SEO بلينكات نضيفة `/products/black-oversized-tshirt/` | `tools/build-seo.mjs` بيولّد صفحة HTML لكل منتج وقسم مع كل نشر، وكل 6 ساعات |
| صور متصغّرة و lazy | الصورة بتتصغّر في المتصفح لـ webp، و `loading="lazy"`، ومقاسات ثابتة علشان الصفحة متتهزش |

### اللي محتاج سيرفر (اتأجل، والكود جاهز يستقبله)
| المتطلب | السبب | البديل دلوقتي |
|---|---|---|
| الدفع بالكارت (Paymob / Stripe) و webhooks | المفاتيح السرية والتحقق من الـ webhook لازم يبقوا على سيرفر | التحويل مع صورة، والأدمن بيأكد. وفيه `payment.js` بـ adapters جاهزة |
| رسايل SMS | محتاجة مزود مدفوع ومفتاح سري | الإيميل عن طريق EmailJS (مجاني)، والواتساب بزرار `wa.me` بيفتح رسالة جاهزة للأدمن |
| ربط API شركة شحن | المفاتيح سرية | الأدمن بيكتب رقم الشحنة واسم الشركة، ولينك التتبع بيتولد من قالب |
| Rate limiting حقيقي | محتاج سيرفر | Firebase App Check (مجاني)، وحدود على أحجام الحقول في الـ rules، ومنع التكرار من المتصفح |

### حدود الخطة المجانية (Spark) اللي لازم نعرفها
- 50 ألف قراءة و 20 ألف كتابة في اليوم، و 1 جيجا تخزين. علشان كده المتجر بيقرا الكتالوج **مرة واحدة** ويحفظه في localStorage، ويحدّثه في الخلفية.
- الصورة الواحدة في Firestore بتتصغّر لحد ~150KB، فالـ 1 جيجا تشيل حوالي 5000 صورة.
- مفيش Cloud Functions، فكل حاجة "أوتوماتيك" بتحصل من متصفح الأدمن، زي خصم المخزون لما الطلب يتأكد.

---

## 2) المعمارية

```
┌──────────────────────────── GitHub Pages (static) ────────────────────────────┐
│  المتجر (/)                                 اللوحة (/admin/)  noindex          │
│  HTML + CSS + Vanilla JS                    HTML + CSS + Vanilla JS           │
│        │                                            │                         │
│        ▼                                            ▼                         │
│  js/core/db.js  ← طبقة بيانات واحدة، وتحتها adapter من اتنين:                   │
│     • DemoAdapter  (localStorage)  ← لو firebase-config.js فاضي               │
│     • FirebaseAdapter                                                         │
│          - قراءة المتجر: Firestore REST + كاش في localStorage                  │
│          - الكتابة واللوحة والدخول: Firebase JS SDK (بيتحمّل وقت الحاجة بس)    │
└───────────────────────────────────────────────────────────────────────────────┘
                 │                                  │
                 ▼                                  ▼
        Firebase Auth                     Firestore + firestore.rules
                                                    ▲
GitHub Actions: deploy.yml ── build-seo.mjs (يقرا REST) ── _site ── Pages
                └── cron كل 6 ساعات
```

**المبادئ:**
1. **طبقة بيانات واحدة (`db.js`)**: كل الصفحات بتكلمها هي بس، ومحدش بيكلم Firestore أو localStorage مباشرة. ده اللي بيخلي الوضع التجريبي يشتغل كامل، وبيخلي تغيير قاعدة البيانات بعدين سهل.
2. **Services منفصلة** للقواعد التجارية: التسعير، والكوبونات، والشحن، والمخزون، والدفع، والإشعارات. كل واحدة دوال صغيرة من غير DOM، فتتجرب لوحدها.
3. **Classic scripts** مش ES modules، علشان الموقع يفتح من `index.html` مباشرة (file://). كل ملف بيسجل نفسه في `window.App`.
4. **الأسعار مش متخزنة في الكود.** `data.js` فيه بيانات تجريبية للوضع التجريبي بس، والأسعار الحقيقية بتيجي من اللوحة.

---

## 3) هيكل الملفات

```
/
├── index.html              الرئيسية
├── shop.html               كل المنتجات + الفلترة والترتيب والبحث (?cat=&q=)
├── product.html            صفحة المنتج (/products/<slug>/ بتتولد منها)
├── cart.html               السلة كاملة (وفيه كمان سلة جانبية في كل الصفحات)
├── checkout.html
├── account.html            الدخول/التسجيل، والبروفايل، والعناوين، وطلباتي، والمفضلة
├── track.html              تتبع برقم الطلب
├── wishlist.html
├── policies.html           الاستبدال والاسترجاع والشحن والخصوصية
├── 404.html
├── manifest.webmanifest
├── sw.js                   PWA (VERSION بيزيد مع كل تغيير)
├── firebase-config.js      فاضي = وضع تجريبي
├── robots.txt
│
├── assets/
│   ├── css/
│   │   ├── tokens.css      الألوان والمسافات والخطوط (:root + dark/light)
│   │   ├── base.css        reset + typography + RTL
│   │   ├── components.css  أزرار، وكروت، وفورم، و drawer، و toast، و modal
│   │   └── store.css       أقسام المتجر
│   ├── icons/              SVG
│   └── img/                لوجو وأيقونات PWA
│
├── js/
│   ├── core/
│   │   ├── core.js         App namespace، و store (localStorage)، و esc()، و debounce، و ids
│   │   ├── config.js       قراءة firebase-config، وتحديد الوضع (demo / live)
│   │   ├── i18n.js         قاموس ar/en، وتبديل اللغة والاتجاه
│   │   ├── money.js        تنسيق العملة (EGP افتراضي، وقابل يتوسع)
│   │   ├── validate.js     التحقق من الحقول (موبايل مصري، إيميل، طول...)
│   │   ├── db.js           الواجهة الموحدة للبيانات
│   │   ├── db-demo.js      DemoAdapter
│   │   ├── db-firebase.js  FirebaseAdapter (REST للقراءة + SDK للكتابة)
│   │   └── auth.js         الدخول والتسجيل وحالة المستخدم
│   ├── services/
│   │   ├── catalog.js      المنتجات والأقسام والفلترة والبحث والترتيب
│   │   ├── pricing.js      السعر النهائي (خصم المنتج والقسم والعروض)
│   │   ├── inventory.js    المتاح = stock − reserved، والحجز، والخصم، والإرجاع
│   │   ├── cart.js         السلة وحساب الإجمالي
│   │   ├── coupons.js      التحقق من الكوبون وحساب الخصم
│   │   ├── shipping.js     سعر الشحن حسب المحافظة، و carriers registry
│   │   ├── payment.js      payment providers registry
│   │   ├── orders.js       إنشاء الطلب، والحالات، والانتقالات المسموحة
│   │   ├── notifications.js قوالب + channels (email / whatsapp / sms)
│   │   ├── images.js       تصغير الصور (canvas → webp/jpeg) و fs:<id>
│   │   └── governorates.js المحافظات المصرية (ar/en)
│   ├── ui/
│   │   ├── common.js       الهيدر والفوتر والسلة الجانبية والقائمة والـ toast
│   │   ├── product-card.js
│   │   ├── timeline.js     timeline التتبع
│   │   └── seo.js          meta و canonical و JSON-LD وقت التشغيل
│   └── pages/
│       ├── home.js  shop.js  product.js  cart.js  checkout.js
│       ├── account.js  track.js  wishlist.js
│
├── admin/
│   ├── index.html          shell: sidebar + topbar + <main> (hash routing)
│   ├── admin.css
│   └── js/
│       ├── admin.js            الراوتر، والصلاحيات، والـ sidebar badges
│       ├── admin-ui.js         جداول، وفورم، و modal، و charts (SVG)
│       ├── admin-overview.js   KPIs والرسوم البيانية
│       ├── admin-orders.js     الطلبات والفاتورة
│       ├── admin-products.js   المنتجات والـ variants والصور والتكرار
│       ├── admin-categories.js الأقسام والترتيب
│       ├── admin-catalog-meta.js الماركات والألوان والمقاسات
│       ├── admin-inventory.js  المخزون والتنبيهات
│       ├── admin-customers.js
│       ├── admin-coupons.js
│       ├── admin-promotions.js العروض والبانرات
│       ├── admin-reviews.js
│       ├── admin-returns.js    المرتجعات والاسترداد
│       ├── admin-reports.js    التقارير والتصدير
│       ├── admin-shipping.js   أسعار الشحن وشركات الشحن
│       ├── admin-settings.js   بيانات المتجر، والدفع، وقوالب الإشعارات
│       ├── admin-staff.js      الأدمنز والأدوار والصلاحيات
│       └── admin-audit.js
│
├── data/
│   └── demo-data.js        بيانات الوضع التجريبي (أقسام، ومنتجات، وألوان، ومقاسات)
├── firestore.rules
├── firestore.indexes.json
├── tools/
│   ├── build-seo.mjs       صفحات المنتجات والأقسام + sitemap.xml
│   └── check.mjs           فحص سريع (syntax لكل الملفات + اختبارات الـ services)
├── tests/                  اختبارات Playwright (بتتشغل محلي، مش جزء من الموقع)
├── .github/workflows/deploy.yml
├── README.md
├── FIREBASE_SETUP.md
└── EMAIL_SETUP.md
```

> **ملحوظة:** `tools/` و `tests/` بس هما اللي بيستخدموا Node. الموقع نفسه مفيهوش npm ولا build.

---

## 4) قاعدة البيانات (Firestore)

Firestore مش قاعدة بيانات جداول، فالتصميم معمول **على حسب طريقة القراءة**: الحاجة اللي بتتقري مع بعض بتتخزن مع بعض. والعلاقات بتبقى بـ IDs. الجدول ده بيوضح كل entity في المتطلبات اتحطت فين:

| Entity في المتطلبات | في Firestore |
|---|---|
| Users / Customers | `users/{uid}` |
| Addresses | `users/{uid}/addresses/{id}` |
| Roles / Permissions | `roles/{roleId}`، والصلاحيات قايمة ثابتة في الكود (`PERMISSIONS`) |
| Admin users | `admins/{uid}` |
| Categories | `categories/{id}` (ومعاه `parentId`) |
| Brands / Colors / Sizes | `brands/{id}`، `colors/{id}`، `sizes/{id}` |
| Products / ProductVariants / Inventory | `products/{id}` ومعاه `variants[]` (المخزون لكل variant) |
| ProductImages | `productImages/{id}` (الصورة نفسها) + `products.images[]` = `fs:<id>` |
| Inventory movements | `inventoryLogs/{id}` |
| Carts / CartItems | localStorage + `carts/{uid}` (للسلات المتروكة) |
| Wishlists | `users/{uid}.wishlist[]` + localStorage للزوار |
| Orders / OrderItems | `orders/{id}` ومعاه `items[]` |
| Payments | `orders/{id}.payment` + `payments/{id}` (سجل كل محاولة دفع) |
| Shipments / ShipmentTrackingHistory | `orders/{id}.shipment` + `orders/{id}.timeline[]`، ونسخة عامة في `tracking/{orderNumber}` |
| Coupons | `coupons/{CODE}` |
| Promotions / Banners | `promotions/{id}` |
| Reviews | `reviews/{id}` |
| Notifications | `notifications/{id}` (outbox)، والقوالب في `settings/notifications` |
| Returns / Refunds | `returns/{id}`، `refunds/{id}` |
| AuditLogs | `auditLogs/{id}` |
| Newsletter | `newsletter/{id}` |
| Settings | `settings/{general|shipping|payment|inventory|notifications|home}` |

### الحقول الأساسية

```js
// categories/{id}
{ name:{ar,en}, slug, parentId:null|id, order:Number, image:'fs:..'|'', hidden:false,
  seo:{title,description}, createdAt, updatedAt }

// products/{id}
{ slug:'black-oversized-tshirt', sku:'TSHIRT-OVS', name:{ar,en}, description:{ar,en},
  categoryId, subcategoryId, brandId, tags:[],
  price:Number, salePrice:Number|null,          // ج.م
  images:['fs:abc', ...],
  colorImages:{ BLK:['fs:..'] },                 // صور خاصة بلون معين (اختياري)
  variants:[ { sku:'TSHIRT-OVS-BLK-M', color:'BLK', size:'M',
               stock:10, reserved:0, sold:0, priceDelta:0 } ],
  lowStockThreshold:null|Number,                 // null = الافتراضي من الإعدادات
  featured:false, isNew:true, hidden:false,
  ratingAvg:0, ratingCount:0, soldCount:0,
  seo:{title,description}, createdAt, updatedAt }

// colors/{code}   { name:{ar,en}, hex:'#000000', order }
// sizes/{id}      { label:'M', group:'apparel'|'shoes'|'kids'|'one', order }
// brands/{id}     { name, slug, logo:'fs:..'|'', order }

// orders/{id}
{ number:'CL-2510-7K3QX',            // عشوائي وصعب يتخمن، وبيستخدم في التتبع
  uid:null|uid,
  customer:{ name, phone, email },
  address:{ governorate, city, area, street, building, floor, apartment, notes },
  items:[ { productId, sku, name, color, size, qty, unitPrice, image } ],
  productIds:[...],                   // علشان rules التقييمات
  totals:{ subtotal, productDiscount, couponDiscount, shipping, total, currency:'EGP' },
  coupon:null|'WELCOME10',
  payment:{ method:'cod'|'instapay'|'vodafone_cash'|'paymob_card'|'stripe_card',
            status:'pending'|'paid'|'failed'|'refunded'|'partially_refunded',
            proof:'fs:..'|null, transactionId:null, paidAt:null },
  status:'placed', // placed|payment_confirmed|processing|preparing|ready_to_ship|shipped|out_for_delivery|delivered|cancelled|returned
  shipment:{ carrier:null, trackingNumber:null, trackingUrl:null, eta:null, status:null },
  timeline:[ { status, at, by:'customer'|'admin:<uid>', note } ],
  stockApplied:false,                 // اتعمل حجز مخزون ولا لأ
  adminNotes:'', createdAt, updatedAt }

// tracking/{number}  (عام، من غير بيانات شخصية)
{ status, timeline:[{status, at}], shipment:{carrier, trackingNumber, trackingUrl, eta}, updatedAt }

// coupons/{CODE}
{ type:'percent'|'fixed', value, minOrder, maxDiscount, startsAt, expiresAt,
  usageLimit, usedCount, perCustomerLimit, allowedUids:[], active:true }

// promotions/{id}
{ kind:'sale'|'flash'|'category'|'product'|'banner'|'campaign',
  title:{ar,en}, percent, targets:{categoryIds:[], productIds:[]},
  banner:{ image, link }, startsAt, endsAt, active, order }

// reviews/{id}
{ productId, uid, orderId, name, rating:1..5, text, images:[], status:'pending'|'approved'|'hidden', createdAt }

// roles/{id}        { name:{ar,en}, permissions:['orders.read','orders.write', ...] }
// admins/{uid}      { name, email, role:'super_admin'|..., active:true }
// auditLogs/{id}    { by:uid, byName, action, entity, entityId, before, after, at }
// inventoryLogs/{id}{ productId, sku, delta:{stock,reserved,sold}, reason, orderId, by, at }
// notifications/{id}{ channel:'email'|'sms'|'whatsapp', template, to, orderId, status:'queued'|'sent'|'failed', error, at }
// returns/{id}      { orderId, uid, items:[], reason, status:'requested'|'approved'|'rejected'|'received', at }
// refunds/{id}      { orderId, amount, method, note, by, at }
```

### دورة المخزون (من غير سيرفر)
- **المتاح للعميل** = `stock − reserved`. المتجر بيمنع إضافة أكتر من المتاح للسلة، وبيتحقق تاني وقت الـ checkout.
- **الطلب اتعمل (`placed`):** المخزون لسه متحجزش، لأن العميل مش مسموح له يكتب في المنتجات.
- **الأدمن أكّد / بدأ التجهيز:** `reserved += qty` في transaction واحدة، ولو الكمية مش كفاية العملية بتفشل وبتظهر رسالة.
- **اتشحن:** `stock −= qty`، و `reserved −= qty`، و `sold += qty`.
- **اتلغى قبل الشحن:** `reserved −= qty`. **اترجع:** `stock += qty`.
- كل حركة بتتسجل في `inventoryLogs` و `auditLogs`.
- **عيب معروف:** طلبين على آخر قطعة في نفس الوقت ممكن يتعملوا الاتنين. الأدمن هيعرف وقت التأكيد، لأن الـ transaction هتفشل وهتقوله إن الكمية مش كفاية.

### Indexes
`firestore.indexes.json` فيه indexes للحاجات دي: `orders` بالـ (`status`, `createdAt`)، و (`uid`, `createdAt`)، و `reviews` بالـ (`productId`, `status`, `createdAt`)، و `auditLogs` بالـ (`entity`, `at`).

---

## 5) معمارية الـ API

مفيش سيرفر، فالـ "API" هو `db.js`، وهو واجهة موحدة بنفس الدوال في الوضعين:

```js
App.db.list('products', { where, orderBy, limit, after })   // pagination بـ cursor
App.db.get('products', id)
App.db.add('orders', data) / set / update / remove
App.db.tx(async t => { ... })                               // transaction
App.db.watch('orders', query, cb)                           // لحظي في اللوحة وطلباتي
```

- **قراءة المتجر:** Firestore REST (`runQuery` و `documents`)، ومن غير SDK، علشان الصفحة تبقى خفيفة. النتيجة بتتحفظ في localStorage ومعاها وقت، ونظام stale-while-revalidate: الصفحة بتعرض النسخة المحفوظة على طول، وبتحدّثها في الخلفية.
- **الكتابة واللوحة:** Firebase JS SDK، وبيتحمّل وقت الحاجة بس (لما العميل يعمل دخول، أو في الـ checkout، أو في اللوحة).
- **الـ Services** (`pricing` و `coupons` و `shipping` و `orders` ...) دوال من غير DOM فوق `db`، والصفحات بتستخدمها. وده نفس الـ layering اللي في الـ REST API: صفحة ← service ← db adapter.
- **الحماية الحقيقية في `firestore.rules`**، مش في كود المتصفح.

---

## 6) الدخول والصلاحيات

### العملاء
- Firebase Auth: **إيميل + باسورد** (تسجيل، ودخول، وخروج، ونسيت الباسورد، وتغيير الباسورد) و **Google**.
- الباسوردات Firebase اللي بيعملها hash وبيخزنها، وإحنا مبنشوفهاش ولا بنخزنها.
- بعد أول دخول بنطلب رقم الموبايل مرة واحدة، وبيتحفظ في `users/{uid}`.
- في الوضع التجريبي: حسابات تجريبية في localStorage، علشان الرحلة كلها تتجرب.

### الأدمن (RBAC)
- `admins/{uid}.role` ← `roles/{role}.permissions[]`.
- الصلاحيات: `dashboard.view`، `orders.read`، `orders.write`، `payments.confirm`، `products.write`، `inventory.write`، `categories.write`، `customers.read`، `coupons.write`، `promotions.write`، `reviews.moderate`، `reports.view`، `settings.write`، `staff.manage`، `audit.read`.
- الأدوار الافتراضية:

| الصلاحية | Super Admin | Store Manager | Inventory Manager | Customer Support | Accountant |
|---|:-:|:-:|:-:|:-:|:-:|
| الطلبات (قراءة) | ✓ | ✓ | ✓ | ✓ | ✓ |
| الطلبات (تعديل الحالة) | ✓ | ✓ | – | ✓ | – |
| تأكيد الدفع والاسترداد | ✓ | ✓ | – | – | ✓ |
| المنتجات والأقسام | ✓ | ✓ | ✓ | – | – |
| المخزون | ✓ | ✓ | ✓ | – | – |
| العملاء | ✓ | ✓ | – | ✓ | ✓ |
| الكوبونات والعروض | ✓ | ✓ | – | – | – |
| التقييمات | ✓ | ✓ | – | ✓ | – |
| التقارير | ✓ | ✓ | ✓ | – | ✓ |
| الإعدادات | ✓ | ✓ | – | – | – |
| الموظفين والأدوار، و Audit log | ✓ | – | – | – | ✓ (audit بس) |

- **في الواجهة:** الـ sidebar بيخفي الأقسام اللي مش مسموحة. **في `firestore.rules`:** كل كتابة بتتحقق من الصلاحية:
  ```
  function perms() { return get(/databases/$(db)/documents/roles/$(get(/databases/$(db)/documents/admins/$(request.auth.uid)).data.role)).data.permissions; }
  function can(p) { return isAdmin() && (p in perms() || 'all' in perms()); }
  ```
- أول Super Admin بيتعمل **بإيدك** من Firebase Console (الخطوات هتبقى في FIREBASE_SETUP.md)، ومفيش أي باسورد في الكود.

### الأمان
| المتطلب | التنفيذ |
|---|---|
| Hashing | Firebase Auth |
| Validation | `validate.js` في المتصفح + `firestore.rules` (الأنواع والأطوال والقيم المسموحة) |
| SQL injection | مش موجود أصلاً (مفيش SQL)، و Firestore بيستقبل بيانات structured |
| XSS | كل نص جاي من المستخدم بيتعرض بـ `textContent` أو `App.esc()`، وفيه Content-Security-Policy في كل الصفحات |
| CSRF | مش موجود، لأن مفيش cookies للجلسة، والطلبات بـ ID token |
| Rate limiting | Firebase App Check (reCAPTCHA v3 مجاني، واختياري)، وحد أقصى للحقول، ومنع التكرار في المتصفح |
| حماية `/admin/` | `noindex`، ومفيش لينك ليها، والبيانات محمية بالـ rules مش بإخفاء الصفحة |
| الأسرار | مفيش أسرار في الريبو. مفتاح Firebase Web عام بطبيعته |
| سعر الطلب | الـ rules بتتأكد إن الأرقام أرقام وموجبة، واللوحة **بتعيد حساب** الإجمالي من أسعار المنتجات وبتعلّم أي فرق قبل التأكيد |

---

## 7) معمارية الدفع

```js
// js/services/payment.js
App.payment.register({
  id: 'cod',
  label: { ar:'الدفع عند الاستلام', en:'Cash on delivery' },
  isAvailable(settings, order) {...},  // مفعّل من الإعدادات؟ في حد أقصى؟
  async start(order) { return { status:'pending' } },
  // providers الأونلاين بس:
  async verify(order, payload) {...}
});
```

| Provider | الحالة | التدفق |
|---|---|---|
| `cod` | شغال | الطلب `pending`، والأدمن بيعلّمه `paid` وقت التسليم |
| `instapay` / `vodafone_cash` | شغال | العميل بيشوف بيانات التحويل من الإعدادات، وبيرفع صورة (`paymentProofs`) أو يبعتها واتساب، والأدمن بيأكد ← `paid` |
| `paymob_card` / `paymob_wallet` | جاهز ومقفول | `start()` بتنادي `PAYMENT_SERVER_URL/paymob/intention` ← redirect لـ Paymob ← Paymob بيبعت webhook للسيرفر ← السيرفر بيتحقق من HMAC وبيحدّث الطلب ← العميل بيرجع على `/checkout.html?result=` |
| `stripe_card` | جاهز ومقفول | نفس الفكرة بـ Checkout Session و `Stripe-Signature` |

- **حالات الدفع:** `pending`، و `paid`، و `failed`، و `refunded`، و `partially_refunded`.
- **كل محاولة دفع** بتتسجل في `payments/{id}`، ومعاها `transactionId` والحالة. **عمرنا ما بنخزن بيانات الكارت.**
- لما تحب تفعّل الدفع أونلاين: هنعمل Cloudflare Worker مجاني فيه endpoint للـ intention و endpoint للـ webhook، والمفاتيح تبقى في Worker secrets. الخطوات هتبقى في README.

---

## 8) معمارية الشحن والتتبع

```js
// js/services/shipping.js
App.shipping.quote({ governorate, subtotal })
  // ← { available, price, freeShipping, eta:{min,max} } من settings/shipping
App.shipping.carriers.register({
  id:'manual', name:{ar,en}, trackingUrl:'https://.../track?n={number}',
  async createShipment(order) {},   // manual: الأدمن بيكتب الرقم بإيده
  async track(number) {}            // adapters بعدين: bosta / aramex / ... عن طريق السيرفر
});
```

- **`settings/shipping`:** سعر لكل محافظة (القاهرة، والجيزة، والإسكندرية، ... أو "باقي المحافظات")، و `enabled` لكل محافظة، وحد الشحن المجاني، وأيام التوصيل المتوقعة. وكل ده بيتعدل من اللوحة.
- **الحالات بالترتيب:** تم استلام الطلب ← تم تأكيد الدفع ← قيد المعالجة ← جاري التجهيز ← جاهز للشحن ← تم الشحن ← خرج للتوصيل ← تم التوصيل. وفيه حالتين جانبيتين: ملغي، ومرتجع.
- **الانتقالات المسموحة** متعرفة في `orders.js` (مثلاً: مينفعش ترجع من "تم الشحن" لـ "قيد المعالجة")، والعميل يقدر يلغي بس قبل "جاهز للشحن".
- **مع كل تغيير حالة:** بيتضاف سطر في `timeline`، ويتحدّث `tracking/{number}`، ويتسجل audit، ويتعمل إشعار في الـ outbox.
- **صفحة التتبع:** رقم الطلب ← قراءة `tracking/{number}` (ممنوع list، يعني لازم تعرف الرقم) ← timeline مرسوم ✓.

---

## 9) معمارية لوحة التحكم

- **صفحة واحدة** `admin/index.html`، والتنقل بـ hash (`#/orders/abc`). كل قسم ملف بيسجل نفسه:
  ```js
  App.admin.route({ id:'orders', path:'/orders', icon, label, perm:'orders.read', badge:()=>count, render(el, params){} })
  ```
- **الشكل:** Sidebar فيه أيقونات SVG وأرقام (طلبات جديدة، ومخزون قليل، وتقييمات مستنية، ومرتجعات)، وTop bar فيه اسم القسم، وشارة "متصل / وضع تجريبي"، واسم الأدمن ودوره، وقائمة burger للموبايل.
- **مكونات مشتركة** (`admin-ui.js`): جدول بـ pagination وبحث وفلاتر، وفورم بيتبني من schema، و modal، وتأكيد، و toast، و charts بـ SVG (خطي وأعمدة و donut ومعاها tooltip)، ومن غير مكتبات.
- **الأقسام:** نظرة عامة، والطلبات، والمنتجات، والأقسام، والماركات والألوان والمقاسات، والمخزون، والعملاء، والكوبونات، والعروض والبانرات، والتقييمات، والمرتجعات، والتقارير، والشحن، والإعدادات، والموظفين والأدوار، و Audit log.
- **التقارير:** فلتر (النهارده، وامبارح، والأسبوع ده، والشهر ده، وفترة مخصوصة) ← query على `orders` بـ `createdAt` ← تجميع في المتصفح ← جدول ورسم وتصدير CSV.
- **الإشعارات اللحظية:** `watch` على الطلبات الجديدة، ومعاها صوت وإشعار من المتصفح.

---

## 10) الإشعارات

- **القوالب في `settings/notifications`:** لكل حدث (`order_created`، و `payment_paid`، و `order_confirmed`، و `shipped`، و `out_for_delivery`، و `delivered`، و `cancelled`) قالب ar/en بمتغيرات زي `{{name}}` و `{{number}}` و `{{total}}` و `{{trackUrl}}`، ويتعدل من اللوحة.
- **Channels:**
  - `email`: عن طريق EmailJS (مجاني)، ومقفول لحد ما تحط بياناتك.
  - `whatsapp`: زرار في الطلب بيفتح `wa.me` برسالة جاهزة من القالب.
  - `sms`: الـ interface جاهز، ومحتاج مزود وسيرفر بعدين.
- كل محاولة إرسال بتتسجل في `notifications`.

---

## 11) الـ SEO والأداء

- `tools/build-seo.mjs` في الـ Action بيقرا المنتجات والأقسام بـ REST، وبيولّد:
  - `/products/<slug>/index.html` (نسخة من `product.html` فيها title و description و canonical و Open Graph و JSON-LD `Product` جاهزين).
  - `/c/<slug>/index.html` للأقسام.
  - `sitemap.xml`. وكمان `robots.txt` بيمنع `/admin/`.
- الـ Action بيشتغل مع كل push وكل 6 ساعات، علشان الأسعار في الـ meta تتحدث.
- **الأداء:** خط Cairo بـ `preconnect` و `display=swap`، وصور lazy بمقاسات ثابتة، و pagination في الشوب واللوحة، والكتالوج محفوظ في localStorage، و Service Worker للملفات الثابتة.

---

## 12) المراحل

| # | المرحلة | التسليم |
|---|---|---|
| 1 | الأساس: الهيكل، والـ tokens، و core، و `db` بالـ adapters، والبيانات التجريبية، والنشر | رابط GitHub Pages فيه صفحة رئيسية مبدئية |
| 2 | الدخول والمستخدمين (عملاء + أدمن + أدوار) | تسجيل ودخول ونسيت الباسورد في الوضع التجريبي، وحماية اللوحة |
| 3 | ✓ المنتجات والأقسام والمخزون والإعدادات (اللوحة) | منتجات وصور وتركيبات، وترتيب أقسام، وسجل مخزون، واسم وواتساب وشحن وحد مخزون |
| 4 | ✓ واجهة المتجر | الرئيسية، والشوب بالفلاتر والصفحات، وصفحة المنتج والتركيبات، والمفضلة للزائر والحساب |
| 5 | السلة والـ checkout | حساب كامل بالكوبون والشحن |
| 6 | الطلبات | إنشاء، وحالات، وطلباتي، وإلغاء |
| 7 | الدفع | COD، والتحويل بصورة، والـ adapters الجاهزة |
| 8 | الشحن والتتبع | Timeline، وصفحة تتبع برقم الطلب |
| 9 | لوحة التحكم الكاملة | Overview، وعملاء، و Audit |
| 10 | التقارير والكوبونات والتقييمات والعروض | تصدير CSV |
| 11 | Firebase الحقيقي، والـ rules، والأمان، والأداء | firestore.rules، و FIREBASE_SETUP.md، و Lighthouse |
| 12 | SEO، و PWA، والنشر النهائي، و README | Checklist للإطلاق |

بعد كل مرحلة: فحص syntax لكل الملفات، واختبارات الـ services، وPlaywright على موبايل (390×844) وديسكتوب (1440×900) من غير أخطاء console، وزيادة `VERSION` في `sw.js`، وبعدين commit و push.


### إضافات المرحلة 3
- `catalogControl/main`: `{revision, updatedAt}`، قراءة وكتابة المدير العام فقط؛ رقم الإصدار يزيد واحدًا داخل كل معاملة كتالوج. يمنع تصادم التعديلات وتكرار الأكواد بين النوافذ.
- `inventoryLogs`: `{productId, sku, delta: {stock,reserved,sold}, reason, orderId, by, at}`. سجل إضافي فقط؛ تغييرات هذه المرحلة تخص stock فقط، ولا تسمح بتعديل المحجوز أو المباع.
- المنتجات والإعدادات تحمل `revision` لمنع حفظ نموذج قديم فوق تحديث أحدث. الحفاظ على المحجوز والمباع إجباري، ولا تُحذف تركيبة مستخدمة.
- ضغط الصور في المتصفح إلى JPEG بحد 1200px و200000 حرف base64 قبل الحفظ في `productImages`؛ لا حاجة لخدمة تخزين مدفوعة.


### إضافات المرحلة 4
- فلاتر اللون والمقاس والسعر والمتاح تطابق نفس variant، وتشمل `priceDelta` فوق سعر البيع. المتاح يخصم `reserved` ولا يُختلق من عدد المبيعات.
- سعر الكارت يعرض «من» عند اختلاف أسعار التركيبات؛ وصف المنتج يعرض السعر المحدد بعد اختيار اللون والمقاس.
- المفضلة تستخدم `users/{uid}.wishlist` الموجودة، وتكتب في transaction للحفاظ على تحديثات النوافذ الأخرى. مفضلة الزائر منفصلة وتندمج مرة عند الدخول بدون نسخ بيانات الحساب للزائر بعد الخروج.
- لا تغيير في تقنية الموقع أو قواعد Firebase. لا زر شراء فعلي قبل تنفيذ المرحلة 5.
