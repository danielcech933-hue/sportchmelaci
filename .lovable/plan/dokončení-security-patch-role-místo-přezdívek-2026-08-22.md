# Dokončení security patch: role místo přezdívek

Poslední krok auditu. Aktuální stav ověřen v databázi: role `admin`, `high_roller`, `case_opener`, `restricted` už existují a jsou přiřazené (Danko, Chlaďar, M1das, BORO NEZASTAVITELNY), ale herní funkce i frontend stále rozhodují podle textu přezdívky.

## Co je teď špatně

Ověřeno dotazem na definice funkcí — tyto funkce stále porovnávají `profiles.nickname` proti seznamu jmen:

- `case_opening_open`, `case_opening_stock_open` — povolení vstupu do case openingu
- `slot_spin`, `slot_epic_spin`, `slot_variant_spin` — zvýšený limit sázky (1 000 000 vs 500)

Stejné seznamy jsou zapsané i v UI: `FloatingNav`, `CaseOpeningLobby`, `SlotMachine`, `EpicSlotMachineCinematic`, `games.$game.tsx`, `src/lib/slot-limits.ts`.

Důsledek: kdo si přejmenuje profil na „Danko“, dostane cizí oprávnění; a naopak přejmenování legitimního hráče mu oprávnění sebere.

## Plán

**1. Migrace — funkce na `has_role()`**

- Case opening (obě funkce): vstup jen pro `case_opener` (nebo `admin`), a blok pro `restricted`.
- Slot funkce: limit 1 000 000 jen pro `high_roller`/`admin`, jinak 500.
- Herní logika, payouty, RNG a ledgery zůstávají nezměněné — mění se jen podmínka oprávnění.

**2. Doplnění rolí**

- Ověřit, zda existuje profil s přezdívkou typu „Me$i / Messi / Mesi“, který byl dřív ve seznamech, a přidat mu `high_roller`, aby o limit nepřišel.

**3. Auth kontext**

- `src/lib/auth.tsx`: vedle `isAdmin` vystavit `roles: string[]` a `hasRole(role)`; role se čtou stejným dotazem jako dnes, žádný další request.

**4. Frontend gating podle rolí**

- `FloatingNav.tsx`: `privilegedOnly` → `hasRole("case_opener")`, `boroBlocked` → `hasRole("restricted")`.
- `CaseOpeningLobby.tsx` a `routes/games.case-opening.tsx`: přístup podle `case_opener`, zákaz podle `restricted`.
- `routes/games.$game.tsx` (Roll): zákaz podle `restricted`.
- `SlotMachine.tsx`, `EpicSlotMachineCinematic.tsx`, `src/lib/slot-limits.ts`: nabídka sázek podle `high_roller`, ne podle jména. Test `slot-limits.test.ts` se přepíše na role.
- Vizuál, texty a rozložení zůstávají beze změny.

## Technické detaily

- Rozhodující je server: UI gating je jen kosmetika, RPC nadále vyhodí `case_opening_forbidden` / `invalid_slot_bet`.
- `has_role()` je `SECURITY DEFINER` a `user_roles` je čtené jen přes ni — beze změny.
- Po migraci se ověří, že Danko/Chlaďar/M1das mají dál plný přístup a BORO zůstává blokovaný.
