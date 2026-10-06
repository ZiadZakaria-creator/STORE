(function (root) {
  'use strict';
  const App=root.App,{h}=App,F=App.form,U=App.ui;
  App.admin.route({id:'categories',label:'الأقسام',icon:App.adminIcons.overview,perm:'categories.write',async render(el){
    const rows=await App.db.list('categories');rows.sort((a,b)=>a.order-b.order);
    const redraw=async()=>{el.textContent='';await this.render(el);};
    const edit=old=>{
      const form=h('form',{class:'form',novalidate:true},[
        h('div',{class:'alert',role:'alert'}),
        F.field({name:'nameAr',label:'الاسم بالعربي',value:old?.name.ar,required:true}),
        F.field({name:'nameEn',label:'الاسم بالإنجليزي',value:old?.name.en}),
        F.field({name:'slug',label:'الرابط الإنجليزي',value:old?.slug,dir:'ltr'}),
        F.field({name:'parentId',label:'القسم الأب',type:'select',placeholder:'قسم رئيسي',value:old?.parentId,options:rows.filter(c=>c.id!==old?.id).map(c=>({value:c.id,label:App.tx(c.name)}))}),
        U.check('hidden','إخفاء القسم',old?.hidden),
        h('button',{class:'btn btn-primary',type:'submit',text:'حفظ القسم'})
      ]);
      const modal=U.modal(old?'تعديل القسم':'إضافة قسم',form);
      form.addEventListener('submit',e=>{e.preventDefault();U.action(form.querySelector('[type=submit]'),async()=>{
        const v=F.values(form);await App.catalogAdmin.saveMeta('categories',{...old,name:{ar:v.nameAr,en:v.nameEn},slug:v.slug,parentId:v.parentId,hidden:form.elements.hidden.checked});modal.close();await redraw();App.toast('القسم اتحفظ');
      },form.querySelector('.alert'));});
    };
    const move=async(from,to)=>{
      const source=rows.find(c=>c.id===from),target=rows.find(c=>c.id===to);
      if(!source||!target||source.parentId!==target.parentId)throw new Error('اسحب القسم داخل نفس المستوى.');
      const siblings=rows.filter(c=>c.parentId===source.parentId).map(c=>c.id);
      const destination=siblings.indexOf(to);
      siblings.splice(siblings.indexOf(from),1);siblings.splice(destination,0,from);
      await App.catalogAdmin.reorderCategories(siblings);await redraw();
    };
    const ordered=[],seen=new Set();
    const addTree=(parent,depth)=>{for(const c of rows.filter(c=>(c.parentId||null)===parent)){if(seen.has(c.id))continue;seen.add(c.id);ordered.push({...c,depth});addTree(c.id,depth+1);}};
    addTree(null,0);rows.filter(c=>!seen.has(c.id)).forEach(c=>ordered.push({...c,depth:0}));
    const table=U.table({rows:ordered,columns:[
      {label:'القسم',wrap:true,render:c=>h('span',{text:(c.depth?'↳ '.repeat(Math.min(c.depth,4)):'')+App.tx(c.name)})},
      {label:'الحالة',render:c=>c.hidden?'مخفي':'ظاهر'},
      {label:'ترتيب',render:c=>h('div',{class:'toolbar'},[-1,1].map(delta=>{
        const siblings=rows.filter(x=>x.parentId===c.parentId),target=siblings[siblings.findIndex(x=>x.id===c.id)+delta];
        return h('button',{class:'btn btn-sm btn-outline',text:delta<0?'↑':'↓','aria-label':(delta<0?'تحريك لأعلى ':'تحريك لأسفل ')+App.tx(c.name),disabled:!target,onclick:e=>U.action(e.currentTarget,()=>move(c.id,target.id))});
      }))},
      {label:'إجراءات',render:c=>h('div',{class:'toolbar'},[
        h('button',{class:'btn btn-sm btn-outline',text:'تعديل',onclick:()=>edit(c)}),
        h('button',{class:'btn btn-sm btn-outline',text:'حذف',onclick:e=>U.action(e.currentTarget,async()=>{if(await U.confirm('حذف القسم؟ الأقسام المستخدمة مش هتتمسح.','حذف')){await App.catalogAdmin.removeMeta('categories',c.id);await redraw();}})})
      ])}
    ]});
    let dragged=null;
    table.querySelectorAll('tbody tr').forEach((tr,i)=>{tr.draggable=true;tr.addEventListener('dragstart',e=>{dragged=ordered[i].id;e.dataTransfer.setData('text/plain',dragged);});tr.addEventListener('dragover',e=>e.preventDefault());tr.addEventListener('drop',e=>{e.preventDefault();if(dragged&&dragged!==ordered[i].id)U.action(null,()=>move(dragged,ordered[i].id));});});
    el.append(U.box('الأقسام والأقسام الفرعية',h('div',{class:'form'},[h('p',{class:'muted',text:'اسحب لترتيب الأقسام داخل نفس الأب، أو استخدم السهمين على الموبايل.'}),table]),h('button',{class:'btn btn-primary',text:'إضافة قسم',onclick:()=>edit(null)})));
  }});
})(window);
