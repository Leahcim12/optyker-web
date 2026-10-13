/* Optyker · Report · 20261014-report1
 * Voce "Report" nella barra laterale degli account (non in Amministrazione):
 *  - richiami del mese: scadenze LAC, analisi visive (ultima visita di due anni prima), controlli LAC, udito;
 *    "Chiamato" toglie il cliente dall'elenco del mese per tutti gli operatori, "Ripristina" lo rimette;
 *  - giacenze di magazzino con ricerca, filtri e download Excel (.xlsx).
 * Nella scheda Udito aggiunge il campo "Data richiamo controllo" (letto da Report › Udito).
 * Dati: RPC optyker_report_api (stesse credenziali delle altre API Optyker). */
(function(){
  'use strict';
  if(window.__OPTYKER_REPORT_20261014__)return;
  window.__OPTYKER_REPORT_20261014__=true;
  var VERSION='20261014-report1';
  var ROOT='https://whgziwaegjzqsgcntesr.supabase.co';
  var KEY='sb_publishable_DndhLvY32YeCmqWMNRi30g_dEDm8upv';
  var MONTHS=['','Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  var TYPE_ORDER=['lac_reorder','vision','lac_control','hearing'];
  var TYPES={
    lac_reorder:{title:'Scadenze LAC',lead:'Riordino delle lenti a contatto',due:'Riordino previsto',empty:'Nessuna scadenza LAC in questo mese.'},
    vision:{title:'Analisi visive',lead:'Ultima visita di due anni fa',due:'Ultima visita',empty:'Nessun cliente da richiamare per l’analisi visiva in questo mese.'},
    lac_control:{title:'Controlli LAC',lead:'Controllo delle lenti a contatto',due:'Controllo previsto',empty:'Nessun controllo LAC in questo mese.'},
    hearing:{title:'Udito',lead:'Controllo dell’udito',due:'Controllo previsto',empty:'Nessun controllo dell’udito in questo mese.'}
  };
  var CATS={frames:'Montature da vista',sunglasses:'Occhiali da sole',contact_lenses:'Lenti a contatto',lac_solutions:'Soluzioni LAC',supplements:'Integratori',accessories:'Accessori'};
  var CAT_ORDER=['frames','sunglasses','contact_lenses','lac_solutions','supplements','accessories'];
  var PAGE=300;

  /* ---------- Utilità ---------- */
  function E(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function num(v){var n=Number(v);return isFinite(n)?n:0}
  function round2(v){return Math.round(num(v)*100)/100}
  function euro(v){try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR'}).format(num(v))}catch(e){return num(v).toFixed(2).replace('.',',')+' €'}}
  function euroFit(v){v=num(v);if(Math.abs(v)<100000)return euro(v);try{return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v)}catch(e){return Math.round(v)+' €'}}
  function intIt(v){try{return new Intl.NumberFormat('it-IT').format(Math.round(num(v)))}catch(e){return String(Math.round(num(v)))}}
  function isoDate(v){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(v||''));return m?m[3]+'/'+m[2]+'/'+m[1]:''}
  function anyDate(v){var s=String(v||'').trim(),m;if(!s)return '';if(isoDate(s))return isoDate(s);m=/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/.exec(s);return m?('0'+m[1]).slice(-2)+'/'+('0'+m[2]).slice(-2)+'/'+m[3]:s}
  function dateTime(v){try{var d=new Date(v);if(isNaN(d.getTime()))return '';return d.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Europe/Rome'})+' alle '+d.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'})}catch(e){return ''}}
  function initials(a,b){var x=String(a||'').trim().charAt(0)+String(b||'').trim().charAt(0);return (x||'?').toUpperCase()}
  function norm(s){s=String(s==null?'':s).toLowerCase();try{return s.normalize('NFD').replace(/[̀-ͯ]/g,'')}catch(e){return s}}
  function romeToday(){try{var p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),v={};p.forEach(function(x){v[x.type]=x.value});return {year:Number(v.year),month:Number(v.month),day:Number(v.day)}}catch(e){var d=new Date();return {year:d.getFullYear(),month:d.getMonth()+1,day:d.getDate()}}}
  function todayIso(){var t=romeToday();return t.year+'-'+('0'+t.month).slice(-2)+'-'+('0'+t.day).slice(-2)}
  function addMonths(y,m,d){var t=y*12+(m-1)+d;return {year:Math.floor(t/12),month:t%12+1}}
  function phoneLabel(p){var s=String(p||'').trim(),d=s.replace(/[^\d+]/g,'');if(/^3\d{9}$/.test(d))return d.slice(0,3)+' '+d.slice(3,6)+' '+d.slice(6);if(/^\+393\d{9}$/.test(d))return '+39 '+d.slice(3,6)+' '+d.slice(6,9)+' '+d.slice(9);return s}
  function telHref(p){var d=String(p||'').replace(/[^\d+]/g,'');return d?'tel:'+d:''}
  function cloud(){return window.OPTYKER_CLOUD||{}}
  function isAdminMode(){return !!window.OPTYKER_BILLING_ADMIN}

  function toast(msg,type,action){
    var t=E('orpToast');if(!t){t=document.createElement('div');t.id='orpToast';t.setAttribute('role','status');document.body.appendChild(t)}
    t.className='orpToast '+(type||'');t.innerHTML='<span>'+esc(msg)+'</span>'+(action?'<button type="button">'+esc(action.label)+'</button>':'');
    if(action)t.querySelector('button').onclick=function(){t.style.display='none';action.fn()};
    t.style.display='flex';clearTimeout(t.__h);t.__h=setTimeout(function(){t.style.display='none'},action?7000:4200)
  }

  function api(action,payload){
    var c=cloud(),u=String(c.username||'').trim(),p=String(c.password||'');
    if(!u||!p){var err=new Error('Sessione non disponibile: esci e accedi di nuovo.');err.auth=true;return Promise.reject(err)}
    var root=c.root||ROOT,key=c.key||KEY;
    return fetch(root+'/rest/v1/rpc/optyker_report_api',{
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
  function errText(e,what){return e&&e.auth?'Sessione scaduta: esci e accedi di nuovo per aprire il Report.':(what+': '+((e&&e.message)||'errore'))}

  /* ---------- Excel (.xlsx) senza librerie esterne ---------- */
  var XL=(function(){
    var enc=new TextEncoder();
    var CRC=(function(){var t=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
    function crc32(b){var c=0xFFFFFFFF;for(var i=0;i<b.length;i++)c=CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
    function zip(files){
      var parts=[],central=[],offset=0,d=new Date();
      var time=((d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2))&0xFFFF,day=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF;
      files.forEach(function(f){
        var name=enc.encode(f.name),data=enc.encode(f.text),crc=crc32(data),h=new DataView(new ArrayBuffer(30)),c=new DataView(new ArrayBuffer(46));
        h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,time,true);h.setUint16(12,day,true);
        h.setUint32(14,crc,true);h.setUint32(18,data.length,true);h.setUint32(22,data.length,true);h.setUint16(26,name.length,true);h.setUint16(28,0,true);
        c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(10,0,true);c.setUint16(12,time,true);c.setUint16(14,day,true);
        c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,name.length,true);c.setUint16(30,0,true);c.setUint16(32,0,true);
        c.setUint16(34,0,true);c.setUint16(36,0,true);c.setUint32(38,0,true);c.setUint32(42,offset,true);
        parts.push(new Uint8Array(h.buffer),name,data);central.push(new Uint8Array(c.buffer),name);offset+=30+name.length+data.length
      });
      var size=central.reduce(function(s,a){return s+a.length},0),e=new DataView(new ArrayBuffer(22));
      e.setUint32(0,0x06054b50,true);e.setUint16(4,0,true);e.setUint16(6,0,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);
      e.setUint32(12,size,true);e.setUint32(16,offset,true);e.setUint16(20,0,true);
      return new Blob(parts.concat(central,[new Uint8Array(e.buffer)]),{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'})
    }
    function x(s){return String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g,'').replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
    function col(i){var s='';i++;while(i>0){var m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26)}return s}
    function serial(iso){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||''));if(!m)return null;return (Date.UTC(+m[1],+m[2]-1,+m[3])-Date.UTC(1899,11,30))/86400000}
    var STYLE={head:1,int:2,eur:3,date:4,bold:5,boldInt:6,boldEur:7};
    function cell(ref,v,t,bold){
      if(v==null||v==='')return '';
      if(t==='date'){var s=serial(v);if(s==null)t='';else return '<c r="'+ref+'" s="'+STYLE.date+'"><v>'+s+'</v></c>'}
      if(typeof v==='number'&&isFinite(v)){var st=t==='eur'?(bold?STYLE.boldEur:STYLE.eur):(t==='int'?(bold?STYLE.boldInt:STYLE.int):(bold?STYLE.bold:0));return '<c r="'+ref+'"'+(st?' s="'+st+'"':'')+'><v>'+v+'</v></c>'}
      return '<c r="'+ref+'" t="inlineStr"'+(bold?' s="'+STYLE.bold+'"':'')+'><is><t xml:space="preserve">'+x(v)+'</t></is></c>'
    }
    function sheetXml(s){
      var rows=[],n=1,last=col(s.cols.length-1);
      rows.push('<row r="1">'+s.cols.map(function(c,i){return '<c r="'+col(i)+'1" t="inlineStr" s="'+STYLE.head+'"><is><t xml:space="preserve">'+x(c.h)+'</t></is></c>'}).join('')+'</row>');
      s.rows.forEach(function(r){n++;rows.push('<row r="'+n+'">'+r.map(function(v,i){return cell(col(i)+n,v,s.cols[i]&&s.cols[i].t,false)}).join('')+'</row>')});
      var dataEnd=n;
      if(s.total){n++;rows.push('<row r="'+n+'">'+s.total.map(function(v,i){return cell(col(i)+n,v,s.cols[i]&&s.cols[i].t,true)}).join('')+'</row>')}
      return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'+
        '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>'+
        '<cols>'+s.cols.map(function(c,i){return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+(c.w||14)+'" customWidth="1"/>'}).join('')+'</cols>'+
        '<sheetData>'+rows.join('')+'</sheetData>'+(s.filter&&dataEnd>1?'<autoFilter ref="A1:'+last+dataEnd+'"/>':'')+'</worksheet>'
    }
    function safeName(s){return String(s).replace(/[\[\]:*?\/\\]/g,' ').slice(0,31)||'Foglio'}
    function build(sheets){
      var files=[],wbSheets='',rels='',ct='',names='';
      sheets.forEach(function(s,i){
        var id=i+1;s.name=safeName(s.name);
        files.push({name:'xl/worksheets/sheet'+id+'.xml',text:sheetXml(s)});
        wbSheets+='<sheet name="'+x(s.name)+'" sheetId="'+id+'" r:id="rId'+id+'"/>';
        rels+='<Relationship Id="rId'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet'+id+'.xml"/>';
        ct+='<Override PartName="/xl/worksheets/sheet'+id+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        if(s.filter&&s.rows.length)names+='<definedName name="_xlnm._FilterDatabase" localSheetId="'+i+'" hidden="1">\''+x(s.name.replace(/'/g,"''"))+'\'!$A$1:$'+col(s.cols.length-1)+'$'+(s.rows.length+1)+'</definedName>'
      });
      rels+='<Relationship Id="rId'+(sheets.length+1)+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
      var head='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
      files.unshift(
        {name:'[Content_Types].xml',text:head+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+ct+'</Types>'},
        {name:'_rels/.rels',text:head+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
        {name:'xl/workbook.xml',text:head+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>'+wbSheets+'</sheets>'+(names?'<definedNames>'+names+'</definedNames>':'')+'</workbook>'},
        {name:'xl/_rels/workbook.xml.rels',text:head+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels+'</Relationships>'},
        {name:'xl/styles.xml',text:head+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00\\ &quot;€&quot;"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>'+
          '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>'+
          '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1EFEA"/><bgColor indexed="64"/></patternFill></fill></fills>'+
          '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'+
          '<cellXfs count="8"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'+
          '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'+
          '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'+
          '<xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/><xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/></cellXfs>'+
          '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'}
      );
      return zip(files)
    }
    function download(fileName,sheets){
      var blob=build(sheets),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=fileName.replace(/[\\\/:*?"<>|]+/g,' ');a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
      setTimeout(function(){try{URL.revokeObjectURL(url)}catch(e){}},60000)
    }
    return {build:build,download:download}
  })();

  /* ---------- Stato ---------- */
  var R={open:false,guard:false,view:'home',year:0,month:0,
    overview:null,ovError:'',ovSeq:0,
    type:'vision',list:null,listError:'',listSeq:0,tab:'pending',search:'',
    stock:null,stockRows:[],stockError:'',stockSeq:0,stockLoading:false,stockSearch:'',stockCat:'',stockKind:'stock',showAll:false};
  var KINDS={stock:'Disponibili',negative:'Giacenze negative',unlimited:'Illimitate online'};

  /* ---------- Barra laterale e pannello ---------- */
  function ensureNav(){
    var nav=E('moduleNav');if(!nav)return null;
    var b=E('navReport');
    if(!b){
      b=document.createElement('button');b.id='navReport';b.type='button';b.className='moduleBtn';b.setAttribute('data-short','Report');
      b.title='Report · richiami del mese e giacenze di magazzino';
      b.innerHTML='<span class="winNavIcon" aria-hidden="true">◫</span><span>Report</span>';
      b.addEventListener('click',function(ev){ev.preventDefault();openReport()});
    }
    var office=E('navOffice'),settings=E('navSettings');
    if(office&&office.parentNode===nav){if(office.nextSibling!==b)nav.insertBefore(b,office.nextSibling)}
    else if(b.parentNode!==nav){if(settings&&settings.parentNode===nav)nav.insertBefore(b,settings);else nav.appendChild(b)}
    return b
  }
  function ensurePanel(){
    var p=E('optykerReportPanel');if(p)return p;
    var app=E('mainApp');if(!app)return null;
    p=document.createElement('div');p.id='optykerReportPanel';p.className='panel optykerReportPanel';p.style.setProperty('display','none','important');
    p.innerHTML='<div class="orp" id="orpRoot"></div>';
    var anchor=E('optykerOfficePanel')||E('dashboardPanel');
    if(anchor&&anchor.parentNode===app)app.insertBefore(p,anchor.nextSibling);else app.appendChild(p);
    observeRoots();
    return p
  }
  function rootVisible(el){if(!el||el.id==='optykerReportPanel')return false;if(!(el.classList.contains('panel')||el.id==='dashboardPanel'))return false;try{return getComputedStyle(el).display!=='none'}catch(e){return false}}
  function otherRootVisible(){var app=E('mainApp');if(!app)return false;for(var i=0;i<app.children.length;i++)if(rootVisible(app.children[i]))return true;return false}
  function hideOthers(){
    var app=E('mainApp');if(!app)return;
    Array.prototype.forEach.call(app.children,function(ch){if(ch.id==='optykerReportPanel')return;if(ch.classList.contains('panel')||ch.id==='dashboardPanel'||ch.id==='reportSectionTop'||ch.id==='currentClientBanner')ch.style.setProperty('display','none','important')});
    var tabs=E('analysisTabs');if(tabs)tabs.style.setProperty('display','none','important')
  }
  /* La voce attiva delle altre sezioni è gestita da altri script (che la ripristinano se cambia classe):
     mentre il Report è aperto la si mostra con l'aspetto di una voce normale, senza toccarne le classi. */
  function calmOtherActive(){
    var b=E('navReport');if(!b)return;
    var was=b.classList.contains('active');if(was)b.classList.remove('active');
    var c=getComputedStyle(b),sel='html body.orpReportOpen #mainApp#mainApp#mainApp #moduleNav .moduleBtn.active:not(#navReport)',css=sel+'{background:'+c.backgroundColor+'!important;color:'+c.color+'!important;box-shadow:'+c.boxShadow+'!important;font-weight:'+c.fontWeight+'!important;border-color:'+c.borderTopColor+'!important}'+sel+'::before{display:none!important}';
    if(was)b.classList.add('active');
    var st=E('orpActiveCalm');if(!st){st=document.createElement('style');st.id='orpActiveCalm';document.head.appendChild(st)}
    if(st.textContent!==css)st.textContent=css
  }
  function markActive(){if(!R.open)return;var b=E('navReport');if(b&&!b.classList.contains('active'))b.classList.add('active');document.body.classList.add('orpReportOpen')}
  function openReport(){
    if(isAdminMode())return;
    var p=ensurePanel();if(!p)return;
    R.guard=true;
    try{calmOtherActive();hideOthers();p.style.setProperty('display','block','important');R.open=true;markActive()}finally{R.guard=false}
    try{window.scrollTo(0,0)}catch(e){}
    var t=romeToday();if(!R.year){R.year=t.year;R.month=t.month}
    R.view='home';render();loadOverview()
  }
  function closeReport(){
    if(!R.open)return;R.open=false;
    var p=E('optykerReportPanel');if(p)p.style.setProperty('display','none','important');
    var b=E('navReport');if(b)b.classList.remove('active');
    document.body.classList.remove('orpReportOpen')
  }
  var observer=null;
  function observeRoots(){
    var app=E('mainApp');if(!app||typeof MutationObserver!=='function')return;
    if(!observer)observer=new MutationObserver(function(){if(R.open&&!R.guard&&otherRootVisible())closeReport()});
    observer.disconnect();
    observer.observe(app,{childList:true});
    Array.prototype.forEach.call(app.children,function(ch){if(ch.id!=='optykerReportPanel')observer.observe(ch,{attributes:true,attributeFilter:['style','class']})})
  }
  function goTop(){try{var p=E('optykerReportPanel');if(p&&p.getBoundingClientRect().top<0)window.scrollTo(0,0)}catch(e){}}

  /* ---------- Selettore del mese ---------- */
  function monthOptions(y,m,counts){
    var t=romeToday(),list=[],i;
    for(i=-24;i<=12;i++)list.push(addMonths(t.year,t.month,i));
    if(!list.some(function(z){return z.year===y&&z.month===m})){list.push({year:y,month:m});list.sort(function(a,b){return (a.year*12+a.month)-(b.year*12+b.month)})}
    return list.map(function(z){var key=z.year+'-'+z.month,c=counts?counts[key]:null,lab=MONTHS[z.month]+' '+z.year+(c!=null?' · '+c:'');return '<option value="'+key+'"'+(z.year===y&&z.month===m?' selected':'')+'>'+esc(lab)+'</option>'}).join('')
  }
  function monthNavHtml(prefix,y,m,counts){
    return '<div class="orpMonthNav"><button type="button" class="orpIcon" id="'+prefix+'Prev" aria-label="Mese precedente">‹</button>'+
      '<label class="orpField"><span>Mese</span><select id="'+prefix+'Month">'+monthOptions(y,m,counts)+'</select></label>'+
      '<button type="button" class="orpIcon" id="'+prefix+'Next" aria-label="Mese successivo">›</button></div>'
  }
  function bindMonthNav(prefix,cb){
    var s=E(prefix+'Month'),p=E(prefix+'Prev'),n=E(prefix+'Next');
    if(s)s.onchange=function(){var v=String(this.value).split('-');cb(Number(v[0]),Number(v[1]))};
    if(p)p.onclick=function(){var x=addMonths(R.year,R.month,-1);cb(x.year,x.month)};
    if(n)n.onclick=function(){var x=addMonths(R.year,R.month,1);cb(x.year,x.month)}
  }

  /* ---------- Pagina iniziale ---------- */
  function render(){var root=E('orpRoot');if(!root)return;if(R.view==='list')renderList(root);else if(R.view==='stock')renderStock(root);else renderHome(root)}
  function renderHome(root){
    var ov=R.overview,y=R.year,m=R.month,t=romeToday(),st=ov&&ov.stock;
    var h='<div class="orpHead"><div><div class="orpEyebrow">Ottica Visual Care · Report</div><h1 class="orpTitle">Report</h1><div class="orpSub">I clienti da richiamare nel mese e l’elenco aggiornato delle giacenze di magazzino.</div></div>'+
      '<div class="orpTools">'+monthNavHtml('orpHome',y,m,null)+'<button type="button" class="orpBtn" id="orpHomeReload">Aggiorna</button></div></div>';
    if(R.ovError)h+='<div class="orpError">'+esc(R.ovError)+'</div>';
    h+='<div class="orpSection">Richiami di '+esc(MONTHS[m]+' '+y)+(y===t.year&&m===t.month?' · mese in corso':'')+'</div><div class="orpCards">'+TYPE_ORDER.map(function(k){
      var c=ov&&ov.recalls&&ov.recalls[k],pending=c?num(c.pending):null,called=c?num(c.called):0,foot;
      if(pending==null)foot=R.ovError?'Non disponibile':'Caricamento…';
      else foot=(pending===1?'cliente da chiamare':'clienti da chiamare')+(called?' · '+intIt(called)+' già chiamat'+(called===1?'o':'i'):'');
      return '<button type="button" class="orpCard'+(pending?' has':'')+'" data-orp-type="'+k+'"><span class="orpCardTop"><span class="orpCardTitle">'+esc(TYPES[k].title)+'</span><span class="orpArrow" aria-hidden="true">→</span></span>'+
        '<span class="orpCardLead">'+esc(TYPES[k].lead)+'</span><b class="orpCardNum">'+(pending==null?'—':intIt(pending))+'</b><span class="orpCardFoot">'+esc(foot)+'</span></button>'
    }).join('')+'</div>';
    h+='<div class="orpSection">Magazzino</div><button type="button" class="orpStockCard" id="orpOpenStock"><span class="orpStockText"><span class="orpCardTitle">Giacenze di magazzino</span><span class="orpCardLead">Tutti gli articoli disponibili, con ricerca, filtri per categoria e download in Excel.</span></span>'+
      '<span class="orpStockNums">'+(st?'<b>'+intIt(st.items)+'</b> articoli · <b>'+intIt(st.pieces)+'</b> pezzi':'…')+'</span><span class="orpArrow" aria-hidden="true">→</span></button>';
    root.innerHTML=h;root.onclick=null;
    bindMonthNav('orpHome',function(y2,m2){R.year=y2;R.month=m2;loadOverview()});
    E('orpHomeReload').onclick=loadOverview;
    root.querySelectorAll('[data-orp-type]').forEach(function(b){b.onclick=function(){openList(b.getAttribute('data-orp-type'))}});
    E('orpOpenStock').onclick=openStock
  }
  function loadOverview(){
    var seq=++R.ovSeq;R.ovError='';R.overview=null;if(R.view==='home')render();
    api('overview',{year:R.year,month:R.month}).then(function(d){if(seq!==R.ovSeq)return;R.overview=d;if(R.view==='home')render()})
      .catch(function(e){if(seq!==R.ovSeq)return;R.ovError=errText(e,'Report non disponibile');if(R.view==='home')render()})
  }
  function goHome(){R.view='home';render();goTop();loadOverview()}

  /* ---------- Richiami ---------- */
  function typeDesc(type,y,m){
    if(type==='vision')return 'Clienti la cui ultima analisi visiva (prescrizione, esame visivo o anomalie visive) è di '+MONTHS[m]+' '+(y-2)+', due anni fa.';
    if(type==='lac_reorder')return 'Clienti con la «Data richiamo scheda per riordino» in '+MONTHS[m]+' '+y+', dalla scheda LAC più recente che la riporta.';
    if(type==='lac_control')return 'Clienti con la «Data controllo» in '+MONTHS[m]+' '+y+', dalla scheda LAC più recente che la riporta.';
    return 'Clienti con il controllo dell’udito in '+MONTHS[m]+' '+y+': «Data richiamo controllo» della scheda Udito o, se vuota, 12 mesi dopo l’esame.'
  }
  function noteFor(type){
    var base='«Chiamato» toglie il cliente dall’elenco di questo mese per tutti gli operatori; in «Già chiamati» vedi chi l’ha chiamato e puoi ripristinarlo.';
    if(type==='vision')return 'Non compaiono i clienti che hanno fatto una visita più recente. '+base;
    if(type==='hearing')return 'La data di richiamo si imposta nella scheda Udito (campo «Data richiamo controllo»). '+base;
    return 'Le date si impostano nella scheda LAC (Identificazione lenti e richiami). '+base
  }
  function openList(type){R.view='list';R.type=TYPES[type]?type:'vision';R.tab='pending';R.search='';R.list=null;goTop();loadList()}
  function loadList(){
    var seq=++R.listSeq;R.listError='';R.list=null;render();
    api('recalls',{type:R.type,year:R.year,month:R.month}).then(function(d){if(seq!==R.listSeq)return;R.list=d;render()})
      .catch(function(e){if(seq!==R.listSeq)return;R.listError=errText(e,'Elenco non disponibile');render()})
  }
  function listRows(){return R.list&&Array.isArray(R.list.rows)?R.list.rows:[]}
  function listCounts(){var c={};if(R.list&&Array.isArray(R.list.months))R.list.months.forEach(function(x){c[x.year+'-'+x.month]=num(x.pending)});return c}
  function matchRow(r,q){
    var terms=norm(q).split(/\s+/).filter(Boolean);if(!terms.length)return true;
    var hay=norm([r.surname,r.name,r.name,r.surname,r.phone,String(r.phone||'').replace(/\D/g,''),r.home_phone,String(r.home_phone||'').replace(/\D/g,''),r.email,r.city,r.client_ref,r.sheet_ref,r.detail,r.operator].join(' '));
    return terms.every(function(t){return hay.indexOf(t)>=0})
  }
  function reasonText(r){
    var T=TYPES[R.type]||TYPES.vision,bits=[],due=isoDate(r.due_date),base=isoDate(r.base_date);
    if(R.type==='vision'){bits.push(T.due+' '+base);if(r.sheet_label)bits.push(r.sheet_label)}
    else if(R.type==='hearing'){bits.push(T.due+' '+due);bits.push('esame del '+base);if(r.detail)bits.push(r.detail)}
    else{bits.push(T.due+' '+due);bits.push((r.sheet_label||'Scheda LAC')+(r.sheet_ref?' '+r.sheet_ref:'')+' del '+base);if(r.detail)bits.push(r.detail)}
    if(r.operator)bits.push(r.operator);
    return bits
  }
  function rowHtml(r){
    var name=(String(r.surname||'')+' '+String(r.name||'')).trim()||'Cliente senza nome',meta=[],b=anyDate(r.birth),bits=reasonText(r),contacts='';
    if(b)meta.push('Nato/a '+b);if(r.city)meta.push(r.city);if(r.client_ref)meta.push(r.client_ref);
    if(r.phone)contacts+='<a class="orpPhone" href="'+esc(telHref(r.phone))+'">'+esc(phoneLabel(r.phone))+'</a>';
    if(r.home_phone&&r.home_phone!==r.phone)contacts+='<a class="orpPhone alt" href="'+esc(telHref(r.home_phone))+'">'+esc(phoneLabel(r.home_phone))+'</a>';
    if(!r.phone&&!r.home_phone)contacts+='<span class="orpNoPhone">Nessun telefono</span>';
    if(r.email)contacts+='<a class="orpMail" href="mailto:'+esc(r.email)+'">'+esc(r.email)+'</a>';
    var why='<span class="orpDue">'+esc(bits[0])+'</span>'+(bits.length>1?' '+esc(bits.slice(1).join(' · ')):'');
    if(r.called)why+='<div class="orpCalled">✓ Chiamato'+(r.called_by?' da '+esc(r.called_by):'')+(r.called_at?' il '+esc(dateTime(r.called_at)):'')+'</div>';
    var act=r.called?'<button type="button" class="orpBtn small" data-orp-restore="'+esc(r.client_id)+'">Ripristina</button>':'<button type="button" class="orpBtn small primary" data-orp-called="'+esc(r.client_id)+'">✓ Chiamato</button>';
    return '<div class="orpRow'+(r.called?' called':'')+'"><div class="orpAvatar" aria-hidden="true">'+esc(initials(r.surname,r.name))+'</div>'+
      '<div class="orpMain"><button type="button" class="orpName" data-orp-client="'+esc(r.client_id)+'" title="Apri la scheda cliente">'+esc(name)+'</button>'+(meta.length?'<div class="orpMeta">'+esc(meta.join(' · '))+'</div>':'')+'<div class="orpWhy">'+why+'</div></div>'+
      '<div class="orpContacts">'+contacts+'</div><div class="orpActions"><button type="button" class="orpBtn small" data-orp-client="'+esc(r.client_id)+'">Apri cliente</button>'+act+'</div></div>'
  }
  function listBodyHtml(){
    var T=TYPES[R.type]||TYPES.vision,rows=listRows(),counts=listCounts(),pending=rows.filter(function(r){return !r.called}),called=rows.filter(function(r){return r.called}),h='',prev=[],i;
    for(i=1;i<=2;i++){var x=addMonths(R.year,R.month,-i),c=counts[x.year+'-'+x.month];if(c)prev.push({year:x.year,month:x.month,n:c})}
    if(prev.length&&R.tab==='pending'&&!R.search)h+='<div class="orpNotice">Ancora da chiamare nei mesi precedenti: '+prev.map(function(p){return '<button type="button" class="orpLink" data-orp-goto="'+p.year+'-'+p.month+'">'+esc(MONTHS[p.month]+' '+p.year)+' ('+intIt(p.n)+')</button>'}).join(' · ')+'</div>';
    var list=(R.tab==='called'?called:pending).filter(function(r){return matchRow(r,R.search)});
    if(!list.length){
      var msg=R.search?'Nessun cliente corrisponde alla ricerca.':(R.tab==='called'?'Nessun cliente segnato come chiamato in questo mese.':(rows.length?'Hai chiamato tutti i clienti di questo mese. ✓':T.empty));
      var other=R.search?(R.tab==='called'?pending:called).filter(function(r){return matchRow(r,R.search)}).length:0;
      h+='<div class="orpEmpty">'+esc(msg)+(other?' <button type="button" class="orpLink accent" data-orp-switch="1">Trovat'+(other===1?'o':'i')+' '+other+' in «'+(R.tab==='called'?'Da chiamare':'Già chiamati')+'»</button>':'')+'</div>'
    }else h+='<div class="orpRows">'+list.map(rowHtml).join('')+'</div>';
    return h
  }
  function renderList(root){
    var T=TYPES[R.type]||TYPES.vision,d=R.list,rows=listRows(),y=R.year,m=R.month;
    var pending=rows.filter(function(r){return !r.called}).length,called=rows.length-pending;
    var h='<button type="button" class="orpBack" id="orpBack">← Report</button>'+
      '<div class="orpHead"><div><div class="orpEyebrow">Report · Richiami</div><h1 class="orpTitle">'+esc(T.title)+'</h1><div class="orpSub">'+esc(typeDesc(R.type,y,m))+'</div></div>'+
      '<div class="orpTools">'+monthNavHtml('orpList',y,m,d?listCounts():null)+'<button type="button" class="orpBtn" id="orpListXlsx"'+(rows.length?'':' disabled')+'>Scarica Excel</button></div></div>';
    if(R.listError)h+='<div class="orpError">'+esc(R.listError)+'</div>';
    else if(!d)h+='<div class="orpLoading">Caricamento dei richiami…</div>';
    else{
      h+='<div class="orpBar"><div class="orpTabs" role="tablist"><button type="button" role="tab" data-orp-tab="pending" class="'+(R.tab==='pending'?'on':'')+'" aria-selected="'+(R.tab==='pending')+'">Da chiamare <b>'+intIt(pending)+'</b></button>'+
        '<button type="button" role="tab" data-orp-tab="called" class="'+(R.tab==='called'?'on':'')+'" aria-selected="'+(R.tab==='called')+'">Già chiamati <b>'+intIt(called)+'</b></button></div>'+
        '<input type="search" class="orpSearch" id="orpListSearch" placeholder="Cerca nome, telefono o email" autocomplete="off" value="'+esc(R.search)+'"></div>'+
        '<div id="orpListBody">'+listBodyHtml()+'</div><p class="orpNote">'+esc(noteFor(R.type))+'</p>'
    }
    root.innerHTML=h;
    E('orpBack').onclick=goHome;
    bindMonthNav('orpList',function(y2,m2){R.year=y2;R.month=m2;loadList()});
    var xb=E('orpListXlsx');if(xb)xb.onclick=downloadRecalls;
    root.querySelectorAll('[data-orp-tab]').forEach(function(b){b.onclick=function(){R.tab=b.getAttribute('data-orp-tab');render()}});
    var s=E('orpListSearch');if(s)s.oninput=function(){R.search=this.value||'';var body=E('orpListBody');if(body)body.innerHTML=listBodyHtml()};
    root.onclick=function(ev){
      var t=ev.target&&ev.target.closest?ev.target.closest('[data-orp-called],[data-orp-restore],[data-orp-client],[data-orp-goto],[data-orp-switch]'):null;if(!t||!root.contains(t))return;
      if(t.hasAttribute('data-orp-switch')){R.tab=R.tab==='called'?'pending':'called';render();var si=E('orpListSearch');if(si)try{si.focus()}catch(e){}}
      else if(t.hasAttribute('data-orp-called'))setCalled(t.getAttribute('data-orp-called'),true,t);
      else if(t.hasAttribute('data-orp-restore'))setCalled(t.getAttribute('data-orp-restore'),false,t);
      else if(t.hasAttribute('data-orp-client'))openClient(t.getAttribute('data-orp-client'));
      else if(t.hasAttribute('data-orp-goto')){var v=t.getAttribute('data-orp-goto').split('-');R.year=Number(v[0]);R.month=Number(v[1]);goTop();loadList()}
    }
  }
  function findRow(id){var rows=listRows();for(var i=0;i<rows.length;i++)if(rows[i].client_id===id)return rows[i];return null}
  function adjustCounts(y,m,on){
    if(!R.list||!Array.isArray(R.list.months))return;
    R.list.months.forEach(function(x){if(x.year===y&&x.month===m){x.pending=Math.max(0,num(x.pending)+(on?-1:1));x.called=Math.max(0,num(x.called)+(on?1:-1))}})
  }
  function setCalled(id,on,btn){
    var r=findRow(id);if(!r)return;
    var name=(String(r.surname||'')+' '+String(r.name||'')).trim()||'Cliente',type=R.type,y=R.year,m=R.month,old=btn?btn.textContent:'';
    if(btn){btn.disabled=true;btn.textContent='…'}
    api(on?'mark_called':'unmark_called',{type:type,year:y,month:m,client_id:id}).then(function(d){
      if(R.view!=='list'||R.type!==type||R.year!==y||R.month!==m||findRow(id)!==r)return;
      r.called=on;r.called_by=on?((d&&d.called_by)||''):'';r.called_at=on?((d&&d.called_at)||null):null;
      adjustCounts(y,m,on);render();
      if(on)toast(name+' segnato come chiamato.','ok',{label:'Annulla',fn:function(){if(R.view==='list'&&R.type===type&&R.year===y&&R.month===m)setCalled(id,false)}});
      else toast(name+' è di nuovo tra i clienti da chiamare.','ok')
    }).catch(function(e){
      toast((on?'Non segnato come chiamato: ':'Non ripristinato: ')+(e.auth?'sessione scaduta, esci e accedi di nuovo.':e.message),'error');
      if(btn&&document.body.contains(btn)){btn.disabled=false;btn.textContent=old}
    })
  }
  function openClient(id){
    if(typeof window.showModule!=='function'||typeof window.clientSelect!=='function'){toast('Apri il cliente dalla sezione Clienti.','error');return}
    function found(){try{return typeof window.cloudFindClient==='function'?!!window.cloudFindClient(id):true}catch(e){return false}}
    function go(){closeReport();try{window.showModule('clients')}catch(e){}try{window.clientSelect(id)}catch(e){}try{window.scrollTo(0,0)}catch(e){}}
    if(found()){go();return}
    if(typeof window.cloudLoadClients==='function'){
      toast('Apertura del cliente…','');
      Promise.resolve().then(function(){return window.cloudLoadClients()}).catch(function(){}).then(function(){if(found())go();else toast('Cliente non presente nell’elenco Clienti: aggiorna la pagina.','error')});
      return
    }
    toast('Cliente non presente nell’elenco Clienti: aggiorna la pagina.','error')
  }
  function downloadRecalls(){
    var rows=listRows();if(!rows.length)return;
    var T=TYPES[R.type]||TYPES.vision;
    var cols=[{h:'Cliente',w:28},{h:'Telefono',w:16},{h:'Altro telefono',w:16},{h:'Email',w:30},{h:'Data di nascita',w:14},{h:'Città',w:16},
      {h:R.type==='vision'?'Ultima visita':'Data richiamo',w:14,t:'date'},{h:'Dettaglio',w:54},{h:'Stato',w:16},{h:'Chiamato da',w:22},{h:'Chiamato il',w:18}];
    var data=rows.slice().sort(function(a,b){return (a.called?1:0)-(b.called?1:0)||String(a.due_date).localeCompare(String(b.due_date))||norm(a.surname).localeCompare(norm(b.surname))}).map(function(r){
      return [(String(r.surname||'')+' '+String(r.name||'')).trim(),r.phone||'',r.home_phone&&r.home_phone!==r.phone?r.home_phone:'',r.email||'',anyDate(r.birth),r.city||'',
        R.type==='vision'?r.base_date:r.due_date,reasonText(r).join(' · '),r.called?'Chiamato':'Da chiamare',r.called?(r.called_by||''):'',r.called&&r.called_at?dateTime(r.called_at):'']
    });
    XL.download('Richiami '+T.title+' '+MONTHS[R.month]+' '+R.year+'.xlsx',[{name:T.title+' '+MONTHS[R.month]+' '+R.year,cols:cols,rows:data,filter:true}]);
    toast('Elenco scaricato: '+rows.length+' client'+(rows.length===1?'e':'i')+'.','ok')
  }

  /* ---------- Giacenze ---------- */
  function openStock(){R.view='stock';R.showAll=false;goTop();render();loadStock()}
  function loadStock(){
    var seq=++R.stockSeq;R.stockError='';R.stockLoading=true;render();
    api('stock',{}).then(function(d){
      if(seq!==R.stockSeq)return;
      var lim=num(d&&d.unlimited_from)||500;
      R.stockRows=(d&&Array.isArray(d.rows)?d.rows:[]).map(function(r){var q=num(r.quantity);r._q=q;r._kind=q>=lim?'unlimited':(q<0?'negative':'stock');return r});
      R.stock=d;R.stockLoading=false;render()
    }).catch(function(e){if(seq!==R.stockSeq)return;R.stockLoading=false;R.stockError=errText(e,'Giacenze non disponibili');render()})
  }
  function variantText(r){var v=String(r.variant||'').trim();if(!v)return '';if(norm(r.title).indexOf(norm(v))>=0||norm(v)===norm(r.vendor))return '';return v}
  function paramsText(r){
    var p=[],v=norm(r.variant);
    if(r.frame&&v.indexOf(norm(r.frame))<0)p.push('Misure '+r.frame);
    if(r.color&&v.indexOf(norm(r.color))<0)p.push('Colore '+r.color);
    if(r.sphere!=null&&!/\bSF\b/i.test(String(r.variant||''))){var s='SF '+r.sphere;if(r.cylinder&&num(r.cylinder)!==0)s+=' CIL '+r.cylinder+(r.axis?' AX '+r.axis:'');p.push(s)}
    if(r.liquid)p.push(r.liquid);
    if(r.expiry)p.push('Scad. '+isoDate(r.expiry));
    return p.join(' · ')
  }
  function stockHay(r){return r._hay||(r._hay=norm([r.title,r.variant,r.vendor,r.type,r.sku,r.barcode,r.supplier,r.color,r.frame,CATS[r.category]].join(' ')))}
  function stockMatches(r,ignoreCat){
    if(r._kind!==R.stockKind)return false;
    if(!ignoreCat&&R.stockCat&&r.category!==R.stockCat)return false;
    var terms=norm(R.stockSearch).split(/\s+/).filter(Boolean);if(!terms.length)return true;
    var hay=stockHay(r);return terms.every(function(t){return hay.indexOf(t)>=0})
  }
  function stockFiltered(){return R.stockRows.filter(function(r){return stockMatches(r,false)})}
  function totals(list){
    var t={items:0,pieces:0,value:0,cost:0,costMissing:0};
    list.forEach(function(r){t.items++;t.pieces+=r._q;if(r._kind!=='stock')return;t.value+=r._q*num(r.price);if(r.cost!=null)t.cost+=r._q*num(r.cost);else t.costMissing++});
    return t
  }
  function kindCount(k){return R.stockRows.filter(function(r){return r._kind===k}).length}
  function stockRowHtml(r,cost){
    var v=variantText(r),p=paramsText(r),sub=[v,p].filter(Boolean).join(' · ');
    var codes=[r.sku,r.barcode].filter(Boolean).map(esc).join('<br>');
    var value=r._kind==='stock'?euro(r._q*num(r.price)):'—';
    return '<tr class="'+r._kind+'"><td class="prod" data-l="Prodotto"><b>'+esc(r.title||'Senza nome')+'</b>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</td>'+
      '<td data-l="Marca">'+esc(r.vendor||'')+'</td><td class="code" data-l="Codice">'+codes+'</td><td data-l="Fornitore">'+esc(r.supplier||'')+'</td>'+
      '<td class="num qty" data-l="Quantità">'+intIt(r._q)+'</td><td class="num" data-l="Prezzo">'+(r.price!=null?esc(euro(r.price)):'')+'</td><td class="num" data-l="Valore">'+esc(value)+'</td>'+
      (cost?'<td class="num" data-l="Costo">'+(r.cost!=null?esc(euro(r.cost)):'—')+'</td><td class="num" data-l="Valore a costo">'+(r.cost!=null&&r._kind==='stock'?esc(euro(r._q*num(r.cost))):'—')+'</td>':'')+'</tr>'
  }
  function kpisHtml(t,cost){
    var where=(R.stockCat?esc(CATS[R.stockCat]||R.stockCat):'Tutte le categorie')+(R.stockSearch?' · ricerca attiva':'');
    if(R.stockKind==='negative')return '<div class="orpKpis"><div class="orpKpi main"><span>Articoli con giacenza negativa</span><b>'+intIt(t.items)+'</b><small>'+where+'</small></div>'+
      '<div class="orpKpi"><span>Pezzi mancanti</span><b>'+intIt(-t.pieces)+'</b><small>Venduti senza carico: correggi con Differenza magazzino</small></div></div>';
    if(R.stockKind==='unlimited')return '<div class="orpKpis"><div class="orpKpi main"><span>Prodotti online illimitati</span><b>'+intIt(t.items)+'</b><small>'+where+'</small></div>'+
      '<div class="orpKpi"><span>Cosa sono</span><b>Su ordinazione</b><small>Quantità Shopify da '+intIt(num(R.stock&&R.stock.unlimited_from)||500)+' in su: non sono pezzi in negozio</small></div></div>';
    return '<div class="orpKpis"><div class="orpKpi main"><span>Articoli disponibili</span><b>'+intIt(t.items)+'</b><small>'+where+'</small></div>'+
      '<div class="orpKpi"><span>Pezzi in magazzino</span><b>'+intIt(t.pieces)+'</b><small>Somma delle quantità</small></div>'+
      '<div class="orpKpi"><span>Valore di vendita</span><b>'+esc(euroFit(t.value))+'</b><small>Quantità × prezzo di vendita</small></div>'+
      (cost?'<div class="orpKpi"><span>Valore a costo</span><b>'+esc(euroFit(t.cost))+'</b><small>'+(t.costMissing?intIt(t.costMissing)+' articol'+(t.costMissing===1?'o':'i')+' senza costo':'Costo riservato, visibile solo a te')+'</small></div>':'')+'</div>'
  }
  function stockBodyHtml(){
    var d=R.stock,cost=!!(d&&d.can_view_cost),list=stockFiltered(),t=totals(list),h=kpisHtml(t,cost);
    var chips='<button type="button" class="orpChip'+(R.stockCat?'':' on')+'" data-orp-cat="">Tutte <b>'+intIt(R.stockRows.filter(function(r){return stockMatches(r,true)}).length)+'</b></button>';
    CAT_ORDER.forEach(function(k){var n=R.stockRows.filter(function(r){return r.category===k&&stockMatches(r,true)}).length;if(!n&&R.stockCat!==k)return;chips+='<button type="button" class="orpChip'+(R.stockCat===k?' on':'')+'" data-orp-cat="'+k+'">'+esc(CATS[k])+' <b>'+intIt(n)+'</b></button>'});
    h+='<div class="orpChips">'+chips+'</div>';
    if(!list.length){h+='<div class="orpEmpty">'+(R.stockSearch?'Nessun articolo corrisponde alla ricerca.':'Nessun articolo in questa categoria.')+'</div>';return h}
    var groups={},shown=0,limit=R.showAll?Infinity:PAGE,cols=cost?9:7;
    list.forEach(function(r){(groups[r.category]||(groups[r.category]=[])).push(r)});
    var order=CAT_ORDER.concat(Object.keys(groups).filter(function(k){return CAT_ORDER.indexOf(k)<0}));
    var table='<div class="orpTableWrap"><table class="orpTable"><thead><tr><th>Prodotto</th><th>Marca</th><th>Codice</th><th>Fornitore</th><th class="num">Q.tà</th><th class="num">Prezzo</th><th class="num">Valore</th>'+(cost?'<th class="num">Costo</th><th class="num">Valore a costo</th>':'')+'</tr></thead><tbody>';
    order.forEach(function(k){
      var g=groups[k];if(!g||!g.length||shown>=limit)return;var gt=totals(g);
      table+='<tr class="orpGroup"><td colspan="'+cols+'"><b>'+esc(CATS[k]||k)+'</b><span>'+intIt(gt.items)+' articol'+(gt.items===1?'o':'i')+(R.stockKind==='stock'?' · '+intIt(gt.pieces)+' pezzi · '+esc(euro(gt.value)):'')+'</span></td></tr>';
      for(var i=0;i<g.length&&shown<limit;i++,shown++)table+=stockRowHtml(g[i],cost)
    });
    table+='</tbody></table></div>';
    h+=table;
    if(shown<list.length)h+='<div class="orpMore"><span>Mostrati '+intIt(shown)+' di '+intIt(list.length)+' articoli</span><button type="button" class="orpBtn" id="orpStockAll">Mostra tutti</button></div>';
    return h
  }
  function renderStockBody(){var b=E('orpStockBody');if(b)b.innerHTML=stockBodyHtml();var a=E('orpStockAll');if(a)a.onclick=function(){R.showAll=true;renderStockBody()}}
  function renderStock(root){
    var d=R.stock,cost=!!(d&&d.can_view_cost);
    var h='<button type="button" class="orpBack" id="orpBack">← Report</button>'+
      '<div class="orpHead"><div><div class="orpEyebrow">Report · Magazzino</div><h1 class="orpTitle">Giacenze di magazzino</h1><div class="orpSub">'+(d?'Elenco aggiornato al '+esc(dateTime(d.generated_at))+'. ':'')+'Quantità del magazzino Optyker (Carica e Differenza magazzino), servizi esclusi.</div></div>'+
      '<div class="orpTools"><button type="button" class="orpBtn" id="orpStockReload"'+(R.stockLoading?' disabled':'')+'>'+(R.stockLoading?'Aggiornamento…':'Aggiorna')+'</button><button type="button" class="orpBtn primary" id="orpStockXlsx"'+(d&&!R.stockLoading?'':' disabled')+'>Scarica Excel</button></div></div>';
    if(R.stockError)h+='<div class="orpError">'+esc(R.stockError)+'</div>';
    if(!d){root.innerHTML=h+(R.stockError?'':'<div class="orpLoading">Caricamento delle giacenze…</div>');bindStock(root);return}
    if(R.stockKind!=='stock'&&!kindCount(R.stockKind))R.stockKind='stock';
    var kinds=Object.keys(KINDS).filter(function(k){return k==='stock'||kindCount(k)}).map(function(k){return '<button type="button" role="tab" data-orp-kind="'+k+'" class="'+(R.stockKind===k?'on':'')+'" aria-selected="'+(R.stockKind===k)+'">'+esc(KINDS[k])+' <b>'+intIt(kindCount(k))+'</b></button>'}).join('');
    h+='<div class="orpBar"><div class="orpTabs" role="tablist">'+kinds+'</div><input type="search" class="orpSearch" id="orpStockSearch" placeholder="Cerca prodotto, marca, codice, barcode o fornitore" autocomplete="off" value="'+esc(R.stockSearch)+'"></div>'+
      '<div id="orpStockBody"></div>'+
      '<p class="orpNote">Valore = quantità × prezzo di vendita. «Giacenze negative»: articoli venduti senza carico, da correggere con Differenza magazzino. «Illimitate online»: prodotti Shopify con quantità da '+intIt(num(d.unlimited_from)||500)+' in su, ordinabili ma non presenti in negozio. Entrambi sono fuori dai totali.'+(cost?' Il costo riservato è visibile solo nel tuo account.':'')+' «Scarica Excel» scarica l’elenco che stai guardando (categoria, ricerca e tipo).</p>';
    root.innerHTML=h;bindStock(root);renderStockBody()
  }
  function bindStock(root){
    E('orpBack').onclick=goHome;
    var r=E('orpStockReload');if(r)r.onclick=loadStock;
    var x=E('orpStockXlsx');if(x)x.onclick=downloadStock;
    var s=E('orpStockSearch');if(s)s.oninput=function(){R.stockSearch=this.value||'';R.showAll=false;renderStockBody()};
    root.onclick=function(ev){
      var t=ev.target&&ev.target.closest?ev.target.closest('[data-orp-cat],[data-orp-kind]'):null;if(!t||!root.contains(t))return;
      if(t.hasAttribute('data-orp-kind')){R.stockKind=t.getAttribute('data-orp-kind')||'stock';R.showAll=false;render();return}
      R.stockCat=t.getAttribute('data-orp-cat')||'';R.showAll=false;renderStockBody()
    }
  }
  function downloadStock(){
    var d=R.stock;if(!d)return;
    var cost=!!d.can_view_cost,list=stockFiltered(),t=totals(list),isStock=R.stockKind==='stock';
    if(!list.length){toast('Nessun articolo da scaricare con i filtri attivi.','error');return}
    var cols=[{h:'Categoria',w:20},{h:'Prodotto',w:40},{h:'Variante',w:30},{h:'Marca',w:18},{h:'Tipo',w:20},{h:'Codice',w:13},{h:'Barcode',w:16},{h:'Parametri',w:28},{h:'Fornitore',w:26},
      {h:'Quantità',w:10,t:'int'},{h:'Prezzo di vendita',w:15,t:'eur'}];
    if(isStock)cols.push({h:'Valore di vendita',w:16,t:'eur'});
    if(cost)cols.push({h:'Costo unitario',w:14,t:'eur'});
    if(cost&&isStock)cols.push({h:'Valore a costo',w:15,t:'eur'});
    cols.push({h:'IVA',w:7});
    var rows=list.map(function(r){
      var row=[CATS[r.category]||r.category||'',r.title||'',r.variant||'',r.vendor||'',r.type||'',r.sku||'',r.barcode||'',paramsText(r),r.supplier||'',r._q,r.price!=null?num(r.price):''];
      if(isStock)row.push(round2(r._q*num(r.price)));
      if(cost)row.push(r.cost!=null?num(r.cost):'');
      if(cost&&isStock)row.push(r.cost!=null?round2(r._q*num(r.cost)):'');
      row.push(r.vat||'');
      return row
    });
    var sheets=[];
    if(isStock){
      var total=['Totale','','','','','','','','',t.pieces,'',round2(t.value)];if(cost)total.push('',round2(t.cost));total.push('');
      var sumCols=[{h:'Categoria',w:24},{h:'Articoli',w:10,t:'int'},{h:'Pezzi',w:10,t:'int'},{h:'Valore di vendita',w:18,t:'eur'}];if(cost)sumCols.push({h:'Valore a costo',w:18,t:'eur'});
      var sumRows=[];
      CAT_ORDER.concat(Object.keys(CATS).filter(function(k){return CAT_ORDER.indexOf(k)<0})).forEach(function(k){
        var g=list.filter(function(r){return r.category===k});if(!g.length)return;var gt=totals(g),row=[CATS[k]||k,gt.items,gt.pieces,round2(gt.value)];if(cost)row.push(round2(gt.cost));sumRows.push(row)
      });
      var sumTotal=['Totale',t.items,t.pieces,round2(t.value)];if(cost)sumTotal.push(round2(t.cost));
      sheets.push({name:'Giacenze',cols:cols,rows:rows,total:total,filter:true},{name:'Riepilogo',cols:sumCols,rows:sumRows,total:sumTotal})
    }else sheets.push({name:KINDS[R.stockKind],cols:cols,rows:rows,filter:true});
    var name=isStock?'Giacenze magazzino ':(R.stockKind==='negative'?'Giacenze negative ':'Prodotti illimitati online ');
    XL.download(name+todayIso()+'.xlsx',sheets);
    toast('Excel scaricato: '+intIt(list.length)+' articol'+(list.length===1?'o':'i')+'.','ok')
  }

  /* ---------- Scheda Udito: data richiamo ---------- */
  function ensureHearingField(){
    var exam=E('hearingExamDate');if(!exam||E('hearingRecallDate'))return;
    var field=exam.closest?exam.closest('.field'):exam.parentNode;if(!field||!field.parentNode)return;
    var f=document.createElement('div');f.className='field orpHearingField';
    f.innerHTML='<label for="hearingRecallDate">Data richiamo controllo</label><input id="hearingRecallDate" type="date"><small class="orpFieldHint">Facoltativa: se vuota, Report › Udito richiama 12 mesi dopo l’esame.</small>';
    field.parentNode.insertBefore(f,field.nextSibling)
  }
  function hookHearingRestore(){
    var fn=window.clientRestoreSingleSheet;if(typeof fn!=='function'||fn.__orpHooked)return;
    var wrapped=function(snap){
      var out=fn.apply(this,arguments);
      try{if(snap&&snap.sheetType==='hearing'){var el=E('hearingRecallDate'),map=snap.elements||{};if(el&&!map.hearingRecallDate)el.value=''}}catch(e){}
      return out
    };
    wrapped.__orpHooked=true;window.clientRestoreSingleSheet=wrapped
  }

  /* ---------- Avvio ---------- */
  function tick(){
    try{
      ensureHearingField();hookHearingRestore();
      if(isAdminMode()){if(R.open)closeReport();return}
      if(E('mainApp')&&E('moduleNav')){ensureNav();ensurePanel()}
      if(R.open&&otherRootVisible())closeReport();else if(R.open)markActive()
    }catch(e){if(window.console)console.error('Optyker Report',e)}
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);else tick();
  setInterval(tick,1000);
  window.OPTYKER_REPORT={version:VERSION,open:openReport,close:closeReport,xlsx:XL};
})();
