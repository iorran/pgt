import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useApiQuery } from '@/hooks/use-api';
import { Card } from '@/components/ui/card';

// Query keys/paths mirror the screens that own the data, so the cache is shared.
function useHasAny(key: string[], path: string) {
  const { data, isLoading } = useApiQuery<unknown[]>(key, path);
  return { done: Array.isArray(data) && data.length > 0, isLoading };
}

export function SetupChecklist() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const academyId = (session?.user as any)?.academyId;

  const steps = [
    {
      id: 'modality',
      to: '/settings',
      help: 'Primeiros Passos',
      ...useHasAny(['modalities'], '/modalities'),
    },
    {
      id: 'class',
      to: '/classes',
      help: 'Aulas',
      ...useHasAny(['classes', academyId], `/classes?academyId=${academyId}`),
    },
    {
      id: 'student',
      to: '/students',
      help: 'Gerenciando Alunos',
      ...useHasAny(['students', academyId], `/students?academyId=${academyId}`),
    },
    {
      id: 'checkin',
      to: '/totem',
      help: 'Sistema de Check-in',
      ...useHasAny(['checkins', 'academy'], '/checkins/academy'),
    },
  ];

  if (steps.some((s) => s.isLoading) || steps.every((s) => s.done)) {
    return null;
  }

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold">{t('setupChecklist.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('setupChecklist.subtitle')}</p>
      <ol className="mt-3 space-y-2">
        {steps.map((s) => (
          <li
            key={s.id}
            data-testid={`setup-step-${s.id}`}
            data-done={s.done}
            className="flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            {s.done ? (
              <CheckCircle2 className="size-5 text-primary" aria-label={t('setupChecklist.done')} />
            ) : (
              <Circle className="size-5 text-muted-foreground" aria-label={t('setupChecklist.pending')} />
            )}
            <Link to={s.to} className={s.done ? 'text-muted-foreground line-through' : 'font-medium'}>
              {t(`setupChecklist.steps.${s.id}`)}
            </Link>
            <Link
              to={`/ajuda#${encodeURIComponent(s.help)}`}
              className="text-sm text-muted-foreground underline"
            >
              {t('setupChecklist.howTo')}
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
