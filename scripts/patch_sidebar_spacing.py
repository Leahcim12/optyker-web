from pathlib import Path

p=Path('_site/index.html')
s=p.read_text(encoding='utf-8')
MARK='OPTYKER_SIDEBAR_SPACING_V1'
if MARK in s:
    raise SystemExit(0)
if 'OPTYKER_SIDEBAR_ORDER_V2' not in s or 'id="moduleNav"' not in s:
    raise SystemExit('Sidebar ordinata non disponibile')

style=r'''<style id="optykerSidebarSpacingCss">/* OPTYKER_SIDEBAR_SPACING_V1 */
#moduleNav{
  align-content:flex-start!important;
  justify-content:flex-start!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
}
#moduleNav>.moduleBtn,
#moduleNav>#navSheets{
  flex:0 0 auto!important;
  flex-shrink:0!important;
  min-height:46px!important;
  height:auto!important;
  padding-top:10px!important;
  padding-bottom:10px!important;
}
#moduleNav>#sheetsSubmenu,
#moduleNav>#clientSidebarSubmenu{
  flex:0 0 auto!important;
  flex-shrink:0!important;
}
#moduleNav #sheetsSubmenu .moduleBtn,
#moduleNav #clientSidebarSubmenu .moduleBtn{
  flex:0 0 auto!important;
  flex-shrink:0!important;
  min-height:42px!important;
  height:auto!important;
  padding-top:8px!important;
  padding-bottom:8px!important;
}
</style>'''

h=s.find('</head>')
if h<0:
    raise SystemExit('head non trovato')
s=s[:h]+style+s[h:]
p.write_text(s,encoding='utf-8')
if MARK not in s:
    raise SystemExit('Fix spaziatura sidebar non inserito')
print('Sidebar spacing OK')
