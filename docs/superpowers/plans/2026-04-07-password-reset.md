# Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add password reset/recovery to PGT using BetterAuth's built-in endpoints, Resend for email delivery, and a port/adapter email architecture.

**Architecture:** EmailProvider interface with ResendEmailProvider adapter, EmailService for domain logic and templates, BetterAuth `sendResetPassword` hook, two new frontend pages (forgot-password, reset-password).

**Tech Stack:** BetterAuth (built-in reset), Resend SDK, Fastify, React 19, Vite, shadcn/ui, vitest, @testing-library/react

---

### Task 1: Install Resend SDK + Add Environment Variables

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/.env` (local dev)

- [ ] **Step 1: Install resend package**

```bash
cd /Users/iorran/pgt && npm install resend --workspace=@pgt/api
```

- [ ] **Step 2: Add env vars to `apps/api/src/env.ts`**

Add `RESEND_API_KEY` and `EMAIL_FROM` to the env object:

```ts
export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  TRUSTED_ORIGINS: (process.env.TRUSTED_ORIGINS || 'http://localhost:5173').split(','),
  PORT: Number(process.env.PORT || 3000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'PGT <onboarding@resend.dev>',
};
```

- [ ] **Step 3: Add env vars to local `.env`**

Add to root `.env` or `apps/api/.env`:

```
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=PGT <onboarding@resend.dev>
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json package-lock.json apps/api/src/env.ts
git commit -m "chore: add resend SDK and email env vars"
```

---

### Task 2: EmailProvider Interface + ResendEmailProvider (TDD)

**Files:**
- Create: `apps/api/src/email/provider.ts`
- Create: `apps/api/src/email/resend-provider.ts`
- Create: `apps/api/test/email/resend-provider.test.ts`

- [ ] **Step 1: Write the failing tests for ResendEmailProvider**

Create `apps/api/test/email/resend-provider.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the resend module before importing the provider
vi.mock('resend', () => {
  const mockSend = vi.fn();
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: { send: mockSend },
    })),
    __mockSend: mockSend,
  };
});

import { Resend } from 'resend';
import { ResendEmailProvider } from '../../src/email/resend-provider.js';

describe('ResendEmailProvider', () => {
  let provider: ResendEmailProvider;
  let mockSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Access the shared mock
    const resendModule = vi.mocked(await import('resend')) as any;
    mockSend = resendModule.__mockSend;
    provider = new ResendEmailProvider('re_test_key', 'PGT <noreply@pgt.app>');
  });

  it('calls resend emails.send with correct params', async () => {
    mockSend.mockResolvedValue({ data: { id: '123' }, error: null });

    await provider.send({
      to: 'user@test.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: 'PGT <noreply@pgt.app>',
      to: 'user@test.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    });
  });

  it('throws when resend returns an error', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'Invalid API key' } });

    await expect(
      provider.send({ to: 'user@test.com', subject: 'Test', html: '<p>Hi</p>' }),
    ).rejects.toThrow('Failed to send email: Invalid API key');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/iorran/pgt && npx vitest run apps/api/test/email/resend-provider.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create the EmailProvider interface**

Create `apps/api/src/email/provider.ts`:

```ts
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface EmailProvider {
  send(options: SendEmailOptions): Promise<void>;
}
```

- [ ] **Step 4: Implement ResendEmailProvider**

Create `apps/api/src/email/resend-provider.ts`:

```ts
import { Resend } from 'resend';
import { EmailProvider, SendEmailOptions } from './provider.js';

export class ResendEmailProvider implements EmailProvider {
  private client: Resend;
  private from: string;

  constructor(apiKey: string, from: string) {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async send(options: SendEmailOptions): Promise<void> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /Users/iorran/pgt && npx vitest run apps/api/test/email/resend-provider.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/email/provider.ts apps/api/src/email/resend-provider.ts apps/api/test/email/resend-provider.test.ts
git commit -m "feat: add EmailProvider interface and ResendEmailProvider adapter"
```

---

### Task 3: Password Reset Email Template (TDD)

**Files:**
- Create: `apps/api/src/email/templates/password-reset.ts`
- Create: `apps/api/test/email/templates/password-reset.test.ts`

- [ ] **Step 1: Write the failing test for the template**

