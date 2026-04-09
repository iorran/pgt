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
| `/login` | `LoginPage — apps/web/src/pages/login` | `unauth` | TBD | |
| `/signup` | `SignupPage — apps/web/src/pages/signup` | `unauth` | TBD | |
| `/criar-academia` | `CriarAcademiaPage — apps/web/src/pages/criar-academia` | `unauth, no-academy` | TBD | |
| `/entrar/:code` | `EntrarPage — apps/web/src/pages/entrar` | `unauth, no-academy` | TBD | |
| `/forgot-password` | `ForgotPasswordPage — apps/web/src/pages/forgot-password` | `unauth` | TBD | |
| `/reset-password` | `ResetPasswordPage — apps/web/src/pages/reset-password` | `unauth` | TBD | |
| `/checkin` | `CheckinScanPage — apps/web/src/pages/checkin-scan` | `unauth` | TBD | |
| `/aguardando` | `AguardandoPage — apps/web/src/pages/aguardando` | `pending` | TBD | |
| `*` (catch-all) | `RejectedView — apps/web/src/App.tsx` | `rejected` | TBD | |
| `/` | `DashboardPage — apps/web/src/pages/dashboard` | `instructor + student` | TBD | |
| `/pending` | `PendingStudentsPage — apps/web/src/pages/pending-students` | `instructor + student` | TBD | |
| `/classes` | `ClassesPage — apps/web/src/pages/classes/index` | `instructor + student` | TBD | |
| `/classes/history` | `CheckinHistoryPage — apps/web/src/pages/classes/checkin` | `instructor + student` | TBD | |
| `/students` | `StudentsPage — apps/web/src/pages/students/index` | `instructor + student` | TBD | |
| `/students/:id` | `StudentDetailPage — apps/web/src/pages/students/detail` | `instructor + student` | TBD | |
| `/billing` | `BillingOverduePage — apps/web/src/pages/billing/index` | `instructor + student` | TBD | |
| `/billing/plans` | `PlansPage — apps/web/src/pages/billing/plans` | `instructor + student` | TBD | |
| `/billing/payments` | `PaymentsPage — apps/web/src/pages/billing/payments` | `instructor + student` | TBD | |
| `/marketplace` | `MarketplacePage — apps/web/src/pages/marketplace/index` | `instructor + student` | TBD | |
| `/marketplace/orders` | `OrdersPage — apps/web/src/pages/marketplace/orders` | `instructor + student` | TBD | |
| `/gamification` | `LeaderboardPage — apps/web/src/pages/gamification/leaderboard` | `instructor + student` | TBD | |
| `/gamification/seasons` | `SeasonsPage — apps/web/src/pages/gamification/seasons` | `instructor + student` | TBD | |
| `/gamification/results` | `ResultsPage — apps/web/src/pages/gamification/results` | `instructor + student` | TBD | |
| `/gamification/profile` | `GamificationProfilePage — apps/web/src/pages/gamification/profile` | `instructor + student` | TBD | |
| `/tournaments` | `TournamentsPage — apps/web/src/pages/tournaments/index` | `instructor + student` | TBD | |
| `/settings` | `SettingsPage — apps/web/src/pages/settings` | `instructor + student` | TBD | |
| `/totem` | `TotemPage — apps/web/src/pages/totem` | `instructor + student` | TBD | |
| `/checkin` | `CheckinScanPage — apps/web/src/pages/checkin-scan` | `instructor + student` | TBD | |

## Gap Table

| Guide section | Role | Current text (summary) | Actual app behavior | Action | Screenshot slug |
| ------------- | ---- | ---------------------- | ------------------- | ------ | --------------- |

## Screenshot Shot List

(Populated in Task 1.4)
