import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithRoute } from '../render';
import CheckinScanPage from '@/pages/checkin-scan';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

const mockUseSession = vi.mocked(useSession);
const mockApi = vi.mocked(api);

const studentSession = {
  data: { user: { id: 'u1', name: 'Student', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('CheckinScanPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSession.mockReturnValue(studentSession);
  });

  it('calls checkin API with token from URL', async () => {
    mockApi.mockResolvedValue({ success: true } as any);

    renderWithRoute(<CheckinScanPage />, ['/checkin?token=abc123&classId=c1']);

    await waitFor(() => {
      expect(mockApi).toHaveBeenCalledWith('/checkins', {
        method: 'POST',
        body: JSON.stringify({ classId: 'c1', source: 'qr', token: 'abc123' }),
      });
    });
  });

  it('shows success message after checkin', async () => {
    mockApi.mockResolvedValue({ success: true } as any);

    renderWithRoute(<CheckinScanPage />, ['/checkin?token=abc123&classId=c1']);

    expect(await screen.findByText('classes.checkinSuccess')).toBeInTheDocument();
  });

  it('shows error message on failure', async () => {
    mockApi.mockRejectedValue(new Error('CHECKIN_DUPLICATE'));

    renderWithRoute(<CheckinScanPage />, ['/checkin?token=abc123&classId=c1']);

    expect(await screen.findByText('CHECKIN_DUPLICATE')).toBeInTheDocument();
  });
});
