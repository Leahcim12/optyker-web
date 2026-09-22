"""Refresh the relay loader after all inherited UI patches. Does not touch printer code."""
from pathlib import Path
import re, hashlib, json, os
ROOT=Path(__file__).resolve().parent.parent
VERSION='20260922-latency1'
def main():
 site=ROOT/'_site';asset=site/'rch-cloud-relay.js'
 text=asset.read_text(encoding='utf-8')
 if 'OPTYKER_RCH_LATENCY_20260922' not in text:
  fragments=json.loads((ROOT/'scripts/receipt_latency_fragments.json').read_text())
  def replace_section(start_marker,end_marker,new):
   nonlocal text
   if text.count(start_marker)!=1:raise ValueError('Unexpected latency patch anchor '+start_marker)
   a=text.index(start_marker);b=text.index(end_marker,a)
   text=text[:a]+new+'\n'+text[b:]
  replace_section('async function localAvailable()', 'async function cloudConnection()',fragments['local'])
  replace_section('async function queueFiscal(', 'async function queueAux(',fragments['queue'])
  replace_section(' async function issuePayment(saleId,paymentId){if(await localAvailable())', ' async function openSale(',fragments['issue'])
  old="if(badge&&!badge.dataset.cloudProbe){badge.dataset.cloudProbe='1';cloudConnection()"
  if text.count(old)!=1:raise ValueError('Missing cash capability warmup anchor')
  text=text.replace(old,"if(badge&&!badge.dataset.cloudProbe){badge.dataset.cloudProbe='1';localAvailable();cloudConnection()")
  asset.write_text(text,encoding='utf-8')
 data=asset.read_bytes()
 if b'OPTYKER_RCH_LATENCY_20260922' not in data:raise ValueError('Receipt latency patch missing')
 pattern=r'rch-cloud-relay\.js(?:\?[^\s\"\'<>]*)?'
 def versioned(m):
  s=re.sub(r'&latency=[^&\s\"\'<>]+','',m[0]);return s+('&' if '?' in s else '?')+'latency='+VERSION
 for folder in (site,site/'gestionale-v2',site/'gestionale-v3'):
  page=folder/'index.html';page.write_text(re.sub(pattern,versioned,page.read_text(encoding='utf-8')),encoding='utf-8')
  if folder!=site:(folder/asset.name).write_bytes(data)
 for js in site.glob('*.js'):
  if js==asset:continue
  text=js.read_text(encoding='utf-8');updated=re.sub(pattern,versioned,text)
  if updated!=text:js.write_text(updated,encoding='utf-8')
 (site/'receipt-latency-version.json').write_text(json.dumps({'version':VERSION,'relay_sha256':hashlib.sha256(data).hexdigest(),'commit':os.environ.get('GITHUB_SHA') or os.environ.get('VERCEL_GIT_COMMIT_SHA',''),'printer_commands_changed':False})+'\n')
 print('Receipt wait optimisation installed',VERSION)
if __name__=='__main__':main()
