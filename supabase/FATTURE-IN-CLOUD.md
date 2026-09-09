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
