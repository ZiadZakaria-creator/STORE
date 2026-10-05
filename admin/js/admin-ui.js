/* admin-ui.js — مكونات مشتركة للوحة: جدول، و modal، وتأكيد، وتنسيق التاريخ. */
(function (root) {
  'use strict';
  const App = root.App;
  const { h } = App;

  const ui = App.ui = {};

  ui.date = (iso, withTime = true) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', withTime
      ? { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
  };

  /* table({ columns: [{ label, render: row => Node|string, wrap }], rows, empty }) */
  ui.table = ({ columns, rows, empty = 'مفيش بيانات' }) => {
    if (!rows.length) return h('div', { class: 'table-empty', text: empty });
    return h('div', { class: 'table-wrap' }, h('table', { class: 'table' }, [
      h('thead', null, h('tr', null, columns.map(c => h('th', { scope: 'col', text: c.label })))),
      h('tbody', null, rows.map(r => h('tr', null, columns.map(c => {
        const v = c.render(r);
        return h('td', { class: c.wrap ? 'wrap' : null }, v instanceof root.Node ? v : String(v == null ? '' : v));
      }))))
    ]));
  };

  ui.box = (title, body, actions) => h('section', { class: 'box' }, [
    h('div', { class: 'box-head' }, [h('h2', { text: title }), actions ? h('div', { class: 'toolbar' }, actions) : null]),
    h('div', { class: 'box-body' }, body)
  ]);

  /* modal(title, content, [{ label, primary, onClick → false يمنع القفل }]) */
  ui.modal = (title, content, actions = []) => {
    const back = h('div', { class: 'modal-back' });
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    const foot = actions.map(a => {
      const b = h('button', { class: 'btn btn-sm ' + (a.primary ? 'btn-primary' : 'btn-outline'), text: a.label });
      b.addEventListener('click', async () => {
        if (!a.onClick) return close();
        App.form.busy(b, true);
        try { if ((await a.onClick()) !== false) close(); }
        finally { if (b.isConnected) App.form.busy(b, false); }
      });
      return b;
    });
    const modal = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
      h('div', { class: 'modal-head' }, [h('strong', { text: title }), h('button', { class: 'icon-btn', 'aria-label': 'إغلاق', html: App.icons.close, onclick: close })]),
      h('div', { class: 'modal-body' }, content),
      foot.length ? h('div', { class: 'modal-foot' }, foot) : null
    ]);
    back.append(modal);
    back.addEventListener('click', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(back);
    const first = modal.querySelector('input, select, textarea, button');
    if (first) first.focus();
    return { close, el: modal };
  };

  ui.confirm = (message, okLabel = 'تأكيد') => new Promise(resolve => {
    let answered = false;
    const m = ui.modal('تأكيد', h('p', { text: message }), [
      { label: 'إلغاء', onClick: () => { answered = true; resolve(false); } },
      { label: okLabel, primary: true, onClick: () => { answered = true; resolve(true); } }
    ]);
    const obs = new MutationObserver(() => { if (!m.el.isConnected) { obs.disconnect(); if (!answered) resolve(false); } });
    obs.observe(document.body, { childList: true });
  });

  ui.chip = (text, kind) => h('span', { class: 'chip' + (kind ? ' ' + kind : ''), text });
})(window);
