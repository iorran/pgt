---
title: TanStack Form Migration Plan
date: 2026-04-07
tags:
  - plan
  - refactor
  - forms
status: pending
---

# TanStack Form Migration Implementation Plan

> [!info] Related
> - Spec: [[2026-04-07-tanstack-form-migration-design|Migration Spec]]
> - Pattern reference: `apps/web/src/pages/classes/index.tsx`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all remaining forms from raw useState to @tanstack/react-form.

**Architecture:** Mechanical refactor applying the same pattern to each form: replace useState with useForm, replace manual inputs with form.Field components, replace handleSubmit with form.handleSubmit. No behavior changes.

**Tech Stack:** @tanstack/react-form (already installed), React 19, Vitest

---

## Transformation Pattern

Every task applies this exact transformation. Reference: `apps/web/src/pages/classes/index.tsx`.

**Before:**
```typescript
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  await doSomething(email, password);
}

<form onSubmit={handleSubmit}>
  <Input value={email} onChange={e => setEmail(e.target.value)} />
</form>
```

**After:**
```typescript
import { useForm } from '@tanstack/react-form';

const form = useForm({
  defaultValues: { email: '', password: '' },
  onSubmit: async ({ value }) => {
    await doSomething(value.email, value.password);
  },
});

<form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
  <form.Field name="email">
    {(field) => (
      <Input
        value={field.state.value}
        onChange={e => field.handleChange(e.target.value)}
        onBlur={field.handleBlur}
      />
    )}
  </form.Field>
</form>
```

**Rules:**
- Add `import { useForm } from '@tanstack/react-form'`
- Remove `useState` import if no other state remains
- Keep all existing error handling, navigation, success messages
- Keep all existing UI structure and styling
- For dialog forms that reset on close, call `form.reset()` when dialog closes

---

### Task 1: Auth Forms — login, forgot-password, reset-password

**Files:**
- Modify: `apps/web/src/pages/login.tsx`
- Modify: `apps/web/src/pages/forgot-password.tsx`
- Modify: `apps/web/src/pages/reset-password.tsx`

- [ ] **Step 1: Refactor login.tsx**

Read `apps/web/src/pages/login.tsx`. Current state: two `useState` (email, password) + one error useState + handleSubmit calling `signIn.email()`.

Transform:
- Replace `email` and `password` useState with:
```typescript
const form = useForm({
  defaultValues: { email: '', password: '' },
  onSubmit: async ({ value }) => {
    setError('');
    const result = await signIn.email({ email: value.email, password: value.password });
    if (result.error) {
      setError(result.error.message ?? 'Login failed');
    } else {
      navigate('/');
    }
  },
});
```
- Keep `const [error, setError] = useState('')` (not a form field)
- Replace form JSX inputs with `form.Field` pattern
- Replace `<form onSubmit={handleSubmit}>` with `<form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>`
- Remove `handleSubmit` function, `email`/`password` useState

- [ ] **Step 2: Refactor forgot-password.tsx**

Read `apps/web/src/pages/forgot-password.tsx`. Current state: one `useState` (email) + sent boolean + handleSubmit calling `forgetPassword()`.

Transform:
- Replace email useState with:
```typescript
const form = useForm({
  defaultValues: { email: '' },
  onSubmit: async ({ value }) => {
    await forgetPassword({ email: value.email, redirectTo: `${window.location.origin}/reset-password` });
    setSent(true);
  },
});
```
- Keep `const [sent, setSent] = useState(false)` (UI state, not form)
- Replace input with `form.Field` pattern

- [ ] **Step 3: Refactor reset-password.tsx**

Read `apps/web/src/pages/reset-password.tsx`. Current state: `password` and `confirmPassword` useState + error + success + handleSubmit.

