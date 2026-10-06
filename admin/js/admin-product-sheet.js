(function(root){
  'use strict';
  const App=root.App,{h}=App,U=App.ui;
  App.productSheetUI={
    async export(template=false){
      App.catalogAdmin.requireAdmin('products.write');
      const data=await App.catalogAdmin.load();
      App.excel.download(App.excel.write(App.productSheet.sheets(data,template)),template?'products-template.xlsx':`products-${new Date().toISOString().slice(0,10)}.xlsx`);
      App.toast(template?'القالب جاهز، وشيت الأكواد فيه الأقسام والألوان والمقاسات المتاحة.':'تم تصدير كل المنتجات، بما فيها المخفية.');
    },
    render(el){
      const error=h('div',{role:'alert','data-sheet-error':''}),status=h('p',{role:'status',class:'muted'}),preview=h('div');
      const input=h('input',{type:'file',accept:'.xlsx',class:'input','aria-label':'ملف Excel للمنتجات'});
      const confirm=h('button',{class:'btn btn-primary',text:'تأكيد الاستيراد',disabled:true});
      const template=h('button',{class:'btn btn-outline',text:'تحميل قالب Excel',onclick:e=>U.action(e.currentTarget,()=>this.export(true),error)});
      let pending=null;
      input.addEventListener('change',async()=>{
        pending=null;confirm.disabled=true;preview.textContent='';error.textContent='';status.textContent='';
        const file=input.files[0];if(!file)return;
        input.disabled=true;
        await U.action(null,async()=>{
          if(!/\.xlsx$/i.test(file.name))throw new Error('اختار ملف .xlsx. ملفات .xls القديمة وCSV غير مدعومة هنا.');
          status.textContent='جاري قراءة الملف ومراجعة الصفوف…';
          const items=App.productSheet.parse(await App.excel.read(file));
          const rows=await App.catalogAdmin.previewImport(items);
          pending=items;
          const added=rows.filter(r=>!r.updated).length;
          status.textContent=`المعاينة: ${added} منتج جديد، و${rows.length-added} تعديل. لسه مفيش بيانات اتحفظت.`;
          preview.append(U.table({rows,columns:[{label:'المنتج',wrap:true,render:r=>r.name},{label:'الكود',render:r=>r.sku},{label:'العملية',render:r=>r.updated?'تعديل':'إضافة'},{label:'التركيبات',render:r=>r.variants},{label:'المخزون',render:r=>r.stock}]}));
          confirm.disabled=false;
        },error);
        if(!pending)status.textContent='الملف لم يُستورد. صحّح الأخطاء واختاره من جديد.';
        input.disabled=false;input.value='';
      });
      confirm.addEventListener('click',()=>{
        if(!pending)return;
        U.action(confirm,async()=>{
          input.disabled=true;template.disabled=true;
          try{
            const count=await App.catalogAdmin.importProducts(pending);
            pending=null;preview.textContent='';status.textContent=`تم استيراد ${count} منتج بنجاح.`;App.toast('تم استيراد المنتجات');
          }finally{
            input.disabled=false;template.disabled=false;
            // إعادة اختيار الملف ومراجعته مطلوبة بعد كل محاولة حفظ.
            pending=null;setTimeout(()=>{confirm.disabled=true;},0);
          }
        },error);
      });
      el.append(U.box('استيراد المنتجات من Excel',h('div',{class:'form product-sheet'},[
        h('p',{text:'حمّل القالب، واملأ شيت المنتجات: صف لكل لون ومقاس، وكرّر بيانات المنتج في كل صف. شيت الأكواد فيه الاختيارات المتاحة.'}),
        h('p',{class:'muted',text:'للتعديل على الموجود صدّر البضاعة أولًا. الاستيراد لا يحذف منتجات أو تركيبات غائبة، ولا يغيّر المحجوز أو المباع. التصدير يشمل كل البضاعة مهما كانت فلاتر البحث.'}),
        h('p',{class:'muted',text:'ملف .xlsx حتى ٥ ميجابايت، و٥٠ منتج / ١٥٠ تركيبة لكل استيراد. الصور بروابط HTTPS أو مراجع صور موجودة؛ الصور المدمجة والصيغ غير مدعومة.'}),
        h('div',{class:'toolbar'},[template,h('a',{class:'btn btn-outline',href:'#/products',text:'رجوع للمنتجات'})]),input,h('div',{class:'sheet-error'},error),status,preview,confirm
      ])));
    }
  };
})(window);
