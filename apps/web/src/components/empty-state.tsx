import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  /** Heading (## or ###) in the owner guide; only the owner can read it. */
  help?: string;
  /** Heading in the student guide; everyone can read it. */
  studentHelp?: string;
}

function helpHref(owner: boolean, help?: string, studentHelp?: string) {
  if (owner && help) {
    return `/ajuda#${encodeURIComponent(help)}`;
  }
  if (!studentHelp) {
    return null;
  }
  // Non-owners only ever see the student guide, so they need no ?guia.
  return `/ajuda${owner ? '?guia=aluno' : ''}#${encodeURIComponent(studentHelp)}`;
}

export function EmptyState({ icon: Icon, title, description, action, help, studentHelp }: EmptyStateProps) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const href = helpHref(isOwner(session?.user), help, studentHelp);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
      {Icon && <Icon className="size-12" aria-hidden />}
      <h2 className="text-lg font-heading text-foreground">{title}</h2>
      <p className="max-w-md text-sm">{description}</p>
      {action}
      {href && (
        <Link to={href} className="text-sm text-primary underline underline-offset-2">
          {t('emptyState.learnMore')}
        </Link>
      )}
    </div>
  );
}
