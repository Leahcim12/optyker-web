"""Repair RCH status/REG controls; preserve fiscal routes and printer safeguards."""
from pathlib import Path
import re

VERSION = '20260919-regui1'
MARK = 'OPTYKER_RCH_REG_UI_20260919'

MODAL = r'''function modal(title){
 var old=document.getElementById('optykerRchCloudModal');if(old)old.remove();
 var m=document.createElement('div');m.id='optykerRchCloudModal';m.className='optykerCashModal open';
 m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-hidden','false');
 m.style.setProperty('z-index','2147483600','important');m.style.setProperty('pointer-events','auto','important');
 m.innerHTML='<div class="optykerCashModalCard" style="max-width:720px;pointer-events:auto"><div class="optykerCashModalTitle">'+esc(title)+'</div><div class="orcBody">Caricamento…</div><p class="orcMsg" role="status" aria-live="polite"></p><button class="optykerCashModalClose" type="button">Chiudi</button></div>';
 document.body.appendChild(m);m.querySelector('.optykerCashModalClose').onclick=function(){m.remove()};return m;
}
'''
SAFE = r'''function zeroFlag(v){return v===0||v==='0'}
function readyFlags(s){return !!(s&&s.ok===true&&zeroFlag(s.idleState)&&['busy','errorCode','printerError','paperEnd','coverOpen'].every(function(k){return zeroFlag(s[k])}))}
function safeZIdle(s){return readyFlags(s)&&String(s.mode||'')==='Z'}
function safeRegIdle(s){return readyFlags(s)&&regMode(s)}
function regBlockReason(d){
 var s=d&&d.status||{};
 if(!d||!d.online)return 'PC cassa non collegato: nessun comando inviato.';
 if(s.busy===1||s.busy==='1')return 'La RCH risponde occupata (busy 1). La modalità non è verificabile finché il registratore non torna disponibile. Nessun cambio di modalità viene forzato.';
 if(!zeroFlag(s.paperEnd))return 'Stato carta non regolare o non disponibile: controlla la RCH.';
 if(!zeroFlag(s.coverOpen))return 'Coperchio aperto o stato non disponibile: controlla la RCH.';
 if(!zeroFlag(s.errorCode)||!zeroFlag(s.printerError))return s.error||'La RCH segnala un errore o una risposta incompleta.';
 if(!zeroFlag(s.idleState))return 'La RCH non conferma lo stato inattivo. Verifica il display e gli eventuali documenti aperti senza ripetere il pagamento.';
 if(!s.mode||s.ok!==true)return s.error||'Modalità RCH non confermata: aggiorna lo stato.';
 if(!manualRegWorkerReady(d))return 'Il collegamento del PC non supporta il ritorno manuale in REG: aggiorna il connettore sul PC cassa.';
 return 'Il ritorno manuale è consentito solo da Z, a registratore inattivo e senza errori.';
}
var manualRegPending=null;
'''
RESTORE = r'''async function restoreRegManual(){
 var d=await cloudConnection(),s=d.status||{};updateBadge(d);
 if(safeRegIdle(s)){manualRegPending=null;return {alreadyReg:true,status:s}}
 if(manualRegPending&&!manualRegPending.id){
   if(Date.now()-manualRegPending.at<125000)throw new Error('Invio precedente con esito non confermato. Attendi e aggiorna lo stato; il comando non viene duplicato.');
   manualRegPending=null;
 }
 if(!manualRegPending){
   if(!manualRegWorkerReady(d)||!safeZIdle(s))throw new Error(regBlockReason(d));
   manualRegPending={id:null,at:Date.now()};
   var q=await relay('queue_aux',{kind:'restore_reg'});
   if(!q.data||!q.data.id)throw new Error('Ricezione del comando non confermata. Aggiorna lo stato prima di riprovare.');
   manualRegPending.id=q.data.id;
 }
 var end=Date.now()+35000,done=null;
 while(Date.now()<end){
   var x=await relay('command_status',{command_id:manualRegPending.id}),c=x.data||{};
   if(c.state==='failed'||c.state==='expired'){manualRegPending=null;throw new Error(c.error||'Il PC non ha confermato il ritorno in REG.')}
   if(c.state==='completed'){done=c;break}
   await delay(900);
 }
 if(!done)throw new Error('Comando inviato al PC, esito ancora non confermato. Aggiorna lo stato: non viene inviato un secondo comando.');
 if(!done.result||done.result.ok!==true||!regMode(done.result))throw new Error('Il PC non ha restituito una conferma REG valida. Nessun esito viene simulato.');
 for(var i=0;i<8;i++){
   var after=await cloudConnection();updateBadge(after);
   if(safeRegIdle(after.status)){manualRegPending=null;return {alreadyReg:false,status:after.status}}
   await delay(1200);
 }
 throw new Error('Il comando è terminato ma manca uno stato REG pronto aggiornato. Usa Aggiorna stato, senza ripetere il pagamento.');
}
'''
RUN = r'''async function runManualRegClick(ev,b){
 if(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation()}
 if(manualRegBusy)return false;manualRegBusy=true;
 var oldText=b&&b.textContent;if(b){b.disabled=true;b.textContent='Verifica RCH…'}
 var m=modal('RCH · ritorno in REG');m.querySelector('.orcBody').textContent='Verifica dello stato reale e del collegamento al PC cassa…';
 try{
   var r=await restoreRegManual();
   m.querySelector('.orcBody').innerHTML='<p><b>'+(r.alreadyReg?'La RCH è già pronta in REG.':'La RCH ha confermato il ritorno in REG.')+'</b></p><p>Nessuno scontrino o chiusura giornaliera è stato eseguito da questo comando.</p>';
   msg(m,'Modalità rilevata: '+String(r.status.mode));
 }catch(e){
   m.querySelector('.orcBody').innerHTML='<p><b>Ritorno in REG non confermato.</b></p>';
   msg(m,(e&&e.message)||String(e));
 }finally{
   manualRegBusy=false;if(b&&b.isConnected){b.disabled=false;b.textContent=oldText||'Porta RCH in REG'}
   var refresh=document.createElement('button');refresh.type='button';refresh.id='orcRefreshStatus';refresh.textContent='Aggiorna stato';refresh.onclick=showCloudStatus;
   m.querySelector('.orcBody').appendChild(refresh);
   cloudConnection().then(updateBadge).catch(function(){updateBadge(null)});
 }
 return false;
}
'''
BADGE = r'''function updateBadge(d){
 var b=document.getElementById('optykerCashRch'),r=ensureRegButton();if(!b)return;
 var st=d&&d.status||{},ready=!!(d&&d.online&&safeRegIdle(st)),label;
 if(d&&d.online)label=ready?'● RCH · REG':(st.busy===1||st.busy==='1')?'○ RCH · occupata':('○ RCH · '+(st.mode||'stato non confermato'));
 else label='○ RCH · PC non collegato';
 if(b.textContent!==label)b.textContent=label;
 if(b.classList.contains('ok')!==ready)b.classList.toggle('ok',ready);
 if(b.classList.contains('error')===ready)b.classList.toggle('error',!ready);
 b.title=ready?'RCH pronta in REG · clicca per i dettagli':regBlockReason(d);
 if(r){r.disabled=manualRegBusy;r.dataset.rchAllowed=d&&d.online&&safeZIdle(st)?'1':'0';r.title='Verifica lo stato e richiedi il ritorno in REG, senza stampa o chiusura';}
}
'''
STATUS = r'''async function showCloudStatus(){
 var m=modal('RCH · stato reale del registratore'),body=m.querySelector('.orcBody');
 try{
   var x=await relay('status',{}),d=x.data||{},s=d.status||{};
   var ready=!!(d.online&&safeRegIdle(s)),can=!!(d.online&&safeZIdle(s)&&manualRegWorkerReady(d));
   var mode=s.mode||'Non verificabile',detail=ready?'La RCH è pronta per la registrazione.':can?'La RCH è in Z. Premi Porta RCH in REG per richiedere il cambio reale di modalità.':regBlockReason(d);
   body.innerHTML='<div class="optykerCashRchInfo"><div><span>PC cassa</span><b>'+ (d.online?'Collegato':'Non collegato')+'</b></div><div><span>Modalità RCH</span><b>'+esc(mode)+'</b></div><div><span>Stato occupata</span><b>'+esc(s.busy===undefined?'Non disponibile':String(s.busy))+'</b></div><div><span>Connettore</span><b>'+esc(d.connector_version||'Non disponibile')+'</b></div></div><p>'+esc(detail)+'</p><p><button type="button" class="primary" id="orcRestoreReg">Porta RCH in REG</button> <button type="button" id="orcRefreshStatus">Aggiorna stato</button></p><p>Questo comando non esegue la chiusura Z, non stampa scontrini e non ripete vendite.</p>';
   var rb=m.querySelector('#orcRestoreReg');rb.disabled=manualRegBusy||(!can&&!ready&&!manualRegPending);rb.onclick=function(ev){runManualRegClick(ev,rb)};
   m.querySelector('#orcRefreshStatus').onclick=showCloudStatus;
   msg(m,d.last_seen_at?'Ultimo contatto PC: '+new Date(d.last_seen_at).toLocaleString('it-IT'):'Nessun contatto PC disponibile');
   updateBadge(d);
 }catch(e){
   body.innerHTML='<p><b>Non è stato possibile verificare lo stato RCH.</b></p><button type="button" id="orcRefreshStatus">Riprova verifica</button>';
   m.querySelector('#orcRefreshStatus').onclick=showCloudStatus;msg(m,e.message||String(e));updateBadge(null);
 }
}
/* Capture before inherited onclick handlers: status must also open on Windows. */
if(!window.__OPTYKER_RCH_STATUS_CAPTURE_20260919__){
 window.__OPTYKER_RCH_STATUS_CAPTURE_20260919__=true;
 window.addEventListener('click',function(ev){
   var t=ev.target,b=t&&t.closest?t.closest('#optykerCashRch,#optykerRchRegBtn,#orcRestoreReg'):null;
   if(!b||b.disabled)return;
   ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
   if(b.id==='optykerCashRch')showCloudStatus();else runManualRegClick(null,b);
 },true);
}
'''


