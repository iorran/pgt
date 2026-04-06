# Password Reset / Recovery — Design Spec

## Overview

Add password reset functionality to PGT using BetterAuth's built-in reset endpoints, Resend for email delivery, and a clean port/adapter architecture for provider swappability.

## Architecture

### Email Layer (`apps/api/src/email/`)

```
email/
  provider.ts          # EmailProvider interface
  resend-provider.ts   # Resend implementation of EmailProvider
  email-service.ts     # Domain service: templates + provider
  templates/
    password-reset.ts  # HTML template for the reset email
```

**EmailProvider interface:**

```ts
interface EmailProvider {
  send(options: { to: string; subject: string; html: string }): Promise<void>;
}
```

- Single method, single responsibility.
- `ResendEmailProvider` implements this using the Resend SDK.
- To swap providers later: write a new adapter (e.g., `SendGridProvider`), change the instantiation in `email-service.ts`. Nothing else changes.

**EmailService:**

- Accepts an `EmailProvider` via constructor injection.
- Exposes domain methods: `sendPasswordReset(email: string, resetUrl: string): Promise<void>`.
- Owns template rendering — the provider only knows about raw `{ to, subject, html }`.

### BetterAuth Integration (`apps/api/src/auth/index.ts`)

Add the `emailAndPassword.sendResetPassword` hook:

```ts
emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url }) => {
    await emailService.sendPasswordReset(user.email, url);
  },
},
```

BetterAuth handles token generation, expiry (~1 hour default), and validation. We only implement the email delivery.

### Environment Variables

Add to `apps/api/src/env.ts`:

- `RESEND_API_KEY` — Resend API key (required)
- `EMAIL_FROM` — sender address, defaults to `noreply@pgt.app` (or Resend's default sandbox domain during dev)

Add to production secrets (Fly.io):

- `RESEND_API_KEY`

## Frontend

### New Pages

**`/forgot-password` — Request reset**

- Simple form: email input + submit button.
- On submit: calls `authClient.forgetPassword({ email, redirectTo: '${import.meta.env.VITE_APP_URL}/reset-password' })` (uses the same env var pattern as the rest of the app).
- Always shows success message after submit ("Se o email existir, enviaremos um link de recuperação") — no email enumeration.
- Link back to `/login`.
- Uses Arena design system (Card, Input, Button) matching login page.

**`/reset-password` — Set new password**

- Accessed via email link: `/reset-password?token=xxx`.
- Form: new password + password confirmation.
- Client-side validation: passwords must match, minimum length.
- On submit: calls `authClient.resetPassword({ newPassword, token })`.
- On success: redirect to `/login` with success feedback.
- On error (expired/invalid token): show error with link to request a new reset.
- Uses Arena design system matching login page.

### Routing Changes (`App.tsx`)

Add both pages to the unauthenticated routes block (`!session`):

```tsx
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

### Login Page Change

Add "Esqueceu a senha?" link below the password field, pointing to `/forgot-password`.

## Email Template

- Language: pt-BR only (all current users are Brazilian).
- Subject: "PGT — Recuperação de Senha"
- Body: PGT branding header, greeting with user name, reset button/link, expiry notice, footer.
- Inline CSS for email client compatibility.
- Plain text fallback not needed for MVP.

## Testing Strategy

All tests written TDD-style (tests first, then implementation).

### Backend Tests

| Test | What it verifies |
|------|-----------------|
| `EmailProvider` interface contract | ResendEmailProvider calls Resend SDK `emails.send()` with correct params |
| `ResendEmailProvider` error handling | Throws when Resend SDK fails |
| `EmailService.sendPasswordReset()` | Calls provider with rendered template, correct subject, correct recipient |
| Password reset template | Produces HTML containing the reset URL and expected pt-BR content |
| BetterAuth `sendResetPassword` hook | Calls `emailService.sendPasswordReset()` with user email and URL |

### Frontend Tests

| Test | What it verifies |
|------|-----------------|
| ForgotPasswordPage renders form | Email input and submit button present |
| ForgotPasswordPage submit | Calls `forgetPassword` with email, shows success message |
| ForgotPasswordPage — always shows success | No email enumeration (same message for existing/nonexistent email) |
| ResetPasswordPage renders form | Password + confirmation inputs present |
| ResetPasswordPage validation | Shows error when passwords don't match |
| ResetPasswordPage submit | Calls `resetPassword` with token and new password |
| ResetPasswordPage success | Redirects to `/login` |
| ResetPasswordPage error | Shows error for invalid/expired token |
| App.tsx routing | `/forgot-password` and `/reset-password` accessible when unauthenticated |
| Login page | "Esqueceu a senha?" link present and points to `/forgot-password` |

## Dependencies

- `resend` npm package added to `apps/api`

## Out of Scope

- Rate limiting on reset requests (BetterAuth token expiry is sufficient for MVP)
- Multi-language emails (pt-BR only for now)
- Plain text email fallback
- Email verification on signup (separate feature)

## User Flow

```
Login Page
    │
    ├─ "Esqueceu a senha?" link
    │
    ▼
/forgot-password
    │ enter email → submit
    │
    ▼
Success message shown
    │
    │ (user checks inbox)
    │
    ▼
Email with reset link
    │ click link
    │
    ▼
/reset-password?token=xxx
    │ enter new password + confirm → submit
    │
    ▼
/login (with success message)
```
