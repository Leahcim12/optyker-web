import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {paymentDocument} from '../supabase/functions/optyker-cash-register-api/fiscal.mjs';
const lines=[{title:'Lenti',quantity:1,price:1000,fiscal_department:1}];
test('300 + 200 + 500 emits two deposits and one balance, exactly 1000',()=>{
 const docs=[[300,0],[200,300],[500,500]].map(([amount,before])=>paymentDocument(lines,'card',amount,before,null));
 assert.deepEqual(docs.map(d=>d.totalCents),[30000,20000,50000]);
 assert.deepEqual(docs.map(d=>d.input.lines[0].description),['ACCONTO Lenti','ACCONTO Lenti','SALDO Lenti']);
 assert.throws(()=>paymentDocument(lines,'card',701,300,null));
});
test('multiple deposits allocate awkward cents across VAT departments exactly',()=>{
 const ls=[{title:'A',quantity:3,price:10.01,fiscal_department:1},{title:'B',quantity:1,price:23.33,fiscal_department:2}];
 const docs=[[15.73,0],[10.11,15.73],[27.52,25.84]].map(([a,b])=>paymentDocument(ls,'card',a,b,null));
 for(const [dep,total] of [[1,3003],[2,2333]])assert.equal(docs.flatMap(d=>d.input.lines).filter(l=>l.department===dep).reduce((n,l)=>n+Math.round(l.unit_price*100)*l.quantity,0),total);
});
const source=readFileSync(new URL('../cash-recorded-balances.js',import.meta.url),'utf8');
const checkout=source.slice(source.indexOf('checkout=async function(){'),source.indexOf('var balanceNativeSettle='));
async function run(stage,amount,block=false){
 const calls=[];const g={sale_id:'sale',due_cents:70000,lines:[{variant_id:'x'}]};
 const c={S:{stage,cashOpen:true},recordedBalance:{checking:false},clientCartHasPending:()=>false,balanceKey:()=>'',balancePaint:()=>{},balanceLoad:async()=>({conflicts:[]}),balanceBlock:()=>block,balanceChosen:()=>({fresh:[],linked:[{group:g,line:g.lines[0]}]}),depositAmount:()=>amount,settleExisting:(...args)=>calls.push(args),toast:()=>{},balanceNativeCheckout:()=>{throw Error('must not create new sale')}};
 vm.createContext(c);vm.runInContext(checkout,c);await c.checkout();return calls;
}
test('second deposit routes to same sale, invalid amounts and uncertain receipts stay blocked',async()=>{
 assert.deepEqual(await run('deposit',200),[['sale','deposit',null]]);
 for(const amount of [0,-1,700,701,NaN])assert.equal((await run('deposit',amount)).length,0);
 assert.equal((await run('deposit',200,true)).length,0);
 assert.deepEqual(await run('balance',200),[['sale','balance',null]]);
});