def replace_section(s, start, end, new):
    if s.count(start) != 1 or s.count(end) != 1:
        raise ValueError('RCH UI unexpected anchors: '+start)
    a=s.index(start); b=s.index(end,a)
    return s[:a]+new+s[b:]


def patch(source):
    if MARK in source:
        return source
    source=replace_section(source,'function modal(title){','function msg(',MODAL)
    source=replace_section(source,'function safeZIdle(s){','function manualRegWorkerReady(',SAFE)
    source=replace_section(source,'async function restoreRegManual(){','/* OPTYKER_RCH_REG_CLICK_FIX_V1 */',RESTORE)
    source=replace_section(source,'async function runManualRegClick(ev,b){','function ensureRegButton(',RUN)
    source=replace_section(source,'function updateBadge(d){',"if(!window.__OPTYKER_RCH_REG_CLICK_CAPTURE__)",BADGE)
    source=replace_section(source,'async function showCloudStatus(){','function installCashButtons(',STATUS)
    source=source.replace("'\"':'&quot'", "'\"':'&quot;'")
    return '/* '+MARK+' */\nwindow.OPTYKER_RCH_REG_UI_VERSION="'+VERSION+'";\n'+source


def main():
    root=Path('_site'); p=root/'rch-cloud-relay.js'
    before=p.read_text(encoding='utf-8'); after=patch(before)
    if patch(after)!=after:
        raise ValueError('RCH UI patch must be idempotent')
    # Existing payment/fiscal behavior remains byte-for-byte unchanged.
    a='function wrapFiscal()'; b='var observer=new MutationObserver'
    if before[before.index(a):before.index(b)]!=after[after.index(a):after.index(b)]:
        raise ValueError('Fiscal wrapper changed')
    for name in ('async function queueFiscal(', 'async function queueAux('):
        old=next(x for x in before.splitlines() if x.startswith(name))
        if old not in after: raise ValueError('Fiscal command route changed')
    for folder in (root,root/'gestionale-v2',root/'gestionale-v3'):
        folder.mkdir(exist_ok=True);(folder/'rch-cloud-relay.js').write_text(after,encoding='utf-8')
        html=folder/'index.html'
        if html.exists():
            text=html.read_text(encoding='utf-8')
            text=re.sub(r'(rch-cloud-relay\.js\?[^"\s<>]*)',lambda m:re.sub(r'&regui=[^&"\s<>]+','',m[1])+'&regui='+VERSION,text)
            html.write_text(text,encoding='utf-8')
    print('RCH status and manual REG UI verified:',VERSION,'(fiscal code unchanged)')


if __name__=='__main__': main()
