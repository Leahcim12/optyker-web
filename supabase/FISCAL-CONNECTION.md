# Optyker: attivazione cassa RCH e Sistema TS

**Aggiornamento:** emissione con connettore 1.6 e registro persistente descritta in [FISCAL-EMISSION.md](FISCAL-EMISSION.md). Invio TS ancora bloccato dal kit tecnico/accesso. Le sezioni seguenti documentano le fasi precedenti.

## Configurazione confermata il 12/09/2026 alle 10:43

Il rapporto `Configurazione-RCH-20260912-104354-c265fd6d.json` ha completato le quattro letture, con matricola `72IV6003831` corrispondente e stato PRG inattivo prima e dopo. SHA-256 del rapporto originale: `88c72b95c51638b5821fd02191643345e78fc6d1e0c7d55627cd5c0e1077216e`. Il file originale resta privato: nel codice vengono riportati solo i dati necessari al profilo del negozio.

La risposta XML reale contiene `Service/Prg`, con attributi `id` su 99 reparti, 40 aliquote e 30 pagamenti. I numeri degli elementi sono letti dagli attributi del documento originale; l'elenco delle sole foglie `values` non conserva tali identificativi. Per i tre reparti gia usati dal negozio la lettura conferma:

| Reparto | DepartmentType/value | vatCode/value (indice aliquota) | IVA e tipo operazione |
| --- | --- | --- | --- |
| 1 | 0 | 1 | Beni, 4% (`VAT type="VAT"`, value 400) |
| 2 | 0 | 2 | Beni, 22% (`VAT type="VAT"`, value 2200) |
| 3 | 1 | 0 | Servizi esenti (`VAT type="ES"`); N4 e codice gestionale ART10 confermati dalle precedenti stampe/Focus |

`DepartmentType` 0/1 corrisponde a beni/servizi (manuale p.93). `single/enabled=0` per tutti e tre. Gli altri 96 reparti hanno tipo beni e aliquota indice 0; le descrizioni generiche non autorizzano ad assegnarli automaticamente a prodotti esenti. Gli indici 3 e 4 delle aliquote contengono 10% e 5%, ma nessuno dei reparti letti punta a tali indici.

Pagamenti confermati: 01 contanti, 03 assegni, 04 carte elettroniche; 02 non riscosso beni con `CreditType/value=1`, 06 non riscosso servizi con valore 2, 07 non riscosso fatture con valore 3, 08 DCR SSN con valore 4. Solo 01 permette resto fra i codici 01-11. Il tipo non riscosso resta distinto dall'ordinario pagamento con carta; la selezione generica RATE non viene assegnata automaticamente a un codice.

Optyker `20260912-rch-confirmed2` mostra questi dati in Cassa > RCH. `rch-preflight.js` conserva l'identita verificata nel rapporto e la data della lettura, mentre `identityVerifiedLive=false` resta corretto: il profilo incorporato non verifica il dispositivo a ogni utilizzo. La compatibilita del carrello richiede ora sia `fiscal_vat_code` sia `fiscal_item_type` esplicito (`goods` o `services`): il catalogo deve fornire questi dati per ogni riga. Se mancano, o il tipo non corrisponde al reparto, il controllo segnala la riga e non assegna un reparto. Non deduce classificazioni dal titolo o dalla categoria commerciale, non modifica anagrafiche prodotti e non modifica la programmazione RCH.

Il campo `programmingVerified=false` nel rapporto caricato era un esito conservativo della raccolta automatica e non e stato riscritto. Il confronto successivo conferma la mappatura descritta sopra; non abilita emissione fiscale, scontrino parlante o Sistema TS. Restano da realizzare il ciclo di emissione con registro persistente dei tentativi, recupero del riferimento del documento e degli esiti incerti, e il collegamento TS separato. `serverAdE` contiene l'indirizzo del servizio AdE e `serverSTS` e vuoto: un indirizzo configurato non e una ricevuta di accettazione e il campo TS vuoto non descrive eventuali invii eseguiti da Focus.

