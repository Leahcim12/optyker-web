# Optyker: attivazione cassa RCH e Sistema TS

## Stato della versione 20260909-rch-status2

Non abilita emissione fiscale o trasmissione TS. Le vendite e i pagamenti restano registrazioni gestionali. I nuovi dati TS usano `provider=not_configured`; i record storici non vengono riscritti. Non esiste ancora un servizio di trasmissione TS in questa versione.

La diagnostica RCH 1.5 corregge la conversione delle liste PowerShell, legge il corpo HTTP in byte UTF-8, limita tempi e dimensioni, rifiuta risposte XML incomplete e DTD, controlla Host/Origin e impedisce comandi via GET. L'endpoint `/receipt` restituisce 409 senza contattare la stampante: il vecchio generatore ignorava il prezzo e non gestiva codice fiscale, identificativo documento o tentativi ripetuti.

La diagnosi del negozio ricevuta il 09/09/2026 contiene `errorCode=101`, `lastCmd=0` per `</?i/*4`. Questo conferma una risposta RCH, ma non una richiesta di stato accettata. Il significato preciso di 101 per il firmware installato non è stato verificato nel manuale del produttore.

La versione 1.5 prova prima `<</?s`, richiesta di stato descritta dallo sviluppatore di un'integrazione RCH nel suo [resoconto diretto](https://www.iprogrammatori.it/forum-programmazione/fatturazione-elettronica/printf-esempio-scontrino-t42108-30.html). Solo se riceve 101 con i campi occupato, carta, coperchio ed errore stampante a zero, prova una volta `</?i/*4`, presente nel codice pubblico dell'[SDK indipendente fiscal-printer](https://github.com/lyancoder/fiscal-printer). Il messaggio XML ora usa righe separate e Content-Type `application/xml`, come il client pubblico. La richiesta disattiva inoltre `Expect: 100-continue`, connessioni persistenti e trasferimento chunked, per inviare direttamente un corpo di lunghezza dichiarata ([comportamento documentato da Microsoft](https://learn.microsoft.com/en-us/dotnet/api/system.net.servicepoint.expect100continue?view=netframework-4.8.1)). Questi sono adattamenti di compatibilità da verificare sulla RCH reale, non una diagnosi certa della causa di 101.

Non vengono ripetute richieste dopo timeout, risposta accettata, busy o errori hardware. Non vengono ripetuti comandi di scrittura. La diagnosi conserva il messaggio XML esatto inviato e la risposta, per consentire la verifica del protocollo. Reparti e pagamenti non vengono indovinati. Il [manuale del produttore](https://support.rch.it/docs/print-rt/manuale-protocollo-print-rt/) richiede autenticazione.

`reportGenerated=true` indica un rapporto creato, `printerReached=true` una risposta RCH riconoscibile, `statusAccepted=true` una risposta completa priva di errori alla richiesta di stato. Nessuno certifica configurazione fiscale, emissione o invio a TS/AdE.

## Passaggio sul PC del negozio

Da Optyker > Cassa > RCH scaricare ed eseguire “Installa / aggiorna connettore”. Poi “Scarica diagnosi”. Se il browser impedisce l'accesso alla rete locale, usare “Diagnostica Windows”. Il file JSON può essere allegato alla chat. Non contiene credenziali TS; può contenere identificativi del registratore.

## Dati e verifiche ancora necessari

- Manuale di protocollo RCH relativo a modello e firmware installati, configurazione reale dei reparti IVA/natura e dei pagamenti.
- Comandi e risposte verificati per codice fiscale, apertura/chiusura documento, riferimento fiscale, stato di una richiesta interrotta ed esiti di trasmissione AdE.
- Accesso TS dell'esercente o delegato abilitato, specifiche correnti e ambiente di prova. Le credenziali andranno inserite mediante configurazione riservata, mai nella chat o nel codice frontend.
- Classificazione sanitaria per singola riga, gestione opposizione e acconti/saldi secondo le specifiche applicabili, prima di abilitare invii.
- Un identificativo persistente per pagamento/documento con vincolo univoco nel backend e registro locale prima dell'invio RCH. Un timeout dovrà produrre “esito da verificare”, non un tentativo automatico con un nuovo documento.
- I protocolli TS e le ricevute AdE devono essere acquisiti dai servizi reali; nessuno stato `sent`/`accepted` deve derivare dalla sola registrazione gestionale o da HTTP 200.

Il collegamento Fatture in Cloud già presente è distinto dal registratore e dall'invio TS.

## Verifica eseguita in sviluppo

`pwsh -NoProfile -File tests/rch-connector.test.ps1` e `PWSH=/path/to/pwsh node --test tests/rch-http.test.mjs` verificano XML incompleto, errori stampante, DTD, corpo UTF-8, origini estranee, host non locale, metodi HTTP, blocco emissione e diagnostica offline. Eseguiti su PowerShell 7.4.13 Linux con hash del runtime verificato. La compatibilità effettiva Windows PowerShell 5.1 e la comunicazione con il registratore fisico restano da provare sul PC. L'installatore controlla la sintassi con il parser PowerShell locale prima di sostituire il connettore.
