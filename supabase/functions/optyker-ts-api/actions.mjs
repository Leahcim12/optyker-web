import {Buffer} from 'node:buffer';
import {callTS,buildRequest,validateDocument,classifyInsert,classifyOutcome,queryMatches,sha256,certificateStatus,TRANSPORT_VERSION} from './transport.mjs';

const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
export const safeCode=e=>/^TS_[A-Z0-9_]+$/.test(e?.message||'')?e.message:'TS_OPERATION_FAILED';
export function createActions(db,call=callTS) {
  async function get(q){const r=await q;if(r.error)throw new Error(/^TS_[A-Z0-9_]+$/.test(r.error.message||'')?r.error.message:'TS_STORAGE_ERROR');return r.data;}
  async function credentials(){const c=await get(db.rpc('optyker_ts_server_credentials'));if(!c?.username||!c.password||!c.pin)throw new Error('TS_MISSING_CREDENTIALS');return c;}
  async function item(id){if(!uuid.test(id||''))throw new Error('TS_INVALID_DOCUMENT');const r=await get(db.from('optyker_ts_outbox').select('*').eq('id',id).single());if(!r)throw new Error('TS_INVALID_DOCUMENT');return r;}
  async function checkIssuer(q,c){
    const a=await get(db.from('optyker_ts_attempts').select('issuer').eq('id',q.attempt_id).eq('outbox_id',q.id).single());
    if(!a?.issuer||['username','owner_code','owner_fiscal_code','business_vat'].some(k=>a.issuer[k]!==c[k]))throw new Error('TS_ISSUER_CHANGED');
  }
  async function verify(){
    const c=await credentials();let ok=false,code,codes=[];
    try{
      if(!certificateStatus().valid)throw new Error('TS_CERTIFICATE_EXPIRED');
      let month;
      try{const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit'}).formatToParts(new Date());month=parts.find(p=>p.type==='year').value+parts.find(p=>p.type==='month').value;}
      catch{throw new Error('TS_CLOCK_RUNTIME');}
      const r=await call('verify',c,{month});
      ok=r.esito==='0';codes=r.codes;code=ok?'TS_VERIFIED':'TS_VERIFY_RESPONSE_'+r.esito;
    }catch(e){code=safeCode(e);}
    const saved=await get(db.rpc('optyker_ts_record_verification',{p_revision:c.revision,p_ok:ok,p_code:code,p_codes:codes}));
    if(!saved)throw new Error('TS_REVISION_CONFLICT');
    return {verified:ok,code,codes};
  }
  async function finish(q,state,protocol,outcome){
    const saved=await get(db.rpc('optyker_ts_finish_send',{p_id:q.id,p_attempt:q.attempt_id,p_state:state,p_protocol:protocol||null,p_outcome:outcome}));
    if(!saved)throw new Error('TS_STATE_CHANGED');
  }
  async function send(id){
    const q=await item(id),c=await credentials();validateDocument(q.document);
    if(q.state!=='awaiting_configuration'||q.attempt_id||q.protocol)throw new Error('TS_ALREADY_ATTEMPTED');
    const wire=buildRequest('insert',c,{document:q.document});
    const claimed=await get(db.rpc('optyker_ts_claim_send',{p_id:id,p_revision:c.revision,p_document:q.document,p_hash:sha256(wire)}));
    let state='uncertain',protocol=null,result;
    try{
      const r=await call('insert',c,{document:claimed.document},{requestBody:wire});
      state=classifyInsert(r);protocol=r.protocol||null;
      result={code:'TS_RESPONSE_'+r.esito,codes:r.codes,transport_version:TRANSPORT_VERSION};
    }catch(e){result={code:safeCode(e),transport_version:TRANSPORT_VERSION};}
    // Once the claim commits, no error path may automatically resend this document.
    await finish(claimed,state,protocol,result);
    return {id,state,protocol};
  }
  async function reconcile(id){
    const q=await item(id);
    if(q.state==='accepted'||q.state==='rejected'||q.state==='voided')return {id,state:q.state,protocol:q.protocol};
    if(!q.attempt_id||!['sending','submitted','uncertain'].includes(q.state))throw new Error('TS_NOT_SENT');
    if(q.state==='sending'&&Date.now()-Date.parse(q.updated_at)<60000)throw new Error('TS_IN_PROGRESS');
    const c=await credentials();
    await checkIssuer(q,c);
    // A different credential revision needs a fresh verification before inspecting old sends.
    const status=await get(db.rpc('optyker_ts_connection_status'));
    if(!status.credentials_verified)throw new Error('TS_NOT_READY');
    let state='uncertain',protocol=q.protocol,r;
    try{
      if(protocol){r=await call('outcome',c,{protocol});state=classifyOutcome(r,protocol);}
      else {r=await call('query',c,{document:q.document});if(queryMatches(r,q.document,c)){state='accepted';protocol=r.document.protocol;}}
    }catch(e){return {id,state:q.state,protocol,check_error:safeCode(e)};}
    await finish(q,state,protocol,{code:'TS_RECONCILED',codes:r.codes||[],outcomes:r.outcomes||[],transport_version:TRANSPORT_VERSION});
    return {id,state,protocol};
  }
  async function receipt(id){
    const q=await item(id);
    if(q.receipt_data)return {data:q.receipt_data,kind:q.receipt_kind,protocol:q.protocol};
    if(!q.protocol||!['submitted','accepted','rejected'].includes(q.state))throw new Error('TS_RECEIPT_UNAVAILABLE');
    const c=await credentials();await checkIssuer(q,c);
    const r=await call('receipt',c,{protocol:q.protocol});
    const b64=(r.pdf||'').replace(/\s/g,'');
    if(r.esito!=='0'||!b64||b64.length>2000000||!/^[A-Za-z0-9+/]+={0,2}$/.test(b64))throw new Error('TS_RECEIPT_UNAVAILABLE');
    const bytes=Buffer.from(b64,'base64');let kind;
    if(bytes.subarray(0,5).toString()==='%PDF-')kind='pdf';
    else if(bytes[0]===80&&bytes[1]===75&&bytes[2]===3&&bytes[3]===4)kind='zip';
    else throw new Error('TS_INVALID_RESPONSE');
    await get(db.from('optyker_ts_outbox').update({receipt_data:b64,receipt_kind:kind}).eq('id',id).eq('protocol',q.protocol));
    return {data:b64,kind,protocol:q.protocol};
  }
  async function queue(){
    const rows=await get(db.from('optyker_ts_outbox').select('id,state,document,protocol,outcome,created_at,updated_at,attempt_id,receipt_kind').order('created_at',{ascending:false}).limit(100));
    return rows.map(q=>({id:q.id,state:q.state,number:q.document.number,date:q.document.date,total_cents:q.document.lines.reduce((n,l)=>n+l.totalCents,0),opposition:q.document.opposition,protocol:q.protocol,code:q.outcome?.code||null,codes:q.outcome?.codes||[],receipt_saved:!!q.receipt_kind,attempted:!!q.attempt_id}));
  }
  return {verify,send,reconcile,receipt,queue};
}
