import {CLEANING,RECEIPT,DECLARATION,frameFields,lensFields,RXCOLS,RXROWS,VERSION} from '../../../delivery-schema.mjs';
import {LOGO} from './logo.mjs';
export const to64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);};
export const from64=s=>Uint8Array.from(atob(s.replace(/^data:[^,]+,/,'')),c=>c.charCodeAt(0));
export async function makePreview(lib,values,meta){
 const {PDFDocument,StandardFonts,rgb}=lib,pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),logo=await pdf.embedPng(LOGO);
 pdf.setTitle('Dichiarazione di conformità - '+meta.reference);pdf.setAuthor(values.issuer_name);pdf.setCreator('Optyker '+VERSION);pdf.setCreationDate(new Date(meta.server_time));pdf.setModificationDate(new Date(meta.server_time));
 const ink=rgb(.09,.15,.23),muted=rgb(.3,.36,.43),rule=rgb(.8,.83,.87),wash=rgb(.95,.97,.98),W=595.28,H=841.89,L=28,CW=W-56;let page,y;
 const txt=s=>String(s??'').replace(/[\u2011\u2013\u2014]/g,'-').replace(/\u202f|\u00a0/g,' ').replace(/[^\x20-\x7e\xa0-\xff\u20ac\u2018\u2019\u201c\u201d\u2022\n]/g,'?');
 const wrap=(s,width,size=9,font=normal)=>{const lines=[];for(const para of txt(s).split('\n')){let line='';for(let word of para.split(/\s+/)){while(font.widthOfTextAtSize(word,size)>width){let cut=word.length-1;while(cut>1&&font.widthOfTextAtSize(word.slice(0,cut),size)>width)cut--;if(line){lines.push(line);line='';}lines.push(word.slice(0,cut));word=word.slice(cut);}const t=line?line+' '+word:word;if(font.widthOfTextAtSize(t,size)>width){lines.push(line);line=word;}else line=t;}lines.push(line);}return lines;};
 const draw=(s,x,yy,size=9,font=normal,color=ink)=>page.drawText(txt(s),{x,y:yy,size,font,color});
 function newPage(){page=pdf.addPage([W,H]);const top=H-26;page.drawImage(logo,{x:L,y:top-80,width:80,height:80});draw('Ottica Visual Care',L+96,top-20,16,bold);let hy=top-40;for(const t of [values.issuer_address,'Registrazione Ministero della Salute n. '+values.issuer_ministry]){for(const line of wrap(t,CW-100,10)){draw(line,L+96,hy,10);hy-=12;}hy-=7;}y=Math.min(top-91,hy-6);page.drawLine({start:{x:L,y},end:{x:W-L,y},thickness:1,color:rule});y-=20;}
 function ensure(h){if(y-h<45)newPage();}
 function paragraph(s,size=9,font=normal){for(const line of wrap(s,CW,size,font)){ensure(size+5);draw(line,L,y,size,font);y-=size+4;}y-=4;}
 function heading(s){ensure(32);y-=7;draw(s,L,y,11,bold);y-=8;page.drawLine({start:{x:L,y},end:{x:W-L,y},thickness:.6,color:rule});y-=16;}
 function table(rows,widths,header=false){for(let j=0;j<rows.length;j++){const lines=rows[j].map((s,i)=>wrap(s||'Non indicato',widths[i]-10,8.7,i===0?bold:normal));const h=Math.max(...lines.map(x=>x.length))*11+9;ensure(h+2);let x=L;for(let i=0;i<widths.length;i++){page.drawRectangle({x,y:y-h,width:widths[i],height:h,borderColor:rule,borderWidth:.5,color:i===0||header&&j===0?wash:rgb(1,1,1)});lines[i].forEach((line,k)=>draw(line,x+5,y-12-k*11,8.7,i===0||header&&j===0?bold:normal));x+=widths[i];}y-=h;}y-=5;}
 newPage();paragraph('Dichiarazione di conformità per occhiale correttivo su misura',15,bold);paragraph('Regolamento (UE) 2017/745 - dichiarazione ai sensi dell’allegato XIII',9);paragraph('Fabbricante: '+values.issuer_name+' | P. IVA: '+values.issuer_vat+' | C.F.: '+values.issuer_tax,9);
 paragraph([values.issuer_phone,values.issuer_email,values.issuer_website].filter(Boolean).join(' | '),8.5);if(values.issuer_agent)paragraph('Mandatario: '+values.issuer_agent,8.5);
 table([['Busta / dispositivo',meta.reference,'Data dichiarazione',values.declaration_date],['Portatore',values.client_name,'Consegna',values.delivery_date],['C.F. / identificativo',values.client_fiscal,'Indirizzo',values.client_address]],[92,178,83,CW-353]);
 heading('1) Montatura');const fr=[];for(let i=0;i<frameFields.length;i+=2){const a=frameFields[i],b=frameFields[i+1];fr.push([a[1],values['frame_'+a[0]],b?.[1]||'',b?values['frame_'+b[0]]:'']);}table(fr,[80,185,95,CW-360]);
 heading('2) Lenti oftalmiche - componenti del dispositivo');table([['Caratteristica','Lente DX (OD)','Lente SX (OS)'],...lensFields.map(([k,n])=>[n,values['od_'+k],values['os_'+k]])],[140,(CW-140)/2,(CW-140)/2],true);
 heading('Parametri ottici - convenzione asse: '+values.axis_convention);
 for(const side of ['od','os']){paragraph(side==='od'?'Lente DX':'Lente SX',9,bold);table([['Distanza',...RXCOLS.map(x=>x[1])],...RXROWS.map(([r,n])=>[r+' - '+n,...RXCOLS.map(([c])=>values[side+'_'+r+'_'+c]||'-')])],[75,...Array(6).fill((CW-75)/6)],true);}
 // The full maintenance sheet is part of the same document signed below.
 heading('Prescrizione e destinazione del dispositivo');paragraph(values.prescription_origin);paragraph('Prescrittore: '+values.prescription_author+' - '+values.prescription_qualification);paragraph('Data: '+values.prescription_date+' | Riferimento: '+values.prescription_ref);if(values.prescription_facility)paragraph('Struttura: '+values.prescription_facility);paragraph('Destinazione d’uso: '+values.intended_use);if(values.special_characteristics)paragraph('Caratteristiche specifiche: '+values.special_characteristics);
 heading('Dichiarazione del fabbricante');paragraph(DECLARATION);paragraph('Requisiti non interamente rispettati / motivazioni: '+values.exceptions);if(values.unknown_reasons)paragraph('Dati non disponibili e motivazione: '+values.unknown_reasons);paragraph('Il portatore è stato istruito all’uso e alla manutenzione del dispositivo. La marcatura CE indicata riguarda i singoli componenti; non è attribuita automaticamente all’occhiale su misura.');
 heading('Pulizia, uso e manutenzione dell’occhiale');CLEANING.forEach((s,i)=>paragraph((i+1)+'. '+s,9));if(values.manufacturer_instructions)paragraph('Indicazioni specifiche / istruzioni del fabbricante: '+values.manufacturer_instructions,9,bold);
 heading('Ricezione del documento e delle istruzioni');paragraph(RECEIPT);paragraph('Portatore: '+values.client_name+' | Firmatario: '+values.signer_name+' ('+values.signer_role+')');if(values.signer_capacity)paragraph('Rappresentanza: '+values.signer_capacity);
 const opLines=wrap(values.operator_name+' - '+values.operator_capacity,248,8),clLines=wrap(values.signer_name,248,8),nameH=Math.max(opLines.length,clLines.length)*10;
 ensure(136+nameH);paragraph('Data effettiva di consegna: '+values.delivery_date+' | Dichiarazione: '+values.declaration_date,9,bold);const sigPage=pdf.getPageCount()-1;
 draw('Firma per il fabbricante',L,y,9,bold);draw('Firma per ricezione',L+280,y,9,bold);y-=13;opLines.forEach((t,i)=>draw(t,L,y-i*10,8));clLines.forEach((t,i)=>draw(t,L+280,y-i*10,8));const signatureY=y-nameH-64;
 const boxes=[{role:'operator',x:L,y:signatureY,width:248,height:57},{role:'client',x:L+280,y:signatureY,width:248,height:57}];
 boxes.forEach(b=>page.drawRectangle({x:b.x,y:b.y,width:b.width,height:b.height,borderColor:rule,borderWidth:.6}));y=signatureY-14;
 draw('Firme tracciate su schermo: non firma digitale qualificata.',L,y,8,normal,muted);y-=12;
 const signTimeY=y;draw('Conservare la dichiarazione per almeno 10 anni dalla messa a disposizione.',L,y-13,8,normal,muted);
 const count=pdf.getPageCount();pdf.getPages().forEach((p,i)=>{p.drawText(txt(meta.id+' | '+meta.reference+' | '+(i+1)+' / '+count),{x:L,y:21,size:7,font:normal,color:muted});});
 return {bytes:await pdf.save(),layout:{page:sigPage,boxes,timeY:signTimeY},pages:count};
}
export async function signPdf(lib,preview,layout,images,serverTime){
 const pdf=await lib.PDFDocument.load(preview),page=pdf.getPage(layout.page),font=await pdf.embedFont(lib.StandardFonts.Helvetica);
 for(const b of layout.boxes){const img=await pdf.embedPng(images[b.role]);const scale=Math.min((b.width-8)/img.width,(b.height-8)/img.height);page.drawImage(img,{x:b.x+(b.width-img.width*scale)/2,y:b.y+(b.height-img.height*scale)/2,width:img.width*scale,height:img.height*scale});}
 const stamp=new Intl.DateTimeFormat('it-IT',{timeZone:'Europe/Rome',dateStyle:'short',timeStyle:'medium'}).format(new Date(serverTime));page.drawText('Firme acquisite il '+stamp+' (Europe/Rome) - riferite a tutte le pagine.',{x:28,y:layout.timeY,size:7.5,font});pdf.setModificationDate(new Date(serverTime));return pdf.save();
}
