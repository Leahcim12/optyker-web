"""Loopback-only HTTP fixture. No printer, secrets, Internet or fiscal operations."""
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
import json,sys,xml.etree.ElementTree as ET
MODE={'scenario':'normal','reg':True,'requests':[],'commands':[]}
ALLOWED={'<</?s','<</?m','<</?d','<</?7','=C3','=C453/$0','=C451/$0/&210926/[210926','=C1'}
SERIAL='72IV6003831'
class Handler(BaseHTTPRequestHandler):
 protocol_version='HTTP/1.1'
 def log_message(self,*args):pass
 def reply(self,body,status=200,headers=None):
  data=body.encode('utf-8');self.send_response(status)
  self.send_header('Content-Length',str(len(data)));self.send_header('Connection','close');self.send_header('Content-Type','application/xml; charset=utf-8')
  for k,v in (headers or {}).items():self.send_header(k,v)
  self.end_headers()
  try:self.wfile.write(data)
  except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):pass
 def do_GET(self):
  url=urlsplit(self.path)
  if url.path=='/reset':
   MODE.update(scenario=parse_qs(url.query)['scenario'][0],reg=True,requests=[],commands=[]);return self.reply('{}')
  if url.path=='/report':return self.reply(json.dumps(MODE))
  MODE['requests'].append('GET '+url.path)
  if url.path=='/health':return self.reply(json.dumps({'ok':True,'connector':'Optyker RCH','version':'HTTP_TEST_ONLY','printer':'192.168.1.10'}))
  self.reply('not found',404)
 def do_POST(self):
  MODE['requests'].append('POST '+self.path)
  count=int(self.headers.get('Content-Length','0'))
  if not 0<count<4096:return self.reply('invalid length',400)
  data=self.rfile.read(count)
  try:command=ET.fromstring(data).findtext('cmd')
  except ET.ParseError:return self.reply('invalid XML',400)
  MODE['commands'].append(command)
  if command not in ALLOWED:return self.reply('Forbidden fixture command',403)
  scenario=MODE['scenario']
  if scenario=='redirect':return self.reply('',302,{'Location':'/must-not-follow'})
  request='<Request><errorCode>0</errorCode><printerError>0</printerError><paperEnd>0</paperEnd><coverOpen>0</coverOpen><busy>'+('1' if scenario=='busy' else '0')+'</busy><lastCmd>1</lastCmd></Request>'
  extra=''
  if command=='<</?s':extra='<ECRStatus><mode>'+('REG' if MODE['reg'] else 'Z')+'</mode><idleState>0</idleState><lastZ>1168</lastZ><lastDocF>9</lastDocF></ECRStatus>'
  elif command=='<</?m':extra='<Enq><name>m</name><value>'+('OTHER_REGISTER' if scenario=='wrongSerial' else SERIAL)+'</value></Enq>'
  elif command=='<</?d':extra='<Enq><name>d</name><value>210926 190000</value></Enq>'
  elif command=='<</?7':extra='<Enq><name>7</name><value>1168</value></Enq>'
  elif command=='=C3':MODE['reg']=False
  elif command=='=C1':
   if scenario=='restoreFails':return self.reply('simulated refusal',503)
   MODE['reg']=True
  elif command in ('=C453/$0','=C451/$0/&210926/[210926'):
   daily=command.startswith('=C451')
   if daily and scenario=='dayFails':return self.reply('simulated refusal',503)
   if daily and scenario=='oversized':return self.reply('<Service>'+request+'<EJ>'+'X'*1049000+'</EJ></Service>')
   if daily and scenario=='noEJ':return self.reply('<Service>'+request+'</Service>')
   if not daily and scenario=='headerOnly':extra='<EJ><![CDATA[DOCUMENTO GESTIONALE\n19-09-2026 22:34\n'+SERIAL+'\nPRIVATE CUSTOMER\n]]></EJ>'
   else:
    date='21-09-2026 09:49' if daily else '19-09-2026 22:44'
    extra='<EJ><![CDATA[DOCUMENTO COMMERCIALE\nDOCUMENTO N. 1168-0009\n'+date+'\nTOTALE COMPLESSIVO 55,00\n'+SERIAL+'\nPRIVATE CUSTOMER\nRSSMRA80A01H501U\n]]></EJ>'
  self.reply('<Service>'+request+extra+'</Service>')
server=ThreadingHTTPServer(('127.0.0.1',0),Handler);server.daemon_threads=True
Path(sys.argv[1]).write_text(str(server.server_port));server.serve_forever()
