from pathlib import Path
p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_IOS_PWA_V1'
if MARK in s:
    raise SystemExit(0)
head='''\n<!-- OPTYKER_IOS_PWA_V1 -->
<meta name="theme-color" content="#1769aa">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Optyker">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="visualcare-logo.svg">
'''
i=s.find('</head>')
if i<0: raise SystemExit('head non trovato')
s=s[:i]+head+s[i:]
p.write_text(s,encoding='utf-8')
print('iPhone PWA metadata OK')
