from pathlib import Path
import hashlib, json, os, struct, zipfile
import xml.etree.ElementTree as ET

out=Path('dist/android-play')
aab=out/'ovc-release-unsigned.aab'
ns='{http://schemas.android.com/apk/res/android}'
root=ET.parse(out/'manifest.xml').getroot()
assert root.attrib['package']=='it.otticavisualcare.app'
assert root.attrib[ns+'versionCode']=='14'
assert root.attrib[ns+'versionName']=='13.0.1'
sdk=root.find('uses-sdk')
assert int(sdk.attrib[ns+'targetSdkVersion'])>=36
app=root.find('application')
assert app.attrib.get(ns+'debuggable','false')=='false'
assert app.attrib.get(ns+'usesCleartextTraffic','false')=='false'
assert app.attrib.get(ns+'allowBackup','true')=='false'
permissions=[p.attrib[ns+'name'] for p in root.findall('uses-permission')]
blocked=['READ_MEDIA_IMAGES','READ_MEDIA_VIDEO','READ_MEDIA_AUDIO','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE','SYSTEM_ALERT_WINDOW','ACCESS_FINE_LOCATION','ACCESS_COARSE_LOCATION','READ_PHONE_STATE']
assert not any(p.split('.')[-1] in blocked for p in permissions), permissions
libs=[]
with zipfile.ZipFile(aab) as z:
    assert z.testzip() is None
    assert 'BundleConfig.pb' in z.namelist()
    assert 'base/manifest/AndroidManifest.xml' in z.namelist()
    assert any(n.endswith('index.android.bundle') for n in z.namelist()), 'Missing embedded JavaScript'
    assert not any(n.upper().startswith('META-INF/') and n.upper().endswith(('.RSA','.DSA','.EC')) for n in z.namelist()), 'Release must be unsigned until private local signing'
    for name in z.namelist():
        if not name.endswith('.so'):continue
        data=z.read(name)
        assert data[:4]==b'\x7fELF', name
        endian='<' if data[5]==1 else '>'
        if data[4]==2:
            off=struct.unpack_from(endian+'Q',data,32)[0]
            size,count=struct.unpack_from(endian+'HH',data,54)
            alignoff,alignfmt=48,'Q'
        else:
            off=struct.unpack_from(endian+'I',data,28)[0]
            size,count=struct.unpack_from(endian+'HH',data,42)
            alignoff,alignfmt=28,'I'
        aligns=[]
        for i in range(count):
            pos=off+i*size
            if struct.unpack_from(endian+'I',data,pos)[0]==1:
                aligns.append(struct.unpack_from(endian+alignfmt,data,pos+alignoff)[0])
        assert aligns and min(aligns)>=16384, (name,aligns)
        libs.append({'path':name,'minimum_load_alignment':min(aligns)})
assert libs
config=json.loads((out/'bundle-config.json').read_text())
report={'app':'OTTICA VISUAL CARE','package':'it.otticavisualcare.app','version_name':'13.0.1','version_code':14,'target_sdk':int(sdk.attrib[ns+'targetSdkVersion']),'min_sdk':int(sdk.attrib[ns+'minSdkVersion']),'debuggable':False,'cleartext':False,'allow_backup':False,'permissions':permissions,'native_libraries':libs,'all_native_libraries_16kb_aligned':True,'signature':'unsigned - private upload signing performed separately','sha256_unsigned':hashlib.sha256(aab.read_bytes()).hexdigest(),'source_commit':os.environ.get('GITHUB_SHA'),'workflow_run':os.environ.get('GITHUB_RUN_ID'),'bundle_config':config}
(out/'build-report.json').write_text(json.dumps(report,indent=2)+'\n')
# Archive actual prepared sources and native generated project, not signing keys or build caches.
with zipfile.ZipFile(out/'sorgenti-android.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in Path('mobile-app').rglob('*'):
        if not p.is_file():continue
        if any(x in {'node_modules','build','.gradle','.expo','.cxx','ios'} for x in p.parts):continue
        if p.name in {'local.properties','credentials.json'} or p.suffix in {'.keystore','.jks','.p12'}:continue
        z.write(p,p.as_posix())
    for p in [Path('scripts/prepare_android_play_20260918.py'),Path('scripts/verify_android_play_20260918.py'),Path('.github/workflows/android-play-bundle.yml')]:
        z.write(p,p.as_posix())
print('PASS manifest, release mode, permissions, embedded JS, ZIP integrity and',len(libs),'16KB-aligned native libraries.')
