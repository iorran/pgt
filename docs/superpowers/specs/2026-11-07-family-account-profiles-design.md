# Family account & profiles (one login per Family)

Date: 2026-11-07
Status: Approved 2026-11-07 — implemented (staging reseed pending)
Glossary: [[CONTEXT|Glossary]] · Decision: [[0004-one-login-per-family-with-profiles|ADR 0004]] · Builds on: [[2026-09-26-families-design|Families design]]

## Problem

Kids don't log in — their parents handle everything for them — yet today every Student is a separate account with its own email. The academy's sheet puts the parent's email on the kid's row, so siblings collide on the unique email, parents can't see their kids' dues in one place, and overdue notices would go to "the kid". Some adults are also managed by someone else in the household (e.g. Vera by Samuel), and some parents who handle kids don't train at all.

## Goal

A Family is one account. Its **Responsible** logs in once, picks a **profile** (Netflix-style: "Quem vai usar?"), and does everything that Student could do. Dependents never log in. All Family mail goes to the Responsible.

## Decisions

| # | Decision |
|---|---|
| 1 | Every Family has exactly one **Responsible** (`family.responsible_user_id`, required). It replaces the optional Family Contact. |
| 2 | Every other member of a Family is a **Dependent**: no password, no login, kid or adult. Being a Dependent is derived (in a Family and not its Responsible) — no extra column. |
| 3 | A Responsible who trains is a normal Student (`role = student`). A Responsible who doesn't train has the new role **`responsible`**: login only, never listed as a Student, never billed or ranked. |
| 4 | A Student not in a Family is unchanged: own login, own email. |
| 5 | **Profiles**: after login, a Responsible chooses a profile — themself (only if they train) or any Dependent. With one profile only, it's chosen automatically. The current profile shows in the header with a "Trocar perfil" action. |
| 6 | Acting as a Dependent gives **everything** a Student can do: check-in (incl. QR), billing status and history, ranking, results, tournaments, marketplace orders, profile edits. |
| 7 | Mechanism (ADR 0004): web sends `x-acting-as: <dependentId>`; `requireAuth` verifies the session user is that Dependent's Family Responsible and swaps `request.user` to the Dependent, keeping `request.actor`. Invalid → 403. No header → the Responsible's own identity. |
| 8 | A non-training Responsible with no profile chosen sees only the profile picker and the Family overview (members, what's owed). |
| 9 | Dependents get a generated internal email (`<id>@dependente.pgt.invalid`), never shown, never emailed. |
| 10 | All email about any Family member (overdue, receipts, password reset) goes to the Responsible's email. Overdue notices for a Family are one email listing members and months. |
| 11 | Owner manages it on the Family dialog: pick the Responsible from the members, **or** create a non-training Responsible (name + email). Changing the Responsible moves the login rights; history is untouched. |
| 12 | New non-training Responsible: account created without a password; the Owner's "Enviar convite" sends a set-password link (same flow as "Esqueceu a senha"). |
| 13 | **Only the Owner manages Families** (members and Responsible); the Responsible can't add or remove members. When someone leaves or needs to be managed separately, the Owner removes them from the Family ("Remover da família"). They become an independent Student, keeping all history. The removal dialog asks for their own email (optional). With it, the person **creates their login alone**: "Primeiro acesso" on the login page sends a set-password link to that email (same flow as "Esqueceu a senha"). Without it, they stay without login until the Owner adds the email. |
| 14 | Removing the Responsible from a Family is refused until another Responsible is chosen (a Family is never without one). |
| 15 | The Owner role is unaffected; an Owner is never a Responsible. |
| 16 | Ranking Category, Monthly Fee, Waived Months, Family Payment and Family Fee are unchanged (ADR 0001/0002). |

## Scenarios (acceptance)

1. **Kids only** — Paula Lima (doesn't train) is Responsible of Família Lima (Alice, Afonso). She logs in → "Quem vai usar?" shows Alice and Afonso; she picks Alice → Alice's home, check-in and dues. "Trocar perfil" → Afonso.
2. **Parent who trains** — Rafael Costa is Responsible of Família Costa (Karina, Miguel, Livia). His picker shows Rafael, Karina, Miguel, Livia; as Rafael he sees his own data.
3. **Adult dependent** — Vera is a Dependent of Samuel Rocha; Vera cannot log in; Samuel acts as Vera to check her in.
4. **Forbidden** — Samuel sends `x-acting-as: <Livia>` → 403. A Dependent's id with no session → 401.
5. **One email** — Família Neves owes October for 3 kids → one overdue email to the Responsible listing the 3 kids.
6. **Change Responsible** — Owner makes Diogo the Responsible of Família Teixeira instead of Daniela → Daniela becomes a Dependent and loses her login (warned in the dialog); Diogo receives the invite.
7. **Leaving** — Owner removes Ana from Família Pires and types her email in the removal dialog → she is an independent Student with her history; on the login page she uses "Primeiro acesso" with that email, sets her password and logs in alone. Marcos no longer sees her profile. Removed without an email → no login until the Owner adds one.
8. **Responsible can't edit the Family** — Marcos tries to remove a member via the API → 403; only the Owner can.
9. **Independent student** — a Student outside any Family logs in exactly as today; no picker.

## Design sketch

### Data (migration)

- `user_role` enum + `responsible`.
- `family.responsible_user_id` uuid FK → user, **not null** (backfill: existing Family Contact, else first adult member, else first member).
- Drop `family.contact_student_id` after backfill (Family Contact superseded).
- `account` rows (passwords) removed for Dependents during backfill; their emails replaced by the internal email.
- Unique: a user is Responsible of at most one Family (`unique(responsible_user_id)`).

### API

- `requireAuth`: handle `x-acting-as` (decision 7); expose `request.actor`. `authorizeStudentRead` keeps working (it reads `request.user`).
- `GET /api/me/profiles` → `{ self: Student | null, dependents: Student[] }` for the session user (actor).
- Owner: `PUT /api/families/:id/responsible` `{ userId }` or `{ name, email }` (creates `responsible` user); `POST /api/families/:id/responsible/invite`.
- Family membership changes enforce decisions 13–14 and stay Owner-only. `DELETE /api/families/:id/members/:userId` accepts an optional `{ email }`: replaces the internal email so the person can use "Primeiro acesso".
- "Primeiro acesso" = the existing password-reset request with first-access copy; it must create the credential account when the user has none (verify Better Auth's reset flow does this; otherwise create it on reset).
- Email: overdue job groups by Family → one email to the Responsible (Dependents' internal emails are never used as recipients).
- Login rejects users with an internal email (defence in depth; they have no password anyway).

### Web

- After login: `/perfis` picker when the actor has dependents; chosen profile kept per tab (sessionStorage) and sent as `x-acting-as` by the API client.
- Header: avatar + name of the current profile, "Trocar perfil".
- `responsible` role shell: picker + Família overview only.
- Owner → Família dialog: "Responsável" field (member or new person), "Enviar convite", warning when the change removes someone's login, "Remover da família" with optional email field.
- Login page: "Primeiro acesso" link (email → set-password link).

### Import (seed)

- From `seed-data/2027-ativo.limpo.csv` (gitignored): rows with `dependente = sim` become Dependents of their Family's Responsible; Families get `responsible_user_id`; non-training Responsibles are created from `responsavel_nome`/`responsavel_email` with role `responsible`.
- Test on staging first (all emails → `iorranpt+N@gmail.com`), then prod after backup branch.

## Testing (TDD — tests first)

- API: acting-as allowed for own Dependent, 403 for others / non-members / Owner; no header → self; `request.actor` preserved; every student endpoint smoke-tested while acting (check-in, my-status, ranking); `/me/profiles` for trainer and non-trainer Responsible; family membership rules 13–14; backfill migration; overdue email grouped per Family to the Responsible; Dependent can't sign in.
- Web: picker shown/skipped; header switch; API client sends header; `responsible` shell; Owner family dialog (pick member, create new, invite, warning).
- Import: limpo CSV → expected Families, Responsibles, Dependents, no login for Dependents.

## Open items

- **Optional belt for Funcional-only Students** (e.g. Joana Melo): `user.belt` is required today. Separate small change (nullable belt; ranking ignores beltless Students).
- **Private lessons / packs** (PT, "PAC 10"): no model yet; imported with a Training Note. Backlog.
- Shared custody: the second parent can't log in (same as decision 11 of the Families design).
