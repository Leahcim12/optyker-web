from pathlib import Path
import re

path=Path("_site/index.html")
text=path.read_text(encoding="utf-8")
version="20260906-lac-form1"
css=f'<link rel="stylesheet" href="/warehouse.css?v={version}" id="optykerWarehouseCss">'
js=f'<script src="/warehouse.js?v={version}" id="optykerWarehouseJs"></script>'

lac_style=r'''<style id="optykerWarehouseLacFormCss">
.whLacForm{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.whLacForm .wide{grid-column:1/-1}.whLacForm .whField input,.whLacForm .whField select{width:100%;box-sizing:border-box;height:40px;border:1px solid #cad8e2;border-radius:9px;background:#fff;color:#28465e;padding:0 10px;font:800 11px/1.2 "Segoe UI",Arial,sans-serif;outline:none}.whLacForm .whField input:focus,.whLacForm .whField select:focus{border-color:#1769aa;box-shadow:0 0 0 2px rgba(23,105,170,.1)}.whLacHint{margin-top:12px;padding:9px 10px;border:1px solid #dce6ed;border-radius:9px;background:#f7fafc;color:#718493;font-size:8px}.whLacRxLine{font-weight:900;color:#1769aa!important}
@media(max-width:760px){.whLacForm{grid-template-columns:1fr}.whLacForm .wide{grid-column:auto}}
</style>'''

