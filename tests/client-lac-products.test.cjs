const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');const src=fs.readFileSync(path.join(__dirname,'..','client-lac-products.js'),'utf8');
function helpers(){
 const ctx={globalThis:{},Intl,Date,JSON,console,setTimeout,clearTimeout,setInterval:()=>0,CustomEvent:function(){},document:{readyState:'loading',addEventListener(){},getElementById(){return null}}};
 ctx.globalThis=ctx;vm.createContext(ctx);vm.runInContext(src,ctx);return ctx.OPTYKER_CLIENT_LAC_PRODUCTS;
}
test('trial/final classification prefers explicit stage',()=>{const h=helpers();assert.equal(h.stage({sheet_type:'lac',data:{lacProductStage:'final'}}),'final');assert.equal(h.stage({sheet_type:'lac',data:{lacProductStage:'trial',lacState:{document:'Busta'}}}),'trial')});
test('Busta and laboratory orders default to final',()=>{const h=helpers();assert.equal(h.automaticStage({sheet_type:'lac',data:{lacState:{document:'Busta'}}}),'final');assert.equal(h.automaticStage({sheet_type:'lac',data:{},laboratory_order:{id:'1'}}),'final')});
test('ordinary LAC sheet defaults to trial',()=>{const h=helpers();assert.equal(h.automaticStage({sheet_type:'lac',data:{lacState:{document:''}}}),'trial')});
test('product title reads brand and both eyes',()=>{const h=helpers();assert.match(h.productTitle({data:{lacState:{brand:'Esoform',odProductName:'RGP',osProductName:'SCL'}}}),/Esoform/);assert.match(h.productTitle({data:{lacState:{brand:'Esoform',odProductName:'RGP',osProductName:'SCL'}}}),/RGP/);});
