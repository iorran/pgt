import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Profile } from '@/lib/profile';

export interface ProfilesResponse {
  actorId: string;
  currentId: string;
  self: Profile | null;
  dependents: Profile[];
}

export function useProfiles(enabled = true) {
  return useQuery<ProfilesResponse>({
    queryKey: ['profiles'],
    queryFn: () => api<ProfilesResponse>('/me/profiles'),
    enabled,
    meta: { silent: true },
  });
}
