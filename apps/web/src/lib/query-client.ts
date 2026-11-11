import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import i18next from 'i18next';
import { toast } from '@/lib/toast';
import { errorKey, isGone } from '@/lib/api-errors';

export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
      },
    },
    queryCache: new QueryCache({
      onError: (_err, query) => {
        if (query.meta?.silent) {
          return;
        }
        // Query failures carry raw API text; show a translated generic message instead.
        // A failed retry toasts again through this handler.
        toast.error(i18next.t('common.genericError'), {
          action: {
            label: i18next.t('common.retry'),
            onClick: () => query.fetch().catch(() => {}),
          },
        });
      },
    }),
    mutationCache: new MutationCache({
      onError: (err, _vars, _ctx, mutation) => {
        if (isGone(err)) {
          client.invalidateQueries();
        }
        if (mutation.meta?.silent) {
          return;
        }
        toast.error(i18next.t(errorKey(err)));
      },
      onSuccess: (_data, _vars, _ctx, mutation) => {
        const msg = mutation.meta?.successMessage as string | undefined;
        if (msg) toast.success(msg);
      },
    }),
  });
  return client;
}
