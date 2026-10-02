/* Shared by the authenticated desktop, app and staff website agendas. */
(function(){
  'use strict';
  window.optykerEditAppointmentDuration=function(appointment,save,onSaved){
    document.getElementById('optykerDurationDialog')?.remove();
    var opener=document.activeElement,dialog=document.createElement('dialog');
    dialog.id='optykerDurationDialog';
    dialog.setAttribute('aria-labelledby','optykerDurationTitle');
    dialog.style.cssText='border:1px solid #ccd6df;border-radius:16px;padding:24px;max-width:420px;width:calc(100% - 32px);color:#17324a;z-index:2147483647';
    dialog.innerHTML='<form><h2 id="optykerDurationTitle" style="margin:0 0 12px;font-size:22px">Durata appuntamento</h2><p data-summary></p><label for="optykerDurationMinutes">Durata in minuti</label><input id="optykerDurationMinutes" type="number" min="1" max="1440" step="1" required style="display:block;width:100%;padding:12px;margin:8px 0;font:inherit"><p data-end></p><p data-status role="status" aria-live="polite"></p><div style="display:flex;gap:12px;justify-content:flex-end"><button type="button" data-close style="padding:10px">Chiudi</button><button type="submit" style="padding:10px;background:#1769aa;color:white;border:0;border-radius:8px">Salva durata</button></div></form>';
    var input=dialog.querySelector('input'),status=dialog.querySelector('[data-status]'),button=dialog.querySelector('[type=submit]'),busy=false;
    var dt=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    input.value=String(Math.round((new Date(appointment.ends_at)-new Date(appointment.starts_at))/60000));
    dialog.querySelector('[data-summary]').textContent=[appointment.first_name,appointment.last_name].filter(Boolean).join(' ')+' · '+dt.format(new Date(appointment.starts_at));
    function preview(){var n=Number(input.value);dialog.querySelector('[data-end]').textContent=Number.isInteger(n)&&n>0&&n<=1440?'Fine appuntamento: '+dt.format(new Date(new Date(appointment.starts_at).getTime()+n*60000)):''}
    function close(){if(busy)return;dialog.close();dialog.remove();if(opener?.isConnected)opener.focus()}
    dialog.querySelector('[data-close]').onclick=close;
    dialog.addEventListener('cancel',function(e){e.preventDefault();close()});
    input.oninput=preview;
    dialog.querySelector('form').onsubmit=async function(e){
      e.preventDefault();if(busy||!input.reportValidity())return;
      busy=true;button.disabled=true;input.disabled=true;status.textContent='Salvataggio…';
      try{var result=await save({id:appointment.id,duration_minutes:Number(input.value),expected_updated_at:appointment.updated_at||null});
        if(!result||result.ok===false)throw Error(result?.error||'Salvataggio non riuscito.');
        busy=false;close();if(onSaved)await onSaved(result.data||result);
      }catch(error){busy=false;button.disabled=false;input.disabled=false;status.textContent=error.message||'Salvataggio non riuscito.'}
    };
    document.body.appendChild(dialog);preview();dialog.showModal();input.focus();input.select();
    return dialog;
  };
})();
