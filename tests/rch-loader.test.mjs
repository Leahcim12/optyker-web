import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,cpSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
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
