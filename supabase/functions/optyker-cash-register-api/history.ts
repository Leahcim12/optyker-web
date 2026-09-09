const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validId(value: unknown) {
  const id=String(value||'');
  if(!uuid.test(id))throw new Error('Riferimento documento non valido');
  return id;
}
async function getSale(db:any,p:any){
  const id=validId(p.sale_id);
  let q=db.from('optyker_pos_sales').select('*').eq('id',id);
  if(p.client_id)q=q.eq('client_id',validId(p.client_id));
  const {data,error}=await q.maybeSingle();
  if(error)throw error;if(!data)throw new Error('Vendita non trovata per questo cliente');
  return data;
}
export async function listHistory(db:any,p:any){
  const offset=Math.max(0,Math.floor(Number(p.offset)||0));
  let q=db.from('optyker_pos_history').select('*')
    .order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+30);
  if(p.client_id)q=q.eq('client_id',validId(p.client_id));
  if(p.include_deleted!==true)q=q.is('hidden_at',null);
  const {data,error}=await q;if(error)throw error;
  return {data:(data||[]).slice(0,30),has_more:(data||[]).length>30,offset};
}
export async function receiptDetail(db:any,p:any){
  const sale=await getSale(db,p);
  const results=await Promise.all([
    db.from('optyker_pos_sale_items').select('title,variant_title,sku,quantity,unit_price,total').eq('sale_id',sale.id).order('created_at'),
    db.from('optyker_pos_payments').select('payment_stage,payment_method,amount,currency,created_at').eq('sale_id',sale.id).order('created_at'),
    db.from('optyker_pos_history_visibility').select('hidden_at').eq('sale_id',sale.id).maybeSingle()
  ]);
  for(const result of results)if(result.error)throw result.error;
  const c=sale.data?.client_snapshot||{};
  let items=results[0].data||[];
  if(!items.length)items=(sale.data?.lines||[]).map((l:any)=>({title:l.title,variant_title:l.variant_title,sku:l.sku,quantity:l.quantity,unit_price:l.price,total:l.total}));
  // Return the recorded sale snapshot; no new order, payment or fiscal document is issued.
  return {
    id:sale.id,client_id:sale.client_id,client_name:([c.surname,c.name].filter(Boolean).join(' ')||'Cliente occasionale'),
    shopify_order_name:sale.shopify_order_name,created_at:sale.created_at,status:sale.status,
    total:sale.total,paid_amount:sale.paid_amount,due_amount:sale.due_amount,currency:sale.currency,
    payment_method:sale.payment_method,payment_stage:sale.payment_stage,operator_username:sale.operator_username,
    hidden_at:results[2].data?.hidden_at||null,items,payments:results[1].data||[]
  };
}
export async function setHistoryVisibility(db:any,p:any,operator:string){
  if(p.confirm!==true)throw new Error('Conferma richiesta');
  if(typeof p.hidden!=='boolean')throw new Error('Operazione non valida');
  const sale=await getSale(db,p);
  const now=new Date().toISOString();
  const {error}=await db.from('optyker_pos_history_visibility').upsert({
    sale_id:sale.id,hidden_at:p.hidden?now:null,changed_at:now,changed_by:operator
  },{onConflict:'sale_id'});
  if(error)throw error;
  return {id:sale.id,hidden:p.hidden};
}
