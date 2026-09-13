/* Local-only Focus CSV/XLSX reader. No external libraries or data uploads. */
(function (root) {
'use strict';
const HEADERS=['codiceCliente','cognome','nome','cellulare','eMail','appAttiva','id','codiceFiscale','gruppo','codiceScheda','indirizzo','citta','cap','provincia','stato','telefono','telefono2','fax','sesso','dataNascita','luogoDiNascita','professione','problemaVisivo','mail','lettera','usoLentiAContatto','hobby','pervenutoTramite','inviatoDa','dataInserimento','tessera','consensoInformato','consensoMarketing','consensoProfilazione','modelloPrivacy','dataPrivacy','titolo','indirizzo2','citta2','cap2','provincia2','stato2','promozione','codiceFiliale','operatore','sMS','cognome2','partitaIva','capoFamiglia','capoFamigliaScheda','pEC','codiceDestinatario','codiceFilialeUltimoContatto','dataUltimoContatto','dataApp','codiceFilialeApp'];
const MAX=24*1024*1024;
const error=t=>{throw Error(t)};
function csv(text,delimiter=',') {
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],value='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++) {
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;}}else value+=c;continue;}
  if(c===delimiter){row.push(value);value='';closed=false;continue;}
  if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';closed=false;continue;}
  if(c==='"'&&value===''&&!closed){quoted=true;continue;}
  if(closed)error('CSV non valido: caratteri dopo la chiusura di una cella.');value+=c;
 }
 if(quoted)error('CSV non valido: virgolette non chiuse.');
 if(value!==''||row.length){row.push(value);rows.push(row);}
 return rows;
}
function records(matrix) {
 if(!matrix.length||JSON.stringify(matrix[0])!==JSON.stringify(HEADERS))error('Il file deve essere l’export Clienti di Focus con tutti i 56 campi.');
 const rows=[],codes=new Set();
 for(let i=1;i<matrix.length;i++){
  const a=matrix[i];if(a.every(x=>x===''))continue;
  if(a.length!==HEADERS.length)error('La riga '+(i+1)+' non contiene tutti i 56 campi.');
  const r=Object.fromEntries(HEADERS.map((k,n)=>[k,String(a[n]??'')]));
  if(!r.codiceCliente.trim()||!r.codiceScheda.trim())error('Codice cliente o codice scheda assente alla riga '+(i+1)+'.');
  if(codes.has(r.codiceCliente.trim()))error('Codice Focus ripetuto alla riga '+(i+1)+'.');codes.add(r.codiceCliente.trim());rows.push(r);
 }
 if(!rows.length||rows.length>5000)error('Il file deve contenere da 1 a 5000 anagrafiche.');return rows;
}
const CRC_TABLE=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(a){let n=0xffffffff;for(const b of a)n=CRC_TABLE[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0;}
async function limited(stream,max) {
 const reader=stream.getReader(),parts=[];let n=0;
 try{while(true){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>max)error('Il foglio decompresso è troppo grande.');parts.push(x.value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}
 const out=new Uint8Array(n);let at=0;for(const a of parts){out.set(a,at);at+=a.length;}return out;
}
function xml(a){const s=new TextDecoder('utf-8',{fatal:true}).decode(a);if(/<!DOCTYPE|<!ENTITY/i.test(s))error('XML non supportato.');const d=new DOMParser().parseFromString(s,'application/xml');if(d.getElementsByTagName('parsererror').length)error('Il file Excel contiene XML non valido.');return d;}
const nodes=(el,name)=>Array.from(el.getElementsByTagNameNS('*',name));
async function workbook(buffer) {
 const a=new Uint8Array(buffer),v=new DataView(buffer);let end=-1;
 for(let i=a.length-22;i>=Math.max(0,a.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){end=i;break;}
 if(end<0)error('File Excel non valido.');
 const count=v.getUint16(end+10,true),start=v.getUint32(end+16,true);
 if(count>5000||start>=a.length||v.getUint16(end+4,true)!==0||v.getUint16(end+6,true)!==0)error('Formato archivio Excel non supportato.');
 const entries=new Map();let at=start;
 for(let i=0;i<count;i++){
  if(at+46>a.length||v.getUint32(at,true)!==0x02014b50)error('Archivio Excel danneggiato.');
  const flags=v.getUint16(at+8,true),method=v.getUint16(at+10,true),crc=v.getUint32(at+16,true),size=v.getUint32(at+20,true),plain=v.getUint32(at+24,true),n=v.getUint16(at+28,true),extra=v.getUint16(at+30,true),comment=v.getUint16(at+32,true),offset=v.getUint32(at+42,true);
  const name=new TextDecoder().decode(a.subarray(at+46,at+46+n));at+=46+n+extra+comment;
  if(entries.has(name))error('Archivio Excel ambiguo.');entries.set(name,{flags,method,crc,size,plain,offset});
 }
 let expanded=0;
 async function read(name){const e=entries.get(name);if(!e)return null;
  if(e.flags&1||![0,8].includes(e.method)||e.plain>MAX||e.offset+30>a.length||v.getUint32(e.offset,true)!==0x04034b50)error('Foglio cifrato, troppo grande o non supportato.');
  const pos=e.offset+30+v.getUint16(e.offset+26,true)+v.getUint16(e.offset+28,true);if(pos+e.size>a.length)error('Archivio Excel incompleto.');
  let b=a.slice(pos,pos+e.size);
  if(e.method===8){let ds;try{ds=new DecompressionStream('deflate-raw');}catch{error('Questo browser non legge XLSX: usa il CSV dello stesso export.');}b=await limited(new Blob([b]).stream().pipeThrough(ds),MAX);}
  expanded+=b.length;if(b.length!==e.plain||crc32(b)!==e.crc||expanded>MAX)error('Controllo di integrità Excel non superato.');return b;
 }
 const shared=await read('xl/sharedStrings.xml');const strings=shared?nodes(xml(shared),'si').map(n=>nodes(n,'t').map(t=>t.textContent||'').join('')):[];
 const sheets=[...entries.keys()].filter(k=>/^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((x,y)=>x.localeCompare(y,undefined,{numeric:true}));
 let found=null;
 for(const path of sheets){const d=xml(await read(path)),matrix=[];
  for(const row of nodes(d,'row')){
   const vals=Array(56).fill('');
   for(const c of nodes(row,'c')){
    if(nodes(c,'f').length)error('L’export non deve contenere formule Excel.');
    const letters=(c.getAttribute('r')||'').match(/^[A-Z]+/)?.[0];if(!letters)error('Cella Excel senza riferimento.');
    let col=0;for(const ch of letters)col=col*26+ch.charCodeAt(0)-64;col--;
    const type=c.getAttribute('t'),raw=nodes(c,'v')[0]?.textContent||'';
    let value=raw;if(type==='s'){const index=Number(raw);if(!Number.isInteger(index)||index<0||index>=strings.length)error('Stringa Excel non valida.');value=strings[index];}
    else if(type==='inlineStr')value=nodes(c,'t').map(n=>n.textContent||'').join('');
    else if(type==='b')value=raw==='1'?'True':raw==='0'?'False':error('Valore booleano non valido.');
    if(col>=56){if(value!=='')error('L’export contiene colonne non previste.');continue;}vals[col]=value;
   }matrix.push(vals);if(matrix.length>5001)error('Troppi clienti nel foglio.');
  }
  if(JSON.stringify(matrix[0])===JSON.stringify(HEADERS)){if(found)error('Più fogli contengono clienti: esporta un solo elenco.');found=matrix;}
 }
 if(!found)error('Non trovo il foglio Clienti di Focus con i 56 campi.');return found;
}
async function parse(file){
 if(!file||file.size>MAX||file.size===0)error('Seleziona un export Focus CSV o XLSX, massimo 24 MB.');
 const buffer=await file.arrayBuffer();let matrix;
 if(/\.xlsx$/i.test(file.name))matrix=await workbook(buffer);
 else if(/\.csv$/i.test(file.name)){const text=new TextDecoder('utf-8',{fatal:true}).decode(buffer);const first=text.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0];matrix=csv(text,first.includes('codiceCliente;')?';':',');}
 else error('Seleziona il file Excel (.xlsx) o CSV esportato da Focus.');
 const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))).map(n=>n.toString(16).padStart(2,'0')).join('');
 return {file:file.name,sha256,headers:HEADERS.slice(),rows:records(matrix)};
}
root.OptykerFocusClientParser=Object.freeze({parse,csv,records,headers:HEADERS.slice()});
})(typeof window==='undefined'?globalThis:window);
