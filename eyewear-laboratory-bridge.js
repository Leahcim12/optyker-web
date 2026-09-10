/* Injected inside the existing V9+ closure; retains its validation and pricing. */
var ovcBaseEyewearApi=api;
api=function(action,data){
  var fingerprint=action==='save'?JSON.stringify(data):'';
  return ovcBaseEyewearApi(action,data).then(function(x){
    if(action==='save'&&x&&x.data&&x.data.id){
      S.ovcSaved={row:x.data,fingerprint:fingerprint};
      window.dispatchEvent(new CustomEvent('optyker:eyewear-saved'));
    }
    return x;
  });
};
window.optykerEyewearOrderBridge={
  busy:function(){return !!S.busy},
  latest:async function(row){
    var recent=await api('recent',{client_id:row.client_id});
    var current=(recent.data||[]).find(function(x){return x.id===row.id});
    if(!current)throw new Error('Busta non disponibile. Ricarica i documenti.');
    if(S.ovcSaved)S.ovcSaved.row=current;return current;
  },
  capture:function(){if(!validate())return null;return payload()},
  saved:function(data){
    var saved=S.ovcSaved;
    return saved&&saved.fingerprint===JSON.stringify(data)&&val('eyReference')===saved.row.reference_code?saved.row:null;
  },
  persist:async function(data){
    if(S.busy)throw new Error('Salvataggio Occhiali già in corso.');
    S.busy=true;
    try{
      var x=await api('save',data),row=x&&x.data;
      if(!row||!row.id)throw new Error('Busta non salvata.');
      if(E('eyReference'))E('eyReference').value=row.reference_code||'';
      // The v6 pricing layer may update the stored row after its initial insert.
      var recent=await api('recent',{client_id:row.client_id});
      var current=(recent.data||[]).find(function(r){return r.id===row.id});
      if(!current)throw new Error('Busta salvata: ricarica i documenti prima di inviarla.');
      if(S.ovcSaved)S.ovcSaved.row=current;
      return current;
    }finally{S.busy=false;}
  }
};
