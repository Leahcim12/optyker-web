// Read-only projection of recorded money. Original prices and payments are never mutated.
export const VERSION='20260921-balance1';
const key=x=>String(x?.variant_id||x?.catalog_id||'');
export function cents(v){
  if(v===null||v===undefined||v===''||typeof v==='boolean')throw new Error('Importo mancante');
  const n=Number(v);if(!Number.isFinite(n)||n<0||n>100000000)throw new Error('Importo non valido');
  return Math.round((n+Number.EPSILON)*100);
}
export function allocate(weights,paid){
  const total=weights.reduce((s,n)=>s+n,0);
  if(!Number.isSafeInteger(paid)||paid<0||paid>total)throw new Error('Acconti non coerenti');
  if(!total)return weights.map(()=>0);
  const big=BigInt(total),p=BigInt(paid);
  const a=weights.map((n,i)=>({i,n:Number(BigInt(n)*p/big),r:BigInt(n)*p%big}));
  let left=paid-a.reduce((s,x)=>s+x.n,0);
  for(const x of [...a].sort((x,y)=>x.r===y.r?x.i-y.i:x.r>y.r?-1:1)){if(left--<=0)break;x.n++;}
  return a.map(x=>x.n);
}
export function balances(clientId,cart,sales,payments,jobs){
  const present=new Map(cart.map(x=>[key(x),x])),groups=[],conflicts=[],owners=new Map();
  for(const s of sales){
    if(s.client_id!==clientId||s.delivered_at||s.data?.client_cart_consumed===true||s.data?.client_cart_selection!==true)continue;
    const lines=Array.isArray(s.data?.lines)?s.data.lines:[];
    const related=lines.filter(x=>present.has(key(x)));if(!related.length)continue;
    const ids=[...new Set(related.map(key))];
    try{
      if(!['completed','open_balance'].includes(s.status))throw new Error('Vendita precedente da riconciliare');
      if(lines.length!==related.length||new Set(lines.map(key)).size!==lines.length)throw new Error('Articoli della vendita non interamente presenti nel carrello');
      for(const l of lines){const q=Number(l.quantity),c=present.get(key(l));if(!Number.isInteger(q)||q<1||q!==Number(c.quantity))throw new Error('Quantità diversa dalla vendita già registrata');}
      const total=cents(s.total),paid=cents(s.paid_amount),due=cents(s.due_amount);
      const receipts=payments.filter(p=>p.sale_id===s.id&&p.client_id===clientId);
      if(paid+due!==total||receipts.reduce((n,p)=>n+cents(p.amount),0)!==paid)throw new Error('Acconti e saldo richiedono una verifica');
      const weights=lines.map(l=>cents(l.price)*Number(l.quantity));if(weights.reduce((n,x)=>n+x,0)!==total)throw new Error('Totale vendita non coerente con le righe');
      const shares=allocate(weights,paid);
      const paymentsOut=receipts.map(p=>{
        const j=jobs.find(j=>j.payment_id===p.id&&j.operation!=='void');
        return {id:p.id,amount_cents:cents(p.amount),stage:p.payment_stage,created_at:p.created_at,receipt_state:p.invoice_requested||p.billing_invoice_id?'invoice':j?.state||'unissued',job_id:j?.id||null,document_number:j?.document_number||null};
      });
      groups.push({sale_id:s.id,total_cents:total,paid_cents:paid,due_cents:due,created_at:s.created_at,payments:paymentsOut,lines:lines.map((l,i)=>({variant_id:key(l),quantity:Number(l.quantity),title:String(l.title||'Articolo'),total_cents:weights[i],paid_cents:shares[i],due_cents:weights[i]-shares[i]}))});
      for(const id of ids){if(owners.has(id))throw new Error('Articolo associato a più vendite: verifica Acconti aperti');owners.set(id,s.id);}
    }catch(e){conflicts.push({sale_id:s.id,variant_ids:ids,message:e.message});}
  }
  const invalid=new Set(conflicts.flatMap(c=>c.variant_ids));
  return {groups:groups.filter(g=>!g.lines.some(l=>invalid.has(l.variant_id))),conflicts};
}
