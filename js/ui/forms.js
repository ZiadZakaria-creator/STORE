/* forms.js — أدوات الفورم المشتركة: حقول، وقراءة القيم، وإظهار الأخطاء، وحالة الزرار. */
(function (root) {
  'use strict';
  const App = root.App;
  const { h } = App;

  /* field({ name, label, type, required, autocomplete, dir, hint, options:[{value,label}], value, full, rows }) */
  function field(o) {
    let input;
    const common = { class: 'input', name: o.name, id: 'f-' + o.name + (o.idSuffix || ''), required: !!o.required, autocomplete: o.autocomplete || null, dir: o.dir || null, inputmode: o.inputmode || null, maxlength: o.maxlength || null };
    if (o.type === 'select') {
      input = h('select', common, [
        o.placeholder ? h('option', { value: '', text: o.placeholder }) : null,
        ...(o.options || []).map(op => h('option', { value: op.value, text: op.label, selected: String(op.value) === String(o.value || '') }))
      ]);
    } else if (o.type === 'textarea') {
      input = h('textarea', Object.assign(common, { rows: o.rows || 3 }));
      input.value = o.value || '';
    } else {
      input = h('input', Object.assign(common, { type: o.type || 'text', minlength: o.minlength || null }));
      if (o.value != null) input.value = o.value;
    }
    return h('label', { class: 'field' + (o.full ? ' full' : ''), for: common.id }, [
      h('span', { text: o.label + (o.required ? ' *' : '') }),
      input,
      o.hint ? h('small', { text: o.hint }) : null,
      h('span', { class: 'field-error', 'data-error-for': o.name, role: 'alert' })
    ]);
  }

  function values(form) {
    const out = {};
    new FormData(form).forEach((v, k) => { out[k] = typeof v === 'string' ? v.trim() : v; });
    return out;
  }

  function setErrors(form, errors) {
    App.$$('[data-error-for]', form).forEach(el => { el.textContent = ''; });
    App.$$('[aria-invalid]', form).forEach(el => el.removeAttribute('aria-invalid'));
    let first = null;
    for (const [name, msg] of Object.entries(errors || {})) {
      const el = App.$(`[data-error-for="${name}"]`, form);
      const input = form.elements[name];
      if (el) el.textContent = msg;
      if (input) { input.setAttribute('aria-invalid', 'true'); first = first || input; }
    }
    if (first) first.focus();
    return !first;
  }

  function busy(btn, on) {
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = App.t('common.loading'); btn.disabled = true; }
    else { if (btn.dataset.label) btn.textContent = btn.dataset.label; btn.disabled = false; }
  }

  /* بيشغّل action ويعرض الخطأ في alert جوه الفورم */
  async function submit(form, btn, action) {
    const alert = App.$('.alert', form);
    if (alert) { alert.textContent = ''; alert.className = 'alert'; }
    busy(btn, true);
    try { return await action(); }
    catch (e) {
      console.warn(e);
      if (alert) { alert.className = 'alert alert-error'; alert.textContent = App.authErrorText ? App.authErrorText(e) : App.t('common.error'); }
      return undefined;
    } finally { busy(btn, false); }
  }

  App.form = { field, values, setErrors, busy, submit };
})(window);
