# Collegamento Sistema TS

Da **Amministrazione → Sistema TS** si verificano le credenziali, si attivano o sospendono gli invii e si controllano documenti, protocolli, esiti e ricevute.

Gli invii automatici riguardano i nuovi scontrini RCH con richiesta TS e righe sanitarie AD/AA, dopo la conferma del numero e della data stampati. Le spese già in coda richiedono un invio individuale. Il solo salvataggio della vendita Shopify o la risposta della stampante non attestano un invio TS. Fatture e rettifiche TS non sono gestite da questo trasporto.

## Protocollo verificato

- Kit ufficiale fornito: `kit730P_ver_20240214.zip`.
- SHA-256: `02cbcdb02702fcc3dad2d157de64dcf0d3b591639792bdf1ba2d0b7d8d5aaccb`.
- Servizio sincrono DocumentoSpesa730p e servizi di interrogazione, esito e ricevuta. Gli originali WSDL/XSD usati dai test sono in `protocol/`.
- Certificato pubblico SanitelCF valido fino al 23 gennaio 2027, 15:27:17 UTC. Il fingerprint è verificato prima dell'uso; dopo la scadenza gli invii si bloccano. Per aggiornarlo occorre verificare il nuovo kit e aggiornare anche la soglia nelle funzioni SQL.
- PIN, codice fiscale del proprietario e codice fiscale assistito sono cifrati con RSA PKCS#1 v1.5 come nel kit. La chiave SPKI in `certificate.mjs` è estratta dal certificato; il test ne verifica l'identità. Il formato SPKI è necessario per la compatibilità del runtime Edge.
- HTTP Basic su HTTPS verso host ufficiali fissi, con verifica TLS e redirect vietati. Password e PIN vengono letti dal Vault esclusivamente sul server. Non vengono registrati XML, credenziali o messaggi TS contenenti dati personali.

La verifica usa **ReportMensile**, in sola lettura. Attiva la configurazione solo quando il servizio restituisce un esito positivo e la revisione delle credenziali non è cambiata. L'esito positivo dell'autenticazione non sostituisce l'accettazione dei singoli documenti.

## Esiti e concorrenza

Una transazione blocca l'emissione originale, controlla eventuali annulli e registra un tentativo prima della chiamata. Due richieste concorrenti non possono trasmettere due volte la stessa spesa. Un timeout lascia uno stato incerto: si usa **Verifica esito**, senza ripetere il POST. Le interrogazioni restano vincolate all'identità del mittente registrata al primo tentativo, consentendo la rotazione della password senza cambiare titolare.

Il protocollo di ricezione produce lo stato **submitted**. Lo stato **accepted** richiede un esito finale coerente per il documento o un'interrogazione puntuale che ne confermi identità, importi e assenza di errori. Dopo un invio vengono eseguiti tre controlli brevi in background; un'elaborazione più lunga richiede **Verifica esito**. La ricevuta PDF/ZIP, quando disponibile, è salvata privatamente e scaricabile dall'amministratore.

L'opposizione esclude il codice fiscale dell'assistito dal tracciato. I documenti annullati prima della trasmissione restano esclusi. Per documenti già trasmessi, il flusso di annullo RCH si blocca e richiede la gestione della rettifica TS: questa versione non trasmette cancellazioni TS automaticamente.

## Verifiche

`node --test tests/ts-transport.test.mjs tests/ts-connection-ui.test.mjs tests/ts-security.test.mjs tests/rch-loader.test.mjs` verifica XSD ufficiali, cifratura, autorizzazioni, opposizione, esiti incerti, duplicati e interfaccia. Servono `saxes`, `jsdom` e Python con `lxml` nell'ambiente di sviluppo. `tests/ts-transport-db.test.sql` va eseguito dentro `BEGIN`/`ROLLBACK`; non trasmette spese.

Il 13 settembre 2026 il controllo in produzione ha restituito `TS_VERIFIED`, con codice TS `0`, usando le credenziali protette esistenti. Nessuna spesa reale è stata inviata durante lo sviluppo; la coda conteneva soltanto un documento già annullato. Il primo invio reale resta da verificare sul suo protocollo e sulla ricevuta.

Gli amministratori tecnici possono programmare un controllo di sola lettura con una capability monouso: hash nel database, scadenza massima cinque minuti, consumo atomico. Il percorso `verify-once` non consente invii, lettura di credenziali o accesso ai documenti. Tutte le normali azioni dell'interfaccia richiedono una sessione amministrativa valida.
