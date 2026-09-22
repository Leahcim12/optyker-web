"""Last-layer presentation of recorded deposits and receipt blockers; no payment migrations."""
from pathlib import Path
import re,json,hashlib
ROOT=Path(__file__).resolve().parent.parent
VERSION='20260921-balance1'
MARK='OPTYKER_RECORDED_BALANCES_20260921'
def main():
 site=ROOT/'_site';cash=site/'cash-register.js';s=cash.read_text()
 if MARK not in s:
  pos=s.rfind('})();')
  if pos<0 or 'function settleExisting(' not in s:raise ValueError('Native cashier anchors missing')
  s=s[:pos]+'\n'+(ROOT/'cash-recorded-balances.js').read_text()+'\n'+s[pos:];cash.write_text(s)
 pattern=r'cash-register\.js(?:\?[^\s\"\'<>]*)?'
 def versioned(m):
  v=re.sub(r'&balances=[^&\s\"\'<>]+','',m[0]);return v+('&' if '?' in v else '?')+'balances='+VERSION
 for folder in (site,site/'gestionale-v2',site/'gestionale-v3'):
  page=folder/'index.html';page.write_text(re.sub(pattern,versioned,page.read_text()))
  if folder!=site:(folder/cash.name).write_bytes(cash.read_bytes())
 for p in site.glob('*.js'):
  if p!=cash:
   old=p.read_text();new=re.sub(pattern,versioned,old)
   if new!=old:p.write_text(new)
 (site/'cash-balance-version.json').write_text(json.dumps({'version':VERSION,'cash_sha256':hashlib.sha256(cash.read_bytes()).hexdigest()})+'\n')
 from apply_receipt_latency import main as apply_latency
 apply_latency()
 print('Recorded balance UI installed:',VERSION)
if __name__=='__main__':main()
