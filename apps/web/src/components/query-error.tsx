import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

// Shown in place of an empty state when the list failed to load, so "nothing yet" never hides an error.
export function QueryError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
      <p className="text-muted-foreground">{t('common.genericError')}</p>
      <Button variant="outline" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}
