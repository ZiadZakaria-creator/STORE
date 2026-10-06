(function (root) {
  'use strict';
  const App = root.App, { h } = App;
  const fields = ['q','cat','brand','color','size','min','max','stock','sale','featured','sort','page'];
  function read() {
    const params = new URLSearchParams(location.search), result = {};
    for (const key of fields) result[key] = params.get(key) || '';
    for (const key of ['stock','sale','featured']) result[key] = result[key] === '1';
    return result;
  }
  function href(values) {
    const params = new URLSearchParams();
    for (const key of fields) if (values[key]) params.set(key,values[key] === true ? '1' : String(values[key]));
    return 'shop.html' + (params.size ? '?' + params : '');
  }
  function render() {
    const C=App.catalog, values=read(), main=App.$('#main'); main.textContent='';
    document.title=App.t('nav.shop')+' — '+App.storeName();
    const form=h('form',{class:'shop-filters',action:'shop.html'});
    const field=(label,input)=>h('label',{class:'field'},[h('span',{text:App.t(label)}),input]);
    const select=(name,key,rows)=>{
      const el=h('select',{class:'input',name},[h('option',{value:'',text:App.t('shop.all')}),...rows.map(r=>h('option',{value:r.value,text:r.label}))]);
      el.value=values[name];return field(key,el);
    };
    const cats=C.categories.map(c=>({value:c.slug,label:C.categoryPath(c.id).map(x=>App.tx(x.name)).join(' / ')}));
    form.append(field('nav.search',h('input',{class:'input',name:'q',type:'search',value:values.q,maxlength:120})),
      select('cat','shop.category',cats),select('brand','shop.brand',C.brands.map(b=>({value:b.id,label:b.name}))),
      select('color','shop.color',C.colors.map(c=>({value:c.id,label:App.tx(c.name)}))),select('size','shop.size',C.sizes.map(s=>({value:s.id,label:s.label}))),
      field('shop.min',h('input',{class:'input',name:'min',type:'number',min:0,step:'0.01',value:values.min})),
      field('shop.max',h('input',{class:'input',name:'max',type:'number',min:0,step:'0.01',value:values.max})));
    for(const [name,key] of [['stock','shop.available'],['sale','shop.saleOnly'],['featured','shop.featuredOnly']]) form.append(h('label',{class:'filter-check'},[h('input',{type:'checkbox',name,value:'1',checked:values[name]}),h('span',{text:App.t(key)})]));
    const error=h('p',{class:'field-error',role:'alert'});
    form.append(error,h('button',{type:'submit',class:'btn btn-primary',text:App.t('shop.apply')}),h('a',{class:'btn btn-outline',href:'shop.html',text:App.t('shop.reset')}));
    form.addEventListener('submit',e=>{
      e.preventDefault();const next=Object.fromEntries(new FormData(form)); next.sort=sort.value;
      if(next.min!==''&&next.max!==''&&Number(next.min)>Number(next.max)){error.textContent=App.t('shop.rangeError');return;}
      location.href=href(next);
    });
    const sorts=['newest','price-asc','price-desc','name'];
    const keys=['shop.newest','shop.priceAsc','shop.priceDesc','shop.name'];
    const sort=h('select',{class:'input',name:'sort'},sorts.map((id,i)=>h('option',{value:id,text:App.t(keys[i])})));
    sort.value=sorts.includes(values.sort)?values.sort:'newest';
    sort.addEventListener('change',()=>{location.href=href({...values,sort:sort.value,page:''});});
    const result=C.paginate(C.query(values),values.page);
    const results=h('section',{class:'shop-results','aria-label':App.t('nav.shop')},[
      h('div',{class:'shop-toolbar'},[h('p',{role:'status','data-results':result.total,text:App.t('shop.count',{n:result.total})}),field('shop.sort',sort)]),
      result.total?h('div',{class:'product-grid'},result.items.map(App.productCard)):App.emptyProducts('shop.empty')
    ]);
    if(result.pages>1) results.append(h('nav',{class:'pagination','aria-label':App.t('shop.pages')},[
      result.page>1?h('a',{class:'btn btn-outline',href:href({...values,page:result.page-1}),text:App.t('shop.prev')}):null,
      h('span',{'aria-current':'page',text:App.t('shop.page',result)}),
      result.page<result.pages?h('a',{class:'btn btn-outline',href:href({...values,page:result.page+1}),text:App.t('shop.next')}):null
    ]));
    const category=C.categories.find(c=>c.id===values.cat||c.slug===values.cat);
    main.append(h('div',{class:'container section'},[
      App.breadcrumb([{text:App.t('nav.shop')}]),h('h1',{class:'page-title',text:category?App.tx(category.name):App.t('nav.shop')}),
      h('div',{class:'shop-layout'},[h('details',{class:'filter-panel',open:root.matchMedia('(min-width: 900px)').matches},[h('summary',{text:App.t('shop.filters')}),form]),results])
    ]));
  }
  App.page(render);
})(window);
