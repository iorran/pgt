import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft } from 'lucide-react';

export function SubpageHeader({ title, to = '/me' }: { title: string; to?: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2">
      <Link
        to={to}
        aria-label={t('common.back')}
        className="-ml-3 flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-6" aria-hidden />
      </Link>
      <h1 className="font-heading text-2xl uppercase tracking-wide">{title}</h1>
    </div>
  );
}
