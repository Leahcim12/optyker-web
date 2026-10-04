import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const U=Deno.env.get('SUPABASE_URL')||'',S=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const db=createClient(U,S,{auth:{autoRefreshToken:false,persistSession:false}});
const VERSION='20261004-invoice-edit4';
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store'};
const out=(x:any,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,'Content-Type':'application/json; charset=utf-8'}});
const norm=(v:any)=>String(v??'').trim();
const money=(v:any)=>{const n=Number(v);return Number.isFinite(n)?Math.round((n+Number.EPSILON)*100)/100:0};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(v:any){return v&&typeof v==='object'&&!Array.isArray(v)?v:{}}
function arr(v:any){return Array.isArray(v)?v:[]}
function first(...values:any[]){for(const v of values){const x=norm(v);if(x)return x}return ''}
async function adminAuth(req:Request){
 const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(!token)return null;
 try{
  const parts=token.split('.');if(parts.length!==2||!S)throw new Error();
  const decode=(s:string)=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(S),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const ok=await crypto.subtle.verify('HMAC',key,decode(parts[1]),new TextEncoder().encode(parts[0]));
  const p=JSON.parse(new TextDecoder().decode(decode(parts[0])));
  if(!ok||p.scope!=='billing_admin'||norm(p.sub).replace(/\s+/g,' ').toUpperCase()!=='OTTICA VISUAL CARE'||!Number.isFinite(p.exp)||p.exp<=Date.now()/1000)throw new Error();
  return 'Ottica Visual Care';
 }catch{throw new Error('AUTH_REQUIRED: sessione amministrativa scaduta. Accedi nuovamente.')}
}
async function auth(body:any,req:Request){
 const admin=await adminAuth(req);if(admin)return admin;
 const username=norm(body?.username),password=String(body?.password||'');if(!username||password.length<8)throw new Error('AUTH_REQUIRED');
 const {data,error}=await db.rpc('optyker_staff_login_internal',{p_username:username,p_password:password});
 if(error||!data?.ok)throw new Error('Credenziali non valide');return String(data.username||username);
}
function rawLines(p:any){return arr(p.lines).length?arr(p.lines):arr(p.items_list).length?arr(p.items_list):arr(p.items)}
function safeLines(payload:any,total:number,header:string){
 const p=object(payload),raw=rawLines(p);
 const rows=raw.map((x:any,index:number)=>{const r=object(x),qty=Math.max(0,Number(r.quantity??r.qty??1)||0),unit=money(r.price??r.unit_price??r.net_price??r.unit_net_price??0),lineTotal=money(r.total??r.gross_price??r.net_price_total??unit*qty);
 return {source_index:index,description:first(r.title,r.description,r.name,header,'Articolo'),variant:first(r.variant_title,r.subtitle),sku:first(r.sku,r.code),quantity:qty||1,unit_price:unit,total:lineTotal,vat_code:first(r.fiscal_vat_code,r.vat_code,r.vat?.value,r.vat?.description),discount_percent:Math.max(0,Number(r.discount_percent||0)||0)}}).filter((x:any)=>x.description);
 return rows.length?rows:[{source_index:null,description:header||'Fattura',variant:'',sku:'',quantity:1,unit_price:money(total),total:money(total),vat_code:'',discount_percent:0}];
}
function customerFrom(row:any,payload:any){const p=object(payload),c=object(p.customer),snap=object(p.client_snapshot),entity=object(p.entity),address=object(c.address),snapAddress=object(snap.address);return {name:first(c.name,entity.name,row.counterparty_name),vat:first(c.vat,c.vat_number,entity.vat_number,row.counterparty_vat),fiscal_code:first(c.fiscal_code,c.tax_code,entity.tax_code,row.counterparty_fiscal_code),email:first(c.email,snap.email,entity.email),pec:first(c.pec,snap.pec),address:{street:first(address.street,snapAddress.street,entity.address_street,entity.address),street_number:first(address.street_number,snapAddress.street_number),postal_code:first(address.postal_code,snapAddress.postal_code,entity.address_postal_code),city:first(address.city,snapAddress.city,entity.address_city),province:first(address.province,snapAddress.province,entity.address_province),country:first(address.country,snapAddress.country,entity.country)}}}
const FIELDS='id,client_id,direction,invoice_number,issue_date,counterparty_name,counterparty_vat,counterparty_fiscal_code,header,total,currency,supplier_type,sdi_status,sdi_protocol,provider_status,provider_invoice_id,provider_payload,created_at,updated_at';
async function loadRow(id:string){if(!UUID.test(id))throw new Error('Fattura non selezionata');const {data,error}=await db.from('optyker_billing_invoices').select(FIELDS).eq('id',id).eq('direction','outgoing').maybeSingle();if(error)throw new Error('Impossibile leggere la fattura');if(!data)throw new Error('Fattura cliente non trovata');if(norm(data.supplier_type).toLowerCase()!=='cliente')throw new Error('Questa non è una fattura cliente');return data}
function editable(row:any){const p=object(row.provider_payload);return !norm(row.provider_invoice_id)&&!norm(row.sdi_protocol)&&['draft','not_applicable'].includes(norm(row.sdi_status))&&(p.source==='optyker_pos_local'||p.document_scope==='customer_no_sdi'||norm(row.provider_status)==='customer_invoice_internal')&&p.electronic_invoice!==true&&!p.issued_at&&!p.finalized_at&&!p.sent_at&&!p.ts_protocol;}
async function paymentLock(row:any,p:any){const paymentId=norm(p.pos_payment_id);if(!paymentId)return {linked:false,total:null};if(!UUID.test(paymentId))throw new Error('Collegamento al pagamento non valido: modifica bloccata');const {data,error}=await db.from('optyker_pos_payments').select('id,amount').eq('id',paymentId).maybeSingle();if(error||!data||!Number.isFinite(Number(data.amount)))throw new Error('Pagamento collegato non verificabile: modifica bloccata');return {linked:true,total:money(data.amount)}}
function canSplit(p:any){return rawLines(p).some((x:any)=>{const r=object(x);return r.is_client_cart_order===true&&!r.invoice_split&&!r.manual_invoice_line&&UUID.test(norm(r.source_sheet_id))})}
async function present(row:any){const p=object(row.provider_payload),total=money(row.total),header=norm(row.header)||'Fattura',lock=await paymentLock(row,p);return {can_split:editable(row)&&canSplit(p),id:row.id,version:VERSION,updated_at:row.updated_at,number:norm(row.invoice_number),issue_date:row.issue_date||row.created_at||null,header,total,currency:norm(row.currency)||'EUR',sdi_status:norm(row.sdi_status),sdi_protocol:norm(row.sdi_protocol),provider_status:norm(row.provider_status),is_draft:!norm(row.invoice_number),no_sdi:!norm(row.provider_invoice_id)&&['draft','not_applicable'].includes(norm(row.sdi_status)),editable:editable(row),edit_block_reason:editable(row)?'':'Documento elettronico, finalizzato o non gestito come fattura interna: modifica diretta non consentita.',linked_payment:lock.linked,locked_total:lock.total,notes:norm(p.invoice_notes??p.notes),customer:customerFrom(row,p),lines:safeLines(p,total,header),seller:{brand:'OTTICA VISUAL CARE',legal_name:'MOLOGNI COMPANY S.R.L.',vat:'04679780165'}}}
async function invoicePrint(payload:any){return present(await loadRow(norm(payload?.id)))}
// Proposes product-level rows (frame, right/left lens, right/left contact lenses) from the linked sheets; nothing is saved here.
async function invoiceSplitPreview(payload:any){const row=await loadRow(norm(payload?.id));if(!editable(row))throw new Error('Documento elettronico o finalizzato: modifica diretta bloccata');const p=object(row.provider_payload);const {data,error}=await db.rpc('optyker_invoice_split_lines',{p_lines:rawLines(p)});if(error||!Array.isArray(data))throw new Error('Impossibile dividere i prodotti di questa fattura');const lines=safeLines({lines:data},money(row.total),norm(row.header)).map((x:any)=>({...x,source_index:null}));return {lines,changed:JSON.stringify(data)!==JSON.stringify(rawLines(p))}}
function normalizeLines(v:any,p:any={}){
 const raw=arr(v);if(!raw.length||raw.length>40)throw new Error('Inserisci da 1 a 40 righe');const allowed=new Set(['','4','04','5','05','10','22','ART10']);const original=rawLines(p),seen=new Set();
 return raw.map((x:any,i:number)=>{
  const r=object(x),description=norm(r.description??r.title??r.name).slice(0,500);if(!description)throw new Error(`Descrizione obbligatoria alla riga ${i+1}`);
  const qty=Number(r.quantity??r.qty),unit=Number(r.unit_price??r.price);if(!Number.isFinite(qty)||qty<=0||qty>10000)throw new Error(`Quantità non valida alla riga ${i+1}`);if(!Number.isFinite(unit)||unit<0||unit>1000000||r.unit_price==='')throw new Error(`Prezzo non valido alla riga ${i+1}`);
  let vat=norm(r.vat_code).toUpperCase();if(vat==='4')vat='04';if(vat==='5')vat='05';if(!allowed.has(vat))throw new Error(`IVA non valida alla riga ${i+1}`);
  const q=Math.round(qty*1000)/1000,u=money(unit);if(q<=0)throw new Error(`Quantità troppo piccola alla riga ${i+1}`);
  let prev:any={};if(r.source_index!==undefined&&r.source_index!==null&&r.source_index!==''){
   const idx=Number(r.source_index);if(!Number.isInteger(idx)||idx<0||idx>=original.length||seen.has(idx))throw new Error('Riferimento riga non valido: riapri la fattura');seen.add(idx);prev=object(original[idx]);
  }
  const same=Object.keys(prev).length>0&&Number(prev.quantity??prev.qty??1)===q&&money(prev.price??prev.unit_price??prev.net_price??0)===u;
  const t=same?money(prev.total??q*u):money(q*u);
  return {...prev,description,title:description,quantity:q,unit_price:u,price:u,total:t,vat_code:vat,fiscal_vat_code:vat,...(same?{}:{discount_percent:0,discount_amount:0,discount_total:0}),manual_invoice_line:true};
 });
}
async function invoiceUpdate(payload:any,operator:string){
 const row=await loadRow(norm(payload?.id));if(!editable(row))throw new Error('Documento elettronico o finalizzato: modifica diretta bloccata');
 if(!payload.expected_updated_at||payload.expected_updated_at!==row.updated_at)throw new Error('La fattura è cambiata oppure la pagina è da aggiornare. Riapri la fattura prima di salvare.');
 const p=object(row.provider_payload),lines=normalizeLines(payload.lines,p),notes=norm(payload.notes).slice(0,2000),header=payload.header===undefined?row.header:norm(payload.header).slice(0,500),total=money(lines.reduce((s:number,x:any)=>s+x.total,0)),lock=await paymentLock(row,p);
 if(!header)throw new Error('Inserisci l’oggetto della fattura');if(total<=0)throw new Error('Il totale della fattura deve essere maggiore di 0');const totalChanged=lock.linked&&Math.round(total*100)!==Math.round(Number(lock.total)*100);if(totalChanged&&payload.confirm_total_change!==true)throw new Error(`La fattura è collegata a un pagamento di ${Number(lock.total).toFixed(2)} €. Il totale delle righe è diverso: conferma la modifica del totale per salvare.`);
 const now=new Date().toISOString(),next={...p,lines,invoice_notes:notes,manual_invoice_lines:true,invoice_lines_updated_at:now,invoice_lines_updated_by:operator,invoice_total_differs_from_payment:totalChanged?{payment_total:lock.total,invoice_total:total,confirmed_by:operator,confirmed_at:now}:null,invoice_edit_history:[...arr(p.invoice_edit_history),{at:now,by:operator,total_change_confirmed:totalChanged,previous_updated_at:row.updated_at,header:row.header,total:row.total,lines:rawLines(p),notes:p.invoice_notes??p.notes??''}]};
 // Compare-and-swap prevents a stale editor from overwriting another operator or a provider transition.
 const {data,error}=await db.from('optyker_billing_invoices').update({header,total,provider_payload:next,updated_at:now}).eq('id',row.id).eq('updated_at',row.updated_at).eq('sdi_status',row.sdi_status).is('provider_invoice_id',null).select(FIELDS).maybeSingle();
 if(error)throw new Error('Salvataggio non riuscito. Le modifiche restano nella schermata.');if(!data)throw new Error('La fattura è stata modificata da un altro operatore. Riaprila prima di salvare.');return present(data);
}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});if(req.method!=='POST')return out({ok:false,error:'METHOD_NOT_ALLOWED'},405);try{const text=await req.text();if(text.length>150000)throw new Error('Richiesta troppo grande');const body=JSON.parse(text),operator=await auth(body,req),action=norm(body.action);if(action==='invoice_print')return out({ok:true,data:await invoicePrint(body.payload||{})});if(action==='invoice_split_preview')return out({ok:true,data:await invoiceSplitPreview(body.payload||{})});if(action==='invoice_update')return out({ok:true,data:await invoiceUpdate(body.payload||{},operator)});return out({ok:false,error:'Azione non riconosciuta'},400)}catch(e){const m=e instanceof Error?e.message:String(e);return out({ok:false,error:m},/AUTH_REQUIRED|Credenziali|Troppi tentativi/.test(m)?401:400)}});
