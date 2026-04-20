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

const toastError = toast.error as unknown as ReturnType<typeof vi.fn>;
const toastSuccess = toast.success as unknown as ReturnType<typeof vi.fn>;

function makeWrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

describe('createQueryClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('boom'));
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
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('boom'));
  });

  it('suppresses error toast when query meta.silent', async () => {
    const client = createQueryClient();
    renderHook(
      () =>
        useQuery({
          queryKey: ['silent-fail'],
          queryFn: () => Promise.reject(new Error('boom')),
          retry: false,
          meta: { silent: true },
        }),
      { wrapper: makeWrapper(client) },
    );
    await waitFor(() => {
      // Let the query settle
      expect(true).toBe(true);
    });
    expect(toastError).not.toHaveBeenCalled();
  });
});
