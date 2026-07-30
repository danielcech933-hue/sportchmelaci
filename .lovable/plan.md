## 1. Úprava sázkového systému

**Zrušení zamykání zápasu**
- V databázové funkci `place_bet` odstranit blok, který po 2 unikátních sázejících nastaví `bets_locked_at` a zapíše audit `match.bets_locked`.
- Odstranit kontrolu `bets_locked` v `place_bet` i `withdraw_bet` — sázet i stahovat sázku půjde, dokud zápas neskončí.
- Ve frontendu odstranit `isLocked()` a stavy „LOCKED“ / „needs 2 more“ (`src/lib/matches.ts`, `src/routes/match.tsx`, `src/routes/bets.tsx`). Sekce na `/bets` se přeskládají na „Otevřené sázky“ a „Vypořádané“.
- Sloupec `bets_locked_at` zůstane v databázi (historická data), jen se přestane používat.

**Jedna sázka na uživatele a zápas**
- Kontrola už v `place_bet` existuje (`already_bet`) — zůstává jako záruka na backendu.
- V detailu zápasu: pokud přihlášený uživatel na zápas už vsadil, formulář se nahradí modrým stavem **„Již vsazeno“** s výpisem jeho tipu a částky (a tlačítkem pro stažení sázky, dokud zápas neskončil).

**Maximální sázka 250 $**
- `MAX_BET` v `src/lib/matches.ts` z 50 na 250, texty a `max` na inputu se přizpůsobí.
- Validace v `place_bet` z `> 50` na `> 250`.

**Vypořádání podle nových pravidel**
- `settle_match`: zrušit vracení sázek při méně než 2 sázejících — vyhodnotí se i sólo sázka (trefa = vklad zpět, vedle = ztráta vkladu).
- Trigger `trg_match_settle`: sázky se vypořádají hned po ukončení zápasu, potvrzení adminem už není podmínkou (potvrzení zůstává jako značka kvality výsledku).

## 2. Turnaje

**Databáze**
- `tournaments`: id, name, sport, format (`round_robin` / `single_elimination`), created_by, status, created_at.
- `tournament_teams`: id, tournament_id, name, seed.
- `matches` rozšířit o `tournament_id`, `round`, `slot`, `team_a_ref`, `team_b_ref` (odkaz na tournament_teams kvůli postupu v pavouku).
- RLS: čtení pro přihlášené, zápis/mazání pouze `has_role(auth.uid(),'admin')` + GRANTy.
- SECURITY DEFINER funkce `create_tournament(_name, _sport, _format, _teams text[])`:
  - ověří admina, založí turnaj a týmy,
  - **Round Robin**: vygeneruje všechny dvojice (3 týmy → A–B, B–C, A–C),
  - **Single Elimination**: doplní byes na mocninu dvou, vygeneruje 1. kolo a prázdné zápasy dalších kol,
  - vše jako běžné řádky v `matches`, takže na ně okamžitě funguje sázení podle pravidel z bodu 1.
- Trigger `advance_bracket`: po ukončení zápasu pavouka zapíše vítěze do navazujícího zápasu vyššího kola.

**Frontend**
- `/tournaments` — přehled turnajů + formulář pro založení (viditelný jen adminovi): název, sport, formát, počet týmů a jména týmů s našeptávačem registrovaných přezdívek (`NicknamesDatalist`).
- `/tournament?id=…` — detail v cyberpunk stylu:
  - **Round Robin**: rozpis zápasů po kolech + tabulka pořadí (Z, V, P, skóre, body),
  - **Single Elimination**: vizuální pavouk po sloupcích s postupujícími týmy,
  - u každého zápasu skóre, stav, velikost potu a tlačítko „Vsadit“ / „Již vsazeno“ vedoucí na detail zápasu.
- Odkaz **🏆 Turnaje** v hlavní navigaci (`__root.tsx`), turnajové zápasy se v detailu zápasu označí jménem turnaje a kolem.

## Technické detaily
- Vše přes migrace (nové tabulky, sloupce, funkce, triggery, GRANTy, RLS).
- `src/lib/tournaments-db.ts` jako datová vrstva (fetch turnajů, detail, volání `create_tournament`).
- Existující zápasy bez `tournament_id` fungují beze změny.
- Změna limitu na 250 $ se týká pouze nových sázek, historické sázky zůstávají.
