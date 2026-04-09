---
title: User Guide Audit Findings
tags:
  - audit
  - internal
---

# User Guide Audit Findings

> **Temporary working document.** Deleted at the end of Phase 3 of
> [[2026-04-09-user-guide-audit-design|User Guide Audit Design]].

## Route Inventory

| Route | Page component | Role(s) | Guide section | Status |
| ----- | -------------- | ------- | ------------- | ------ |
| `/login` | `LoginPage — apps/web/src/pages/login` | `unauth` | MISSING | |
| `/signup` | `SignupPage — apps/web/src/pages/signup` | `unauth` | "Criar Sua Academia" (Instructor); "Entrar em uma Academia" (Student) | |
| `/criar-academia` | `CriarAcademiaPage — apps/web/src/pages/criar-academia` | `unauth, no-academy` | "Criar Sua Academia" (Instructor) | |
| `/entrar/:code` | `EntrarPage — apps/web/src/pages/entrar` | `unauth, no-academy` | "Entrar em uma Academia" (Student) | |
| `/forgot-password` | `ForgotPasswordPage — apps/web/src/pages/forgot-password` | `unauth` | MISSING | |
| `/reset-password` | `ResetPasswordPage — apps/web/src/pages/reset-password` | `unauth` | MISSING | |
| `/checkin` | `CheckinScanPage — apps/web/src/pages/checkin-scan` | `unauth` | — | |
| `/aguardando` | `AguardandoPage — apps/web/src/pages/aguardando` | `pending` | "Aguardar Aprovação" (Student) | |
| `*` (catch-all) | `RejectedView — apps/web/src/App.tsx` | `rejected` | — | |
| `/` | `DashboardPage — apps/web/src/pages/dashboard` | `instructor + student` | "Compartilhar Seu Código de Acesso" (Instructor); "Banners de Pagamento" (Student) | |
| `/pending` | `PendingStudentsPage — apps/web/src/pages/pending-students` | `instructor + student` | "Aprovar Novos Alunos" (Instructor) | |
| `/classes` | `ClassesPage — apps/web/src/pages/classes/index` | `instructor + student` | "Criar uma Aula" (Instructor); "Editar ou Excluir uma Aula" (Instructor); "Método 1: Tocar no Botão de Check-in" (Student) | |
| `/classes/history` | `CheckinHistoryPage — apps/web/src/pages/classes/checkin` | `instructor + student` | "Ver Histórico de Check-ins" (Instructor); "Ver Seu Histórico de Check-ins" (Student) | |
| `/students` | `StudentsPage — apps/web/src/pages/students/index` | `instructor + student` | "Ver Detalhes do Aluno" (Instructor) | |
| `/students/:id` | `StudentDetailPage — apps/web/src/pages/students/detail` | `instructor + student` | "Ver Detalhes do Aluno" (Instructor); "Atribuir um Plano de Matrícula" (Instructor) | |
| `/billing` | `BillingOverduePage — apps/web/src/pages/billing/index` | `instructor + student` | "Acompanhar Alunos em Atraso" (Instructor) | |
| `/billing/plans` | `PlansPage — apps/web/src/pages/billing/plans` | `instructor + student` | "Criar Planos de Matrícula" (Instructor); "Editar Planos" (Instructor) | |
| `/billing/payments` | `PaymentsPage — apps/web/src/pages/billing/payments` | `instructor + student` | "Registrar um Pagamento" (Instructor); "Histórico de Pagamentos" (Student) | |
| `/marketplace` | `MarketplacePage — apps/web/src/pages/marketplace/index` | `instructor + student` | "Adicionar Produtos" (Instructor); "Explorar Produtos" (Student); "Fazer um Pedido" (Student) | |
| `/marketplace/orders` | `OrdersPage — apps/web/src/pages/marketplace/orders` | `instructor + student` | "Gerenciar Pedidos" (Instructor) | |
| `/gamification` | `LeaderboardPage — apps/web/src/pages/gamification/leaderboard` | `instructor + student` | "Ver o Ranking" (Instructor); "Ranking" (Student) | |
| `/gamification/seasons` | `SeasonsPage — apps/web/src/pages/gamification/seasons` | `instructor + student` | "Criar uma Temporada" (Instructor) | |
| `/gamification/results` | `ResultsPage — apps/web/src/pages/gamification/results` | `instructor + student` | "Aprovar Resultados de Competição" (Instructor); "Enviar Resultados de Competição" (Student) | |
| `/gamification/profile` | `GamificationProfilePage — apps/web/src/pages/gamification/profile` | `instructor + student` | "Seu Perfil" (Student) | |
| `/tournaments` | `TournamentsPage — apps/web/src/pages/tournaments/index` | `instructor + student` | "Campeonatos" (Instructor); "Inscrever-se em um Evento" (Student) | |
| `/settings` | `SettingsPage — apps/web/src/pages/settings` | `instructor + student` | "Definir a Localização da Academia" (Instructor) | |
| `/totem` | `TotemPage — apps/web/src/pages/totem` | `instructor + student` | "Método 2: Totem com QR Code" (Instructor) | |
| `/checkin` | `CheckinScanPage — apps/web/src/pages/checkin-scan` | `instructor + student` | "Método 2: Escanear o QR Code" (Student); "Método 2: Totem com QR Code" (Instructor) | |

## Page Contracts

(One sub-section per page. Extracted from source, not from guide.)

