import { createAuthClient } from 'better-auth/react';
import { useMemo } from 'react';
import { clearProfile, getActingAs } from './profile';

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_API_URL || '',
  fetchOptions: {
    credentials: 'include',
  },
});

export const { signIn, signUp } = authClient;
export const forgetPassword = authClient.requestPasswordReset;
export const resetPassword = authClient.resetPassword;

// While a Responsible uses a Dependent's profile, every screen sees the Dependent as the user
// (ADR 0004); the real login stays available as actorId / actorRole.
export function useSession() {
  const result = authClient.useSession();
  const actingAs = getActingAs();
  const actingId = actingAs?.id;
  const data = useMemo(() => {
    const session = result.data;
    if (!session) {
      return session;
    }
    const user = session.user as typeof session.user & { role?: string };
    const actor = { actorId: user.id, actorRole: user.role };
    if (!actingAs || actingAs.id === user.id) {
      return { ...session, user: { ...user, ...actor } };
    }
    return {
      ...session,
      user: { ...user, ...actor, id: actingAs.id, name: actingAs.name, belt: actingAs.belt, image: actingAs.image, role: 'student' },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.data, actingId]);
  return { ...result, data };
}

export function signOut(...args: Parameters<typeof authClient.signOut>) {
  clearProfile();
  return authClient.signOut(...args);
}
