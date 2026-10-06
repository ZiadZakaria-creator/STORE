(function (root) {
  'use strict';
  const App = root.App, { h } = App, F = App.form, U = App.ui;
  const option = (value, label) => ({value,label});
  async function editor(el, id) {
    const data = await App.catalogAdmin.load();
    const old = id && data.products.find(p => p.id === id);
    if (id && !old) throw new Error('المنتج مش موجود.');
    let images = [...(old?.images || [])];
    let variants = App.clone(old?.variants || []);
    const error = h('div',{class:'alert','role':'alert'});
    const form = h('form',{class:'form product-editor',novalidate:true},[
      error,
      h('div',{class:'form-grid'},[
        F.field({name:'nameAr',label:'اسم المنتج بالعربي',required:true,value:old?.name.ar}),
        F.field({name:'nameEn',label:'اسم المنتج بالإنجليزي',value:old?.name.en}),
        F.field({name:'slug',label:'الرابط الإنجليزي',required:true,dir:'ltr',value:old?.slug,hint:'حروف إنجليزية صغيرة وأرقام وشرطات'}),
        F.field({name:'sku',label:'كود المنتج SKU',required:true,dir:'ltr',value:old?.sku}),
        F.field({name:'descriptionAr',label:'الوصف بالعربي',type:'textarea',value:old?.description?.ar}),
        F.field({name:'descriptionEn',label:'الوصف بالإنجليزي',type:'textarea',value:old?.description?.en}),
        F.field({name:'categoryId',label:'القسم',type:'select',placeholder:'اختار القسم',value:old?.categoryId,options:data.categories.map(c=>option(c.id,App.tx(c.name)))}),
        F.field({name:'subcategoryId',label:'القسم الفرعي (اختياري)',type:'select',placeholder:'بدون قسم فرعي',options:[]}),
        F.field({name:'brandId',label:'الماركة (اختياري)',type:'select',placeholder:'بدون ماركة',value:old?.brandId,options:data.brands.map(b=>option(b.id,b.name))}),
        F.field({name:'price',label:'السعر بالجنيه',type:'number',required:true,value:old?.price}),
        F.field({name:'salePrice',label:'سعر العرض (اختياري)',type:'number',value:old?.salePrice}),
        F.field({name:'lowStockThreshold',label:'حد المخزون القليل للمنتج',type:'number',value:old?.lowStockThreshold,hint:'سيبه فاضي لاستخدام الحد العام من الإعدادات'})
      ]),
      h('div',{class:'toolbar'},[U.check('hidden','مخفي من المتجر',old?.hidden),U.check('featured','منتج مميز',old?.featured),U.check('isNew','جديد',old?.isNew)])
    ]);
    const sub = form.elements.subcategoryId;
    const updateSub = () => { sub.textContent=''; sub.append(h('option',{value:'',text:'بدون قسم فرعي'})); data.categories.filter(c=>c.parentId===form.elements.categoryId.value).forEach(c=>sub.append(h('option',{value:c.id,text:App.tx(c.name)}))); };
    form.elements.categoryId.addEventListener('change',updateSub); updateSub(); sub.value=old?.subcategoryId || '';
    const imageList = h('div',{class:'image-list'});
    const drawImages = () => {
      imageList.textContent='';
      images.forEach((ref, index) => {
        const image = h('img',{alt:'صورة المنتج',width:90,height:110}); App.img.apply(image,ref);
        imageList.append(h('div',{class:'image-item'},[image,h('button',{type:'button',class:'btn btn-sm btn-outline',text:index===0?'الصورة الرئيسية':'خليها الرئيسية',disabled:index===0,onclick:()=>{images.unshift(images.splice(index,1)[0]);drawImages();}}),h('button',{type:'button',class:'text-link',text:'إزالة الصورة',onclick:()=>{images.splice(index,1);drawImages();}})]));
      });
    };
    drawImages();
    const upload = h('input',{type:'file',name:'photos',accept:'image/jpeg,image/png,image/webp',multiple:true,'aria-label':'رفع صور المنتج'});
    const status = h('p',{class:'muted',role:'status'});
    const save = h('button',{type:'submit',class:'btn btn-primary',text:'حفظ المنتج'});
    let uploading = false;
    upload.addEventListener('change',async()=>{
      if (images.length+upload.files.length>8) {error.textContent='الحد الأقصى ٨ صور.';error.className='alert alert-error';return;}
      uploading=true;save.disabled=true;upload.disabled=true;
      const files=[...upload.files];
      await U.action(null,async()=>{for(const file of files){status.textContent='جاري تصغير ورفع الصور…';images.push(await App.img.upload(file));drawImages();} status.textContent='الصور اترفعت. احفظ المنتج لإرفاقها.';},error);
      uploading=false;save.disabled=false;upload.disabled=false;upload.value='';
    });
    form.append(U.box('صور المنتج',h('div',{class:'form'},[h('p',{class:'muted',text:'لحد ٨ صور؛ التصغير بيتم تلقائيًا. أول صورة هي الرئيسية.'}),upload,status,imageList])));
    const rows = h('div',{class:'variant-list'});
    function drawVariants() {
      rows.textContent='';
      variants.forEach((v,index)=>{
        const row = h('div',{class:'variant-row','data-variant':index});
        const fields = [
          {name:`vsku${index}`,label:'SKU التركيبة',value:v.sku},
          {name:`vcolor${index}`,label:'اللون',type:'select',value:v.color,options:data.colors.map(c=>option(c.id,App.tx(c.name)))},
          {name:`vsize${index}`,label:'المقاس',type:'select',value:v.size,options:data.sizes.map(s=>option(s.id,s.label))},
          {name:`vstock${index}`,label:'المخزون',type:'number',value:v.stock},
          {name:`vdelta${index}`,label:'فرق السعر',type:'number',value:v.priceDelta || 0}
        ];
        fields.forEach((f,i)=>{const field=F.field(f);const input=field.querySelector('input,select'); input.addEventListener('input',()=>{v[['sku','color','size','stock','priceDelta'][i]]=input.value;});row.append(field);});
        row.append(h('p',{class:'muted',text:`محجوز: ${v.reserved||0} · مباع: ${v.sold||0}`}));
        row.append(h('button',{type:'button',class:'btn btn-sm btn-outline',text:'إزالة التركيبة',onclick:()=>{if(v.reserved||v.sold){App.toast('مينفعش إزالة تركيبة ليها حجز أو مبيعات.');return;}variants.splice(index,1);drawVariants();}}));
        rows.append(row);
      });
    }
    drawVariants();
    const add = h('button',{type:'button',class:'btn btn-outline',text:'إضافة تركيبة',onclick:()=>{
      if(!data.colors.length||!data.sizes.length){App.toast('ضيف لون ومقاس من قسم الماركات والألوان والمقاسات الأول.');return;}
      variants.push({sku:'',color:data.colors[0].id,size:data.sizes[0].id,stock:0,reserved:0,sold:0,priceDelta:0});drawVariants();
    }});
    form.append(U.box('الألوان والمقاسات والمخزون',h('div',{class:'form'},[rows,add])));
    form.append(h('div',{class:'toolbar'},[save,h('a',{class:'btn btn-outline',href:'#/products',text:'رجوع للمنتجات'})]));
    form.addEventListener('submit',e=>{
      e.preventDefault();if(uploading)return;
      U.action(save,async()=>{
        const values=F.values(form);
        await App.catalogAdmin.saveProduct({...old,id:old?.id,revision:old?.revision||0,name:{ar:values.nameAr,en:values.nameEn},description:{ar:values.descriptionAr,en:values.descriptionEn},slug:values.slug,sku:values.sku,categoryId:values.categoryId,subcategoryId:values.subcategoryId,brandId:values.brandId,price:values.price,salePrice:values.salePrice,lowStockThreshold:values.lowStockThreshold,images,variants,hidden:form.elements.hidden.checked,featured:form.elements.featured.checked,isNew:form.elements.isNew.checked});
        App.toast('المنتج اتحفظ');App.admin.go('products');
      },error);
    });
    el.append(U.box(old?'تعديل المنتج':'إضافة منتج',form));
  }
  App.admin.route({id:'products',label:'المنتجات',icon:App.adminIcons.overview,perm:'products.write',async render(el,param){
    if(param)return editor(el,param==='new'?null:param);
    const products=await App.db.list('products');
    const search=h('input',{class:'input',type:'search',placeholder:'بحث بالاسم أو الكود','aria-label':'بحث المنتجات'});
    const filter=h('select',{class:'input','aria-label':'حالة المنتجات'},[{value:'',text:'كل المنتجات'},{value:'visible',text:'الظاهرة'},{value:'hidden',text:'المخفية'},{value:'demo',text:'التجريبية'}].map(o=>h('option',o)));
    const table=h('div');
    const draw=()=>{
      const q=search.value.trim().toLowerCase();
      const list=products.filter(p=>(!q||[p.name.ar,p.name.en,p.sku].some(s=>String(s).toLowerCase().includes(q)))&&(!filter.value||filter.value==='demo'&&p.demo||filter.value==='hidden'&&p.hidden||filter.value==='visible'&&!p.hidden));
      table.textContent='';table.append(U.table({rows:list,columns:[
        {label:'المنتج',wrap:true,render:p=>h('div',null,[h('strong',{text:App.tx(p.name)}),p.demo?U.chip('تجريبي'):null])},
        {label:'السعر',render:p=>App.money.format(p.salePrice??p.price)},
        {label:'المتاح',render:p=>App.catalog.totalAvailable(p)},
        {label:'الحالة',render:p=>p.hidden?'مخفي':'ظاهر'},
        {label:'إجراءات',render:p=>h('div',{class:'toolbar'},[
          h('a',{class:'btn btn-sm btn-outline',href:'#/products/'+p.id,text:'تعديل'}),
          h('button',{class:'btn btn-sm btn-outline',text:p.hidden?'إظهار':'إخفاء',onclick:e=>U.action(e.currentTarget,async()=>{await App.catalogAdmin.saveProduct({...p,hidden:!p.hidden});el.textContent='';await this.render(el);})}),
          h('button',{class:'btn btn-sm btn-outline',text:'نسخ',onclick:e=>U.action(e.currentTarget,async()=>{const id=await App.catalogAdmin.duplicateProduct(p.id);App.admin.go('products/'+id);})}),
          h('button',{class:'btn btn-sm btn-outline',text:'حذف',onclick:e=>U.action(e.currentTarget,async()=>{if(await U.confirm('حذف المنتج نهائيًا؟ الصور المشتركة هتفضل محفوظة.','حذف')){await App.catalogAdmin.removeProduct(p.id);el.textContent='';await this.render(el);}})})
        ])}
      ]}));
    };
    search.addEventListener('input',draw);filter.addEventListener('change',draw);draw();
    el.append(U.box('إدارة المنتجات',h('div',{class:'form'},[h('div',{class:'toolbar'},[search,filter]),table]),h('a',{href:'#/products/new',class:'btn btn-primary',text:'إضافة منتج'})));
  }});
})(window);
