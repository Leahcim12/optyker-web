# Connettore Optyker RCH su Windows

## Attivazione automatica

Dal PC della cassa scaricare ed eseguire **Attiva-Avvio-Automatico-RCH.bat**, disponibile anche nella finestra RCH di Optyker alla voce **Attiva avvio automatico Windows**.

Eseguire il file con lo stesso utente Windows usato per la cassa. Non servono privilegi di amministratore. Dal successivo accesso a quell'utente Windows il connettore parte in background. L'avvio avviene all'accesso, non prima della schermata di login.

Se il connettore è già installato, l'attivazione modifica soltanto il collegamento `Optyker RCH.lnk` nella cartella Esecuzione automatica dell'utente. Non ferma il processo in funzione, non emette documenti e non modifica il registro locale delle emissioni. Se manca il connettore, viene eseguita l'installazione iniziale dal sito Optyker.

Il collegamento usa direttamente Windows PowerShell, senza eseguire VBScript. Il processo resta nello stesso contesto utente necessario per i dati protetti con DPAPI. Non vengono modificate le impostazioni di sicurezza di Windows o lo stato di approvazione delle applicazioni all'avvio. Se Windows mostra Optyker RCH disabilitato, abilitarlo in **Impostazioni → App → Avvio**.

Configurazione predefinita: registratore `192.168.1.10`, connettore locale `127.0.0.1:8765`. Per una configurazione diversa, lo script PowerShell accetta `-PrinterIp` e `-Port`; specificarli anche quando si riattiva l'avvio automatico.

## Verifica e rimozione

Dopo il successivo accesso a Windows, aprire Optyker e premere **Test collegamento RCH**. Il test del collegamento non equivale all'emissione di uno scontrino. La cassa deve essere in modalità REG per emettere.

**Rimuovi avvio automatico** esegue `Disinstalla-RCH-Optyker.ps1`: elimina soltanto il collegamento all'avvio. Conserva il connettore, i dati delle emissioni e il processo eventualmente in funzione.

## Verifiche di sviluppo

`pwsh -NoProfile -File tests/rch-autostart.test.ps1` verifica la sintassi, i percorsi con spazi, la riattivazione e la rimozione senza perdita di dati. Le operazioni sui collegamenti Windows sono simulate: il test non sostituisce la verifica sul PC Windows dopo l'accesso. `node --test tests/rch-loader.test.mjs` verifica la pubblicazione del modulo cassa e dei relativi riferimenti nella pagina.
