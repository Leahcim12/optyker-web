/* Runs inside the native agenda closure: selection uses the existing client ID. */
var oaLookupSession='',oaLookupPending=null,oaLookupError='',oaLookupTimer=0;
function oaLookupClients(){return window.OPTYKER_CLOUD&&Array.isArray(OPTYKER_CLOUD.clients)?OPTYKER_CLOUD.clients:[]}
function oaLookupReset(){
  clearTimeout(oaLookupTimer);E('oaClient').value='';E('oaClientSearch').value='';
  E('oaClientResults').replaceChildren();E('oaClientSearch').setAttribute('aria-expanded','false');
  oaLookupError='';oaLookupRender();oaLookupLoad();
}
function oaLookupLoad(){
  var c=window.OPTYKER_CLOUD||{},session=String(c.username||'')+'\n'+String(c.password||'');
  if(oaLookupSession!==session){oaLookupSession=session;oaLookupPending=null;oaLookupError=''}
  if(oaLookupClients().length||oaLookupPending||typeof window.cloudLoadClients!=='function')return;
  oaLookupError='';var task=Promise.resolve().then(function(){return cloudLoadClients()});oaLookupPending=task;
  task.catch(function(e){if(oaLookupSession===session)oaLookupError=String(e.message||e)}).finally(function(){
    if(oaLookupPending!==task)return;oaLookupPending=null;
    var now=window.OPTYKER_CLOUD||{};
    if(session!==String(now.username||'')+'\n'+String(now.password||''))return;
    if(E('oaNewModal').classList.contains('open'))oaLookupRender();
  });
}
function oaLookupPick(c){
  E('oaClient').value=c.id;E('oaClientSearch').value=[c.surname,c.name].filter(Boolean).join(' ');
  E('oaFirst').value=c.name||'';E('oaLast').value=c.surname||'';
  E('oaEmail').value=c.email||'';E('oaPhone').value=c.phone||c.phoneHome||c.home_phone||'';
  E('oaClientResults').replaceChildren();E('oaClientSearch').setAttribute('aria-expanded','false');
  E('oaClientSearchStatus').textContent='Cliente selezionato. Puoi proseguire con l’appuntamento.';
}
function oaLookupRender(){
  var input=E('oaClientSearch'),box=E('oaClientResults'),hint=E('oaClientSearchStatus');if(!input||!box)return;
  var q=input.value.trim();box.replaceChildren();input.setAttribute('aria-expanded','false');
  if(E('oaClient').value)return;
  if(!q){hint.textContent='Cerca per nome, cognome o telefono, oppure compila i dati manualmente.';return}
  var rows=oaLookupClients().filter(function(c){return window.optykerClientMatches(c,q)}),shown=rows.slice(0,40);
  hint.textContent=oaLookupError?'Ricerca non completata: '+oaLookupError:oaLookupPending?'Caricamento clienti…':rows.length?rows.length+' clienti trovati'+(rows.length>40?' · Affina la ricerca per vedere gli altri.':'.'):'Nessun cliente trovato.';
  shown.forEach(function(c){
    var b=document.createElement('button');b.type='button';b.className='oaClientResult';b.setAttribute('role','option');
    var title=document.createElement('strong');title.textContent=[c.surname,c.name].filter(Boolean).join(' ')||'Cliente';
    var meta=document.createElement('span');meta.textContent=[c.phone||c.phoneHome||c.home_phone,c.email].filter(Boolean).join(' · ');
    b.append(title,meta);b.onclick=function(){oaLookupPick(c);input.focus()};
    b.onkeydown=function(e){if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();var next=e.key==='ArrowDown'?b.nextElementSibling:b.previousElementSibling;(next||input).focus()}if(e.key==='Escape'){e.preventDefault();box.replaceChildren();input.setAttribute('aria-expanded','false');input.focus()}};
    box.appendChild(b);
  });input.setAttribute('aria-expanded',shown.length?'true':'false');
}
E('oaClientSearch').oninput=function(){
  if(E('oaClient').value){E('oaClient').value='';['oaFirst','oaLast','oaEmail','oaPhone'].forEach(function(id){E(id).value=''})}
  clearTimeout(oaLookupTimer);oaLookupTimer=setTimeout(oaLookupRender,120);
};
E('oaClientSearch').onfocus=function(){oaLookupLoad()};
E('oaClientSearch').onkeydown=function(e){
  if(e.key==='ArrowDown'){oaLookupRender();var b=E('oaClientResults').firstElementChild;if(b){e.preventDefault();b.focus()}}
  if(e.key==='Enter'){e.preventDefault();oaLookupRender();var first=E('oaClientResults').firstElementChild;if(first)first.focus()}
  if(e.key==='Escape'){clearTimeout(oaLookupTimer);E('oaClientResults').replaceChildren();this.setAttribute('aria-expanded','false');e.preventDefault();e.stopPropagation()}
};