---

### `/login` — `LoginPage`

**File:** `apps/web/src/pages/login.tsx`
**Role:** unauth
**Labels / buttons (pt-BR):**
- "Gestão de Academia BJJ" (app tagline, below PGT logo)
- "E-mail" (label + placeholder)
- "Senha" (label + placeholder)
- "Esqueceu a senha?" (link)
- "Entrar" (submit button)
- "Criar Conta" (link to /signup)
**States:**
- Default: email + password form
- Submitting: button shows loading spinner
- Error: inline error message from API (raw English message, not translated)
- Success: redirects to `/`
**Entry points:** Direct URL; redirected here from any unauth `*` catch-all; "Voltar ao Login" links from /forgot-password and /reset-password; "Entrar" link from /signup
**Exit points:** `/` (on success); `/forgot-password` (via link); `/signup` (via link)

---

### `/signup` — `SignupPage`

**File:** `apps/web/src/pages/signup.tsx`
**Role:** unauth
**Labels / buttons (pt-BR):**
- "Gestão de Academia BJJ" (tagline)
- "Como deseja comecar?" (heading — note: missing accent on "começar")
- "Criar Academia" (card title + button)
- "Sou instrutor e quero cadastrar minha academia" (card description)
- "Tenho um codigo" (card title — note: missing accent on "código")
- "Sou aluno e recebi um codigo do meu instrutor" (card description — note: missing accent)
- "Digite o codigo da academia" (input placeholder — note: missing accent)
- "Continuar" (button, disabled until code entered)
- "Entrar" (link back to /login)
**States:**
- Default: two-card choice layout
- Code card: text input for join code; "Continuar" disabled until non-empty
**Entry points:** "Criar Conta" link from /login
**Exit points:** `/criar-academia` (via "Criar Academia" button); `/entrar/:code` (via "Continuar" with code); `/login` (via link)

---

### `/criar-academia` — `CriarAcademiaPage`

**File:** `apps/web/src/pages/criar-academia.tsx`
**Role:** unauth (new user) or authenticated (no-academy)
**Labels / buttons (pt-BR):**
- "Gestão de Academia BJJ" (tagline)
- "Seus Dados" (section heading — shown only when not logged in)
- "Nome" (label + placeholder — shown only when not logged in)
- "E-mail" (label + placeholder — shown only when not logged in)
- "Senha" (label + placeholder — shown only when not logged in)
- "Sua Academia" (section heading)
- "Nome da Academia" (label + placeholder)
- "Cidade" (label + placeholder)
- "Criar Academia" (submit button)
**States:**
- Not logged in: shows personal data section + academy section
- Logged in (no academy): shows only academy section
- Submitting: button shows loading spinner
- Error: inline error message (raw API message)
- Success: full page reload to `/`
**Entry points:** "Criar Academia" button from /signup; authenticated user with no `academyId` redirected here
**Exit points:** `/` (on success via `window.location.href`)

---

### `/entrar/:code` — `EntrarPage`

**File:** `apps/web/src/pages/entrar.tsx`
**Role:** unauth or no-academy
**Labels / buttons (pt-BR):**
- "Carregando..." (while fetching academy by code)
- "Academia nao encontrada" (error state — note: missing accent on "não")
- `<Academy name>` (card title when found)
- `<Academy city>` (card description)
- "Nome" (label + placeholder)
- "E-mail" (label + placeholder)
- "Senha" (label + placeholder)
- "Faixa" (label)
- Belt options (literals, not translated): "White", "Blue", "Purple", "Brown", "Black"
- "Continuar" (submit button)
**States:**
- Loading: full-screen spinner with "Carregando..."
- Not found: card with "Academia nao encontrada" error text
- Found: registration form with academy name/city displayed
- Submitting: button loading spinner
- Error: inline error message (raw API message)
- Success: `window.location.href = '/aguardando'` (full reload)
**Entry points:** "Continuar" from /signup with a code; direct URL with code
**Exit points:** `/aguardando` (on success via full reload)

---

### `/forgot-password` — `ForgotPasswordPage`

**File:** `apps/web/src/pages/forgot-password.tsx`
**Role:** unauth
**Labels / buttons (pt-BR):**
- "Recuperar Senha" (subtitle below PGT logo)
- "E-mail" (label + placeholder)
- "Enviar Link" (submit button)
- "Voltar ao Login" (link, shown both before and after submission)
- "Se o email existir em nossa base, enviaremos um link de recuperação." (success message)
**States:**
- Default: email form
- Submitting: button loading spinner
- Submitted: success message replaces form (always shown, regardless of whether email exists — no email enumeration)
**Entry points:** "Esqueceu a senha?" link from /login
**Exit points:** `/login` (via "Voltar ao Login" link)

---

### `/reset-password` — `ResetPasswordPage`

**File:** `apps/web/src/pages/reset-password.tsx`
**Role:** unauth (via email link with `?token=`)
**Labels / buttons (pt-BR):**
- "Redefinir Senha" (subtitle below PGT logo)
- "Nova Senha" (label + placeholder)
- "Confirmar Senha" (label + placeholder)
- "Redefinir" (submit button)
- "As senhas não coincidem." (inline validation error)
- "Link inválido ou expirado." (API error)
- "Solicitar novo link" (link shown when token error occurs, → /forgot-password)
- "Senha redefinida com sucesso!" (success message)
- "Voltar ao Login" (link shown after success)
**States:**
- Default: two-field password form
- Submitting: button loading spinner
- Mismatch error: inline error, form stays
- Token error: error + "Solicitar novo link" link
- Success: success message + "Voltar ao Login" link
**Entry points:** Email link with `?token=` query param (from forgot-password flow)
**Exit points:** `/login` (via "Voltar ao Login"); `/forgot-password` (via "Solicitar novo link")

