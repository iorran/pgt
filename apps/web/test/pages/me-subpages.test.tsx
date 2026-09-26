import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../render';
import BillingStatusPage from '@/pages/me/billing-status';
import ThemePage from '@/pages/me/theme';
import LanguagePage from '@/pages/me/language';

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { api } from '@/lib/api';

const mockApi = vi.mocked(api);

describe('BillingStatusPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads /payments/my-status and shows overdue with days', async () => {
    mockApi.mockResolvedValue({ status: 'overdue', daysOverdue: 12 } as any);
    renderWithProviders(<BillingStatusPage />);
    expect(await screen.findByText('me.billingOverdue')).toBeInTheDocument();
    expect(screen.getByText('billing.yourPaymentOverdue')).toBeInTheDocument();
    expect(mockApi).toHaveBeenCalledWith('/payments/my-status');
    expect(screen.queryByText('me.billingUpToDate')).not.toBeInTheDocument();
  });

  it('shows up to date when status is ok', async () => {
    mockApi.mockResolvedValue({ status: 'ok' } as any);
    renderWithProviders(<BillingStatusPage />);
    expect(await screen.findByText('me.billingUpToDate')).toBeInTheDocument();
  });

  it('shows an error state instead of "up to date" when the request fails', async () => {
    mockApi.mockRejectedValue(new Error('Not Found'));
    renderWithProviders(<BillingStatusPage />);
    expect(await screen.findByText('me.billingError')).toBeInTheDocument();
    expect(screen.queryByText('me.billingUpToDate')).not.toBeInTheDocument();
  });

  it('has an h1 and a back link to /me', async () => {
    mockApi.mockResolvedValue({ status: 'ok' } as any);
    renderWithProviders(<BillingStatusPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'me.billingStatus' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'common.back' })).toHaveAttribute('href', '/me');
  });
});

describe('ThemePage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exposes options as a radiogroup with aria-checked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'me.theme' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'common.back' })).toHaveAttribute('href', '/me');
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'me.themeSystem' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'me.themeDark' }));
    expect(screen.getByRole('radio', { name: 'me.themeDark' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'me.themeSystem' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('LanguagePage', () => {
  it('lets the user pick PT or EN from a radiogroup', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LanguagePage />);
    expect(screen.getByRole('heading', { level: 1, name: 'me.language' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'common.back' })).toHaveAttribute('href', '/me');
    expect(screen.getByRole('radio', { name: 'me.languagePortuguese' })).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('radio', { name: 'me.languageEnglish' }));
    expect(screen.getByRole('radio', { name: 'me.languageEnglish' })).toHaveAttribute('aria-checked', 'true');
  });
});
