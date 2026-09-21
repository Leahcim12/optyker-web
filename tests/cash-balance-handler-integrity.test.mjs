import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
test('read-only balance extension preserves every byte of deployed financial handler',()=>{
 const source=readFileSync(new URL('../supabase/functions/optyker-cash-register-api-v2/index.ts',import.meta.url),'utf8');
 const clean=source.replace("import {readRecordedBalances} from '../optyker-cash-balance-api/snapshot.ts';\n",'').replace("  if(action==='balance_snapshot'){await auth(body);return out({ok:true,data:await readRecordedBalances(p.client_id)})}\n",'');
 assert.equal(createHash('sha256').update(clean).digest('hex'),'685d0cdb940ffdf860d7ba0c117ee0a098940be7fcf6cbc2077b01497c35d354');
 assert.match(source,/balance_snapshot.*await auth\(body\).*readRecordedBalances/);
 const reader=readFileSync(new URL('../supabase/functions/optyker-cash-balance-api/snapshot.ts',import.meta.url),'utf8');
 assert.doesNotMatch(reader,/\.(insert|update|upsert|delete|rpc)\(/);
});
