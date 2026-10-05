/* addresses.js — عناوين العميل في users/{uid}/addresses. نفس التحقق بيستخدم في الـ checkout. */
(function (root) {
  'use strict';
  const App = root.App;
  const MAX = 10;
  const FIELDS = ['label', 'name', 'phone', 'governorate', 'city', 'area', 'street', 'building', 'floor', 'apartment', 'notes'];
  const path = uid => `users/${uid}/addresses`;

  /* بيرجع { field: 'رسالة' } للحقول الغلط */
  function validate(a) {
    const V = App.validate, e = {};
    const req = App.t('auth.err.required');
    if (!V.length(a.name, 2, 80)) e.name = req;
    if (!V.phoneEG(a.phone)) e.phone = App.t('auth.err.phone');
    if (!App.governorates.some(g => g.id === a.governorate)) e.governorate = req;
    if (!V.length(a.city, 2, 60)) e.city = req;
    if (!V.length(a.area, 2, 80)) e.area = req;
    if (!V.length(a.street, 2, 120)) e.street = req;
    if (!V.length(a.building, 1, 20)) e.building = req;
    for (const k of ['label', 'floor', 'apartment']) if (a[k] && String(a[k]).length > 40) e[k] = req;
    if (a.notes && String(a.notes).length > 300) e.notes = req;
    return e;
  }

  function clean(a) {
    const o = {};
    FIELDS.forEach(k => { o[k] = String(a[k] == null ? '' : a[k]).trim(); });
    o.phone = App.validate.normalizePhoneEG(o.phone);
    return o;
  }

  App.addresses = {
    MAX, FIELDS, validate, clean,
    async list(uid) {
      const list = await App.db.list(path(uid));
      return list.sort((a, b) => (b.isDefault - a.isDefault) || String(a.createdAt).localeCompare(String(b.createdAt)));
    },
    async save(uid, data, id) {
      const a = clean(data);
      if (Object.keys(validate(a)).length) throw new Error('invalid-address');
      if (id) {
        await App.db.update(path(uid), id, Object.assign(a, { updatedAt: App.db.now() }));
        return id;
      }
      const existing = await App.db.list(path(uid));
      if (existing.length >= MAX) throw new Error('max-addresses');
      return App.db.add(path(uid), Object.assign(a, { isDefault: existing.length === 0, createdAt: App.db.now() }));
    },
    async remove(uid, id) {
      const list = await App.db.list(path(uid));
      const target = list.find(x => x.id === id);
      await App.db.remove(path(uid), id);
      // لو مسح الأساسي، أول عنوان باقي يبقى الأساسي
      const rest = list.filter(x => x.id !== id);
      if (target && target.isDefault && rest.length) await App.db.update(path(uid), rest[0].id, { isDefault: true });
    },
    async setDefault(uid, id) {
      const list = await App.db.list(path(uid));
      for (const a of list) if (!!a.isDefault !== (a.id === id)) await App.db.update(path(uid), a.id, { isDefault: a.id === id });
    },
    // سطر واحد للعرض
    format(a) {
      return [a.street && `${a.street}${a.building ? ' ' + a.building : ''}`, a.area, a.city, App.governorateName(a.governorate)]
        .filter(Boolean).join('، ');
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
