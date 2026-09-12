# Emissione RCH — release 20260912-fiscal1

## Stato effettivo

Implementati: emissione HTTP RCH delle righe, pagamento, codice fiscale opzionale, autorizzazione per singolo pagamento, diario locale persistente, blocco dei duplicati e degli esiti incerti, registrazione del numero stampato e coda delle righe sanitarie. Il connettore Windows è `1.6-fiscal-journal`.

Il collaudo sul registratore fisico non è stato eseguito da questa sessione. I test usano risposte simulate, oltre alle letture originali acquisite in negozio per identità/configurazione. Il numero fiscale viene trascritto dalla stampa: le risposte HTTP reali disponibili contengono `ECRStatus/mode` e `idleState`, senza il numero documento. Non si ricava un numero dalla sola lettura del contatore azzeramenti.

**Il trasporto Sistema TS non è implementato né attivo.** La coda conserva le sole righe sanitarie selezionate, collegate al documento fiscale confermato. Non esistono protocolli TS simulati o stati di accettazione derivati da HTTP 200. Non è stata configurata una trasmissione alternativa a pagamento.

## Utilizzo sul PC del negozio

1. Cassa → RCH → Installa / aggiorna connettore. L'installatore conserva il diario e sospende l'aggiornamento in presenza di operazioni incerte/in corso.
2. Dopo una vendita registrata, oppure dalla cronologia → **Emissione / esito RCH**, selezionare il pagamento.
3. Verificare descrizioni, quantità, importi e assegnare IVA/tipo per ogni riga. Il totale deve coincidere con il pagamento registrato. Acconti e saldi richiedono la ripartizione del solo importo pagato; nessuna ripartizione fiscale è indovinata automaticamente.
4. Per lo scontrino parlante selezionare il codice fiscale del cliente associato alla vendita. Il controllo comprende forma e carattere di controllo. La scelta è distinta dalla preparazione TS. AD/AA sono assegnati esplicitamente alle singole righe; l'opposizione elimina il CF dal documento destinato alla coda TS.
5. Confermare che il pagamento non è già stato documentato in Focus, sulla RCH o con fattura. **Emetti scontrino** è un'operazione fiscale reale: non usare vendite di prova fittizie. Tenere chiuso il carrello Focus durante l'operazione.
6. Dopo la chiusura confermata, riportare numero, data e totale letti sul documento. Una copia gestionale rimane distinta dal documento commerciale.

I soli reparti assegnati sono 1 (beni 4%), 2 (beni 22%), 3 (servizi esenti Art.10/N4). Il nuovo flusso non modifica la programmazione del registratore. Contanti/carta sono utilizzabili con i pagamenti POS esistenti; il driver supporta inoltre il codice assegni quando un pagamento è registrato esplicitamente come `cheque`. Bonifico e generico non riscosso non sono rimappati automaticamente.

## Esiti e confini

- `prepared`: autorizzazione breve, ancora nessun invio fiscale.
- `sending`: autorizzazione consumata una sola volta, registratore riservato nel cloud.
- `not_started`: verifiche preliminari fallite con certezza prima di qualsiasi comando fiscale; si possono rivedere i dati e rinnovare l'autorizzazione.
- `uncertain`: possibile esecuzione, sequenza interrotta. Non sono consentite ristampa dell'emissione o nuove emissioni sulla stessa matricola. Richiede verifica tecnica sul documento/registratore; non esiste sblocco automatico.
- `awaiting_reference`: tutti i comandi confermati, ritorno a REG inattivo; va registrato il riferimento stampato.
- `completed`: riferimento verificato dall'operatore e salvato. Se richiesto, coda TS inserita nella stessa transazione.

Un'interruzione dopo un comando non causa retry. Una risposta persa del cloud viene sincronizzata da **Aggiorna esito**, senza nuovi comandi alla stampante. La perdita della risposta alla prima acquisizione dell'autorizzazione può richiedere una verifica tecnica: viene privilegiata la prevenzione di una seconda emissione. Annulli fiscali/resi e riconciliazione automatica degli esiti incerti non sono implementati da questa release. L'eliminazione dalla cronologia non annulla un documento fiscale.

