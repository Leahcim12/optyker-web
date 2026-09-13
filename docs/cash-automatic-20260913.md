# Cassa — emissione diretta, cliente occasionale, riferimento RCH

Release frontend `20260913-cash4`; connettore Windows `1.8-auto-receipt`.

Il codice fiscale per la detrazione è una proprietà della singola vendita e del
pagamento. Non richiede un'anagrafica e non viene aggiunto al cliente o ai metadati
Shopify. Viene verificato anche dal server prima di creare l'ordine.

Il carrello mostra l'IVA disponibile in magazzino; l'operatore può selezionarla
esplicitamente. Reparti mancanti e pagamenti non mappati bloccano l'emissione
automatica prima dell'incasso. Le tariffe restano ricalcolate dal server.
Contanti e carte usano i reparti e tender già verificati sul registratore del negozio.

`Incassa e stampa` controlla il connettore, registra l'incasso con un identificativo
univoco e avvia la stampa sul pagamento restituito. L'importo fiscale e l'identità
vengono congelati nel pagamento; acconto e saldo conservano gli importi per aliquota.
Gli incassi precedenti senza tale fotografia mantengono la revisione delle righe.

Il connettore aggiunge un riferimento Optyker al documento e legge il testo `EJ`
del giornale tramite `=C453/$0`, entrando in Z e ripristinando REG. Non esegue la
chiusura giornaliera. Riferimento Optyker, matricola, CF (se previsto), numero,
data e totale devono corrispondere. Il numero non viene calcolato dai contatori.
Fonte: manuale RCH Web Service V5 R03/2019, §8.5, consultato nella
[copia pubblica](https://it.scribd.com/document/755192319/PrintF-Manuale-Webservice-ITA-V5-R0319);
comandi e modalità confrontati con il protocollo v14 fornito dall'utente, p.24.

Una lettura incompleta lascia il documento in attesa del riferimento verificato.
Un esito di stampa incerto non riavvia la sequenza. La consegna dell'esito al cloud
può essere ripetuta dal journal locale senza nuovo ordine o stampa. Il journal
non conserva CF, righe o testo integrale del documento.

Verifiche: checkout reale con database/Shopify simulati, interfaccia assemblata,
connettore PowerShell con I/O simulato, vincoli SQL in transazioni annullate,
regressioni fiscali/TS e build di produzione. Nessuna stampa fiscale o spesa TS
reale generata durante le prove.

Installazione: sul PC della cassa usare **RCH → Installa / aggiorna connettore**.
L'avvio automatico Windows esistente viene mantenuto. La verifica fisica sul
registratore del negozio resta necessaria dopo l'aggiornamento.
