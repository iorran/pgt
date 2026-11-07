import { describe, it, expect } from 'vitest';
import i18next from 'i18next';
import ptBR from '@/i18n/pt-BR.json';
import en from '@/i18n/en.json';

const i18n = i18next.createInstance();
await i18n.init({
  resources: { 'pt-BR': { translation: ptBR }, en: { translation: en } },
  lng: 'pt-BR',
  interpolation: { escapeValue: false },
});

const values = (o: any): string[] =>
  Object.values(o).flatMap((v) => (v && typeof v === 'object' ? values(v) : [v as string]));

describe('i18n copy', () => {
  it.each([
    ['billing.yourPaymentOverdue', 'Seu pagamento está 1 dia atrasado', 'Seu pagamento está 3 dias atrasado'],
    ['billing.paymentDueSoon', 'Seu pagamento vence em 1 dia', 'Seu pagamento vence em 3 dias'],
    ['billing.daysOverdue', 'dia em atraso', 'dias em atraso'],
    ['notifications.daysOverdue', '1 dia atrasado', '3 dias atrasado'],
    ['gamification.control.recalculated', '1 resultado atualizado', '3 resultados atualizados'],
  ])('pluralizes %s on count', (key, one, other) => {
    expect(i18n.t(key, { lng: 'pt-BR', count: 1 })).toBe(one);
    expect(i18n.t(key, { lng: 'pt-BR', count: 3 })).toBe(other);
  });

  it('pluralizes the overdue reminder message', () => {
    expect(i18n.t('notifications.overdueMessage', { name: 'Ana', count: 1 })).toContain('1 dia atrasado');
    expect(i18n.t('notifications.overdueMessage', { lng: 'en', name: 'Ana', count: 1 })).toContain('1 day overdue');
  });

  it('uses typographic ellipses and apostrophes', () => {
    for (const v of [...values(ptBR), ...values(en)]) {
      expect(v).not.toContain('...');
    }
    for (const v of values(en)) {
      expect(v).not.toContain("'");
    }
  });

  it('keeps success messages calm (no exclamation)', () => {
    for (const v of [...values(ptBR), ...values(en)]) {
      expect(v).not.toMatch(/sucesso!|successfully!|successful!/);
    }
  });

  it('uses the glossary terms in pt-BR', () => {
    const all = values(ptBR).join('\n');
    expect(all).not.toMatch(/Torneio|Rejeitar|\bemail\b|\bEmail\b/);
  });
});
