from pathlib import Path
p=Path('tests/sept11-browser.test.cjs');s=p.read_text()
s=s.replace(r'/<div class="head"><img src="\$\{logo\}"[^]*?<\/div><\/div>/',r'/<div class="head"><img src="[^]*?<\/div><\/div>/')
s=s.replace("hm[0].replace('${logo}',svg)","hm[0].replace(/src=\"[^\"]*\"/, 'src=\"'+svg+'\"')")
if "d.querySelector('.head').removeAttribute('data-ovc-print-header');" not in s:s=s.replace("if(d.querySelector('.head').outerHTML!==", "d.querySelector('.head').removeAttribute('data-ovc-print-header');if(d.querySelector('.head').outerHTML!==")
anchor=" // Real prescription header template from assembled source, same dimensions and clinic text."
extra="""
 // Customer-context composer must never offer navigation to another customer's drafts.
 await page.addScriptTag({content:source('billing-compose.js')});
 await page.evaluate(()=>OptykerInvoices.open({clientId:clientCurrentId,prefill:__invoiceOptions.prefill,call:async()=>({series:[{code:'retail',year:2026,label:'Dettaglio',last_number:0,suffix:'/D'}],info:{vat_types_list:[{id:1,value:22,description:'Test'}],countries_list:['Italia']}})}));
 await page.waitForSelector('#ficForm');assert(!(await page.locator('#ficNew').isVisible()));assert(!(await page.locator('#ficList').isVisible()));assert.equal(await page.inputValue('#fic_name'),'Cliente A');assert.equal(await page.locator('[data-k=vat_id]').inputValue(),'');assert((await page.locator('#ficBody').textContent()).includes('non incassare nuovamente'));await page.click('#ficClose');checks.push('Real customer composer preserves context, hides global navigation, requires VAT and warns against double collection');
"""
if extra.strip() not in s:s=s.replace(anchor,extra+anchor)
p.write_text(s)
p=Path('optyker-sept11.js');s=p.read_text().replace("OptykerInvoices.open({call:billingCall,", "OptykerInvoices.open({clientId:clientId,call:billingCall,");p.write_text(s)
p=Path('billing-compose.js');s=p.read_text()
s=s.replace('formState=null,current=null;','formState=null,current=null,clientContext=null;')
s=s.replace("E('ficList').onclick=list;}","E('ficList').onclick=list;if(clientContext){E('ficNew').hidden=true;E('ficList').hidden=true;} }")
s=s.replace("if(clientContext){E('ficNew').hidden=true;E('ficList').hidden=true;}","if(clientContext){E('ficNew').parentElement.style.setProperty('display','none','important');E('ficNew').hidden=true;E('ficList').hidden=true;}")
s=s.replace('open:function(options){api=options.call;', 'open:function(options){clientContext=options.clientId||options.prefill?.client_id||null;api=options.call;')
s=s.replace("Fattura collegata a un pagamento in cassa. Compila", "Fattura collegata a un pagamento già registrato in cassa: non incassare nuovamente. Compila")
s=s.replace("'Il pagamento verrà registrato come da incassare. Per i documenti sanitari questa funzione non effettua l’invio al Sistema TS.'", "(b.pos_source_id?'Il pagamento è già registrato in Optyker. La registrazione del relativo incasso in Fatture in Cloud va verificata separatamente; non incassare nuovamente.':'Il pagamento verrà registrato come da incassare.')+' Per i documenti sanitari questa funzione non effettua l’invio al Sistema TS.'")
p.write_text(s)
