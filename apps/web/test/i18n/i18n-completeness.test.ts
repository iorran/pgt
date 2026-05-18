import { describe, it, expect } from 'vitest';
import ptBR from '@/i18n/pt-BR.json';
import en from '@/i18n/en.json';

describe('i18n completeness', () => {
  // Bug 1: billing.week
  describe('billing.week', () => {
    it('exists in pt-BR and is a non-empty string', () => {
      expect((ptBR as any).billing.week).toBeTruthy();
      expect(typeof (ptBR as any).billing.week).toBe('string');
    });

    it('exists in en and is a non-empty string', () => {
      expect((en as any).billing.week).toBeTruthy();
      expect(typeof (en as any).billing.week).toBe('string');
    });
  });

  // Bug 2: settings.geolocationUnavailable
  describe('settings.geolocationUnavailable', () => {
    it('exists in pt-BR and is a non-empty string', () => {
      expect((ptBR as any).settings?.geolocationUnavailable).toBeTruthy();
      expect(typeof (ptBR as any).settings?.geolocationUnavailable).toBe('string');
    });

    it('exists in en and is a non-empty string', () => {
      expect((en as any).settings?.geolocationUnavailable).toBeTruthy();
      expect(typeof (en as any).settings?.geolocationUnavailable).toBe('string');
    });
  });

  // Bug 3: pt-BR onboarding accent corrections
  describe('pt-BR onboarding accents', () => {
    it('onboarding.chooseRole has correct accent', () => {
      expect((ptBR as any).onboarding.chooseRole).toBe('Como deseja começar?');
    });

    it('onboarding.haveCode has correct accent', () => {
      expect((ptBR as any).onboarding.haveCode).toBe('Tenho um código');
    });

    it('onboarding.haveCodeDesc has correct accent', () => {
      expect((ptBR as any).onboarding.haveCodeDesc).toBe('Sou aluno e recebi um código da minha academia');
    });

    it('onboarding.enterCode has correct accent', () => {
      expect((ptBR as any).onboarding.enterCode).toBe('Digite o código da academia');
    });

    it('onboarding.academyNotFound has correct accent', () => {
      expect((ptBR as any).onboarding.academyNotFound).toBe('Academia não encontrada');
    });

    it('onboarding.waitingTitle has correct accent', () => {
      expect((ptBR as any).onboarding.waitingTitle).toBe('Aguardando Aprovação');
    });

    it('onboarding.waitingMessage has correct accent', () => {
      expect((ptBR as any).onboarding.waitingMessage).toContain('irá');
    });

    it('onboarding.joinCode has correct accent', () => {
      expect((ptBR as any).onboarding.joinCode).toBe('Código de Acesso');
    });
  });

  // Bug 4: dashboard.greeting
  describe('dashboard.greeting', () => {
    it('exists in pt-BR and contains {{name}}', () => {
      expect((ptBR as any).dashboard?.greeting).toBeTruthy();
      expect((ptBR as any).dashboard?.greeting).toContain('{{name}}');
    });

    it('exists in en and contains {{name}}', () => {
      expect((en as any).dashboard?.greeting).toBeTruthy();
      expect((en as any).dashboard?.greeting).toContain('{{name}}');
    });
  });
});
