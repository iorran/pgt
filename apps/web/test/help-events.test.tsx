import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderWithRoute } from './render';
import HelpPage from '@/pages/help';

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: vi.fn() }));
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';

function section(name: string) {
  return screen.getByText(name, { selector: 'summary *' }).closest('details')!;
}

function search(text: string) {
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: text } });
}

function posts() {
  return vi.mocked(api).mock.calls.filter(([path]) => path === '/help/events');
}

function body(i = 0) {
  return JSON.parse(posts()[i][1]!.body as string);
}

describe('help usage events', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(api).mockReset().mockResolvedValue(undefined);
    vi.mocked(useSession).mockReturnValue({ data: { user: { id: 'u1', role: 'student' } }, isPending: false } as any);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts a zero-result search once, after the user stops typing', () => {
    renderWithRoute(<HelpPage />, ['/ajuda']);
    search('xy');
    search('xyz');
    search('xyzzy  ');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(posts()).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(posts()).toHaveLength(1);
    expect(posts()[0][1]!.method).toBe('POST');
    expect(body()).toEqual({ type: 'search_miss', guide: 'student', value: 'xyzzy' });
  });

  it('posts nothing for a search with results or a 1-char query', () => {
    renderWithRoute(<HelpPage />, ['/ajuda']);
    search('trocar perfil');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    search('q');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(posts()).toHaveLength(0);
  });

  it('posts section_open when the user opens a section', () => {
    renderWithRoute(<HelpPage />, ['/ajuda']);
    const details = section('Conta da Família');
    details.open = true;
    fireEvent(details, new Event('toggle'));
    expect(body()).toEqual({ type: 'section_open', guide: 'student', value: 'Conta da Família' });
  });

  it('keeps working when the api fails', async () => {
    vi.mocked(api).mockRejectedValue(new Error('down'));
    renderWithRoute(<HelpPage />, ['/ajuda']);
    search('xyzzy');
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(posts()).toHaveLength(1);
    expect(screen.getByText('help.noResults')).toBeInTheDocument();
  });
});
