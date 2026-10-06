/* كل صف تركيبة؛ بيانات المنتج المتكررة لازم تتطابق. */
(function(root){
  'use strict';
  const App=root.App;
  const columns=[
    ['id','معرف المنتج'],['revision','إصدار المنتج'],['sku','كود المنتج'],['nameAr','الاسم بالعربي'],['nameEn','الاسم بالإنجليزي'],['slug','الرابط'],
    ['categoryId','كود القسم'],['subcategoryId','كود القسم الفرعي'],['brandId','كود الماركة'],['price','السعر'],['salePrice','سعر العرض'],
    ['descriptionAr','الوصف بالعربي'],['descriptionEn','الوصف بالإنجليزي'],['images','الصور'],['hidden','مخفي'],['featured','مميز'],['isNew','جديد'],['lowStockThreshold','حد المخزون القليل'],
    ['variantSku','كود التركيبة'],['color','كود اللون'],['size','كود المقاس'],['stock','المخزون'],['priceDelta','فرق السعر'],
    ['reserved','المحجوز (للعرض)'],['sold','المباع (للعرض)'],['available','المتاح (للعرض)']
  ];
  const shared=columns.slice(0,18).map(c=>c[0]);
  const clean=v=>String(v??'').trim();
  function sheets(data,template=false){
    const rows=[columns.map(c=>c[1])];
    if(!template)for(const p of data.products)for(const v of p.variants){
      const record={...p,nameAr:p.name.ar,nameEn:p.name.en,descriptionAr:p.description?.ar,descriptionEn:p.description?.en,images:(p.images||[]).join(' | '),
        hidden:p.hidden?1:0,featured:p.featured?1:0,isNew:p.isNew?1:0,variantSku:v.sku,color:v.color,size:v.size,stock:v.stock,priceDelta:v.priceDelta||0,reserved:v.reserved||0,sold:v.sold||0,available:App.catalog.available(v),revision:p.revision||0};
      rows.push(columns.map(([key])=>record[key]??''));
    }
    const refs=[['النوع','الكود','الاسم','القسم الأب / مجموعة المقاس']];
    for(const [group,label] of [['categories','قسم'],['brands','ماركة'],['colors','لون'],['sizes','مقاس']])for(const item of data[group])refs.push([label,item.id,typeof item.name==='object'?item.name.ar:item.name||item.label,item.parentId||item.group||'']);
    return [{name:'المنتجات',rows},{name:'الأكواد',rows:refs},{name:'التعليمات',rows:[['تعليمات الاستيراد'],
      ['كل صف يمثل لون ومقاس. كرر نفس بيانات المنتج لكل تركيبة؛ كود التركيبة لازم يكون فريد.'],
      ['لمنتج جديد: سيب معرف المنتج وإصدار المنتج فاضيين. لتعديل الموجود: صدّر أحدث نسخة واحتفظ بالمعرف والإصدار.'],
      ['استخدم أكواد الأقسام والألوان والمقاسات الموجودة في شيت الأكواد. أضف الناقص من اللوحة الأول.'],
      ['الصور: رابط HTTPS للصورة أو مرجع fs: لصورة موجودة بالمتجر. افصل الصور بعلامة |. مطلوب صورة واحدة على الأقل. لا يتم استيراد صور مدمجة في الشيت.'],
      ['مخفي ومميز وجديد: 1 = نعم، 0 = لا. اكتب الأسعار والأعداد كأرقام من غير عملة أو صيغ.'],
      ['المخزون هو الإجمالي ويشمل المحجوز. المحجوز والمباع والمتاح للعرض فقط ومش بيتغيروا بالاستيراد.'],
      ['الاستيراد لا يحذف أي منتج أو تركيبة مش موجودة في الملف.'],
      ['حد الاستيراد: 50 منتج و150 تركيبة في المرة، و5 ميجابايت. قسم التصدير الأكبر لملفات أصغر.'],
      ['راجع المعاينة ثم اضغط تأكيد الاستيراد. الملف كله بيتحفظ مع بعض أو كله يترفض.'],
      ['الأعمدة الاختيارية: الإنجليزي، الوصف، القسم الفرعي، الماركة، سعر العرض، حد المخزون القليل. سيبها فاضية لإزالتها.']
    ]}];
  }
  function parse(rows){
    if(!rows.length)throw new Error('الشيت فاضي. حمّل القالب واملأ بيانات المنتجات.');
    const headers=rows[0].map(clean), keys=headers.map(h=>columns.find(c=>c[1]===h||c[0]===h)?.[0]);
    if(headers.some((h,i)=>h&&!keys[i])||new Set(keys.filter(Boolean)).size!==keys.filter(Boolean).length)throw new Error('في عناوين أعمدة غير معروفة أو مكررة. استخدم القالب بدون تغيير العناوين.');
    for(const key of columns.slice(0,23).map(c=>c[0]))if(!keys.includes(key))throw new Error('العمود ناقص: '+columns.find(c=>c[0]===key)[1]);
    const groups=new Map(), errors=[];let count=0;
    const num=(r,k,optional=false)=>{const s=r[k];if(optional&&!s)return null;if(!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(s))throw new Error('رقم غير صحيح في '+columns.find(c=>c[0]===k)[1]);return Number(s);};
    const bool=(r,k)=>{if(!['0','1'].includes(r[k]))throw new Error('استخدم 0 أو 1 في '+columns.find(c=>c[0]===k)[1]);return r[k]==='1';};
    for(let i=1;i<rows.length;i++){
      if(!rows[i].some(v=>clean(v)))continue;
      if(++count>150)throw new Error('الحد الأقصى ١٥٠ تركيبة في كل استيراد. قسّم الملف.');
      try {
        if(rows[i].some((v,x)=>clean(v)&&!keys[x]))throw new Error('بيانات في عمود بدون عنوان.');
        const r=Object.fromEntries(keys.filter(Boolean).map(k=>[k,'']));keys.forEach((k,x)=>{if(k)r[k]=clean(rows[i][x]);});
        for(const [key,max] of Object.entries({sku:60,nameAr:120,nameEn:120,slug:80,descriptionAr:4000,descriptionEn:4000,variantSku:90}))if(r[key].length>max)throw new Error(columns.find(c=>c[0]===key)[1]+' أطول من '+max+' حرف.');
        r.sku=r.sku.toUpperCase();r.variantSku=r.variantSku.toUpperCase();
        if(!r.sku)throw new Error('كود المنتج مطلوب.');
        let group=groups.get(r.sku);
        if(group&&shared.some(k=>r[k]!==group.raw[k]))throw new Error('بيانات المنتج مش متطابقة مع الصف '+group.row+'؛ كرر نفس بيانات المنتج لكل تركيبته.');
        if(!group){
          if(r.id&&!/^[A-Za-z0-9_-]{1,100}$/.test(r.id))throw new Error('معرف المنتج غير صحيح.');
          if(r.id&&!r.revision)throw new Error('إصدار المنتج مطلوب لتعديل الموجود. صدّر نسخة جديدة.');
          const revision=num(r,'revision',true);if(revision!==null&&!Number.isInteger(revision))throw new Error('إصدار المنتج غير صحيح.');
          group={row:i+1,raw:r,input:{id:r.id||undefined,revision:revision??0,sku:r.sku,slug:r.slug,name:{ar:r.nameAr,en:r.nameEn},description:{ar:r.descriptionAr,en:r.descriptionEn},categoryId:r.categoryId,subcategoryId:r.subcategoryId,brandId:r.brandId,price:num(r,'price'),salePrice:num(r,'salePrice',true),lowStockThreshold:num(r,'lowStockThreshold',true),images:r.images.split('|').map(clean).filter(Boolean),hidden:bool(r,'hidden'),featured:bool(r,'featured'),isNew:bool(r,'isNew'),variants:[]}};
          groups.set(r.sku,group);
        }
        if(!/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(r.priceDelta))throw new Error('فرق السعر غير صحيح.');
        group.input.variants.push({sku:r.variantSku,color:r.color,size:r.size,stock:num(r,'stock'),priceDelta:Number(r.priceDelta)});
      }catch(e){errors.push(`الصف ${i+1}: ${e.message}`);}
    }
    if(!count)throw new Error('الشيت مفيهوش منتجات. املأ الصفوف تحت العناوين.');
    if(groups.size>50)throw new Error('الحد الأقصى ٥٠ منتج في كل استيراد. قسّم الملف.');
    if(errors.length)throw new Error(errors.join('\n'));
    return [...groups.values()].map(g=>({row:g.row,...g.input}));
  }
  App.productSheet={columns,sheets,parse};
})(typeof window!=='undefined'?window:globalThis);