---

### `/aguardando` — `AguardandoPage`

**File:** `apps/web/src/pages/aguardando.tsx`
**Role:** pending (student awaiting instructor approval)
**Labels / buttons (pt-BR):**
- "Aguardando Aprovacao" (heading — note: missing accent on "Aprovação")
- "Seu cadastro foi enviado. O instrutor ira aprovar sua entrada em breve." (body — note: missing accent on "irá")
- "Verificar status" (button — reloads page)
- "Sair" (button — signs out and navigates to /login)
**States:**
- Single steady state: waiting screen with hourglass emoji, two buttons
**Entry points:** Redirected here from /entrar/:code after successful signup; catch-all redirect for any route when status === 'pending'
**Exit points:** Same page (refresh via `window.location.reload()`); `/login` (via sign out)

---

### `*` (catch-all, rejected) — `RejectedView`

**File:** `apps/web/src/App.tsx`
**Role:** rejected (student whose membership was rejected by instructor)
**Labels / buttons (pt-BR):**
- "Cadastro Recusado" (heading)
- "Infelizmente seu cadastro foi recusado pelo instrutor." (body)
- "Sair" (button — signs out and navigates to /login)
**States:**
- Single steady state: rejection card
**Entry points:** Any route when `user.status === 'rejected'` (app-level routing)
**Exit points:** `/login` (via sign out)

---

### `/checkin` — `CheckinScanPage` (shared route: unauth + authenticated)

**File:** `apps/web/src/pages/checkin-scan.tsx`
**Role:** unauth (renders nothing — returns `null`); instructor + student (authenticated QR scan landing)
**Labels / buttons (pt-BR):**
- "Carregando..." (loading state)
- "Check-in realizado com sucesso!" (success state)
- "Voltar" (button in success and error states, → `/`)
- `<errorMsg>` (raw API error message in error state — not translated; common values from i18n: "QR Code inválido ou expirado", "Você já fez check-in nesta aula hoje", "Esta aula não está acontecendo agora", etc.)
**States:**
- Unauthenticated: renders null (blank page)
- Loading: spinner text while POST /checkins in flight
- Success: success message + "Voltar" button
- Error: raw error message + "Voltar" button (outline)
**Entry points:** QR code scan from `/totem` (URL contains `?token=&classId=` params)
**Exit points:** `/` (via "Voltar" button in both success and error states)

---

### `/` — `DashboardPage`

**File:** `apps/web/src/pages/dashboard.tsx`
**Role:** instructor + student (role-specific sections)
**Labels / buttons (pt-BR):**
- "Painel" (page heading)
- "Carregando, `<user name>`" (greeting — note: uses `t('common.loading').replace('...', '')` — renders as "Carregando, [name]")
- **Student only (overdue banner):** "Seu pagamento está `{{days}}` dias atrasado" (destructive banner)
- **Student only (upcoming banner):** "Seu pagamento vence em `{{days}}` dias" (primary banner)
- **Instructor only:** `<Academy name>` (card title)
- **Instructor only:** "Codigo de Acesso" (label — note: missing accent on "Código")
- **Instructor only:** `<joinCode>` (monospace display)
- **Instructor only:** "Copiar" / "Copiado!" (toggle button)
- **Instructor only:** "Compartilhar no WhatsApp" (button → opens WhatsApp web)
- Stat cards (labels): "Alunos", "Aulas", "Campeonatos"
**States:**
- Loading: stat cards show skeleton
- Instructor: academy card with join code + WhatsApp share button + stat cards
- Student (good standing): greeting + stat cards
- Student (overdue): destructive banner + stat cards
- Student (upcoming due): primary-colored banner + stat cards
**Entry points:** Default authenticated route; nav sidebar link "Painel"; redirect after login
**Exit points:** WhatsApp external link; sidebar navigation to all other sections

---

### `/pending` — `PendingStudentsPage`

**File:** `apps/web/src/pages/pending-students.tsx`
**Role:** instructor + student (instructor-relevant; student sees empty list or is redirected)
**Labels / buttons (pt-BR):**
- Tab nav: "Alunos" (→ /students), "Pendentes" (active tab)
- "Nenhum aluno pendente" (empty state)
- Per-student card: `<student name>`, `<student email>`, `<belt>` badge
- "Aprovar" (button per student)
- "Rejeitar" (button per student, outline)
**States:**
- Loading: `<PageLoader />`
- Empty: "Nenhum aluno pendente"
- List: cards with approve/reject buttons; buttons show loading spinner while mutation is in flight
**Entry points:** Sidebar nav (tab from /students); direct URL
**Exit points:** `/students` (via tab nav)

---

### `/classes` — `ClassesPage`

