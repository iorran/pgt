import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { renderWithRoute } from '../render';
import CheckinScanPage from '@/pages/checkin-scan';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(() => ({
    data: { user: { id: 'u1', role: 'student', academyId: 'a1' } },
    isPending: false,
  })),
}));

vi.mock('@/lib/api', () => ({ api: vi.fn() }));

const scanner = vi.hoisted(() => ({ mounts: 0 }));

vi.mock('@yudiel/react-qr-scanner', () => ({
  Scanner: ({ onError }: { onError: (e: unknown) => void }) => {
    useEffect(() => {
      scanner.mounts += 1;
      if (scanner.mounts === 1) {
        onError({ name: 'NotAllowedError' });
      }
    }, []);
    return <div data-testid="scanner" />;
  },
}));

describe('CheckinScanPage — camera denied', () => {
  beforeEach(() => {
    scanner.mounts = 0;
  });

  it('shows help text and a retry that remounts the scanner', async () => {
    const user = userEvent.setup();
    renderWithRoute(<CheckinScanPage />, ['/checkin']);
    expect(await screen.findByText('checkin.cameraDenied')).toBeInTheDocument();
    expect(screen.getByText('checkin.cameraDeniedHelp')).toBeInTheDocument();
    expect(screen.queryByTestId('scanner')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'checkin.retry' }));
    expect(await screen.findByTestId('scanner')).toBeInTheDocument();
    expect(scanner.mounts).toBe(2);
  });
});