Create `apps/api/test/email/templates/password-reset.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { renderPasswordResetEmail } from '../../../src/email/templates/password-reset.js';

describe('renderPasswordResetEmail', () => {
  const resetUrl = 'https://pgt.app/reset-password?token=abc123';

  it('returns HTML containing the reset URL', () => {
    const html = renderPasswordResetEmail(resetUrl);
    expect(html).toContain(resetUrl);
  });

  it('contains the PGT branding', () => {
    const html = renderPasswordResetEmail(resetUrl);
    expect(html).toContain('PGT');
  });

  it('contains pt-BR text for password reset', () => {
    const html = renderPasswordResetEmail(resetUrl);
    expect(html).toContain('Recuperação de Senha');
    expect(html).toContain('Redefinir Senha');
  });

  it('contains expiry notice', () => {
    const html = renderPasswordResetEmail(resetUrl);
    expect(html).toContain('1 hora');
  });

  it('produces valid HTML structure', () => {
    const html = renderPasswordResetEmail(resetUrl);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/iorran/pgt && npx vitest run apps/api/test/email/templates/password-reset.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the password reset email template**

Create `apps/api/src/email/templates/password-reset.ts`:

```ts
export function renderPasswordResetEmail(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#141414;border:1px solid #262626;border-radius:8px;">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;">
              <h1 style="margin:0;font-size:36px;color:#f97316;letter-spacing:2px;">PGT</h1>
              <div style="width:48px;height:3px;background:#f97316;margin:12px auto 0;border-radius:2px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#fafafa;">Recuperação de Senha</h2>
              <p style="margin:0 0 24px;font-size:14px;color:#a3a3a3;line-height:1.6;">
                Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${resetUrl}" style="display:inline-block;padding:12px 32px;background-color:#f97316;color:#0a0a0a;font-size:14px;font-weight:bold;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">Redefinir Senha</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;color:#737373;line-height:1.5;">
                Este link expira em <strong>1 hora</strong>. Se você não solicitou esta alteração, ignore este email.
              </p>
              <p style="margin:0;font-size:12px;color:#737373;line-height:1.5;">
                Se o botão não funcionar, copie e cole este link no navegador:
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#525252;word-break:break-all;">
                ${resetUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #262626;text-align:center;">
              <p style="margin:0;font-size:11px;color:#525252;">PGT — Gestão de Academia BJJ</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/iorran/pgt && npx vitest run apps/api/test/email/templates/password-reset.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/email/templates/password-reset.ts apps/api/test/email/templates/password-reset.test.ts
git commit -m "feat: add password reset email template"
```

---

### Task 4: EmailService (TDD)

**Files:**
- Create: `apps/api/src/email/email-service.ts`
- Create: `apps/api/test/email/email-service.test.ts`

- [ ] **Step 1: Write the failing tests for EmailService**

Create `apps/api/test/email/email-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EmailService } from '../../src/email/email-service.js';
import { EmailProvider } from '../../src/email/provider.js';

describe('EmailService', () => {
  let mockProvider: EmailProvider;
  let service: EmailService;

  beforeEach(() => {
    mockProvider = {
      send: vi.fn().mockResolvedValue(undefined),
    };
    service = new EmailService(mockProvider);
  });

  describe('sendPasswordReset', () => {
    it('calls provider.send with correct recipient', async () => {
      await service.sendPasswordReset('user@test.com', 'https://pgt.app/reset?token=abc');

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@test.com',
        }),
      );
    });

    it('uses the correct subject line', async () => {
      await service.sendPasswordReset('user@test.com', 'https://pgt.app/reset?token=abc');

      expect(mockProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'PGT — Recuperação de Senha',
        }),
      );
    });

    it('includes the reset URL in the HTML body', async () => {
      const resetUrl = 'https://pgt.app/reset?token=abc123';
      await service.sendPasswordReset('user@test.com', resetUrl);

      const call = vi.mocked(mockProvider.send).mock.calls[0][0];
      expect(call.html).toContain(resetUrl);
    });

    it('propagates provider errors', async () => {
      vi.mocked(mockProvider.send).mockRejectedValue(new Error('Send failed'));

      await expect(
        service.sendPasswordReset('user@test.com', 'https://pgt.app/reset'),
      ).rejects.toThrow('Send failed');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/iorran/pgt && npx vitest run apps/api/test/email/email-service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement EmailService**

Create `apps/api/src/email/email-service.ts`:

```ts
import { EmailProvider } from './provider.js';
import { renderPasswordResetEmail } from './templates/password-reset.js';

export class EmailService {
  constructor(private provider: EmailProvider) {}

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const html = renderPasswordResetEmail(resetUrl);
    await this.provider.send({
      to: email,
      subject: 'PGT — Recuperação de Senha',
      html,
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/iorran/pgt && npx vitest run apps/api/test/email/email-service.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/email/email-service.ts apps/api/test/email/email-service.test.ts
git commit -m "feat: add EmailService with password reset support"
```

---

### Task 5: Wire EmailService into BetterAuth

**Files:**
- Create: `apps/api/src/email/index.ts`
- Modify: `apps/api/src/auth/index.ts`

- [ ] **Step 1: Create the email module barrel export with singleton**

Create `apps/api/src/email/index.ts`:

```ts
import { env } from '../env.js';
import { ResendEmailProvider } from './resend-provider.js';
import { EmailService } from './email-service.js';

const provider = new ResendEmailProvider(env.RESEND_API_KEY, env.EMAIL_FROM);
export const emailService = new EmailService(provider);
```

- [ ] **Step 2: Add `sendResetPassword` hook to BetterAuth config**

In `apps/api/src/auth/index.ts`, add the import at the top:

```ts
import { emailService } from '../email/index.js';
```

Then modify the `emailAndPassword` section:

```ts
emailAndPassword: {
  enabled: true,
  sendResetPassword: async ({ user, url }) => {
    await emailService.sendPasswordReset(user.email, url);
  },
},
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/email/index.ts apps/api/src/auth/index.ts
git commit -m "feat: wire email service into BetterAuth sendResetPassword hook"
```

---

### Task 6: Add i18n Translation Keys

**Files:**
- Modify: `apps/web/src/i18n/pt-BR.json`
- Modify: `apps/web/src/i18n/en.json`

- [ ] **Step 1: Add keys to `pt-BR.json`**

Add inside the `"auth"` section:

```json
"forgotPassword": "Esqueceu a senha?",
"forgotPasswordTitle": "Recuperar Senha",
"forgotPasswordSubmit": "Enviar Link",
"forgotPasswordSuccess": "Se o email existir em nossa base, enviaremos um link de recuperação.",
"resetPasswordTitle": "Redefinir Senha",
"newPassword": "Nova Senha",
"confirmPassword": "Confirmar Senha",
"resetPasswordSubmit": "Redefinir",
"resetPasswordSuccess": "Senha redefinida com sucesso!",
"resetPasswordError": "Link inválido ou expirado.",
"resetPasswordMismatch": "As senhas não coincidem.",
"requestNewReset": "Solicitar novo link",
"backToLogin": "Voltar ao Login"
```

- [ ] **Step 2: Add keys to `en.json`**

Add inside the `"auth"` section:

```json
"forgotPassword": "Forgot your password?",
"forgotPasswordTitle": "Recover Password",
"forgotPasswordSubmit": "Send Link",
"forgotPasswordSuccess": "If the email exists in our system, we'll send a recovery link.",
"resetPasswordTitle": "Reset Password",
"newPassword": "New Password",
"confirmPassword": "Confirm Password",
"resetPasswordSubmit": "Reset",
"resetPasswordSuccess": "Password reset successfully!",
"resetPasswordError": "Invalid or expired link.",
"resetPasswordMismatch": "Passwords do not match.",
"requestNewReset": "Request new link",
"backToLogin": "Back to Login"
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/i18n/pt-BR.json apps/web/src/i18n/en.json
git commit -m "feat: add password reset i18n translation keys"
```

---

### Task 7: Export `forgetPassword` and `resetPassword` from Auth Client

**Files:**
- Modify: `apps/web/src/lib/auth-client.ts`
- Modify: `apps/web/test/setup.ts`

- [ ] **Step 1: Add exports to auth-client.ts**

Update `apps/web/src/lib/auth-client.ts`:

```ts
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || '',
  fetchOptions: {
    credentials: 'include',
  },
});

export const { useSession, signIn, signUp, signOut } = authClient;
export const forgetPassword = authClient.forgetPassword;
export const resetPassword = authClient.resetPassword;
```

- [ ] **Step 2: Add mocks to `apps/web/test/setup.ts`**

Update the `better-auth/react` mock to include the new methods:

```ts
// Mock better-auth/react
vi.mock('better-auth/react', () => ({
  createAuthClient: () => ({
    useSession: () => ({ data: null, isPending: false }),
    signIn: { email: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn(),
    forgetPassword: vi.fn(),
    resetPassword: vi.fn(),
  }),
}));
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/auth-client.ts apps/web/test/setup.ts
git commit -m "feat: export forgetPassword and resetPassword from auth client"
```

---

### Task 8: ForgotPasswordPage (TDD)

**Files:**
- Create: `apps/web/test/pages/forgot-password.test.tsx`
- Create: `apps/web/src/pages/forgot-password.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/pages/forgot-password.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import ForgotPasswordPage from '../../src/pages/forgot-password';
import { forgetPassword } from '@/lib/auth-client';

vi.mock('@/lib/auth-client', () => ({
  forgetPassword: vi.fn(),
}));

const mockedForgetPassword = vi.mocked(forgetPassword);

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedForgetPassword.mockResolvedValue({} as any);
  });

  it('renders the email form', () => {
    renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByLabelText('auth.email')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.forgotPasswordSubmit' })).toBeInTheDocument();
  });

  it('renders the PGT branding', () => {
    renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByText('PGT')).toBeInTheDocument();
  });

  it('renders a back to login link', () => {
    renderWithProviders(<ForgotPasswordPage />);
    expect(screen.getByText('auth.backToLogin')).toBeInTheDocument();
  });

  it('calls forgetPassword on submit and shows success message', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('auth.email'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'auth.forgotPasswordSubmit' }));

    await waitFor(() => {
      expect(mockedForgetPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        redirectTo: expect.stringContaining('/reset-password'),
      });
    });

    expect(screen.getByText('auth.forgotPasswordSuccess')).toBeInTheDocument();
  });

  it('shows success message even if forgetPassword fails (no email enumeration)', async () => {
    mockedForgetPassword.mockRejectedValue(new Error('Not found'));
    const user = userEvent.setup();
    renderWithProviders(<ForgotPasswordPage />);

    await user.type(screen.getByLabelText('auth.email'), 'unknown@example.com');
    await user.click(screen.getByRole('button', { name: 'auth.forgotPasswordSubmit' }));

    await waitFor(() => {
      expect(screen.getByText('auth.forgotPasswordSuccess')).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/iorran/pgt && npx vitest run apps/web/test/pages/forgot-password.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ForgotPasswordPage**

Create `apps/web/src/pages/forgot-password.tsx`:

```tsx
import { useState } from 'react';
import { forgetPassword } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await forgetPassword({
        email,
        redirectTo: `${import.meta.env.VITE_APP_URL}/reset-password`,
      });
    } catch {
      // Silently ignore — no email enumeration
    }
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center arena-stripes">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-6xl text-primary leading-none arena-glow">
              PGT
            </h1>
            <div className="h-1 w-16 bg-primary mx-auto mt-4 rounded-sm" />
            <p className="font-heading text-muted-foreground uppercase tracking-wider text-sm mt-4">
              {t('auth.forgotPasswordTitle')}
            </p>
          </div>

          {submitted ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{t('auth.forgotPasswordSuccess')}</p>
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 transition-colors no-underline text-sm"
              >
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder={t('auth.email')}
                    required
                  />
                </div>

                <Button type="submit" className="w-full">
                  {t('auth.forgotPasswordSubmit')}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm">
                <Link
                  to="/login"
                  className="text-muted-foreground hover:text-primary transition-colors no-underline"
                >
                  {t('auth.backToLogin')}
                </Link>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/iorran/pgt && npx vitest run apps/web/test/pages/forgot-password.test.tsx
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/forgot-password.tsx apps/web/test/pages/forgot-password.test.tsx
git commit -m "feat: add forgot password page with tests"
```

---

### Task 9: ResetPasswordPage (TDD)

**Files:**
- Create: `apps/web/test/pages/reset-password.test.tsx`
- Create: `apps/web/src/pages/reset-password.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/web/test/pages/reset-password.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import ResetPasswordPage from '../../src/pages/reset-password';
import { resetPassword } from '@/lib/auth-client';

vi.mock('@/lib/auth-client', () => ({
  resetPassword: vi.fn(),
}));

// Mock useSearchParams to provide a token
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams('token=test-token-123')],
  };
});

