# READ-ONLY security audit — SportChmeláci

Žádná změna nebyla provedena (žádná migrace, žádný code edit). Níže jsou zjištění ověřená proti aktuální DB a repu.

## Souhrn priorit

| # | Téma | Verdikt |
|---|------|---------|
| 10 | RLS off + plná práva anon/authenticated na 3 tabulkách | REAL BUG (kritické) |
| 5 | Poker hole cards čitelné direct SELECTem / realtime | REAL BUG (kritické) |
| 6 | Privileged gating podle nickname | REAL BUG (autorizace) |
| 9 | fc_save_squad (legacy overload) věří client OVR/chemistry | REAL BUG (nízký dopad) |
| 4 | poker_sync_chips | HARDENING |
| 3 | place_market_bet locked odds | HARDENING |
| 7 | roulette RNG / timing | HARDENING |
| 8 | save_match_score | INTENTIONAL + malé HARDENING |
| 2 | arcade_report_match self-report | LEGACY / HARDENING |
| 1 | arcade používaný a s daty | INTENTIONAL (aktivní) |
| 11, 12, 13 | SECURITY DEFINER RPC, search_path, profile_public | INTENTIONAL |
| 14 | dependency audit | nelze spustit (report níže) |

## 10) RLS-disabled tabulky — REAL BUG (kritické)

Evidence (`has_table_privilege`): `public.case_opening_stock_cases`, `public.case_opening_stock_companies`, `public.roulette_settlement_ledger` mají RLS OFF a přitom SELECT/INSERT/UPDATE/DELETE pro `anon` i `authenticated`. `match_elo_applications` má RLS off, ale žádná práva pro anon/authenticated → OK (interní tabulka pro triggery).

Dopad:
- kdokoli (i nepřihlášený) může přepsat `cost`/`active` case (`case_opening_stock_open` čte cenu z tabulky) → případy zdarma nebo blokace.
- kdokoli může vložit/smazat řádek v `roulette_settlement_ledger`; `roulette_settle` z něj čte idempotenci → lze předem "zamknout" výsledek kola nebo naopak umožnit dvojí vyplacení smazáním řádku.

Doporučení: `REVOKE` write práv pro anon/authenticated, `ENABLE ROW LEVEL SECURITY`, read-only policy pro `authenticated` na katalogy, `roulette_settlement_ledger` nechat bez policy (přístup jen přes SECURITY DEFINER RPC).
Riziko pro UI: minimální — frontend čte jen katalogy (SELECT policy je zachová).

## 5) Poker card privacy — REAL BUG (kritické)

Evidence: `poker_public_hand` + `poker_list_tournaments` sanitizují hole cards správně (revealují jen vlastní karty, jinak až `stage='done'`). ALE policy `poker_tournaments_read` je `USING (true)` pro `authenticated` na celé tabulce včetně `hand`, kde je uložený celý `deck`. Kdokoli přihlášený může `select hand from poker_tournaments` a spočítat karty všech soupeřů. Navíc `src/components/PokerLiveSyncHUD.tsx:35` odebírá realtime `postgres_changes` na `poker_tournaments`, což doručuje celý řádek s deckem.

Doporučení: omezit direct SELECT (např. sloupcové grants bez `hand`, nebo policy jen na metadata a UI napojit výhradně na `poker_list_tournaments`), a pro realtime použít notifikaci bez payloadu (HUD si stejně data dotahuje RPC).
Riziko pro UI: nízké — `LivePokerTournament` i HUD už čtou hand přes RPC; realtime slouží jen jako trigger refetchu.

## 6) Privileged / high-roller gating podle nickname — REAL BUG (autorizace)

Evidence: `case_opening_stock_open` a `slot_variant_spin` (i `slot_epic_spin` stejného vzoru) autorizují seznamem přezdívek: `not in ('danko','chlaďar','chladar','midas','m1das')`, resp. limit sázky > 500 jen pro `('danko','chlaďar','chladar','midas','m1das','messi','mesi')`. Frontendové zrcadlení: `src/components/FloatingNav.tsx:17`, `src/lib/slot-limits.ts`, `src/components/slots/SlotMachine.tsx:16`, `EpicSlotMachineCinematic.tsx:58`, `case-opening/CaseOpeningLobby.tsx:16`, blokace „boro nezastavitelny“ v `src/routes/games.case-opening.tsx:13` a `games.$game.tsx:16`.

