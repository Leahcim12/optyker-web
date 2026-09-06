/* OPTYKER_EYEWEAR_DISCOUNTS_V10 */
window.OPTYKER_EYEWEAR_DISCOUNTS_BUILD='20260906-eyewear-discounts-v10';
API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-eyewear-api-v5';

function promoFrameSupplied(){return !!txt(val('eyFrameType'))&&!isClient(val('eyFrameType'))}
function promoLensQty(){return supplied().length}
function promoBlueSelected(){return treatments().indexOf('Filtro luce blu')>=0}
function promoNeutralLenses(){var a=supplied();return !!a.length&&a.every(function(s){return /neutra/.test(low(sideType(s)))})}
function promoStarFrame(){return /stella/.test(low([val('eyFrameBrand'),val('eyFrameModel'),val('eyFrameDescription')].join(' ')))}
function promoIndexValue(){var v=txt(val('eyLensIndexChoice')||'1.5').replace(',','.');if(v==='1.50')v='1.5';if(v==='1.60')v='1.6';return v}
function promoFixedNearby(code){var v=promoIndexValue(),m={'1.5':{VICINO:100,VICINOHARD:120,VICINOHMC:140},'1.6':{VICINO:120,VICINOHARD:140,VICINOHMC:160},'1.67':{VICINO:140,VICINOHARD:160,VICINOHMC:180}};return m[v]&&m[v][code]!=null?m[v][code]:null}
function promoEligible(code){
  var frame=promoFrameSupplied(),qty=promoLensQty(),idx=promoIndexValue();
  if(!code)return true;
  if(code==='STUDENTIBLU')return frame&&qty>0&&promoBlueSelected();
  if(code==='OCCHIALI15')return frame&&qty>0;
  if(code==='MONTATURA30')return frame&&qty===0;
  if(code==='LENTI15')return !frame&&qty>0;
  if(code==='VICINO'||code==='VICINOHARD'||code==='VICINOHMC')return qty>0&&['1.5','1.6','1.67'].indexOf(idx)>=0;
  return false
}
function promoLabel(code){
  if(code==='STUDENTIBLU'){
    var pack=promoNeutralLenses()?100:150;
    return 'STUDENTIBLU · '+(promoStarFrame()?'montatura STELLA + ':'')+(promoNeutralLenses()?'lenti luce blu neutre':'lenti luce blu')+' · € '+pack;
  }
  if(code==='OCCHIALI15')return 'OCCHIALI · 15%';
  if(code==='MONTATURA30')return 'MONTATURA · 30%';
  if(code==='LENTI15')return 'LENTI · 15%';
  if(code==='VICINO'||code==='VICINOHARD'||code==='VICINOHMC')return code+' · € '+promoFixedNearby(code)+' · indice '+promoIndexValue();
  return 'Nessuno sconto'
}
function promoAvailable(){
  var out=[['','Nessuno sconto']];
  ['STUDENTIBLU','OCCHIALI15','MONTATURA30','LENTI15','VICINO','VICINOHARD','VICINOHMC'].forEach(function(c){if(promoEligible(c))out.push([c,promoLabel(c)])});
  return out
}
function ensureDiscountUI(){
  var old=E('eyDiscount');if(!old)return;
  old.value='0';old.disabled=true;old.setAttribute('aria-hidden','true');
  var oldWrap=old.closest('.eyField');if(oldWrap)oldWrap.style.display='none';
  var sel=E('eyDiscountProgram');
  if(!sel){
    var box=document.createElement('div');box.id='eyDiscountProgramBox';box.className='eyField eyDiscountProgramBox';
    box.innerHTML='<label>Sconto / promozione</label><select id="eyDiscountProgram"></select><small id="eyDiscountProgramHint">Sono mostrati solo gli sconti utilizzabili con la configurazione corrente.</small>';
    var target=oldWrap||old;
    if(target.parentNode)target.parentNode.insertBefore(box,target);
    sel=E('eyDiscountProgram');
    sel.addEventListener('change',function(){renderSummary()})
  }
  refreshDiscountOptions()
}
var _promoRefreshing=false;
function refreshDiscountOptions(){
  var sel=E('eyDiscountProgram');if(!sel||_promoRefreshing)return;
  _promoRefreshing=true;
  var prev=txt(sel.value),opts=promoAvailable();
  sel.innerHTML=opts.map(function(x){return '<option value="'+esc(x[0])+'">'+esc(x[1])+'</option>'}).join('');
  sel.value=opts.some(function(x){return x[0]===prev})?prev:'';
  var hint=E('eyDiscountProgramHint');if(hint){
    var c=txt(sel.value);hint.textContent=c?promoLabel(c):'Sono mostrati solo gli sconti utilizzabili con la configurazione corrente.'
  }
  _promoRefreshing=false
}
function promotionCode(){var s=E('eyDiscountProgram');return s&&promoEligible(txt(s.value))?txt(s.value):''}
function promoMoney(v){return num(v)}
function promoInfo(base){
  var code=promotionCode(),regular=promoMoney(base.total),total=regular,amount=0,fixed=null,detail='';
  if(!code)return {code:'',name:'',eligible:true,regular_total:regular,total:regular,adjustment:0,discount_amount:0,fixed_price:null,detail:''};
  if(code==='OCCHIALI15'){
    amount=promoMoney((base.frame+base.gross)*0.15);total=promoMoney(regular-amount);detail='15% su montatura e lenti';
  }else if(code==='MONTATURA30'){
    amount=promoMoney(base.frame*0.30);total=promoMoney(regular-amount);detail='30% sulla montatura';
  }else if(code==='LENTI15'){
    amount=promoMoney(base.gross*0.15);total=promoMoney(regular-amount);detail='15% sulle lenti';
  }else if(code==='STUDENTIBLU'){
    fixed=promoNeutralLenses()?100:150;
    var blue=0;(base.treatments||[]).forEach(function(x){if(x.name==='Filtro luce blu')blue+=num(x.total)});
    var oldBase=promoMoney(base.frame+base.gross+blue),newBase=promoMoney((promoStarFrame()?0:base.frame)+fixed);
    total=promoMoney(regular-oldBase+newBase);amount=promoMoney(regular-total);
    detail=(promoStarFrame()?'Montatura con STELLA inclusa · ':'Montatura aggiunta al pacchetto · ')+(promoNeutralLenses()?'lenti luce blu neutre':'lenti luce blu')+' € '+fixed;
  }else if(code==='VICINO'||code==='VICINOHARD'||code==='VICINOHMC'){
    fixed=promoFixedNearby(code);
    total=promoMoney(regular-base.gross-base.index.total+fixed);amount=promoMoney(regular-total);
    detail='Prezzo fisso lenti '+code+' indice '+promoIndexValue()+': € '+fixed;
  }
  return {code:code,name:promoLabel(code),eligible:true,regular_total:regular,total:total,adjustment:promoMoney(total-regular),discount_amount:amount,fixed_price:fixed,detail:detail}
}

