import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CodiceFiscaleUtils } from "npm:@marketto/codice-fiscale-utils@3.1.3";
import belfioreConnector from "npm:@marketto/belfiore-connector-embedded@1.2.1";

const cfUtils = new CodiceFiscaleUtils(belfioreConnector as any);
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Cache-Control":"no-store"};
const out=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{...CORS,"Content-Type":"application/json; charset=utf-8"}});

const odd:Record<string,number>={
  "0":1,"1":0,"2":5,"3":7,"4":9,"5":13,"6":15,"7":17,"8":19,"9":21,
  A:1,B:0,C:5,D:7,E:9,F:13,G:15,H:17,I:19,J:21,K:2,L:4,M:18,N:20,O:11,P:3,Q:6,R:8,S:12,T:14,U:16,V:10,W:22,X:25,Y:24,Z:23
};
const even:Record<string,number>={
  "0":0,"1":1,"2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,
  A:0,B:1,C:2,D:3,E:4,F:5,G:6,H:7,I:8,J:9,K:10,L:11,M:12,N:13,O:14,P:15,Q:16,R:17,S:18,T:19,U:20,V:21,W:22,X:23,Y:24,Z:25
};
function checksumOk(cf:string){
  if(!/^[A-Z0-9]{16}$/.test(cf))return false;
  let sum=0;
  for(let i=0;i<15;i++){
    const table=(i%2===0)?odd:even;
    const v=table[cf[i]];
    if(v===undefined)return false;
    sum+=v;
  }
  return String.fromCharCode(65+(sum%26))===cf[15];
}
function title(v:unknown){
  return String(v??"").toLocaleLowerCase("it-IT").replace(/(^|[\s'’\-])([\p{L}])/gu,(_,a,b)=>a+b.toLocaleUpperCase("it-IT"));
}
async function decode(raw:unknown){
  const cf=String(raw??"").replace(/\s+/g,"").toUpperCase();
  if(cf.length!==16)throw new Error("Codice fiscale incompleto");
  if(!checksumOk(cf))throw new Error("Codice fiscale non valido");
  const decoded:any=await cfUtils.parser.cfDecode(cf);
  const place:any=decoded?.place||{};
  const day=Number(decoded?.day),month=Number(decoded?.month),year=Number(decoded?.year);
  if(!day||!month||!year||!['M','F'].includes(String(decoded?.gender||'')))throw new Error('Dati anagrafici non decodificabili');
  const date=`${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${String(year).padStart(4,'0')}`;
  const rawPlace=place?.name||place?.firstName||place?.denominazione||"";
  return {cf,birth_date:date,gender:String(decoded.gender),birth_place:title(rawPlace),birth_place_code:String(place?.belfioreCode||cf.slice(11,15)),province:String(place?.province||''),iso3166:String(place?.iso3166||'')};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});
  if(req.method!=="GET"&&req.method!=="POST")return out({ok:false,error:"METHOD_NOT_ALLOWED"},405);
  try{
    const cf=req.method==="GET"?new URL(req.url).searchParams.get('cf'):(await req.json().catch(()=>({})))?.cf;
    return out({ok:true,data:await decode(cf)});
  }catch(e){return out({ok:false,error:e instanceof Error?e.message:String(e)},400)}
});
