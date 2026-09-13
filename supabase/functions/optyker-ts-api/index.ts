import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { verifyAdmin, readLimited, validateTechnicalFile, MAX_FILE_SIZE, ORIGINS } from './security.mjs';
import { createActions, safeCode } from './actions.mjs';
import { certificateStatus, sha256, TRANSPORT_VERSION } from './transport.mjs';
declare const EdgeRuntime: {waitUntil(promise: Promise<unknown>): void};

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const db = createClient(Deno.env.get('SUPABASE_URL') || '', serviceKey, {auth:{persistSession:false,autoRefreshToken:false}});
const BUCKET = 'optyker-ts-kit';
const actions=createActions(db);
const fileFields = 'id,filename,size_bytes,sha256,review_state,uploaded_at';
const errors: Record<string, [number,string]> = {
  TS_TOO_LARGE:[413,'File troppo grande. Il limite è 10 MB.'],
  TS_INVALID_FILE:[400,'Carica il kit ZIP, le specifiche PDF, WSDL/XSD o il certificato CER.'],
  TS_REVISION_CONFLICT:[409,'Configurazione aggiornata da un’altra sessione. Chiudi e riapri Sistema TS.'],
  TS_INVALID_CONFIGURATION:[400,'Controlla i dati identificativi e le credenziali inserite.'],
  TS_ACCOUNT_REQUIRES_CREDENTIALS:[400,'Per cambiare codice identificativo inserisci anche password e PIN del nuovo account.'],
  TS_NOT_READY:[409,'Verifica prima il collegamento TS e attiva gli invii.'],
  TS_MISSING_CREDENTIALS:[409,'Salva codice identificativo, password e PIN prima della verifica.'],
  TS_ALREADY_ATTEMPTED:[409,'Invio già tentato: usa Verifica esito, senza ripetere la trasmissione.'],
  TS_INVALID_DOCUMENT:[400,'Controlla riferimento, date, codice fiscale e righe sanitarie del documento.'],
  TS_RECEIPT_UNAVAILABLE:[409,'La ricevuta TS non è ancora disponibile. Verifica prima l’esito.'],
  TS_CERTIFICATE_EXPIRED:[409,'Certificato TS scaduto: occorre aggiornare il kit prima di trasmettere.'],
  TS_IN_PROGRESS:[409,'Invio ancora in corso. Attendi un minuto, poi verifica l’esito.'],
  TS_NOT_SENT:[409,'Questo documento non ha un tentativo di invio da verificare.'],
  TS_ISSUER_CHANGED:[409,'Ripristina e verifica l’account TS che ha trasmesso questo documento.'],
};
function followUp(id:string){
  EdgeRuntime.waitUntil((async()=>{
    for(let i=0;i<3;i++){
      await new Promise(resolve=>setTimeout(resolve,3000));
      try{const r=await actions.reconcile(id);if(['accepted','rejected'].includes(r.state)){await actions.receipt(id).catch(()=>{});return;}}
      catch{return;}
    }
  })());
}
async function snapshot() {
  const [config, files] = await Promise.all([
    db.rpc('optyker_ts_connection_status'),
    db.from('optyker_ts_technical_files').select(fileFields).order('uploaded_at',{ascending:false}).limit(50),
  ]);
  if (config.error || files.error) throw new Error('TS_STORAGE_ERROR');
  return {ok:true,config:config.data,files:files.data,queue:await actions.queue(),certificate:certificateStatus(),release:TRANSPORT_VERSION,
    transport_ready:config.data.transport_ready&&certificateStatus().valid,credentials_verified:config.data.credentials_verified,
    reason:config.data.transport_ready?'Invii TS attivi per i nuovi documenti RCH confermati.':'Esegui Verifica collegamento per controllare autenticazione e disponibilità TS.'};
}
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('origin') || '';
  const headers: Record<string,string> = {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'Vary':'Origin','Access-Control-Allow-Headers':'authorization,content-type,x-ts-filename','Access-Control-Allow-Methods':'POST,OPTIONS',
    'X-Content-Type-Options':'nosniff'};
  if (ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const out = (body: unknown, status=200) => new Response(JSON.stringify(body),{status,headers});
  if (origin && !ORIGINS.has(origin)) return out({ok:false,error:'Origine non autorizzata.'},403);
  if (request.method === 'OPTIONS') return new Response(null,{status:204,headers});
  if (request.method !== 'POST') return out({ok:false,error:'Metodo non consentito.'},405);
  const authorization=request.headers.get('authorization')||'';
  // A privileged administrator can schedule one short-lived read-only check.
  // The token never authorizes send, download, status or credential access.
  if(new URL(request.url).searchParams.get('action')==='verify-once'){
    const capability=authorization.startsWith('Bearer ')?authorization.slice(7):'';
    if(!/^[a-f0-9]{64}$/.test(capability))return out({ok:false,error:'Verifica non autorizzata.'},401);
    const claim=await db.rpc('optyker_ts_claim_verification',{p_hash:sha256(capability)});
    if(claim.error||claim.data!==true)return out({ok:false,error:'Verifica non autorizzata o scaduta.'},401);
    try{return out({ok:true,check:await actions.verify()});}catch(e){return out({ok:false,code:safeCode(e)},503);}
  }
  const internal=!!serviceKey&&authorization==='Bearer '+serviceKey;
  const admin = internal?null:await verifyAdmin(authorization,serviceKey);
  if (!admin&&!internal) return out({ok:false,error:'Accedi nuovamente come Amministrazione.'},401);
  try {
    if (new URL(request.url).searchParams.get('action') === 'upload') {
      if(!admin)return out({ok:false,error:'Azione non autorizzata.'},403);
      const bytes = await readLimited(request, MAX_FILE_SIZE);
      let filename = '';
      try { filename = decodeURIComponent(request.headers.get('x-ts-filename') || ''); } catch { throw new Error('TS_INVALID_FILE'); }
      const extension = validateTechnicalFile(filename,bytes);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
      const prior = await db.from('optyker_ts_technical_files').select('id').eq('sha256',hash).maybeSingle();
      if (prior.error) throw new Error('TS_STORAGE_ERROR');
      if (prior.data) return out({...await snapshot(),duplicate:true});
      const path = crypto.randomUUID()+'.'+extension;
      const upload = await db.storage.from(BUCKET).upload(path,bytes,{contentType:'application/octet-stream',upsert:false});
      if (upload.error) throw new Error('TS_STORAGE_ERROR');
      const saved = await db.from('optyker_ts_technical_files').insert({filename,object_path:path,sha256:hash,size_bytes:bytes.length});
      if (saved.error) {
        await db.storage.from(BUCKET).remove([path]);
        if (saved.error.code === '23505') return out({...await snapshot(),duplicate:true});
        throw new Error('TS_STORAGE_ERROR');
      }
      return out(await snapshot());
    }
    let body;
    try { body = JSON.parse(new TextDecoder().decode(await readLimited(request,4096))); }
    catch (e) { if (e instanceof Error && e.message === 'TS_TOO_LARGE') throw e; return out({ok:false,error:'Richiesta non valida.'},400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return out({ok:false,error:'Richiesta non valida.'},400);
    if(internal){
      if(body.action!=='send_job'||!/^[-a-f0-9]{36}$/.test(body.job_id||''))return out({ok:false,error:'Azione non autorizzata.'},403);
      const status=await db.rpc('optyker_ts_connection_status');
      if(status.error)throw new Error('TS_STORAGE_ERROR');
      if(!status.data.transport_ready)return out({ok:true,skipped:'TS_NOT_READY'});
      const q=await db.from('optyker_ts_outbox').select('id,state').eq('job_id',body.job_id).maybeSingle();
      if(q.error)throw new Error('TS_STORAGE_ERROR');
      if(!q.data||q.data.state!=='awaiting_configuration')return out({ok:true,skipped:'TS_NOT_PENDING'});
      const result=await actions.send(q.data.id);if(result.state==='submitted')followUp(q.data.id);
      return out({ok:true,result});
    }
    if (body.action === 'status') return out(await snapshot());
    if(body.action==='verify'){const check=await actions.verify();return out({...await snapshot(),check});}
    if(body.action==='send'){
      if(body.confirmed!==true)return out({ok:false,error:'Conferma l’invio del documento selezionato.'},400);
      const result=await actions.send(body.id);if(result.state==='submitted')followUp(body.id);
      return out({...await snapshot(),result});
    }
    if(body.action==='reconcile'){const result=await actions.reconcile(body.id);if(result.state==='accepted')await actions.receipt(body.id).catch(()=>{});return out({...await snapshot(),result});}
    if(body.action==='receipt')return out({ok:true,receipt:await actions.receipt(body.id)});
    if(body.action==='pause'){
      const r=await db.from('optyker_ts_connection').update({enabled:false}).eq('id',true);if(r.error)throw new Error('TS_STORAGE_ERROR');
      return out(await snapshot());
    }
    if (body.action === 'save') {
      if (!Number.isSafeInteger(body.revision) || body.revision < 0 || ['username','owner_code','owner_fiscal_code','business_vat'].some(k=>typeof body[k] !== 'string') ||
        ['password','pin'].some(k=>body[k] != null && typeof body[k] !== 'string')) throw new Error('TS_INVALID_CONFIGURATION');
      const result = await db.rpc('optyker_ts_connection_save',{
        p_revision:body.revision,p_username:body.username,p_owner_code:body.owner_code,
        p_owner_fiscal_code:body.owner_fiscal_code,p_business_vat:body.business_vat,
        p_password:body.password || null,p_pin:body.pin || null,
      });
      // Never log the request, credentials or raw upstream errors.
      if (result.error) throw new Error(Object.keys(errors).find(k=>result.error?.message === k) || 'TS_STORAGE_ERROR');
      return out(await snapshot());
    }
    return out({ok:false,error:'Azione non disponibile.'},400);
  } catch (error) {
    const [status,message] = errors[error instanceof Error ? error.message : ''] || [503,'Operazione non completata. Controlla l’esito prima di ripetere un invio.'];
    return out({ok:false,error:message},status);
  }
});
