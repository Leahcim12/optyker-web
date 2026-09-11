# Optyker: attivazione cassa RCH e Sistema TS

## Manuale v14 acquisito e diagnostica di compatibilita

Il negozio ha fornito `Manuale_Protocollo_PRINT!F_v.14.pdf`, 119 pagine, rel.2102. Nonostante il titolo PRINT! F, contiene esplicitamente i comandi in modalita RT, le revisioni fino alla 14 (11/2020) e il capitolo Corrispettivi XML v7. Il PDF originale resta privato e non viene pubblicato nel repository o nel sito.

Riferimenti verificati nel manuale: vendite/pagamenti pp.20-22; codice fiscale p.23; resi/annulli pp.26-28; stato, firmware, matricola, contatore azzeramenti e stato RT pp.58-61; lettura programmazioni in PRG/SRV p.62; distinzione beni/servizi e mappatura aliquote pp.90-95. Il protocollo dei comandi e ora disponibile; la compatibilita con il firmware reale e le risposte HTTP/XML complete devono ancora essere verificate.

`rch-connector/Diagnostica-Protocollo-RCH.bat` scarica in una cartella temporanea dedicata la diagnostica e i soli helper del connettore 1.5, ne verifica gli hash SHA-256 e avvia PowerShell senza installare o sostituire il servizio esistente. Non richiede privilegi amministrativi. Il file JSON viene salvato sul Desktop con un nome univoco `Diagnostica-Protocollo-RCH-*.json`.

Eseguire sul PC della cassa, lasciando il registratore libero da vendite/operazioni durante la lettura. La sequenza usa solo `<</?s`, `<</?f`, `<</?m`, `<</?i/*3`, `<</?d`, `<</?7`, `<</?i/*5`. Ogni comando viene eseguito una sola volta; errori, timeout o stato occupato/ignoto interrompono la raccolta conservando il rapporto parziale. Non cambia modalita, non legge anagrafiche, non modifica programmazioni, non stampa e non invia a TS/AdE. Le letture di programmazione dei reparti non sono incluse, poiche richiedono PRG/SRV e vanno gestite separatamente.

Il trasporto HTTP e l'involucro XML sono quelli gia accettati dal dispositivo del negozio. Il manuale fornito descrive anche il protocollo TCP legacy: non si presume che gli esempi di tracciati TCP coincidano con le risposte HTTP. Le risposte e le foglie XML vengono conservate senza inventare campi firmware o seriale. `allQueriesAccepted` descrive le sole conferme ai comandi: `compatibilityVerified`, `fiscalEmissionEnabled` ed `emittedFiscalDocument` restano false anche in caso di esito positivo. Il valore `expectedSerialFromUser` e un riferimento dichiarato dal negozio, non una lettura della matricola.

I blocchi operativi restano: verifica firmware/risposte e configurazione reale, gestione persistente degli esiti incerti e duplicati, implementazione/test del ciclo fiscale completo e servizio TS separato. Nessuno scontrino reale e stato emesso durante lo sviluppo.

Verifiche: `pwsh -NoProfile -File tests/rch-protocol.test.ps1` copre allowlist, import senza effetti, arresto senza ripetizioni per errori/timeout/stati ignoti o documento aperto, risposta generica non scambiata per firmware e salvataggio senza sovrascrivere rapporti. `PWSH=/path/to/pwsh node --test tests/rch-protocol-http.test.mjs` esegue sette richieste HTTP reali verso un server locale simulato e verifica XML, Content-Type, lunghezza e conservazione delle risposte. Eseguiti su PowerShell 7.4.13 Linux, con hash del runtime verificato sul rilascio Microsoft. Verificata anche la sintassi PowerShell del launcher; il doppio clic Windows e il dispositivo reale richiedono la prova sul PC del negozio.

## Stato della versione 20260911-rch-profile1

La configurazione fornita dal negozio è ora nel modulo `rch-preflight.js` e nella finestra Cassa > RCH. Il connettore Windows resta **1.5-status-compatibility**: nessuna reinstallazione è richiesta per questo aggiornamento web. Nessun comando fiscale viene aggiunto.

