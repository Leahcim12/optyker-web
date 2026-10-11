// Static checks of the cashier payment choices (no browser, no network, no printer).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../cash-register.js',import.meta.url),'utf8');
const electronic=['bank','alma','pagodil','pagolight'];
test('RATE is replaced by Alma, PagoDil and PagoLight buttons',()=>{
 for(const pay of ['cash','card','mixed',...electronic])assert.equal((source.match(new RegExp('data-pay="'+pay+'"','g'))||[]).length,1,pay);
 assert.doesNotMatch(source,/data-pay="pending"/);
 assert.doesNotMatch(source,/>RATE</);
 for(const label of ['Alma','PagoDil','PagoLight','Bonifico'])assert.ok(source.includes('>'+label+'</button>'),label);
});
test('bank transfer and financing can print the automatic receipt',()=>{
 assert.ok(source.includes("if(autoReceipt&&!['cash','card','mixed','bank','alma','pagodil','pagolight'].includes(S.payment))"));
 const labels=source.match(/function paymentLabel\(v\)\{return (\{[^}]+\})/);assert.ok(labels);
 for(const [key,label] of [['bank','Bonifico'],['alma','Alma'],['pagodil','PagoDil'],['pagolight','PagoLight']])assert.ok(labels[1].includes(key+":'"+label+"'"),key);
});
test('the balance of an open deposit offers the same electronic methods',()=>{
 const select=source.match(/<select data-settle-pay[^]*?<\/select>/);assert.ok(select,'settle selector');
 for(const [value,label] of [['cash','Contanti'],['card','Carta'],['bank','Bonifico'],['alma','Alma'],['pagodil','PagoDil'],['pagolight','PagoLight']])
  assert.ok(select[0].includes('<option value="'+value+'">'+label+'</option>'),value);
 assert.doesNotMatch(select[0],/value="mixed"|value="pending"/);
});
