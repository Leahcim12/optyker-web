// Read-only extension of the existing staff-authenticated cashier API.
import {balances,VERSION} from './domain.mjs';
async function read(q){const {data,error}=await q;if(error)throw new Error('Verifica acconti non disponibile');return data;}
export async function readRecordedBalancesFrom(db,value){
 const id=String(value||'');if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new Error('Cliente non valido');
 // Legacy deposits are candidates only; domain matching requires exact order IDs.
 const [active,cart,sales]=await Promise.all([
  read(db.from('optyker_fiscal_jobs').select('id,sale_id,payment_id,state,operation,document,created_at').eq('serial','72IV6003831').in('state',['sending','uncertain']).limit(2)),
  id?read(db.from('optyker_client_carts').select('client_id,items,updated_at').eq('client_id',id).maybeSingle()):Promise.resolve(null),
  id?read(db.from('optyker_pos_sales').select('id,client_id,status,total,paid_amount,due_amount,delivered_at,created_at,data').eq('client_id',id).is('delivered_at',null).or('data->>client_cart_selection.eq.true,data->>source.eq.optyker_pos_local,data->>source.eq.optyker_pos_v2').order('created_at',{ascending:false}).limit(301)):Promise.resolve([])
 ]);
 const blockers=active.map((j)=>({id:j.id,sale_id:j.sale_id,payment_id:j.payment_id,state:j.state,operation:j.operation||'sale',amount_cents:Number.isSafeInteger(j.document?.totalCents)?j.document.totalCents:null,created_at:j.created_at}));
 if(!id)return {version:VERSION,client_id:'',groups:[],conflicts:[],blockers,checked_at:new Date().toISOString()};
 if(sales.length>300)throw new Error('Troppe vendite da verificare: apri Acconti aperti');
 const ids=sales.map((s)=>s.id);
 const [payments,jobs]=ids.length?await Promise.all([
  read(db.from('optyker_pos_payments').select('id,sale_id,client_id,amount,payment_stage,invoice_requested,billing_invoice_id,created_at').in('sale_id',ids)),
  read(db.from('optyker_fiscal_jobs').select('id,sale_id,payment_id,state,operation,document_number').in('sale_id',ids))
 ]):[[],[]];
 return {version:VERSION,client_id:id,cart_version:cart?.updated_at||null,...balances(id,cart?.items||[],sales,payments,jobs),blockers,checked_at:new Date().toISOString()};
}
