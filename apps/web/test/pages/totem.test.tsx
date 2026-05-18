import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../render';
import TotemPage from '@/pages/totem';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

vi.mock('qrcode.react', () => ({
  QRCodeSVG: ({ value }: { value: string }) => <div data-testid="qr-code">{value}</div>,
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const instructorSession = {
  data: { user: { id: 'u1', name: 'Instructor', role: 'owner', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('TotemPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(instructorSession);
  });

  it('shows active classes with QR codes', async () => {
    mockApi.mockResolvedValue([
      { classId: 'c1', className: 'Morning Gi', classType: 'gi', startTime: '07:00', endTime: '08:30', token: 'token-1', expiresAt: '2026-04-07T07:35:00Z' },
    ] as any);

    renderWithProviders(<TotemPage />);
    expect(await screen.findByText('Morning Gi')).toBeInTheDocument();
    expect(screen.getByTestId('qr-code')).toBeInTheDocument();
  });

  it('shows no classes message when empty', async () => {
    mockApi.mockResolvedValue([] as any);

    renderWithProviders(<TotemPage />);
    expect(await screen.findByText('totem.noClasses')).toBeInTheDocument();
  });

  it('shows multiple active classes', async () => {
    mockApi.mockResolvedValue([
      { classId: 'c1', className: 'Morning Gi', classType: 'gi', startTime: '07:00', endTime: '08:30', token: 'token-1', expiresAt: '2026-04-07T07:35:00Z' },
      { classId: 'c2', className: 'Kids BJJ', classType: 'kids', startTime: '07:00', endTime: '08:00', token: 'token-2', expiresAt: '2026-04-07T07:35:00Z' },
    ] as any);

    renderWithProviders(<TotemPage />);
    expect(await screen.findByText('Morning Gi')).toBeInTheDocument();
    expect(screen.getByText('Kids BJJ')).toBeInTheDocument();
    expect(screen.getAllByTestId('qr-code')).toHaveLength(2);
  });
});
