import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAdmin,readLimited,validateTechnicalFile} from '../supabase/functions/optyker-ts-api/security.mjs';
import {createHmac} from 'node:crypto';
const key='fixture-signing-key-not-a-real-credential';
function token(overrides={}) {
  const payload=Buffer.from(JSON.stringify({sub:'Ottica Visual Care',scope:'billing_admin',iat:1000,exp:2000,...overrides})).toString('base64url');
  return 'Bearer '+payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');
}
test('only genuine unexpired administration sessions authorize TS configuration',async()=>{
  assert.ok(await verifyAdmin(token(),key,1500));
  for (const [value,secret] of [[token(), 'wrong'],[token({scope:'staff'}),key],[token({sub:'OPERATOR'}),key],[token({exp:1500}),key],[token({iat:1600}),key],[token({exp:40000}),key],[token()+'.extra',key],['Bearer invalid',key]])
    assert.equal(await verifyAdmin(value,secret,1500),null);
});
test('body limits also apply when the sender omits Content-Length',async()=>{
  const small=new Request('https://example.test',{method:'POST',body:'123'});
  assert.equal(new TextDecoder().decode(await readLimited(small,3)),'123');
  await assert.rejects(readLimited(new Request('https://example.test',{method:'POST',body:'1234'}),3),/TS_TOO_LARGE/);
});
test('technical files cannot use path traversal or masquerade as scripts',()=>{
  const bytes=s=>new TextEncoder().encode(s);
  assert.equal(validateTechnicalFile('kit.zip',new Uint8Array([80,75,3,4])),'zip');
  assert.equal(validateTechnicalFile('schema.xsd',bytes('<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">')),'xsd');
  assert.equal(validateTechnicalFile('specs.pdf',bytes('%PDF-1.7')),'pdf');
  for(const [name,contents] of [['../spec.pdf','%PDF-1.7'],['x.pdf','<script>'],['x.js','test'],['x.xsd','<!DOCTYPE x><schema>'],['x.xsd','<!ENTITY x><schema>'],['x.pdf','']])
    assert.throws(()=>validateTechnicalFile(name,bytes(contents)),/TS_INVALID_FILE/);
});
