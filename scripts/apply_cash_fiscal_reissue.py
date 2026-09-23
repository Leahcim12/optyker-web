"""Install a fiscal-only reissue route inside the existing cashier closure."""
from pathlib import Path
import hashlib,json,os,re,subprocess
ROOT=Path(__file__).resolve().parent.parent
VERSION='20260923-reissue2'
MARK='OPTYKER_FISCAL_REISSUE_20260923'
def main():
 site=ROOT/'_site';cash=site/'cash-register.js';text=cash.read_text(encoding='utf-8')
 if MARK not in text:
  pos=text.rfind('})();')
  if pos<0 or 'function balanceData()' not in text:raise ValueError('Recorded-balance cashier scope missing')
  text=text[:pos]+'\n'+(ROOT/'cash-fiscal-reissue.js').read_text(encoding='utf-8')+'\n'+text[pos:]
  cash.write_text(text,encoding='utf-8')
 subprocess.run(['node','--check',str(cash)],check=True)
 pattern=r'cash-register\.js(?:\?[^\s\"\'<>]*)?'
 def versioned(m):
  s=re.sub(r'&reissue=[^&\s\"\'<>]+','',m[0]);return s+('&' if '?' in s else '?')+'reissue='+VERSION
 for folder in (site,site/'gestionale-v2',site/'gestionale-v3'):
  page=folder/'index.html';page.write_text(re.sub(pattern,versioned,page.read_text(encoding='utf-8')),encoding='utf-8')
  if folder!=site:(folder/cash.name).write_bytes(cash.read_bytes())
 for p in site.glob('*.js'):
  if p!=cash:
   old=p.read_text(encoding='utf-8');new=re.sub(pattern,versioned,old)
   if new!=old:p.write_text(new,encoding='utf-8')
 (site/'cash-reissue-version.json').write_text(json.dumps({'version':VERSION,'commit':os.environ.get('GITHUB_SHA') or os.environ.get('VERCEL_GIT_COMMIT_SHA',''),'cash_sha256':hashlib.sha256(cash.read_bytes()).hexdigest(),'new_payment':False})+'\n')
 print('Fiscal-only reissue installed',VERSION)
if __name__=='__main__':main()
