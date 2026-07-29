## Plan: Full-screen hover backgrounds pro každý sport

### Cíl
Když uživatel najede myší na dlaždici sportu (Nohejball, Volleyball, Tennis, Football, Padel), přes celou obrazovku se v pozadí objeví tématický obrázek s efektem (fade-in, zoom, neonový glow).

### Kroky

1. **Vygenerovat 4 nové obrázky** ve stylu stávající nohejbalové koláže (legendární postavy hrající daný sport):
   - `src/assets/tennis-legends.png` — postavy na tenisovém kurtu
   - `src/assets/volleyball-legends.png` — postavy na volejbalové plovárně/pláži
   - `src/assets/football-legends.png` — postavy na fotbalovém hřišti
   - `src/assets/padel-legends.png` — postavy na padelovém kurtu
   
   Každý se stejnou "legendary sunny outdoor" atmosférou jako nohejbal. Uloženo přes `lovable-assets` jako `.asset.json` pointery.

2. **Upravit `src/routes/index.tsx`:**
   - Přidat mapu `sportBackgrounds` (id → asset URL).
   - Odstranit stávající inline nohejbal background z tlačítka (bude nahrazen novým systémem).
   - Přidat React state `hoveredSport: string | null`.
   - Na `<button>` každého sportu přidat `onMouseEnter` / `onMouseLeave` (+ `onFocus`/`onBlur` pro klávesnici a `onTouchStart` pro mobil).
   - Nad `<main>` (nebo do fixed layeru pod obsahem) přidat `<div>` s `position: fixed inset-0`, který renderuje background aktuálně hoveredovaného sportu:
     - `opacity-0` → `opacity-80` s `transition-opacity duration-500`
     - `scale-110` s pomalým "ken-burns" pohybem
     - Přes obrázek dark gradient overlay + grid/scanline vrstva (reuse existujících tříd), aby zůstala čitelnost UI a futuristická estetika
     - `pointer-events-none z-0` (obsah `main` dostane `relative z-10`)
   - Zachovat existující nohejbal in-tile efekt? → **Nahradit** za jednotný fullscreen systém pro všech 5 sportů (konzistence).

3. **Ověření**: build check + screenshot Playwrightem s hover na jednu dlaždici pro potvrzení fullscreen efektu.

### Technické detaily
- Obrázky generovány přes `imagegen--generate_image` (fast tier, 1536×1024) a nahrané přes `lovable-assets create` → `.asset.json`.
- Fullscreen overlay je jeden persistentní `<div>` mimo grid tlačítek; přepíná se `backgroundImage` a `opacity` podle `hoveredSport`, aby přechody byly plynulé (fade-out starého + fade-in nového).
- Bez změn business logiky, DB, ani jiných route.
