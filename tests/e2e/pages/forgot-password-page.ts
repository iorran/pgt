import type { Page } from '@playwright/test';

export class ForgotPasswordPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/forgot-password');
  }

  async fillEmail(email: string) {
    await this.page.locator('#email').fill(email);
  }

  async submit() {
    await this.page.getByRole('button', { name: /enviar link/i }).click();
  }

  async requestReset(email: string) {
    await this.fillEmail(email);
    await this.submit();
  }

  /** Confirmation text shown after submission */
  successMessage() {
    return this.page.getByText(
      'Se o email existir em nossa base, enviaremos um link de recuperação.',
    );
  }
}
