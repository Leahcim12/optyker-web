# Assistente IA su WhatsApp (7 novembre 2026)

Sul numero WhatsApp del negozio (360dialog, in coexistence con l'app WhatsApp Business) l'assistente risponde da solo **soltanto** a:

1. orari di apertura, indirizzo e contatti;
2. stato di occhiali e lenti a contatto ordinati (buste di laboratorio);
3. appuntamenti: vedere il prossimo, prenotarne uno, spostarlo o disdirlo (sempre con riepilogo e conferma del cliente);
4. lenti a contatto della scheda LAC: prodotto e colore della lente destra e della lente sinistra, se scritti nella scheda.

Per tutto il resto **non scrive niente**: il messaggio resta all'operatore, che risponde dall'app WhatsApp Business o da Optyker. Dà del tu.

## Come funziona

- `optyker-whatsapp-webhook` salva i messaggi ricevuti, quelli scritti dall'app WhatsApp Business del negozio (echi della coexistence) e gli stati di consegna; per ogni nuovo messaggio avvia `optyker-whatsapp-ai`.
- L'assistente aspetta 6 secondi per raccogliere più messaggi scritti di fila, poi:
  - resta zitto se un operatore ha scritto in quella chat nelle ultime 12 ore (dal telefono o da Optyker);
  - resta zitto se ha già lasciato la chat all'operatore e nessuno ha ancora risposto (al massimo 48 ore);
  - lascia all'operatore foto, audio, documenti e posizioni; ignora reazioni e sticker.
- **Il cliente è riconosciuto dal numero WhatsApp da cui scrive**: Optyker cerca il numero nel telefono e nel secondo telefono dell'anagrafica (anche cellulari a 9 cifre e numeri con +39 o 0039). L'assistente non chiede mai nome e cognome per riconoscerlo.
- I dati personali sono solo quelli dei clienti con quel numero. Se sul numero ci sono più persone (famiglia), guarda i dati di tutte: se riguardano una sola persona risponde chiamandola per nome («gli occhiali di Giulia sono pronti»), altrimenti risponde per ciascuna; chiede di chi si tratta solo se non riesce a capirlo. Per prenotare chiede per chi è l'appuntamento.
- Numero non presente in anagrafica: solo orari, indirizzo, contatti e nuove prenotazioni; il resto all'operatore.
- Ordini: considera solo quelli in lavorazione o pronti da non più di 30 giorni (i più vecchi sono quasi sempre già ritirati); se non ce ne sono, lascia all'operatore.
- Le risposte sono firmate *Assistente automatico · Ottica Visual Care* e compaiono anche nella chat del cliente in Optyker e sul telefono.
- Ogni decisione (risposta, silenzio e motivo, strumenti usati) è registrata in `optyker_wa_ai_log`.

## Accensione

1. Supabase → Edge Functions → Secrets: aggiungere `ANTHROPIC_API_KEY` (chiave API da console.anthropic.com). `D360_API_KEY` c'è già.
2. Prova con un solo numero (il proprio cellulare):
   `update optyker_wa_ai_settings set enabled = true, test_phones = '{39XXXXXXXXXX}' where id = 1;`
3. Per tutti i clienti:
   `update optyker_wa_ai_settings set enabled = true, test_phones = '{}' where id = 1;`

Spegnere: `update optyker_wa_ai_settings set enabled = false where id = 1;`

Prova senza inviare niente: `optyker-whatsapp-ai` con `mode: "dry_run"` e un token monouso di `optyker_whatsapp_selfcheck` (il risultato viene scritto nella riga del token).

## Impostazioni (`optyker_wa_ai_settings`)

| Campo | Predefinito | Significato |
|---|---|---|
| `enabled` | `false` | interruttore generale |
| `test_phones` | vuoto | se valorizzato, risponde solo a questi numeri |
| `model` | `claude-sonnet-5-5` | modello IA |
| `operator_pause_hours` | 12 | ore di silenzio dopo un messaggio dell'operatore |
| `handoff_wait_hours` | 48 | ore di attesa massima dell'operatore dopo un passaggio |
| `signature` | *Assistente automatico · Ottica Visual Care* | firma in fondo alle risposte |
| `store_info` | indirizzo, sito, WhatsApp | testo del negozio usato per le risposte su contatti |

## Da sapere

- Lo stato delle buste passa da solo a "pronto" alla data prevista se nessuno lo cambia a mano: se il laboratorio è in ritardo, aggiornare lo stato in Optyker, altrimenti l'assistente dirà che è pronto.
- Le prenotazioni fatte dall'assistente hanno la nota "Prenotato su WhatsApp dall'assistente automatico" e attivano le automazioni già esistenti (es. conferma appuntamento).
- Test: `node --experimental-strip-types --test tests/whatsapp-ai.test.mjs`.
