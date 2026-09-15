import {Buffer} from 'node:buffer';
import {callTS,buildRequest,validateDocument,queryMatches,classifyInsert,classifyOutcome,sha256,certificateStatus} from '../optyker-ts-api/transport.mjs';
const safeCode=e=>/^TS_[A-Z0-9_]+$/.test(e?.message||'')?e.message:'TS_OPERATION_FAILED';
export function validateCancellationScope(scope,c,response) {
 const {cancellation:k,outbox:q,issuer}=scope;
 if(!k||!q||!issuer||k.outbox_id!==q.id||q.state!=='accepted'||k.original_protocol!==q.protocol||
    q.document.number!==k.expected_number||q.document.date!==k.expected_date||
    ['username','owner_code','owner_fiscal_code','business_vat'].some(key=>issuer[key]!==c[key]))throw new Error('TS_CANCELLATION_MISMATCH');
 validateDocument(q.document);
 if(!queryMatches(response,q.document,c)||response.document.protocol!==k.original_protocol)throw new Error('TS_CANCELLATION_MISMATCH');
}
export function createCancellationRunner(db,call=callTS,delay=ms=>new Promise(r=>setTimeout(r,ms))) {
 async function get(query) {const r=await query;if(r.error)throw new Error(safeCode(r.error));return r.data;}
 async function finish(id,state,protocol,outcome) {
  const saved=await get(db.rpc('optyker_ts_finish_cancellation',{p_id:id,p_state:state,p_protocol:protocol||null,p_outcome:outcome}));
  if(saved!==true)throw new Error('TS_STATE_CHANGED');
 }
 async function receipt(id,protocol,c) {
  const r=await call('receipt',c,{protocol});
  const data=(r.pdf||'').replace(/\s/g,'');
  if(r.esito!=='0'||!data||data.length>2000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(data))throw new Error('TS_RECEIPT_UNAVAILABLE');
  const bytes=Buffer.from(data,'base64');
  const kind=bytes.subarray(0,5).toString()==='%PDF-'?'pdf':bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4?'zip':null;
  if(!kind)throw new Error('TS_INVALID_RESPONSE');
  await get(db.from('optyker_ts_cancellations').update({receipt_data:data,receipt_kind:kind}).eq('id',id).eq('state','accepted').eq('protocol',protocol));
 }
 return async function run(hash,action) {
  if(!/^[a-f0-9]{64}$/.test(hash||'')||!['cancel','reconcile'].includes(action))throw new Error('TS_UNAUTHORIZED');
  const scope=await get(db.rpc('optyker_ts_claim_cancellation',{p_hash:hash,p_action:action}));
  const k=scope.cancellation,q=scope.outbox;
  let c;
  try {
   c=await get(db.rpc('optyker_ts_server_credentials'));
   const status=await get(db.rpc('optyker_ts_connection_status'));
   if(!c?.username||!c.password||!c.pin||!status.credentials_verified||!certificateStatus().valid)throw new Error('TS_NOT_READY');
   if(['username','owner_code','owner_fiscal_code','business_vat'].some(key=>scope.issuer[key]!==c[key]))throw new Error('TS_ISSUER_CHANGED');
   if(action==='cancel')validateCancellationScope(scope,c,await call('query',c,{document:q.document}));
  } catch(e) {
   if(action==='cancel')await finish(k.id,'not_sent',null,{code:safeCode(e)});
   return {id:k.id,state:action==='cancel'?'not_sent':k.state,code:safeCode(e)};
  }
  let state=k.state,protocol=k.protocol;
  if(action==='cancel') {
   let wire;
   try {wire=buildRequest('cancel',c,{document:q.document});}
   catch(e){await finish(k.id,'not_sent',null,{code:safeCode(e)});return {id:k.id,state:'not_sent',code:safeCode(e)};}
   const saved=await get(db.from('optyker_ts_cancellations').update({state:'sending',request_sha256:sha256(wire),updated_at:new Date().toISOString()}).eq('id',k.id).eq('state','checking').select('id').maybeSingle());
   if(!saved)throw new Error('TS_ALREADY_ATTEMPTED');
   let result;
   try {
    const r=await call('cancel',c,{document:q.document},{requestBody:wire});
    state=classifyInsert(r);protocol=r.protocol||null;
    result={code:'TS_CANCEL_RESPONSE_'+r.esito,esito:r.esito,codes:r.codes};
   } catch(e) {state='uncertain';protocol=null;result={code:safeCode(e)};}
   await finish(k.id,state,protocol,result);
  }
  // A missing response never causes another cancellation POST.
  if(!protocol||!['submitted','uncertain'].includes(state))return {id:k.id,state,protocol};
  for(let i=0;i<3;i++) {
   if(i>0||action==='cancel')await delay(2500);
   let r;
   try {r=await call('outcome',c,{protocol});}
   catch(e){return {id:k.id,state,protocol,check_error:safeCode(e)};}
   state=classifyOutcome(r,protocol);
   if(state==='accepted'&&r.outcomes.length!==1)state='uncertain';
   await finish(k.id,state,protocol,{code:state==='accepted'?'TS_CANCELLATION_CONFIRMED':'TS_CANCELLATION_CHECK',esito:r.esito,codes:r.codes||[],outcomes:r.outcomes||[]});
   if(state==='accepted') {
    let receipt_saved=false;try{await receipt(k.id,protocol,c);receipt_saved=true;}catch{}
    return {id:k.id,state,protocol,receipt_saved};
   }
   if(state==='rejected')return {id:k.id,state,protocol};
  }
  return {id:k.id,state,protocol};
 };
}

