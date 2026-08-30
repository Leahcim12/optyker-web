#!/usr/bin/env bash
set -e
mkdir -p _site _jscheck
cp CNAME _site/CNAME
curl -fL --retry 3 --retry-delay 2 "https://whgziwaegjzqsgcntesr.supabase.co/storage/v1/object/public/optyker-web/index.html?v=${VERCEL_GIT_COMMIT_SHA:-latest}" -o _site/index.html
test -s _site/index.html
for f in \
  scripts/patch_optyker.py \
  scripts/patch_usage_documents_label.py \
  scripts/patch_visual_training_documents.py \
  scripts/patch_orders_auto_refresh.py \
  scripts/patch_label_scope_message.py \
  scripts/remove_login_store_user.py \
  scripts/patch_profile.py \
  scripts/patch_client_chat_tab.py \
  scripts/patch_chat_images_v2.py \
  scripts/patch_whatsapp_channel.py \
  scripts/patch_appointments.py \
  scripts/patch_appointments_v2.py \
  scripts/patch_appointments_v3.py \
  scripts/patch_appointments_v4.py \
  scripts/patch_appointments_v5.py \
  scripts/patch_appointments_v6.py \
  scripts/patch_appointments_v7.py \
  scripts/patch_appointments_v8.py \
  scripts/patch_appointments_v9_graphics.py \
  scripts/patch_appointments_v10_manage.py \
  scripts/patch_appointments_v11_secure.py \
  scripts/patch_appointments_v12_settings_save.py \
  scripts/patch_appointments_v13_single_settings.py \
  scripts/patch_appointments_v14_week_timeline.py \
  scripts/patch_appointments_v17_search.py \
  scripts/patch_appointments_force_time_v20.py \
  scripts/patch_appointments_operator_v21.py \
  scripts/patch_shifts_v16_monthly.py \
  scripts/patch_shifts_store_style_v19.py \
  scripts/patch_whatsapp_qr_connect.py \
  scripts/patch_whatsapp_qr_meta_fix.py \
  scripts/patch_whatsapp_simple_connect.py \
  scripts/patch_whatsapp_meta_block_help.py \
  scripts/patch_exclusive_navigation.py \
  scripts/patch_sidebar_order.py \
  scripts/patch_sidebar_order_v2.py \
  scripts/patch_sidebar_clicks.py \
  scripts/patch_sidebar_pointer_nav.py \
  scripts/patch_whatsapp_nav_final.py \
  scripts/patch_hide_whatsapp_sidebar.py \
  scripts/remove_legacy_login_fixes.py \
  scripts/patch_dom_ready_boot.py \
  scripts/patch_staff_auth.py \
  scripts/patch_password_recovery_redirect.py \
  scripts/patch_agenda_v15_active_color.py \
  scripts/patch_single_active_nav_v18.py \
  scripts/patch_operator_name_panseri.py \
  scripts/patch_laboratory_orders.py \
  scripts/patch_eyewear_sheet.py \
  scripts/patch_documents_nav.py \
  scripts/patch_lac_warranty_subject.py \
  scripts/patch_client_pages_nav.py \
  scripts/patch_billing_admin.py \
  scripts/patch_cash_register.py \
  scripts/patch_warehouse.py \
  scripts/patch_ios_pwa.py; do python "$f"; done

