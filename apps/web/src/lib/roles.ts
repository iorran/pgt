type MaybeUser = { role?: string | null } | null | undefined;

export function isOwner(user: MaybeUser): boolean {
  return (user?.role ?? '') === 'owner';
}

export function isStudent(user: MaybeUser): boolean {
  return (user?.role ?? '') === 'student';
}