var _optykerV9Pricing=pricing;
pricing=function(){
  if(E('eyDiscount'))E('eyDiscount').value='0';
  var p=_optykerV9Pricing();p.discount=0;p.disc=0;p.net=p.gross;
  p.promotion=promoInfo(p);p.total=p.promotion.total;return p
};
var _optykerV9Payload=payload;
payload=function(){
  var d=_optykerV9Payload(),p=d.pricing_client||pricing(),pr=p.promotion||promoInfo(p);
  d.discount_percent=0;d.promotion_code=pr.code;d.promotion_name=pr.name;d.promotion_pricing=pr;d.pricing_client=p;return d
};
var _optykerV9RenderSummary=renderSummary;
renderSummary=function(){
  refreshDiscountOptions();_optykerV9RenderSummary();
  var box=E('eySummary'),p=pricing(),pr=p.promotion;if(!box||!pr||!pr.code)return;
  var totalRow=box.querySelector('.eySummaryRow.total');if(!totalRow)return;
  var row=document.createElement('div');row.className='eySummaryRow discount eyPromotionSummary';
  var adj=pr.adjustment,sign=adj<0?'− ':adj>0?'+ ':'';
  row.innerHTML='<span>'+esc(pr.name)+'<small style="display:block;margin-top:2px;font-size:7px;color:#718493">'+esc(pr.detail)+'</small></span><b>'+sign+esc(euro(Math.abs(adj)))+'</b>';
  box.insertBefore(row,totalRow)
};

function ensurePromoStyle(){
  if(E('eyPromoV10Css'))return;var st=document.createElement('style');st.id='eyPromoV10Css';
  st.textContent='.eyDiscountProgramBox{margin:12px 0;padding:11px;border:1px solid #cfe0eb;border-radius:10px;background:#f6fbfe}.eyDiscountProgramBox small{display:block;margin-top:5px;font-size:8px;color:#718493}.eyPromotionSummary span{max-width:78%}';document.head.appendChild(st)
}
function promoRefresh(){ensureDiscountUI();ensurePromoStyle();refreshDiscountOptions();renderSummary()}
document.addEventListener('change',function(ev){if(E('eyewearPanel')&&E('eyewearPanel').contains(ev.target)&&ev.target!==E('eyDiscountProgram'))setTimeout(promoRefresh,30)},true);
document.addEventListener('input',function(ev){if(E('eyewearPanel')&&E('eyewearPanel').contains(ev.target))setTimeout(promoRefresh,30)},true);
setTimeout(promoRefresh,80);setInterval(function(){if(E('eyewearPanel')){ensureDiscountUI();refreshDiscountOptions()}},700);
