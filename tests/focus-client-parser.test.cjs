const test=require('node:test');
const assert=require('node:assert/strict');
require('../focus-client-parser.js');
const parser=globalThis.OptykerFocusClientParser;
const row=(code='A')=>parser.headers.map(k=>({codiceCliente:code,codiceScheda:'S'+code,nome:'Cliente di prova',cognome:'Verifica',hobby:'Leggere, camminare'}[k]||''));
test('Preserves 56 columns, quoted commas, quotes and CRLF',()=>{
 const encode=a=>a.map(v=>'"'+v.replaceAll('"','""')+'"').join(',');
 const r=row();r[parser.headers.indexOf('hobby')]='Leggere, "camminare"\r\nNuova riga';
 const result=parser.records(parser.csv('\ufeff'+encode(parser.headers)+'\r\n'+encode(r)+'\r\n'));
 assert.equal(result.length,1);assert.equal(Object.keys(result[0]).length,56);assert.equal(result[0].hobby,r[26]);
});
test('Rejects incorrect headers and truncated records',()=>{
 assert.throws(()=>parser.records([['nome'],['Test']]),/56/);
 assert.throws(()=>parser.records([parser.headers,['A']]),/56/);
});
test('Rejects duplicate Focus identifiers and missing identifiers',()=>{
 assert.throws(()=>parser.records([parser.headers,row('A'),row('A')]),/ripetuto/);
 assert.throws(()=>parser.records([parser.headers,row('')]),/assente/);
});
test('CSV never evaluates formulas or HTML',()=>{
 const r=row();r[2]='<img src=x onerror=alert(1)>';r[26]='=1+1';
 const x=parser.records([parser.headers,r])[0];assert.equal(x.nome,r[2]);assert.equal(x.hobby,'=1+1');
});
test('Malformed quotes are rejected',()=>{
 assert.throws(()=>parser.csv('"unterminated'),/virgolette/);
 assert.throws(()=>parser.csv('"closed"oops'),/caratteri/);
});
