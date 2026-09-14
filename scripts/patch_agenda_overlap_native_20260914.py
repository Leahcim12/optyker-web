from pathlib import Path

MARK='OPTYKER_AGENDA_NATIVE_OVERLAP_V2'
FILES=[Path('_site/index.html'),Path('_site/gestionale-v2/index.html'),Path('_site/gestionale-v3/index.html')]

replacement=r'''/* OPTYKER_AGENDA_NATIVE_OVERLAP_V2 */
var laid=ev.map(function(x){
  var st=new Date(x.starts_at),en=new Date(x.ends_at),sm=st.getHours()*60+st.getMinutes(),em=en.getHours()*60+en.getMinutes();
  if(em<=sm)em=sm+30;
  return{x:x,sm:sm,em:em,col:0,cols:1}
}).sort(function(a,b){
  return a.sm-b.sm||a.em-b.em||String(a.x.operator_username||'').localeCompare(String(b.x.operator_username||''))||String(a.x.id||'').localeCompare(String(b.x.id||''))
});
var overlapActive=[],overlapCluster=[],overlapMax=1;
function finishOverlapCluster(){
  overlapCluster.forEach(function(q){q.cols=overlapMax});
  overlapCluster=[];overlapMax=1
}
laid.forEach(function(it){
  overlapActive=overlapActive.filter(function(q){return q.em>it.sm});
  if(!overlapActive.length&&overlapCluster.length)finishOverlapCluster();
  var used={};overlapActive.forEach(function(q){used[q.col]=1});
  var col=0;while(used[col])col++;
  it.col=col;overlapActive.push(it);overlapCluster.push(it);overlapMax=Math.max(overlapMax,overlapActive.length,col+1)
});
if(overlapCluster.length)finishOverlapCluster();
laid.forEach(function(it){
  var x=it.x,top=((it.sm-lo*60)/60)*scale,eh=Math.max(30,((it.em-it.sm)/60)*scale-3),gap=2,left=(it.col/it.cols)*100,right=((it.cols-it.col-1)/it.cols)*100;
  h+='<div class="oaTimedEvent" data-native-overlap-cols="'+it.cols+'" data-native-overlap-col="'+it.col+'" style="top:'+Math.max(0,top)+'px;height:'+eh+'px;left:calc('+left+'% + '+gap+'px)!important;right:calc('+right+'% + '+gap+'px)!important">'+eventHtml(x,true)+'</div>'
});'''

for path in FILES:
    text=path.read_text(encoding='utf-8')
    if MARK not in text:
        anchor="var day=plus(a,j),key=ds(day),ev=items.filter"
        a=text.find(anchor)
        if a<0:
            raise SystemExit(f'Agenda render anchor not found in {path}')
        start=text.find("ev.forEach(function(x){",a)
        if start<0:
            raise SystemExit(f'Agenda event loop not found in {path}')
        end_marker="});h+='</div>'"
        end=text.find(end_marker,start)
        if end<0:
            raise SystemExit(f'Agenda event loop end not found in {path}')
        text=text[:start]+replacement+text[end+3:]
    text=text.replace('optyker-interaction-guard.js?v=20260914-unlock2','optyker-interaction-guard.js?v=20260914-overlap2')
    path.write_text(text,encoding='utf-8')

main=FILES[0].read_text(encoding='utf-8')
if main.count(MARK)!=1:
    raise SystemExit('Native overlap patch must exist exactly once')
if 'data-native-overlap-cols' not in main or 'left:calc('+"'" not in main:
    raise SystemExit('Native overlap renderer incomplete')
if 'optyker-interaction-guard.js?v=20260914-overlap2' not in main:
    raise SystemExit('Interaction guard cache-buster not updated')
if FILES[1].read_bytes()!=FILES[0].read_bytes() or FILES[2].read_bytes()!=FILES[0].read_bytes():
    raise SystemExit('Desktop aliases differ after agenda overlap patch')
print('Agenda overlapping appointments render side by side')
