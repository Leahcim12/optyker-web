# OVC Card, Magazzino, Schede e Laboratorio
Release 20260910-ovc2.

La Cassa rimane in Dashboard, barra superiore e scheda cliente, non nel menu laterale. Il catalogo resta nel dialog dedicato introdotto dalla versione cart-first.

Magazzino, Schede e Occhiali usano uno stile coordinato. Gli stili sono limitati allo schermo; non modificano calcoli clinici o modelli di stampa. OVC CARD è rossa e usa una derivata web del logo fornito dal titolare, senza ridisegno. La tabella e il trigger già installati creano la card automaticamente per clienti esistenti e futuri; il selettore nell'anagrafica ne cambia lo stato con verifica di revisione.

Tariffe OVC Card è accessibile da Anagrafica e Magazzino. Vuoto significa tariffa standard; zero significa gratuito. Ogni tariffa deve essere impostata e salvata dall'operatore: nessun importo è stato inventato. Il prezzo standard si modifica nella scheda del servizio in Magazzino. Le tariffe OVC riguardano solo i servizi e non cambiano gli sconti Esoform/TS. Lo stato card e i prezzi sono riletti sul server quando il carrello cambia cliente e prima della conferma della vendita. Un errore di ricalcolo impedisce il checkout. Gli ordini già registrati non sono ricalcolati.

Ordina prodotto, nel riepilogo Occhiali, salva e invia solo Buste collegate a un cliente. I preventivi non sono inviabili. Il server controlla cliente, versione del documento e unicità della Busta; il secondo invio restituisce l'ordine esistente. Il Laboratorio mostra OCCHIALI o LAC e il contenuto del prodotto. Stati e automazioni usano le funzioni esistenti: preparazione lunedì–giovedì +24 ore, venerdì–domenica lunedì 09:00 Europe/Rome.

Verifiche locali: unit test delle tariffe; interfaccia Chromium con API simulate, cambio cliente, quantità, card inattiva, prezzo zero, tariffa vuota, errore/riprova, ordine Occhiali e doppio invio, navigazione cliente, logo, viewport desktop e mobile e esclusione stampa. Le prove locali non sono una vendita fiscale end-to-end. Non sono stati registrati pagamenti, ordini o prezzi di prova per clienti reali. Il workflow live confronta commit e hash dei file pubblicati e verifica il rifiuto dell'accesso anonimo all'API di cassa.

La funzione edge di cassa implementa l'autenticazione operatore esistente e mantiene verify_jwt=false coerentemente con tale autenticazione. Il deployment può usare un import statico fissato al commit: i moduli sono risolti e inclusi nel bundle al deploy, non scaricati ad ogni vendita.
