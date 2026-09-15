# Annullamento unico TS + RCH

L’operatore apre lo scontrino e conferma una volta l’annullo completo. Data, numero e importo originali sono riletti dal server; non vengono accettati dal client per l’annullo unificato. La conferma resta in `optyker_unified_voids`, protetta da RLS e accessibile soltanto dal backend. Le normali credenziali staff sono verificate prima di ogni azione. Nessuna chiave privilegiata o credenziale TS raggiunge il browser.

Il coordinatore verifica gli invii TS incerti usando le sole interrogazioni. Per spese accettate autorizza una capability monouso per un solo documento e usa il worker TS esistente. Un protocollo non è sufficiente: la cancellazione richiede l’esito finale. Se manca il protocollo dopo un POST incerto, non invia nuovamente. Le cancellazioni già confermate e quelle non necessarie passano al normale `prepareVoid`, che conserva la guardia TS e il claim monouso RCH.

La pagina riaperta recupera le pratiche confermate. Finché Optyker è aperto e autenticato, controlla le pratiche ogni 15 secondi; il lavoro TS avviato prosegue in background entro i limiti Edge. Non è un servizio di polling perpetuo a browser chiuso. Ogni worker ha un lease di cinque minuti, e nessuno stato incerto consente di ripetere il POST.

L’annullo RCH usa esclusivamente il comando completo `=k` con data, chiusura e numero originali. Il nuovo connettore legge il giornale prima e dopo; registra il riferimento soltanto se corrispondono successione, matricola, importo, tipo annullo e documento originale. Nessuna numerazione viene dedotta senza riscontro. Se il formato del giornale non è riconoscibile o la stampa non è certa, la pratica richiede verifica e non viene ristampata automaticamente.

È necessario aggiornare una volta il connettore e il cloud worker sul PC Windows tramite l’installatore RCH esistente. La capacità `automaticVoidReference` è verificata prima di accettare una nuova richiesta unificata, anche tramite iPad. Nessuno scontrino reale è usato per test di rete.

Ambito: annullo completo di scontrini Optyker con riferimento confermato. Resi parziali, rimborsi di denaro, ordini Shopify, variazioni TS di documenti scartati e scontrini esterni senza dati verificati restano separati. Non sono simulati come annulli completi.

Test: `node --test tests/unified-fiscal-void.test.mjs tests/ts-cancellation.test.mjs tests/ts-transport.test.mjs`; DOM locale `tests/unified-fiscal-void-ui.test.mjs`; SQL `tests/unified-fiscal-void-db.test.sql` contiene BEGIN/ROLLBACK e non chiama TS né RCH.
