(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.OPTYKER_RCH_PREFLIGHT=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  // Evidence supplied by the shop. This is not a live readback or an emission driver.
  var profile={
    id:'ovc-rch-20260911',version:1,capturedAt:'2026-09-11',
    expectedSerial:'72IV6003831',identityVerifiedLive:false,
    transport:{ip:'192.168.1.10',legacyTcpPort:23,webservicePath:'/service.cgi',bridgePort:8765},
    sources:{payments:'RCH programming report 11-09-2026 09:42, IMG_3590/3591',departments:'Focus ECR configuration, Screenshot 2026-09-09 202531',vatSlots:'RCH programming report, IMG_3593'},
    payments:[
      {code:1,label:'Contanti',key:'cash'},
      {code:2,label:'Non riscosso beni',key:'unpaid_goods'},
      {code:3,label:'Assegni',key:'cheque'},
      {code:4,label:'Carte elettroniche',key:'card'},
      {code:5,label:'Tickets',key:'ticket'},
      {code:6,label:'Non riscosso servizi',key:'unpaid_services'},
      {code:7,label:'Non riscosso fatture',key:'unpaid_invoice'},
      {code:8,label:'Non riscosso DCR SSN',key:'unpaid_ssn'},
      {code:9,label:'Sconto a pagare',key:'discount_due'},
      {code:10,label:'Buoni multiuso',key:'multipurpose_voucher'},
      {code:11,label:'Buoni celiachia',key:'celiac_voucher'}
    ],
    departments:[
      {department:1,vatCode:'04',rate:4,nature:null},
      {department:2,vatCode:'22',rate:22,nature:null},
      {department:3,vatCode:'ART10',rate:0,nature:'N4'}
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
      var amount=line.unitPriceCents,quantity=line.quantity;
      var validAmount=Number.isSafeInteger(amount)&&amount>0&&amount<=100000000;
      var validQuantity=Number.isSafeInteger(quantity)&&quantity>0&&quantity<=10000;
      if(!validAmount)issue('invalid_amount','Prezzo richiesto in centesimi interi, maggiore di zero.',index);
      if(!validQuantity)issue('invalid_quantity','Quantità intera positiva richiesta per questo controllo.',index);
      if(validAmount&&validQuantity){total+=amount*quantity;if(!Number.isSafeInteger(total)||total>100000000)issue('total_limit','Totale oltre il limite del controllo.',index)}
      rows.push({line:index,description:String(line.description||'').slice(0,120),vatCode:code,department:department?department.department:null,totalCents:validAmount&&validQuantity?amount*quantity:null});
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
      {code:'device_identity',message:'Identità del registratore e reparti da verificare direttamente prima dell’emissione.'}
    ];
    if(input.talkingReceipt===true)blockers.push({code:'talking_receipt',message:'Scontrino parlante non attivo; il controllo non acquisisce né invia il codice fiscale.'});
    if(input.tsRequested===true)blockers.push({code:'ts_not_configured',message:'Accesso e trasmissione diretta Sistema TS non configurati.'});
    return {profileId:profile.id,checkedAt:new Date().toISOString(),readOnly:true,emittedFiscalDocument:false,tsSubmitted:false,
      dataValid:issues.length===0,canEmit:false,canSubmitTs:false,totalCents:total,payment:payment,lines:rows,issues:issues,blockers:blockers,
      note:'Controllo preliminare non fiscale. Non registra vendite, non invia comandi e non certifica la correttezza fiscale delle righe.'};
  }
  return Object.freeze({getProfile:getProfile,validate:validate,registrationMode:registrationMode,toCents:toCents});
});