const mockedResetPassword = vi.mocked(resetPassword);

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedResetPassword.mockResolvedValue({} as any);
  });

  it('renders the password form', () => {
    renderWithProviders(<ResetPasswordPage />);
    expect(screen.getByLabelText('auth.newPassword')).toBeInTheDocument();
    expect(screen.getByLabelText('auth.confirmPassword')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'auth.resetPasswordSubmit' })).toBeInTheDocument();
  });

  it('renders the PGT branding', () => {
    renderWithProviders(<ResetPasswordPage />);
    expect(screen.getByText('PGT')).toBeInTheDocument();
  });

  it('shows error when passwords do not match', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('auth.newPassword'), 'password123');
    await user.type(screen.getByLabelText('auth.confirmPassword'), 'different456');
    await user.click(screen.getByRole('button', { name: 'auth.resetPasswordSubmit' }));

    expect(screen.getByText('auth.resetPasswordMismatch')).toBeInTheDocument();
    expect(mockedResetPassword).not.toHaveBeenCalled();
  });

  it('calls resetPassword with token and new password on valid submit', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('auth.newPassword'), 'newpass123');
    await user.type(screen.getByLabelText('auth.confirmPassword'), 'newpass123');
    await user.click(screen.getByRole('button', { name: 'auth.resetPasswordSubmit' }));

    await waitFor(() => {
      expect(mockedResetPassword).toHaveBeenCalledWith({
        newPassword: 'newpass123',
        token: 'test-token-123',
      });
    });
  });

  it('shows success message after successful reset', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('auth.newPassword'), 'newpass123');
    await user.type(screen.getByLabelText('auth.confirmPassword'), 'newpass123');
    await user.click(screen.getByRole('button', { name: 'auth.resetPasswordSubmit' }));

    await waitFor(() => {
      expect(screen.getByText('auth.resetPasswordSuccess')).toBeInTheDocument();
    });
  });

  it('shows error message when reset fails (invalid/expired token)', async () => {
    mockedResetPassword.mockRejectedValue(new Error('Invalid token'));
    const user = userEvent.setup();
    renderWithProviders(<ResetPasswordPage />);

    await user.type(screen.getByLabelText('auth.newPassword'), 'newpass123');
    await user.type(screen.getByLabelText('auth.confirmPassword'), 'newpass123');
    await user.click(screen.getByRole('button', { name: 'auth.resetPasswordSubmit' }));

    await waitFor(() => {
      expect(screen.getByText('auth.resetPasswordError')).toBeInTheDocument();
    });
    expect(screen.getByText('auth.requestNewReset')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/iorran/pgt && npx vitest run apps/web/test/pages/reset-password.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ResetPasswordPage**

Create `apps/web/src/pages/reset-password.tsx`:

```tsx
import { useState } from 'react';
import { resetPassword } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPass !== confirmPass) {
      setError(t('auth.resetPasswordMismatch'));
      return;
    }

    try {
      await resetPassword({ newPassword: newPass, token });
      setSuccess(true);
    } catch {
      setError(t('auth.resetPasswordError'));
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center arena-stripes">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-8 pb-8 px-8">
          <div className="text-center mb-8">
            <h1 className="font-display text-6xl text-primary leading-none arena-glow">
              PGT
            </h1>
            <div className="h-1 w-16 bg-primary mx-auto mt-4 rounded-sm" />
            <p className="font-heading text-muted-foreground uppercase tracking-wider text-sm mt-4">
              {t('auth.resetPasswordTitle')}
            </p>
          </div>

          {success ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">{t('auth.resetPasswordSuccess')}</p>
              <Link
                to="/login"
                className="text-primary hover:text-primary/80 transition-colors no-underline text-sm"
              >
                {t('auth.backToLogin')}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('auth.newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder={t('auth.newPassword')}
                  required
                  minLength={8}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  placeholder={t('auth.confirmPassword')}
                  required
                  minLength={8}
                />
              </div>

              {error && (
                <div className="space-y-2">
                  <p className="text-sm text-destructive">{error}</p>
                  {error === t('auth.resetPasswordError') && (
                    <Link
                      to="/forgot-password"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors no-underline"
                    >
                      {t('auth.requestNewReset')}
                    </Link>
                  )}
                </div>
              )}

              <Button type="submit" className="w-full">
                {t('auth.resetPasswordSubmit')}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/iorran/pgt && npx vitest run apps/web/test/pages/reset-password.test.tsx
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/reset-password.tsx apps/web/test/pages/reset-password.test.tsx
git commit -m "feat: add reset password page with tests"
```

---

### Task 10: Update Login Page + App.tsx Routing (TDD)

**Files:**
- Modify: `apps/web/src/pages/login.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/test/pages/login.test.tsx` (if exists, otherwise create)
- Create: `apps/web/test/pages/routing.test.tsx`

- [ ] **Step 1: Write failing test for forgot password link on login page**

Create or update `apps/web/test/pages/login.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../render';
import LoginPage from '../../src/pages/login';
import { signIn } from '@/lib/auth-client';

vi.mock('@/lib/auth-client', () => ({
  signIn: { email: vi.fn() },
}));

describe('LoginPage', () => {
  it('renders the forgot password link', () => {
    renderWithProviders(<LoginPage />);
    const link = screen.getByText('auth.forgotPassword');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/forgot-password');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/iorran/pgt && npx vitest run apps/web/test/pages/login.test.tsx
```

Expected: FAIL — no element with text "auth.forgotPassword".

- [ ] **Step 3: Add forgot password link to login page**

In `apps/web/src/pages/login.tsx`, add a "Esqueceu a senha?" link after the password field and before the error message. Replace the section after the password `</div>` and before `{error &&`:

```tsx
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-xs text-muted-foreground hover:text-primary transition-colors no-underline"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>
```

This goes right after the password field's closing `</div>` (after line 60 in the current file) and before the `{error &&` block.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/iorran/pgt && npx vitest run apps/web/test/pages/login.test.tsx
```

Expected: PASS

- [ ] **Step 5: Write failing test for routing**

Create `apps/web/test/pages/routing.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRoute } from '../render';
import App from '../../src/App';

vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: null, isPending: false }),
  signOut: vi.fn(),
  signIn: { email: vi.fn() },
  forgetPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

