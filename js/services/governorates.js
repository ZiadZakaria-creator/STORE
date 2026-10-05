/* governorates.js — المحافظات المصرية الـ 27. الأسعار والتفعيل في settings/shipping مش هنا. */
(function (root) {
  'use strict';
  const App = root.App;
  App.governorates = [
    { id: 'cairo', ar: 'القاهرة', en: 'Cairo' },
    { id: 'giza', ar: 'الجيزة', en: 'Giza' },
    { id: 'alexandria', ar: 'الإسكندرية', en: 'Alexandria' },
    { id: 'qalyubia', ar: 'القليوبية', en: 'Qalyubia' },
    { id: 'sharqia', ar: 'الشرقية', en: 'Sharqia' },
    { id: 'dakahlia', ar: 'الدقهلية', en: 'Dakahlia' },
    { id: 'gharbia', ar: 'الغربية', en: 'Gharbia' },
    { id: 'monufia', ar: 'المنوفية', en: 'Monufia' },
    { id: 'beheira', ar: 'البحيرة', en: 'Beheira' },
    { id: 'kafr-el-sheikh', ar: 'كفر الشيخ', en: 'Kafr El Sheikh' },
    { id: 'damietta', ar: 'دمياط', en: 'Damietta' },
    { id: 'port-said', ar: 'بورسعيد', en: 'Port Said' },
    { id: 'ismailia', ar: 'الإسماعيلية', en: 'Ismailia' },
    { id: 'suez', ar: 'السويس', en: 'Suez' },
    { id: 'faiyum', ar: 'الفيوم', en: 'Faiyum' },
    { id: 'beni-suef', ar: 'بني سويف', en: 'Beni Suef' },
    { id: 'minya', ar: 'المنيا', en: 'Minya' },
    { id: 'asyut', ar: 'أسيوط', en: 'Asyut' },
    { id: 'sohag', ar: 'سوهاج', en: 'Sohag' },
    { id: 'qena', ar: 'قنا', en: 'Qena' },
    { id: 'luxor', ar: 'الأقصر', en: 'Luxor' },
    { id: 'aswan', ar: 'أسوان', en: 'Aswan' },
    { id: 'red-sea', ar: 'البحر الأحمر', en: 'Red Sea' },
    { id: 'new-valley', ar: 'الوادي الجديد', en: 'New Valley' },
    { id: 'matrouh', ar: 'مطروح', en: 'Matrouh' },
    { id: 'north-sinai', ar: 'شمال سيناء', en: 'North Sinai' },
    { id: 'south-sinai', ar: 'جنوب سيناء', en: 'South Sinai' }
  ];
  App.governorateName = id => {
    const g = App.governorates.find(x => x.id === id);
    return g ? App.tx(g) : id;
  };
})(typeof window !== 'undefined' ? window : globalThis);
