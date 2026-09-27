# Competition results: easy to send, visible, owner can register

Date: 2026-09-27
Status: In implementation
Glossary: [[CONTEXT|Glossary]] · Related: [[2026-09-26-families-design|Families design]]

## Problem

At the first showcase nobody could find how to register a won championship: students only had a button at the bottom of Progresso → Perfil leading to a separate page that also asked for a season; after submitting they never saw whether it was approved; the owner could not register a result himself (the MVP scope says he can); and with no season the page just said "Nenhuma temporada cadastrada".

## Decisions

1. **Student entry point:** "Enviar Resultado" is the primary action at the top of the Ranking (Classificação) page and on Progresso → Perfil. It opens a dialog, not a page.
2. **Student dialog asks only** competition name, competition date, podium position (1º / 2º / 3º as large toggle buttons). Only podium places count for the ranking, so other positions are not offered.
3. **Season is chosen by the server** from the competition date: the academy's season whose start–end range contains the date (if several, the most recently started). Students never pick a season.
4. **No season for that date:** the dialog explains "Nenhuma temporada para esta data — fale com a academia" (API 422 `NO_SEASON_FOR_DATE`).
5. **Meus resultados:** students see their own results with status (Pendente / Aprovado +N pts / Recusado) on Progresso → Perfil.
6. **Owner registers results:** "Registrar resultado" on the Resultados page — pick a student (search by name), same fields; owner-entered results are **approved immediately** with points and XP.
7. **Seeds:** the seed creates an active season for the current calendar year (10 / 7 / 5 points).

## API contract

- `POST /api/competition-results` body `{ studentId, competitionName, competitionDate: 'YYYY-MM-DD', position: 1|2|3, seasonId? }`.
  - `seasonId` optional: when absent, the server picks the season containing `competitionDate` (latest `startDate` wins); none → `422 { error: 'NO_SEASON_FOR_DATE' }`.
  - `position` outside 1–3 → `400`.
  - Student (for themself): `201`, `status: 'pending'`, `pointsAwarded: 0` (unchanged).
  - Owner (for a student of the academy): `201`, `status: 'approved'`, `pointsAwarded` from the season, `reviewedBy` = owner, XP entry created (points × 10) — same effect as approving.
- `GET /api/competition-results/mine` (logged-in student) → `{ id, competitionName, competitionDate, position, status: 'pending'|'approved'|'rejected', pointsAwarded, seasonName }[]`, newest competition first.
- Unchanged: owner `GET /api/competition-results?seasonId&status`, approve/reject.