describe('Unauthenticated routing', () => {
  it('renders forgot-password page at /forgot-password', () => {
    renderWithRoute(<App />, ['/forgot-password']);
    expect(screen.getByText('auth.forgotPasswordTitle')).toBeInTheDocument();
  });

  it('renders reset-password page at /reset-password', () => {
    renderWithRoute(<App />, ['/reset-password?token=abc']);
    expect(screen.getByText('auth.resetPasswordTitle')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run routing test to verify it fails**

```bash
cd /Users/iorran/pgt && npx vitest run apps/web/test/pages/routing.test.tsx
```

Expected: FAIL — routes not registered yet.

- [ ] **Step 7: Add routes to App.tsx**

In `apps/web/src/App.tsx`, add the imports at the top:

```ts
import ForgotPasswordPage from './pages/forgot-password';
import ResetPasswordPage from './pages/reset-password';
```

Then in the `!session` routes block, add before the catch-all `<Route path="*"`:

```tsx
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

- [ ] **Step 8: Run all tests to verify everything passes**

```bash
cd /Users/iorran/pgt && npx vitest run apps/web/test/pages/routing.test.tsx && npx vitest run apps/web/test/pages/login.test.tsx
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/pages/login.tsx apps/web/src/App.tsx apps/web/test/pages/login.test.tsx apps/web/test/pages/routing.test.tsx
git commit -m "feat: add forgot password link and password reset routes"
```

---

### Task 11: Add VITE_APP_URL to Environment + Deployment Config

**Files:**
- Modify: `apps/web/.env.local` (if exists) or document
- Modify: `.github/workflows/deploy.yml`

- [ ] **Step 1: Add VITE_APP_URL to deploy workflow**

In `.github/workflows/deploy.yml`, under the `deploy-web` build step, add `VITE_APP_URL` alongside `VITE_API_URL`:

```yaml
      - name: Build
        env:
          VITE_API_URL: ${{ vars.VITE_API_URL }}
          VITE_APP_URL: ${{ vars.VITE_APP_URL }}
        run: npm run build --workspace=@pgt/web
```

- [ ] **Step 2: Document required secrets/vars**

The following need to be set in production:

- **Fly.io secret:** `RESEND_API_KEY` — set via `flyctl secrets set RESEND_API_KEY=re_xxx -a pgt-api`
- **GitHub Actions variable:** `VITE_APP_URL` — set to `https://pgt-alpha.vercel.app`
- **Fly.io secret (optional):** `EMAIL_FROM` — defaults to `PGT <onboarding@resend.dev>` if not set

- [ ] **Step 3: Run full test suites**

```bash
cd /Users/iorran/pgt && npx vitest run --workspace=apps/api && npx vitest run --workspace=apps/web
```

Or individually:

```bash
cd /Users/iorran/pgt/apps/api && npx vitest run
cd /Users/iorran/pgt/apps/web && npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: add VITE_APP_URL to deploy workflow and document Resend secrets"
```