Evidenze acquisite:

- Diagnostica reale del 09/09/2026: `<</?s` accettato con `errorCode=0`, `lastCmd=1`, `busy=0`, modalità **Z**. Questo conferma la comunicazione, non la modalità registrazione. Il frontend distingue REG da Z/PRG/X/modalità ignota.
- Stampa di programmazione RCH del 11/09/2026 09:42 (foto IMG_3590–3594): 01 contanti, 02 non riscosso beni, 03 assegni, 04 carte elettroniche, 05 tickets, 06 non riscosso servizi, 07 non riscosso fatture, 08 non riscosso DCR SSN, 09 sconto a pagare, 10 buoni multiuso, 11 buoni celiachia. 12–30 sono etichette generiche e non sono assegnate automaticamente.
- La stampa conferma IP 192.168.1.10, porta TCP 23 e matricola 72IV6003831. La porta 23 è del protocollo TCP legacy usato da Focus; il connettore Optyker mantiene il Web Service HTTP già verificato, senza cambiarne porta o trasporto.
- Reparti dalla schermata Focus ECR del 09/09/2026: reparto 1 → codice IVA 04; reparto 2 → 22; reparto 3 → ART10/N4. Non sono ancora stati riletti direttamente dal registratore.
- Gli indici della tabella aliquote stampata **non sono numeri reparto**: l'aliquota n. 3 vale 10%, ma ciò non cambia il reparto 3 ART10. IVA 10%, 5%, ART15 e NV non ricevono un reparto inventato.

“Controlla carrello · senza stampa” esegue solo una validazione in memoria: richiede un codice IVA esplicito `fiscal_vat_code` per riga, importi in centesimi e quantità intere; non ricava l'IVA da titolo, categoria prodotto o percentuali Shopify. I prodotti senza codice fiscale esplicito sono segnalati, non modificati. Anche bonifico e non riscosso generico sono segnalati come non mappati. Acconti, fatture e saldi collegati a documenti precedenti richiedono un flusso dedicato.

Il controllo non salva vendite, non invia il codice fiscale, non chiama il connettore e restituisce sempre `canEmit=false`, `canSubmitTs=false`, `emittedFiscalDocument=false`. Un controllo dati superato non abilita l'emissione. Le diagnosi scaricate dal browser includono il profilo acquisito, esplicitamente distinto dai valori letti in diretta.

Verifiche di questa versione: `node --test tests/rch-preflight.test.mjs tests/rch-loader.test.mjs tests/rch-ui.test.mjs` (14 test). I test UI usano un DOM minimale simulato, non un browser visuale. La verifica visuale è stata tentata ma il browser ha bloccato il server locale (`ERR_BLOCKED_BY_CLIENT`). Il connettore e le sue protezioni non sono modificati.

## Connettore Windows 1.5 (invariato)

Non abilita emissione fiscale o trasmissione TS. Le vendite e i pagamenti restano registrazioni gestionali. I nuovi dati TS usano `provider=not_configured`; i record storici non vengono riscritti. Non esiste ancora un servizio di trasmissione TS in questa versione.

La diagnostica RCH 1.5 corregge la conversione delle liste PowerShell, legge il corpo HTTP in byte UTF-8, limita tempi e dimensioni, rifiuta risposte XML incomplete e DTD, controlla Host/Origin e impedisce comandi via GET. L'endpoint `/receipt` restituisce 409 senza contattare la stampante: il vecchio generatore ignorava il prezzo e non gestiva codice fiscale, identificativo documento o tentativi ripetuti.

La diagnosi del negozio ricevuta il 09/09/2026 contiene `errorCode=101`, `lastCmd=0` per `</?i/*4`. Questo conferma una risposta RCH, ma non una richiesta di stato accettata. Il significato preciso di 101 per il firmware installato non è stato verificato nel manuale del produttore.

