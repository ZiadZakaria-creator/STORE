/* audit.js — سجل عمليات الأدمن في auditLogs. محدش يقدر يعدل أو يمسح السجل (firestore.rules). */
(function (root) {
  'use strict';
  const App = root.App;

  // قائمة الصلاحيات الكاملة (نفس الأسماء في firestore.rules)
  App.PERMISSIONS = [
    ['dashboard.view', 'عرض لوحة التحكم'],
    ['orders.read', 'عرض الطلبات'],
    ['orders.write', 'تعديل حالة الطلبات'],
    ['payments.confirm', 'تأكيد الدفع والاسترداد'],
    ['products.write', 'إدارة المنتجات'],
    ['categories.write', 'إدارة الأقسام والماركات والألوان والمقاسات'],
    ['inventory.write', 'إدارة المخزون'],
    ['customers.read', 'عرض العملاء'],
    ['coupons.write', 'إدارة الكوبونات'],
    ['promotions.write', 'إدارة العروض والبانرات'],
    ['reviews.moderate', 'مراجعة التقييمات'],
    ['reports.view', 'عرض التقارير'],
    ['settings.write', 'تعديل الإعدادات'],
    ['staff.manage', 'إدارة الموظفين والأدوار'],
    ['audit.read', 'عرض سجل العمليات']
  ];

  App.audit = {
    /* log({ action:'admin.role_changed', entity:'admins', entityId, before, after, summary }) */
    async log(entry) {
      const a = App.auth.admin;
      if (!a) return;
      try {
        await App.db.add('auditLogs', {
          by: a.uid, byName: a.name || a.email || '',
          action: entry.action, entity: entry.entity, entityId: String(entry.entityId || ''),
          before: entry.before === undefined ? null : entry.before,
          after: entry.after === undefined ? null : entry.after,
          summary: entry.summary || '',
          at: App.db.now()
        });
      } catch (e) {
        // فشل السجل مش لازم يوقف العملية نفسها، بس لازم يبان
        console.error('audit log failed', e);
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