Verifiche: 18 test Node riusciti (`rch-preflight`, `rch-ui`, `rch-loader`), inclusi distinzione beni/servizi, tipi assenti o incoerenti, conservazione dei blocchi fiscali e caricamento con nuova versione. La verifica della pubblicazione ha rilevato che `apply_ovc_operations.py` riscriveva la versione Cassa con il proprio vecchio identificativo, poi riscritto dalla release September. Il patch ora conserva la versione dichiarata nel sorgente Cassa, aggiorna allo stesso modo gli alias desktop e ricalcola gli hash degli asset gia trasformati, mantenendo le integrazioni del carrello e OVC Card. Il nuovo test copre anche la seconda esecuzione su una pagina gia assemblata. I test dei gestori UI usano un DOM simulato. I dati del profilo sono stati confrontati anche direttamente con gli attributi e i valori del rapporto originale. Nessun comando e stato inviato al registratore durante questa modifica.

## Evidenza reale del 12/09/2026 e lettura configurazione

Il rapporto del negozio `Diagnostica-Protocollo-RCH-20260912-102246-83f7fef2.json`, raccolto su Windows, contiene sette richieste accettate senza errori. Le risposte XML originali confermano:

- `<</?s`: `ECRStatus/mode=REG`, `idleState=0`, nessun errore hardware o busy.
- `<</?f`: `/Service/Enq/name=f`, `value=FW v.  3.1.0`.
- `<</?m`: `/Service/Enq/name=m`, `value=72IV6003831`, corrispondente alla matricola del negozio.
- `<</?i/*3`: `111000`, cioe censito, attivato, modalita RT, operativo, senza revoca o dismissione secondo p.60 del manuale.
- `<</?7`: contatore azzeramenti `1160`.
- `<</?i/*5`: `0  0/25`, cioe non inattivo e nessun file pendente al momento della lettura. Questo non sostituisce una ricevuta di accettazione AdE per uno specifico documento.

Il campo versione va registrato come risposta del dispositivo, senza confrontarlo automaticamente con le soglie 8.x del manuale PRINT! F: il materiale distingue i modelli PRINT! F e PRINT! RT e non e stata accertata l'equivalenza tra le loro versioni. Il rapporto non prova l'emissione, il codice fiscale o il recupero del riferimento di un nuovo documento.

Le risposte `Enq` sono lette con XPath sui dati originali. Nel vecchio elenco `values` di PowerShell, il figlio `<name>` mascherava la proprieta `.Name` del nodo XML e produceva percorsi come `Service/f/value`. La nuova funzione usa `get_Name()` e conserva il percorso corretto `Service/Enq/value`; non cambia i dati originali o il connettore installato.

La nuova `rch-connector/Diagnostica-Configurazione-RCH.bat` scarica tre script con hash SHA-256 verificato in una cartella temporanea dedicata. Richiede che l'operatore selezioni **4 poi CHIAVE (PRG)** sulla tastiera del registratore, con nessuna vendita in corso. La sequenza consentita e `<</?s`, `<</?m`, `<</?C`, `<</?s`: stato PRG inattivo, matricola corrispondente, lettura completa della programmazione documentata a p.62, controllo dello stato finale. Non entra in modalita SERVICE, non cambia modalita e non modifica dati. Alla fine l'operatore torna a **1 poi CHIAVE (REG)**. Il file `Configurazione-RCH-*.json` viene salvato sul Desktop anche in caso di raccolta incompleta.

In REG, con cassa occupata, matricola inattesa, risposte malformate o errori/timeout, la raccolta si arresta senza riprovare. Un ACK senza payload non e considerato una raccolta completa. Anche con un payload, `programmingVerified=false` e `fiscalEmissionEnabled=false`: i dati devono essere interpretati e confrontati con aliquote, reparti, tipo beni/servizi e pagamenti. Il comando `<</?C` e stato poi eseguito con successo nel rapporto delle 10:43 descritto sopra.

Verifiche eseguite su PowerShell 7.4.13 Linux: `tests/rch-configuration.test.ps1` controlla il formato Enq osservato, le ambiguita XML, i blocchi per modalita/matricola/errori, l'assenza di ripetizioni e i rapporti incompleti; `PWSH=/path/to/pwsh node --test tests/rch-configuration-http.test.mjs` verifica le quattro richieste HTTP reali contro un server locale simulato, con payload di programmazione dichiaratamente sintetico. Verificati sintassi del launcher e hash delle tre dipendenze. La successiva prova Windows in negozio e confermata dal rapporto delle 10:43. Riferimento per i tasti PRG/REG: https://help.readypro.it/it/4224/rch-print-rt-modalita-rt-comandi-da-tastiera.

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
