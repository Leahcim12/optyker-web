import {db,money,norm} from './base.ts';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CART_PREFIX='client_cart:';

function cleanClientId(v:any){const id=norm(v);if(!UUID.test(id))throw new Error('Cliente non valido');return id}
function cleanDepartment(v:any){const n=Number(v||0);return [1,2,3].includes(n)?n:null}
function cleanText(v:any,n=255){return String(v??'').slice(0,n)}
function normalItem(raw:any){
 const id=norm(raw?.variant_id);if(!id||id.startsWith(CART_PREFIX))return null;
 const quantity=Number(raw?.quantity||1);if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw new Error('Quantità carrello non valida');
 return {variant_id:id,title:cleanText(raw?.title||'Prodotto'),variant_title:cleanText(raw?.variant_title||''),sku:cleanText(raw?.sku||''),barcode:cleanText(raw?.barcode||''),image:cleanText(raw?.image||'',2000),price:money(raw?.price),list_price:money(raw?.list_price??raw?.price),fiscal_vat_code:cleanText(raw?.fiscal_vat_code||raw?.vat_code||'',40),fiscal_item_type:cleanText(raw?.fiscal_item_type||'',40),quantity,department:cleanDepartment(raw?.department),locked_price:false};
}
async function assertClient(id:string){const {data,error}=await db.from('optyker_clients').select('id').eq('id',id).maybeSingle();if(error)throw error;if(!data)throw new Error('Cliente non trovato')}
async function rowFor(id:string){const {data,error}=await db.from('optyker_client_carts').select('client_id,items,updated_by,updated_at').eq('client_id',id).maybeSingle();if(error)throw error;return data||{client_id:id,items:[],updated_by:'',updated_at:null}}

export async function getClientCart(body:any){const id=cleanClientId(body?.payload?.client_id);await assertClient(id);return await rowFor(id)}

export async function saveClientCart(body:any,operator:string){
 const id=cleanClientId(body?.payload?.client_id);await assertClient(id);
 const incoming=Array.isArray(body?.payload?.items)?body.payload.items:[];if(incoming.length>100)throw new Error('Troppi articoli nel carrello');
 const current=await rowFor(id),locked=new Map<string,any>();
 for(const x of (Array.isArray(current.items)?current.items:[])){const key=norm(x?.variant_id);if(key.startsWith(CART_PREFIX))locked.set(key,x)}
 const out:any[]=[];
 for(const raw of incoming){
  const key=norm(raw?.variant_id);
  if(key.startsWith(CART_PREFIX)){
   const server=locked.get(key);if(!server)continue;
   out.push({...server,quantity:Number(server.quantity||1),department:cleanDepartment(raw?.department??server.department)});locked.delete(key);continue;
  }
  const item=normalItem(raw);if(item)out.push(item);
 }
 // An order created while the cashier was open must never be lost by a stale browser save.
 for(const server of locked.values())out.push(server);
 const {data,error}=await db.from('optyker_client_carts').upsert({client_id:id,items:out,updated_by:operator,updated_at:new Date().toISOString()},{onConflict:'client_id'}).select('client_id,items,updated_by,updated_at').single();if(error)throw error;return data;
}

export async function clearClientCart(clientId:any,operator:string){const id=norm(clientId);if(!id)return null;if(!UUID.test(id))throw new Error('Cliente non valido');const {data,error}=await db.from('optyker_client_carts').upsert({client_id:id,items:[],updated_by:operator,updated_at:new Date().toISOString()},{onConflict:'client_id'}).select('client_id,items,updated_by,updated_at').single();if(error)throw error;return data}

export function hasClientCartLine(lines:any[]){return (lines||[]).some(x=>norm(x?.variant_id).startsWith(CART_PREFIX))}

export async function quoteClientCartLines(clientId:any,linesIn:any[]){
 const requested=(linesIn||[]).filter(x=>norm(x?.variant_id).startsWith(CART_PREFIX));if(!requested.length)return [];
 const id=cleanClientId(clientId),row=await rowFor(id),server=new Map<string,any>();for(const x of (Array.isArray(row.items)?row.items:[])){const key=norm(x?.variant_id);if(key.startsWith(CART_PREFIX))server.set(key,x)}
 const out:any[]=[];
 for(const choice of requested){
  const key=norm(choice?.variant_id),saved=server.get(key);if(!saved)throw new Error('Un ordine non è più presente nel carrello del cliente. Ricarica la Cassa.');
  const price=money(saved.price);if(price<0)throw new Error('Importo ordine non valido');
  out.push({product_id:'',variant_id:key,title:cleanText(saved.title||'Ordine cliente'),variant_title:cleanText(saved.variant_title||''),vendor:'Ottica Visual Care',product_type:saved.source_type==='eyewear_busta'?'Occhiali su ordinazione':'Lenti a contatto su ordinazione',sku:cleanText(saved.sku||saved.variant_title||''),barcode:'',image:'',inventory_item_id:null,price,quantity:Number(saved.quantity||1),total:money(price*Number(saved.quantity||1)),list_price:price,discount_percent:0,discount_amount:0,discount_total:0,inventory_quantity:null,needs_order:false,fiscal_vat_code:cleanText(saved.fiscal_vat_code||'',40),fiscal_item_type:'goods',is_client_cart_order:true,source_work_order_id:saved.source_work_order_id||null,source_sheet_id:saved.source_sheet_id||null,department:cleanDepartment(choice?.department??saved.department)});
 }
 return out;
}