**File:** `apps/web/src/pages/classes/index.tsx`
**Role:** instructor + student (role-specific actions)
**Labels / buttons (pt-BR):**
- Tab nav: "Quadro de Aulas" (active), "Histórico de Presença" (→ /classes/history)
- **Instructor only:** "Criar Aula" (button + dialog title)
- Dialog fields: "Nome da Aula", "Tipo", "Dias da Semana", "Horário Início", "Horário Fim"
- Day buttons: "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"
- Type options (literals): "Gi", "No-Gi", "Open Mat", "Kids"
- "Salvar" (dialog submit button)
- **Instructor only (edit dialog):** "Editar Aula" (title); same fields minus days; "Salvar"
- **Instructor only (delete dialog):** "Excluir Aula" (title + confirm button); "Tem certeza que deseja excluir esta aula?" (body); "Cancelar"
- **Student only (active class, not checked in):** "Check-in" (proximity button), "QR Code" (QR button — note: both call proximity check-in; QR button label is `t('classes.checkinQR')` but triggers same geolocation mutation)
- **Student only (checked in):** "Presente" (text, no button)
- Toast/flash messages: "Check-in realizado com sucesso!", or localized error ("Você está longe da academia", "Você já fez check-in nesta aula hoje", etc.)
**States:**
- Loading: `<PageLoader />`
- Empty: "Nenhum resultado" (centered)
- List: class cards with colored left border by type; active classes (current day, ±15 min window) show check-in buttons for students
- Edit dialog open (instructor)
- Delete confirm dialog open (instructor)
**Entry points:** Sidebar nav "Aulas"
**Exit points:** `/classes/history` (via tab); dialogs are in-page

---

### `/classes/history` — `CheckinHistoryPage`

**File:** `apps/web/src/pages/classes/checkin.tsx`
**Role:** instructor + student
**Labels / buttons (pt-BR):**
- Tab nav: "Quadro de Aulas" (→ /classes), "Histórico de Presença" (active)
- Table headers: "Data", "Nome da Aula", "Tipo"
- "Nenhum resultado" (empty state)
**States:**
- Loading: `<PageLoader />`
- Empty: "Nenhum resultado"
- Table: rows with localized date, class name, class type
**Entry points:** Tab from /classes; direct URL
**Exit points:** `/classes` (via tab)

---

### `/students` — `StudentsPage`

**File:** `apps/web/src/pages/students/index.tsx`
**Role:** instructor + student
**Labels / buttons (pt-BR):**
- Tab nav: "Alunos" (active), "Pendentes" (→ /pending)
- "Buscar" (search input placeholder)
- Table headers: "Nome", "Faixa", "Plano", "Dia Vencimento"
- "Nenhum resultado" (empty/filtered state)
**States:**
- Loading: `<PageLoader />`
- Empty / no match: "Nenhum resultado"
- Table: student count badge; filterable table; name is a link to /students/:id
**Entry points:** Sidebar nav "Alunos"
**Exit points:** `/students/:id` (clicking a student name); `/pending` (via tab)

---

### `/students/:id` — `StudentDetailPage`

**File:** `apps/web/src/pages/students/detail.tsx`
**Role:** instructor + student
**Labels / buttons (pt-BR):**
- "Voltar" (button → /students)
- `<student name>` + `<belt>` badge (heading)
- `<email>`, `<phone>` (if present)
- Stat labels: "Total de Aulas", "Sequência Atual", "XP" (literal)
- "Plano" (membership card title)
- **Instructor only:** "Atribuir Plano" (dialog trigger button + dialog title)
- Assign dialog fields: "Plano" (select), "Data de Início", "Dia Vencimento"
- "Salvar" (dialog submit)
- **Instructor only (when plan assigned):** "Pagar Mês Atual" (button — quick payment)
- "Histórico de Pagamentos" (section heading)
- Payment table headers: "Data", "Valor", "Mês Referência"
- "Nenhum resultado" (empty payment history)
**States:**
- Loading: `<PageLoader />`
- Student not found: "Nenhum resultado"
- Loaded: student header, 3 stat cards, membership card, payment history table
- No plan: membership card shows "-" (dash)
- With plan: plan name + due day + "Pagar Mês Atual" (instructor only)
- Dialog open: assign membership form
**Entry points:** Student name link from /students; direct URL
**Exit points:** `/students` (via "Voltar")

---

### `/billing` — `BillingOverduePage`

**File:** `apps/web/src/pages/billing/index.tsx`
**Role:** instructor + student
**Labels / buttons (pt-BR):**
- Tab nav: "Inadimplentes" (active), "Planos" (→ /billing/plans), "Pagamentos" (→ /billing/payments)
- "Nenhum inadimplente" (empty state, shown with checkmark icon)
- Per-record card: `<student name>`, `<belt>` badge, `<plan name>`, `<days>` number, "dias em atraso"
**States:**
- Loading: `<PageLoader />`
- Empty: checkmark icon + "Nenhum inadimplente"
- List: cards with destructive red left border (≥8 days) or yellow (< 8 days); overdue count badge
**Entry points:** Sidebar nav "Financeiro"
**Exit points:** `/billing/plans`, `/billing/payments` (via tabs)

---

### `/billing/plans` — `PlansPage`

