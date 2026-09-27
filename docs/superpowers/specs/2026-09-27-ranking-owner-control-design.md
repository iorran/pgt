# Ranking: owner control over points

Date: 2026-09-27
Status: Implemented
Glossary: [[CONTEXT|Glossary]] · Related: [[2026-09-27-results-ux-design|Results UX]], [[2026-09-27-kids-belts-design|Kids belts]]

## Problem
Once a result was approved the owner could not see, correct or remove it; he could not give or take points for other reasons, nor change a season's points after creating it.

## Decisions
1. **Resultados shows all results** of the season with a status filter (Pendentes / Aprovados / Recusados / Todos). Each entry can be **edited** (competition, date, position 1–3 or none, status, points) or **deleted** (with confirmation).
2. **Points on edit:** if the owner types the points, they are kept (`pointsOverridden`), even if the season's points change later. Otherwise points follow the season config for the position (approved) or are 0 (pending/rejected).
3. **Point Adjustment** (glossary): "Ajustar pontos" for a student: ±N points + reason → approved entry without podium position (Carried-over Points are one kind). Negative allowed.
4. **XP follows points:** each result's XP entry = max(0, points) × 10 when approved, removed otherwise; deleting a result removes its XP. XP never goes negative.
5. **Student breakdown:** tapping a student in the ranking (owner) opens the list of every entry behind their points, with edit/delete and "Ajustar pontos".
6. **Season edit:** name, dates and points per place editable from Temporadas; **"Recalcular pontos"** re-applies the season's points to approved results that have a podium position and were not overridden.

## API contract
- `GET /api/competition-results?seasonId&status?&studentId?` (owner): as today, plus optional `studentId`; `status` omitted = all. Rows gain `pointsOverridden: boolean`. Ordered by competitionDate desc.
- `PATCH /api/competition-results/:id` (owner) `{ competitionName?, competitionDate?, position?: 1|2|3|null, status?: 'pending'|'approved'|'rejected', pointsAwarded?: integer }` → updated row. Rules from decisions 2 and 4. `400` invalid position/status/points; `404` other academy.
- `DELETE /api/competition-results/:id` (owner) → `204`; removes its XP entry.
- `POST /api/competition-results/adjustments` (owner) `{ studentId, points: integer ≠ 0, reason: string (non-empty), seasonId?, date? (default today) }` → `201` row (`position: null`, `status: 'approved'`, `pointsOverridden: true`, `competitionName = reason`). Season from `seasonId` or the season covering `date` (`422 NO_SEASON_FOR_DATE`).
- `POST /api/seasons/:id/recalculate` (owner) → `{ updated: number }`.
- `PUT /api/seasons/:id` (existing) is used by the edit form (name, startDate, endDate, prize, pointsConfig).
- Schema: `competition_result.points_overridden boolean not null default false` (migration 0015; existing position-less entries set to true).
