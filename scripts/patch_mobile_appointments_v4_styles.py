from pathlib import Path
p=Path('mobile-app/App.js')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_MOBILE_APPOINTMENTS_V4_STYLES'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_MOBILE_APPOINTMENTS_V3' not in s:
    raise SystemExit('Mobile appointments V3 non applicata')

repls={
"style={[styles.segment, serviceId === s.id && styles.segmentActive]}":"style={[{paddingHorizontal:10,paddingVertical:8,borderRadius:10,borderWidth:1,borderColor:'#c7d5df',backgroundColor:'#fff'}, serviceId === s.id && {backgroundColor:C.blue,borderColor:C.blue}]}",
"style={[styles.segmentText, serviceId === s.id && styles.segmentTextActive]}":"style={[{fontSize:11,fontWeight:'800',color:C.navy}, serviceId === s.id && {color:'#fff'}]}",
"style={[styles.segment, operator === o.username && styles.segmentActive]}":"style={[{paddingHorizontal:10,paddingVertical:8,borderRadius:10,borderWidth:1,borderColor:'#c7d5df',backgroundColor:'#fff'}, operator === o.username && {backgroundColor:C.blue,borderColor:C.blue}]}",
"style={[styles.segmentText, operator === o.username && styles.segmentTextActive]}":"style={[{fontSize:11,fontWeight:'800',color:C.navy}, operator === o.username && {color:'#fff'}]}",
"style={[styles.segment, selectedTime === t && styles.segmentActive]}":"style={[{paddingHorizontal:12,paddingVertical:9,borderRadius:10,borderWidth:1,borderColor:'#c7d5df',backgroundColor:'#fff'}, selectedTime === t && {backgroundColor:C.blue,borderColor:C.blue}]}",
"style={[styles.segmentText, selectedTime === t && styles.segmentTextActive]}":"style={[{fontSize:12,fontWeight:'900',color:C.navy}, selectedTime === t && {color:'#fff'}]}",
"style={[styles.segment, selected?.studio_id === s.studio_id && styles.segmentActive]}":"style={[{paddingHorizontal:12,paddingVertical:9,borderRadius:10,borderWidth:1,borderColor:'#c7d5df',backgroundColor:'#fff'}, selected?.studio_id === s.studio_id && {backgroundColor:C.blue,borderColor:C.blue}]}",
"style={[styles.segmentText, selected?.studio_id === s.studio_id && styles.segmentTextActive]}":"style={[{fontSize:11,fontWeight:'900',color:C.navy}, selected?.studio_id === s.studio_id && {color:'#fff'}]}",
}
for a,b in repls.items():
    if a not in s:
        raise SystemExit('Pattern non trovato: '+a[:70])
    s=s.replace(a,b)

anchor="const OPTYKER_MOBILE_APPOINTMENTS_V3 = true;"
s=s.replace(anchor,anchor+"\nconst OPTYKER_MOBILE_APPOINTMENTS_V4_STYLES = true;",1)
p.write_text(s,encoding='utf-8')
print('Mobile appointments V4 styles OK')
