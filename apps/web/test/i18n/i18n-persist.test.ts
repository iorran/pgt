import { describe, it, expect, beforeEach, vi } from 'vitest';

// Global setup mocks react-i18next; this test needs the real plugin.
vi.unmock('react-i18next');

describe('language persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('starts in the saved language and remembers changes', async () => {
    localStorage.setItem('pgt-lang', 'en');
    const { default: i18n } = await import('@/i18n');
    expect(i18n.language).toBe('en');
    await i18n.changeLanguage('pt-BR');
    expect(localStorage.getItem('pgt-lang')).toBe('pt-BR');
  });

  it('defaults to pt-BR', async () => {
    const { default: i18n } = await import('@/i18n');
    expect(i18n.language).toBe('pt-BR');
  });
});

describe('document language', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it('sets <html lang> on init and on language change', async () => {
    document.documentElement.lang = '';
    const { default: i18n } = await import('@/i18n');
    expect(document.documentElement.lang).toBe('pt-BR');
    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
  });
});
