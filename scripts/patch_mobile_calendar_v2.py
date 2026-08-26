from pathlib import Path

p = Path('mobile-app/App.js')
s = p.read_text(encoding='utf-8')

if 'OPTYKER_MOBILE_BOOKING_CALENDAR_V2' in s:
    print('Calendario mobile V2 gia presente')
    raise SystemExit(0)

needle = "  KeyboardAvoidingView,\n  Platform,\n"
replace = "  KeyboardAvoidingView,\n  Linking,\n  Platform,\n"
if needle not in s:
    raise SystemExit('Import React Native non trovato')
s = s.replace(needle, replace, 1)

needle = "const BOOKING_URL = 'https://leahcim12.github.io/optyker-web/booking/?source=app';\n"
replace = needle + "const OPTYKER_MOBILE_BOOKING_CALENDAR_V2 = true;\n"
if needle not in s:
    raise SystemExit('BOOKING_URL non trovato')
s = s.replace(needle, replace, 1)

old = "            <WebView source={{ uri: BOOKING_URL }} startInLoadingState renderLoading={() => <Loading label=\"Carico gli appuntamenti…\" />} />"
new = """            <WebView
              source={{ uri: BOOKING_URL }}
              startInLoadingState
              renderLoading={() => <Loading label=\"Carico gli appuntamenti…\" />}
              onMessage={(event) => {
                try {
                  const message = JSON.parse(event?.nativeEvent?.data || '{}');
                  const url = String(message?.url || '');
                  const allowed = /^https:\/\/(calendar\.google\.com\/|whgziwaegjzqsgcntesr\.supabase\.co\/functions\/v1\/optyker-calendar-ics(?:\?|$))/i.test(url);
                  if (message?.type === 'openExternal' && allowed) Linking.openURL(url);
                } catch (_) {}
              }}
            />"""
if old not in s:
    raise SystemExit('WebView prenotazioni non trovata')
s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')
print('Calendario mobile V2 applicato')
