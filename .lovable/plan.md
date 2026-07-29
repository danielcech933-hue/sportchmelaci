## Úprava avataru na profilu

**Cíl:** Profilovka bude jen v hero rámečku nahoře. Sekce pod hero se zjednoduší jen na upload/replace/remove tlačítka (bez druhého náhledu avataru). Lightbox zvětšení nebude přerůstat obrazovku.

### Změny

1. **`src/routes/profile.tsx` – `AvatarSection`**
   - Odstranit druhý `<Avatar />` z této sekce (aktuálně size=72). Zůstane jen popisek + tlačítka Upload/Replace/Remove.
   - Hero avatar (size=96) nahoře zůstává jediným místem, kde je profilovka vidět.

2. **`src/routes/profile.tsx` – hero avatar**
   - Ponechat náhodný efekt (`heroFx`) a `<Avatar path={avatarPath} size={96} />`. Kliknutím se otevře lightbox (už funguje z `avatars.tsx`).

3. **`src/lib/avatars.tsx` – `AvatarLightbox`**
   - Aktuální styl `max-h-[85vh] max-w-[85vw]` + `object-contain` na `<img>`, ale wrapper `<div className="relative">` nemá omezení, takže dlouhá jména nebo velký obrázek můžou přerůst. Přidat `max-h-[90vh] max-w-[92vw] flex flex-col items-center` na wrapper a `object-contain` už je OK.
   - Snížit `max-h` obrázku na `min(85vh, 640px)` chování ne, jen zaručit, že se vejde: použít `max-h-[80vh] max-w-[90vw]` a wrapper `max-h-[90vh]`, aby popisek + křížek nepřerostly viewport.

### Ostatní obrázky (beze změny)
- Hero bannery na jiných stránkách (`profile-hero.jpg` atd.) zůstávají.
- Avatary v chatu a hlavičce beze změny.

Žádné DB ani backend změny.
