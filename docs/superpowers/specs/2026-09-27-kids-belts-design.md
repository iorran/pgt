# Kids belts and belt promotion

Date: 2026-09-27
Status: Implemented
Glossary: [[CONTEXT|Glossary]]

## Problem
The app only knew adult belts, but the academy's ranking (after the Mafra Cup) lists kids with grey, yellow and orange belts. The Owner also had no way to change a Student's belt (promotion) in the app.

## Decisions
1. **Belts follow IBJJF:** `white`, kids `grey-white`, `grey`, `grey-black`, `yellow-white`, `yellow`, `yellow-black`, `orange-white`, `orange`, `orange-black`, `green-white`, `green`, `green-black`, adults `blue`, `purple`, `brown`, `black`. pt-BR names: Branca; Cinza e branca, Cinza, Cinza e preta; Amarela e branca, Amarela, Amarela e preta; Laranja e branca, Laranja, Laranja e preta; Verde e branca, Verde, Verde e preta; Azul, Roxa, Marrom, Preta.
2. **Owner changes a Student's belt** on the Student page (grouped select: Infantil / Adulto).
3. **Ranking file import** (`db:import-belts`, run by the Owner against prod): sets belts only for unambiguous name matches and prints ambiguous/unmatched rows for manual fixing in the app.
4. Adult belt filter on the leaderboard stays adult belts; kids ranking stays one list regardless of belt.

## API contract
- `PUT /api/students/:id/belt` (owner, same academy) `{ belt }` → `{ id, belt }`; `400` for an unknown belt; `404` for another academy's student.
- Belt values anywhere in API responses may now be any of the 17 values above.

## Revision: ranking categories and carried-over points (2026-09-27)
- **Ranking Category** (glossary): adult belt → Adultos; kids belt → Kids; white belt → Kids if under 16 by birth date or tagged with the Kids modality, else Adultos. Teenagers ("adolescente"/"juvenil") on adult or white belts rank with Adultos. The owner adjusts exceptions by changing the student's Kids modality.
- **Carried-over Points** (glossary): the sheet's totals become one approved entry per student ("Pontos acumulados até a Mafra Cup"), with no podium position (`competition_result.position` nullable, migration 0014), in the season covering the import date. Shown as "Acumulado" in Meus resultados.
- `db:import-ranking` (replaces `db:import-belts`): belts (promote only — never undoes a promotion made in the app) + carried-over points; idempotent; dry run unless `APPLY=1`. Unmatched rows: fix the student's name in the app, then re-run.
