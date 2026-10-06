(function(root){
  'use strict';
  const App=root.App,{h}=App,F=App.form,U=App.ui;
  App.inventoryRows=(products,settings=App.settings)=>products.flatMap(p=>(p.variants||[]).map(v=>({...v,productId:p.id,productName:App.tx(p.name),available:App.catalog.available(v),threshold:p.lowStockThreshold??settings.inventory?.lowStockThreshold??5})));
  App.admin.route({id:'inventory',label:'المخزون',icon:App.adminIcons.overview,perm:'inventory.write',async badge(){return App.inventoryRows(await App.db.list('products')).filter(v=>v.available<=v.threshold).length;},async render(el){
    const products=await App.db.list('products'),rows=App.inventoryRows(products);
    const search=h('input',{class:'input',type:'search','aria-label':'بحث المخزون',placeholder:'اسم المنتج أو SKU'});
    const filter=h('select',{class:'input','aria-label':'فلتر المخزون'},[{value:'',text:'كل المخزون'},{value:'low',text:'المخزون القليل'},{value:'out',text:'نفد المخزون'}].map(o=>h('option',o)));
    const table=h('div');
    const redraw=async()=>{el.textContent='';await this.render(el);};
    const edit=v=>{
      const form=h('form',{class:'form',novalidate:true},[h('div',{class:'alert',role:'alert'}),h('p',{text:`${v.productName} — ${v.sku}`}),h('p',{text:`محجوز: ${v.reserved||0} · مباع: ${v.sold||0}`}),F.field({name:'stock',label:'المخزون الفعلي الجديد',type:'number',value:v.stock}),F.field({name:'reason',label:'سبب التعديل',required:true,maxlength:200}),h('button',{class:'btn btn-primary',type:'submit',text:'حفظ المخزون'})]);
      const modal=U.modal('تعديل المخزون',form);
      form.addEventListener('submit',e=>{e.preventDefault();U.action(form.querySelector('[type=submit]'),async()=>{const values=F.values(form);await App.catalogAdmin.setStock(v.productId,v.sku,values.stock,values.reason,v.stock);modal.close();await redraw();App.toast('المخزون اتحدّث');},form.querySelector('.alert'));});
    };
    const draw=()=>{
      const q=search.value.toLowerCase(),list=rows.filter(v=>(!q||(v.productName+' '+v.sku).toLowerCase().includes(q))&&(!filter.value||filter.value==='low'&&v.available<=v.threshold||filter.value==='out'&&v.available===0));
      table.textContent='';table.append(U.table({rows:list,columns:[
        {label:'المنتج / SKU',wrap:true,render:v=>h('div',null,[h('strong',{text:v.productName}),h('div',{dir:'ltr',text:v.sku})])},
        {label:'المخزون',render:v=>v.stock},{label:'محجوز',render:v=>v.reserved||0},{label:'المتاح',render:v=>U.chip(String(v.available),v.available<=v.threshold?'warn':'')},{label:'مباع',render:v=>v.sold||0},{label:'حد التنبيه',render:v=>v.threshold},
        {label:'إجراءات',render:v=>h('button',{class:'btn btn-sm btn-outline',text:'تعديل المخزون',onclick:()=>edit(v)})}
      ]}));
    };
    search.addEventListener('input',draw);filter.addEventListener('change',draw);draw();
    el.append(U.box('رصيد كل لون ومقاس',h('div',{class:'form'},[h('div',{class:'toolbar'},[search,filter]),table])));
    const logs=await App.db.list('inventoryLogs',{orderBy:['at','desc'],limit:50});
    el.append(U.box('آخر حركات المخزون',U.table({rows:logs,columns:[{label:'التاريخ',render:r=>U.date(r.at)},{label:'SKU',render:r=>r.sku},{label:'التغيير',render:r=>r.delta.stock},{label:'السبب',wrap:true,render:r=>r.reason}]})));
  }});
})(window);
