"""Cassa 20261126: su iPad il prezzo scritto nel carrello non torna più quello di prima.

Su iPadOS la finestra perde il «focus» quando si chiude la tastiera e lo riprende al tocco successivo
(WebKit bug 254882): toccando «Prezzo unitario» partivano i ricalcoli legati al ritorno sulla finestra
(tariffe OVC e saldi degli acconti), che ridisegnavano il carrello e cancellavano il prezzo che si stava
scrivendo. Sul PC il focus della finestra non cambia mentre si scrive, quindi lì funzionava.

Nel cash-register.js della build:
1. il carrello non si ridisegna mentre si scrive in un suo campo (prezzo unitario, prezzo finale): lo fa appena
   il campo viene lasciato; il ridisegno chiesto dalla conferma del campo stesso (evento change) passa subito,
   come prima;
2. i ricalcoli al ritorno sulla finestra partono poco dopo e, se si sta scrivendo in un campo del carrello,
   appena il campo viene lasciato;
3. «Prezzo unitario» è un campo di testo con tastierino decimale (come «Prezzo finale»): accetta la virgola
   qualunque sia la lingua dell'iPad e mostra il prezzo con la virgola; il valore passa da setManualPrice, che
   già converte la virgola e rifiuta i valori non validi.
Si ferma se il codice della cassa è cambiato (ancore non trovate una sola volta). Le copie della cassa in
gestionale-v2 e gestionale-v3, se presenti, vengono riallineate come fanno gli altri passaggi della cassa.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CASH = ROOT / '_site' / 'cash-register.js'
MARK = 'OPTYKER_CASH_IPAD_EDIT_20261126'
PRICE_INPUT = ('<input class="optykerCashManualPrice" type="number" inputmode="decimal" min="0" max="1000000" step="0.01" '
               'data-price="\'+esc(p.variant_id)+\'" value="\'+esc(unit.toFixed(2))+\'">',
               '<input class="optykerCashManualPrice" type="text" inputmode="decimal" autocomplete="off" '
               'data-price="\'+esc(p.variant_id)+\'" value="\'+esc(unit.toFixed(2).replace(\'.\',\',\'))+\'">')
FOCUS = (
    ("window.addEventListener('focus',function(){if(S.cashOpen&&!S.busy&&!S.ovcPricePending)ovcInvalidate();});",
     "window.addEventListener('focus',function(){cashAfterWindowFocus(function(){if(S.cashOpen&&!S.busy&&!S.ovcPricePending)ovcInvalidate();})});"),
    ("window.addEventListener('focus',function(){if(S.cashOpen&&!S.busy&&!recordedBalance.loading)balanceLoad()});",
     "window.addEventListener('focus',function(){cashAfterWindowFocus(function(){if(S.cashOpen&&!S.busy&&!recordedBalance.loading)balanceLoad()})});"),
)
GUARD = r"""
/* OPTYKER_CASH_IPAD_EDIT_20261126: il carrello non si ridisegna mentre si scrive in un suo campo (iPad: il tocco
   sul campo ridà il focus alla finestra e i ricalcoli cancellavano il prezzo appena scritto). */
var cashEditState={pending:false,commit:0,queue:[]};
function cashEditingField(){
  var a=document.activeElement,box=E('optykerCashCartItems');
  if(!a||!box||!a.tagName||(a.tagName!=='INPUT'&&a.tagName!=='TEXTAREA'))return null;
  if(a.tagName==='INPUT'&&/^(checkbox|radio|button|submit|reset|file|range|color|image|hidden)$/i.test(a.type||''))return null;
  return box.contains(a)?a:null
}
function cashEditFlush(){
  if(cashEditingField())return;
  var queue=cashEditState.queue.splice(0),pending=cashEditState.pending;
  cashEditState.pending=false;
  if(pending)renderCart();
  queue.forEach(function(fn){try{fn()}catch(e){if(window.console)console.error('Cassa',e)}})
}
function cashAfterWindowFocus(fn){
  setTimeout(function(){if(cashEditingField()){cashEditState.queue.push(fn);return}fn()},350)
}
var cashEditNativeRender=renderCart;
renderCart=function(){
  if(cashEditingField()&&!cashEditState.commit){cashEditState.pending=true;return}
  cashEditState.pending=false;
  var r=cashEditNativeRender.apply(this,arguments);
  if(cashEditState.queue.length)setTimeout(cashEditFlush,0);
  return r
};
document.addEventListener('change',function(e){
  var box=E('optykerCashCartItems');if(!box||!e.target||!box.contains(e.target))return;
  cashEditState.commit++;setTimeout(function(){cashEditState.commit=Math.max(0,cashEditState.commit-1)},0)
},true);
document.addEventListener('focusout',function(e){
  var box=E('optykerCashCartItems');if(!box||!e.target||!box.contains(e.target))return;
  setTimeout(cashEditFlush,0)
},true);
window.OPTYKER_CASH_IPAD_EDIT='20261126-ipadedit1';
"""

s = CASH.read_text(encoding='utf-8')
if MARK not in s:
    if s.count(PRICE_INPUT[0]) != 1:
        raise SystemExit('Cassa iPad: campo Prezzo unitario del carrello cambiato')
    s = s.replace(PRICE_INPUT[0], PRICE_INPUT[1], 1)
    for old, new in FOCUS:
        if s.count(old) != 1:
            raise SystemExit('Cassa iPad: ricalcolo al ritorno sulla finestra cambiato (' + old[:70] + ')')
        s = s.replace(old, new, 1)
    for needed in ('function E(id)', 'var balanceNativeRender=renderCart;', 'var cashPreflightNativeRender=renderCart;', 'function setManualPrice('):
        if needed not in s:
            raise SystemExit('Cassa iPad: codice della cassa cambiato (' + needed + ')')
    end = s.rstrip().rfind('})();')
    if end < 0 or s.rstrip()[end:] != '})();' or end < s.rfind('var balanceNativeRender=renderCart;'):
        raise SystemExit('Cassa iPad: fine del modulo della cassa non trovata')
    s = s[:end] + GUARD + s[end:]
    CASH.write_text(s, encoding='utf-8')
if s.count(MARK) != 1 or s.count('cashAfterWindowFocus(function(){') != 2 or s.count(PRICE_INPUT[1]) != 1:
    raise SystemExit('Cassa iPad: protezione del carrello assente o duplicata')
for alias in ('gestionale-v2', 'gestionale-v3'):
    copy = CASH.parent / alias / CASH.name
    if copy.is_file() and copy.read_bytes() != CASH.read_bytes():
        copy.write_bytes(CASH.read_bytes())
print('Cassa iPad: il carrello non si ridisegna mentre si scrive un prezzo; ricalcoli dopo il campo')
