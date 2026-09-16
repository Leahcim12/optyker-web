from pathlib import Path

TAG = '<script src="/rch-cloud-relay.js?v=20260916-manualreg2"></script>'


def patch_loader():
    p = Path('index.html')
    s = p.read_text(encoding='utf-8')
    marker = "    document.open();document.write(html);document.close();"
    line = "    if(!html.includes('rch-cloud-relay.js?v=20260916-manualreg2'))html=html.replace('</body>','<script src=\"/rch-cloud-relay.js?v=20260916-manualreg2\"><\\/script></body>');\n"
    if 'rch-cloud-relay.js?v=20260916-manualreg2' not in s:
        if marker not in s:
            raise SystemExit('index marker not found')
        s = s.replace(marker, line + marker, 1)
        p.write_text(s, encoding='utf-8')


def patch_build():
    p = Path('scripts/vercel-build-v13.sh')
    s = p.read_text(encoding='utf-8')

    stale = "grep -q '20260914-cloud4' _site/rch-connector/Installa-RCH-Optyker.bat"
    current = "grep -q '2.1-manual-reg' _site/rch-connector/rch-optyker-cloud-worker.ps1\ngrep -q 'restore_reg' _site/rch-connector/rch-optyker-cloud-worker.ps1\ngrep -q 'Porta RCH in REG' _site/rch-cloud-relay.js"
    if stale in s:
        s = s.replace(stale, current, 1)

    if 'Optyker manual RCH REG UI build OK' not in s:
        marker = "python scripts/check_desktop_html.py\n\necho \"Optyker Vercel interaction guard + RCH Cloud4 build OK\""
        injection = '''python - <<'RCH_MANUAL_REG_UI'\nfrom pathlib import Path\ntag='<script src="/rch-cloud-relay.js?v=20260916-manualreg2"></script>'\nold='<script src="/rch-cloud-relay.js?v=20260916-manualreg1"></script>'\nfor rel in ('index.html','gestionale-v2/index.html','gestionale-v3/index.html'):\n    f=Path('_site')/rel\n    text=f.read_text(encoding='utf-8').replace(old,'')\n    if tag not in text:\n        i=text.lower().rfind('</body>')\n        if i < 0:\n            raise SystemExit('Closing body not found in '+rel)\n        text=text[:i]+tag+'\\n'+text[i:]\n    f.write_text(text,encoding='utf-8')\nRCH_MANUAL_REG_UI\nverify_desktop_aliases\ngrep -q 'rch-cloud-relay.js?v=20260916-manualreg2' _site/index.html\npython scripts/check_desktop_html.py\n\necho "Optyker manual RCH REG UI build OK"'''
        if marker not in s:
            raise SystemExit('RCH production build marker not found')
        s = s.replace(marker, injection, 1)

    p.write_text(s, encoding='utf-8')


def patch_pages():
    p = Path('.github/workflows/pages.yml')
    s = p.read_text(encoding='utf-8')
    start = s.find('      - name: Pubblica connettore RCH e relay iPad\n')
    end = s.find('      - name: Ripristina interazioni Optyker\n', start)
    if start < 0 or end < 0:
        raise SystemExit('RCH Pages step not found')

    block = '''      - name: Pubblica connettore RCH e relay iPad\n        run: |\n          mkdir -p _site/rch-connector\n          cp -R rch-connector/. _site/rch-connector/\n          cp rch-cloud-relay.js _site/rch-cloud-relay.js\n          test -s _site/rch-connector/Installa-RCH-Optyker.bat\n          test -s _site/rch-connector/Installa-RCH-Optyker.ps1\n          test -s _site/rch-connector/rch-optyker-connector.ps1\n          test -s _site/rch-connector/rch-optyker-cloud-worker.ps1\n          test -s _site/rch-connector/Attiva-Avvio-Automatico-RCH.ps1\n          grep -q "2.1-manual-reg" _site/rch-connector/rch-optyker-cloud-worker.ps1\n          grep -q "restore_reg" _site/rch-connector/rch-optyker-cloud-worker.ps1\n          grep -q "=C1" _site/rch-connector/rch-optyker-cloud-worker.ps1\n          grep -q "Porta RCH in REG" _site/rch-cloud-relay.js\n          grep -q "__OPTYKER_RCH_CLOUD_RELAY__" _site/rch-cloud-relay.js\n          grep -q "rch-cloud-relay.js?v=20260916-manualreg2" _site/index.html\n          pwsh -NoLogo -NoProfile -Command '$files=@("_site/rch-connector/Installa-RCH-Optyker.ps1","_site/rch-connector/Attiva-Avvio-Automatico-RCH.ps1","_site/rch-connector/rch-optyker-cloud-worker.ps1"); foreach($f in $files){$tokens=$null;$errors=$null;[System.Management.Automation.Language.Parser]::ParseFile($f,[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count){Write-Host "Parser errors in $f" -ForegroundColor Red;$errors|ForEach-Object{Write-Host $_.Message -ForegroundColor Red};exit 1}}; Write-Host "RCH PowerShell syntax OK"'\n\n'''
    s = s[:start] + block + s[end:]
    p.write_text(s, encoding='utf-8')


patch_loader()
patch_build()
patch_pages()
print('Manual RCH REG production deployment patched.')
