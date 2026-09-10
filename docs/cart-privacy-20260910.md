# Cassa e Privacy cliente — 20260910-cart-privacy1

La cassa usa l'intera superficie per il carrello e i pagamenti. Il catalogo e la ricerca restano chiusi in un dialog nativo aperto da «Cerca e aggiungi prodotti». Restano invariati checkout, calcoli, API prodotti, controlli fiscali e comandi del registratore. Il catalogo viene richiesto solo aprendo la finestra; le risposte di ricerca superate sono ignorate. Il nuovo simbolo Cassa è un registratore, distinto dal calendario.

## Privacy: prima attivazione
Anagrafica > Informativa > Privacy cliente > Configura testo. La bozza è intenzionalmente NON approvata: completare titolare, recapiti, DPO ove applicabile, finalità e basi giuridiche effettive, destinatari, trasferimenti e conservazione. Sostituire tutti i campi DA COMPLETARE e confermare la revisione del titolare prima della firma. Il testo vale per tutti i clienti; le copie già acquisite conservano la propria versione.

Il modulo usa il nuovo RPC `optyker_privacy_api`, con la stessa verifica operatore `optyker_staff_allowed` del gestionale. La migrazione Supabase `optyker_client_privacy_annual_register` è applicata al progetto whgziwaegjzqsgcntesr. Aggiunge una tabella per i testi approvati protetta da RLS e salva le acquisizioni e le revoche nella tabella esistente optyker_consents. Non sono state create informative approvate o firme per clienti reali durante l'implementazione.

Il server calcola il richiamo a 12 mesi dalla firma nel fuso Europe/Rome, con gestione dell'anniversario bisestile. È una regola interna, non una scadenza legale universale del consenso. Il richiamo appare aprendo la scheda e non invia automaticamente email, SMS o chat.

Nessuna scelta preselezionata, anche i rifiuti sono registrabili. Presa visione, salute e promozioni sono distinti. Per minori è richiesto un rappresentante. La firma grafica non è una firma digitale qualificata. Si conservano testo, formulazione delle scelte, versione, data, operatore, immagine della firma e impronte; non vengono conservate dinamiche biometriche della scrittura. Le richieste di salvataggio sono idempotenti e non sovrascrivono la firma precedente.

Le revoche sono nuove registrazioni, non cancellazioni. Il registro non applica automaticamente la revoca a Shopify, marketing o altri sistemi: l'operatore deve darvi seguito. Restano applicabili gestione accessi, cancellazione legittima e conservazione stabilite dal titolare.

## Verifiche
Test dell'interfaccia con Chromium, markup e script reali e API simulate: catalogo chiuso all'apertura, caricamento al click, aggiunte multiple, quantità, totali, acconti, Escape, riapertura carrello, viewport 1440/1366/390, etichetta Informativa, richiamo, nessun consenso implicito, firma richiesta e invalidata quando cambiano le scelte, salvataggio anche con entrambi i rifiuti, blocco bozza, testo storico escapato. Nessuna vendita, messaggio o firma reale inserita. Controlli live del database: RPC non autorizzato respinto, tabella privata, date anniversario. Il workflow di pubblicazione confronta versione, commit e hash dei file sui due domini.
