import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import React from 'react';
import { createQueryClient } from '@/lib/query-client';
import { toast } from '@/lib/toast';
import i18next from 'i18next';

const toastError = toast.error as unknown as ReturnType<typeof vi.fn>;
const toastSuccess = toast.success as unknown as ReturnType<typeof vi.fn>;

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('createQueryClient', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18next.init({ lng: 'cimode' });
  });

  it('dispatches error toast on failed mutation', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => Promise.reject(new Error('boom')),
        }),
      { wrapper: makeWrapper(client) },
    );
    result.current.mutate();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('common.genericError'));
  });

  it('translates known API error codes on failed mutation', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => Promise.reject(new Error('CHECKIN_DUPLICATE')),
        }),
      { wrapper: makeWrapper(client) },
    );
    result.current.mutate();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('classes.checkinDuplicate'));
  });

  it.each(['SEMINAR_NOT_FOUND', 'PARTICIPANT_NOT_FOUND'])('refetches queries when a mutation hits %s', async (code) => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useMutation({ mutationFn: () => Promise.reject(new Error(code)) }), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate();
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it('does not refetch on other mutation errors', async () => {
    const client = createQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useMutation({ mutationFn: () => Promise.reject(new Error('boom')) }), {
      wrapper: makeWrapper(client),
    });
    result.current.mutate();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('suppresses error toast when mutation meta.silent', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => Promise.reject(new Error('boom')),
          meta: { silent: true },
        }),
      { wrapper: makeWrapper(client) },
    );
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).not.toHaveBeenCalled();
  });

  it('dispatches success toast when mutation meta.successMessage set', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useMutation({
          mutationFn: () => Promise.resolve('ok'),
          meta: { successMessage: 'Saved!' },
        }),
      { wrapper: makeWrapper(client) },
    );
    result.current.mutate();
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Saved!'));
  });

  it('dispatches error toast on failed query', async () => {
    const client = createQueryClient();
    renderHook(
      () =>
        useQuery({
          queryKey: ['fail'],
          queryFn: () => Promise.reject(new Error('boom')),
          retry: false,
        }),
      { wrapper: makeWrapper(client) },
    );
    // Raw (often English) API messages are replaced by a translated generic one.
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith('common.genericError', {
        action: { label: 'common.retry', onClick: expect.any(Function) },
      }),
    );
  });

  it('retries the failed query from the toast action', async () => {
    const client = createQueryClient();
    const queryFn = vi.fn(() => Promise.reject(new Error('boom')));
    renderHook(() => useQuery({ queryKey: ['retry-fail'], queryFn, retry: false }), {
      wrapper: makeWrapper(client),
    });
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    toastError.mock.calls[0][1].action.onClick();
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
  });

  it('suppresses error toast when query meta.silent', async () => {
    const client = createQueryClient();
    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['silent-fail'],
          queryFn: () => Promise.reject(new Error('boom')),
          retry: false,
          meta: { silent: true },
        }),
      { wrapper: makeWrapper(client) },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toastError).not.toHaveBeenCalled();
  });
});
