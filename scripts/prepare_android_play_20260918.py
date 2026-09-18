"""Prepare the existing customer app for a first Play upload. No production writes."""
from pathlib import Path
import json
import io
import urllib.request
from PIL import Image

root = Path('mobile-app')
config_path = root / 'app.json'
config = json.loads(config_path.read_text())
e = config['expo']
assert e['android']['package'] == 'it.otticavisualcare.app'
e['version'] = '13.0.1'
e['icon'] = './assets/play-icon.png'
e['android']['versionCode'] = 14
e['android']['allowBackup'] = False
e['android']['permissions'] = ['INTERNET', 'CAMERA', 'RECORD_AUDIO']
e['android']['blockedPermissions'] = [
    'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO',
    'android.permission.READ_MEDIA_AUDIO',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.SYSTEM_ALERT_WINDOW',
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.READ_PHONE_STATE',
]
e['android']['adaptiveIcon'] = {
    'foregroundImage': './assets/play-foreground.png',
    'backgroundColor': '#ffffff',
}
e['plugins'] = [['expo-build-properties', {'android': {
    'compileSdkVersion': 36, 'targetSdkVersion': 36,
    'buildToolsVersion': '36.0.0',
    'usesCleartextTraffic': False,
    'networkInspector': False,
    'buildArchs': ['arm64-v8a', 'armeabi-v7a', 'x86_64'],
}}]]
config_path.write_text(json.dumps(config, indent=2) + '\n')

# Reuse the logo already configured for the customer app. Do not invent branding.
manifest = json.loads(Path('iphone-app-v13/manifest.webmanifest').read_text())
logo_url = manifest['icons'][0]['src']
assert logo_url.startswith('https://cdn.shopify.com/s/files/1/0917/4289/6503/')
with urllib.request.urlopen(logo_url, timeout=30) as response:
    data = response.read(10 * 1024 * 1024)
image = Image.open(io.BytesIO(data)).convert('RGBA')
assert image.width > 100 and image.height > 100
assets = root / 'assets'
assets.mkdir(exist_ok=True)
icon = Image.new('RGBA', (1024, 1024), 'white')
fit = image.copy(); fit.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
icon.alpha_composite(fit, ((1024-fit.width)//2, (1024-fit.height)//2))
icon.convert('RGB').save(assets / 'play-icon.png')
foreground = Image.new('RGBA', (1024, 1024), (255, 255, 255, 0))
fit = image.copy(); fit.thumbnail((640, 640), Image.Resampling.LANCZOS)
foreground.alpha_composite(fit, ((1024-fit.width)//2, (1024-fit.height)//2))
foreground.save(assets / 'play-foreground.png')

app_path = root / 'App.js'
app = app_path.read_text()
def replace_once(old, new):
    global app
    assert app.count(old) == 1, 'Unexpected App.js source: ' + old[:60]
    app = app.replace(old, new, 1)
replace_once("  SafeAreaView,\n", "  Pressable,\n")
replace_once("import { WebView } from 'react-native-webview';", "import { WebView } from 'react-native-webview';\nimport { SafeAreaView } from 'react-native-safe-area-context';")
replace_once("https://leahcim12.github.io/optyker-web/iphone-app-v13/?app=13&platform=android", "https://www.optyker.it/iphone-app-v13/?app=13&platform=android")
replace_once("  'leahcim12.github.io',", "  'leahcim12.github.io',\n  'optyker.it',\n  'www.optyker.it',")
replace_once("return INTERNAL_HOSTS.has(u.hostname);", "return u.protocol === 'https:' && INTERNAL_HOSTS.has(u.hostname);")
replace_once("        allowFileAccess\n", "        allowFileAccess={false}\n        mixedContentMode=\"never\"\n        webviewDebuggingEnabled={false}\n")
replace_once("Controlla la connessione Internet e riapri l’app.", "Controlla la connessione Internet e premi Riprova.")
replace_once("          </Text>\n        </View>\n      </SafeAreaView>", "          </Text>\n          <Pressable accessibilityRole=\"button\" accessibilityLabel=\"Riprova connessione\" style={{marginTop:18,padding:14,backgroundColor:'#1769aa',borderRadius:10}} onPress={() => setFailed(false)}><Text style={{color:'#fff',textAlign:'center',fontWeight:'700'}}>Riprova</Text></Pressable>\n        </View>\n      </SafeAreaView>")
replace_once("          return true;\n        }}", "          return false;\n        }}")
replace_once("          if (status >= 500) setFailed(true);", "          if (status >= 500 && e?.nativeEvent?.isTopFrame === true) setFailed(true);")
app_path.write_text(app)
entry_path = root / 'index.js'
entry = entry_path.read_text()
assert entry.count('Pressable,SafeAreaView,ScrollView') == 1
entry = entry.replace('Pressable,SafeAreaView,ScrollView', 'Pressable,ScrollView')
entry = entry.replace("import App from './App';", "import App from './App';\nimport {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';")
assert entry.count('registerRootComponent(Root);') == 1
entry = entry.replace('registerRootComponent(Root);', 'function PlayRoot(){return <SafeAreaProvider><Root/></SafeAreaProvider>}\nregisterRootComponent(PlayRoot);')
entry_path.write_text(entry)
print('Prepared OTTICA VISUAL CARE 13.0.1 (14), it.otticavisualcare.app, target SDK 36.')
