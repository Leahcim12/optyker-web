from pathlib import Path

p = Path('mobile-app/App.js')
s = p.read_text(encoding='utf-8')

if "const BOOKING_URL = 'https://leahcim12.github.io/optyker-web/booking/?source=app';" in s:
    print('Prenotazioni app gia integrate')
    raise SystemExit(0)

needle = "const SHOP_URL = 'https://otticavisualcare.it';\n"
insert = needle + "const BOOKING_URL = 'https://leahcim12.github.io/optyker-web/booking/?source=app';\n"
if needle not in s:
    raise SystemExit('SHOP_URL non trovato')
s = s.replace(needle, insert, 1)

needle = "  const items = [\n    { key: 'home', label: 'Home', icon: '⌂' },\n    { key: 'shop', label: 'Shop', icon: '▣' },"
replace = "  const items = [\n    { key: 'home', label: 'Home', icon: '⌂' },\n    { key: 'booking', label: 'Prenota', icon: '◫' },\n    { key: 'shop', label: 'Shop', icon: '▣' },"
if needle not in s:
    raise SystemExit('Menu cliente non trovato')
s = s.replace(needle, replace, 1)

needle = "        {tab === 'shop' && (\n          <View style={{ flex: 1 }}>\n            <View style={styles.webHeader}><Text style={styles.webHeaderTitle}>Shop Ottica Visual Care</Text></View>\n            <WebView source={{ uri: home?.shop_url || SHOP_URL }} startInLoadingState renderLoading={() => <Loading />} />\n          </View>\n        )}\n"
replace = "        {tab === 'booking' && (\n          <View style={{ flex: 1 }}>\n            <View style={styles.webHeader}><Text style={styles.webHeaderTitle}>Prenota un appuntamento</Text></View>\n            <WebView source={{ uri: BOOKING_URL }} startInLoadingState renderLoading={() => <Loading label=\"Carico gli appuntamenti…\" />} />\n          </View>\n        )}\n\n" + needle
if needle not in s:
    raise SystemExit('Blocco Shop non trovato')
s = s.replace(needle, replace, 1)

needle = "        <Text style={styles.authSub}>Shop, prescrizioni, LAC, ordini e chat in un’unica app.</Text>"
replace = "        <Text style={styles.authSub}>Appuntamenti, shop, prescrizioni, LAC, ordini e chat in un’unica app.</Text>"
if needle in s:
    s = s.replace(needle, replace, 1)

p.write_text(s, encoding='utf-8')
print('Prenotazioni guidate integrate nella app')
