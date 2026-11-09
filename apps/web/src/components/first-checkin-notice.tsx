import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useSession } from '@/lib/auth-client';

const GUIDE_LINK = `/ajuda?guia=aluno#${encodeURIComponent('Fazer Check-in nas Aulas')}`;

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** One-time nudge for a newly approved student; the caller renders it only while they have zero check-ins. */
export function FirstCheckinNotice() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const storageKey = `pgt.firstCheckinNotice.dismissed.${userId}`;
  const [dismissed, setDismissed] = useState(() => readDismissed(storageKey));

  if (dismissed) {
    return null;
  }

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // Storage blocked: hide for this visit only.
    }
  }

  return (
    <section className="relative rounded-lg border border-primary/30 bg-primary/10 p-4 pr-12 text-sm">
      <h2 className="font-heading text-base uppercase text-foreground">{t('firstAccess.noticeTitle')}</h2>
      <p className="mt-1 text-muted-foreground">{t('firstAccess.noticeBody')}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
        <Link to="/checkin" className="font-medium text-primary underline underline-offset-2">
          {t('firstAccess.noticeCheckin')}
        </Link>
        <Link to={GUIDE_LINK} className="font-medium text-primary underline underline-offset-2">
          {t('firstAccess.noticeGuide')}
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('firstAccess.noticeDismiss')}
        className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-4" aria-hidden />
      </button>
    </section>
  );
}
