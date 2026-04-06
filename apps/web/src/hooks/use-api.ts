import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useApiQuery<T>(key: string[], path: string, enabled = true) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => api<T>(path),
    enabled,
  });
}

export function useApiMutation<TBody = any, TResponse = any>(
  path: string,
  method: 'POST' | 'PUT' | 'DELETE' = 'POST',
) {
  const queryClient = useQueryClient();
  return useMutation<TResponse, Error, TBody>({
    mutationFn: (body) =>
      api<TResponse>(path, {
        method,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