**File:** `apps/web/src/pages/billing/plans.tsx`
**Role:** instructor + student
**Labels / buttons (pt-BR):**
- Tab nav: "Inadimplentes" (→ /billing), "Planos" (active), "Pagamentos" (→ /billing/payments)
- **Instructor only:** "Criar Plano" (button + dialog title when creating)
- Dialog / edit form fields: "Nome do Plano", "Preço", "Frequência", "Aulas/Semana"
- Frequency options: "Mensal", "Trimestral", "Anual"
- "Editar" (dialog title when editing; button label on plan card — instructor only)
- "Criar" (dialog submit when creating), "Salvar" (dialog submit when editing)
- Plan card: `<plan name>`, `<price formatted BRL>`, `<frequency raw string>`, `<classesPerWeek>x / semana` (note: uses `t('billing.week')` which is **missing** from pt-BR.json — renders as undefined/blank)
- "Nenhum resultado" (empty state)
**States:**
- Loading: `<PageLoader />`
- Empty: "Nenhum resultado"
- List: plan cards; instructor sees "Editar" button per card
- Dialog open: create or edit form
**Entry points:** Tab from /billing or /billing/payments
**Exit points:** `/billing`, `/billing/payments` (via tabs)

---

### `/billing/payments` — `PaymentsPage`

**File:** `apps/web/src/pages/billing/payments.tsx`
**Role:** instructor + student
**Labels / buttons (pt-BR):**
- Tab nav: "Inadimplentes" (→ /billing), "Planos" (→ /billing/plans), "Pagamentos" (active)
- Card title: "Registrar Pagamento"
- Form fields: "Selecione um aluno" (select label + placeholder option), "Valor", "Data", "Mês Referência"
- "Salvar" (form submit)
- "Pagamentos Recentes" (section heading)
- Table headers: "Nome", "Valor", "Data", "Mês Referência"
- "Nenhum resultado" (empty recent payments)
**States:**
- Loading: `<PageLoader />`
- Form always visible (top of page)
- Recent payments list below (empty or table)
**Entry points:** Tab from /billing or /billing/plans
**Exit points:** `/billing`, `/billing/plans` (via tabs)

---

### `/marketplace` — `MarketplacePage`

**File:** `apps/web/src/pages/marketplace/index.tsx`
**Role:** instructor + student
**Labels / buttons (pt-BR):**
- Tab nav: "LOJA" (active), "PEDIDOS" (→ /marketplace/orders)
- **Instructor only:** "Adicionar Produto" (button + dialog title)
- Dialog fields: "Nome do Produto", "Descrição", "Preço", "Estoque"
- "Salvar" (dialog submit)
- Per-product: `<product name>`, `<description>` (optional), `R$ <price>`, "Estoque: `<n>`" badge
- **Student only:** "Solicitar" (button per product)
- Flash messages: "Pedido realizado com sucesso!" / "Erro ao realizar pedido"
- "Nenhum resultado" (empty state)
**States:**
- Loading: `<PageLoader />`
- Empty: "Nenhum resultado"
- List: product cards with placeholder Package icon (no real image support)
- Flash message shown briefly after order action
**Entry points:** Sidebar nav "Loja"
**Exit points:** `/marketplace/orders` (via tab)

---

### `/marketplace/orders` — `OrdersPage`

**File:** `apps/web/src/pages/marketplace/orders.tsx`
**Role:** instructor + student (role-specific columns and actions)
**Labels / buttons (pt-BR):**
- Tab nav: "LOJA" (→ /marketplace), "PEDIDOS" (active)
- Table headers (instructor): "Nome do Produto", "Nome", "Quantidade", "Status", "Data", "Ações"
- Table headers (student): "Nome do Produto", "Quantidade", "Status", "Data" (no student name, no actions)
- Status badges: "Pendente", "Confirmado", "Entregue", "Cancelado"
- **Instructor only, pending order:** "Confirmar" button, "Cancelar" button (destructive)
- **Instructor only, confirmed order:** "Entregar" button
- "Nenhum resultado" (empty state)
**States:**
- Loading: `<PageLoader />`
- Empty: "Nenhum resultado"
- List: orders table; instructor sees student name column and action buttons; student sees own orders read-only
**Entry points:** Tab from /marketplace
**Exit points:** `/marketplace` (via tab)

---

### `/gamification` — `LeaderboardPage`

**File:** `apps/web/src/pages/gamification/leaderboard.tsx`
**Role:** instructor + student
**Labels / buttons (pt-BR):**
- Tab nav: "Classificação" (active), "Temporadas" (→ /gamification/seasons), "Resultados de Competição" (→ /gamification/results), "Perfil de Gamificação" (→ /gamification/profile)
- Page title: "RANKING" (display font)
- `<Season name>` + date range (if active season)
- Season selector: `<season name>` options (dropdown)
- Category tabs: "Adultos", "Kids"
- Belt filter buttons: "Todas as faixas", "white", "blue", "purple", "brown", "black" (literals)
- Leaderboard entry: `#<rank>`, `<name>`, `<belt>` badge, `<points> pts`
- "Nenhum resultado ainda" (empty leaderboard, with trophy icon)
- "Nenhuma temporada cadastrada" (no seasons)
**States:**
- Loading: `<PageLoader />`
- No seasons: "Nenhuma temporada cadastrada"
- Seasons exist: season dropdown + category tabs + belt filters + ranked list
- Empty leaderboard: trophy icon + "Nenhum resultado ainda"
**Entry points:** Sidebar nav "Ranking"
**Exit points:** Tabs to /gamification/seasons, /gamification/results, /gamification/profile

---

### `/gamification/seasons` — `SeasonsPage`

