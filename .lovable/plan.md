# Betting v2 — Balances, limits & live board

## Pravidla (co uživatel dostane)

- **Balance:** každý profil startuje s **$1000**. Zobrazený v headeru u nicku.
- **Sázka:** min $1, **max $50**, jen na `a` / `b`. Částka se **hned strhne** z balance.
- **1 sázka na zápas / uživatel** — když už vsadil, formulář se zamkne (může jen vidět).
- **Nelze sázet** když: balance = 0, zápas už skončil, nebo už jsi vsadil.
- **Uzavření (locked):** sázky se „uzamknou" jakmile jsou **≥ 2 různí sázkaři** na zápase. Do té doby lze sázku ještě **stáhnout** (refund). Po locku už ne.
- **Vyhodnocení při ukončení zápasu:**
  - Pokud méně než 2 sázkaři → **všem refund** (sázka nebyla uzavřena).
  - Jinak výherci si rozdělí celkový pool **proporčně podle své sázky**. Prohraní dostanou 0.
- **Info board (nová stránka `/bets` + widget v Lobby):** ukazuje **live locked bety** — běžící zápasy se ≥2 sázkaři, jejich pool, kdo sází na kterou stranu, aktuální skóre.

## Databáze (migrace)

1. `profiles.balance numeric(10,2) not null default 1000` — backfill 1000 pro existující.
2. `profiles.balance_locked boolean` není potřeba — stržení řešíme okamžitě.
3. Trigger `handle_new_user` doplnit: nastavit balance 1000 (default to udělá, ale explicitně).
4. **RPC funkce (SECURITY DEFINER, atomické):**
   - `place_bet(match_id, pick, amount, note)` — validace: auth user, match neskončil, user ještě nesázel, amount 1–50, balance ≥ amount, match není locked pro tohoto pickera. Odečte balance, appendne bet do `matches.bets` jsonb, vrátí novou balanci. Pokud po vložení jsou ≥ 2 unique bettors → nastaví `matches.bets_locked_at = now()` (nový sloupec).
   - `withdraw_bet(match_id)` — jen když **není locked** a match neskončil; vrátí částku, odstraní bet z jsonb.
   - `settle_match(match_id)` — volá se když owner/admin nastaví `ended_at`. Pokud < 2 sázkaři → refund všem. Jinak spočítá vítěznou stranu (score, tie-break sety), rozdělí pool proporčně, updatuje balance výherců, označí bety `status: "won" | "lost" | "refunded"` v jsonb.
5. Sloupec `matches.bets_locked_at timestamptz`.
6. Aktualizovat `Bet` typ o `status?: "open" | "won" | "lost" | "refunded"` a `payout?: number`.

## Frontend

- **`src/lib/auth.tsx`** — načíst `balance` z profiles, vystavit `refreshBalance()`. Realtime subscribe na vlastní profile row (nebo refetch po každé akci).
- **Header (`__root.tsx`)** — vedle nicku ukázat `💰 $XXX` s neon stylem.
- **`BetsPanel` v `match.tsx`** — přepsat:
  - Zobrazit **pool**, seznam sázek s pickem, částkou, statusem a **jmény sázkařů**.
  - Ukázat badge **LOCKED** (≥2 bettors) nebo **OPEN (needs N more)**.
  - Formulář: amount slider/input 1–50, pick a/b, note. Disabled když už user vsadil / balance 0 / match skončil.
  - Tlačítko **Withdraw** dokud není locked.
  - Volá RPC `place_bet` / `withdraw_bet`.
- **Nová route `src/routes/bets.tsx` — Live Bet Board** (+ nav link 💸):
  - Sekce **🔒 Locked & Live** — běžící zápasy s locked bety, seřazené podle poolu. Karta: sport, týmy, live skóre, pool, split A vs B (počet sázkařů + částka na stranu), progress bar poměru.
  - Sekce **⏳ Open (needs bettors)** — zápasy s 1 sázkou co ještě čekají.
  - Sekce **✅ Recently settled** — posledních 10 vyhodnocených s výherci a payoutem.
  - Stejný cyber styling (grid-bg, neon-border, scanline) jako Scoreboard.
- **Lobby** — malý widget „🔴 Live bets" s top 3 pooly odkazující na `/bets`.
- **Profile** — přidat kartu **Balance** ($XXX) a rozšířit betting history o `payout` a `status`.
- **Match settle:** když se v `match.tsx` označí `endedAt` (Finish match), zavolat `settle_match` RPC. Admin unconfirm/delete → případně také refund (řeší RPC).

## Edge cases

- Zápas smazán adminem s locked bety → RPC `refund_all_bets` volané před delete (nebo trigger `before delete on matches`).
- Owner nemůže sázet na svůj vlastní zápas? **Rozhodnutí:** povoleno (drží konzistenci s existujícím chováním), lze snadno zakázat později.
- Balance == 0 → hráč vidí hlášku „Insolvent — no more bets" a nemůže otevřít formulář.

## Otevřené otázky (defaultně jdu s tímto řešením, řekni pokud jinak)

- **Proporční split výher** vs. „winner takes all rovným dílem". Jdu s **proporčním**.
- **Refund při < 2 sázkařích** vs. „stále výherce bere všechno". Jdu s **refundem** dle tvé věty.
- **Vlastník smí sázet na svůj zápas** — necháno povolené.
