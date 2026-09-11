import {Buffer} from 'node:buffer';
import {validate} from '../../../delivery-schema.mjs';
import {makePreview,signPdf,to64,from64} from './pdf.mjs';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
export function validateSignature(s,PNG){
 if(typeof s!=='string'||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(s)||s.length>220000)throw Error('Firma non valida: ripetere il tratto sul riquadro.');
 const b=from64(s);if(b.length<40||Array.from(b.slice(0,8)).join(',')!=='137,80,78,71,13,10,26,10')throw Error('Formato firma non valido');
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength),w=v.getUint32(16),h=v.getUint32(20);if(w<80||h<35||w>1600||h>600||w*h>960000)throw Error('Dimensioni firma non valide');
 const img=PNG.sync.read(Buffer.from(b),{checkCRC:true});let ink=0;for(let i=0;i<img.data.length;i+=4)if(img.data[i+3]>80&&Math.min(img.data[i],img.data[i+1],img.data[i+2])<170)ink++;
 if(ink<35)throw Error('La firma è vuota: firmare entrambi i riquadri.');return b;
}
export function service(db,lib,PNG){return async body=>{
 const {username,password,action}=body||{},p=body?.payload||{};
 if(typeof username!=='string'||!username.trim()||typeof password!=='string'||password.length<8)throw Error('AUTH_REQUIRED');
 if(!['get','prepare','sign','archive'].includes(action))throw Error('Azione non riconosciuta');
 const base={client_id:p.client_id,sheet_id:p.sheet_id};
 async function rpc(a,payload){const {data,error}=await db.rpc('optyker_delivery_internal',{p_username:username,p_password:password,p_action:a,p_payload:{...base,...payload}});if(error)throw Error('Archivio non disponibile: '+error.message);if(!data?.ok)throw Error(data?.error||'Operazione non riuscita');return data;}
 if(action==='get')return rpc('get',{});
 if(action==='archive')return rpc('archive',{document_id:p.document_id});
 if(action==='prepare'){
  const context=await rpc('get',{});if(context.source_hash!==p.source_hash)throw Error('I dati sono cambiati: riapri la busta.');
  if((p.previous_archive_id||null)!==(context.previous_archive_id||null))throw Error('È disponibile una nuova revisione: riapri la dichiarazione.');
  const values=validate(p.values,new Date(context.server_time)),id=crypto.randomUUID();
  const pdf=await makePreview(lib,values,{id,reference:context.sheet.reference_code||context.sheet.reference_no||context.sheet.id,server_time:context.server_time});
  const b64=to64(pdf.bytes);const x=await rpc('prepare',{document_id:id,source_hash:context.source_hash,previous_archive_id:context.previous_archive_id,values,layout:pdf.layout,pdf_base64:b64});
  return {ok:true,id:x.id,pdf_base64:b64,pdf_sha256:x.pdf_sha256,pages:pdf.pages,values};
 }
 // No client-created PDF is accepted. The server signs its own frozen preview.
 for(const k of ['confirm','identity_checked','client_accepts','instructions_delivered'])if(p[k]!==true)throw Error('Conferma identità, firme e consegna delle istruzioni.');
 const context=await rpc('sign_context',{document_id:p.document_id});
 const op=validateSignature(p.operator_signature,PNG),cl=validateSignature(p.client_signature,PNG);
 const signatureDigest=await hash(new TextEncoder().encode(JSON.stringify({id:p.document_id,op:to64(op),cl:to64(cl),identity_checked:true,instructions_delivered:true,client_accepts:true})));
 if(context.already_archived){if(context.signature_digest!==signatureDigest)throw Error('Documento già firmato con dati diversi. Apri la copia archiviata.');return context;}
 if(p.preview_sha256!==context.pdf_sha256)throw Error('L’anteprima firmata non corrisponde: riapri il documento.');
 const bytes=await signPdf(lib,from64(context.pdf_base64),context.layout,{operator:op,client:cl},context.server_time);
 const result=await rpc('finalize',{document_id:p.document_id,pdf_base64:to64(bytes),signed_at:context.server_time,signature_digest:signatureDigest,confirm:true,identity_checked:true,client_accepts:true,instructions_delivered:true});
 if(result.signature_digest!==signatureDigest)throw Error('Documento già archiviato con altre firme. Apri la copia archiviata.');return result;
};}
