# Optyker: attivazione cassa RCH e Sistema TS

## Stato della versione 20260909-fiscal-setup1

Non abilita emissione fiscale o trasmissione TS. Le vendite e i pagamenti restano registrazioni gestionali. I nuovi dati TS usano `provider=not_configured`; i record storici non vengono riscritti. Non esiste ancora un servizio di trasmissione TS in questa versione.

La diagnostica RCH 1.4 corregge la conversione delle liste PowerShell, legge il corpo HTTP in byte UTF-8, limita tempi e dimensioni, rifiuta risposte XML incomplete e DTD, controlla Host/Origin e impedisce comandi via GET. L'endpoint `/receipt` restituisce 409 senza contattare la stampante: il vecchio generatore ignorava il prezzo e non gestiva codice fiscale, identificativo documento o tentativi ripetuti.

La diagnostica usa la sola interrogazione di stato `</?i/*4` e un GET passivo a `service.cgi`. Il comando di stato è riscontrato nel codice pubblico dell'SDK indipendente [fiscal-printer](https://github.com/lyancoder/fiscal-printer). Non è una verifica del protocollo specifico del dispositivo; reparti e pagamenti non vengono indovinati. Il manuale del produttore [Protocollo PRINT! RT](https://support.rch.it/docs/print-rt/manuale-protocollo-print-rt/) richiede autenticazione.

`reportGenerated=true` significa soltanto che il rapporto è stato creato. `printerReady` riguarda la risposta di stato. Nessuno dei due conferma emissione, matricola/reparti corretti, invio corrispettivi AdE o trasmissione TS.

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
