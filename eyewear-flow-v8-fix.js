(function(){
  if(window.__optykerEyewearFlowV8Fix)return;
  window.__optykerEyewearFlowV8Fix=true;
  window.OPTYKER_EYEWEAR_FLOW_V8_FIX_BUILD='20260906-eyewear-flow8-fix1';
  var lastDx=null;

  function E(id){return document.getElementById(id)}
  function text(v){return String(v==null?'':v).trim()}
  function lower(v){return text(v).toLocaleLowerCase('it-IT')}
  function isClient(v){return lower(v)==='del cliente'}
  function fieldWrap(el){return el&&el.closest?el.closest('.eyField'):null}
  function addOption(sel,value,label){
    if(!sel)return;
    var exists=Array.prototype.some.call(sel.options,function(o){return text(o.value||o.textContent)===value});
    if(exists)return;
    var o=document.createElement('option');o.value=value;o.textContent=label||value;
    var alt=Array.prototype.find.call(sel.options,function(x){return text(x.textContent)==='Altro'});
    if(alt)sel.insertBefore(o,alt);else sel.appendChild(o)
  }
  function notice(msg){
    var x=E('eyFlowV8Notice');
    if(!x){x=document.createElement('div');x.id='eyFlowV8Notice';x.style.cssText='position:fixed;z-index:250000;right:20px;bottom:20px;max-width:420px;padding:11px 13px;border-radius:10px;background:#8f2f2f;color:#fff;font:750 11px/1.35 Segoe UI,Arial,sans-serif;box-shadow:0 14px 36px rgba(18,42,63,.25)';document.body.appendChild(x)}
    x.textContent=msg;x.style.display='block';clearTimeout(x.__t);x.__t=setTimeout(function(){x.style.display='none'},3200)
  }
  function goStep(n){var b=document.querySelector('[data-ey-step="'+n+'"]');if(b)b.click()}

  function ensureFrameType(){
    var brand=E('eyFrameBrand');if(!brand)return;
    brand.placeholder='Es. Michael Optyker';
    var t=E('eyFrameType');
    if(!t){
      var w=fieldWrap(brand),d=document.createElement('div');d.className='eyField';
      d.innerHTML='<label>Tipo montatura</label><select id="eyFrameType"><option value="">Seleziona…</option><option>Cerchiata</option><option>Nylor</option><option>Glasant</option><option>Del cliente</option><option>Altro</option></select>';
      if(w&&w.parentNode)w.parentNode.insertBefore(d,w.nextSibling);
      t=E('eyFrameType')
    }
    addOption(t,'Del cliente')
  }

  function lensOptions(){return ['Monofocale','Progressiva','Supporto accomodativo','Office / Indoor','Degradativa','Bifocale','Neutra / Sole','Zoom di ricetta','Profondità di campo','Del cliente','Altro']}
  function ensureLensSides(){
    var dx=E('eyLensType');if(!dx)return;
    var l=fieldWrap(dx)&&fieldWrap(dx).querySelector('label');if(l)l.textContent='Tipo lente DX';
    lensOptions().forEach(function(v){addOption(dx,v)});
    var os=E('eyLensTypeOS');
    if(!os){
      var w=fieldWrap(dx),d=document.createElement('div');d.className='eyField';
      var h='<label>Tipo lente SX</label><select id="eyLensTypeOS"><option value="">Seleziona…</option>';
      lensOptions().forEach(function(v){h+='<option>'+v+'</option>'});h+='</select>';d.innerHTML=h;
      if(w&&w.parentNode)w.parentNode.insertBefore(d,w.nextSibling);os=E('eyLensTypeOS')
    }
    lensOptions().forEach(function(v){addOption(os,v)});
    if(lastDx===null)lastDx=text(dx.value);
    if(!text(dx.value)){os.value='';os.disabled=true}
    else os.disabled=false;
    var ow=fieldWrap(os);if(ow)ow.classList.toggle('eyLensWaiting',os.disabled)
  }

  function syncFrameClient(){
    var t=E('eyFrameType'),brand=E('eyFrameBrand');if(!t||!brand)return;
    var client=isClient(t.value),ids=['eyFrameModel','eyFrameColor','eyFrameDescription','eyFramePrice','eyFrameBarcode','eyFrameSku'];
    if(client){
      if(brand.value!=='Del cliente'){brand.dataset.eyBeforeClient=brand.value||'';brand.value='Del cliente'}
      brand.readOnly=true;
      ids.forEach(function(id){var x=E(id);if(!x)return;if(id==='eyFramePrice')x.value='0';else x.value='';x.disabled=true});
      var s=(E('eyFrameBarcodeSearch')||E('eyFrameWarehouseSearch'));var box=s&&s.closest('.eyFrameSearchBox');if(box)box.style.display='none'
    }else{
      if(brand.value==='Del cliente')brand.value=brand.dataset.eyBeforeClient||'';
      brand.readOnly=false;ids.forEach(function(id){var x=E(id);if(x)x.disabled=false});
      var s2=(E('eyFrameBarcodeSearch')||E('eyFrameWarehouseSearch'));var box2=s2&&s2.closest('.eyFrameSearchBox');if(box2)box2.style.display=''
    }
  }

  function syncLensSequence(ev){
    var dx=E('eyLensType'),os=E('eyLensTypeOS');if(!dx||!os)return;
    var cur=text(dx.value);
    if(ev&&ev.target===dx&&cur!==lastDx){os.value='';lastDx=cur}
    if(!cur){os.value='';os.disabled=true}else os.disabled=false;
    var w=fieldWrap(os);if(w)w.classList.toggle('eyLensWaiting',os.disabled);
    if(ev&&ev.target===dx&&cur){setTimeout(function(){try{os.focus()}catch(e){}},0)}
  }

  function warrantyOptions(){
    var sel=E('eyWarranty');if(!sel)return;
    var prev=text(sel.value)||'Base',price=Number(E('eyFramePrice')&&E('eyFramePrice').value||0),frameClient=isClient(E('eyFrameType')&&E('eyFrameType').value);
    var allowed=['Base'];
    if(!frameClient&&price>0&&price<=150)allowed.push('Silver');
    if(!frameClient&&price>150)allowed.push('Gold');
    sel.innerHTML=allowed.map(function(v){var p=v==='Silver'?' · € 20':v==='Gold'?' · € 100':' · inclusa';return '<option value="'+v+'">Garanzia '+v+p+'</option>'}).join('');
    sel.value=allowed.indexOf(prev)>=0?prev:'Base'
  }
  function ensureWarranty(){
    var price=E('eyLensPrice'),disc=E('eyDiscount');if(!price)return;
    var priceWrap=fieldWrap(price),parent=priceWrap&&priceWrap.parentNode;if(!parent)return;
    var box=E('eyWarrantyBox'),sel=E('eyWarranty');
    if(!box){box=document.createElement('div');box.id='eyWarrantyBox';box.className='eyField eyWarrantyBox';box.innerHTML='<label class="eyRequired">Garanzia</label><select id="eyWarranty"></select><small style="display:block;margin-top:5px;font-size:8px;color:#718493">Seleziona la garanzia prima di prezzo e sconto.</small>';parent.insertBefore(box,priceWrap);sel=E('eyWarranty')}
    else if(box.parentNode!==parent||box.nextSibling!==priceWrap)parent.insertBefore(box,priceWrap);
    warrantyOptions();
    if(disc){var dw=fieldWrap(disc);if(dw&&dw.parentNode===parent&&dw.previousElementSibling!==priceWrap){/* mantiene prezzo e sconto dopo garanzia */}}
  }

  function labelColors(){
    var p=E('eyewearPanel');if(!p)return;
    p.querySelectorAll('[data-ey-color]').forEach(function(b){
      var v=lower(b.getAttribute('data-ey-color')),title=b.querySelector('b'),sm=b.querySelector('small');
      if(/photo|foto/.test(v)){if(title)title.textContent='Fotocromatico';if(sm)sm.textContent='€ 40 a lente'}
      else if(/sun|sole/.test(v)){if(title)title.textContent='Sole';if(sm)sm.textContent='€ 20 a lente'}
    })
  }

  function ensureStyle(){
    if(E('eyFlowV8Css'))return;var st=document.createElement('style');st.id='eyFlowV8Css';st.textContent='.eyLensWaiting{opacity:.55}.eyWarrantyBox{order:-1;border:1px solid #cfe0eb;border-radius:9px;background:#f6fbfe;padding:9px}.eyField select:disabled,.eyField input:disabled{background:#eef2f5;color:#8a9aa6;cursor:not-allowed}';document.head.appendChild(st)
  }

  function ensure(){
    if(!E('eyewearPanel'))return false;
    ensureFrameType();ensureLensSides();syncFrameClient();syncLensSequence();ensureWarranty();labelColors();ensureStyle();return true
  }

  document.addEventListener('change',function(ev){
    if(!E('eyewearPanel'))return;
    if(ev.target===E('eyLensType'))syncLensSequence(ev);
    if(ev.target===E('eyFrameType')||ev.target===E('eyFramePrice')){syncFrameClient();ensureWarranty()}
  },true);
  document.addEventListener('input',function(ev){if(ev.target===E('eyFramePrice'))ensureWarranty()},true);

  document.addEventListener('click',function(ev){
    var b=ev.target&&ev.target.closest?ev.target.closest('[data-ey-next]'):null;if(!b)return;
    var n=Number(b.getAttribute('data-ey-next')||0);
    if(n===2&&isClient(E('eyFrameType')&&E('eyFrameType').value)){
      ev.preventDefault();ev.stopImmediatePropagation();goStep(2);return
    }
    if(n===3){
      var dx=text(E('eyLensType')&&E('eyLensType').value),os=text(E('eyLensTypeOS')&&E('eyLensTypeOS').value);
      ev.preventDefault();ev.stopImmediatePropagation();
      if(!dx){notice('Compila prima il tipo lente DX.');return}
      if(!os){notice('Ora compila il tipo lente SX.');try{E('eyLensTypeOS').focus()}catch(e){}return}
      goStep(3);return
    }
  },true);

  function boot(){if(!ensure())setTimeout(boot,200)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
  setInterval(ensure,700);
})();
