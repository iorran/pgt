import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleHelp } from 'lucide-react';
import { helpSectionFor, type GuideKind } from '@/lib/guide';

// The "?" in the header: opens the user guide at the section for the current screen.
export function HelpLink({ guide, className }: { guide: GuideKind; className?: string }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const section = helpSectionFor(pathname, guide);

  return (
    <Link
      to={section ? `/ajuda#${encodeURIComponent(section)}` : '/ajuda'}
      aria-label={t('help.title')}
      title={t('help.title')}
      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-sm no-underline transition-colors ${className ?? ''}`}
    >
      <CircleHelp className="size-5" aria-hidden />
    </Link>
  );
}
