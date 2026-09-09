// OAuth credentials are configured as Edge Function secrets, never in the client.
const BASE = 'https://api-v2.fattureincloud.it';
const SCOPES = 'issued_documents.invoices:r issued_documents.credit_notes:r received_documents:r stock:r';
const TABLE = 'optyker_fic_connection';
const STATES = 'optyker_fic_states';
const VAT = '04679780165';
const enc = new TextEncoder();

export function credentialsReady() {
  return !!(Deno.env.get('FIC_CLIENT_ID') && Deno.env.get('FIC_CLIENT_SECRET'));
}
export function redirectUri() {
  return Deno.env.get('SUPABASE_URL') + '/functions/v1/optyker-billing-admin';
}
function credentials() {
  if (!credentialsReady()) throw new Error('La configurazione iniziale di Fatture in Cloud deve essere completata prima di collegare l’account.');
  return {client_id:Deno.env.get('FIC_CLIENT_ID')!, client_secret:Deno.env.get('FIC_CLIENT_SECRET')!};
}
async function hash(s: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(s))), b=>b.toString(16).padStart(2,'0')).join('');
}
async function encryptionKey() {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) throw new Error('Configurazione server mancante');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode('optyker-fic-tokens-v1:' + secret));
  return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
}
async function seal(value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await encryptionKey(),enc.encode(JSON.stringify(value))));
  return JSON.stringify({iv:Array.from(iv),data:Array.from(data)});
}
async function unseal(value: string) {
  const v = JSON.parse(value);
  const data = await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(v.iv)},await encryptionKey(),new Uint8Array(v.data));
  return JSON.parse(new TextDecoder().decode(data));
}
async function exchange(body: Record<string,string>) {
  const response = await fetch(BASE+'/oauth/token',{method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify({...credentials(),...body}),signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('Autorizzazione Fatture in Cloud non riuscita. Ripeti il collegamento.');
  const t = await response.json();
  if (!t.access_token || !t.refresh_token || !(Number(t.expires_in)>0)) throw new Error('Risposta autorizzazione non valida');
  return {...t,expires_at:Date.now()+Number(t.expires_in)*1000};
}
async function api(token: string,path: string) {
  const response = await fetch(BASE+path,{redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('Fatture in Cloud: richiesta non riuscita (HTTP '+response.status+').');
  return response.json();
}
export async function connectionStatus(db: any) {
  const {data,error} = await db.from(TABLE).select('company_id,connected_at').eq('id',1).maybeSingle();
  if (error) throw error;
  return {configured:credentialsReady(),connected:!!data?.company_id,connected_at:data?.connected_at||null};
}
export async function startConnection(db: any) {
  const {client_id} = credentials();
  const state = crypto.randomUUID()+crypto.randomUUID();
  const {error} = await db.from(STATES).insert({state_hash:await hash(state),expires_at:new Date(Date.now()+600000).toISOString()});
  if(error) throw error;
  const q = new URLSearchParams({response_type:'code',client_id,redirect_uri:redirectUri(),scope:SCOPES,state});
  return BASE+'/oauth/authorize?'+q;
}
export async function finishConnection(db: any,req: Request) {
  const url = new URL(req.url), state = url.searchParams.get('state')||'';
  if (state.length!==72) throw new Error('Richiesta di collegamento non valida');
  // Delete-and-return makes the state single-use across concurrent callbacks.
  const {data,error} = await db.from(STATES).delete().eq('state_hash',await hash(state)).gt('expires_at',new Date().toISOString()).select('state_hash').maybeSingle();
  if(error || !data) throw new Error('Richiesta scaduta o già utilizzata. Ripeti il collegamento da Optyker.');
  const code = url.searchParams.get('code');
  if(url.searchParams.has('error') || !code) throw new Error('Autorizzazione non concessa');
  const tokens = await exchange({grant_type:'authorization_code',redirect_uri:redirectUri(),code});
  const companies = await api(tokens.access_token,'/user/companies');
  const matches = (companies.data?.companies||[]).filter((c:any)=>String(c.vat_number||'').replace(/^IT/i,'')===VAT);
  if(matches.length!==1) throw new Error('Autorizza esclusivamente MOLOGNI COMPANY S.R.L. con la partita IVA configurata.');
  const row = {id:1,company_id:String(matches[0].id),tokens:await seal(tokens),connected_at:new Date().toISOString()};
  const {data:existing,error:readError} = await db.from(TABLE).select('id').eq('id',1).maybeSingle();
  if(readError) throw readError;
  if(existing) {
    const saved = await db.from(TABLE).update(row).eq('id',1).lt('lease_until',new Date().toISOString()).select('id').maybeSingle();
    if(saved.error || !saved.data) throw new Error('Aggiornamento in corso. Ripeti il collegamento al termine.');
  } else {
    const saved = await db.from(TABLE).insert(row);
    if(saved.error) throw saved.error;
  }
}

// Sync and token refresh run under the same database lease: refresh tokens rotate.
export async function syncFic(db:any) {
  const lease = crypto.randomUUID(), now = new Date().toISOString();
  const {data:conn,error} = await db.from(TABLE).update({lease,lease_until:new Date(Date.now()+180000).toISOString()}).eq('id',1).lt('lease_until',now).select('*').maybeSingle();
  if(error) throw error;
  if(!conn) throw new Error('Collegamento assente oppure aggiornamento già in corso.');
  try {
    let tokens = await unseal(conn.tokens);
    if(tokens.expires_at<Date.now()+60000) {
      tokens = await exchange({grant_type:'refresh_token',refresh_token:tokens.refresh_token});
      const {error:e} = await db.from(TABLE).update({tokens:await seal(tokens)}).eq('id',1).eq('lease',lease);
      if(e) throw e;
    }
    const rows:any[] = [];
    const started = Date.now();
    for(const [direction,type] of [['outgoing','invoice'],['outgoing','credit_note'],['incoming','expense']]) {
      const route = direction==='outgoing'?'issued_documents':'received_documents';
      for(let page=1;page<=20;page++) {
        if(Date.now()-started>90000) throw new Error('Aggiornamento troppo lungo. Riprovare con un intervallo più breve.');
        const q = new URLSearchParams({per_page:'100',page:String(page),fieldset:'detailed'});
        q.set('type',type);
        const result = await api(tokens.access_token,'/c/'+encodeURIComponent(conn.company_id)+'/'+route+'?'+q);
        if(!Array.isArray(result.data)) throw new Error('Elenco fatture non valido');
        for(const d of result.data) {
          if(!d.id) throw new Error('Identificativo fattura mancante');
          rows.push({provider_invoice_id:'fic:'+conn.company_id+':'+d.id,direction,invoice_number:direction==='incoming'?String(d.invoice_number||''):String(d.number??'')+String(d.numeration||''),issue_date:d.date||null,counterparty_name:d.entity?.name||'',counterparty_vat:d.entity?.vat_number||'',counterparty_fiscal_code:d.entity?.tax_code||'',header:d.subject||d.description||'',total:d.amount_gross??null,currency:d.currency?.id||'EUR',sdi_status:d.ei_status||'unknown',provider_status:d.ei_status||'',provider_payload:d,updated_at:new Date().toISOString()});
        }
        if(!result.last_page || page>=result.last_page) break;
        if(page===20) throw new Error('Troppi documenti per un singolo aggiornamento.');
      }
    }
    // Existing partial unique index cannot be used by PostgREST onConflict.
    for(const row of rows) {
      if(Date.now()-started>120000) throw new Error('Aggiornamento parziale: riprova per completarlo senza duplicati.');
      const {data:old,error:e} = await db.from('optyker_billing_invoices').select('id').eq('direction',row.direction).eq('provider_invoice_id',row.provider_invoice_id).maybeSingle();
      if(e) throw e;
      const result = old ? await db.from('optyker_billing_invoices').update(row).eq('id',old.id) : await db.from('optyker_billing_invoices').insert(row);
      if(result.error) throw result.error;
    }
    const {error:e} = await db.from('optyker_billing_provider_config').upsert({id:1,provider_name:'Fatture in Cloud',sdi_code:'M5UXCR1',enabled:true,last_sync_at:new Date().toISOString(),last_sync_error:null});
    if(e) throw e;
    return {count:rows.length};
  } finally {
    await db.from(TABLE).update({lease:null,lease_until:'1970-01-01T00:00:00Z'}).eq('id',1).eq('lease',lease);
  }
}
