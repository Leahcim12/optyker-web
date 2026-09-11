// Shared, versioned document schema: reference photo + explicit MDR additions.
export const VERSION='20260911-delivery1';
export const CLEANING=[
 'Prima della pulizia, lavare le mani e rimuovere la polvere sciacquando delicatamente l’occhiale con acqua corrente a temperatura ambiente.',
 'Usare una piccola quantità di sapone neutro delicato compatibile con i materiali, oppure un detergente specifico per lenti secondo le istruzioni del fabbricante. Risciacquare se richiesto dal prodotto.',
 'Asciugare con un panno in microfibra pulito per occhiali, senza sfregare energicamente. Non strofinare a secco lenti molto sporche e non usare carta, indumenti o tessuti abrasivi.',
 'Evitare acetone, solventi, detergenti domestici e disinfettanti non dichiarati compatibili con lenti, trattamenti e montatura. I prodotti specifici vanno usati solo come indicato dal produttore.',
 'Pulire anche naselli e aste. Sostenere la montatura vicino alla lente durante la pulizia, senza torcerla. Lavare la microfibra senza ammorbidente.',
 'Riporre l’occhiale nell’astuccio; non appoggiarlo con le lenti verso il basso. Evitare acqua calda, fonti di calore, cruscotti al sole e lavastoviglie.',
 'Non piegare o riparare autonomamente la montatura. Per allentamenti, graffi, rotture, disagio o problemi di visione rivolgersi all’ottica. Seguire le indicazioni d’uso specifiche e del fabbricante riportate sotto.'
];
export const RECEIPT='Il sottoscritto dichiara di ricevere, contestualmente all’occhiale indicato, copia della presente dichiarazione, con i dati dei componenti e le istruzioni d’uso, pulizia, manutenzione e conservazione. Dichiara di aver ricevuto spiegazioni sulle corrette modalità d’impiego e sulle avvertenze riportate, inclusi i rischi derivanti da una non corretta osservanza delle istruzioni. La firma attesta la ricezione e non costituisce rinuncia a diritti o garanzie.';
export const DECLARATION='Il fabbricante identificato nel documento dichiara sotto la propria responsabilità che il dispositivo è destinato esclusivamente al portatore indicato ed è stato realizzato in base alla prescrizione e alle caratteristiche specifiche riportate. Il dispositivo è conforme ai requisiti generali di sicurezza e prestazione applicabili dell’allegato I del Regolamento (UE) 2017/745, salvo i requisiti eventualmente non interamente rispettati, con relativa motivazione, indicati nella sezione dedicata.';
export const frameFields=[['supplier','Fornitore'],['brand','Marca'],['model','Modello'],['material','Materiale'],['size','Calibro'],['bridge','Ponte'],['color','Colore'],['lot','Lotto'],['code','Codice / barcode'],['origin','Provenienza','select',['Fornita dall’ottica','Del cliente']],['ce','Marcatura CE componente','select',['Da verificare','Sì - verificata','Non documentata','Non applicabile']],['technical_file','Fascicolo tecnico / riferimento produttore']];
export const lensFields=[['supplier','Fornitore'],['brand','Marca'],['name','Prodotto / modello'],['material','Materiale'],['index','Indice'],['diameter','Diametro Ø (mm)'],['filter','Categoria filtro'],['color','Colore / fotocromia'],['treatments','Trattamenti'],['supplements','Supplementi'],['family','Famiglia'],['lot','Lotto'],['code','Codice'],['origin','Provenienza','select',['Fornita dall’ottica','Del cliente']],['ce','Marcatura CE componente','select',['Da verificare','Sì - verificata','Non documentata','Non applicabile']],['technical_file','Fascicolo tecnico / riferimento produttore']];
export const GROUPS=[
 ['Fabbricante / intestazione',[
 ['issuer_name','Ragione sociale del fabbricante *'],['issuer_address','Indirizzo del fabbricante e luogo di fabbricazione *'],['issuer_vat','Partita IVA *'],['issuer_tax','Codice fiscale *'],['issuer_phone','Telefono'],['issuer_email','Email'],['issuer_website','Sito web'],['issuer_ministry','Registrazione Ministero della Salute *'],['issuer_agent','Mandatario (se applicabile)']]],
 ['Portatore e consegna',[
 ['client_name','Nome e cognome del portatore *'],['client_fiscal','Codice fiscale / identificativo *'],['client_address','Indirizzo, CAP, città e provincia *'],['declaration_date','Data dichiarazione *','date'],['delivery_date','Data effettiva di consegna *','date'],['signer_name','Nome e cognome di chi firma per ricezione *'],['signer_role','Qualifica del firmatario','select',['Portatore','Genitore / tutore / rappresentante']],['signer_capacity','Titolo della rappresentanza (se non firma il portatore)']]],
 ['Origine della prescrizione',[
 ['prescription_origin','Origine *','select',['','Come da prescrizione allegata','Come da suo occhiale in uso su precedente prescrizione']],['prescription_author','Nome della persona autorizzata che ha prescritto *'],['prescription_qualification','Qualifica / abilitazione del prescrittore *'],['prescription_facility','Struttura sanitaria (se applicabile)'],['prescription_ref','Riferimento prescrizione / documento conservato *'],['prescription_date','Data prescrizione *','date'],['axis_convention','Convenzione asse','select',['TABO','Internazionale']]]],
 ['Montatura',frameFields.map(([k,...v])=>['frame_'+k,...v])],
 ...['od','os'].map(side=>['Lente '+(side==='od'?'DX':'SX'),lensFields.map(([k,...v])=>[side+'_'+k,...v])]),
 ['Indicazioni, verifiche e dichiarazione',[
 ['intended_use','Destinazione d’uso / indicazioni specifiche *','textarea'],['special_characteristics','Caratteristiche specifiche richieste (oltre ai parametri ottici)'],['manufacturer_instructions','Istruzioni e avvertenze specifiche del fabbricante / riferimenti','textarea'],['exceptions','Requisiti non interamente rispettati e motivazioni; scrivere “Nessuno” se verificato *','textarea'],['unknown_reasons','Motivo dei dati dei componenti non disponibili','textarea'],['operator_name','Nome del responsabile che firma per il fabbricante *'],['operator_capacity','Qualifica del responsabile *']]]
];
export const RXCOLS=[['sphere','SFERA'],['cylinder','CIL.'],['axis','AX'],['prism','PRISMA'],['base','BASE'],['sdi','S.D.I. (mm)']];
export const RXROWS=[['L','Lontano'],['M','Intermedio'],['V','Vicino']];
export const ALL_FIELDS=[...GROUPS.flatMap(g=>g[1]),...['od','os'].flatMap(side=>RXROWS.flatMap(([row])=>RXCOLS.map(([col,label])=>[side+'_'+row+'_'+col,side.toUpperCase()+' '+row+' '+label])))];
const string=v=>typeof v==='string'||typeof v==='number'?String(v).trim():'';
export function defaults(x){
 const s=x.sheet||{},d=s.data||{},f=d.frame||{},l=d.lens||{},c=x.client||{},o=Object.fromEntries(ALL_FIELDS.map(([k,,type,choices])=>[k,type==='select'?choices[0]:'']));
 Object.assign(o,{issuer_name:'',issuer_address:'Via Primo Maggio 4, 24040 Lallio (BG)',issuer_ministry:'419926',client_name:[c.name,c.surname].filter(Boolean).join(' '),client_fiscal:c.fiscal||'',client_address:[c.street,c.street_number,c.postal_code,c.city,c.province].filter(Boolean).join(' '),operator_name:x.operator||'',intended_use:'Compensazione ottica del difetto visivo secondo la prescrizione indicata.'});
 if(x.previous_issuer)Object.assign(o,x.previous_issuer);
 frameFields.forEach(([k])=>{if(f[k]!=null)o['frame_'+k]=string(f[k]);});o.frame_code=string(f.barcode||f.sku||f.code);o.frame_origin=string(f.type).toLowerCase()==='del cliente'?'Del cliente':'Fornita dall’ottica';o.frame_ce='Da verificare';
 for(const side of ['od','os']){const e=l['lens_'+side],own=string(l['lens_type_'+side]).toLowerCase()==='del cliente'||e?.client_owned===true,part=e&&typeof e==='object'?e:l;
  o[side+'_origin']=own?'Del cliente':'Fornita dall’ottica';o[side+'_family']=string(l['lens_type_'+side]||part.type||l.lens_type);o[side+'_ce']='Da verificare';
  if(!own){for(const [k] of lensFields)if(part[k]!=null)o[side+'_'+k]=Array.isArray(part[k])?part[k].join(', '):string(part[k]);o[side+'_name']=string(part.lens_name||part.name);o[side+'_index']=string(part.refractive_index||l.refractive_index);o[side+'_treatments']=Array.isArray(part.treatments||l.treatments)?(part.treatments||l.treatments).join(', '):'';}
 }
 for(const [k,v] of Object.entries(x.material?.data||{}))if(k in o&&k!=='delivery_date'&&typeof v==='string')o[k]=v;
 o.signer_name=o.client_name;return o;
}
export function validate(raw,now=new Date()){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Compila i dati della dichiarazione.');
 const out={};for(const [k,label,type,choices] of ALL_FIELDS){const value=raw[k]??'';if(typeof value!=='string')throw Error('Campo non valido: '+label);const v=value.trim();if(v.length>(type==='textarea'?1200:180))throw Error('Testo troppo lungo: '+label);if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v))throw Error('Caratteri non validi: '+label);if(type==='select'&&!choices.includes(v))throw Error('Scelta non valida: '+label);if(label.endsWith('*')&&!v)throw Error('Completa: '+label.replace(' *',''));out[k]=v;}
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 for(const k of ['declaration_date','delivery_date','prescription_date']){const v=out[k];if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||isNaN(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v||v<'2000-01-01'||v>today)throw Error('Data non valida o futura: '+k);}
 if(out.prescription_date>out.delivery_date)throw Error('La prescrizione non può essere successiva alla consegna.');
 if(out.signer_role!=='Portatore'&&!out.signer_capacity)throw Error('Indica il titolo del genitore, tutore o rappresentante.');
 if(out.signer_role==='Portatore'&&out.signer_name.toLocaleLowerCase('it')!==out.client_name.toLocaleLowerCase('it'))throw Error('Il firmatario deve corrispondere al portatore oppure va indicata la rappresentanza.');
 for(const side of ['frame','od','os']){if(out[side+'_ce']==='Da verificare')throw Error('Verifica la marcatura CE del componente '+side.toUpperCase()+'.');if(out[side+'_ce']==='Sì - verificata'&&!out[side+'_technical_file'])throw Error('Indica il fascicolo / riferimento del componente '+side.toUpperCase()+'.');}
 const missing=[];for(const pre of ['frame','od','os'])for(const k of ['supplier','brand','material','lot'])if(!out[pre+'_'+k])missing.push(pre+' '+k);
 if(missing.length&&!out.unknown_reasons)throw Error('Spiega nelle note perché alcuni dati dei componenti non sono disponibili: '+missing.join(', '));
 for(const side of ['od','os']){if(!out[side+'_name']||!out[side+'_family']||!out[side+'_L_sphere'])throw Error('Completa prodotto, famiglia e sfera da lontano della lente '+side.toUpperCase()+'.');
  for(const [row] of RXROWS)for(const [col] of RXCOLS){const v=out[side+'_'+row+'_'+col];if(!v||col==='base')continue;const n=Number(v.replace(',','.'));if(!Number.isFinite(n))throw Error('Parametro ottico non numerico: '+side+' '+row+' '+col);if(col==='axis'&&(n<0||n>180)||col==='sdi'&&(n<0||n>100)||col==='prism'&&(n<0||n>100)||['sphere','cylinder'].includes(col)&&Math.abs(n)>50)throw Error('Parametro fuori intervallo: '+side+' '+row+' '+col);}
 }
 if(raw.technical_verified!==true||raw.conformity_confirmed!==true)throw Error('Il responsabile deve confermare dati tecnici, intestazione e conformità prima della firma.');
 return {...out,technical_verified:true,conformity_confirmed:true,version:VERSION};
}
