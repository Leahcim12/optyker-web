import {cents, fiscalCode, makeDocument, DEPARTMENTS} from '../optyker-fiscal-api/domain.mjs';

// A purchase identity is independent of the address book and Shopify customer.
export function purchaseIdentity(client, supplied, requested) {
  if (!requested) return null;
  return {fiscal:fiscalCode(String(supplied || client?.fiscal || '').replace(/\s/g,''))};
}
export function fiscalLines(lines, choices=[]) {
  return lines.map(l=>{
    const choice=choices.find(x=>String(x.variant_id)===String(l.variant_id));
    const vat=String(l.fiscal_vat_code || l.vat_code || '');
    const department=Number(choice?.department || ({'04':1,'22':2,'ART10':3}[vat]) || 0);
    if(l.fiscal_item_type&&DEPARTMENTS[department]&&l.fiscal_item_type!==DEPARTMENTS[department].type)throw new Error('Reparto RCH non configurato per questa IVA e tipologia: '+l.title);
    if(!DEPARTMENTS[department]) throw new Error('Seleziona l’IVA nel carrello per '+l.title);
    return {...l,fiscal_department:department,fiscal_vat_code:DEPARTMENTS[department].vat,fiscal_item_type:DEPARTMENTS[department].type};
  });
}
// Cumulative allocation makes deposit + balance equal each original line exactly.
// Largest remainders are deterministic; monetary values never use binary fractions.
function allocated(weights, amount) {
  const total=weights.reduce((a,b)=>a+b,0);
  if(!total||amount<0||amount>total)throw new Error('Importo pagamento non valido');
  const rows=weights.map((w,i)=>({i,n:Math.floor(w*amount/total),r:(w*amount)%total}));
  let remaining=amount-rows.reduce((s,r)=>s+r.n,0);
  for(const row of [...rows].sort((a,b)=>b.r-a.r||a.i-b.i)){if(remaining--<=0)break;row.n++;}
  return rows.map(r=>r.n);
}
export function paymentDocument(lines, method, amount, paidBefore, identity, flags={}) {
  const weights=lines.map(l=>cents(l.price)*Number(l.quantity));
  const before=cents(paidBefore),paid=cents(amount),total=weights.reduce((a,b)=>a+b,0);
  if(before!==0&&before+paid!==total)throw new Error('È previsto il saldo completo del residuo');
  const start=allocated(weights,before),end=allocated(weights,before+paid);
  const partial=paid!==total;
  const input={not_already_issued:true,talking_receipt:!!identity,ts_requested:flags.ts===true,opposition:flags.opposition===true,
    lines:lines.map((l,i)=>({description:(partial?(before?'SALDO ':'ACCONTO '):'')+l.title,
      quantity:partial?1:Number(l.quantity),unit_price:partial?(end[i]-start[i])/100:l.price,
      department:l.fiscal_department,expense_code:flags.ts?(flags.code==='AA'?'AA':'AD'):'none'})).filter(l=>Number(l.unit_price)>0)};
  if(flags.ts&&flags.code==='AA'&&method==='cash')throw new Error('Le spese AA richiedono un pagamento tracciabile');
  const document=makeDocument({amount,payment_method:method},input,identity?.fiscal||'');
  return {version:1,input,fiscal:identity?.fiscal||'',totalCents:document.totalCents};
}