Problém: `profiles.nickname` je uživatelem měnitelný → přejmenováním na „Midas“ lze získat privilegia. Je to i v rozporu s projektovým pravidlem (autorizace přes `user_roles`/`has_role`).

Doporučení: zavést roli (např. `high_roller`) v `user_roles` a v RPC nahradit nickname test `public.has_role(auth.uid(),...)`; frontend gating napojit na `useAuth()` role.
Riziko pro UI: střední — po migraci je nutné rolím explicitně přiřadit stávající privilegované účty, jinak jim zmizí Case Opening a vysoké sázky.

## 9) FC squad OVR/chemistry — REAL BUG (nízký dopad)

Evidence: `fc_save_squad(_formation,_slots,_team_ovr,_chemistry)` ukládá `team_ovr`/`chemistry` přímo z klienta bez přepočtu; volá se z `src/lib/cards.ts:266` (`saveSquad`) v legacy arkádovém builderu. Novější cesta `fc_squad_save(_squad_id,_expected_version,...)` (`src/components/ut/SquadBuilder.tsx:352`) validuje formaci, 11 starterů, bench/reserve limity, kapitána, duplicity a metriky počítá server (`fc_squad_metrics`). Jiné overloady `fc_save_squad` v DB nejsou.

Dopad: falešné `team_ovr` v `fc_squads` může obejít `ovr_cap` u výzev (`fc_create_challenge`).
Doporučení: v `fc_save_squad` ignorovat vstupní hodnoty a dopočítat je serverově, nebo legacy funkci zrušit a builder v `src/lib/cards.ts` přepojit na `fc_squad_save`.
Riziko pro UI: nízké, pokud se zachová signatura.

## 4) poker_sync_chips — HARDENING

Evidence: funkce ověří přihlášení, existenci turnaje, stav `lobby|active`, seat hráče, a zapisuje POUZE vlastní stack, clamped na `0..starting_chips`. Manipulace cizích stacků není možná; hráč si však může libovolně nastavit vlastní chipy až na `starting_chips` (dorovnání po prohře) mimo handu.
Doporučení: umožnit jen resync ze serverového `hand` stavu (nebo funkci zrušit, pokud ji UI nevolá — v `src` na ni není žádné volání, jde tedy o dead/legacy povrch).
Riziko pro UI: žádné (nepoužívá se).

## 3) place_market_bet — HARDENING

Evidence: `_locked_odds` přichází z klienta (`src/lib/matches-db.ts:53`), server validuje jen rozsah 1.05–50, částku 1–10000, otevřený zápas a 1 sázku na uživatele. Hráč tak může uzamknout kurz 50.0 na jakýkoli výběr → nadhodnocené výplaty ve `settle_match`.
Doporučení: kurz počítat/verifikovat serverově pro danou kombinaci market/option (tolerance vs. serverový kurz).
Riziko pro UI: nízké, pokud server vrací použitý kurz (už ho vrací v `locked_odds`).

## 7) Roulette timing / RNG — HARDENING (ne bug)

Evidence: `roulette_place_bet` přijímá sázky pouze pro aktuální 15s slot (`_round_no <> floor(epoch/15)` → `round_closed`); `roulette_settle` odmítne kolo, které ještě neskončilo (`_round_no >= cur`), a je idempotentní přes ledger. Výsledek tedy neexistuje, dokud jsou sázky otevřené — klient ho dostane až po uzávěrce a animace je čistě kosmetická (`UltraRouletteTable.tsx:31` roztočí kolo na už známý výsledek). Pořadí je bezpečné.
Zbývající slabina: `roulette_result` používá `random()` (ne kryptografické) a NENÍ `SECURITY DEFINER`, ale je volatelná — a hlavně integrita závisí na `roulette_settlement_ledger`, který je dnes zapisovatelný kýmkoli (viz bod 10).
Doporučení: `gen_random_bytes` místo `random()`, revoke EXECUTE `roulette_result` od anon/authenticated, opravit ledger práva.

## 8) save_match_score — INTENTIONAL s výhradou

Evidence: kontroluje autentizaci, vlastnictví (`owner_id`), zápornost skóre a `confirmed_at IS NOT NULL AND _ended_at IS NULL → 'confirmed match cannot be reopened'`. Potvrzený zápas tedy nelze reopenovat, ale JDE u něj přepsat skóre (s `_ended_at`), a to bez horní hranice skóre a bez validace obsahu `sets`. ELO se pak přepočítá triggerem.
Doporučení: u `confirmed_at IS NOT NULL` povolit změny jen adminovi (`has_role`), přidat rozumný strop skóre a validaci prvků `sets`.
Riziko pro UI: nízké; admin override cesta (`adminOverrideScore`) jde mimo tuto funkci.

