# Collegamento Fatture in Cloud

Integrazione di lettura per MOLOGNI COMPANY S.R.L. (P.IVA 04679780165).

## Configurazione

1. Applicare `fic-setup.sql` come migrazione al progetto Supabase di Optyker.
2. Nell'app privata Optyker di Fatture in Cloud, mantenere OAuth 2.0 e impostare Redirect URL:
   `https://whgziwaegjzqsgcntesr.supabase.co/functions/v1/optyker-billing-admin`
3. Completare descrizione e logo dell'app. Conservare Client ID e Client Secret soltanto nei segreti delle Edge Functions come `FIC_CLIENT_ID` e `FIC_CLIENT_SECRET`. Non inserirli in chat, repository o frontend.
4. Pubblicare `functions/optyker-billing-admin/index.ts` insieme a `fic.ts`. Mantenere `verify_jwt=false`: la funzione verifica autonomamente la sessione amministrativa HMAC; il callback GET verifica uno stato monouso con scadenza.
5. Accedere all'amministrazione Optyker, scegliere **Collega Fatture in Cloud**, autorizzare MOLOGNI COMPANY S.R.L., quindi **Aggiorna fatture**.

Scope di sola lettura: fatture emesse, note di credito emesse, documenti ricevuti, magazzino (richiesto dalla specifica API per listReceivedDocuments).

## Comportamento e limiti

- Importazione manuale su richiesta: fatture e note di credito emesse; spese già registrate in Acquisti di Fatture in Cloud. I documenti ancora “Da registrare” non vengono importati.
- Nessuna emissione/invio SDI, modifica di documenti in Fatture in Cloud, esportazione PDF cumulativa o sincronizzazione pianificata.
- Ogni sincronizzazione rilegge i documenti e aggiorna le righe esistenti. Gli ID hanno prefisso `fic:` per distinguerli da eventuali documenti di altri provider. Le cancellazioni nel provider non cancellano la copia locale.
- Gli errori SDI mostrano lo stato fornito dall'elenco; i dettagli di scarto non vengono scaricati separatamente.
- Limiti: 20 pagine da 100 documenti per tipo, 90 secondi per lettura, 120 secondi prima delle scritture successive. Una sincronizzazione parziale è ripetibile senza duplicati. Importazioni grandi richiedono un processo incrementale.
- Refresh token cifrato AES-GCM, tabelle senza accesso anonimo/autenticato e con RLS. La chiave è derivata dalla service role key: dopo la sua rotazione occorre ricollegare l'account.
- Il collegamento e la prima sincronizzazione reale richiedono verifica con credenziali configurate. I test simulati non dimostrano l'accesso reale al provider.

## Verifica

`node --test tests/fic.test.mjs` (Node 24): stato OAuth scaduto/riutilizzato, azienda errata, cifratura dei token, refresh, paginazione, assenza di duplicati, errori API e concorrenza.

Documentazione: https://developers.fattureincloud.it/docs/authentication/code-flow/vanilla-code/
Specifica: https://github.com/fattureincloud/openapi-fattureincloud

## Emissione da Optyker — aggiornamento 9 settembre 2026

Applicare anche `fic-issuance-setup.sql` e pubblicare `issuance.ts` con gli altri due file della funzione.
Il pulsante **Nuova fattura** apre il modulo. **Abilita creazione e invio** richiede nuovamente OAuth con gli scope aggiuntivi `issued_documents.invoices:a` e `issued_documents.self_invoices:a`. Il collegamento di sola lettura rimane valido fino alla nuova autorizzazione.

Serie inizializzate sulla conferma dell'utente, senza reset se lo script viene riapplicato:

| Serie | Ultimo | Prossimo |
|---|---|---|
| Clienti / dettaglio | 38/26 | 39/26 |
| Ingrosso | 8/26/W | 9/26/W |
| Integrazioni / autofatture estere | 55/26/A/ES | 56/26/A/ES |

Le date precedenti non sono state fornite. La creazione richiede una conferma del controllo della data e verifica la cronologia dei documenti presenti in Fatture in Cloud e in Optyker. Solo l'anno 2026 è configurato: il nuovo anno richiede la configurazione esplicita delle serie.

Flusso: compilazione → calcolo totali del provider e bozza Optyker → conferma della creazione in Fatture in Cloud → visualizzazione del documento effettivo → conferma di invio SDI. Non inviare fatture reali per verificare il software senza approvazione sul documento specifico.

Supportati: fatture TD01 per clienti italiani; autofatture del fornitore estero TD17/TD18/TD19 con riferimento al documento originale; documento sanitario a persona fisica senza SDI. Aliquote IVA dal provider, valuta EUR, prezzi netti, nessuna movimentazione magazzino, pagamento inizialmente da incassare. La gestione Sistema TS e i casi fiscali speciali restano da implementare. La selezione del tipo fiscale compete all'operatore.

Numeri prenotati in una transazione PostgreSQL; confronto con le fatture del provider; ID bozza riutilizzato per evitare la creazione ripetuta. Una risposta di creazione o invio incerta viene segnalata e non viene ritentata automaticamente: controllare Fatture in Cloud prima di qualsiasi nuova operazione. I numeri prenotati da bozze respinte restano assegnati a tali bozze, che possono essere corrette e riprovate con lo stesso numero. Non abbandonarle senza verifica contabile.

Prima dell'invio viene confrontata l'impronta dei dati effettivamente mostrati nell'anteprima (valida 10 minuti), verificato il tipo nell'XML e chiamato il controllo del provider con `dry_run:true`. Solo la conferma successiva trasmette con `dry_run:false`. Sono ammessi invii iniziali di documenti con stato `not_sent`; la rettifica di scarti e i tentativi con esito incerto richiedono verifica nel provider. “Invio richiesto” non significa accettazione da parte dello SDI.

La sezione precedente “Comportamento e limiti” descriveva la prima versione in sola lettura: l'emissione e l'invio sono ora implementati come sopra, dopo l'estensione dei permessi. La sincronizzazione comprende anche le autofatture fornitore dopo tale autorizzazione.

Verifiche aggiuntive: `node --test tests/fic.test.mjs tests/fic-issuance.test.mjs` (13 test). La prova di trasmissione di documenti reali non è inclusa nei test.
