/* db-firebase.js — FirebaseAdapter.
   - القراءة: Firestore REST (من غير SDK) علشان المتجر يفضل خفيف.
   - الكتابة والمتابعة اللحظية والـ transactions: Firebase JS SDK، وبيتحمّل وقت الحاجة بس. */
(function (root) {
  'use strict';
  const App = root.App;
  const SDK_VERSION = '10.14.1';
  const SDK = name => `https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-${name}.js`;

  /* ---------- تحويل قيم REST ---------- */
  function decode(v) {
    if (v == null) return null;
    if ('nullValue' in v) return null;
    if ('booleanValue' in v) return v.booleanValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return Number(v.doubleValue);
    if ('timestampValue' in v) return new Date(v.timestampValue).toISOString();
    if ('stringValue' in v) return v.stringValue;
    if ('referenceValue' in v) return v.referenceValue;
    if ('geoPointValue' in v) return v.geoPointValue;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
    if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
    return null;
  }
  function decodeFields(fields) {
    const o = {};
    for (const [k, v] of Object.entries(fields || {})) o[k] = decode(v);
    return o;
  }
  function encode(v) {
    if (v == null) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
    if (typeof v === 'object') {
      const fields = {};
      for (const [k, x] of Object.entries(v)) fields[k] = encode(x);
      return { mapValue: { fields } };
    }
    throw new Error('Cannot encode ' + typeof v);
  }
  const docFromRest = d => (d ? Object.assign({ id: d.name.split('/').pop() }, decodeFields(d.fields)) : null);

  const OPS = {
    '==': 'EQUAL', '!=': 'NOT_EQUAL', '<': 'LESS_THAN', '<=': 'LESS_THAN_OR_EQUAL',
    '>': 'GREATER_THAN', '>=': 'GREATER_THAN_OR_EQUAL', 'in': 'IN', 'array-contains': 'ARRAY_CONTAINS'
  };

  /* 'users/abc/addresses' → parent 'users/abc' + collection 'addresses' */
  function splitPath(path) {
    const parts = path.split('/');
    return { parent: parts.slice(0, -1).join('/'), collectionId: parts[parts.length - 1] };
  }

  function structuredQuery(path, q) {
    const { collectionId } = splitPath(path);
    const sq = { from: [{ collectionId }] };
    const filters = (q.where || []).map(([field, o, value]) => ({
      fieldFilter: { field: { fieldPath: field }, op: OPS[o], value: encode(value) }
    }));
    if (filters.length === 1) sq.where = filters[0];
    else if (filters.length > 1) sq.where = { compositeFilter: { op: 'AND', filters } };
    if (q.orderBy) {
      sq.orderBy = [{ field: { fieldPath: q.orderBy[0] }, direction: q.orderBy[1] === 'desc' ? 'DESCENDING' : 'ASCENDING' }];
      if (q.after && q.after.length) sq.startAt = { values: q.after.map(encode), before: false };
    }
    if (q.limit) sq.limit = q.limit;
    return sq;
  }

  /* ---------- SDK (lazy) ---------- */
  let sdkPromise = null;
  function loadSDK() {
    if (sdkPromise) return sdkPromise;
    sdkPromise = (async () => {
      const [appMod, fsMod] = await Promise.all([import(SDK('app')), import(SDK('firestore'))]);
      const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(App.config.firebase);
      return { app, fs: fsMod, db: fsMod.getFirestore(app) };
    })();
    return sdkPromise;
  }

  function toSdkValue(fs, v) {
    if (App.db.isOp(v)) {
      switch (v.__op) {
        case 'inc': return fs.increment(v.val);
        case 'now': return fs.serverTimestamp();
        case 'del': return fs.deleteField();
        case 'union': return fs.arrayUnion(...v.val);
        case 'remove': return fs.arrayRemove(...v.val);
      }
    }
    if (Array.isArray(v)) return v.map(x => toSdkValue(fs, x));
    if (v && typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = toSdkValue(fs, x);
      return o;
    }
    return v;
  }
  function fromSdkValue(v) {
    if (v == null) return v;
    if (typeof v.toDate === 'function') return v.toDate().toISOString();
    if (Array.isArray(v)) return v.map(fromSdkValue);
    if (typeof v === 'object') {
      const o = {};
      for (const [k, x] of Object.entries(v)) o[k] = fromSdkValue(x);
      return o;
    }
    return v;
  }
  const snapDoc = s => (s.exists() ? Object.assign({ id: s.id }, fromSdkValue(s.data())) : null);

  function sdkQuery(sdk, path, q) {
    const { fs, db } = sdk;
    const parts = [];
    for (const [f, o, v] of q.where || []) parts.push(fs.where(f, o, v));
    if (q.orderBy) parts.push(fs.orderBy(q.orderBy[0], q.orderBy[1] || 'asc'));
    if (q.orderBy && q.after && q.after.length) parts.push(fs.startAfter(...q.after));
    if (q.limit) parts.push(fs.limit(q.limit));
    return fs.query(fs.collection(db, path), ...parts);
  }

  const base = () => `https://firestore.googleapis.com/v1/projects/${App.config.firebase.projectId}/databases/(default)/documents`;

  async function restFetch(url, init) {
    const headers = { 'Content-Type': 'application/json' };
    // لو المستخدم عامل دخول، بنبعت الـ ID token علشان الـ rules تعرفه
    const token = App.auth && App.auth.idToken ? await App.auth.idToken() : null;
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch(url, Object.assign({ headers }, init));
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Firestore ${res.status}: ${await res.text()}`);
    return res.json();
  }

  const Firebase = {
    name: 'firebase',
    loadSDK,
    SDK_VERSION,
    _test: { decode, encode, structuredQuery },

    async list(path, q) {
      const { parent } = splitPath(path);
      const url = base() + (parent ? '/' + parent : '') + ':runQuery';
      const rows = await restFetch(url, { method: 'POST', body: JSON.stringify({ structuredQuery: structuredQuery(path, q) }) });
      return (rows || []).filter(r => r.document).map(r => docFromRest(r.document));
    },
    async get(path, id) {
      const d = await restFetch(`${base()}/${path}/${encodeURIComponent(id)}`);
      return docFromRest(d);
    },
    async add(path, data) {
      const sdk = await loadSDK();
      const ref = await sdk.fs.addDoc(sdk.fs.collection(sdk.db, path), toSdkValue(sdk.fs, data));
      return ref.id;
    },
    async set(path, id, data, opts) {
      const sdk = await loadSDK();
      await sdk.fs.setDoc(sdk.fs.doc(sdk.db, path, id), toSdkValue(sdk.fs, data), { merge: !!opts.merge });
    },
    async update(path, id, patch) {
      const sdk = await loadSDK();
      await sdk.fs.updateDoc(sdk.fs.doc(sdk.db, path, id), toSdkValue(sdk.fs, patch));
    },
    async remove(path, id) {
      const sdk = await loadSDK();
      await sdk.fs.deleteDoc(sdk.fs.doc(sdk.db, path, id));
    },
    async tx(fn) {
      const sdk = await loadSDK();
      const { fs, db } = sdk;
      return fs.runTransaction(db, async tr => {
        const t = {
          get: async (path, id) => snapDoc(await tr.get(fs.doc(db, path, id))),
          set: (path, id, data, opts) => tr.set(fs.doc(db, path, id), toSdkValue(fs, data), { merge: !!(opts && opts.merge) }),
          update: (path, id, patch) => tr.update(fs.doc(db, path, id), toSdkValue(fs, patch)),
          remove: (path, id) => tr.delete(fs.doc(db, path, id))
        };
        return fn(t);
      });
    },
    watch(path, q, cb) {
      let unsub = null, stop = false;
      loadSDK().then(sdk => {
        if (stop) return;
        unsub = sdk.fs.onSnapshot(sdkQuery(sdk, path, q),
          snap => cb(snap.docs.map(snapDoc)),
          err => console.error('watch', path, err));
      });
      return () => { stop = true; if (unsub) unsub(); };
    }
  };

  App.FirebaseAdapter = Firebase;
})(typeof window !== 'undefined' ? window : globalThis);
