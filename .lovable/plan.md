## Problem

Match "BORO NEZASTAVITELNY vs Danko" (tennis, sets 20-15 / 20-12 / 17-20 → 2-1) is owned by Danko. Boro's Profile shows 0 victories because the page only counts matches where `ownerId === user.id`. Boro never created a match, so his "My matches" and "Victories" are both 0 — even though he played and won.

## Fix

Change Profile to be participant-based, not owner-based:

- `myMatches`: any match where the signed-in user's nickname appears as a player on Team A or Team B (case-insensitive), splitting team strings on `&`, `/`, `,`, `+`, and `and` — same helper the Scoreboard/rankings page uses. Sort by started/ended date, newest first.
- `victories`: subset of those matches where the winning side (already computed via `winnerSideOf`, which correctly falls back to sets-won for 0:0 finals) contains the user's nickname.
- Keep the "Resume" button only for matches the user actually owns; non-owners see "View".
- Bets logic stays as-is (already nickname-based).

Everything else on the page (hero, stats grid, bets section, styling) stays untouched.

## Files

- `src/routes/profile.tsx` — replace the `myMatches` memo and the `victories` calculation; adjust the match card CTA to check ownership per row.

## Verify

After the change, sign-in as Boro should show that tennis match under "My matches" with `2 : 1` and Victories = 1.
