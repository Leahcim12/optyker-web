/* Optyker · Ufficio · 20261013-office1
 * Operatori: voce "Ufficio" nella barra laterale con fatturato personale e cedolini.
 * Amministrazione: voce "Ufficio" con l'elenco degli account, il fatturato di ciascuno e il caricamento dei cedolini.
 * Dati: RPC optyker_office_api (stesse credenziali delle altre API Optyker). */
(function(){
  'use strict';
  if(window.__OPTYKER_OFFICE_20261013__)return;
  window.__OPTYKER_OFFICE_20261013__=true;
  var VERSION='20261013-office1';
  var ROOT='https://whgziwaegjzqsgcntesr.supabase.co';
  var KEY='sb_publishable_DndhLvY32YeCmqWMNRi30g_dEDm8upv';
  var ADMIN_USER='Ottica Visual Care';
  var MAX_UPLOAD=5*1024*1024;
  var MONTHS=['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  var SHORT=['','Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function num(v){var n=Number(v);return isFinite(n)?n:0}
  function euro(v){try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(num(v))}catch(e){return num(v).toFixed(2).replace('.',',')+' €'}}
  function euroFit(v){v=num(v);if(Math.abs(v)<10000)return euro(v);try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)}catch(e){return Math.round(v)+' €'}}
  function compact(v){v=num(v);if(!v)return '';if(Math.abs(v)>=1000)return (Math.round(v/100)/10).toString().replace('.',',')+'k';return String(Math.round(v))}
  function bytes(v){v=num(v);if(v>=1048576)return (v/1048576).toFixed(1).replace('.',',')+' MB';if(v>=1024)return Math.round(v/1024)+' KB';return v+' B'}
  function fmtDate(v){try{return new Date(v).toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'})}catch(e){return ''}}
  function initials(n){var p=String(n||'').trim().split(/\s+/).filter(Boolean);return ((p[0]||'?').charAt(0)+(p.length>1?p[p.length-1].charAt(0):'')).toUpperCase()}
  function firstName(n){var s=String(n||'').trim().split(/\s+/)[0]||'';return s?s.charAt(0).toUpperCase()+s.slice(1).toLowerCase():''}
  function cloud(){return window.OPTYKER_CLOUD||{}}
  function romeToday(){try{var p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit'}).formatToParts(new Date()),v={};p.forEach(function(x){v[x.type]=x.value});return {year:Number(v.year),month:Number(v.month)}}catch(e){var d=new Date();return {year:d.getFullYear(),month:d.getMonth()+1}}}
  function isAdminMode(){return !!window.OPTYKER_BILLING_ADMIN}

  function toast(msg,type){
    var t=E('oofToast');if(!t){t=document.createElement('div');t.id='oofToast';t.className='oofToast';t.setAttribute('role','status');document.body.appendChild(t)}
    t.className='oofToast '+(type||'');t.textContent=msg;t.style.display='block';clearTimeout(t.__h);t.__h=setTimeout(function(){t.style.display='none'},4200)
  }

  function api(action,payload,creds){
    var c=cloud(),u=creds?creds.u:String(c.username||'').trim(),p=creds?creds.p:String(c.password||'');
    if(!u||!p){var err=new Error('Sessione non disponibile: esci e accedi di nuovo.');err.auth=true;return Promise.reject(err)}
    var root=c.root||ROOT,key=c.key||KEY;
    return fetch(root+'/rest/v1/rpc/optyker_office_api',{
      method:'POST',
      headers:{'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+key},
      body:JSON.stringify({p_username:u,p_password:p,p_action:action,p_payload:payload||{}})
    }).then(function(r){
      return r.json().catch(function(){return null}).then(function(x){
        if(!r.ok)throw new Error((x&&(x.message||x.error))||('Server '+r.status));
        if(!x||x.ok!==true){var e=new Error((x&&x.error)||'Operazione non riuscita');if(x&&x.auth===false)e.auth=true;throw e}
        return x.data
      })
    })
  }

  /* ---------- File dei cedolini ---------- */
  function blobFromBase64(b64,mime){
    var bin=atob(String(b64||'').replace(/\s+/g,'')),len=bin.length,arr=new Uint8Array(len);
    for(var i=0;i<len;i++)arr[i]=bin.charCodeAt(i);
    return new Blob([arr],{type:mime||'application/octet-stream'})
  }
  function openPayslip(id,mode,creds,button){
    var win=null,old=button?button.textContent:'';
    if(mode!=='download'){try{win=window.open('','_blank')}catch(e){win=null}}
    if(win){try{win.document.write('<!doctype html><title>Cedolino</title><p style="font:14px system-ui;padding:24px;color:#555">Apertura del cedolino…</p>')}catch(e){}}
    if(button){button.disabled=true;button.textContent='…'}
    return api('payslip_file',{id:id},creds).then(function(f){
      var blob=blobFromBase64(f.data_base64,f.mime_type),url=URL.createObjectURL(blob);
      setTimeout(function(){try{URL.revokeObjectURL(url)}catch(e){}},120000);
      if(win&&!win.closed){win.location.href=url;return}
      var a=document.createElement('a');a.href=url;a.download=f.file_name||'cedolino';a.rel='noopener';document.body.appendChild(a);a.click();a.remove()
    }).catch(function(e){if(win&&!win.closed)try{win.close()}catch(z){}toast('Cedolino non disponibile: '+e.message,'error')}).finally(function(){if(button){button.disabled=false;button.textContent=old}})
  }
  function slipsHtml(list,admin){
    if(!Array.isArray(list)||!list.length){
      return '<div class="oofEmpty">'+(admin?'Nessun cedolino caricato per questo account.':'Nessun cedolino disponibile. I cedolini vengono caricati dall’Amministrazione e compaiono qui appena pronti.')+'</div>'
    }
    var h='',year=null;
    list.forEach(function(s){
      if(s.year!==year){year=s.year;h+='<div class="oofYear">'+esc(year)+'</div>'}
      var img=/^image\//.test(s.mime_type||'');
      h+='<div class="oofSlip"><div class="oofSlipIcon'+(img?' img':'')+'">'+(img?'IMG':'PDF')+'</div>'+
        '<div class="oofSlipMain"><b>'+esc(MONTHS[s.month]||'')+' '+esc(s.year)+'</b><small>'+esc(s.title||'Cedolino')+' · '+esc(s.file_name||'')+' · '+esc(bytes(s.size_bytes))+(s.created_at?' · caricato il '+esc(fmtDate(s.created_at)):'')+'</small></div>'+
        '<div class="oofSlipActions"><button type="button" class="oofBtn small primary" data-oof-open="'+esc(s.id)+'">Apri</button><button type="button" class="oofBtn small" data-oof-download="'+esc(s.id)+'">Scarica</button>'+(admin?'<button type="button" class="oofBtn small danger" data-oof-remove="'+esc(s.id)+'" data-oof-label="'+esc((MONTHS[s.month]||'')+' '+s.year)+'">Rimuovi</button>':'')+'</div></div>'
    });
    return h
  }

  /* ---------- Fatturato personale (componente condiviso) ---------- */
  function monthsOf(rev){var a=(rev&&Array.isArray(rev.months))?rev.months:[],out=[];for(var m=1;m<=12;m++){var x=a[m-1]||{};out.push({month:m,total:num(x.total),eyewear_total:num(x.eyewear_total),eyewear_count:num(x.eyewear_count),lac_total:num(x.lac_total),lac_count:num(x.lac_count),products_total:num(x.products_total),services_total:num(x.services_total)})}return out}
  function revenueHtml(data,prefix){
    var rev=data.revenue||{},year=Number(data.year),today=data.today||romeToday(),months=monthsOf(rev),tot=rev.totals||{},isCurrent=year===today.year;
    var kpis='';
    if(isCurrent){
      var cur=months[today.month-1].total,prev=today.month>1?months[today.month-2].total:num(rev.previous_december_total);
      kpis+='<div class="oofKpi main"><span>Fatturato · '+esc(MONTHS[today.month])+' '+esc(year)+'</span><b>'+esc(euroFit(cur))+'</b><small>Mese in corso · aggiornato a oggi</small></div>';
      kpis+='<div class="oofKpi"><span>Mese scorso · '+esc(MONTHS[today.month>1?today.month-1:12])+'</span><b>'+esc(euroFit(prev))+'</b><small>'+(today.month>1?'Stesso anno':'Dicembre '+(year-1))+'</small></div>';
      kpis+='<div class="oofKpi"><span>Da inizio anno</span><b>'+esc(euroFit(tot.total))+'</b><small>Media '+esc(euroFit(num(tot.total)/today.month))+' al mese</small></div>';
    }else{
      var best=months.reduce(function(b,x){return x.total>b.total?x:b},{total:0,month:0}),active=months.filter(function(x){return x.total>0}).length;
      kpis+='<div class="oofKpi main"><span>Totale '+esc(year)+'</span><b>'+esc(euroFit(tot.total))+'</b><small>'+(year>today.year?'Anno futuro':'Anno concluso')+'</small></div>';
      kpis+='<div class="oofKpi"><span>Mese migliore</span><b>'+esc(best.month?euroFit(best.total):'—')+'</b><small>'+esc(best.month?MONTHS[best.month]:'Nessun dato')+'</small></div>';
      kpis+='<div class="oofKpi"><span>Media mensile</span><b>'+esc(euroFit(num(tot.total)/12))+'</b><small>'+active+' mesi con vendite</small></div>';
    }
    kpis+='<div class="oofKpi"><span>Buste registrate</span><b>'+esc(num(tot.eyewear_count)+num(tot.lac_count))+'</b><small>'+esc(num(tot.eyewear_count))+' occhiali · '+esc(num(tot.lac_count))+' LAC</small></div>';
    var max=months.reduce(function(m,x){return Math.max(m,x.total)},0),bars='';
    months.forEach(function(x){
      var future=year>today.year||(isCurrent&&x.month>today.month),pct=max?Math.max(2,Math.round(x.total/max*100)):2;
      var cls='oofBar'+(x.total>0?' has':'')+(isCurrent&&x.month===today.month?' current':'')+(future?' future':'');
      bars+='<button type="button" class="'+cls+'" data-oof-month="'+x.month+'" aria-label="'+esc(MONTHS[x.month]+': '+euro(x.total))+'"><span class="val">'+esc(compact(x.total))+'</span><span class="col" style="height:'+(future?2:pct)+'%"></span><span class="lab">'+esc(SHORT[x.month])+'</span></button>'
    });
    var parts=[{k:'eyewear',l:'Occhiali',v:num(tot.eyewear_total),s:num(tot.eyewear_count)+' buste'},{k:'lac',l:'Lenti a contatto',v:num(tot.lac_total),s:num(tot.lac_count)+' buste'},{k:'products',l:'Prodotti in cassa',v:num(tot.products_total),s:'Vendite al banco'},{k:'services',l:'Servizi',v:num(tot.services_total),s:'Controlli e servizi'}];
    var ptot=parts.reduce(function(s,x){return s+x.v},0),split='';
    parts.forEach(function(x){split+='<li class="'+x.k+'"><span>'+esc(x.l)+'</span><b>'+esc(euro(x.v))+'</b><small>'+esc(x.s)+(ptot?' · '+Math.round(x.v/ptot*100)+'%':'')+'</small><i><em style="width:'+(ptot?Math.round(x.v/ptot*100):0)+'%"></em></i></li>'});
    return '<div class="oofKpis">'+kpis+'</div>'+
      '<div class="oofGrid"><section class="oofCard"><div class="oofCardHead"><h2>Fatturato mese per mese</h2><span>'+esc(year)+'</span></div><div class="oofBars" id="'+prefix+'Bars">'+bars+'</div><div class="oofBarInfo" id="'+prefix+'BarInfo">Tocca un mese per vedere il dettaglio.</div></section>'+
      '<section class="oofCard"><div class="oofCardHead"><h2>Di cosa è fatto</h2><span>'+esc(year)+'</span></div><ul class="oofSplit">'+split+'</ul></section></div>'
  }
  function bindBars(prefix,data){
    var box=E(prefix+'Bars'),info=E(prefix+'BarInfo');if(!box||!info)return;var months=monthsOf(data.revenue);
    box.querySelectorAll('[data-oof-month]').forEach(function(b){b.onclick=function(){
      box.querySelectorAll('.oofBar.sel').forEach(function(x){x.classList.remove('sel')});b.classList.add('sel');
      var x=months[Number(b.getAttribute('data-oof-month'))-1],bits=[];
      if(x.eyewear_count)bits.push(x.eyewear_count+' buste occhiali '+euro(x.eyewear_total));
      if(x.lac_count)bits.push(x.lac_count+' buste LAC '+euro(x.lac_total));
      if(x.products_total)bits.push('prodotti '+euro(x.products_total));
      if(x.services_total)bits.push('servizi '+euro(x.services_total));
      info.innerHTML='<b>'+esc(MONTHS[x.month]+' '+data.year)+': '+esc(euro(x.total))+'</b>'+(bits.length?' · '+esc(bits.join(' · ')):' · nessuna vendita registrata')
    }})
  }
  function yearOptions(sel){var t=romeToday(),h='';for(var y=t.year;y>=2023;y--)h+='<option value="'+y+'"'+(y===sel?' selected':'')+'>'+y+'</option>';return h}
  var NOTE='<p class="oofNote">Come si calcola: buste occhiali e LAC registrate a tuo nome come operatore, più prodotti e servizi che hai venduto in cassa. Importi IVA inclusa.</p>';

  /* ---------- Operatore: sezione Ufficio ---------- */
  var S={open:false,year:0,data:null,busy:false,guard:false,seq:0};
  function ensureNav(){
    var nav=E('moduleNav');if(!nav)return null;
    var b=E('navOffice');
    if(!b){
      b=document.createElement('button');b.id='navOffice';b.type='button';b.className='moduleBtn';b.setAttribute('data-short','Ufficio');b.title='Ufficio · fatturato personale e cedolini';
      b.innerHTML='<span class="winNavIcon" aria-hidden="true">▣</span><span>Ufficio</span>';
      b.addEventListener('click',function(ev){ev.preventDefault();openOffice()});
    }
    if(b.parentNode!==nav){var st=E('navSettings');if(st&&st.parentNode===nav)nav.insertBefore(b,st);else nav.appendChild(b)}
    return b
  }
  function ensurePanel(){
    var p=E('optykerOfficePanel');if(p)return p;
    var app=E('mainApp');if(!app)return null;
    p=document.createElement('div');p.id='optykerOfficePanel';p.className='panel optykerOfficePanel';p.style.setProperty('display','none','important');
    p.innerHTML='<div class="oof" id="oofStaff"></div>';
    var anchor=E('dashboardPanel');if(anchor&&anchor.parentNode===app)app.insertBefore(p,anchor.nextSibling);else app.appendChild(p);
    observeRoots();
    return p
  }
  function rootVisible(el){if(!el||el.id==='optykerOfficePanel')return false;if(!(el.classList.contains('panel')||el.id==='dashboardPanel'))return false;try{return getComputedStyle(el).display!=='none'}catch(e){return false}}
  function otherRootVisible(){var app=E('mainApp');if(!app)return false;for(var i=0;i<app.children.length;i++)if(rootVisible(app.children[i]))return true;return false}
  function hideOthers(){
    var app=E('mainApp');if(!app)return;
    Array.prototype.forEach.call(app.children,function(ch){if(ch.id==='optykerOfficePanel')return;if(ch.classList.contains('panel')||ch.id==='dashboardPanel'||ch.id==='reportSectionTop'||ch.id==='currentClientBanner')ch.style.setProperty('display','none','important')});
    var tabs=E('analysisTabs');if(tabs)tabs.style.setProperty('display','none','important')
  }
  /* La voce attiva delle altre sezioni è gestita da altri script (che la ripristinano se cambia classe):
     mentre l'Ufficio è aperto la si mostra con l'aspetto di una voce normale, senza toccarne le classi. */
  function calmOtherActive(){
    var b=E('navOffice');if(!b)return;
    var was=b.classList.contains('active');if(was)b.classList.remove('active');
    var c=getComputedStyle(b),sel='html body.oofOfficeOpen #mainApp#mainApp#mainApp #moduleNav .moduleBtn.active:not(#navOffice)',css=sel+'{background:'+c.backgroundColor+'!important;color:'+c.color+'!important;box-shadow:'+c.boxShadow+'!important;font-weight:'+c.fontWeight+'!important;border-color:'+c.borderTopColor+'!important}'+sel+'::before{display:none!important}';
    if(was)b.classList.add('active');
    var st=E('oofActiveCalm');if(!st){st=document.createElement('style');st.id='oofActiveCalm';document.head.appendChild(st)}
    if(st.textContent!==css)st.textContent=css
  }
  function markActive(){if(!S.open)return;var b=E('navOffice');if(b&&!b.classList.contains('active'))b.classList.add('active');document.body.classList.add('oofOfficeOpen')}
  function openOffice(){
    if(isAdminMode())return;
    var p=ensurePanel();if(!p)return;
    S.guard=true;
    try{calmOtherActive();hideOthers();p.style.setProperty('display','block','important');S.open=true;markActive()}finally{S.guard=false}
    try{window.scrollTo(0,0)}catch(e){}
    if(!S.year)S.year=romeToday().year;
    loadStaff()
  }
  function closeOffice(){
    if(!S.open)return;S.open=false;
    var p=E('optykerOfficePanel');if(p)p.style.setProperty('display','none','important');
    var b=E('navOffice');if(b)b.classList.remove('active');
    document.body.classList.remove('oofOfficeOpen')
  }
  var observer=null;
  function observeRoots(){
    var app=E('mainApp');if(!app||typeof MutationObserver!=='function')return;
    if(!observer){observer=new MutationObserver(function(){if(S.open&&!S.guard&&otherRootVisible())closeOffice()})}
    observer.disconnect();
    observer.observe(app,{childList:true});
    Array.prototype.forEach.call(app.children,function(ch){if(ch.id!=='optykerOfficePanel')observer.observe(ch,{attributes:true,attributeFilter:['style','class']})})
  }
  function renderStaff(){
    var root=E('oofStaff');if(!root)return;var d=S.data;
    var name=d&&d.profile?(d.profile.display_name||d.profile.username):String(cloud().username||'');
    var head='<div class="oofHead"><div class="oofWho">'+avatarHtml(d&&d.profile,name,true)+'<div><div class="oofEyebrow">Ottica Visual Care · Ufficio</div><h1 class="oofTitle">Ciao '+esc(firstName(name)||'')+'</h1><div class="oofSub">Il tuo fatturato personale e i tuoi cedolini.</div></div></div>'+
      '<div class="oofTools"><label class="oofField"><span>Anno</span><select id="oofStaffYear">'+yearOptions(S.year)+'</select></label><button type="button" class="oofBtn" id="oofStaffReload">Aggiorna</button></div></div>';
    if(S.error){root.innerHTML=head+'<div class="oofError">'+esc(S.error)+'</div>';bindStaffHead();return}
    if(!d){root.innerHTML=head+'<div class="oofLoading">Caricamento dell’Ufficio…</div>';bindStaffHead();return}
    root.innerHTML=head+revenueHtml(d,'oofStaff')+
      '<section class="oofCard"><div class="oofCardHead"><h2>I miei cedolini</h2><span>'+esc((d.payslips||[]).length)+' document'+((d.payslips||[]).length===1?'o':'i')+'</span></div><div class="oofSlips">'+slipsHtml(d.payslips,false)+'</div></section>'+NOTE;
    bindStaffHead();bindBars('oofStaff',d);
    root.querySelectorAll('[data-oof-open]').forEach(function(b){b.onclick=function(){openPayslip(b.getAttribute('data-oof-open'),'open',null,b)}});
    root.querySelectorAll('[data-oof-download]').forEach(function(b){b.onclick=function(){openPayslip(b.getAttribute('data-oof-download'),'download',null,b)}})
  }
  function bindStaffHead(){
    var y=E('oofStaffYear');if(y)y.onchange=function(){S.year=Number(this.value);S.data=null;loadStaff()};
    var r=E('oofStaffReload');if(r)r.onclick=function(){loadStaff()}
  }
  function loadStaff(){
    var seq=++S.seq;S.error='';if(!S.data||S.data.year!==S.year)S.data=null;renderStaff();
    api('me',{year:S.year}).then(function(d){if(seq!==S.seq)return;S.data=d;S.error='';renderStaff()}).catch(function(e){if(seq!==S.seq)return;S.error=e.auth?'Sessione scaduta: esci e accedi di nuovo per aprire l’Ufficio.':('Ufficio non disponibile: '+e.message);renderStaff()})
  }
  function avatarHtml(profile,name,big){var photo=profile&&profile.photo;return '<div class="oofAvatar'+(big?' big':'')+'">'+(photo?'<img src="'+esc(photo)+'" alt="">':esc(initials(name)))+'</div>'}

  /* ---------- Amministrazione: sezione Ufficio ---------- */
  var A={active:false,view:'list',year:0,month:0,username:'',list:null,detail:null,error:'',seq:0,uploadMonth:0,uploadYear:0};
  function adminCreds(){var c=cloud(),u=String(c.username||'').trim(),p=String(c.password||'');return u.toUpperCase()===ADMIN_USER.toUpperCase()&&p?{u:u,p:p}:null}
  function ensureAdminNav(){
    var g=E('optykerBillingNavGroup');if(!g)return;
    var b=E('optykerOfficeAdminNav');
    if(!b){b=document.createElement('button');b.id='optykerOfficeAdminNav';b.type='button';b.className='moduleBtn';b.textContent='Ufficio';b.title='Ufficio · account, fatturato personale e cedolini';b.addEventListener('click',function(ev){ev.preventDefault();openAdmin()})}
    var before=E('optykerBillingSettingsNav');
    if(b.parentNode!==g){if(before&&before.parentNode===g)g.insertBefore(b,before);else g.appendChild(b)}
  }
  function ensureAdminPanel(){
    var p=E('optykerOfficeAdminPanel');if(p)return p;
    var billing=E('optykerBillingPanel');if(!billing||!billing.parentNode)return null;
    p=document.createElement('div');p.id='optykerOfficeAdminPanel';p.className='panel optykerOfficeAdminPanel';p.style.setProperty('display','none','important');
    p.innerHTML='<div class="oof oofAdmin" id="oofAdmin"></div>';
    billing.parentNode.insertBefore(p,billing.nextSibling);return p
  }
  function hideAdminOthers(){
    document.querySelectorAll('.panel').forEach(function(x){if(x.id!=='optykerOfficeAdminPanel')x.style.setProperty('display','none','important')});
    ['dashboardPanel','reportSectionTop','analysisTabs'].forEach(function(id){var x=E(id);if(x)x.style.setProperty('display','none','important')})
  }
  function openAdmin(){
    var p=ensureAdminPanel();if(!p)return;
    window.OPTYKER_ADMIN_CASH_ACTIVE=false;document.body.classList.remove('optykerAdminCashMode');
    hideAdminOthers();p.style.setProperty('display','block','important');A.active=true;
    document.querySelectorAll('#optykerBillingNavGroup button').forEach(function(b){b.classList.remove('active')});
    var n=E('optykerOfficeAdminNav');if(n)n.classList.add('active');
    try{window.scrollTo(0,0)}catch(e){}
    var t=romeToday();if(!A.year)A.year=t.year;if(!A.month)A.month=t.month;
    A.view='list';A.username='';A.detail=null;loadAccounts()
  }
  function closeAdmin(){
    if(!A.active)return;A.active=false;var n=E('optykerOfficeAdminNav');if(n)n.classList.remove('active');
    var p=E('optykerOfficeAdminPanel');if(p)p.style.setProperty('display','none','important')
  }
  function adminHead(title,sub,tools){return '<div class="oofHead"><div><div class="oofEyebrow">Optyker · Amministrazione</div><h2 class="oofTitle">'+title+'</h2><div class="oofSub">'+sub+'</div></div><div class="oofTools">'+(tools||'')+'</div></div>'}
  function unlockHtml(){
    return adminHead('Ufficio','Account del personale, fatturato personale e cedolini.')+
      '<section class="oofCard"><div class="oofUnlock"><div class="oofCardHead"><h2>Conferma la password di Amministrazione</h2></div><div class="oofHint">Dopo un aggiornamento della pagina la password non resta in memoria: inseriscila di nuovo per aprire l’Ufficio.</div><label class="oofField"><span>Password</span><input id="oofUnlockPw" type="password" autocomplete="current-password"></label><div><button type="button" class="oofBtn primary" id="oofUnlockGo">Apri l’Ufficio</button></div><div id="oofUnlockErr" class="oofHint" style="color:#a12b3d"></div></div></section>'
  }
  function bindUnlock(){
    var go=E('oofUnlockGo'),pw=E('oofUnlockPw');if(!go||!pw)return;
    function submit(){
      var v=pw.value||'';if(v.length<8){E('oofUnlockErr').textContent='La password deve avere almeno 8 caratteri.';return}
      go.disabled=true;go.textContent='Verifica…';
      api('accounts',{year:A.year,month:A.month},{u:ADMIN_USER,p:v}).then(function(d){
        if(window.OPTYKER_CLOUD){OPTYKER_CLOUD.username=ADMIN_USER;OPTYKER_CLOUD.password=v}
        A.list=d;A.error='';renderAdmin()
      }).catch(function(e){E('oofUnlockErr').textContent=e.message;go.disabled=false;go.textContent='Apri l’Ufficio'})
    }
    go.onclick=submit;pw.onkeydown=function(ev){if(ev.key==='Enter'){ev.preventDefault();submit()}};setTimeout(function(){try{pw.focus()}catch(e){}},0)
  }
  function monthOptions(sel){var h='';for(var m=1;m<=12;m++)h+='<option value="'+m+'"'+(m===sel?' selected':'')+'>'+MONTHS[m]+'</option>';return h}
  function renderAdmin(){
    var root=E('oofAdmin');if(!root||!A.active)return;
    if(!adminCreds()){root.innerHTML=unlockHtml();bindUnlock();return}
    if(A.view==='detail')return renderDetail(root);
    var tools='<label class="oofField"><span>Anno</span><select id="oofAdmYear">'+yearOptions(A.year)+'</select></label><label class="oofField"><span>Mese</span><select id="oofAdmMonth">'+monthOptions(A.month)+'</select></label><button type="button" class="oofBtn" id="oofAdmReload">Aggiorna</button>';
    var h=adminHead('Ufficio','Tutti gli account: tocca una persona per vedere il suo fatturato e caricare i cedolini.',tools);
    if(A.error)h+='<div class="oofError">'+esc(A.error)+'</div>';
    if(!A.list)h+='<div class="oofLoading">Caricamento account…</div>';
    else{
      var acc=Array.isArray(A.list.accounts)?A.list.accounts:[];
      h+='<div class="oofAccounts">'+(acc.length?acc.map(function(a){
        var name=a.display_name||a.username,last=a.last_payslip?(SHORT[a.last_payslip.month]+' '+a.last_payslip.year):'';
        return '<button type="button" class="oofAccount" data-oof-account="'+esc(a.username)+'"><div class="oofWho">'+avatarHtml(a,name)+'<div style="min-width:0"><b>'+esc(name)+'</b><small>'+esc(a.email||'Account Optyker')+'</small></div></div>'+
          '<div class="oofAccountNums"><div><span>'+esc(MONTHS[A.month])+'</span><b>'+esc(euroFit(a.month_total))+'</b></div><div><span>Anno '+esc(A.year)+'</span><b>'+esc(euroFit(a.year_total))+'</b></div></div>'+
          '<div class="oofAccountFoot"><span class="oofPill'+(num(a.payslips_count)?' ok':'')+'">'+esc(num(a.payslips_count))+' cedolin'+(num(a.payslips_count)===1?'o':'i')+'</span><span>'+(last?'Ultimo: '+esc(last):'Nessun cedolino')+'</span></div></button>'
      }).join(''):'<div class="oofEmpty">Nessun account trovato.</div>')+'</div>';
    }
    root.innerHTML=h;
    E('oofAdmYear').onchange=function(){A.year=Number(this.value);loadAccounts()};
    E('oofAdmMonth').onchange=function(){A.month=Number(this.value);loadAccounts()};
    E('oofAdmReload').onclick=loadAccounts;
    root.querySelectorAll('[data-oof-account]').forEach(function(b){b.onclick=function(){openAccount(b.getAttribute('data-oof-account'))}})
  }
  function loadAccounts(){
    var seq=++A.seq;A.error='';A.list=null;renderAdmin();if(!adminCreds())return;
    api('accounts',{year:A.year,month:A.month},adminCreds()).then(function(d){if(seq!==A.seq)return;A.list=d;renderAdmin()}).catch(function(e){if(seq!==A.seq)return;if(e.auth){if(window.OPTYKER_CLOUD)OPTYKER_CLOUD.password='';renderAdmin();return}A.error='Account non disponibili: '+e.message;A.list={accounts:[]};renderAdmin()})
  }
  function openAccount(username){
    A.view='detail';A.username=username;A.detail=null;A.error='';
    var t=romeToday();A.uploadMonth=t.month>1?t.month-1:12;A.uploadYear=t.month>1?t.year:t.year-1;
    loadDetail()
  }
  function loadDetail(){
    var seq=++A.seq;A.detail=null;renderAdmin();if(!adminCreds())return;
    api('account',{username:A.username,year:A.year},adminCreds()).then(function(d){if(seq!==A.seq)return;A.detail=d;A.error='';renderAdmin()}).catch(function(e){if(seq!==A.seq)return;if(e.auth){if(window.OPTYKER_CLOUD)OPTYKER_CLOUD.password='';renderAdmin();return}A.error='Account non disponibile: '+e.message;A.detail={failed:true};renderAdmin()})
  }
  function renderDetail(root){
    var d=A.detail,name=d&&d.profile?(d.profile.display_name||d.profile.username):A.username;
    var tools='<label class="oofField"><span>Anno</span><select id="oofDetYear">'+yearOptions(A.year)+'</select></label><button type="button" class="oofBtn" id="oofDetReload">Aggiorna</button>';
    var h='<button type="button" class="oofBack" id="oofBack">← Tutti gli account</button>'+
      '<div class="oofHead"><div class="oofWho">'+avatarHtml(d&&d.profile,name,true)+'<div><div class="oofEyebrow">Optyker · Amministrazione · Ufficio</div><h2 class="oofTitle">'+esc(name)+'</h2><div class="oofSub">'+esc((d&&d.profile&&d.profile.email)||'Fatturato personale e cedolini')+'</div></div></div><div class="oofTools">'+tools+'</div></div>';
    if(A.error)h+='<div class="oofError">'+esc(A.error)+'</div>';
    if(!d){root.innerHTML=h+'<div class="oofLoading">Caricamento…</div>';bindDetailHead();return}
    if(d.failed){root.innerHTML=h;bindDetailHead();return}
    var slips=d.payslips||[];
    h+=revenueHtml(d,'oofDet')+
      '<section class="oofCard" style="margin-bottom:14px"><div class="oofCardHead"><h2>Carica un cedolino</h2><span>Visibile subito a '+esc(firstName(name)||name)+'</span></div>'+
      '<div class="oofUpload"><label class="oofField"><span>Mese</span><select id="oofUpMonth">'+monthOptions(A.uploadMonth)+'</select></label><label class="oofField"><span>Anno</span><select id="oofUpYear">'+yearOptions(A.uploadYear)+'</select></label><label class="oofField"><span>Titolo</span><input id="oofUpTitle" maxlength="80" value="Cedolino"></label>'+
      '<label class="oofField wide"><span>File (PDF, JPG o PNG · max 5 MB)</span><input id="oofUpFile" type="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"></label>'+
      '<div class="oofUploadFoot"><div class="oofHint">Il cedolino compare nella sezione Ufficio di '+esc(name)+'. Solo lui/lei e l’Amministrazione possono aprirlo.</div><button type="button" class="oofBtn primary" id="oofUpGo">Carica cedolino</button></div></div></section>'+
      '<section class="oofCard"><div class="oofCardHead"><h2>Cedolini caricati</h2><span>'+esc(slips.length)+' document'+(slips.length===1?'o':'i')+'</span></div><div class="oofSlips">'+slipsHtml(slips,true)+'</div></section>';
    root.innerHTML=h;bindDetailHead();bindBars('oofDet',d);
    E('oofUpMonth').onchange=function(){A.uploadMonth=Number(this.value)};
    E('oofUpYear').onchange=function(){A.uploadYear=Number(this.value)};
    E('oofUpGo').onclick=upload;
    root.querySelectorAll('[data-oof-open]').forEach(function(b){b.onclick=function(){openPayslip(b.getAttribute('data-oof-open'),'open',adminCreds(),b)}});
    root.querySelectorAll('[data-oof-download]').forEach(function(b){b.onclick=function(){openPayslip(b.getAttribute('data-oof-download'),'download',adminCreds(),b)}});
    root.querySelectorAll('[data-oof-remove]').forEach(function(b){b.onclick=function(){removeSlip(b.getAttribute('data-oof-remove'),b.getAttribute('data-oof-label'),b)}})
  }
  function bindDetailHead(){
    var back=E('oofBack');if(back)back.onclick=function(){A.view='list';A.detail=null;A.username='';loadAccounts()};
    var y=E('oofDetYear');if(y)y.onchange=function(){A.year=Number(this.value);loadDetail()};
    var r=E('oofDetReload');if(r)r.onclick=loadDetail
  }
  function readFile(file){return new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){res(String(fr.result||''))};fr.onerror=function(){rej(new Error('File non leggibile'))};fr.readAsDataURL(file)})}
  function upload(){
    var input=E('oofUpFile'),btn=E('oofUpGo'),file=input&&input.files&&input.files[0];
    if(!file){toast('Seleziona il file del cedolino.','error');return}
    if(file.size>MAX_UPLOAD){toast('File troppo grande: massimo 5 MB.','error');return}
    if(file.type&&!/^(application\/pdf|image\/jpeg|image\/png)$/.test(file.type)){toast('Formato non supportato: carica un PDF, JPG o PNG.','error');return}
    var month=Number(E('oofUpMonth').value),year=Number(E('oofUpYear').value),title=E('oofUpTitle').value||'Cedolino',name=A.detail&&A.detail.profile?A.detail.profile.display_name:A.username;
    var dup=(A.detail&&A.detail.payslips||[]).some(function(s){return s.month===month&&s.year===year});
    if(dup&&!window.confirm('Per '+MONTHS[month]+' '+year+' c’è già un cedolino di '+name+'. Caricarne un altro?'))return;
    btn.disabled=true;btn.textContent='Caricamento…';
    readFile(file).then(function(dataUrl){return api('upload_payslip',{username:A.username,year:year,month:month,title:title,file_name:file.name,data_base64:dataUrl},adminCreds())})
      .then(function(){toast('Cedolino di '+MONTHS[month]+' '+year+' caricato per '+name+'.','ok');A.uploadMonth=month;A.uploadYear=year;loadDetail()})
      .catch(function(e){toast('Caricamento non riuscito: '+e.message,'error');btn.disabled=false;btn.textContent='Carica cedolino'})
  }
  function removeSlip(id,label,btn){
    var name=A.detail&&A.detail.profile?A.detail.profile.display_name:A.username;
    if(!window.confirm('Rimuovere il cedolino di '+label+' di '+name+'?\n\nNon sarà più visibile all’operatore; il file resta nell’archivio dell’Amministrazione.'))return;
    btn.disabled=true;
    api('remove_payslip',{id:id,confirm:true},adminCreds()).then(function(){toast('Cedolino rimosso.','ok');loadDetail()}).catch(function(e){toast('Impossibile rimuovere: '+e.message,'error');btn.disabled=false})
  }

  /* ---------- Avvio ---------- */
  document.addEventListener('click',function(ev){
    var b=ev.target&&ev.target.closest?ev.target.closest('#optykerBillingNavGroup button, #optykerBillingNavGroup [data-billing-mode]'):null;
    if(b&&b.id!=='optykerOfficeAdminNav')closeAdmin()
  },true);
  function tick(){
    try{
      if(isAdminMode()){
        if(S.open)closeOffice();
        ensureAdminNav();ensureAdminPanel();
        if(A.active){var p=E('optykerOfficeAdminPanel');if(p&&getComputedStyle(p).display==='none'){A.active=false;var n=E('optykerOfficeAdminNav');if(n)n.classList.remove('active')}}
      }else{
        if(A.active)closeAdmin();
        if(E('mainApp')&&E('moduleNav')){ensureNav();ensurePanel()}
        if(S.open&&otherRootVisible())closeOffice();else if(S.open)markActive()
      }
    }catch(e){if(window.console)console.error('Optyker Ufficio',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
  setInterval(tick,1000);
  window.OPTYKER_OFFICE={version:VERSION,open:openOffice,close:closeOffice,openAdmin:openAdmin};
})();
