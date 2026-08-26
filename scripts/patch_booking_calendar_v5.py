from pathlib import Path
import re

p = Path('booking/index.html')
s = p.read_text(encoding='utf-8')

if 'OPTYKER_BOOKING_CALENDAR_V5' in s:
    print('Calendario booking V5 gia presente')
    raise SystemExit(0)

needle = "(function(){/* OPTYKER_BOOKING_STATIC_V3 */ /* OPTYKER_BOOKING_GUIDED_V4 */\n"
if needle not in s:
    raise SystemExit('Marker booking guidato non trovato')
s = s.replace(needle, needle.rstrip('\n') + " /* OPTYKER_BOOKING_CALENDAR_V5 */\n", 1)

needle = "const API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-appointments-booking';\n"
if needle not in s:
    raise SystemExit('API booking non trovata')
s = s.replace(needle, needle + "const ICS_API='https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-calendar-ics';\n", 1)

pattern = r"function downloadIcs\(\)\{.*?\}\nasync function book\(\)\{"
replacement = """function externalOpen(url){
  if(window.ReactNativeWebView&&typeof window.ReactNativeWebView.postMessage==='function'){
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'openExternal',url:String(url)}));
    return;
  }
  const w=window.open(url,'_blank');if(!w)location.href=url;
}
function icsUrl(){const r=eventRange();const p=new URLSearchParams({title:eventTitle(),start:r.st.toISOString(),end:r.en.toISOString(),details:'Appuntamento confermato presso Ottica Visual Care.',location:'Ottica Visual Care, Lallio (BG)'});return ICS_API+'?'+p.toString()}
function downloadIcs(){externalOpen(icsUrl())}
async function book(){"""
s2, n = re.subn(pattern, replacement, s, count=1, flags=re.S)
if n != 1:
    raise SystemExit(f'Funzione downloadIcs non trovata o ambigua: {n}')
s = s2

old = "E('googleCal').onclick=()=>{const u=googleUrl();const w=window.open(u,'_blank');if(!w)location.href=u};\nE('icsCal').onclick=downloadIcs;"
new = "E('googleCal').onclick=()=>externalOpen(googleUrl());\nE('icsCal').onclick=downloadIcs;"
if old not in s:
    raise SystemExit('Handler calendario non trovato')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('Calendario booking V5 applicato')
