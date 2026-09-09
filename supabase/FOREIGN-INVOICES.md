# Fatture estere da documento originale

Accesso: **Amministrazione → Fatture estere**. Caricamento PDF/JPG/PNG, massimo 8 MB, una fattura per file.

Gli originali sono nel bucket privato `optyker-foreign-invoices`. Metadati, estrazione e collegamento alla bozza sono accessibili soltanto dal backend, dopo la verifica della sessione amministrativa. I link agli originali scadono dopo due minuti.

La lettura automatica richiede `OPENAI_API_KEY` nei segreti della funzione Supabase. `OPENAI_INVOICE_MODEL` è facoltativo; predefinito `gpt-4.1-mini`. Non inserire la chiave nel repository o nel browser. Se la chiave manca, il caricamento e la compilazione manuale funzionano; l’interfaccia indica che l’estrazione non è attiva. Il tentativo di creazione della chiave tramite il connettore OpenAI Platform è stato rifiutato: nessuna nuova chiave è stata salvata o installata.

Il documento viene inviato a OpenAI solo con l’azione di lettura dichiarata nell’interfaccia. La richiesta usa output strutturato, nessuno strumento o URL esterno e `store:false`. Il modello estrae dati, non decide l’aliquota IVA italiana. Campi non leggibili rimangono vuoti.

L’utente verifica natura dell’acquisto, intestazione a Mologni Company, date, IVA e cambio. Sono gestiti TD17, TD18 e TD19 nei casi selezionati. Importazioni con bolletta doganale, note di credito, originali con imposte e documenti multipli restano bloccati in questo percorso. L’imponibile in euro deve riconciliarsi con quello originale e il cambio indicato.

La serie rimane quella estera già configurata (`/26/A/ES`). Il caricamento e l’anteprima non consumano numeri. Una transazione protegge l’identità del fornitore/numero/data e il collegamento unico originale-bozza. La conferma di creazione e la conferma di invio SDI usano il flusso esistente.

Verifica: `node --test tests/foreign-invoices.test.mjs tests/fic.test.mjs tests/fic-issuance.test.mjs`.

Riferimenti: [input di file OpenAI](https://developers.openai.com/api/docs/guides/file-inputs), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [creazione documenti Fatture in Cloud](https://developers.fattureincloud.it/docs/guides/invoice-creation/), [autofatture TD17/TD18/TD19](https://www.fattureincloud.it/glossario/fatturazione-elettronica/autofattura-td-17-td-18-19/).
