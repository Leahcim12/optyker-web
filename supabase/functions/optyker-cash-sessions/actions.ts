// Invoked only AFTER the caller's existing staff/admin authentication.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function sessionAction(db:any,action:string,p:any,operator:string,admin:boolean){
 const get=async(q:any)=>{const {data,error}=await q;if(error)throw new Error(error.message||'Operazione cassa non disponibile');return data};
 const rpc=(n:string,a:any)=>get(db.rpc(n,a));
 if(!/^session_(status|history|open|close|result)$/.test(action))throw new Error('Azione sessione non valida');
 if(action==='session_result'){
  if(!UUID.test(String(p.request_id||'')))throw new Error('Riferimento operazione non valido');
  const op=await get(db.from('optyker_cash_session_operations').select('id,input').eq('id',p.request_id).maybeSingle());
  if(!op)throw new Error('Operazione non trovata: puoi aggiornare il riepilogo');
  if(op.input?.fiscal===true&&!admin)throw new Error('Verifica la chiusura fiscale in Amministrazione');
  return await rpc('optyker_cash_session_finish',{p_request_id:p.request_id});
 }
 const date=String(p.date||p.business_date||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Data non valida');
 const state=()=>rpc('optyker_cash_session_state',{p_business_date:date});
 if(action==='session_status')return await state();
 if(action==='session_history'){
  const rows=await get(db.from('optyker_cash_session_operations').select('id,kind,state,sequence_no,operator_username,created_at,completed_at,snapshot,error').eq('business_date',date).eq('register_code','main').order('created_at',{ascending:false}).limit(100));
  const result=rows.map((r:any)=>({id:r.id,kind:r.kind,state:r.state,sequence_no:r.sequence_no,operator_username:r.operator_username,at:r.completed_at||r.created_at,closure:r.snapshot?.closure||null,error:r.error}));
  const m=await state();if(m.closure&&!result.some((r:any)=>r.kind==='close'||r.kind==='legacy_close'))result.push({kind:'legacy_close',state:'completed',sequence_no:1,at:m.closure.closed_at,closure:m.closure,operator_username:m.closure.operator_username});
  return {history:result};
 }
 if(!UUID.test(String(p.request_id||''))||!p.expected_token)throw new Error('Aggiorna Optyker per confermare questa operazione una sola volta');
 const amount=(v:any)=>{if(v===null||v===undefined||v===''||typeof v==='boolean'||!Number.isFinite(Number(v))||Number(v)<0||Number(v)>100000000)throw new Error('Importo non valido');return Math.round(Number(v)*100)/100};
 const input:any={notes:String(p.notes||'').slice(0,2000)};
 if(action==='session_open'){input.opening_cash=amount(p.opening_cash);input.opening_checks=amount(p.opening_checks??0)}
 else{
  for(const k of ['cash_counted','checks_counted','bank_deposit_cash','bank_deposit_checks','safe_deposit_cash','safe_deposit_checks'])input[k]=amount(p[k]??0);
  if(p.fiscal===true&&!admin)throw new Error('La chiusura fiscale richiede la sessione amministrativa');
  input.fiscal=p.fiscal===true;
 }
 return await rpc('optyker_cash_session_change',{p_request_id:p.request_id,p_business_date:date,p_kind:action==='session_open'?'open':'close',p_operator:operator,p_expected_token:p.expected_token,p_input:input});
}
