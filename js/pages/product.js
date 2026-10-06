(function (root) {
  'use strict';
  const App=root.App,{h}=App,C=App.catalog;
  let selectedColor='',selectedSize='',selectedImage=0,previousId;
  function render() {
    const params=new URLSearchParams(location.search),p=C.product(params.get('slug')||params.get('id'));
    const main=App.$('#main');main.textContent='';
    if(!p){document.title=App.t('product.missing')+' — '+App.storeName();main.append(h('section',{class:'container section notfound'},h('div',null,[h('h1',{text:App.t('product.missing')}),App.emptyProducts('product.missingText')])));return;}
    document.title=App.tx(p.name)+' — '+App.storeName();
    const meta=App.$('meta[name="description"]');if(meta)meta.content=App.tx(p.description).slice(0,160)||App.tx(p.name);
    if(previousId!==p.id){selectedColor='';selectedSize='';selectedImage=0;previousId=p.id;}
    const variants=p.variants||[],colors=[...new Set(variants.map(v=>v.color))],sizes=[...new Set(variants.map(v=>v.size))];
    if(!colors.includes(selectedColor))selectedColor='';if(!sizes.includes(selectedSize))selectedSize='';
    const image=h('img',{class:'product-image',alt:App.tx(p.name),width:800,height:1000,fetchpriority:'high'});
    const mainImage=h('button',{class:'product-image-button',type:'button','aria-label':App.t('product.zoom')},image);
    const thumbs=h('div',{class:'product-thumbs'}),photoStatus=h('p',{class:'muted',role:'status'});
    let refs=[];
    function drawGallery() {
      refs=(selectedColor&&p.colorImages?.[selectedColor]?.length?p.colorImages[selectedColor]:p.images)||[];
      selectedImage=Math.min(selectedImage,Math.max(0,refs.length-1));
      App.img.apply(image,refs[selectedImage]);thumbs.textContent='';
      refs.forEach((ref,index)=>{
        const label=App.t('product.photo',{n:index+1,total:refs.length}),img=h('img',{alt:'',width:80,height:100,loading:'lazy'});App.img.apply(img,ref);
        thumbs.append(h('button',{type:'button','aria-label':label,'aria-pressed':String(index===selectedImage),onclick:()=>{selectedImage=index;drawGallery();}},img));
      });
      photoStatus.textContent=refs.length?App.t('product.photo',{n:selectedImage+1,total:refs.length}):'';
    }
    mainImage.addEventListener('click',()=>{
      const large=h('img',{alt:App.tx(p.name)});App.img.apply(large,refs[selectedImage]);
      const dialog=h('dialog',{class:'image-dialog','aria-label':App.tx(p.name)},[h('button',{type:'button',class:'btn btn-outline',text:App.t('product.close'),onclick:()=>dialog.close()}),large]);
      dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
      dialog.addEventListener('close',()=>{dialog.remove();mainImage.focus();},{once:true});document.body.append(dialog);dialog.showModal();
    });
    const qty=h('input',{type:'number',class:'input product-quantity',value:1,min:1,max:App.cart.MAX_QTY,step:1,'aria-label':App.t('cart.quantity')});
    const add=h('button',{type:'button',class:'btn btn-primary product-add',disabled:true,text:App.t('product.add')});
    const price=h('div',{class:'price product-price','aria-live':'polite'}),stock=h('p',{class:'product-stock',role:'status'}),sku=h('p',{class:'muted product-sku'});
    const colorGroup=h('fieldset',{class:'variant-options'},h('legend',{text:App.t('shop.color')}));
    const sizeGroup=h('fieldset',{class:'variant-options'},h('legend',{text:App.t('shop.size')}));
    function drawOptions() {
      colorGroup.querySelectorAll('button').forEach(button=>button.remove());sizeGroup.querySelectorAll('button').forEach(button=>button.remove());
      colors.forEach(id=>{
        const color=C.color(id),name=App.tx(color?.name)||id,available=variants.some(v=>v.color===id&&C.available(v)>0);
        colorGroup.append(h('button',{type:'button',class:'variant-option','data-color':id,'aria-pressed':String(selectedColor===id),'aria-label':name,disabled:!available,onclick:()=>{
          selectedColor=id;if(!variants.some(v=>v.color===id&&v.size===selectedSize&&C.available(v)>0))selectedSize='';selectedImage=0;drawOptions();drawGallery();
        }},[h('span',{class:'swatch',style:`background:${/^#[0-9a-f]{6}$/i.test(color?.hex)?color.hex:'var(--surface-2)'}`}),h('span',{text:name})]));
      });
      sizes.forEach(id=>{
        const available=variants.some(v=>v.size===id&&(!selectedColor||v.color===selectedColor)&&C.available(v)>0);
        sizeGroup.append(h('button',{type:'button',class:'variant-option','data-size':id,'aria-pressed':String(selectedSize===id),disabled:!available,text:C.size(id)?.label||id,onclick:()=>{selectedSize=id;drawOptions();}}));
      });
      const variant=selectedColor&&selectedSize&&variants.find(v=>v.color===selectedColor&&v.size===selectedSize);
      const range=C.priceRange(p),onSale=p.salePrice!=null&&p.salePrice<p.price;
      price.textContent='';price.append(h('span',{class:'now'+(onSale?' is-sale':''),text:variant?App.money.format(C.price(p,variant)):range.min===range.max?App.money.format(range.min):App.t('product.from',{price:App.money.format(range.min)})}));
      if(onSale&&variant)price.append(h('span',{class:'old',text:App.money.format(p.price+Number(variant.priceDelta||0))}));
      stock.textContent=!C.inStock(p)?App.t('product.soldOut'):variant?App.t(C.available(variant)?'product.available':'product.unavailable',{n:C.available(variant)}):App.t('product.choose');
      sku.textContent=variant?App.t('product.sku',{sku:variant.sku}):'';
      add.disabled=!variant||C.available(variant)<1;qty.disabled=add.disabled;qty.max=variant?Math.min(App.cart.MAX_QTY,C.available(variant)):App.cart.MAX_QTY;
    }
    add.addEventListener('click',()=>App.cartAction(add,async()=>{
      const variant=variants.find(v=>v.color===selectedColor&&v.size===selectedSize);
      if(!variant)throw new Error(App.t('product.choose'));
      await App.cart.add(p.id,variant.sku,Number(qty.value));App.toast(App.t('cart.added'));App.openCart?.();
    }));
    drawGallery();drawOptions();
    const brand=C.brand(p.brandId),category=C.category(p.subcategoryId||p.categoryId);
    const bread=[{text:App.t('nav.shop'),href:'shop.html'},...C.categoryPath(category?.id).map(c=>({text:App.tx(c.name),href:'shop.html?cat='+encodeURIComponent(c.slug)})),{text:App.tx(p.name)}];
    const info=h('div',{class:'product-info'},[
      brand?h('a',{class:'muted',href:'shop.html?brand='+encodeURIComponent(brand.id),text:brand.name}):null,
      h('h1',{text:App.tx(p.name)}),price,colorGroup,sizeGroup,stock,sku,
      h('div',{class:'product-actions'},[qty,add,App.wishlistButton(p.id),h('a',{class:'btn btn-outline',href:'wishlist.html',text:App.t('nav.wishlist')})]),
      h('section',{class:'product-description'},[h('h2',{text:App.t('product.details')}),h('p',{text:App.tx(p.description)||App.t('product.descriptionEmpty')})])
    ]);
    const whatsapp=App.settings.general.whatsapp;
    if(whatsapp&&/^\d{8,15}$/.test(whatsapp))info.append(h('a',{class:'text-link',href:'https://wa.me/'+whatsapp+'?text='+encodeURIComponent(App.t('product.message',{name:App.tx(p.name),url:location.href})),target:'_blank',rel:'noopener',text:App.t('product.ask')}));
    main.append(h('div',{class:'container section'},[App.breadcrumb(bread),h('div',{class:'product-layout'},[h('div',{class:'product-gallery'},[mainImage,photoStatus,thumbs]),info])]));
    const related=C.byNewest(C.products.filter(other=>other.id!==p.id&&other.categoryId===p.categoryId)).slice(0,4);
    const shelf=App.productShelf('product.related',related);if(shelf)main.append(shelf);
  }
  App.page(render);
})(window);