La versione 1.5 prova prima `<</?s`, richiesta di stato descritta dallo sviluppatore di un'integrazione RCH nel suo [resoconto diretto](https://www.iprogrammatori.it/forum-programmazione/fatturazione-elettronica/printf-esempio-scontrino-t42108-30.html). Solo se riceve 101 con i campi occupato, carta, coperchio ed errore stampante a zero, prova una volta `</?i/*4`, presente nel codice pubblico dell'[SDK indipendente fiscal-printer](https://github.com/lyancoder/fiscal-printer). Il messaggio XML ora usa righe separate e Content-Type `application/xml`, come il client pubblico. La richiesta disattiva inoltre `Expect: 100-continue`, connessioni persistenti e trasferimento chunked, per inviare direttamente un corpo di lunghezza dichiarata ([comportamento documentato da Microsoft](https://learn.microsoft.com/en-us/dotnet/api/system.net.servicepoint.expect100continue?view=netframework-4.8.1)). Questi sono adattamenti di compatibilità da verificare sulla RCH reale, non una diagnosi certa della causa di 101.

Non vengono ripetute richieste dopo timeout, risposta accettata, busy o errori hardware. Non vengono ripetuti comandi di scrittura. La diagnosi conserva il messaggio XML esatto inviato e la risposta, per consentire la verifica del protocollo. Reparti e pagamenti non vengono indovinati. Il [manuale del produttore](https://support.rch.it/docs/print-rt/manuale-protocollo-print-rt/) richiede autenticazione.

`reportGenerated=true` indica un rapporto creato, `printerReached=true` una risposta RCH riconoscibile, `statusAccepted=true` una risposta completa priva di errori alla richiesta di stato. Nessuno certifica configurazione fiscale, emissione o invio a TS/AdE.

## Passaggio sul PC del negozio

Da Optyker > Cassa > RCH scaricare ed eseguire “Installa / aggiorna connettore”. Poi “Scarica diagnosi”. Se il browser impedisce l'accesso alla rete locale, usare “Diagnostica Windows”. Il file JSON può essere allegato alla chat. Non contiene credenziali TS; può contenere identificativi del registratore.

## Dati e verifiche ancora necessari

- Verificare la compatibilita del manuale v14 acquisito con firmware e risposte del dispositivo, e la configurazione reale dei reparti IVA/natura e dei pagamenti.
- Comandi e risposte verificati per codice fiscale, apertura/chiusura documento, riferimento fiscale, stato di una richiesta interrotta ed esiti di trasmissione AdE.
- Accesso TS dell'esercente o delegato abilitato, specifiche correnti e ambiente di prova. Le credenziali andranno inserite mediante configurazione riservata, mai nella chat o nel codice frontend.
- Classificazione sanitaria per singola riga, gestione opposizione e acconti/saldi secondo le specifiche applicabili, prima di abilitare invii.
- Un identificativo persistente per pagamento/documento con vincolo univoco nel backend e registro locale prima dell'invio RCH. Un timeout dovrà produrre “esito da verificare”, non un tentativo automatico con un nuovo documento.
- I protocolli TS e le ricevute AdE devono essere acquisiti dai servizi reali; nessuno stato `sent`/`accepted` deve derivare dalla sola registrazione gestionale o da HTTP 200.

Il collegamento Fatture in Cloud già presente è distinto dal registratore e dall'invio TS.

## Verifica eseguita in sviluppo

`pwsh -NoProfile -File tests/rch-connector.test.ps1` e `PWSH=/path/to/pwsh node --test tests/rch-http.test.mjs` verificano XML incompleto, errori stampante, DTD, corpo UTF-8, origini estranee, host non locale, metodi HTTP, blocco emissione e diagnostica offline. Eseguiti su PowerShell 7.4.13 Linux con hash del runtime verificato. La compatibilità effettiva Windows PowerShell 5.1 e la comunicazione con il registratore fisico restano da provare sul PC. L'installatore controlla la sintassi con il parser PowerShell locale prima di sostituire il connettore.
