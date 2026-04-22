import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../render';
import ClassesPage from '@/pages/classes/index';

vi.mock('@/lib/auth-client', () => ({
  useSession: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));

vi.mock('@/pages/classes/instructor-view', () => ({
  InstructorClassesView: () => <div data-testid="instructor-view">instructor</div>,
}));

vi.mock('@/pages/classes/student-view', () => ({
  StudentClassesView: () => <div data-testid="student-view">student</div>,
}));

import { useSession } from '@/lib/auth-client';
const mockUseSession = vi.mocked(useSession);

const instructorSession = {
  data: { user: { id: 'u1', role: 'instructor', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

const studentSession = {
  data: { user: { id: 'u2', role: 'student', academyId: 'a1', status: 'active' } },
  isPending: false,
} as any;

describe('ClassesPage role router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders instructor view for instructors', () => {
    mockUseSession.mockReturnValue(instructorSession);
    renderWithProviders(<ClassesPage />);
    expect(screen.getByTestId('instructor-view')).toBeInTheDocument();
    expect(screen.queryByTestId('student-view')).not.toBeInTheDocument();
  });

  it('renders student view for students', () => {
    mockUseSession.mockReturnValue(studentSession);
    renderWithProviders(<ClassesPage />);
    expect(screen.getByTestId('student-view')).toBeInTheDocument();
    expect(screen.queryByTestId('instructor-view')).not.toBeInTheDocument();
  });
});