**File:** `apps/web/src/pages/gamification/seasons.tsx`
**Role:** instructor + student
**Labels / buttons (pt-BR):**
- Tab nav: "Classificação" (→ /gamification), "Temporadas" (active), "Resultados de Competição", "Perfil de Gamificação"
- **Instructor only:** "Criar Temporada" (button + dialog title)
- Dialog fields: "Nome da Temporada", "Data Início", "Data Fim", "Premiação", "Pontuação (1º / 2º / 3º)"
- Points sub-labels: "1º Lugar", "2º Lugar", "3º Lugar"
- "Criar" (dialog submit)
- Season card: `<season name>`, "ATIVA" badge (if active), date range, `<prize>` if set, points config display
- "Nenhum resultado" (empty)
**States:**
- Loading: `<PageLoader />`
- Empty: "Nenhum resultado"
- List: season cards; active season has glowing border + "ATIVA" badge
- Dialog open (instructor): create season form
**Entry points:** Tab from /gamification
**Exit points:** Tabs to /gamification, /gamification/results, /gamification/profile

---

### `/gamification/results` — `ResultsPage`

**File:** `apps/web/src/pages/gamification/results.tsx`
**Role:** instructor + student (role-specific views)
**Labels / buttons (pt-BR):**
- Tab nav: "Classificação", "Temporadas", "Resultados de Competição" (active), "Perfil de Gamificação"
- **Student view — tab:** "Enviar Resultado"
- Student form fields: "Temporadas" (season selector), "Nome da Competição", "Data" (`t('classes.date')`), "Colocação" (position buttons: "1º Lugar" / "2º Lugar" / "3º Lugar")
- "Salvar" (student submit)
- Flash messages: "Resultado enviado com sucesso!" / "Erro ao enviar resultado"
- **Instructor view — tab:** "Resultados Pendentes"
- Instructor: season selector, pending results cards with `<student name>`, `<competition>`, `<date>`, `<position>` badge
- "Aprovar" / "Rejeitar" (buttons per result — instructor)
- "Nenhum resultado" (empty pending or no seasons)
**States:**
- Loading: `<PageLoader />`
- Student: submit form; no seasons → "Nenhuma temporada cadastrada"
- Instructor: pending results list; empty → "Nenhum resultado"
**Entry points:** Tab from /gamification
**Exit points:** Tabs to /gamification, /gamification/seasons, /gamification/profile

---

### `/gamification/profile` — `GamificationProfilePage`

**File:** `apps/web/src/pages/gamification/profile.tsx`
**Role:** instructor + student (shows own profile)
**Labels / buttons (pt-BR):**
- Tab nav: "Classificação", "Temporadas", "Resultados de Competição", "Perfil de Gamificação" (active)
- `<totalXp>` large display + "XP Total" label
- Stat cards: "Sequência Atual 🔥", "Maior Sequência", "XP Total"
- "Conquistas" (badges section heading)
- "Nenhuma conquista ainda" (empty badges)
- Per-badge: `<badge name>`, `<description>` (if present), `<earned date>`
**States:**
- Loading: `<PageLoader />`
- No profile: "Nenhum resultado"
- Loaded: XP header + 3 stat cards + badges grid
- No badges: "Nenhuma conquista ainda"
**Entry points:** Tab from /gamification
**Exit points:** Tabs to /gamification, /gamification/seasons, /gamification/results

---

### `/tournaments` — `TournamentsPage`

**File:** `apps/web/src/pages/tournaments/index.tsx`
**Role:** instructor + student
**Labels / buttons (pt-BR):**
- Page heading: "CAMPEONATOS"
- **Instructor only:** "Criar Campeonato" (button + dialog title)
- Create dialog fields: "Nome do Campeonato", "Data" (`t('classes.date')`), "Local", "Federação" (optional)
- "Criar" (create dialog submit)
- Tournament card: `<tournament name>`, `<federation>` badge (optional), `<date>`, `<location>`
- **Student only:** "Inscrever-se" (button per tournament, triggers sign-up dialog)
- Sign-up dialog: title "Inscrever-se", field "Categoria de Peso", "Confirmar" (submit)
- Flash messages: "Inscrição realizada com sucesso!" / "Erro ao realizar inscrição"
- **Instructor only:** "Ver Inscritos" (toggle button per tournament)
- Roster inline table headers: "Nome", "Faixa", "Categoria de Peso"
- "Lista de Inscritos" (roster section heading)
- "Nenhum resultado" (empty tournaments or empty roster)
**States:**
- Loading: `<PageLoader />`
- Empty: "Nenhum resultado"
- List: tournament cards; instructor sees "Ver Inscritos" toggle; student sees "Inscrever-se"
- Roster expanded inline below card (instructor)
- Sign-up dialog open (student)
**Entry points:** Sidebar nav "Campeonatos"
**Exit points:** All exits are in-page dialogs or roster toggles; no navigational exit

---

### `/settings` — `SettingsPage`

**File:** `apps/web/src/pages/settings.tsx`
**Role:** instructor + student (instructor sees location card; student sees empty page)
**Labels / buttons (pt-BR):**
- "Configurações" (page heading)
- **Instructor only:** "Definir localização da academia" (card title, with MapPin icon)
- When no location: "Nenhuma localização definida. Toque no botão abaixo enquanto estiver na academia."
- When location set: `<address>` (if present) + `<latitude>, <longitude>` coordinates
- "Usar minha localização atual" (button)
- Flash messages: "Localização salva" (success) / "Geolocation unavailable" (error — literal English string, not translated)
**States:**
- Instructor, no location: info text + button
- Instructor, location set: address/coordinates + button (allows update)
- Instructor, after save: brief flash message
- Student: page heading only (no card shown)
**Entry points:** Sidebar nav "Configurações"
**Exit points:** No navigational exits (settings are in-place)

