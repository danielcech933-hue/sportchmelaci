# 📱 Mobilní appka (Capacitor)

Chmeloví Sportovci lze zabalit jako nativní iOS/Android appku přes Capacitor.

## První setup (jednou)

1. **Export projektu do GitHubu** (tlačítko GitHub → Connect vpravo nahoře).
2. Naklonuj repo lokálně a otevři v terminálu:
   ```bash
   git clone <tvůj-repo>
   cd <projekt>
   npm install
   ```
3. Přidej platformy podle toho, na čem stavíš:
   ```bash
   npx cap add ios       # macOS + Xcode
   npx cap add android   # Android Studio
   ```

## Build & spuštění

```bash
npm run build           # build webu
npx cap sync            # nakopíruje web + pluginy do nativních projektů
npx cap run ios         # spustí v iOS simulátoru
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
