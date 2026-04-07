import { describe, it, expect } from 'vitest';
import { renderOverduePaymentEmail } from '../../../src/email/templates/overdue-payment.js';

describe('renderOverduePaymentEmail', () => {
  it('renders HTML with student name and days overdue', () => {
    const html = renderOverduePaymentEmail({
      studentName: 'João Silva',
      academyName: 'PGT Pontinha',
      daysOverdue: 5,
    });
    expect(html).toContain('João Silva');
    expect(html).toContain('PGT Pontinha');
    expect(html).toContain('5');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('contains the PGT branding', () => {
    const html = renderOverduePaymentEmail({
      studentName: 'Maria Santos',
      academyName: 'Projeto Guerreiros',
      daysOverdue: 10,
    });
    expect(html).toContain('PGT');
  });

  it('contains pt-BR text for payment reminder', () => {
    const html = renderOverduePaymentEmail({
      studentName: 'Carlos',
      academyName: 'Academia BJJ',
      daysOverdue: 3,
    });
    expect(html).toContain('Lembrete de Pagamento');
    expect(html).toContain('atrasado');
  });

  it('produces valid HTML structure', () => {
    const html = renderOverduePaymentEmail({
      studentName: 'Test Student',
      academyName: 'Test Academy',
      daysOverdue: 1,
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('</html>');
    expect(html).toContain('<html lang="pt-BR">');
  });
});
