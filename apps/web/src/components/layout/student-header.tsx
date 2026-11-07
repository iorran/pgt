import { useSession } from '@/lib/auth-client';

export function StudentHeader() {
  const { data: session } = useSession();
  const user = session?.user as { name?: string } | undefined;
  const userName = user?.name ?? '';

  return (
    <header
      className="sticky top-0 z-40 flex min-h-[calc(3.5rem+env(safe-area-inset-top))] items-center justify-between gap-3 border-b border-border bg-[color:var(--pgt-green)] px-4 text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex shrink-0 items-center gap-2">
        <img
          src="/pwa-192.png"
          alt=""
          aria-hidden
          className="h-8 w-8 rounded-full"
        />
        <span className="font-display text-2xl leading-none">PGT</span>
      </div>
      {userName ? (
        <span className="min-w-0 font-heading text-sm uppercase tracking-wide line-clamp-2 break-words text-right">
          {userName}
        </span>
      ) : null}
    </header>
  );
}
