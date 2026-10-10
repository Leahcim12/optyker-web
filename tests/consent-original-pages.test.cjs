const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('_site/index.html', 'utf8');
const scope = {escapeHtml: v => String(v).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))};
vm.createContext(scope);
vm.runInContext(source.match(/var CONSENT_TEMPLATES=\{[\s\S]*?\n\};/)[0], scope);
vm.runInContext(source.slice(source.indexOf('function cloudConsentEscape'), source.indexOf('/* in Web/Cloud')), scope);
for (const [kind, count] of [['ortho',8],['lac',5]]) {
 test(kind + ': archived and new documents contain every original page and the captured signature', () => {
  const form = {patient:'Cliente <prova>',date:'10/10/2026',orthoPrice:'700',lacPrice:'850'};
  const signature = 'data:image/png;base64,TEST';
  const html = scope.cloudConsentBuildFromData(kind,form,signature,'PROVA');
  assert.equal((html.match(/class="page"/g)||[]).length,count);
  assert.equal((html.match(/class="sig"/g)||[]).length,1);
  assert(html.includes('Cliente &lt;prova&gt;'));
  assert(html.includes(signature));
  for(let n=1;n<=count;n++) {
   const bytes = fs.readFileSync('INFORMATIVE/'+kind+'-'+n+'.png');
   assert(bytes.readUInt32BE(16)>1100);
   assert(bytes.readUInt32BE(20)>1600);
   assert(html.includes('data:image/png;base64,'+bytes.toString('base64')));
  }
  assert.equal(scope.cloudConsentRecordHtml({consent_type:kind,data:{form,html:'OLD BLANK DOCUMENT'},signature_data_url:signature,file_name:'PROVA'}),html);
 });
}
test('no incomplete-document timeout printing and identical desktop aliases',()=>{
 assert(!source.includes('if(ready||attempts>80)'));
 for(const alias of ['gestionale-v2','gestionale-v3'])assert.equal(fs.readFileSync('_site/'+alias+'/index.html','utf8'),source);
});