mkdir -p _site/staff-embed _site/booking _site/iphone _site/reset-password _site/admin-reset-passwords _site/staff-recovery _site/accesso _site/gestionale-v2 _site/gestionale-v3 _site/iphone-app _site/iphone-app-v2 _site/iphone-app-v3 _site/iphone-app-v4 _site/iphone-app-v5 _site/iphone-app-v6 _site/iphone-app-v7 _site/iphone-app-v8 _site/iphone-app-v9 _site/iphone-app-v10 _site/iphone-app-v11 _site/iphone-app-v12 _site/iphone-app-v13 _site/orari
cp staff-embed/index.html _site/staff-embed/index.html
python scripts/patch_staff_whatsapp.py
python scripts/patch_staff_appointments.py
cp booking/index.html _site/booking/index.html
cp iphone/index.html _site/iphone/index.html
cp reset-password/index.html _site/reset-password/index.html
cp admin-reset-passwords/index.html _site/admin-reset-passwords/index.html
cp staff-recovery/index.html _site/staff-recovery/index.html
cp accesso/index.html _site/accesso/index.html
cp iphone-app/index.html _site/iphone-app/index.html
cp iphone-app/manifest.webmanifest _site/iphone-app/manifest.webmanifest
cp iphone-app-v2/index.html _site/iphone-app-v2/index.html
cp iphone-app-v2/manifest.webmanifest _site/iphone-app-v2/manifest.webmanifest
cp iphone-app-v3/index.html _site/iphone-app-v3/index.html
cp iphone-app-v3/manifest.webmanifest _site/iphone-app-v3/manifest.webmanifest
cp iphone-app-v4/index.html _site/iphone-app-v4/index.html
cp iphone-app-v4/manifest.webmanifest _site/iphone-app-v4/manifest.webmanifest
cp iphone-app-v5/index.html _site/iphone-app-v5/index.html
cp iphone-app-v5/manifest.webmanifest _site/iphone-app-v5/manifest.webmanifest
cp iphone-app-v6/index.html _site/iphone-app-v6/index.html
cp iphone-app-v6/manifest.webmanifest _site/iphone-app-v6/manifest.webmanifest
cp iphone-app-v6/visualcare-app-logo.jpg _site/iphone-app-v6/visualcare-app-logo.jpg
cp iphone-app-v7/index.html _site/iphone-app-v7/index.html
cp iphone-app-v7/manifest.webmanifest _site/iphone-app-v7/manifest.webmanifest
cp iphone-app-v7/visualcare-app-logo.jpg _site/iphone-app-v7/visualcare-app-logo.jpg
cp iphone-app-v8/index.html _site/iphone-app-v8/index.html
cp iphone-app-v8/manifest.webmanifest _site/iphone-app-v8/manifest.webmanifest
cp iphone-app-v8/visualcare-app-logo.jpg _site/iphone-app-v8/visualcare-app-logo.jpg
cp iphone-app-v9/index.html _site/iphone-app-v9/index.html
cp iphone-app-v9/manifest.webmanifest _site/iphone-app-v9/manifest.webmanifest
cp iphone-app-v9/visualcare-app-logo-fixed.jpg _site/iphone-app-v9/visualcare-app-logo-fixed.jpg
cp iphone-app-v10/index.html _site/iphone-app-v10/index.html
cp iphone-app-v10/manifest.webmanifest _site/iphone-app-v10/manifest.webmanifest
cp iphone-app-v10/visualcare-app-logo-fixed.jpg _site/iphone-app-v10/visualcare-app-logo-fixed.jpg
cp iphone-app-v11/index.html _site/iphone-app-v11/index.html
cp iphone-app-v11/manifest.webmanifest _site/iphone-app-v11/manifest.webmanifest
cp iphone-app-v12/index.html _site/iphone-app-v12/index.html
cp iphone-app-v12/manifest.webmanifest _site/iphone-app-v12/manifest.webmanifest
cp iphone-app-v13/index.html _site/iphone-app-v13/index.html
cp iphone-app-v13/manifest.webmanifest _site/iphone-app-v13/manifest.webmanifest
cp iphone-app-v13/sw.js _site/iphone-app-v13/sw.js
cp orari/index.html _site/orari/index.html
python scripts/patch_apple_app_redirects_v13.py
cp manifest.webmanifest _site/manifest.webmanifest
cp visualcare-logo.svg _site/visualcare-logo.svg
cp optyker-logo.svg _site/optyker-logo.svg
cp billing-admin.js _site/billing-admin.js
cp billing-admin.css _site/billing-admin.css
cp cash-register.js _site/cash-register.js
cp cash-register.css _site/cash-register.css
cp warehouse.js _site/warehouse.js
cp warehouse.css _site/warehouse.css
cp _site/index.html _site/gestionale-v2/index.html
cp manifest.webmanifest _site/gestionale-v2/manifest.webmanifest
cp visualcare-logo.svg _site/gestionale-v2/visualcare-logo.svg
mkdir -p _site/gestionale-v2/visual-training
cp visual-training/*.pdf _site/gestionale-v2/visual-training/
cp _site/index.html _site/gestionale-v3/index.html
cp manifest.webmanifest _site/gestionale-v3/manifest.webmanifest
cp visualcare-logo.svg _site/gestionale-v3/visualcare-logo.svg
mkdir -p _site/gestionale-v3/visual-training
cp visual-training/*.pdf _site/gestionale-v3/visual-training/
mkdir -p _site/visual-training
cp visual-training/Tridimensionalita.pdf _site/visual-training/Tridimensionalita.pdf
cp visual-training/Accomodazione.pdf _site/visual-training/Accomodazione.pdf
cp visual-training/Convergenza.pdf _site/visual-training/Convergenza.pdf
cp visual-training/Motorio.pdf _site/visual-training/Motorio.pdf
cp visual-training/Sport.pdf _site/visual-training/Sport.pdf
test -s _site/staff-embed/index.html
test -s _site/booking/index.html
test -s _site/iphone/index.html
test -s _site/reset-password/index.html
test -s _site/admin-reset-passwords/index.html
test -s _site/staff-recovery/index.html
test -s _site/accesso/index.html
test -s _site/iphone-app/index.html
test -s _site/iphone-app/manifest.webmanifest
test -s _site/iphone-app-v2/index.html
test -s _site/iphone-app-v2/manifest.webmanifest
test -s _site/iphone-app-v3/index.html
test -s _site/iphone-app-v3/manifest.webmanifest
test -s _site/iphone-app-v4/index.html
test -s _site/iphone-app-v4/manifest.webmanifest
test -s _site/iphone-app-v5/index.html
test -s _site/iphone-app-v5/manifest.webmanifest
test -s _site/iphone-app-v6/index.html
test -s _site/iphone-app-v6/manifest.webmanifest
test -s _site/iphone-app-v6/visualcare-app-logo.jpg
test -s _site/iphone-app-v7/index.html
test -s _site/iphone-app-v7/manifest.webmanifest
test -s _site/iphone-app-v7/visualcare-app-logo.jpg
test -s _site/iphone-app-v8/index.html
test -s _site/iphone-app-v8/manifest.webmanifest
test -s _site/iphone-app-v8/visualcare-app-logo.jpg
test -s _site/iphone-app-v9/index.html
test -s _site/iphone-app-v9/manifest.webmanifest
test -s _site/iphone-app-v9/visualcare-app-logo-fixed.jpg
test -s _site/iphone-app-v10/index.html
test -s _site/iphone-app-v10/manifest.webmanifest
test -s _site/iphone-app-v10/visualcare-app-logo-fixed.jpg
test -s _site/iphone-app-v11/index.html
test -s _site/iphone-app-v11/manifest.webmanifest
test -s _site/iphone-app-v12/index.html
test -s _site/iphone-app-v12/manifest.webmanifest
test -s _site/iphone-app-v13/index.html
test -s _site/iphone-app-v13/manifest.webmanifest
test -s _site/iphone-app-v13/sw.js
test -s _site/orari/index.html
test -s _site/manifest.webmanifest
test -s _site/visualcare-logo.svg
test -s _site/optyker-logo.svg
test -s _site/billing-admin.js
test -s _site/billing-admin.css
test -s _site/cash-register.js
test -s _site/cash-register.css
test -s _site/warehouse.js
test -s _site/warehouse.css
test -s _site/gestionale-v2/index.html
test -s _site/gestionale-v2/manifest.webmanifest
test -s _site/gestionale-v2/visualcare-logo.svg
test -s _site/gestionale-v3/index.html
test -s _site/gestionale-v3/manifest.webmanifest
test -s _site/gestionale-v3/visualcare-logo.svg
test -s _site/visual-training/Tridimensionalita.pdf
test -s _site/visual-training/Accomodazione.pdf
test -s _site/visual-training/Convergenza.pdf
test -s _site/visual-training/Motorio.pdf
test -s _site/visual-training/Sport.pdf

python - <<'PY'
from pathlib import Path
import re
files=['_site/index.html','_site/staff-embed/index.html','_site/booking/index.html','_site/iphone-app-v13/index.html']
for n,path in enumerate(files):
    text=Path(path).read_text(encoding='utf-8')
    for i,code in enumerate(re.findall(r'<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)</script>',text,re.I)):
        if code.strip(): Path(f'_jscheck/{n}-{i}.js').write_text(code,encoding='utf-8')
main=Path('_site/index.html').read_text(encoding='utf-8')
booking=Path('_site/booking/index.html').read_text(encoding='utf-8')
required_main=['DOCUMENTI DA STAMPARE MANUTENZIONE LAC','DOCUMENTI DA STAMPARE VISUAL TRAINING','OPTYKER_VISUAL_TRAINING_DOCUMENTS_V1','visual-training/Motorio.pdf','OPTYKER_APPOINTMENTS_UI_V9_GRAPHICS','OPTYKER_APPOINTMENTS_UI_V10_MANAGE','OPTYKER_APPOINTMENTS_UI_V11_SECURE','OPTYKER_APPOINTMENTS_UI_V12_SETTINGS_SAVE','OPTYKER_APPOINTMENTS_UI_V13_SINGLE_SETTINGS','OPTYKER_APPOINTMENTS_FORCE_TIME_V20','OPTYKER_APPOINTMENT_OPERATOR_AVAILABILITY_V21','OPTYKER_CHAT_IMAGES_CUSTOMER_AVATAR_V2','id="oaManageModal"','oaV10Save','oaV10Cancel','optyker-appointments-staff','id="navAppointments"','OPTYKER_DOM_READY_BOOT_V1','OPTYKER_STAFF_AUTH_V1','optyker-staff-auth','Password dimenticata?','optykerAuthPassword','OPTYKER_DIEGO_PANSERI_NAME_FIX_V1','Diego Panseri','can_force_appointment','force_studios','OPTYKER_LABORATORY_V1','>Laboratorio<',"Invia l'ordine",'OPTYKER_LAC_WARRANTY_SUBJECT_V1','GARANZIA ATTIVA','Crea ordine in garanzia','Cambio diottria','Tutte le schede LAC del cliente','OPTYKER_CLIENT_PAGES_NAV_V1','clientPageNav','Documenti','Lenti a contatto']
reset=Path('_site/reset-password/index.html').read_text(encoding='utf-8')
app13=Path('_site/iphone-app-v13/index.html').read_text(encoding='utf-8')
required_reset=['Recupero password','SALVA NUOVA PASSWORD','updateUser','exchangeCodeForSession']
required_app13=['<h1>Orari</h1>','data-nav="hours"','data-nav="timer"','push_subscribe','timer_create','APP 13.4','sw.js?v=13','profile_photo_save','chooseChatProfilePhoto','attachment_data','chatImageModal']
required_booking=['I tuoi appuntamenti','Sposta','Aggiungi un altro','optyker_appointment_tokens_v2','Scegli lo studio disponibile','Inserisci l’orario','studio_id:S.candidate.studio_id||null']
missing=[x for x in required_main if x not in main]+[x for x in required_booking if x not in booking]+[x for x in required_reset if x not in reset]+[x for x in required_app13 if x not in app13]
if missing: raise SystemExit('Mancano: '+', '.join(missing))
if 'id="forceClosed"' in booking or 'id="useManualTime"' in booking:
    raise SystemExit('La forzatura pubblica o il vecchio pulsante orario sono ancora presenti')
if 'OPTYKER_OPERATOR_DIRECT_LOGIN_FIX_V2' in main or 'OPTYKER_UI_CLICK_FIX_V1' in main:
    raise SystemExit('Fix login legacy ancora presenti nella build')
if "toUpperCase()==='Diego Panseri'" in main or 'toUpperCase()==="Diego Panseri"' in main:
    raise SystemExit('Confronto Diego Panseri non idempotente: rischio loop MutationObserver')
if "attributes:true,attributeFilter:['class','style']" in main and 'optykerAppointmentsV8Js' in main:
    raise SystemExit('Observer Agenda V8 ancora autoreferenziale')
print('Build verificata',len(main),len(booking),len(app13))
PY
cp _site/iphone-app-v13/sw.js _jscheck/iphone-app-v13-sw.js
for f in _jscheck/*.js; do node --check "$f"; done
node --check _site/cash-register.js
node --check _site/warehouse.js
touch _site/.nojekyll
