import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';

export function PageLoader() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t('common.loading')} className="p-6 space-y-6">
      <div aria-hidden className="space-y-6">
        <Skeleton className="h-7 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
