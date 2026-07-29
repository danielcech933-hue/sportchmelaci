## Fix: Hover background overlay se neukazuje

### Diagnóza
Overlay `<div className="pointer-events-none fixed inset-0 -z-10 ...">` má `-z-10`. To ho posouvá pod stacking context root elementu (body/html mají `bg-background`, který je neprůhledný), takže obrázky sportů zůstávají neviditelné i při hoveru.

Sekundární problém: na dotykových zařízeních `onMouseEnter` nefunguje — už máme `onTouchStart`, ale bez `onTouchEnd` overlay zůstane viset navždy po tapu.

### Změny v `src/routes/index.tsx`

1. **Změnit z-index overlay z `-z-10` na `z-0`** a zajistit, aby obsah byl nad ním:
   - Overlay: `pointer-events-none fixed inset-0 z-0 overflow-hidden`
   - `<main>` dostane `relative z-10` (už má `relative`, přidat `z-10`)

2. **Přidat `onTouchEnd` handler** na tlačítka, aby na mobilu overlay po chvíli zmizel (nebo zůstane, dokud user tapne mimo — zvolím jednoduše: `onTouchEnd` s malým delay 1200ms před vyčištěním, aby uživatel viděl fullscreen efekt i na mobilu).

3. **Ověřit vizuálně** Playwrightem: navigovat na `/`, hover na dlaždici Tennis, screenshot, potvrdit že fullscreen obrázek je vidět.

### Bez ostatních změn
Assety, business logika, ani jiné route se nemění.
