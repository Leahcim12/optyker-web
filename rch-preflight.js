(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.OPTYKER_RCH_PREFLIGHT=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Snapshot of the shop's successful readback, not a fresh device check or emission driver.
  var profile={
    id:'ovc-rch-20260912',version:2,capturedAt:'2026-09-12T10:43:54.5221954+02:00',
    expectedSerial:'72IV6003831',identityVerifiedLive:false,
    readback:{identityMatched:true,configurationMatched:true,scope:'Configured shop departments 1-3 and payment labels/types 1-11',departmentCount:99,vatSlotCount:40,paymentCount:30,
      report:'Configurazione-RCH-20260912-104354-c265fd6d.json',
      reportSha256:'88c72b95c51638b5821fd02191643345e78fc6d1e0c7d55627cd5c0e1077216e'},
    transport:{ip:'192.168.1.10',legacyTcpPort:23,webservicePath:'/service.cgi',bridgePort:8765},
    sources:{payments:'RCH readback 12-09-2026, Service/Prg/Payment',departments:'RCH readback 12-09-2026, Service/Prg/Department; Focus codes confirmed',vatSlots:'RCH readback 12-09-2026, Service/Prg/VAT; nature N4 cross-checked with IMG_3593'},
    payments:[
      {code:1,label:'Contanti',key:'cash',creditType:0,changeAllowed:true},
      {code:2,label:'Non riscosso beni',key:'unpaid_goods',creditType:1,changeAllowed:false},
      {code:3,label:'Assegni',key:'cheque',creditType:0,changeAllowed:false},
      {code:4,label:'Carte elettroniche',key:'card',creditType:0,changeAllowed:false},
      {code:5,label:'Tickets',key:'ticket',creditType:0,changeAllowed:false},
      {code:6,label:'Non riscosso servizi',key:'unpaid_services',creditType:2,changeAllowed:false},
      {code:7,label:'Non riscosso fatture',key:'unpaid_invoice',creditType:3,changeAllowed:false},
      {code:8,label:'Non riscosso DCR SSN',key:'unpaid_ssn',creditType:4,changeAllowed:false},
      {code:9,label:'Sconto a pagare',key:'discount_due',creditType:0,changeAllowed:false},
      {code:10,label:'Buoni multiuso',key:'multipurpose_voucher',creditType:0,changeAllowed:false},
      {code:11,label:'Buoni celiachia',key:'celiac_voucher',creditType:0,changeAllowed:false}
    ],
    // Only the three departments already used by the shop are assigned to its VAT codes.
    // The remaining generic departments are not automatic fallbacks for exempt goods.
    departments:[
      {department:1,vatCode:'04',vatSlot:1,rate:4,nature:null,saleType:'goods',autoClose:false},
      {department:2,vatCode:'22',vatSlot:2,rate:22,nature:null,saleType:'goods',autoClose:false},
      {department:3,vatCode:'ART10',vatSlot:0,rate:0,nature:'N4',saleType:'services',autoClose:false}
    ],
    // VAT table indexes MUST NOT be used as department numbers.
    vatSlots:[{slot:0,nature:'N4'},{slot:1,rate:4},{slot:2,rate:22},{slot:3,rate:10},{slot:4,rate:5},{slot:8,nature:'N1'}],
    unmappedVatCodes:['10','05','ART15','NV'],
    readiness:{receipt:false,talkingReceipt:false,tsSubmission:false,adeOutcome:'unverified'}
  };
  function getProfile(){return JSON.parse(JSON.stringify(profile))}
  function toCents(value){
    if(typeof value!=='string'&&typeof value!=='number')return null;
    var text=String(value).trim();
    if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;
    var parts=text.split('.'),cents=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));
    return Number.isSafeInteger(cents)?cents:null;
  }
  function registrationMode(status){
    return !!status&&status.ok===true&&['busy','errorCode','printerError','paperEnd','coverOpen'].every(function(k){return status[k]===undefined||status[k]===0})&&/^REG(?:\s*\(OP\s*\d+\))?$/.test(String(status.mode||'').trim().toUpperCase());
  }
  function validate(input){
    input=input||{};
    var issues=[],rows=[],total=0,payment=null;
    function issue(code,message,line){var v={code:code,message:message};if(line!==undefined)v.line=line;issues.push(v)}
    if(!Array.isArray(input.lines)||!input.lines.length)issue('empty_cart','Il carrello è vuoto.');
    else if(input.lines.length>200)issue('too_many_lines','Il controllo accetta al massimo 200 righe.');
    else input.lines.forEach(function(line,index){
      line=line||{};
      var code=typeof line.vatCode==='string'?line.vatCode.trim().toUpperCase():'';
      var department=profile.departments.filter(function(d){return d.vatCode===code})[0];
      if(!department)issue('vat_unmapped','IVA da assegnare o reparto non verificato: '+(code||'codice mancante')+'.',index);
      var saleType=line.saleType;
      if(saleType!=='goods'&&saleType!=='services'){
        issue('sale_type_missing','Tipologia fiscale bene/servizio da assegnare alla riga.',index);
        department=null;
      }else if(department&&department.saleType!==saleType){
        issue('department_type_mismatch','Nessun reparto assegnato per questa combinazione di IVA e bene/servizio.',index);
        department=null;
      }
      var amount=line.unitPriceCents,quantity=line.quantity;
      var validAmount=Number.isSafeInteger(amount)&&amount>0&&amount<=100000000;
      var validQuantity=Number.isSafeInteger(quantity)&&quantity>0&&quantity<=10000;
      if(!validAmount)issue('invalid_amount','Prezzo richiesto in centesimi interi, maggiore di zero.',index);
      if(!validQuantity)issue('invalid_quantity','Quantità intera positiva richiesta per questo controllo.',index);
      if(validAmount&&validQuantity){total+=amount*quantity;if(!Number.isSafeInteger(total)||total>100000000)issue('total_limit','Totale oltre il limite del controllo.',index)}
      rows.push({line:index,description:String(line.description||'').slice(0,120),vatCode:code,saleType:saleType==='goods'||saleType==='services'?saleType:null,department:department?department.department:null,totalCents:validAmount&&validQuantity?amount*quantity:null});
    });
    if(input.paymentMethod==='cash')payment={code:1,label:'Contanti'};
    else if(input.paymentMethod==='card')payment={code:4,label:'Carte elettroniche'};
    else if(input.paymentMethod==='cheque')payment={code:3,label:'Assegni'};
    else issue('payment_unmapped',input.paymentMethod==='pending'?'Il non riscosso richiede una distinzione verificata tra beni, servizi e fatture.':'Metodo di pagamento senza codice RCH verificato.');
    if(input.stage!=='balance')issue('stage_unverified','Acconti e saldi collegati a documenti precedenti richiedono una gestione fiscale dedicata.');
    if(input.invoice===true)issue('invoice_flow','Le fatture seguono il flusso dedicato; non generare anche uno scontrino automaticamente.');
    var blockers=[
      {code:'rch_protocol',message:'Emissione RCH, codice fiscale e numero documento: protocollo e collaudo da completare.'},
      {code:'persistent_job',message:'Registro persistente dei tentativi e recupero degli esiti incerti da completare.'},
      {code:'device_identity',message:'Configurazione letta il 12/09/2026; identità, stato e assetto della cassa vanno ricontrollati al momento dell’emissione.'}
    ];
    if(input.talkingReceipt===true)blockers.push({code:'talking_receipt',message:'Scontrino parlante non attivo; il controllo non acquisisce né invia il codice fiscale.'});
    if(input.tsRequested===true)blockers.push({code:'ts_not_configured',message:'Accesso e trasmissione diretta Sistema TS non configurati.'});
    return {profileId:profile.id,checkedAt:new Date().toISOString(),readOnly:true,emittedFiscalDocument:false,tsSubmitted:false,
      dataValid:issues.length===0,canEmit:false,canSubmitTs:false,totalCents:total,payment:payment,lines:rows,issues:issues,blockers:blockers,
      note:'Controllo preliminare non fiscale. Non registra vendite, non invia comandi e non certifica la correttezza fiscale delle righe.'};
  }
  return Object.freeze({getProfile:getProfile,validate:validate,registrationMode:registrationMode,toCents:toCents});
});
