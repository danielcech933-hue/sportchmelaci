
## Cíl
Každý přihlášený uživatel si může nahrát vlastní profilový obrázek. Avatar se zobrazuje na profilu, v hlavičce a u každé zprávy v public chatu.

## Co přibude

**1. Storage bucket `avatars` (veřejný pro čtení)**
- Nový public bucket `avatars` (přes storage tool, ne SQL).
- RLS na `storage.objects`:
  - kdokoli může číst soubory z bucketu `avatars` (aby avatar viděli i další uživatelé v chatu),
  - uživatel může nahrávat/mazat/aktualizovat pouze soubory ve své vlastní složce `{user_id}/…` (kontrola přes `auth.uid()::text = (storage.foldername(name))[1]`).

**2. Migrace: sloupec `avatar_url` v `profiles`**
- Přidání `avatar_url TEXT NULL` do tabulky `profiles`.
- Stávající RLS na `profiles` už dovoluje uživateli update vlastního řádku (kromě balance), takže žádná nová politika není potřeba. Nový sloupec se aktualizuje přes normální `update`.
- Denormalizovaný `avatar_url` ve staré `chat_messages` **nezavádím** — avatar budu joinovat z `profiles` podle `user_id`, takže se automaticky změní i u historických zpráv, když si uživatel obrázek přenahraje.

**3. Profil (`src/routes/profile.tsx`) – uploader**
- Nová sekce „Avatar" s náhledem, tlačítkem *Upload* a *Remove*.
- Client-side validace: pouze `image/png`, `image/jpeg`, `image/webp`, max ~2 MB.
- Cesta v bucketu: `avatars/{user.id}/avatar-{timestamp}.{ext}` (timestamp v názvu obejde CDN cache po výměně).
- Po uploadu se získá `publicUrl` a uloží se do `profiles.avatar_url`; starý soubor uživatele se smaže (best-effort).

**4. Chat (`src/routes/chat.tsx`) – zobrazení avatarů**
- Initial load: k `chat_messages` doplním `profiles!inner(avatar_url, nickname)` embed přes Supabase select (přes existující FK `chat_messages.user_id → auth.users` join na `profiles` funguje přes `profiles!user_id`; použiji explicit hint).
- Pro realtime `INSERT` payloady (které nesou jen řádek `chat_messages`, bez joinu) budu držet malý in-memory `Map<user_id, avatar_url>` naplněný z initial fetch a doplňovaný lazy dotazem, když přijde zpráva od dosud neznámého uživatele.
- Vedle jména se v bublině zobrazí kulatý avatar (fallback = iniciála přezdívky v neonovém kroužku, styl sladěný se stávajícím cyber vzhledem).

**5. Header (`src/routes/__root.tsx`) – malý avatar u přihlášeného uživatele**
- V `AuthNav` (kde je nickname/balance) přidat 24 px avatar vedle nicknamu; fallback iniciála. Bez avataru nic nerozbije.

## Poznámky k bezpečnosti
- Bucket je *public read* jen pro obrázky avatarů — nic citlivého se tam nedostane.
- Zápis je striktně scoped na `{auth.uid()}/…`, cizí uživatel nemůže přepsat cizí avatar.
- Neukládám avatar do `chat_messages`, takže neexistuje cesta, jak by uživatel „podstrčil" chat zprávě cizí obrázek.

## Co zůstává beze změny
- `AuthProvider`, existující RLS na `profiles`/`chat_messages`, seedy, jiné route.
- Betting, teams, rankings nejsou dotčeny.

## Otevřené otázky
Žádné — postupuji podle výše uvedeného. Pokud chceš jiný limit velikosti nebo povolit GIFy, řekni před schválením.
