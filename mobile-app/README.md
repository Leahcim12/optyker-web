# OTTICA VISUAL CARE — app iOS e Android

Applicazione mobile Expo/React Native collegata a Optyker, Supabase e allo shop Shopify Ottica Visual Care.

## Funzioni cliente

- registrazione/accesso con email e password;
- riconoscimento automatico dell'anagrafica Optyker tramite email;
- shop integrato nell'app;
- chat diretta con Ottica Visual Care;
- prescrizione con diottrie e goniometro;
- LAC associate e richiesta di riordino;
- storico ordini e richieste di riordino;
- anagrafica personale.

## Funzioni operatore

Se l'email autenticata è presente in `optyker_operator_profiles`, l'app passa automaticamente in modalità staff e mostra:

- dashboard statistiche;
- elenco e ricerca clienti;
- anagrafica completa;
- prescrizione attuale e storico prescrizioni;
- schede LAC e lenti associate;
- ordini e richieste di riordino;
- chat con i clienti.

L'accesso ai dati avviene tramite Supabase Auth e la Edge Function protetta `optyker-mobile-api`. La service role non è inclusa nell'app.

## Avvio locale

Richiede Node.js 22+.

```bash
cd mobile-app
npm install
npx expo install --fix
npm start
```

Per una build nativa:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest build --platform ios --profile production
```

Per l'invio agli store:

```bash
npx eas-cli@latest submit --platform android --profile production
npx eas-cli@latest submit --platform ios --profile production
```

## Pubblicazione store

Prima della pubblicazione definitiva servono:

- icona 1024x1024 e splash definitivi;
- account Google Play Console;
- account Apple Developer / App Store Connect;
- privacy policy pubblica e URL di assistenza;
- screenshot store;
- compilazione delle schede privacy/data safety.

Bundle/package configurato: `it.otticavisualcare.app`.
