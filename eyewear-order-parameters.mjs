// Order measurements only: these fields never change prices or prescriptions.
export const orderParameterFields = [
  ['height_od_mm','Altezza lente DX', 'mm',0,100],
  ['height_os_mm','Altezza lente SX', 'mm',0,100],
  ['pd_od_mm','Distanza interpupillare monoculare DX','mm',0,100],
  ['pd_os_mm','Distanza interpupillare monoculare SX','mm',0,100],
  ['pantoscopic_angle_deg','Angolo pantoscopico','°',-90,90],
  ['wrap_angle_deg','Angolo di avvolgimento','°',-90,90],
];
export function normalizeOrderParameters(input={}){
  const source=input&&typeof input==='object'?input:{},out={version:1};
  for(const [key,label,,min,max] of orderParameterFields){
    const raw=source[key];
    if(raw==null||String(raw).trim()===''){out[key]=null;continue}
    if(!['number','string'].includes(typeof raw))throw new Error(label+': inserisci un numero valido.');
    const n=Number(String(raw).trim().replace(',','.'));
    if(!Number.isFinite(n)||n<min||n>max)throw new Error(label+': valore non valido ('+min+' / '+max+').');
    out[key]=Math.round(n*100)/100;
  }
  out.custom_pantoscopic=source.custom_pantoscopic===true;
  out.custom_wrap=source.custom_wrap===true;
  for(const [flag,key,label] of [['custom_pantoscopic','pantoscopic_angle_deg','pantoscopico'],['custom_wrap','wrap_angle_deg','di avvolgimento']]){
    if(out[flag]&&out[key]==null)throw new Error('Inserisci l’angolo '+label+' personalizzato.');
    if(!out[flag])out[key]=null;
  }
  return out;
}
export function orderParameterRows(value){
  const p=normalizeOrderParameters(value);
  return orderParameterFields.filter(([key])=>p[key]!=null).map(([key,label,unit])=>[label,String(p[key]).replace('.',',')+' '+unit]);
}
