from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_LABEL_SCOPE_MESSAGE_V1'
if MARK in s:
    raise SystemExit(0)

old="""if(err.code==='SHOPIFY_SCOPE')msg='Mancano i permessi Shopify per acquistare le etichette. Nell’app Optyker abilita: read_orders, write_orders, read_merchant_managed_fulfillment_orders e write_merchant_managed_fulfillment_orders, poi reinstalla/approva la nuova versione.';"""
new="""if(err.code==='SHOPIFY_SCOPE')msg='Mancano 3 permessi Shopify per acquistare le etichette con Optyker: write_orders, read_merchant_managed_fulfillment_orders e write_merchant_managed_fulfillment_orders. read_orders è già attivo. Pubblica/approva la nuova versione dell’app Optyker con questi permessi e poi riprova.'; /* OPTYKER_LABEL_SCOPE_MESSAGE_V1 */"""

if old not in s:
    raise SystemExit('Messaggio permessi etichetta non trovato')

s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

if MARK not in s:
    raise SystemExit('Patch messaggio scope incompleta')
print('Shopify label scope message updated')
