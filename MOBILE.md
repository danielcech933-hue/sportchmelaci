# 📱 Mobilní appka (Capacitor)

Chmeloví Sportovci lze zabalit jako nativní iOS/Android appku přes Capacitor.

## První setup (jednou)

1. **Export projektu do GitHubu** (tlačítko GitHub → Connect vpravo nahoře).
2. Naklonuj repo lokálně a otevři v terminálu:
   ```bash
   git clone <tvůj-repo>
   cd <projekt>
   bun install
   ```
3. Přidej platformy podle toho, na čem stavíš:
   ```bash
   npx cap add ios       # macOS + Xcode
   npx cap add android   # Android Studio
   ```

## Reálné hovory / vyzvánění telefonu

SportChmeláci už má aplikační WebRTC hovory a nyní je připravený i backend/native bridge pro systémové příchozí hovory.

Native vrstva používá `@kapsula-chat/capacitor-push-calls`, který na iOS používá PushKit + CallKit a na Androidu FCM + ConnectionService. Plugin registruje push/VoIP tokeny, zobrazí systémový příchozí hovor a po přijetí předá hovor do WebRTC vrstvy.

Doinstaluj plugin:
```bash
bun add @kapsula-chat/capacitor-push-calls
npx cap sync
```

Po instalaci musí být native projekty otevřené alespoň jednou:
```bash
npx cap open ios
npx cap open android
```

### iOS

V Xcode zapni:
- Push Notifications
- Background Modes → Voice over IP
- Background Modes → Remote notifications

Pro produkční volání musí být nastavený Apple Developer/VoIP PushKit provisioning.

### Android

Nastav Firebase Cloud Messaging a přidej `google-services.json` do Android projektu. Pro Android 14+ povol full-screen incoming-call oprávnění, pokud ho systém vyžaduje.

### Supabase secrets pro call push

Edge Function `send-call-push` používá:

```text
APNS_TEAM_ID
APNS_KEY_ID
APNS_PRIVATE_KEY
APNS_BUNDLE_ID=app.lovable.chmelovi_sportovci
APNS_ENVIRONMENT=sandbox|production
FCM_SERVICE_ACCOUNT_JSON
```

Tyto hodnoty patří pouze do Supabase Edge Function secrets, nikdy do frontendu/GitHubu.

## Build & spuštění

```bash
npm run build           # build webu
npx cap sync            # nakopíruje web + pluginy do nativních projektů
npx cap run ios         # spustí v iOS simulátoru / zařízení
npx cap run android     # spustí v Android emulátoru / zařízení
```

Pro otevření v Xcode / Android Studiu:
```bash
npx cap open ios
npx cap open android
```

## Hot-reload z Lovable preview

`capacitor.config.ts` má nastavené `server.url` na Lovable preview URL — appka
při spuštění načítá živou verzi z Lovable, takže úpravy v editoru se hned
projeví v telefonu.

## Produkční build (App Store / Play Store)

Před buildem pro store **smaž `server.url`** v `capacitor.config.ts`, aby
appka běžela z bundlovaných souborů:

```ts
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: "app.lovable.chmelovi_sportovci",
  appName: "Chmeloví Sportovci",
  webDir: "dist/client",
  // server: {...} ← smazat
};
```

Pak `npm run build && npx cap sync` a builduj IPA/APK v Xcode/Android Studiu.

## Požadavky

- **iOS**: macOS + Xcode 15+, Apple Developer účet ($99/rok pro App Store)
- **Android**: Android Studio (Windows/Mac/Linux), Google Play účet ($25 jednorázově)
