/* OPTYKER_IPHONE_SHOP_NAV_V2 */
(function(){
  function shopTabs(){return state?.tab==='shop'||state?.tab==='cart'||state?.tab==='recent'}
  window.openShopHome=function(){
    try{
      state.shopParent=null;
      state.shopCategory=null;
      state.shopProducts=[];
      state.shopPageInfo=null;
      state.shopError='';
    }catch{}
    goTab('shop');
  };

  function bagSvg(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l1 13H5z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>'}

  function decorateShop(){
    if(state?.me?.role!=='customer')return;
    const content=document.getElementById('content');
    if(!content)return;
    const page=content.querySelector('.page');
    if(!page||!shopTabs())return;
    page.classList.add('refShopV2');
    page.classList.toggle('refShopCartPage',state.tab==='cart');
    page.classList.toggle('refShopRecentPage',state.tab==='recent');

    if(!page.querySelector('.refShopChrome')){
      const chrome=document.createElement('div');
      chrome.className='refShopChrome';
      const title=state.tab==='cart'?'Carrello':state.tab==='recent'?'Acquistati di recente':'Shop';
      chrome.innerHTML=`<button class="refShopHomeBtn" onclick="openShopHome()" aria-label="Torna allo Shop"><span class="refShopMiniLogo"></span><span><b>OTTICA VISUAL CARE</b><small>${title}</small></span></button><div class="refShopChromeActions"><button onclick="goTab('recent')" aria-label="Acquistati di recente" class="refShopHistoryBtn">↺</button><button onclick="goTab('cart')" aria-label="Apri carrello" class="refShopCartBtn">${bagSvg()}<i>${Math.max(0,Number(cartCount?.()||0))}</i></button></div>`;
      page.prepend(chrome);
    }

    const header=page.querySelector('.header');
    if(header)header.classList.add('refShopHeader');
    const source=page.querySelector('.shopSource');
    if(source)source.classList.add('refShopSource');
    const roots=page.querySelectorAll('.shopRoot');
    roots.forEach((x,i)=>x.style.setProperty('--shop-i',String(i)));
    const products=page.querySelectorAll('.productCard');
    products.forEach(x=>x.classList.add('refProductCard'));
  }

  function wireNav(){
    if(state?.me?.role!=='customer')return;
    const center=document.querySelector('.refBottomNav .refNavCenter');
    if(center){
      center.setAttribute('onclick','openShopHome()');
      center.setAttribute('aria-label','Shop');
      center.classList.toggle('active',shopTabs());
      center.classList.add('refShopCenter');
      const orb=center.querySelector('.refNavOrb');
      if(orb&&!orb.querySelector('svg'))orb.innerHTML=bagSvg();
      let badge=center.querySelector('.refShopNavBadge');
      const count=Math.max(0,Number(cartCount?.()||0));
      if(count){
        if(!badge){badge=document.createElement('i');badge.className='refShopNavBadge';center.appendChild(badge)}
        badge.textContent=count>99?'99+':String(count);
      }else if(badge)badge.remove();
    }

    const navBell=Array.from(document.querySelectorAll('.refBottomNav .refNavBtn')).find(b=>/Notifiche/i.test(b.textContent||''));
    if(navBell){
      navBell.setAttribute('onclick','toggleNewsDrawer(true)');
      navBell.setAttribute('aria-label','Apri notifiche');
    }
    const topBell=document.querySelector('.refBell');
    if(topBell)topBell.setAttribute('onclick','toggleNewsDrawer(true)');
  }

  function enhanceShopV2(){wireNav();decorateShop()}

  const shopBaseRender=render;
  render=function(){shopBaseRender();setTimeout(enhanceShopV2,0)};
  const shopBaseShell=shell;
  shell=function(){shopBaseShell();setTimeout(enhanceShopV2,0)};

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(enhanceShopV2,0));else setTimeout(enhanceShopV2,0);
  setTimeout(enhanceShopV2,700);
})();
