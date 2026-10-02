var oaForceChoiceRequest=0;
function forceChoiceLabel(r){return (r.operator_username||'Non assegnato · operatore facoltativo')+' · '+(r.studio_name||'Nessuno studio')}
function loadForceOverlap(){
  var ticket=++oaForceChoiceRequest;
  if(!M.item||!E('oaV10ForceOccupied').checked)return;
  var item=M.item.id,t=E('oaV10ForceTime').value,date=E('oaV10Date').value,service=E('oaV10Service').value,starts='';
  function current(){return ticket===oaForceChoiceRequest&&M.item?.id===item&&E('oaManageModal').classList.contains('open')&&E('oaV10ForceOccupied').checked&&E('oaV10ForceTime').value===t&&E('oaV10Date').value===date&&E('oaV10Service').value===service}
  M.forceRows=[];E('oaV10ForceChoice').innerHTML='<option value="">Verifica disponibilità…</option>';
  if(!date||!service||!t){msg('Inserisci data e orario da forzare.',true);return}
  try{starts=romeIso(date,t)}catch(e){msg(e.message,true);return}
  if(new Date(starts).getTime()<=Date.now()){msg('Seleziona un orario futuro.',true);return}
  msg('Verifico le opzioni di forzatura…');
  staffManage('force_overlap_slots',{service_id:service,starts_at:starts,ignore_appointment_id:item}).then(function(x){
    if(!current())return;
    M.forceRows=Array.isArray(x.data)?x.data:[];
    E('oaV10ForceChoice').innerHTML=M.forceRows.length?'<option value="">Scegli lo studio e, se vuoi, l’operatore</option>'+M.forceRows.map(function(r,i){return'<option value="'+i+'">'+X(forceChoiceLabel(r))+'</option>'}).join(''):'<option value="">Nessuno studio configurato per il servizio</option>';
    var same=M.forceRows.findIndex(function(r){return String(r.operator_username||'').toUpperCase()===String(M.item.operator_username||'').toUpperCase()&&String(r.studio_id||'')===String(M.item.studio_id||'')});
    if(same<0)same=M.forceRows.findIndex(function(r){return !r.operator_username&&String(r.studio_id||'')===String(M.item.studio_id||'')});
    if(same<0)same=M.forceRows.findIndex(function(r){return !r.operator_username});
    if(same>=0)E('oaV10ForceChoice').value=String(same);
    msg(M.forceRows.length?'Forzatura pronta. Puoi confermare anche senza operatore.':'Nessuno studio configurato per questo servizio.',!M.forceRows.length)
  }).catch(function(e){if(!current())return;M.forceRows=[];E('oaV10ForceChoice').innerHTML='<option value="">Forzatura non disponibile</option>';msg(e.message,true)})
}