## 2) arcade_report_match — LEGACY / HARDENING

Evidence: `src/lib/arcade.ts:178`; funkce validuje rozsah 0–999, ale výsledek reportuje hráč sám a při vlastní výhře si přičte +25 `arcade_points` (žádné potvrzení soupeřem, žádná kontrola, že soupeř existuje/není on sám). Data jsou reálná a aktivní (`arcade_matches` 56 řádků, `arcade_inventory` 4, `arcade_listings` 4, `arcade_items` 12), takže to není mrtvý kód.
Doporučení: vyžadovat potvrzení soupeřem (nebo serverový výsledek hry) předtím, než se připíší body; zakázat `_opponent = auth.uid()`.
Riziko pro UI: střední — body by se připisovaly až po potvrzení, což je změna herního flow (proto doporučeno jako samostatné rozhodnutí, ne tichý fix).

## 1) Používáme arcade? — INTENTIONAL (aktivní)

Evidence: route `src/routes/arcade.tsx`, komponenty `ArcadeProfile.tsx`, `ProfileView.tsx`, lib `src/lib/arcade.ts` (+ contract test), RPC `arcade_report_match/open_crate/equip/list_item/buy_listing/cancel_listing` s EXECUTE pro `authenticated`, a nenulová data ve všech arcade tabulkách. Arcade je živá část produktu.

## 11) SECURITY DEFINER funkce s EXECUTE pro anon/authenticated — INTENTIONAL

Evidence: dotaz nad `pg_proc` + `has_function_privilege` — všechny transakční RPC (`place_bet`, `place_market_bet`, `arcade_*`, `poker_*`, `slot_*`, `roulette_*`, `fc_*`, `daily_bonus_*`, `case_opening_*`, `telegram_*`) mají EXECUTE pouze pro `authenticated` a všechny začínají `IF auth.uid() IS NULL THEN RAISE`. Anon nemá EXECUTE nikde v této skupině. Interní/seed funkce (`fc_seed_catalog`, `fc_seed_card`, `advance_bracket_from`, trigger funkce `chat_force_nickname`, `casino_chat_force_nickname`) mají prázdný seznam grantee → správně. Jediná výjimka k úklidu: `roulette_result` (viz bod 7).

## 12) SECURITY DEFINER bez search_path — INTENTIONAL / nic k řešení

Evidence: `select ... where prosecdef and proconfig is null` vrací prázdný výsledek — každá SECURITY DEFINER funkce má `SET search_path`. Tento bod je již vyřešený.

## 13) profile_public — INTENTIONAL

Evidence: `pg_get_viewdef` = `select id,nickname,avatar_path,elo,arcade_points,created_at,updated_at from profiles` (bez `balance`/`slot_czk`); práva: `authenticated` SELECT, `anon` žádná. Jde o záměrnou bezpečnou projekci, na kterou už je frontend přepojený; wallet jde přes `get_my_wallet()`.
Volitelné hardening: `security_invoker=on` je zde nežádoucí (view by pak spadl pod RLS `profiles`) — ponechat, jen zachovat explicitní column list a nikdy nepřidávat citlivé sloupce.

## 14) Dependency vulnerabilities — nelze spustit

Evidence: projekt používá `bun.lock`; `bun audit` skončil `error: audit request failed (status 404)` (registry audit endpoint není v sandboxu dostupný). Bez síťového auditu nelze CVE potvrdit ani vyvrátit — nehlásím tedy žádné dependency finding jako reálné. Doporučení: spustit audit v CI (`bun audit` / `npm audit --package-lock-only` nad vygenerovaným lockfilem), kde je registry dostupný.

## Doporučené pořadí opravy (až po tvém schválení)

1. Bod 10 (RLS + revoke) — nejvyšší dopad, žádné riziko pro UI.
2. Bod 5 (poker hand privacy) — nutné před dalšími poker turnaji.
3. Bod 6 (nickname → `user_roles`).
4. Body 3, 9, 8, 4, 7 (hardening).
5. Bod 2 (arcade self-report) — vyžaduje produktové rozhodnutí.
