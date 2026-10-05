/* demo-data.js — بيانات الوضع التجريبي بس (لما firebase-config.js فاضي).
   الأسعار هنا تجريبية ومش بتستخدم في المتجر الحقيقي، والأسعار الحقيقية بتتحط من اللوحة.
   الماركات أسماء وهمية، والصور رسومات مولّدة (ph:) مش صور منتجات حقيقية. */
(function (root) {
  'use strict';
  const App = root.App;
  const T = '2025-01-01T00:00:00.000Z';

  /* ---------- الأقسام ---------- */
  const cat = (id, ar, en, parentId, order, icon) => ({
    id, name: { ar, en }, slug: id, parentId: parentId || null, order, image: icon ? `ph:${icon}:BLK` : '',
    hidden: false, createdAt: T, updatedAt: T
  });
  const categories = [
    cat('men', 'رجالي', 'Men', null, 1, 'shirt'),
    cat('men-tshirts', 'تيشيرتات', 'T-Shirts', 'men', 1),
    cat('men-shirts', 'قمصان', 'Shirts', 'men', 2),
    cat('men-jeans', 'جينز', 'Jeans', 'men', 3),
    cat('men-pants', 'بناطيل', 'Pants', 'men', 4),
    cat('men-jackets', 'جواكت', 'Jackets', 'men', 5),
    cat('men-hoodies', 'هوديز', 'Hoodies', 'men', 6),
    cat('men-sportswear', 'ملابس رياضية', 'Sportswear', 'men', 7),
    cat('women', 'حريمي', 'Women', null, 2, 'dress'),
    cat('women-dresses', 'فساتين', 'Dresses', 'women', 1),
    cat('women-tops', 'توبات', 'Tops', 'women', 2),
    cat('women-jeans', 'جينز', 'Jeans', 'women', 3),
    cat('women-pants', 'بناطيل', 'Pants', 'women', 4),
    cat('women-jackets', 'جواكت', 'Jackets', 'women', 5),
    cat('women-sportswear', 'ملابس رياضية', 'Sportswear', 'women', 6),
    cat('kids', 'أطفال', 'Kids', null, 3, 'tshirt'),
    cat('kids-boys', 'أولاد', 'Boys', 'kids', 1),
    cat('kids-girls', 'بنات', 'Girls', 'kids', 2),
    cat('kids-baby', 'بيبي', 'Baby', 'kids', 3),
    cat('shoes', 'أحذية', 'Shoes', null, 4, 'shoe'),
    cat('shoes-men', 'أحذية رجالي', 'Men Shoes', 'shoes', 1),
    cat('shoes-women', 'أحذية حريمي', 'Women Shoes', 'shoes', 2),
    cat('shoes-kids', 'أحذية أطفال', 'Kids Shoes', 'shoes', 3),
    cat('accessories', 'إكسسوارات', 'Accessories', null, 5, 'bag'),
    cat('acc-bags', 'شنط', 'Bags', 'accessories', 1),
    cat('acc-belts', 'أحزمة', 'Belts', 'accessories', 2),
    cat('acc-caps', 'كابات', 'Caps', 'accessories', 3),
    cat('acc-wallets', 'محافظ', 'Wallets', 'accessories', 4),
    cat('acc-watches', 'ساعات', 'Watches', 'accessories', 5)
  ];

  /* ---------- الألوان والمقاسات والماركات ---------- */
  const colors = [
    ['BLK', 'أسود', 'Black', '#1a1a1a'], ['WHT', 'أبيض', 'White', '#f4f2ee'], ['NVY', 'كحلي', 'Navy', '#1f2a44'],
    ['GRY', 'رمادي', 'Grey', '#8c8c8c'], ['BGE', 'بيج', 'Beige', '#d8c7a8'], ['OLV', 'زيتي', 'Olive', '#5b5f3a'],
    ['BRN', 'بني', 'Brown', '#6b4a33'], ['BLU', 'أزرق', 'Blue', '#3d6fb6'], ['RED', 'أحمر', 'Red', '#a8322d'],
    ['PNK', 'بينك', 'Pink', '#e7b4c0']
  ].map(([id, ar, en, hex], i) => ({ id, name: { ar, en }, hex, order: i + 1 }));

  const sizes = [
    ...['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((l, i) => ({ id: l, label: l, group: 'apparel', order: i + 1 })),
    ...['28', '30', '32', '34', '36', '38'].map((l, i) => ({ id: 'W' + l, label: l, group: 'waist', order: 20 + i })),
    ...['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'].map((l, i) => ({ id: 'EU' + l, label: l, group: 'shoes', order: 40 + i })),
    ...['2-3Y', '4-5Y', '6-7Y', '8-9Y', '10-11Y'].map((l, i) => ({ id: 'K' + l, label: l, group: 'kids', order: 60 + i })),
    { id: 'ONE', label: 'One size', group: 'one', order: 99 }
  ];

  const brands = [
    { id: 'nile-basics', name: 'Nile Basics', slug: 'nile-basics', logo: '', order: 1 },
    { id: 'urban-line', name: 'Urban Line', slug: 'urban-line', logo: '', order: 2 },
    { id: 'coastline', name: 'Coastline', slug: 'coastline', logo: '', order: 3 },
    { id: 'stride', name: 'Stride', slug: 'stride', logo: '', order: 4 }
  ];

  /* ---------- المنتجات ----------
     stock: دالة (color, size, index) → كمية، علشان يبقى فيه تركيبات خلصانة */
  let n = 0;
  function product(o) {
    n++;
    const variants = [];
    let i = 0;
    for (const c of o.colors) {
      for (const s of o.sizes) {
        variants.push({
          sku: `${o.sku}-${c}-${s.replace(/^(W|EU|K)/, '')}`,
          color: c, size: s,
          stock: o.stock ? o.stock(c, s, i) : (i * 7 + n * 3) % 13,
          reserved: 0, sold: 0, priceDelta: 0
        });
        i++;
      }
    }
    const created = new Date(Date.UTC(2025, 0, 1) + n * 86400000 * 3).toISOString();
    return {
      id: o.slug,
      slug: o.slug, sku: o.sku,
      name: o.name, description: o.description,
      categoryId: o.categoryId, subcategoryId: o.subcategoryId, brandId: o.brandId, tags: o.tags || [],
      price: o.price, salePrice: o.salePrice || null,
      images: o.colors.map(c => `ph:${o.kind}:${c}`),
      colors: o.colors, sizes: o.sizes, variants,
      lowStockThreshold: null,
      featured: !!o.featured, isNew: !!o.isNew, hidden: false,
      ratingAvg: o.rating || 0, ratingCount: o.ratingCount || 0, soldCount: o.sold || 0,
      seo: { title: '', description: '' },
      createdAt: created, updatedAt: created
    };
  }
  const APPAREL = ['S', 'M', 'L', 'XL', 'XXL'];

  const products = [
    product({ slug: 'black-oversized-tshirt', sku: 'TSH-OVS', kind: 'tshirt', categoryId: 'men', subcategoryId: 'men-tshirts', brandId: 'nile-basics',
      name: { ar: 'تيشيرت أوفر سايز قطن (تجريبي)', en: 'Oversized cotton T-shirt (demo)' },
      description: { ar: 'تيشيرت قطن 100% بقصة واسعة. منتج تجريبي.', en: '100% cotton relaxed-fit tee. Demo product.' },
      colors: ['BLK', 'WHT', 'BGE'], sizes: APPAREL, price: 450, salePrice: 380, isNew: true, featured: true, rating: 4.6, ratingCount: 12, sold: 140 }),
    product({ slug: 'oxford-shirt', sku: 'SHR-OXF', kind: 'shirt', categoryId: 'men', subcategoryId: 'men-shirts', brandId: 'urban-line',
      name: { ar: 'قميص أكسفورد (تجريبي)', en: 'Oxford shirt (demo)' },
      description: { ar: 'قميص أكسفورد بزراير على الياقة. منتج تجريبي.', en: 'Button-down oxford shirt. Demo product.' },
      colors: ['WHT', 'BLU'], sizes: APPAREL, price: 720, featured: true, rating: 4.3, ratingCount: 7, sold: 60 }),
    product({ slug: 'slim-fit-jeans', sku: 'JNS-SLM', kind: 'pants', categoryId: 'men', subcategoryId: 'men-jeans', brandId: 'urban-line',
      name: { ar: 'جينز سليم فيت (تجريبي)', en: 'Slim-fit jeans (demo)' },
      description: { ar: 'جينز بقصة سليم وقماش مرن. منتج تجريبي.', en: 'Slim-fit stretch denim. Demo product.' },
      colors: ['BLU', 'BLK'], sizes: ['W30', 'W32', 'W34', 'W36'], price: 890, salePrice: 750, rating: 4.4, ratingCount: 18, sold: 210 }),
    product({ slug: 'zip-hoodie', sku: 'HOD-ZIP', kind: 'hoodie', categoryId: 'men', subcategoryId: 'men-hoodies', brandId: 'nile-basics',
      name: { ar: 'هودي بسوستة (تجريبي)', en: 'Zip-up hoodie (demo)' },
      description: { ar: 'هودي قطن مبطن. منتج تجريبي.', en: 'Brushed-cotton zip hoodie. Demo product.' },
      colors: ['GRY', 'NVY', 'OLV'], sizes: APPAREL, price: 980, isNew: true, rating: 4.8, ratingCount: 9, sold: 85 }),
    product({ slug: 'bomber-jacket', sku: 'JKT-BMB', kind: 'jacket', categoryId: 'men', subcategoryId: 'men-jackets', brandId: 'urban-line',
      name: { ar: 'جاكيت بومبر (تجريبي)', en: 'Bomber jacket (demo)' },
      description: { ar: 'جاكيت بومبر خفيف. منتج تجريبي.', en: 'Lightweight bomber jacket. Demo product.' },
      colors: ['OLV', 'BLK'], sizes: APPAREL, price: 1650, salePrice: 1390, featured: true, rating: 4.5, ratingCount: 4, sold: 30,
      stock: (c, s) => (c === 'BLK' ? 0 : 4) }),
    product({ slug: 'linen-midi-dress', sku: 'DRS-LIN', kind: 'dress', categoryId: 'women', subcategoryId: 'women-dresses', brandId: 'coastline',
      name: { ar: 'فستان ميدي كتان (تجريبي)', en: 'Linen midi dress (demo)' },
      description: { ar: 'فستان كتان خفيف بطول ميدي. منتج تجريبي.', en: 'Breathable linen midi dress. Demo product.' },
      colors: ['BGE', 'BLK', 'RED'], sizes: ['XS', 'S', 'M', 'L', 'XL'], price: 1250, isNew: true, featured: true, rating: 4.7, ratingCount: 15, sold: 120 }),
    product({ slug: 'ribbed-top', sku: 'TOP-RIB', kind: 'top', categoryId: 'women', subcategoryId: 'women-tops', brandId: 'coastline',
      name: { ar: 'توب ريب (تجريبي)', en: 'Ribbed top (demo)' },
      description: { ar: 'توب ريب ضيق. منتج تجريبي.', en: 'Fitted ribbed knit top. Demo product.' },
      colors: ['WHT', 'BLK', 'PNK'], sizes: ['XS', 'S', 'M', 'L'], price: 390, salePrice: 320, rating: 4.2, ratingCount: 11, sold: 175 }),
    product({ slug: 'wide-leg-pants', sku: 'PNT-WDL', kind: 'pants', categoryId: 'women', subcategoryId: 'women-pants', brandId: 'coastline',
      name: { ar: 'بنطلون واسع (تجريبي)', en: 'Wide-leg trousers (demo)' },
      description: { ar: 'بنطلون بقصة واسعة ووسط عالي. منتج تجريبي.', en: 'High-waist wide-leg trousers. Demo product.' },
      colors: ['BGE', 'BLK'], sizes: ['XS', 'S', 'M', 'L', 'XL'], price: 840, isNew: true, rating: 4.1, ratingCount: 3, sold: 40 }),
    product({ slug: 'kids-graphic-tee', sku: 'KID-TEE', kind: 'tshirt', categoryId: 'kids', subcategoryId: 'kids-boys', brandId: 'nile-basics',
      name: { ar: 'تيشيرت أطفال (تجريبي)', en: 'Kids T-shirt (demo)' },
      description: { ar: 'تيشيرت قطن للأطفال. منتج تجريبي.', en: 'Soft cotton kids tee. Demo product.' },
      colors: ['BLU', 'RED'], sizes: ['K2-3Y', 'K4-5Y', 'K6-7Y', 'K8-9Y'], price: 260, rating: 4.5, ratingCount: 6, sold: 90 }),
    product({ slug: 'everyday-sneakers', sku: 'SNK-EVD', kind: 'shoe', categoryId: 'shoes', subcategoryId: 'shoes-men', brandId: 'stride',
      name: { ar: 'سنيكرز يومي (تجريبي)', en: 'Everyday sneakers (demo)' },
      description: { ar: 'سنيكرز خفيف بنعل مريح. منتج تجريبي.', en: 'Lightweight cushioned sneakers. Demo product.' },
      colors: ['WHT', 'BLK'], sizes: ['EU40', 'EU41', 'EU42', 'EU43', 'EU44'], price: 1450, salePrice: 1250, featured: true, rating: 4.6, ratingCount: 21, sold: 160 }),
    product({ slug: 'leather-belt', sku: 'BLT-LTH', kind: 'belt', categoryId: 'accessories', subcategoryId: 'acc-belts', brandId: 'urban-line',
      name: { ar: 'حزام جلد (تجريبي)', en: 'Leather belt (demo)' },
      description: { ar: 'حزام جلد طبيعي. منتج تجريبي.', en: 'Genuine leather belt. Demo product.' },
      colors: ['BRN', 'BLK'], sizes: ['ONE'], price: 350, rating: 4.0, ratingCount: 2, sold: 25 }),
    product({ slug: 'canvas-tote-bag', sku: 'BAG-TOT', kind: 'bag', categoryId: 'accessories', subcategoryId: 'acc-bags', brandId: 'coastline',
      name: { ar: 'شنطة توت قماش (تجريبي)', en: 'Canvas tote bag (demo)' },
      description: { ar: 'شنطة قماش كانفاس واسعة. منتج تجريبي.', en: 'Roomy canvas tote. Demo product.' },
      colors: ['BGE', 'BLK'], sizes: ['ONE'], price: 300, isNew: true, rating: 0, ratingCount: 0, sold: 0,
      stock: () => 0 })
  ];

  /* ---------- الأدوار (RBAC) ---------- */
  const roles = [
    { id: 'super_admin', name: { ar: 'مدير عام', en: 'Super Admin' }, permissions: ['all'] },
    { id: 'store_manager', name: { ar: 'مدير المتجر', en: 'Store Manager' }, permissions: [
      'dashboard.view', 'orders.read', 'orders.write', 'payments.confirm', 'products.write', 'categories.write', 'inventory.write',
      'customers.read', 'coupons.write', 'promotions.write', 'reviews.moderate', 'reports.view', 'settings.write'] },
    { id: 'inventory_manager', name: { ar: 'مسؤول المخزون', en: 'Inventory Manager' }, permissions: [
      'dashboard.view', 'orders.read', 'products.write', 'categories.write', 'inventory.write', 'reports.view'] },
    { id: 'customer_support', name: { ar: 'خدمة العملاء', en: 'Customer Support' }, permissions: [
      'dashboard.view', 'orders.read', 'orders.write', 'customers.read', 'reviews.moderate'] },
    { id: 'accountant', name: { ar: 'محاسب', en: 'Accountant' }, permissions: [
      'dashboard.view', 'orders.read', 'payments.confirm', 'customers.read', 'reports.view', 'audit.read'] }
  ];

  /* ---------- الإعدادات (قيم تجريبية) ---------- */
  const settings = [
    { id: 'general', storeName: { ar: 'اسم المتجر', en: 'Store name' }, tagline: { ar: '', en: '' },
      whatsapp: '', email: '', orderPrefix: 'CL', currency: 'EGP', defaultLang: 'ar' },
    { id: 'shipping', freeShippingOver: 1500, etaDays: { min: 2, max: 5 },
      governorates: { cairo: { enabled: true, price: 60 }, giza: { enabled: true, price: 60 }, alexandria: { enabled: true, price: 75 } },
      othersEnabled: false, othersPrice: 0 },
    { id: 'inventory', lowStockThreshold: 5 }
  ];

  App.demoData = { categories, colors, sizes, brands, products, roles, settings };
})(typeof window !== 'undefined' ? window : globalThis);
