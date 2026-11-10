import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';

// Back + title for any page that isn't a bottom-nav tab. Goes back in history when the
// user navigated here; a direct link or PWA open has none, so `to` is the fallback.
export function SubpageHeader({
  title,
  to = '/me',
  className = '',
}: {
  title: string;
  to?: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // The first entry of a session has the "default" key: nothing in-app to go back to.
  const hasHistory = useLocation().key !== 'default';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Link
        to={to}
        onClick={(e) => {
          if (hasHistory) {
            e.preventDefault();
            navigate(-1);
          }
        }}
        aria-label={t('common.back')}
        className="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-6" aria-hidden />
      </Link>
      <h1 className="font-heading text-2xl uppercase tracking-wide">{title}</h1>
    </div>
  );
}
