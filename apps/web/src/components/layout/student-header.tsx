import { useSession } from '@/lib/auth-client';
import { NotificationBell } from '@/components/notification-bell';

export function StudentHeader() {
  const { data: session } = useSession();
  const user = session?.user as { academyName?: string } | undefined;
  const academyName = user?.academyName ?? '';

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-[color:var(--pgt-green)] px-4 text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center gap-2">
        <img
          src="/pwa-192.png"
          alt=""
          aria-hidden
          className="h-8 w-8 rounded-full"
        />
        <span className="font-display text-2xl leading-none">PGT</span>
      </div>
      {academyName ? (
        <span className="font-heading text-sm uppercase tracking-wide truncate">
          {academyName}
        </span>
      ) : null}
      <NotificationBell />
    </header>
  );
}
