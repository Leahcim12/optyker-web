import {X509Certificate, publicEncrypt, constants, createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {SaxesParser} from 'saxes';
import {CERTIFICATE_PEM, PUBLIC_KEY_PEM} from './certificate.mjs';

export const KIT_SHA256='02cbcdb02702fcc3dad2d157de64dcf0d3b591639792bdf1ba2d0b7d8d5aaccb';
export const TRANSPORT_VERSION='20260913-ts3';
const SOAP='http://schemas.xmlsoap.org/soap/envelope/';
export const SERVICES=Object.freeze({
  cancel:{path:'/DocumentoSpesa730pWeb/DocumentoSpesa730pPort',ns:'http://documentospesap730.sanita.finanze.it',request:'cancellazioneDocumentoSpesaRequest',response:'cancellazioneDocumentoSpesaResponse',action:'cancellazione.documentospesap730.sanita.finanze.it'},
  insert:{path:'/DocumentoSpesa730pWeb/DocumentoSpesa730pPort',ns:'http://documentospesap730.sanita.finanze.it',request:'inserimentoDocumentoSpesaRequest',response:'inserimentoDocumentoSpesaResponse',action:'inserimento.documentospesap730.sanita.finanze.it'},
  query:{path:'/InterrogazionePuntuale730Web/InterrogazionePuntuale730Port',ns:'http://interrogazionepuntuale.p730.sanita.finanze.it',request:'interrogazionePuntualeRequest',response:'interrogazionePuntualeResponse',action:''},
  verify:{path:'/ReportMensile730Web/ReportMensilePort',ns:'http://reportmensile.p730.sanita.finanze.it',request:'reportMensileRequest',response:'reportMensileResponse',action:''},
  outcome:{path:'/EsitoStatoInviiWEB/EsitoInvioDatiSpesa730Service',ns:'http://esitoinvio.p730.sanita.sogei.it/',request:'EsitoInvii',response:'EsitoInviiResponse',action:''},
  receipt:{path:'/Ricevute730ServiceWeb/ricevutePdf',ns:'http://ricevutapdf.p730.sanita.sogei.it/',request:'RicevutaPdf',response:'RicevutaPdfResponse',action:''},
});
export const sha256=v=>createHash('sha256').update(v).digest('hex');
export function certificateStatus(now=new Date()) {
  try {
  const c=new X509Certificate(CERTIFICATE_PEM);
  const fingerprint=c.fingerprint256.replaceAll(':','').toLowerCase();
  if(fingerprint!=='8e7e187dae448d92f78b30dda6253cf5fc6105d2afdc85111ca729708e07de01')throw new Error('TS_CERTIFICATE_INVALID');
  return {valid:now>=new Date(c.validFrom)&&now<new Date(c.validTo),expires_at:new Date(c.validTo).toISOString(),fingerprint};
  } catch(e) {if(e?.message==='TS_CERTIFICATE_INVALID')throw e;throw new Error('TS_CERTIFICATE_RUNTIME');}
}
export function encryptField(value) {
  if(!certificateStatus().valid)throw new Error('TS_CERTIFICATE_EXPIRED');
  if(typeof value!=='string'||!value||Buffer.byteLength(value)>117)throw new Error('TS_INVALID_CONFIGURATION');
  try{return publicEncrypt({key:PUBLIC_KEY_PEM,padding:constants.RSA_PKCS1_PADDING},Buffer.from(value,'utf8')).toString('base64');}
  catch{throw new Error('TS_ENCRYPTION_RUNTIME');}
}
export const xml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const tag=(name,value,p='t:')=>'<'+p+name+'>'+xml(value)+'</'+p+name+'>';
function date(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value||value<'2014-01-01'||value>new Date().toISOString().slice(0,10))throw new Error('TS_INVALID_DOCUMENT');
  return value;
}
function validCF(v) {
  if(!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(v||''))return false;
  const odd=[1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23];
  let n=0;for(let i=0;i<15;i++){const a=/\d/.test(v[i])?Number(v[i]):v.charCodeAt(i)-65;n+=i%2?a:odd[a];}
  return v[15]===String.fromCharCode(65+n%26);
}
function owner(c,encrypt) {
  if(!/^\d{3}-\d{3}-\d{6}$/.test(c.owner_code)||!/^\d{11}$/.test(c.business_vat)||!c.owner_fiscal_code)throw new Error('TS_INVALID_CONFIGURATION');
  const [region,asl,ssa]=c.owner_code.split('-');
  return '<t:Proprietario>'+tag('codiceRegione',region)+tag('codiceAsl',asl)+tag('codiceSSA',ssa)+tag('cfProprietario',encrypt(c.owner_fiscal_code))+'</t:Proprietario>';
}
export function validateDocument(d) {
  if(!d||d.serial!=='72IV6003831'||!['paper_confirmed','rch_ej'].includes(d.referenceSource)||!/^\d{4}-\d{4}$/.test(d.number||'')||d.number.endsWith('-0000'))throw new Error('TS_INVALID_DOCUMENT');
  date(d.date);date(d.paymentDate);
  if(!['cash','card','cheque'].includes(d.paymentMethod)||typeof d.opposition!=='boolean')throw new Error('TS_INVALID_DOCUMENT');
  if(d.opposition ? !!d.fiscalCode : !validCF(d.fiscalCode))throw new Error('TS_INVALID_DOCUMENT');
  if(!Array.isArray(d.lines)||!d.lines.length||d.lines.length>100)throw new Error('TS_INVALID_DOCUMENT');
  let total=0;
  for(const l of d.lines){
    if(!['AD','AA'].includes(l.expenseCode)||!['04','22','ART10'].includes(l.vatCode)||!Number.isSafeInteger(l.totalCents)||l.totalCents<=0)throw new Error('TS_INVALID_DOCUMENT');
    total+=l.totalCents;
  }
  if(!Number.isSafeInteger(total)||total>100000000)throw new Error('TS_INVALID_DOCUMENT');
  return total;
}
function identity(d,c) {
  if(!/^\d{11}$/.test(c.business_vat)||!/^\d{4}-\d{4}$/.test(d.number||''))throw new Error('TS_INVALID_DOCUMENT');
  return tag('pIva',c.business_vat)+tag('dataEmissione',date(d.date))+'<t:numDocumentoFiscale>'+tag('dispositivo','1')+tag('numDocumento',d.number)+'</t:numDocumentoFiscale>';
}
export function buildRequest(kind,c,{document:d,protocol,month}={},encrypt=encryptField) {
  const service=SERVICES[kind];if(!service)throw new Error('TS_INVALID_ACTION');
  let body;
  if(kind==='outcome'||kind==='receipt') {
    if(!/^\d{17}$/.test(protocol||''))throw new Error('TS_INVALID_PROTOCOL');
    body='<DatiInputRichiesta>'+tag('pinCode',encrypt(c.pin),'')+tag('protocollo',protocol,'')+'</DatiInputRichiesta>';
  } else {
    body=tag('pincode',encrypt(c.pin))+owner(c,encrypt);
    if(kind==='verify') {
      if(!/^20\d{2}(0[1-9]|1[0-2])$/.test(month||''))throw new Error('TS_INVALID_DOCUMENT');
      body+=tag('annoMese',month)+tag('tipoEstrazione','I');
    } else if(kind==='query') body+='<t:idDocumentoFiscale>'+identity(d,c)+'</t:idDocumentoFiscale>';
    else if(kind==='cancel') {
      validateDocument(d);
      body+='<t:idCancellazioneDocumentoFiscale>'+identity(d,c)+'</t:idCancellazioneDocumentoFiscale>';
    }
    else {
      validateDocument(d);
      body+='<t:idInserimentoDocumentoFiscale><t:idSpesa>'+identity(d,c)+'</t:idSpesa>'+tag('dataPagamento',d.paymentDate);
      if(d.paymentDate<d.date)body+=tag('flagPagamentoAnticipato','1');
      if(!d.opposition)body+=tag('cfCittadino',encrypt(d.fiscalCode));
      for(const l of d.lines)body+='<t:voceSpesa>'+tag('tipoSpesa',l.expenseCode)+tag('importo',(l.totalCents/100).toFixed(2))+(l.vatCode==='ART10'?tag('naturaIVA','N4'):tag('aliquotaIVA',Number(l.vatCode).toFixed(2)))+'</t:voceSpesa>';
      body+=tag('pagamentoTracciato',d.paymentMethod==='cash'?'NO':'SI')+tag('tipoDocumento','D')+tag('flagOpposizione',d.opposition?'1':'0')+'</t:idInserimentoDocumentoFiscale>';
    }
  }
  return '<?xml version="1.0" encoding="UTF-8"?><s:Envelope xmlns:s="'+SOAP+'" xmlns:t="'+service.ns+'"><s:Header/><s:Body><t:'+service.request+'>'+body+'</t:'+service.request+'></s:Body></s:Envelope>';
}
function children(n,name,ns){return (n?.children||[]).filter(c=>c.name===name&&(ns===undefined||c.ns===ns));}
function one(n,name,ns){const a=children(n,name,ns);if(a.length>1)throw new Error('TS_INVALID_RESPONSE');return a[0];}
const value=(n,name)=>one(n,name)?.text.trim()||'';
export function parseResponse(kind,text) {
  if(typeof text!=='string'||text.length>1500000||/<!DOCTYPE|<!ENTITY/i.test(text))throw new Error('TS_INVALID_RESPONSE');
  const p=new SaxesParser({xmlns:true}),stack=[];let root,count=0;
  p.on('opentag',n=>{if(++count>15000||stack.length>24)throw new Error('TS_INVALID_RESPONSE');const node={name:n.local,ns:n.uri,text:'',children:[]};if(stack.length)stack.at(-1).children.push(node);else root=node;stack.push(node);});
  p.on('text',t=>{if(stack.length)stack.at(-1).text+=t;});p.on('cdata',t=>{if(stack.length)stack.at(-1).text+=t;});p.on('closetag',()=>stack.pop());
  try{p.write(text).close();}catch{throw new Error('TS_INVALID_RESPONSE');}
  if(root?.name!=='Envelope'||root.ns!==SOAP)throw new Error('TS_INVALID_RESPONSE');
  const body=one(root,'Body',SOAP);
  if(!body||body.children.length!==1)throw new Error('TS_INVALID_RESPONSE');
  const r=body.children[0],service=SERVICES[kind];
  if(r.name==='Fault'&&r.ns===SOAP)throw new Error('TS_SOAP_FAULT');
  if(!service||r.name!==service.response||r.ns!==service.ns)throw new Error('TS_INVALID_RESPONSE');
  const fieldNamespace=['outcome','receipt'].includes(kind)?'':service.ns;
  const checkNamespace=n=>{for(const c of n.children){if(c.ns!==fieldNamespace)throw new Error('TS_INVALID_RESPONSE');checkNamespace(c);}};
  checkNamespace(r);
  const output=['outcome','receipt'].includes(kind)?one(r,'DatiOutputRichiesta'):r;
  if(!output)throw new Error('TS_INVALID_RESPONSE');
  const esito=value(output,'esitoChiamata');if(!/^[0-9]{1,2}$/.test(esito))throw new Error('TS_INVALID_RESPONSE');
  // Retain codes, never server prose that might echo PINs, XML or patient data.
  const list=one(output,'listaMessaggi');
  const codes=children(list,'messaggio').map(m=>({code:value(m,'codice').replace(/[^A-Za-z0-9_.-]/g,'').slice(0,30),type:value(m,'tipo').replace(/[^A-Za-z0-9]/g,'').slice(0,15)}));
  const protocol=value(output,'protocollo');if(protocol&&!/^\d{17}$/.test(protocol))throw new Error('TS_INVALID_RESPONSE');
  const result={esito,protocol,codes};
  if(kind==='query'){
    const d=one(output,'documentoFiscale'),id=one(d,'idDocumentoFiscale'),num=one(id,'numDocumentoFiscale');
    if(d)result.document={vat:value(id,'pIva'),date:value(id,'dataEmissione'),device:value(num,'dispositivo'),number:value(num,'numDocumento'),paymentDate:value(d,'dataPagamento'),protocol:value(d,'protocollo'),totals:children(d,'totaliVociSpesa').map(v=>({code:value(v,'tipoSpesa'),amount:value(v,'importo')})),errors:children(one(d,'listaErroriDocumento'),'errore').length};
  }
  if(kind==='outcome')result.outcomes=children(one(output,'esitiPositivi'),'dettagliEsito').map(n=>({protocol:value(n,'protocollo'),state:value(n,'stato'),sent:value(n,'nInviati'),accepted:value(n,'nAccolti'),errors:value(n,'nErrori'),warnings:value(n,'nWarnings')}));
  if(kind==='receipt')result.pdf=value(one(one(output,'esitiPositivi'),'dettagliEsito'),'pdf');
  return result;
}
export function classifyInsert(r) {
  if(r.esito==='0'&&r.protocol)return 'submitted';
  if(r.esito==='1'&&!r.protocol&&r.codes.some(c=>c.type==='E'))return 'rejected';
  return 'uncertain';
}
export function classifyOutcome(r,protocol) {
  const rows=(r.outcomes||[]).filter(x=>x.protocol===protocol);
  if(r.esito!=='0'||rows.length!==1)return 'uncertain';
  const x=rows[0];
  if(x.state==='2'&&x.sent==='1'&&x.accepted==='1'&&x.errors==='0')return 'accepted';
  if(['3','5','9'].includes(x.state)&&x.accepted==='0')return 'rejected';
  return ['0','1'].includes(x.state)?'submitted':'uncertain';
}
export function queryMatches(r,d,c) {
  const x=r.document;
  if(r.esito!=='0'||!x||x.errors||!/^\d{17}$/.test(x.protocol)||x.vat!==c.business_vat||x.date!==d.date||Number(x.device)!==1||x.number!==d.number||x.paymentDate!==d.paymentDate)return false;
  const expected={},actual={};
  for(const l of d.lines)expected[l.expenseCode]=(expected[l.expenseCode]||0)+l.totalCents;
  for(const v of x.totals){if(!/^\d+(?:\.\d{1,2})?$/.test(v.amount))return false;actual[v.code]=(actual[v.code]||0)+Math.round(Number(v.amount)*100);}
  return JSON.stringify(Object.entries(expected).sort())===JSON.stringify(Object.entries(actual).sort());
}
export async function callTS(kind,c,args,{test=false,fetcher=fetch,requestBody}={}) {
  const body=requestBody??buildRequest(kind,c,args),svc=SERVICES[kind];
  if(!/^[A-Z0-9]{3,64}$/.test(c.username)||typeof c.password!=='string'||!c.password||/[\r\n]/.test(c.password))throw new Error('TS_INVALID_CONFIGURATION');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{
    const response=await fetcher('https://'+(test?'invioss730ptest':'invioss730p')+'.sanita.finanze.it'+svc.path,{method:'POST',redirect:'error',signal:controller.signal,headers:{'Content-Type':'text/xml; charset=utf-8','SOAPAction':'"'+svc.action+'"','Authorization':'Basic '+Buffer.from(c.username+':'+c.password,'utf8').toString('base64')},body});
    if(response.status===401||response.status===403)throw new Error('TS_AUTH_FAILED');
    if(!response.ok)throw new Error('TS_HTTP_'+response.status);
    if(!response.body)throw new Error('TS_INVALID_RESPONSE');
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1500000){await reader.cancel();throw new Error('TS_INVALID_RESPONSE');}chunks.push(value);}}finally{reader.releaseLock();}
    return parseResponse(kind,Buffer.concat(chunks).toString('utf8'));
  }catch(e){if(/^TS_[A-Z0-9_]+$/.test(e?.message||''))throw e;throw new Error('TS_CONNECTION_FAILED');}
  finally{clearTimeout(timer);}
}
