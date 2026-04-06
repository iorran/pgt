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
