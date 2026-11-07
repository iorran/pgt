import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { wasProfileChosen } from '@/lib/profile';

export function StudentHeader() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as { name?: string } | undefined;
  const userName = user?.name ?? '';
  // The picker only ran for a Family's Responsible, so this marks a login with several profiles.
  const canSwitch = wasProfileChosen();

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
      <div className="flex min-w-0 items-center gap-3">
        {userName ? (
          <span className="font-heading text-sm uppercase tracking-wide truncate">
            {userName}
          </span>
        ) : null}
        {canSwitch && (
          <Link
            to="/perfis"
            className="shrink-0 rounded-sm border border-white/40 px-2 py-1 text-xs uppercase tracking-wide text-white no-underline hover:bg-white/10"
          >
            {t('profiles.switch')}
          </Link>
        )}
      </div>
    </header>
  );
}
