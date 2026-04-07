import { EmailProvider } from './provider.js';
import { renderPasswordResetEmail } from './templates/password-reset.js';
import { renderOverduePaymentEmail } from './templates/overdue-payment.js';

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

  async sendOverduePayment(email: string, studentName: string, academyName: string, daysOverdue: number): Promise<void> {
    const html = renderOverduePaymentEmail({ studentName, academyName, daysOverdue });
    await this.provider.send({
      to: email,
      subject: 'PGT — Lembrete de Pagamento',
      html,
    });
  }
}
