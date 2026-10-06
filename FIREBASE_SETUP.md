# ربط المتجر بـ Firebase (مجاني — خطة Spark)

الخطوات دي بتتعمل **مرة واحدة**، وبتاخد حوالي 15 دقيقة. كلها من المتصفح، ومش محتاج تسطّب أي حاجة.
مش هتحتاج كارت فيزا، ومتختارش خطة **Blaze** لو ظهرتلك.

> قبل ما تبدأ: افتح [console.firebase.google.com](https://console.firebase.google.com) بحساب Google اللي عايز تدير بيه المتجر.

---

## 1) إنشاء المشروع
1. اضغط **Create a project** (أو **Add project**).
2. اكتب اسم المشروع، مثلاً `my-store`، واضغط **Continue**.
3. **Google Analytics:** اقفله (مش محتاجينه دلوقتي) ← **Create project** ← استنى لحد ما يخلص ← **Continue**.

## 2) تسجيل الموقع (Web app) وأخد الإعدادات
1. في صفحة المشروع، اضغط على أيقونة الويب **`</>`** (Add app ← Web).
2. **App nickname:** اكتب `store`. **متعلّمش** على Firebase Hosting.
3. اضغط **Register app**.
4. هيظهرلك كود فيه `const firebaseConfig = { ... }`. انسخ اللي بين القوسين `{ }` بس. شكله كده:
   ```js
   {
     apiKey: "AIza....",
     authDomain: "my-store.firebaseapp.com",
     projectId: "my-store",
     storageBucket: "my-store.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   }
   ```
5. اضغط **Continue to console**.

> القيم دي **مش سر**: Google عاملها علشان تبقى جوه كود الموقع. الحماية الحقيقية في قواعد Firestore (الخطوة 5).

## 3) تفعيل الدخول (Authentication)
1. من القايمة الشمال: **Build ← Authentication ← Get started**.
2. في تاب **Sign-in method**:
   - اختار **Email/Password**، وفعّل أول اختيار بس (Email/Password)، واضغط **Save**.
   - اضغط **Add new provider** ← **Google** ← **Enable**، واختار **Project support email** (إيميلك)، واضغط **Save**.
3. تاب **Settings** ← **Authorized domains** ← **Add domain**، واكتب:
   ```
   ziadzakaria-creator.github.io
   ```
   واضغط **Add**. (`localhost` بيبقى موجود لوحده.)
4. **اختياري:** تاب **Templates** ← **Password reset**. تقدر تغيّر اللغة لعربي من أيقونة اللغة اللي فوق.

## 4) إنشاء قاعدة البيانات (Firestore)
1. من القايمة: **Build ← Firestore Database ← Create database**.
2. **Location:** اختار `eur3 (europe-west)`. **مينفعش تغيّره بعدين.**
3. اختار **Start in production mode** ← **Create**.

## 5) قواعد الأمان (Rules)
1. في Firestore، افتح تاب **Rules**.
2. امسح كل اللي مكتوب، والصق محتوى ملف [`firestore.rules`](firestore.rules) كله من الريبو.
3. اضغط **Publish**.

> كل ما ملف `firestore.rules` يتغير في الريبو، لازم تكرر الخطوة دي.

## 6) الـ Indexes (فهارس البحث)
في Firestore ← تاب **Indexes** ← **Composite** ← **Create index**، واعمل التلاتة دول. كل واحد بياخد دقيقتين لحد ما يبقى **Enabled**:

| Collection ID | Field 1 | Field 2 |
|---|---|---|
| `orders` | `uid` — Ascending | `createdAt` — Descending |
| `orders` | `status` — Ascending | `createdAt` — Descending |
| `auditLogs` | `entity` — Ascending | `at` — Descending |

خلّي **Query scope** على **Collection**.

> لو نسيت index، الموقع هيطلع خطأ في الـ console فيه لينك بيعمل الـ index بضغطة واحدة.

## 7) حط الإعدادات في الموقع
عندك طريقتين:
- **ابعتلي** الكود اللي نسخته في الخطوة 2، وأنا أحطه وأعمل push.
- **أو بنفسك من GitHub:**
  1. افتح الريبو ← ملف `firebase-config.js` ← أيقونة القلم ✏️.
  2. غيّر السطر `window.FIREBASE_CONFIG = null;` لـ:
     ```js
     window.FIREBASE_CONFIG = {
       apiKey: "AIza....",
       authDomain: "my-store.firebaseapp.com",
       projectId: "my-store",
       storageBucket: "my-store.appspot.com",
       messagingSenderId: "1234567890",
       appId: "1:1234567890:web:abc123"
     };
     ```
  3. **Commit changes**، واستنى دقيقتين لحد ما النشر يخلص (تاب Actions يبقى ✓ أخضر).

بعد كده الشريط الأصفر "تجريبي" هيختفي، والمتجر هيقرا ويكتب من Firebase.

## 8) أول مدير عام (إنت)
1. افتح المتجر ← **حسابي** ← **حساب جديد**، واعمل حسابك بإيميلك (أو ادخل بـ Google).
2. ارجع لـ Firebase ← **Authentication ← Users**، وهتلاقي حسابك. انسخ الـ **User UID** (حروف وأرقام زي `aB3dE...`).
3. روح **Firestore Database ← Data** ← **Start collection**:
   - **Collection ID:** `admins` ← **Next**.
   - **Document ID:** الصق الـ UID اللي نسخته.
   - ضيف الحقول دي (**Add field**):

     | Field | Type | Value |
     |---|---|---|
     | `name` | string | اسمك |
     | `email` | string | إيميلك (نفس إيميل الحساب) |
     | `role` | string | `super_admin` |
     | `active` | boolean | `true` |

   - **Save**.
4. افتح `https://ziadzakaria-creator.github.io/STORE/admin/` (لو كنت فاتحها اعمل Refresh).
5. من القايمة اختار **تجهيز المتجر** ← **جهّز البيانات الناقصة**.

   الزرار ده بيضيف الأدوار الخمسة، والأقسام والأقسام الفرعية، والألوان، والمقاسات، والإعدادات الأساسية. مش بيضيف منتجات ولا أسعار، وكل المحافظات بتبدأ مقفولة لحد ما تحط أسعار الشحن.

اللوحة مخصصة لصاحب المتجر فقط، بحساب مدير عام واحد. مفيش إدارة موظفين في الواجهة.

---

## لو حاجة مشتغلتش
| المشكلة | الحل |
|---|---|
| زرار Google بيطلع `auth/unauthorized-domain` | راجع الخطوة 3.3 (Authorized domains) |
| اللوحة بتقول "مش عنده صلاحية" | راجع الخطوة 8: الـ Document ID لازم يبقى الـ UID بالظبط، و `active` نوعه **boolean** مش string |
| `Missing or insufficient permissions` | القواعد متنشرتش، راجع الخطوة 5 |
| `The query requires an index` | اضغط اللينك اللي في الرسالة، أو راجع الخطوة 6 |
| الموقع لسه بيقول "تجريبي" | `firebase-config.js` لسه `null`، أو النشر لسه مخلصش، أو المتصفح شايل نسخة قديمة (اعمل Refresh مرتين) |

## حدود الخطة المجانية (Spark)
- 50,000 قراءة و 20,000 كتابة في اليوم، و 1 GB تخزين. ده كفاية جداً لمتجر في البداية.
- المتجر بيحفظ الكتالوج في المتصفح 5 دقايق، علشان كل زائر ميعملش قراءات كتير.

## للمطورين: التجربة المحلية على Firebase Emulator
```bash
# مرة واحدة، في فولدر برّه الريبو:
npm i firebase-tools @firebase/rules-unit-testing firebase
# اختبار القواعد:
NODE_PATH=<folder>/node_modules npx firebase emulators:exec --project demo-store --only firestore "node tests/rules.test.mjs"
# اختبار الموقع كامل في وضع Firebase (محتاج ملفات Firebase SDK 10.14.1 في SDK_DIR):
python3 -m http.server 8080 &
BASE_URL=http://127.0.0.1:8080/ SDK_DIR=<sdk> NODE_PATH=$(npm root -g) npx firebase emulators:exec --project demo-store --only firestore,auth "node tests/live-emulator.mjs"
```


## تحديث المرحلة 3 — مطلوب قبل استخدام الإدارة الجديدة
انسخ محتوى `firestore.rules` بالكامل إلى **Firebase Console ← مشروع store-4cfd5 ← Firestore Database ← Rules ← Publish**.
القواعد الجديدة تضيف `catalogControl/main` لتنسيق تعديلات الكتالوج و`inventoryLogs` لسجل المخزون الذي لا يقبل التعديل أو الحذف. دفع الكود على GitHub لا ينشر قواعد Firebase.
بعد النشر افتح `/admin/#/settings` وأدخل الاسم والواتساب وأسعار الشحن الحقيقية، وفعّل المحافظات التي توصل لها فقط. حد المخزون القليل يقبل صفرًا، وترك الشحن المجاني فارغًا يلغيه.
