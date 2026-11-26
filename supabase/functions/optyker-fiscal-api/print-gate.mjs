// Cassa 20261123: nessuna nuova stampa RCH finché manca la chiusura del giorno precedente
// (o del periodo di chiusura / ferie). La regola è public.optyker_cash_print_gate.
// Se il controllo non risponde il flusso resta quello di prima: si blocca solo su un «no» esplicito.
export const PRINT_GATE_FALLBACK = 'Stampa bloccata: fai prima la chiusura RCH del giorno precedente.';

export function createPrintGate(db) {
  return async function assertPrintGate() {
    let gate = null;
    try {
      const r = await db.rpc('optyker_cash_print_gate', {p_register_code: 'main'});
      if (r && !r.error) gate = r.data ?? null;
    } catch {
      gate = null;
    }
    if (gate && gate.allowed === false) throw new Error(String(gate.message || PRINT_GATE_FALLBACK));
  };
}