## Sicurezza e architettura

`optyker-fiscal-api` riutilizza l'autenticazione operatori interna della Cassa. Il connettore riceve soltanto una capacità casuale, breve e monouso per un pagamento; mai la password dell'operatore o la chiave di servizio. I token sono memorizzati come SHA-256 nel cloud. Il token per la sincronizzazione dell'esito è protetto con DPAPI sul PC Windows. Il diario viene scritto e sincronizzato su disco prima dei comandi; non contiene CF, descrizioni o XML fiscali. Host HTTP e origini consentite restano limitati a loopback/Optyker.

RLS attiva e privilegi anon/authenticated revocati per le due nuove tabelle. Nessuna policy di lettura pubblica è necessaria: l'accesso avviene dalla Edge Function dopo autenticazione. L'avviso informativo Supabase `rls_enabled_no_policy` corrisponde a questa scelta intenzionale. Vincoli univoci su pagamento, documento e operazione attiva per matricola. Nessuna modifica alla funzione Cassa/Shopify o alle credenziali esistenti.

## Blocco TS da risolvere

Il documento ufficiale **WS sincrono v1.3 del 20/12/2020** e le pagine del kit sviluppo restituiscono HTTP 403 sia al lettore web sia al download diretto di questa sessione. I risultati indicizzati segnalano anche specifiche di autenticazione aggiornate nel 2026. Non è quindi stato costruito un trasporto usando parametri, certificati o WSDL indovinati.

Occorre acquisire dal portale TS il **kit aggiornato per invio spese sanitarie**, con WSDL/XSD, specifiche di autenticazione attuali, certificato pubblico e istruzioni/ambiente di collaudo. Successivamente va configurato in un'interfaccia riservata l'accesso dell'esercente/delegato. Non inserire password o PIN nella chat, nel repository o nel frontend. Questi dati non sono stati richiesti né raccolti in questa release.

Riferimenti: [strumenti per lo sviluppo TS](https://sistemats1.sanita.finanze.it/portale/it/spese-sanitarie/documenti-e-specifiche-tecniche-strumenti-per-lo-sviluppo), [specifiche sincrone pubblicate](https://sistemats1.sanita.finanze.it/portale/documents/20182/34450/730%20Spese%20Sanitarie%20-%20WS%20Sincrono%20-%20Invio%20dati%20di%20spesa%20%20sanitaria%2020_12_2020.pdf/8c4b935c-9504-7c61-04ff-554f39240d97). Per RCH, manuale fornito dal cliente v14, pp.18–23 e 58–60; configurazione reale del 12/09/2026 descritta in FISCAL-CONNECTION.md.

## Verifica riproducibile

- `node --test tests/fiscal-domain.test.mjs tests/rch-preflight.test.mjs tests/rch-ui.test.mjs tests/rch-loader.test.mjs` — 23 test.
- `npm install --prefix /tmp/optyker-fiscal-test jsdom@26`; `OPTYKER_TEST_PACKAGE=/tmp/optyker-fiscal-test/package.json node --test tests/fiscal-ui.test.mjs` — 3 test DOM, non un collaudo visivo sul browser.
- PowerShell 7.4.13: `tests/rch-emission.test.ps1` e `tests/rch-connector.test.ps1`; più 4 test HTTP con `PWSH` impostato e i file `rch-http`, `rch-protocol-http`, `rch-configuration-http`.
- `tests/fiscal-db.test.sql` — vincoli, lock, privilegi, transazione riferimento/coda e idempotenza; dati sintetici annullati con ROLLBACK, nessun cliente o comando hardware.
- Deno typecheck del nuovo backend e build completa `scripts/vercel-build-v13.sh`.
- Probe pubblico: GET rifiutato, azioni senza autenticazione/capacità rifiutate, origine estranea rifiutata. Nessun tentativo con password di utenti reali.
