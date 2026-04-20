import {
  QueryClient,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import { toast } from '@/lib/toast';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
    queryCache: new QueryCache({
      onError: (err, query) => {
        if (query.meta?.silent) return;
        toast.error((err as Error).message);
      },
    }),
    mutationCache: new MutationCache({
      onError: (err, _vars, _ctx, mutation) => {
        if (mutation.meta?.silent) return;
        toast.error((err as Error).message);
      },
      onSuccess: (_data, _vars, _ctx, mutation) => {
        const msg = mutation.meta?.successMessage as string | undefined;
        if (msg) toast.success(msg);
      },
    }),
  });
}
