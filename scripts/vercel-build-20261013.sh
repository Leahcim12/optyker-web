#!/usr/bin/env bash
# Build Vercel completa. vercel.json accetta al massimo 256 caratteri nel buildCommand,
# quindi la sequenza vive qui. Ordine invariato rispetto al buildCommand precedente,
# poi le release successive; i passi nuovi vanno aggiunti qui, non in vercel.json.
set -e
bash scripts/vercel-build-v13.sh
bash scripts/vercel-finalize-20260914.sh
node --test tests/invoice-edit.test.cjs
python scripts/apply_invoice_edit_access.py
node --check _site/customer-invoice-print.js
node --check _site/billing-admin.js

# Release 20261013: Ufficio, cliente nelle schede, logo in fattura.
node --check optyker-office.js
node --check sheet-client-picker.js
python scripts/apply_release_20261013.py
node --check _site/customer-invoice-print.js
node --check _site/billing-admin.js
node --check _site/optyker-office.js
node --check _site/sheet-client-picker.js

# Report 20261014: richiami del mese e giacenze di magazzino.
node --check optyker-report.js
python scripts/apply_report_20261014.py
node --check _site/optyker-report.js
python scripts/check_desktop_html.py

# DDT: open existing transport documents and print from the preview.
python scripts/apply_ddt_view_20261015.py
python scripts/check_desktop_html.py

# WhatsApp 20261107: pulsante "Controllo 6 mesi" nella prescrizione optometrica.
node --check wa-recall-control.js
python scripts/apply_wa_recall_20261107.py
python scripts/check_desktop_html.py

# WhatsApp 20261108: il pulsante WhatsApp della chat ricontrolla il collegamento al primo clic.
python scripts/apply_wa_chat_retry_20261108.py
python scripts/check_desktop_html.py

# WhatsApp 20261108: istruzioni di pulizia LAC (PDF) e casella Perossido nella scheda LAC.
python scripts/apply_wa_lac_care_20261108.py
python scripts/check_desktop_html.py

# Laboratorio 20261108: buste separate per stato (Inserite, In preparazione, In lavorazione, In spedizione, Pronte, Consegnate, Annullate).
node --check lab-status-tabs.js
python scripts/apply_lab_tabs_20261108.py
python scripts/check_desktop_html.py

# Laboratorio 20261127: prima dell'avviso WhatsApp «busta pronta» chiede sempre conferma; le buste già pronte
# mostrano se l'avviso è partito e il pulsante «Avvisa il cliente su WhatsApp» (API optyker_lab_ready_notice_api).
node --check lab-ready-notice.js
python scripts/apply_lab_ready_notice_20261127.py
python scripts/check_desktop_html.py

# Agenda 20261111: «Forza appuntamento» anche con studio o operatore occupato (avviso prima della conferma).
python scripts/apply_agenda_force_occupied_20261111.py
python scripts/check_desktop_html.py

# Scheda LAC 20261121: casella «Numero d'ordine» accanto a lotti e data di richiamo, riportata nel riepilogo.
node --check lac-order-number.js
python scripts/apply_lac_order_number_20261121.py
python scripts/check_desktop_html.py

# Cassa 20261123: niente stampa RCH finché manca la chiusura del giorno precedente (o del periodo di chiusura/ferie).
node --check cash-print-closure-guard.js
python scripts/apply_cash_print_closure_guard_20261123.py
python scripts/check_desktop_html.py
