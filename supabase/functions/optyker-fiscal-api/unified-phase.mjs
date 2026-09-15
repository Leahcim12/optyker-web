export function unifiedPhase(q,k,job){
 if(job?.state==='completed')return {phase:'completed',message:'Annullo RCH registrato. Gestione TS completata.'};
 if(job&&['sending','uncertain','awaiting_reference'].includes(job.state))return {phase:job.state==='sending'?'rch_working':'attention',message:job.state==='awaiting_reference'?'Annullo stampato: riferimento da verificare. Nessuna ristampa automatica.':'Esito RCH in verifica. Nessun nuovo annullo sarà inviato.'};
 if(!q||['awaiting_configuration','ts_cancelled'].includes(q.state))return {phase:'rch_ready',message:'TS verificato. In attesa della RCH.'};
 if(q.state==='accepted'){
  if(k&&(['rejected','checking','sending'].includes(k.state)||(k.state==='uncertain'&&!k.protocol)))return {phase:'attention',message:'Cancellazione TS da verificare. L’annullo RCH resta sospeso.'};
  return {phase:'ts_working',message:'Cancellazione della spesa TS e controllo del relativo esito.'};
 }
 if(['sending','submitted','uncertain'].includes(q.state))return {phase:'ts_working',message:'Verifica dell’invio TS originale, senza inviarlo nuovamente.'};
 return {phase:'attention',message:'Stato TS da verificare: '+q.state+'. Nessun annullo RCH avviato.'};
}

