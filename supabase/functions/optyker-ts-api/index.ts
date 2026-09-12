import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { verifyAdmin, readLimited, validateTechnicalFile, MAX_FILE_SIZE, ORIGINS } from './security.mjs';

const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const db = createClient(Deno.env.get('SUPABASE_URL') || '', serviceKey, {auth:{persistSession:false,autoRefreshToken:false}});
const BUCKET = 'optyker-ts-kit';
const fileFields = 'id,filename,size_bytes,sha256,review_state,uploaded_at';
const errors: Record<string, [number,string]> = {
  TS_TOO_LARGE:[413,'File troppo grande. Il limite è 10 MB.'],
  TS_INVALID_FILE:[400,'Carica il kit ZIP, le specifiche PDF, WSDL/XSD o il certificato CER.'],
  TS_REVISION_CONFLICT:[409,'Configurazione aggiornata da un’altra sessione. Chiudi e riapri Sistema TS.'],
  TS_INVALID_CONFIGURATION:[400,'Controlla i dati identificativi e le credenziali inserite.'],
  TS_ACCOUNT_REQUIRES_CREDENTIALS:[400,'Per cambiare codice identificativo inserisci anche password e PIN del nuovo account.'],
};
async function snapshot() {
  const [config, files] = await Promise.all([
    db.rpc('optyker_ts_connection_status'),
    db.from('optyker_ts_technical_files').select(fileFields).order('uploaded_at',{ascending:false}).limit(50),
  ]);
  if (config.error || files.error) throw new Error('TS_STORAGE_ERROR');
  return {ok:true,config:config.data,files:files.data,transport_ready:false,credentials_verified:false,
    reason:'Invio TS da attivare: kit tecnico, autenticazione e ricevute devono essere verificati.'};
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
  const admin = await verifyAdmin(request.headers.get('authorization'),serviceKey);
  if (!admin) return out({ok:false,error:'Accedi nuovamente come Amministrazione.'},401);
  try {
    if (new URL(request.url).searchParams.get('action') === 'upload') {
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
    if (body.action === 'status') return out(await snapshot());
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
    return out({ok:false,error:'Azione non disponibile. Invio TS ancora da attivare.'},400);
  } catch (error) {
    const [status,message] = errors[error instanceof Error ? error.message : ''] || [503,'Operazione non completata. Riprova; nessun invio TS è stato effettuato.'];
    return out({ok:false,error:message},status);
  }
});
