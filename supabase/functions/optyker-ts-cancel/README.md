# Cancellazione di una spesa TS già accettata

Il worker cancella un solo documento autorizzato da un amministratore tecnico oppure dal coordinatore di annullamento unificato, dopo autenticazione staff e conferma esplicita dell’operatore. Il coordinatore conserva un’intenzione immutabile per lo scontrino originale e genera la capability soltanto sul server. La tabella delle cancellazioni conserva motivo, autorizzazione, protocollo originale, nuovo protocollo, esito e ricevuta. RLS è attiva; anon e authenticated non hanno accesso alla tabella né alle funzioni di controllo.

L'endpoint non accetta identificativi di documenti dal chiamante: richiede una capability casuale di 256 bit, valida al massimo cinque minuti e consumata atomicamente, associata a una singola cancellazione e all'azione cancel o reconcile. Soltanto il controllo amministrativo e il coordinatore server autorizzato possono predisporre tale autorizzazione. Le credenziali TS rimangono nel Vault e sono lette soltanto dal server.

Prima dell'invio sono verificati lo scontrino completato, la sua data e il totale, il protocollo TS originale accettato, il mittente originale e l'interrogazione puntuale TS, inclusi gli importi sanitari. Il messaggio di cancellazione usa Cancellazione del WSDL DocumentoSpesa730p fornito nel kit ufficiale. Non invia il codice fiscale del cliente né le righe di spesa.

La richiesta è registrata prima del POST. Un timeout mantiene uno stato incerto; non è mai ammesso un secondo POST con la stessa autorizzazione. Per un protocollo disponibile, reconcile interroga solo l'esito, senza ripetere la cancellazione. Una risposta di ricezione con protocollo non equivale a cancellazione confermata: serve il suo esito finale positivo per un documento, con zero errori.

Solo tale esito porta la coda originale a ts_cancelled. Il protocollo e la ricevuta dell'invio originale rimangono conservati. La ricevuta di cancellazione è salvata nella tabella delle cancellazioni. La guardia RCH verifica la prova di cancellazione corrispondente, oltre allo stato: nessun blocco viene rimosso per una spesa ancora accettata o incerta.

ts_cancelled significa cancellazione della spesa sul TS; non significa annullo fiscale RCH. Se l'annullo RCH non parte, la spesa torna a ts_cancelled, mai alla coda degli invii. Il worker non emette documenti RCH e non modifica pagamenti o ordini Shopify.

## Verifiche

- node --test tests/ts-transport.test.mjs tests/ts-cancellation.test.mjs
- tests/ts-cancellation-db.test.sql deve essere eseguito fra BEGIN e ROLLBACK; non esegue chiamate di rete. Verifica autenticazione, token monouso, esiti incompleti e sblocco esclusivamente con prova della cancellazione.
