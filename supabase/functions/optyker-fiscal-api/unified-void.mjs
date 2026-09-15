import {createActions} from '../optyker-ts-api/actions.mjs';
import {createCancellationRunner} from '../optyker-ts-cancel/worker.mjs';
import {sha256} from '../optyker-ts-api/transport.mjs';

// This coordinator never sends a TS insertion, refunds money, or prints a receipt.
// Printing remains bound to the fiscal job's single-use claim and PC journal.
import {unifiedPhase} from './unified-phase.mjs';
export function createUnifiedVoid(db,{getJob,jobView,prepareVoid,background},overrides={}){
 const ts=overrides.ts||createActions(db),cancel=overrides.cancel||createCancellationRunner(db);
 async function get(query){const r=await query;if(r.error)throw new Error('Registro annullamenti non disponibile');return r.data;}
 async function view(id){
  const intent=await get(db.from('optyker_unified_voids').select('original_job_id,reason,confirmed_at,message,completed_at').eq('original_job_id',id).maybeSingle());
  const original=await jobView(id),q=await get(db.from('optyker_ts_outbox').select('id,state,protocol').eq('job_id',id).maybeSingle());
  const k=q?await get(db.from('optyker_ts_cancellations').select('id,state,protocol').eq('outbox_id',q.id).maybeSingle()):null;
  // A completed fiscal void must also have the original TS queue finalized.
  const phase=unifiedPhase(q,k,original.void_job);
  if(phase.phase==='completed'&&q&&q.state!=='voided')return {intent,original,ts:q,cancellation:k,phase:'attention',message:'Annullo RCH registrato; esito TS da verificare.'};
  return {intent,original,ts:q,cancellation:k,...phase};
 }
 async function run(id){
  if(!await get(db.rpc('optyker_unified_void_lease',{p_job_id:id})))return;
  let message='';
  try{
   const s=await view(id);
   if(s.phase==='completed')await get(db.from('optyker_unified_voids').update({completed_at:new Date().toISOString()}).eq('original_job_id',id));
   else if(s.ts&&['sending','submitted','uncertain'].includes(s.ts.state))await ts.reconcile(s.ts.id);
   else if(s.ts?.state==='accepted'){
    const cap=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
    const hash=sha256(cap),action=await get(db.rpc('optyker_unified_void_ts_token',{p_job_id:id,p_hash:hash}));
    if(action)await cancel(hash,action);
   }
  }catch{message='Collegamento o esito TS da verificare. La pratica resta salvata.';}
  finally{await get(db.from('optyker_unified_voids').update({lease_until:null,next_check_at:new Date(Date.now()+15000).toISOString(),message}).eq('original_job_id',id));}
 }
 async function start(p,operator){
  await getJob(p.original_job_id);
  await get(db.rpc('optyker_unified_void_begin',{p_job_id:p.original_job_id,p_operator:operator,p_reason:String(p.reason||'Annullo completo richiesto dall’operatore').trim(),p_confirm:p.confirmed===true}));
  background(run(p.original_job_id));return view(p.original_job_id);
 }
 async function step(p){
  const s=await view(p.original_job_id);if(!s.intent)throw new Error('Conferma prima l’annullamento');
  background(run(p.original_job_id));return s;
 }
 async function prepare(p,operator){
  const s=await view(p.original_job_id);if(!s.intent||s.phase!=='rch_ready')throw new Error('TS o RCH non pronti per l’annullamento');
  // All original references are read server-side, never supplied by the browser.
  return prepareVoid({original_job_id:p.original_job_id,expected_number:s.original.document_number,expected_date:s.original.document_date,expected_total:s.original.total,reason:s.intent.reason,confirmed:true},operator);
 }
 async function pending(){return get(db.from('optyker_unified_voids').select('original_job_id').is('completed_at',null).order('confirmed_at').limit(30));}
 return {start,step,prepare,pending,view};
}