lac_script=r'''<script id="optykerWarehouseLacFormJs">(function(){
if(window.__optykerWarehouseLacFormV1)return;window.__optykerWarehouseLacFormV1=true;
var INV='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-inventory-api';
var META='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-lac-inventory-meta';
function E(id){return document.getElementById(id)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function creds(){var c=window.OPTYKER_CLOUD||{};return {username:String(c.username||window.OPTYKER_ACTIVE_USER||'').trim(),password:String(c.password||'')}}
function call(url,action,payload){var c=creds();if(!c.username||!c.password)return Promise.reject(new Error('Sessione operatore non disponibile.'));return fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:action,username:c.username,password:c.password,payload:payload||{}})}).then(function(r){return r.json().catch(function(){return {}}).then(function(x){if(!r.ok||!x||x.ok===false)throw new Error(x&&x.error||('HTTP '+r.status));return x})})}
function toast(m,t){var x=E('whToast');if(!x){x=document.createElement('div');x.id='whToast';x.className='whToast';document.body.appendChild(x)}x.className='whToast '+(t||'');x.textContent=m;x.style.display='block';clearTimeout(x.__tm);x.__tm=setTimeout(function(){x.style.display='none'},4200)}
function categoryOptions(selected){var src=E('whCategory'),out='';if(src){Array.prototype.forEach.call(src.options,function(o){out+='<option value="'+esc(o.value)+'"'+(String(o.value)===String(selected)?' selected':'')+'>'+esc(o.textContent||o.value)+'</option>'})}return out||'<option value="contact_lenses" selected>Lenti a contatto per diottria</option>'}
function field(id,label,value,type,cls,extra){return '<div class="whField '+(cls||'')+'"><label>'+esc(label)+'</label><input id="'+id+'" type="'+(type||'text')+'" value="'+esc(value==null?'':value)+'" '+(extra||'')+'></div>'}
function rxTitle(sf,cil,ax){var a=[];if(String(sf||'').trim())a.push('SF '+String(sf).trim());if(String(cil||'').trim())a.push('CIL '+String(cil).trim());if(String(ax||'').trim())a.push('AX '+String(ax).trim());return a.join(' · ')}
function modal(item){item=item||{};var editing=!!item.id,old=E('whLacItemModal');if(old)old.remove();var m=document.createElement('div');m.id='whLacItemModal';m.className='whModal';var cat=item.category||'contact_lenses';m.innerHTML='<div class="whModalCard"><div class="whModalHead"><div><div class="whModalTitle">'+(editing?'Modifica lente a contatto':'Inserisci lente a contatto')+'</div><div class="whModalSub">Dati prodotto e parametri ottici della lente.</div></div><button class="whModalClose" type="button">×</button></div><div class="whLacForm">'+
field('whLacTitle','Nome prodotto',item.title||'','text','wide','autocomplete="off"')+
'<div class="whField"><label>Categoria</label><select id="whLacCategory">'+categoryOptions(cat)+'</select></div>'+
field('whLacSphere','Sfero',item.sphere||'','text','','inputmode="decimal" placeholder="es. -2,00"')+
field('whLacCylinder','Cilindro',item.cylinder||'','text','','inputmode="decimal" placeholder="es. -0,75"')+
field('whLacAxis','Asse',item.axis||'','number','','min="0" max="180" step="1" placeholder="0-180"')+
field('whLacVendor','Ditta',item.vendor||'')+
field('whLacType','Tipo prodotto',item.product_type||'')+
field('whLacSku','SKU',item.sku||'')+
field('whLacBarcode','Barcode',item.barcode||'')+
field('whLacPrice','Prezzo vendita',item.price==null?'':item.price,'number','','min="0" step="0.01" inputmode="decimal"')+
'</div><div class="whLacHint">La giacenza resta gestita esclusivamente con CARICA e DIFFERENZA MAGAZZINO.</div><div class="whFormFooter"><span></span><div class="whFormFooterRight"><button id="whLacCancel" class="whBtn" type="button">Annulla</button><button id="whLacSave" class="whBtn primary" type="button">'+(editing?'Salva modifiche':'Inserisci lente')+'</button></div></div></div>';
document.body.appendChild(m);m.classList.add('open');function close(){m.classList.remove('open');setTimeout(function(){m.remove()},180)}m.querySelector('.whModalClose').onclick=close;E('whLacCancel').onclick=close;m.onclick=function(ev){if(ev.target===m)close()};E('whLacSave').onclick=function(){save(item,m,close)};setTimeout(function(){var x=E('whLacTitle');if(x)x.focus()},30)}
function save(old,m,close){var title=String(E('whLacTitle').value||'').trim(),category=String(E('whLacCategory').value||'contact_lenses'),sphere=String(E('whLacSphere').value||'').trim(),cylinder=String(E('whLacCylinder').value||'').trim(),axis=String(E('whLacAxis').value||'').trim(),vendor=String(E('whLacVendor').value||'').trim(),productType=String(E('whLacType').value||'').trim(),sku=String(E('whLacSku').value||'').trim(),barcode=String(E('whLacBarcode').value||'').trim(),price=Number(E('whLacPrice').value||0);if(!title){toast('Inserisci il nome del prodotto.','error');return}if(axis){var ax=Number(axis);if(!isFinite(ax)||ax<0||ax>180){toast('L’asse deve essere compreso tra 0 e 180.','error');return}}if(!isFinite(price)||price<0){toast('Inserisci un prezzo di vendita valido.','error');return}var b=E('whLacSave');b.disabled=true;b.textContent='Salvataggio…';var payload={id:old.id||'',category:category,title:title,variant_title:rxTitle(sphere,cylinder,axis),vendor:vendor,product_type:productType,sku:sku,barcode:barcode,price:price,notes:old.notes||'',image_url:old.image_url||'',image_data:''};call(INV,old.id?'update_item':'create_item',payload).then(function(x){var item=x.data||{};if(!item.id)throw new Error('Prodotto non salvato');return call(META,'save',{inventory_item_id:item.id,sphere:sphere,cylinder:cylinder,axis:axis}).then(function(){return item})}).then(function(){toast(old.id?'Lente aggiornata':'Lente a contatto inserita','ok');close();if(window.openWarehouse)window.openWarehouse(category)}).catch(function(e){toast('Salvataggio non riuscito: '+e.message,'error')}).finally(function(){if(b&&document.body.contains(b)){b.disabled=false;b.textContent=old.id?'Salva modifiche':'Inserisci lente'}})}
function openEdit(id){call(META,'get',{id:id}).then(function(x){modal(x.data||{})}).catch(function(e){toast('Impossibile aprire la lente: '+e.message,'error')})}
document.addEventListener('click',function(ev){var b=ev.target&&ev.target.closest?ev.target.closest('#whNewBtn,[data-edit]'):null;if(!b)return;var cat=E('whCategory')?E('whCategory').value:'';if(cat!=='contact_lenses')return;if(b.id==='whNewBtn'){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();modal({category:'contact_lenses'});return}var id=b.getAttribute('data-edit');if(id){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();openEdit(id)}},true);
var enhanceTimer=0;function enhance(){clearTimeout(enhanceTimer);enhanceTimer=setTimeout(function(){var cat=E('whCategory')?E('whCategory').value:'';if(cat!=='contact_lenses')return;var rows=Array.prototype.slice.call(document.querySelectorAll('#whTableWrap tr')).filter(function(tr){return tr.querySelector('[data-edit]')&&!tr.dataset.lacMetaEnhanced});if(!rows.length)return;var ids=rows.map(function(tr){return tr.querySelector('[data-edit]').getAttribute('data-edit')}).filter(Boolean);call(META,'list',{ids:ids}).then(function(x){var map={};(x.data||[]).forEach(function(v){map[String(v.inventory_item_id)]=v});rows.forEach(function(tr){var id=tr.querySelector('[data-edit]').getAttribute('data-edit'),v=map[String(id)];tr.dataset.lacMetaEnhanced='1';if(!v)return;var t=rxTitle(v.sphere,v.cylinder,v.axis),cell=tr.querySelector('.whOptions');if(cell&&t){cell.textContent=t;cell.classList.add('whLacRxLine')}})}).catch(function(){})},80)}
new MutationObserver(enhance).observe(document.documentElement,{subtree:true,childList:true});document.addEventListener('change',function(ev){if(ev.target&&ev.target.id==='whCategory')setTimeout(enhance,120)},true);setTimeout(enhance,600);
})();</script>'''

if 'id="optykerWarehouseCss"' in text:
    text=re.sub(r'<link[^>]*id="optykerWarehouseCss"[^>]*>',css,text,count=1)
else:
    pos=text.find("</head>")
    text=(text[:pos]+css+"\n"+text[pos:]) if pos>=0 else css+"\n"+text

if 'id="optykerWarehouseLacFormCss"' not in text:
    pos=text.find("</head>")
    text=(text[:pos]+lac_style+"\n"+text[pos:]) if pos>=0 else lac_style+"\n"+text

if 'id="optykerWarehouseJs"' in text:
    text=re.sub(r'<script[^>]*id="optykerWarehouseJs"[^>]*></script>',js,text,count=1)
else:
    pos=text.rfind("</body>")
    text=(text[:pos]+js+"\n"+text[pos:]) if pos>=0 else text+"\n"+js

if 'id="optykerWarehouseLacFormJs"' not in text:
    pos=text.rfind("</body>")
    text=(text[:pos]+lac_script+"\n"+text[pos:]) if pos>=0 else text+"\n"+lac_script

path.write_text(text,encoding="utf-8")
print("Optyker warehouse loader OK",version)
