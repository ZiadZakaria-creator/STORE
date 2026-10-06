(function (root) {
  'use strict';
  const App=root.App,{h}=App,F=App.form,U=App.ui;
  const labels={brands:'الماركات',colors:'الألوان',sizes:'المقاسات'};
  App.admin.route({id:'catalog-meta',label:'الماركات والألوان والمقاسات',icon:App.adminIcons.setup,perm:'categories.write',async render(el){
    const data=await App.catalogAdmin.load();
    const redraw=async()=>{el.textContent='';await this.render(el);};
    for(const collection of Object.keys(labels)){
      const edit=old=>{
        const fields=collection==='sizes'?[
          {name:'label',label:'المقاس',value:old?.label},
          {name:'group',label:'المجموعة',type:'select',value:old?.group||'apparel',options:[{value:'apparel',label:'ملابس'},{value:'shoes',label:'أحذية'},{value:'kids',label:'أطفال'},{value:'one',label:'مقاس واحد'}]}
        ]:collection==='brands'?[
          {name:'name',label:'اسم الماركة',value:old?.name},{name:'slug',label:'الرابط الإنجليزي',value:old?.slug,dir:'ltr'}
        ]:[{name:'nameAr',label:'اسم اللون بالعربي',value:old?.name.ar},{name:'nameEn',label:'اسم اللون بالإنجليزي',value:old?.name.en},{name:'hex',label:'اللون',type:'color',value:old?.hex||'#000000'}];
        fields.push({name:'order',label:'الترتيب',type:'number',value:old?.order??data[collection].length});
        const form=h('form',{class:'form',novalidate:true},[h('div',{class:'alert',role:'alert'}),...fields.map(F.field),h('button',{type:'submit',class:'btn btn-primary',text:'حفظ'})]);
        const modal=U.modal(labels[collection],form);
        form.addEventListener('submit',e=>{e.preventDefault();U.action(form.querySelector('[type=submit]'),async()=>{
          const values=F.values(form);await App.catalogAdmin.saveMeta(collection,{...old,...values,...(collection==='colors'?{name:{ar:values.nameAr,en:values.nameEn}}:{})});modal.close();await redraw();App.toast('اتحفظ');
        },form.querySelector('.alert'));});
      };
      const rows=data[collection].sort((a,b)=>a.order-b.order);
      el.append(U.box(labels[collection],U.table({rows,columns:[
        {label:'الاسم',render:r=>collection==='sizes'?`${r.label} (${r.group})`:collection==='brands'?r.name:App.tx(r.name)},
        {label:'الترتيب',render:r=>r.order},
        {label:'إجراءات',render:r=>h('div',{class:'toolbar'},[h('button',{class:'btn btn-sm btn-outline',text:'تعديل',onclick:()=>edit(r)}),h('button',{class:'btn btn-sm btn-outline',text:'حذف',onclick:e=>U.action(e.currentTarget,async()=>{if(await U.confirm('حذف العنصر؟ لازم يكون غير مستخدم في منتجات.','حذف')){await App.catalogAdmin.removeMeta(collection,r.id);await redraw();}})})])}
      ]}),h('button',{class:'btn btn-primary',text:'إضافة — '+labels[collection],onclick:()=>edit(null)})));
    }
  }});
})(window);
