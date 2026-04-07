---
title: TanStack Form Migration
date: 2026-04-07
tags:
  - spec
  - refactor
  - forms
status: approved
---

# TanStack Form Migration

> [!info] Related
> - Pattern reference: `pages/classes/index.tsx` (already migrated)

## Overview

Replace raw `useState` + `handleSubmit` with `@tanstack/react-form` in all remaining forms. Pure refactor — no behavior changes.

## Pattern

Already established in the classes page:

- Replace `const [form, setForm] = useState(...)` with `useForm({ defaultValues, onSubmit })`
- Replace `<form onSubmit={handleSubmit}>` with `<form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>`
- Replace manual `<Input value={form.field} onChange={...} />` with `<form.Field name="field">{(field) => ...}</form.Field>`
- Remove manual state management functions

## Forms to Migrate

1. `pages/login.tsx` — email, password
2. `pages/signup.tsx` — name, email, password
3. `pages/forgot-password.tsx` — email
4. `pages/reset-password.tsx` — password, confirmPassword
5. `pages/criar-academia.tsx` — name, city
6. `pages/entrar.tsx` — join code lookup
7. `pages/billing/plans.tsx` — plan create form
8. `pages/billing/payments.tsx` — payment record form
9. `pages/marketplace/index.tsx` — product create form
10. `pages/tournaments/index.tsx` — tournament create + signup forms (2 forms in one file)
11. `pages/gamification/seasons.tsx` — season create form
12. `pages/gamification/results.tsx` — result submit form
13. `pages/students/detail.tsx` — assign membership form

## Testing

Update existing tests only where they break. Behavior is unchanged so most tests should pass as-is.

## Out of Scope

- Adding validation rules (can be done later with TanStack Form validators)
- Changing form UX or layout
- Adding new form fields