Transform:
- Replace password/confirmPassword useState with:
```typescript
const form = useForm({
  defaultValues: { password: '', confirmPassword: '' },
  onSubmit: async ({ value }) => {
    if (value.password !== value.confirmPassword) {
      setError(t('auth.passwordMismatch') || 'Passwords do not match');
      return;
    }
    setError('');
    const result = await resetPassword({ newPassword: value.password, token: token! });
    if (result.error) {
      setError(result.error.message ?? 'Failed');
    } else {
      setSuccess(true);
    }
  },
});
```
- Keep error/success/token state
- Replace inputs with `form.Field` pattern

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run test/pages/login.test.tsx test/pages/forgot-password.test.tsx test/pages/reset-password.test.tsx
```
Expected: ALL PASS (behavior unchanged)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/login.tsx apps/web/src/pages/forgot-password.tsx apps/web/src/pages/reset-password.tsx
git commit -m "refactor: migrate auth forms to TanStack Form

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Onboarding Forms — criar-academia, entrar

**Files:**
- Modify: `apps/web/src/pages/criar-academia.tsx`
- Modify: `apps/web/src/pages/entrar.tsx`

- [ ] **Step 1: Refactor criar-academia.tsx**

Read `apps/web/src/pages/criar-academia.tsx`. Current state: form with name, email, password (for unauthenticated) + academyName, city + handleSubmit that conditionally calls signUp then POST /academies.

Transform:
- Replace form useState with useForm. Keep conditional logic in onSubmit:
```typescript
const form = useForm({
  defaultValues: { name: '', email: '', password: '', academyName: '', city: '' },
  onSubmit: async ({ value }) => {
    if (!session) {
      const result = await signUp.email({
        email: value.email,
        password: value.password,
        name: value.name,
      });
      if (result.error) { setError(result.error.message ?? 'Signup failed'); return; }
    }
    await api('/academies', {
      method: 'POST',
      body: JSON.stringify({ name: value.academyName, city: value.city }),
    });
    navigate('/');
  },
});
```
- Keep error state for error messages

- [ ] **Step 2: Refactor entrar.tsx**

Read `apps/web/src/pages/entrar.tsx`. Current state: signup form with name, email, password, phone, dateOfBirth, belt + handleSubmit calling signUp then POST /academies/:id/join.

Transform:
- Replace form useState with useForm covering all signup fields
- Keep academy lookup logic (useApiQuery) and loading/error states unchanged
- Only the form submission and field bindings change

- [ ] **Step 3: Run tests**

```bash
cd apps/web && npx vitest run test/pages/criar-academia.test.tsx test/pages/entrar.test.tsx
```
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/criar-academia.tsx apps/web/src/pages/entrar.tsx
git commit -m "refactor: migrate onboarding forms to TanStack Form

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Billing Forms — plans, payments

**Files:**
- Modify: `apps/web/src/pages/billing/plans.tsx`
- Modify: `apps/web/src/pages/billing/payments.tsx`

- [ ] **Step 1: Refactor billing/plans.tsx**

Read `apps/web/src/pages/billing/plans.tsx`. Current state: dialog form with name, price, frequency + handleSubmit using useMutation.

Transform:
- Replace form useState with useForm
- Call `form.reset()` when dialog closes and on success
- Replace the mutation's mutationFn call in onSubmit with direct api call or keep mutation but call it from form.onSubmit

- [ ] **Step 2: Refactor billing/payments.tsx**

Read `apps/web/src/pages/billing/payments.tsx`. Current state: form with studentId, amount, paymentDate, referenceMonth + handleSubmit.

Transform same pattern. Keep all display/table logic unchanged.

- [ ] **Step 3: Run tests**

```bash
cd apps/web && npx vitest run test/pages/billing-plans.test.tsx test/pages/billing-overdue.test.tsx
```
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/billing/plans.tsx apps/web/src/pages/billing/payments.tsx
git commit -m "refactor: migrate billing forms to TanStack Form

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Marketplace + Tournaments

**Files:**
- Modify: `apps/web/src/pages/marketplace/index.tsx`
- Modify: `apps/web/src/pages/tournaments/index.tsx`

- [ ] **Step 1: Refactor marketplace/index.tsx**

Read `apps/web/src/pages/marketplace/index.tsx`. Current state: dialog form for creating products with name, description, price, stock.

Transform using the same useForm pattern. Reset form on dialog close.

- [ ] **Step 2: Refactor tournaments/index.tsx**

Read `apps/web/src/pages/tournaments/index.tsx`. This file has TWO forms:
1. Create tournament form (instructor): name, location, date, federation
2. Signup form (student): weightClass

Transform BOTH forms to separate useForm instances:
```typescript
const createForm = useForm({ defaultValues: { name: '', location: '', date: '', federation: '' }, onSubmit: ... });
const signupForm = useForm({ defaultValues: { weightClass: '' }, onSubmit: ... });
```

- [ ] **Step 3: Run tests**

```bash
cd apps/web && npx vitest run test/pages/marketplace.test.tsx test/pages/tournaments.test.tsx
```
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/marketplace/index.tsx apps/web/src/pages/tournaments/index.tsx
git commit -m "refactor: migrate marketplace and tournament forms to TanStack Form

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Gamification + Students

**Files:**
- Modify: `apps/web/src/pages/gamification/seasons.tsx`
- Modify: `apps/web/src/pages/gamification/results.tsx`
- Modify: `apps/web/src/pages/students/detail.tsx`

- [ ] **Step 1: Refactor gamification/seasons.tsx**

Read `apps/web/src/pages/gamification/seasons.tsx`. Current state: dialog form for creating seasons with name, startDate, endDate, pointsFirst, pointsSecond, pointsThird.

Transform using useForm pattern. Reset on dialog close.

- [ ] **Step 2: Refactor gamification/results.tsx**

Read `apps/web/src/pages/gamification/results.tsx`. Current state: form for submitting competition results with seasonId, position, tournamentName.

Transform using useForm pattern.

- [ ] **Step 3: Refactor students/detail.tsx**

Read `apps/web/src/pages/students/detail.tsx`. Current state: dialog form for assigning membership with planId, startDate, dueDay.

Transform using useForm pattern. Reset on dialog close.

- [ ] **Step 4: Run tests**

```bash
cd apps/web && npx vitest run
```
Expected: ALL PASS (full suite)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/gamification/seasons.tsx apps/web/src/pages/gamification/results.tsx apps/web/src/pages/students/detail.tsx
git commit -m "refactor: migrate gamification and student forms to TanStack Form

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run full test suite**

```bash
cd apps/web && npx vitest run
```
Expected: ALL PASS

- [ ] **Step 2: Verify no useState form patterns remain**

```bash
grep -rn "useState.*form\|setForm\b" apps/web/src/pages/ --include="*.tsx"
```
Expected: No matches (all forms migrated)

- [ ] **Step 3: Commit any fixes if needed**
