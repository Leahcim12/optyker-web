from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_DOM_READY_BOOT_V1'
if MARK in s:
    raise SystemExit(0)

old="""window.onload = function(){
  maximizeApplicationWindow();
  renderSymptoms();
  updateAuto();
  if(g('accPanel')) g('accPanel').style.display='block';
  if(g('binPanel')) g('binPanel').style.display='block';
  bindPrescriptionAxisInputs();
  updatePrescriptionLinkedData();
  refreshPrescriptionGoniometers();
  renderVisualExam();
  renderIndicationsUse();
  drawHearingAudiogram();
  clientLoadArchiveConfig();
  cloudDecorate();
  clientSidebarInit();
  optykerShowLogin();
};"""

new="""/* OPTYKER_DOM_READY_BOOT_V1 */
var optykerBootDone=false;
function optykerBootApp(){
  if(optykerBootDone)return;
  optykerBootDone=true;
  try{maximizeApplicationWindow();}catch(e){}
  try{renderSymptoms();}catch(e){}
  try{updateAuto();}catch(e){}
  try{if(g('accPanel')) g('accPanel').style.display='block';}catch(e){}
  try{if(g('binPanel')) g('binPanel').style.display='block';}catch(e){}
  try{bindPrescriptionAxisInputs();}catch(e){}
  try{updatePrescriptionLinkedData();}catch(e){}
  try{refreshPrescriptionGoniometers();}catch(e){}
  try{renderVisualExam();}catch(e){}
  try{renderIndicationsUse();}catch(e){}
  try{drawHearingAudiogram();}catch(e){}
  try{clientLoadArchiveConfig();}catch(e){}
  try{cloudDecorate();}catch(e){}
  try{clientSidebarInit();}catch(e){}
  try{optykerShowLogin();}catch(e){}
  setTimeout(function(){try{window.stop()}catch(e){}},120);
}
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',optykerBootApp,{once:true});
}else{
  setTimeout(optykerBootApp,0);
}
window.addEventListener('load',optykerBootApp,{once:true});"""

if old not in s:
    raise SystemExit('Bootstrap window.onload non trovato')
s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')
print('Bootstrap Optyker spostato su DOMContentLoaded')
