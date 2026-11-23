// Cassa 20261123: il registro fiscale rifiuta nuove stampe solo con un «no» esplicito del controllo chiusura.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPrintGate, PRINT_GATE_FALLBACK} from '../supabase/functions/optyker-fiscal-api/print-gate.mjs';

const gateWith = rpc => createPrintGate({rpc});

test('stampa consentita quando la chiusura c’è', async () => {
  let args;
  await gateWith(async (name, params) => { args = [name, params]; return {data: {allowed: true, reason: 'closed_yesterday'}, error: null}; })();
  assert.deepEqual(args, ['optyker_cash_print_gate', {p_register_code: 'main'}]);
});

test('stampa rifiutata con il messaggio del controllo', async () => {
  const message = 'Stampa bloccata: manca la chiusura RCH del giorno precedente (domenica 22/11).';
  await assert.rejects(gateWith(async () => ({data: {allowed: false, message}, error: null}))(), {message});
  await assert.rejects(gateWith(async () => ({data: {allowed: false}, error: null}))(), {message: PRINT_GATE_FALLBACK});
});

test('controllo non disponibile: nessun blocco', async () => {
  await gateWith(async () => ({data: null, error: {message: 'function does not exist'}}))();
  await gateWith(async () => { throw new Error('rete'); })();
  await gateWith(async () => ({data: null, error: null}))();
  await gateWith(async () => undefined)();
  await gateWith(async () => ({data: {allowed: 'false'}, error: null}))();
});

test('il controllo è prima di ogni nuova autorizzazione di stampa, scontrino e annullo', () => {
  const src = readFileSync(new URL('../supabase/functions/optyker-fiscal-api/index.ts', import.meta.url), 'utf8');
  assert.match(src, /import \{createPrintGate\} from '\.\/print-gate\.mjs';/);
  for (const fn of ['async function prepare(', 'async function prepareVoid(']) {
    const body = src.slice(src.indexOf(fn), src.indexOf('\n}', src.indexOf(fn)));
    const gate = body.indexOf('await assertPrintGate();');
    assert.ok(gate > 0, fn + ' senza controllo chiusura');
    // Gli esiti già in corso restano consultabili; il controllo viene prima di ogni claim_hash.
    assert.ok(gate > body.indexOf("if(existing&&!['prepared','not_started'].includes(existing.state))return {job:publicJob(existing)};"));
    assert.ok(gate < body.indexOf('claim_hash'));
  }
});
