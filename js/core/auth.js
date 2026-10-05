/* auth.js — الدخول والتسجيل وحالة المستخدم.
   - live: Firebase Auth (إيميل/باسورد + Google). الـ SDK بيتحمّل بس لو المستخدم داخل قبل كده أو بيعمل دخول دلوقتي.
   - demo: حسابات في localStorage، والباسورد متخزن PBKDF2 hash (للتجربة بس).
   البروفايل في users/{uid}: { name, email, phone, createdAt, wishlist[] } */
(function (root) {
  'use strict';
  const App = root.App;
  const HINT = 'auth:hint';          // المستخدم كان داخل قبل كده؟ (علشان منحمّلش الـ SDK على الفاضي)
  const DEMO_SESSION = 'auth:demoSession';
  const DEMO_ACCOUNTS = 'auth:demoAccounts';

  let current = null;                // { uid, email, name, phone, provider }
  let initPromise = null;
  const listeners = new Set();

  function setUser(u) {
    current = u;
    if (u) App.store.set(HINT, 1); else App.store.remove(HINT);
    listeners.forEach(fn => { try { fn(current); } catch (e) { console.error(e); } });
    App.emit('auth', current);
  }

  /* ---------- أخطاء مفهومة ---------- */
  const ERRORS = {
    'auth/invalid-credential': 'auth.err.invalid',
    'auth/wrong-password': 'auth.err.invalid',
    'auth/user-not-found': 'auth.err.invalid',
    'auth/invalid-email': 'auth.err.email',
    'auth/email-already-in-use': 'auth.err.exists',
    'auth/weak-password': 'auth.err.weak',
    'auth/too-many-requests': 'auth.err.tooMany',
    'auth/network-request-failed': 'auth.err.network',
    'auth/requires-recent-login': 'auth.err.recent',
    'auth/popup-closed-by-user': 'auth.err.popup',
    'auth/invalid-name': 'auth.err.name',
    'auth/cancelled-popup-request': 'auth.err.popup'
  };
  const fail = code => { const e = new Error(code); e.code = code; throw e; };
  App.authErrorText = e => App.t(ERRORS[e && e.code] || 'common.error');

  /* ---------- البروفايل ---------- */
  async function ensureProfile(uid, data) {
    const existing = await App.db.get('users', uid);
    if (existing) return existing;
    const profile = { name: data.name || '', email: data.email || '', phone: data.phone || '', wishlist: [], createdAt: App.db.now() };
    await App.db.set('users', uid, profile);
    return App.db.get('users', uid);
  }
  async function hydrate(base) {
    const p = await App.db.get('users', base.uid).catch(() => null);
    return Object.assign({}, base, p ? { name: p.name || base.name, phone: p.phone || '' } : {});
  }

  /* ============ Demo backend ============ */
  async function pbkdf2(password, salt) {
    const enc = new TextEncoder();
    const key = await root.crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await root.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  const demoAccounts = () => App.store.get(DEMO_ACCOUNTS, {}) || {};
  const normEmail = e => String(e || '').trim().toLowerCase();

  const Demo = {
    async init() {
      const s = App.store.get(DEMO_SESSION);
      if (s && s.uid) {
        const p = await App.db.get('users', s.uid);
        if (p) return hydrate({ uid: s.uid, email: p.email, name: p.name, provider: s.provider || 'password' });
      }
      return null;
    },
    async register({ email, password }) {
      email = normEmail(email);
      if (!App.validate.email(email)) fail('auth/invalid-email');
      if (String(password).length < 8) fail('auth/weak-password');
      const accounts = demoAccounts();
      if (accounts[email]) fail('auth/email-already-in-use');
      const uid = 'demo_' + App.randomId(16);
      const salt = App.randomId(16);
      accounts[email] = { uid, salt, hash: await pbkdf2(password, salt) };
      App.store.set(DEMO_ACCOUNTS, accounts);
      App.store.set(DEMO_SESSION, { uid, provider: 'password' });
      return { uid, email, provider: 'password' };
    },
    async login(email, password) {
      email = normEmail(email);
      const a = demoAccounts()[email];
      if (!a || (await pbkdf2(password, a.salt)) !== a.hash) fail('auth/invalid-credential');
      App.store.set(DEMO_SESSION, { uid: a.uid, provider: 'password' });
      return { uid: a.uid, email, provider: 'password' };
    },
    // Google في الوضع التجريبي: حساب ثابت للتجربة
    async loginGoogle() {
      const email = 'google.demo@example.com';
      const accounts = demoAccounts();
      if (!accounts[email]) { accounts[email] = { uid: 'demo_google', google: true }; App.store.set(DEMO_ACCOUNTS, accounts); }
      App.store.set(DEMO_SESSION, { uid: accounts[email].uid, provider: 'google' });
      return { uid: accounts[email].uid, email, name: 'Google Demo', provider: 'google' };
    },
    async logout() { App.store.remove(DEMO_SESSION); },
    // مفيش إيميل في الوضع التجريبي
    async resetPassword(email) {
      if (!App.validate.email(email)) fail('auth/invalid-email');
      return { demo: true };
    },
    async changePassword(currentPw, nextPw) {
      if (String(nextPw).length < 8) fail('auth/weak-password');
      const accounts = demoAccounts();
      const email = normEmail(current && current.email);
      const a = accounts[email];
      if (!a || a.google) fail('auth/invalid-credential');
      if ((await pbkdf2(currentPw, a.salt)) !== a.hash) fail('auth/invalid-credential');
      a.salt = App.randomId(16);
      a.hash = await pbkdf2(nextPw, a.salt);
      App.store.set(DEMO_ACCOUNTS, accounts);
    },
    async idToken() { return null; },
    // للوحة في الوضع التجريبي: دخول كأدمن بدور معين من غير باسورد
    async demoAdmin(role) {
      const uid = 'demo_admin_' + role;
      const email = `${role.replace(/_/g, '.')}@demo.local`;
      await ensureProfile(uid, { email, name: 'Demo ' + role });
      await App.db.set('admins', uid, { name: 'Demo ' + role, email, role, active: true, createdAt: App.db.now() });
      App.store.set(DEMO_SESSION, { uid, provider: 'password' });
      return { uid, email, provider: 'password' };
    }
  };

  /* ============ Firebase backend ============ */
  let fbAuth = null;   // { mod, auth }
  async function loadAuth() {
    if (fbAuth) return fbAuth;
    const sdk = await App.FirebaseAdapter.loadSDK();
    const mod = await import(`https://www.gstatic.com/firebasejs/${App.FirebaseAdapter.SDK_VERSION}/firebase-auth.js`);
    fbAuth = { mod, auth: mod.getAuth(sdk.app) };
    fbAuth.auth.languageCode = App.i18n.lang;
    return fbAuth;
  }
  const fromFb = u => (u ? { uid: u.uid, email: u.email || '', name: u.displayName || '', provider: (u.providerData[0] || {}).providerId === 'google.com' ? 'google' : 'password' } : null);
  const wrap = fn => fn().catch(e => { const x = new Error(e.code || e.message); x.code = e.code; throw x; });

  const Live = {
    async init() {
      if (!App.store.get(HINT)) return null;
      const { mod, auth } = await loadAuth();
      const u = await new Promise(res => { const off = mod.onAuthStateChanged(auth, x => { off(); res(x); }); });
      return u ? hydrate(fromFb(u)) : null;
    },
    register: ({ email, password, name }) => wrap(async () => {
      const { mod, auth } = await loadAuth();
      const cred = await mod.createUserWithEmailAndPassword(auth, normEmail(email), password);
      if (name) await mod.updateProfile(cred.user, { displayName: name });
      return fromFb(cred.user);
    }),
    login: (email, password) => wrap(async () => {
      const { mod, auth } = await loadAuth();
      return fromFb((await mod.signInWithEmailAndPassword(auth, normEmail(email), password)).user);
    }),
    loginGoogle: () => wrap(async () => {
      const { mod, auth } = await loadAuth();
      return fromFb((await mod.signInWithPopup(auth, new mod.GoogleAuthProvider())).user);
    }),
    logout: () => wrap(async () => { const { mod, auth } = await loadAuth(); await mod.signOut(auth); }),
    resetPassword: email => wrap(async () => {
      const { mod, auth } = await loadAuth();
      await mod.sendPasswordResetEmail(auth, normEmail(email));
      return { demo: false };
    }),
    changePassword: (currentPw, nextPw) => wrap(async () => {
      const { mod, auth } = await loadAuth();
      const u = auth.currentUser;
      await mod.reauthenticateWithCredential(u, mod.EmailAuthProvider.credential(u.email, currentPw));
      await mod.updatePassword(u, nextPw);
    }),
    async idToken() {
      if (!current) return null;
      const { auth } = await loadAuth();
      return auth.currentUser ? auth.currentUser.getIdToken() : null;
    }
  };

  const backend = () => (App.config.isDemo ? Demo : Live);

  /* ============ الواجهة العامة ============ */
  App.auth = {
    get user() { return current; },
    get isDemo() { return App.config.isDemo; },
    init() {
      if (!initPromise) {
        initPromise = backend().init()
          .then(u => { current = u; if (!u) App.store.remove(HINT); return u; })
          .catch(e => { console.warn('auth init', e); current = null; return null; });
      }
      return initPromise;
    },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    async register({ name, email, phone, password }) {
      if (!App.validate.length(name, 2, 80)) fail('auth/invalid-name');
      const u = await backend().register({ name, email, password });
      await ensureProfile(u.uid, { name, email: u.email, phone: App.validate.normalizePhoneEG(phone) });
      setUser(await hydrate(u));
      return current;
    },
    async login(email, password) {
      const u = await backend().login(email, password);
      await ensureProfile(u.uid, { email: u.email, name: u.name });
      setUser(await hydrate(u));
      return current;
    },
    async loginGoogle() {
      const u = await backend().loginGoogle();
      await ensureProfile(u.uid, { email: u.email, name: u.name });
      setUser(await hydrate(u));
      return current;
    },
    async logout() { await backend().logout(); App.auth.admin = null; setUser(null); },
    resetPassword: email => backend().resetPassword(email),
    changePassword: (a, b) => backend().changePassword(a, b),
    idToken: () => backend().idToken(),

    async updateProfile({ name, phone }) {
      if (!current) fail('auth/not-signed-in');
      const patch = { updatedAt: App.db.now() };
      if (name != null) patch.name = String(name).trim();
      if (phone != null) patch.phone = App.validate.normalizePhoneEG(phone);
      await App.db.update('users', current.uid, patch);
      setUser(await hydrate(current));
    },
    needsPhone: () => !!current && !App.validate.phoneEG(current.phone || ''),

    /* ---------- الأدمن والصلاحيات ---------- */
    admin: null,     // { uid, name, role, roleName, permissions[] }
    async loadAdmin() {
      App.auth.admin = null;
      if (!current) return null;
      const a = await App.db.get('admins', current.uid).catch(() => null);
      if (!a || !a.active) return null;
      const role = await App.db.get('roles', a.role).catch(() => null);
      App.auth.admin = { uid: current.uid, name: a.name || current.name, email: a.email || current.email, role: a.role,
        roleName: role ? role.name : { ar: a.role, en: a.role }, permissions: (role && role.permissions) || [] };
      return App.auth.admin;
    },
    demoAdmin: async role => {
      if (!App.config.isDemo) fail('auth/not-demo');
      const u = await Demo.demoAdmin(role);
      setUser(await hydrate(u));
      return current;
    }
  };

  App.can = perm => {
    const a = App.auth.admin;
    return !!a && (a.permissions.includes('all') || a.permissions.includes(perm));
  };
})(typeof window !== 'undefined' ? window : globalThis);
