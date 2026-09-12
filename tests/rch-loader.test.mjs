import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
test('production loader copies the module once, before the cash bundle and with the same cache tag',()=>{
  const dir=mkdtempSync(join(tmpdir(),'optyker-rch-loader-'));
  try {
    mkdirSync(join(dir,'_site'));mkdirSync(join(dir,'scripts'));
    cpSync(new URL('../rch-preflight.js',import.meta.url),join(dir,'rch-preflight.js'));
    cpSync(new URL('../scripts/patch_cash_register.py',import.meta.url),join(dir,'scripts/patch_cash_register.py'));
    writeFileSync(join(dir,'_site/index.html'),'<html><head></head><body>Existing page<script src="/cash-register.js?v=old" id="optykerCashJs"></script></body></html>');
    for(let n=0;n<2;n++)execFileSync('python3',['scripts/patch_cash_register.py'],{cwd:dir});
    const out=readFileSync(join(dir,'_site/index.html'),'utf8');
    assert.equal((out.match(/id="optykerRchPreflightJs"/g)||[]).length,1);
    assert.equal((out.match(/id="optykerCashJs"/g)||[]).length,1);
    assert.ok(out.indexOf('id="optykerRchPreflightJs"')<out.indexOf('id="optykerCashJs"'));
    assert.match(out,/Existing page/);
    assert.match(out,/rch-preflight.js\?v=20260912-rch-confirmed2/);
    assert.match(out,/cash-register.js\?v=20260912-rch-confirmed2/);
    assert.equal(readFileSync(join(dir,'_site/rch-preflight.js'),'utf8'),readFileSync(new URL('../rch-preflight.js',import.meta.url),'utf8'));
  }finally{rmSync(dir,{recursive:true})}
});
test('later Operations patch retains the current cash release, injected logic and alias/manifests',()=>{
  const dir=mkdtempSync(join(tmpdir(),'optyker-rch-final-loader-'));
  try {
    mkdirSync(join(dir,'_site'));mkdirSync(join(dir,'scripts'));
    cpSync(new URL('../scripts/apply_ovc_operations.py',import.meta.url),join(dir,'scripts/apply_ovc_operations.py'));
    cpSync(new URL('../cash-register.js',import.meta.url),join(dir,'cash-register.js'));
    for(const name of ['optyker-operations.css','optyker-operations.js','ovc-card-logo.png'])writeFileSync(join(dir,name),'unchanged fixture asset');
    writeFileSync(join(dir,'_site/optyker-vision.js'),'/* Existing vision logic */');
    const html='<html data-ovc-ui="2"><head></head><body>Existing page<script src="/rch-preflight.js?v=20260912-rch-confirmed2" id="optykerRchPreflightJs"></script><script src="/cash-register.js?v=20260910-ovc2" id="optykerCashJs"></script></body></html>';
    writeFileSync(join(dir,'_site/index.html'),html);
    for(const alias of ['gestionale-v2','gestionale-v3']){mkdirSync(join(dir,'_site',alias));writeFileSync(join(dir,'_site',alias,'index.html'),html)}
    const injected="window.OPTYKER_CASH_BUILD='20260910-ovc2';\nfunction ovcCartKey(){return 'preserve repricing'}\nfunction openProductPicker(){return 'preserve picker'}\n";
    writeFileSync(join(dir,'_site/cash-register.js'),injected);
    writeFileSync(join(dir,'_site/cart-privacy-version.json'),JSON.stringify({assets:{'cash-register.js':'old-hash'}}));
    for(let n=0;n<2;n++)execFileSync('python3',['scripts/apply_ovc_operations.py'],{cwd:dir});
    const out=readFileSync(join(dir,'_site/index.html'),'utf8');
    assert.equal(out,html.replace('cash-register.js?v=20260910-ovc2','cash-register.js?v=20260912-rch-confirmed2'));
    for(const alias of ['gestionale-v2','gestionale-v3'])assert.equal(readFileSync(join(dir,'_site',alias,'index.html'),'utf8'),out);
    const cash=readFileSync(join(dir,'_site/cash-register.js'),'utf8');
    assert.equal(cash,injected.replace('20260910-ovc2','20260912-rch-confirmed2'));
    const digest=createHash('sha256').update(cash).digest('hex');
    for(const name of ['cart-privacy-version.json','operations-version.json'])assert.equal(JSON.parse(readFileSync(join(dir,'_site',name),'utf8')).assets['cash-register.js'],digest);
    // The subsequent September release only rewrites its exact old Operations tag.
    assert.equal(out.replace('cash-register.js?v=20260910-ovc2','cash-register.js?v=20260911-workflow1'),out);
  }finally{rmSync(dir,{recursive:true})}
});
