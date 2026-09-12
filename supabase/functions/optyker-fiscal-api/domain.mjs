// RCH protocol v14 pp.18-23. Shop mapping: readback 2026-09-12.
export const SERIAL = '72IV6003831';
export const RELEASE = '20260912-fiscal1';
export const DEPARTMENTS = Object.freeze({1:{vat:'04',type:'goods'},2:{vat:'22',type:'goods'},3:{vat:'ART10',type:'services'}});
export function cents(value) {
  const s=String(value);
  if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw new Error('Importo non valido');
  const [a,b='']=s.split('.');const n=Number(a)*100+Number(b.padEnd(2,'0'));
  if(!Number.isSafeInteger(n)||n<0||n>100000000)throw new Error('Importo fuori limite');return n;
}
export function fiscalCode(value) {
  const s=String(value||'').trim().toUpperCase();
  if(!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(s))throw new Error('Codice fiscale non valido');
  const odd=[1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23];
  let sum=0;for(let i=0;i<15;i++){const v=/\d/.test(s[i])?Number(s[i]):s.charCodeAt(i)-65;sum+=i%2?v:odd[v];}
  if(String.fromCharCode(65+sum%26)!==s[15])throw new Error('Carattere di controllo del codice fiscale non valido');return s;
}
export function description(value) {
  // No command delimiters, control characters, or reserved word in printer text.
  const s=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()
    .replace(/[^A-Z0-9 .,+'-]/g,' ').replace(/TOTALE/g,'IMPORTO').replace(/\s+/g,' ').trim().slice(0,20);
  if(!s)throw new Error('Descrizione richiesta');return s;
}
export function makeDocument(payment,input,clientFiscal='') {
  if(payment.invoice_requested||payment.billing_invoice_id)throw new Error('Questo pagamento segue il flusso fattura');
  const paymentCode={cash:1,card:4,cheque:3}[payment.payment_method];
  if(!paymentCode)throw new Error('Metodo di pagamento RCH non mappato: usare il flusso manuale del registratore');
  const amount=cents(payment.amount);if(amount<=0)throw new Error('Nessun importo da emettere');
  if(input.not_already_issued!==true)throw new Error('Conferma che il pagamento non ha già un documento fiscale');
  if(!Array.isArray(input.lines)||!input.lines.length||input.lines.length>100)throw new Error('Da 1 a 100 righe richieste');
  let total=0;
  const lines=input.lines.map(l=>{
    const department=Number(l.department),d=DEPARTMENTS[department];
    if(!d)throw new Error('Seleziona IVA e tipologia per ogni riga');
    const quantity=Number(l.quantity);if(!Number.isInteger(quantity)||quantity<1||quantity>99)throw new Error('Quantità non valida');
    const unitPriceCents=cents(l.unit_price);if(unitPriceCents<=0)throw new Error('Prezzo maggiore di zero richiesto');
    const sum=unitPriceCents*quantity;total+=sum;
    const expenseCode=String(l.expense_code||'none');if(!['none','AD','AA'].includes(expenseCode))throw new Error('Tipo spesa TS non valido');
    return {description:description(l.description),quantity,unitPriceCents,totalCents:sum,department,vatCode:d.vat,saleType:d.type,expenseCode};
  });
  if(total!==amount)throw new Error('Le righe fiscali devono corrispondere esattamente al pagamento registrato');
  const tsRequested=input.ts_requested===true,opposition=input.opposition===true;
  if(tsRequested&&!lines.some(l=>l.expenseCode!=='none'))throw new Error('Indica almeno una riga sanitaria per il Sistema TS');
  if(!tsRequested&&lines.some(l=>l.expenseCode!=='none'))throw new Error('Seleziona la preparazione TS oppure rimuovi i codici spesa');
  const talking=input.talking_receipt===true;
  if(tsRequested&&!talking&&!opposition)throw new Error('Per preparare TS senza opposizione serve lo scontrino con codice fiscale');
  const cf=talking?fiscalCode(clientFiscal):'';
  const commands=lines.map(l=>'=R'+l.department+'/$'+l.unitPriceCents+'/*'+l.quantity+'/('+l.description+')');
  if(cf)commands.push('="/?C/('+cf+')');
  commands.push('=T'+paymentCode);
  return {version:RELEASE,serial:SERIAL,paymentCode,paymentMethod:payment.payment_method,totalCents:total,lines,talkingReceipt:talking,fiscalCode:cf,tsRequested,opposition,commands};
}
export function resultState(result,commandCount) {
  if(result?.state==='not_started'&&result.commandsAcknowledged===0&&result.writeStarted===false)return 'not_started';
  if(result?.state==='closing_acknowledged'&&result.writeStarted===true&&result.commandsAcknowledged===commandCount&&result.idleAfter===true)return 'awaiting_reference';
  return 'uncertain';
}
export function reference(input,expectedCents) {
  const number=String(input.document_number||'').trim(),date=String(input.document_date||'');
  if(!/^\d{4}-\d{4}$/.test(number)||number.endsWith('-0000'))throw new Error('Riporta il numero stampato, nel formato 1160-0001');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new Error('Data documento non valida');
  if(date>new Date().toISOString().slice(0,10))throw new Error('La data non può essere futura');
  if(input.paper_verified!==true||cents(input.amount)!==expectedCents)throw new Error('Verifica numero, data e totale sul documento stampato');
  return {number,date,amount:expectedCents/100};
}