---

### `/totem` — `TotemPage`

**File:** `apps/web/src/pages/totem.tsx`
**Role:** instructor + student (kiosk-mode page, outside AppLayout)
**Labels / buttons (pt-BR):**
- "PGT" (display logo)
- "Nenhuma aula no momento" (empty state)
- Per-class card: `<class name>`, `<class type>` badge, `<startTime> - <endTime>`, QR code SVG
- "Escaneie para fazer check-in" (below each QR code)
**States:**
- No active tokens: "Nenhuma aula no momento" (centered)
- Active tokens: grid of class cards, each with QR code
- Tokens auto-refresh every 4 minutes (background polling)
**Entry points:** Direct URL `/totem` (intended for a dedicated display/tablet); available to authenticated users
**Exit points:** No in-page navigation; scanning QR leads student to `/checkin?token=&classId=`

---

## Gap Table

| Guide section | Role | Current text (summary) | Actual app behavior | Action | Screenshot slug |
| ------------- | ---- | ---------------------- | ------------------- | ------ | --------------- |
| (new) | Instructor | (not documented) | Login page has E-mail + Senha form with "Entrar" button and "Esqueceu a senha?" link. | Add | login-page |
| (new) | Student | (not documented) | Login page has E-mail + Senha form with "Entrar" button and "Esqueceu a senha?" link. | Add | login-page |
| (new) | Instructor | (not documented) | Forgot-password sends a recovery email; reset-password accepts a token and new password with confirm-password field. | Add | forgot-reset-password |
| (new) | Student | (not documented) | Forgot-password sends a recovery email; reset-password accepts a token and new password with confirm-password field. | Add | forgot-reset-password |
| "Criar Sua Academia" | Instructor | Step 1 says click "Cadastrar" to sign up. | Signup link on the login page is labeled "Criar Conta", not "Cadastrar". | Update | signup-screen |
| "Entrar em uma Academia" | Student | Step 1 says tap "Cadastrar"; step 4 lists phone and date of birth as required fields. | Link is labeled "Criar Conta"; /entrar/:code form only collects Nome, E-mail, Senha, and Faixa — phone and DOB fields do not exist. | Update | student-join-form |
| "Entrar em uma Academia" | Student | (covered above) | Belt options are shown as English literals ("White", "Blue", etc.), not translated. | Update | student-join-form |
| "Aguardar Aprovação" | Student | Describes a waiting screen until instructor approves. | Waiting screen exists with "Aguardando Aprovacao" heading, "Verificar status" and "Sair" buttons. | Verify | aguardando-screen |
| "Compartilhar Seu Código de Acesso" | Instructor | Dashboard shows join code with Copy and WhatsApp share buttons. | Dashboard shows join code card with "Copiar"/"Copiado!" toggle and "Compartilhar no WhatsApp" button — matches guide. | Verify | dashboard-instructor |
| "Banners de Pagamento" | Student | Payment due-soon banner triggers 3 days before due; banner is orange. | Banner uses "primary" color (not explicitly orange) and threshold may be more than 3 days — needs screenshot to verify exact threshold. | Verify | dashboard-student-banner |
| "Banners de Pagamento" | Student | Overdue banner says "banner vermelho mostrando dias de atraso". | Overdue banner is destructive (red) showing "{{days}} dias atrasado" — matches. | Verify | dashboard-student-banner |
| "Aprovar Novos Alunos" | Instructor | Step 1 says go to "Alunos → aba Pendentes". | /pending page has two tabs: "Alunos" (→ /students) and "Pendentes" (active). Navigation path is correct. | Verify | pending-students |
| "Ver Detalhes do Aluno" | Instructor | Step 1 says "Alunos → aba Ativos". | /students page has tabs "Alunos" (active) and "Pendentes" — there is no "Ativos" tab; the main tab is simply "Alunos". | Update | students-list |
| "Atribuir um Plano de Matrícula" | Instructor | Covers assigning a plan via a dialog with plan, start date, and due day. | Detail page also shows a "Pagar Mês Atual" quick-pay button (added in recent release) when a plan is already assigned — not mentioned in guide. | Update | student-detail-plan |
| "Atribuir um Plano de Matrícula" | Instructor | (covered above — same screenshot) | Assign plan dialog matches guide: plan select, start date, due day, Save. | Verify | student-detail-plan |
| "Acompanhar Alunos em Atraso" | Instructor | Guide calls the tab "Em Atraso". | Tab in app is labeled "Inadimplentes", not "Em Atraso". | Update | billing-overdue |
| "Acompanhar Alunos em Atraso" | Instructor | Cards are yellow (1–7 days) or red (8+ days). | Code uses yellow for < 8 days and destructive red for ≥ 8 days — matches guide. | Verify | billing-overdue |
| "Criar Planos de Matrícula" | Instructor | Steps match: name, price, frequency, classes per week, Save. | Plan card displays `t('billing.week')` which is missing from pt-BR.json and renders blank for "classes/week" label. | Update | billing-plans |
| "Editar Planos" | Instructor | Guide says click "pencil icon" on plan card. | Edit button is labeled "Editar" (text button), not a pencil icon. | Update | billing-plans |
| "Registrar um Pagamento" | Instructor | Guide says tap "Registrar Pagamento" button to open a form. | /billing/payments shows a persistent "Registrar Pagamento" card form always visible on the page — no button to open it. | Update | billing-payments |
| "Histórico de Pagamentos" | Student | Guide says "Abra seu perfil para ver pagamentos". | There is no student-facing profile page; payment history lives on /students/:id (instructor view) or /billing/payments (instructor-only form). Students cannot access their own payment history directly. | Update | billing-payments |
| "Sino de Notificações" | Instructor | Describes a notification bell with "Enviar Lembrete", "Enviar E-mail", and "Silenciar" actions per overdue student. | No notification bell or dropdown is present in any page contract — this feature may not be implemented or may have been removed. | Verify | notification-bell |
| "Silenciar um Aluno" | Instructor | Describes muting a student from the notification bell to hide them from the overdue list. | No mute/silence functionality appears in any page contract — verify whether feature exists in header component not covered by page contracts. | Verify | notification-bell |
| "Adicionar Produtos" | Instructor | Step 1 says "Loja → aba Produtos". | /marketplace tab is labeled "LOJA" (not "Produtos") and is the default tab — navigation is "Loja" from sidebar, no sub-tab named "Produtos". | Update | marketplace-products |
| "Fazer um Pedido" | Student | Step 1 says "Toque em qualquer cartão de produto" then step 2 "Toque em Solicitar". | "Solicitar" button is directly on each product card — no need to tap the card first as a separate step. | Update | marketplace-order |
| "Gerenciar Pedidos" | Instructor | Guide says tap "Entregar" to mark order as delivered; covers status list. | Order statuses "Pendente", "Confirmado", "Entregue", "Cancelado" exist. Instructor sees "Confirmar", "Cancelar", and "Entregar" action buttons per order status. Guide omits "Confirmar" and "Cancelar" actions. | Update | marketplace-orders |
| "Criar uma Temporada" | Instructor | Step 3 sets name, start date, end date, and points for 1st/2nd/3rd. | Season creation dialog also has a "Premiação" (prize) field not mentioned in the guide. | Update | gamification-seasons |
| "Aprovar Resultados de Competição" | Instructor | Pending results appear at the top; tap Approve or Reject. | Instructor view has a season selector filter above pending results; results also show competition name, date, and position badge. | Verify | gamification-results-instructor |
| "Enviar Resultados de Competição" | Student | Steps: season, competition name, placement (1st/2nd/3rd). | Form field for placement uses position buttons ("1º Lugar" / "2º Lugar" / "3º Lugar") and also includes a "Data" field not mentioned in the guide. | Update | gamification-results-student |
| "Ver o Ranking" | Instructor | Filter by adults/kids and belt level. | Leaderboard has category tabs ("Adultos", "Kids") and belt filter buttons — matches guide. Season selector also present. | Verify | gamification-leaderboard |
| "Ranking" | Student | Filter by belt level. | Same leaderboard view — matches guide. | Verify | gamification-leaderboard |
| "Seu Perfil" | Student | Shows Total XP, current streak, longest streak, badges. | Profile page shows totalXp header, 3 stat cards (Sequência Atual, Maior Sequência, XP Total), and "Conquistas" badges section — matches guide. | Verify | gamification-profile |
| "Método 2: Totem com QR Code" | Instructor | Step 3 says codes refresh every 5 minutes. | TotemPage polls every 4 minutes (not 5) — guide is inaccurate. | Update | totem-page |
| "Método 1: Tocar no Botão de Check-in" | Student | Describes "Check-in" button on active classes. | Classes page shows both a "Check-in" button and a "QR Code" button for students on active classes — both trigger geolocation proximity check-in (not a QR scan). Guide does not document the "QR Code" button or clarify that it also triggers proximity check-in. | Update | classes-student-checkin |
| "Ver Histórico de Check-ins" | Instructor | View check-ins ordered by date. | /classes/history table shows Date, Class Name, Type — matches guide. | Verify | checkin-history |
| "Ver Seu Histórico de Check-ins" | Student | Same — view past check-ins. | Same table, same columns — matches guide. | Verify | checkin-history |
| "Campeonatos" | Instructor | Create tournaments; view roster per tournament. | "Ver Inscritos" toggle button reveals inline roster table with Name, Belt, Weight Category. Sign-up is student-initiated, not instructor — guide is accurate. | Verify | tournaments-instructor |
| "Inscrever-se em um Evento" | Student | Tap "Inscrever-se" and select weight class. | Sign-up dialog also requires a "Categoria de Peso" field (matches guide). Flash messages on success/error. | Verify | tournaments-student |
| "Definir a Localização da Academia" | Instructor | Open Settings, tap "Usar minha localização atual" while at gym. | Settings page shows "Definir localização da academia" card; button is "Usar minha localização atual"; error message "Geolocation unavailable" is in English (not translated). | Update | settings-location |
| "Criar uma Aula" | Instructor | Fill name, type, days of week, start/end time; one class created per day selected. | /classes dialog has all those fields. | Verify | classes-create |
| "Editar ou Excluir uma Aula" | Instructor | Tap pencil icon to edit; trash icon to delete. | Edit and delete are triggered by icon buttons (pencil / trash) on class cards — matches guide. | Verify | classes-edit-delete |

## Screenshot Shot List

(Populated in Task 1.4)
