import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const U=Deno.env.get("SUPABASE_URL")||"";
const KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const OLD=U+"/functions/v1/optyker-fiscal-api";
const SERIAL="72IV6003831";
const RELEASE="20260914-pos5";
const db=createClient(U,KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const origins=new Set(["https://www.optyker.it","https://optyker.it"]);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const now=()=>new Date().toISOString();
const token=()=>crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
async function hash(v:string){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,"0")).join("")}
function id(v:any){if(!uuid.test(String(v||"")))throw new Error("Riferimento non valido");return String(v)}
function description(value:any){const s=String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9 .,+'-]/g," ").replace(/TOTALE/g,"IMPORTO").replace(/\s+/g," ").trim().slice(0,20);if(!s)throw new Error("Descrizione richiesta");return s}
async function one(q:any){const {data,error}=await q;if(error)throw new Error(error.code==="23505"?"Operazione già registrata o registratore impegnato. Aggiorna lo stato prima di continuare.":error.message||"Impossibile aggiornare il registro fiscale");return data}
async function login(b:any){if(!b.username||String(b.password||"").length<8)throw new Error("AUTH_REQUIRED");const {data,error}=await db.rpc("optyker_staff_login_internal",{p_username:String(b.username).trim(),p_password:String(b.password)});if(error||!data?.ok)throw new Error("AUTH_REQUIRED");return String(data.username)}
async function proxy(reqBody:any){const r=await fetch(OLD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(reqBody),signal:AbortSignal.timeout(45000)});const x=await r.json().catch(()=>({ok:false,error:"Risposta fiscale non valida"}));if(!r.ok||x?.ok===false)throw new Error(x?.error||`Registro fiscale HTTP ${r.status}`);return x}
function publicJob(j:any){if(!j)return null;const {claim_hash,claim_expires_at,result_hash,document,...rest}=j;return {...rest,operation:j.operation||"sale",original_document:document?.original||null,void_reason:document?.operation==="void"?document.reason:null,total:Number(document?.totalCents||0)/100,talking_receipt:!!document?.talkingReceipt,ts_requested:!!document?.tsRequested,zero_receipt:!!document?.zeroReceipt,release:document?.version||RELEASE}}
function zeroDocument(payment:any,snapshot:any){
  if(Number(payment.amount)!==0)throw new Error("Questa emissione non è a importo zero");
  if(payment.invoice_requested||payment.billing_invoice_id)throw new Error("Questo pagamento segue il flusso fattura");
  if(snapshot?.input?.zero_receipt!==true||!Array.isArray(snapshot.input.lines)||!snapshot.input.lines.length)throw new Error("Dati scontrino a zero non disponibili");
  if(snapshot.input.ts_requested===true||snapshot.input.talking_receipt===true||snapshot.input.lottery_code)throw new Error("Lo scontrino a zero non può usare detrazione o codice lotteria");
  const paymentCode=payment.payment_method==="cash"?1:payment.payment_method==="card"?4:0;if(!paymentCode)throw new Error("Per lo scontrino a zero seleziona Contanti o Carta");
  let gross=0;const lines=snapshot.input.lines.map((l:any)=>{const department=Number(l.department),quantity=Number(l.quantity),unit=Math.round(Number(l.unit_price)*100);if(![1,2,3].includes(department)||!Number.isInteger(quantity)||quantity<1||quantity>99||!Number.isInteger(unit)||unit<=0)throw new Error("Riga scontrino a zero non valida");const total=unit*quantity;gross+=total;return {description:description(l.description),quantity,unitPriceCents:unit,totalCents:total,department,vatCode:department===1?"04":department===2?"22":"ART10",saleType:department===3?"services":"goods",expenseCode:"none"}});
  if(gross<=0||gross>100000000)throw new Error("Valore di partenza non valido per lo scontrino a zero");
  const commands=lines.map((l:any)=>`=R${l.department}/$${l.unitPriceCents}/*${l.quantity}/(${l.description})`);commands.push("=S","=%/*100",`=T${paymentCode}`);
  return {version:RELEASE,operation:"sale",serial:SERIAL,paymentCode,paymentMethod:payment.payment_method,totalCents:0,grossTotalCents:gross,lines,talkingReceipt:false,fiscalCode:"",tsRequested:false,opposition:false,zeroReceipt:true,automaticReference:false,commands};
}
async function prepareZero(p:any,operator:string){
  const payment=await one(db.from("optyker_pos_payments").select("*").eq("id",id(p.payment_id)).maybeSingle());if(!payment)throw new Error("Pagamento non trovato");
  if(payment.data?.manual_lottery_required===true)throw new Error("Questa vendita usa il Codice Lotteria: il documento va emesso dalla RCH con il codice lotteria acquisito, non dal flusso automatico Optyker.");
  if(Number(payment.amount)!==0||payment.data?.fiscal_snapshot?.input?.zero_receipt!==true)return null;
  const sale=await one(db.from("optyker_pos_sales").select("id,status").eq("id",payment.sale_id).single());if(!["completed","open_balance"].includes(sale.status))throw new Error("Completa prima la registrazione della vendita");
  const existing=await one(db.from("optyker_fiscal_jobs").select("*").eq("payment_id",payment.id).eq("operation","sale").maybeSingle());if(existing&&!['prepared','not_started'].includes(existing.state))return {job:publicJob(existing)};
  const document=zeroDocument(payment,payment.data.fiscal_snapshot),cap=token(),patch={state:"prepared",document,claim_hash:await hash(cap),claim_expires_at:new Date(Date.now()+600000).toISOString(),updated_at:now(),operator_username:operator};
  const job=existing?await one(db.from("optyker_fiscal_jobs").update(patch).eq("id",existing.id).in("state",["prepared","not_started"]).select("*").maybeSingle()):await one(db.from("optyker_fiscal_jobs").insert({...patch,id:crypto.randomUUID(),payment_id:payment.id,sale_id:sale.id,serial:SERIAL,operation:"sale"}).select("*").single());if(!job)throw new Error("Stato modificato: aggiorna prima di continuare");return {job:publicJob(job),claim_token:cap};
}
async function saleViewV2(body:any){
  await login(body);const x=await proxy(body),saleId=id(body.payload?.sale_id);
  const {data:rows,error}=await db.from("optyker_pos_payments").select("id,data").eq("sale_id",saleId);if(error)throw error;const flags=new Map((rows||[]).map((r:any)=>[String(r.id),r.data||{}]));
  if(x?.data?.payments){x.data.payments=x.data.payments.map((p:any)=>{const d:any=flags.get(String(p.id))||{};return {...p,manual_lottery_required:!!d.manual_lottery_required,lottery_code:String(d.lottery_code||""),zero_receipt:!!d.zero_receipt}})}
  return x;
}
Deno.serve(async req=>{
  const origin=req.headers.get("origin")||"";const headers={"Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin","Access-Control-Allow-Origin":origins.has(origin)?origin:"https://www.optyker.it","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};const respond=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.has(origin))return respond({ok:false,error:"Origin non consentita"},403);if(req.method==="OPTIONS")return new Response(null,{status:204,headers});if(req.method!=="POST")return respond({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const body=await req.json().catch(()=>({})),a=body.action,p=body.payload||{};
    if(a==="sale")return respond({...await saleViewV2(body),release:RELEASE});
    if(a==="prepare"){
      const operator=await login(body),zero=await prepareZero(p,operator);if(zero)return respond({ok:true,data:zero,release:RELEASE});
      return respond({...await proxy(body),release:RELEASE});
    }
    return respond({...await proxy(body),release:RELEASE});
  }catch(e){const m=e instanceof Error?e.message:"Errore fiscale";return respond({ok:false,error:m},m==="AUTH_REQUIRED"?401:400)}
});
