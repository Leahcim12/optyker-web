// OVC Card: authoritative service prices. Browser prices and membership flags are ignored.
export const OVC_VERSION='20260910-ovc2';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cents=n=>Math.round(Number(n)*100);
export const isServiceId=id=>/^service:[0-9a-f-]{36}$/i.test(String(id||''));
export function shopifyVariantId(id){const s=String(id||'').trim();return /^\d+$/.test(s)?'gid://shopify/ProductVariant/'+s:s;}
export async function ovcContext(db,clientId=''){
  let card=null;
  if(clientId){
    if(!UUID.test(clientId))throw Error('Cliente non valido');
    const r=await db.from('optyker_ovc_cards').select('card_number,active,revision').eq('client_id',clientId).maybeSingle();
    if(r.error)throw r.error;
    if(!r.data)throw Error('OVC Card del cliente non disponibile: ricarica la scheda.');
    card=r.data;
  }
  const [items,prices]=await Promise.all([
    db.from('optyker_inventory_items').select('id,title,variant_title,price,sku,barcode,image_url,shopify_product_id,shopify_variant_id,vat_code,active,category').eq('active',true).eq('category','services').order('title').limit(1000),
    db.from('optyker_ovc_service_prices').select('item_id,card_price,revision').limit(2000)
  ]);
  if(items.error)throw items.error;if(prices.error)throw prices.error;
  const map=new Map((prices.data||[]).map(p=>[p.item_id,p]));
  return {card,services:(items.data||[]).map(i=>({...i,ovc_price:map.get(i.id)||null}))};
}
export function serviceProduct(item,card,idOverride){
  if(!item||item.category!=='services'||item.active!==true)return null;
  const normal=Number(item.price),dedicated=item.ovc_price?.card_price;
  const applied=card?.active===true && dedicated!=null;
  const price=applied?Number(dedicated):normal;
  if(!Number.isFinite(normal)||normal<0||!Number.isFinite(price)||price<0)throw Error('Prezzo servizio non valido: '+item.title);
  const discount=Math.max(0,cents(normal)-cents(price))/100;
  return {
    variant_id:idOverride||'service:'+item.id,product_id:item.shopify_product_id||'',
    shopify_variant_id:shopifyVariantId(item.shopify_variant_id),inventory_item_id:item.id,
    title:item.title||'Servizio',variant_title:item.variant_title||'',product_type:'Servizi',vendor:'Ottica Visual Care',
    sku:item.sku||'',barcode:item.barcode||'',image:item.image_url||'',available:true,inventory_quantity:null,
    is_service:true,standard_price:normal,card_price:dedicated==null?null:Number(dedicated),
    list_price:Math.max(normal,price),price:cents(price)/100,discount_percent:0,discount_amount:discount,
    ovc_card_applied:applied,ovc_card_number:applied?card.card_number:null,
    ovc_card_revision:card?.revision??null,ovc_price_revision:item.ovc_price?.revision||0,vat_code:item.vat_code||'',
    pricing_label:applied?'Tariffa OVC CARD applicata':'Tariffa standard',catalog_version:OVC_VERSION
  };
}
export function serviceForId(id,context){
  const normalized=shopifyVariantId(id);
  const item=context.services.find(i=>'service:'+i.id===id || (!!i.shopify_variant_id&&shopifyVariantId(i.shopify_variant_id)===normalized));
  return item?serviceProduct(item,context.card,id):null;
}
export function serviceSearch(context,search=''){
  const words=search.trim().toLocaleLowerCase('it').split(/\s+/).filter(Boolean);
  return context.services.map(i=>serviceProduct(i,context.card)).filter(p=>words.every(w=>(p.title+' '+p.sku+' '+p.barcode+' servizi').toLocaleLowerCase('it').includes(w)));
}
export function serviceDraftLine(line){
  if(!line.is_service)return null;
  const money={amount:Number(line.price).toFixed(2),currencyCode:'EUR'};
  const attrs=[{key:'Servizio Optyker',value:line.inventory_item_id},{key:'Tariffa',value:line.ovc_card_applied?'OVC CARD':'Standard'}];
  if(line.ovc_card_applied)attrs.push({key:'OVC Card',value:String(line.ovc_card_number)});
  if(line.shopify_variant_id){return {variantId:line.shopify_variant_id,quantity:line.quantity,priceOverride:money,customAttributes:attrs};}
  return {title:line.title,sku:line.sku,quantity:line.quantity,requiresShipping:false,
    taxable:!/^ART10$|^N[1-7](\.|$)/i.test(line.vat_code||''),originalUnitPriceWithCurrency:money,customAttributes:attrs};
}
export function assertOvcTotal(lines,actual,currency='EUR'){
  if(!lines.some(l=>l.is_service))return;
  const expected=lines.reduce((sum,l)=>sum+cents(l.price)*l.quantity,0);
  if(actual==null||currency!=='EUR'||!Number.isFinite(Number(actual))||cents(actual)!==expected)
    throw Error('Tariffa servizi o imposte cambiate. Ricarica il carrello prima di confermare: vendita non completata.');
}
