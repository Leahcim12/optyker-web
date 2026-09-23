// Reissue projection. Reads confirmed fiscal references, never stale sale.data numbers.
export const VERSION='20260923-reissue2';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validId(value){const s=String(value||'');if(!uuid.test(s))throw new Error('Riferimento non valido');return s;}
export function cents(value){const s=String(value);if(!/^\d+(?:\.\d{1,2})?$/.test(s))throw new Error('Importo non valido');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n>100000000)throw new Error('Importo fuori limite');return n;}
export function confirmed(job){return !!(job&&job.state==='completed'&&/^\d{4}-\d{4}$/.test(job.document_number||'')&&!job.document_number.endsWith('-0000')&&/^\d{4}-\d{2}-\d{2}$/.test(job.document_date||''));}
export function planForSale(sale,payments,jobs){
 if(!sale||!['completed','open_balance'].includes(sale.status))throw new Error('Vendita non disponibile per riemissione');
 const paid=payments.filter(p=>p.sale_id===sale.id);
 if(paid.reduce((n,p)=>n+cents(p.amount),0)!==cents(sale.paid_amount))throw new Error('Pagamenti della vendita da verificare');
 const entries=[];
 for(const p of paid){
  const roots=jobs.filter(j=>j.sale_id===sale.id&&j.payment_id===p.id&&j.operation==='sale'&&!j.reissue_of_job_id);
  if(roots.length>1)throw new Error('Più documenti originari per lo stesso pagamento');
  if(!roots.length)continue;
  let source=roots[0],replacement=null;const seen=new Set();
  const voidFor=j=>jobs.find(v=>v.operation==='void'&&v.original_job_id===j.id);
  while(true){
   if(seen.has(source.id))throw new Error('Catena di riemissione non valida');seen.add(source.id);
   const children=jobs.filter(j=>j.reissue_of_job_id===source.id);
   if(children.length>1)throw new Error('Riemissioni duplicate da verificare');
   replacement=children[0]||null;
   if(replacement&&voidFor(replacement)){source=replacement;continue;}
   break;
  }
  const v=voidFor(source);if(!v)continue;
  if(!confirmed(source)||source.sale_id!==sale.id||source.payment_id!==p.id||v.sale_id!==sale.id||v.payment_id!==p.id||v.serial!==source.serial)throw new Error('Collegamento tra pagamento, scontrino e annullo da verificare');
  if(p.invoice_requested||p.billing_invoice_id||cents(p.amount)<=0||cents(p.amount)!==source.document?.totalCents)throw new Error('Importo o tipo documento non valido per riemissione');
  if(replacement&&(replacement.payment_id!==p.id||replacement.sale_id!==sale.id||replacement.operation!=='sale'||replacement.document?.totalCents!==source.document.totalCents))throw new Error('Riemissione non coerente con il pagamento originale');
  const state=!confirmed(v)?'void_reference':replacement?(confirmed(replacement)?'completed':replacement.state):'ready';
  entries.push({payment_id:p.id,original_job_id:source.id,original_number:source.document_number,void_job_id:v.id,void_number:v.document_number||null,void_date:v.document_date||null,amount_cents:cents(p.amount),state,job_id:replacement?.id||null,document_number:replacement?.document_number||null,document_date:replacement?.document_date||null});
 }
 if(!entries.length)throw new Error('Nessun annullo collegato da riemettere');
 return {sale_id:sale.id,version:VERSION,sale_total_cents:cents(sale.total),paid_cents:cents(sale.paid_amount),due_cents:cents(sale.due_amount),amount_cents:entries.reduce((n,p)=>n+p.amount_cents,0),remaining_cents:entries.reduce((n,p)=>n+(p.state==='completed'?0:p.amount_cents),0),complete:entries.every(p=>p.state==='completed'),payments:entries};
}
export function choosePreparation(plan,payload){
 if(payload.confirm_not_already_reissued!==true)throw new Error('Conferma che il documento non è già stato riemesso, anche con Focus');
 const e=plan.payments.find(p=>p.payment_id===validId(payload.payment_id)&&p.original_job_id===validId(payload.original_job_id));
 if(!e||e.void_job_id!==validId(payload.void_job_id))throw new Error('I riferimenti sono cambiati: aggiorna la riemissione');
 if(e.state==='void_reference')throw new Error('Verifica prima il riferimento del documento di annullo');
 return e;
}
