import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'pt-BR',
      changeLanguage: vi.fn(),
    },
  }),
  Trans: ({ children }: any) => children,
}));

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

vi.mock('@/lib/toast', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));
