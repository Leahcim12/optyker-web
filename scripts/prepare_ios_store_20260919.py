"""Prepare iOS from the already verified mobile source, without Apple credentials."""
from pathlib import Path
import json, shutil, sys

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'ios-release/mobile-app')
p = root / 'app.json'
config = json.loads(p.read_text())
e = config['expo']
assert e['ios']['bundleIdentifier'] == 'it.otticavisualcare.app'
assert e['version'] == '13.0.1'
e['platforms'] = ['ios']
e['ios'].update({
    'buildNumber': '14',
    'supportsTablet': True,
    'requireFullScreen': False,
    'infoPlist': {
        'NSCameraUsageDescription': 'Usa la fotocamera per scattare foto o video da inviare nella chat con Ottica Visual Care.',
        'NSMicrophoneUsageDescription': 'Usa il microfono quando registri un video da inviare a Ottica Visual Care.',
        'NSPhotoLibraryUsageDescription': 'Seleziona foto o video da allegare alla chat o al tuo profilo Ottica Visual Care.',
        'NSPhotoLibraryAddUsageDescription': 'Salva nella libreria le immagini che scegli di scaricare da Ottica Visual Care.',
        'NSAppTransportSecurity': {'NSAllowsArbitraryLoads': False, 'NSAllowsArbitraryLoadsInWebContent': False},
        'LSApplicationQueriesSchemes': ['tel', 'mailto', 'sms', 'whatsapp'],
        'UISupportedInterfaceOrientations~ipad': [
            'UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown',
            'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight'],
    },
})
# This iOS delivery never uses or changes the Android keystore.
e.pop('android', None)
e['icon'] = './assets/app-store-icon.png'
e['plugins'] = [['expo-build-properties', {'ios': {'privacyManifestAggregationEnabled': True}}]]
shutil.copy2(root / 'assets/play-icon.png', root / 'assets/app-store-icon.png')
p.write_text(json.dumps(config, ensure_ascii=False, indent=2) + '\n')
app_path = root / 'App.js'
app = app_path.read_text()
old = "const APP_BASE = 'https://www.optyker.it/iphone-app-v13/?app=13&platform=android';"
assert app.count(old) == 1, 'Unexpected verified source URL'
app = app.replace(old, "const APP_BASE = 'https://www.optyker.it/iphone-app-v13/?app=13&platform=ios';", 1)
# Native iPhone back-swipe support, while retaining the app's existing navigation.
app = app.replace('        allowsInlineMediaPlayback\n', '        allowsInlineMediaPlayback\n        allowsBackForwardNavigationGestures\n', 1)
app_path.write_text(app)
eas = {
    'cli': {'version': '>= 24.7.0', 'appVersionSource': 'remote'},
    'build': {'production': {
        'distribution': 'store', 'autoIncrement': True, 'credentialsSource': 'remote',
        'ios': {'simulator': False, 'withoutCredentials': False, 'image': 'macos-tahoe-26.5-xcode-26.6'},
    }},
    'submit': {'production': {'ios': {}}},
}
(root / 'eas.json').write_text(json.dumps(eas, indent=2) + '\n')
(root / '.easignore').write_text('node_modules/\n.expo/\n.git/\nandroid/\nios/\noutput/\n*.ipa\n*.aab\n*.jks\n*.keystore\n*.p12\n*.p8\n*.mobileprovision\ncredentials.json\n.DS_Store\n')
print('Prepared iOS: OTTICA VISUAL CARE 13.0.1 (14), it.otticavisualcare.app; Apple distribution signature still required.')
