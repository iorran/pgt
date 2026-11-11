import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { formatMoney, todayYmd } from '@/lib/format';
import { useApiQuery } from '@/hooks/use-api';
import { Button } from '@/components/ui/button';
import type { ClassItem } from '@/lib/schedule';

export interface MySeminar {
  classId: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  teacher: { id: string; name: string; belt: string } | null;
  guestTeacherName: string | null;
  amount: string;
  paidAt: string | null;
}

// The Student's own Seminar sign-up: join at the Student price, or the status and a cancel while pending.
export function SeminarSignup({ cls }: { cls: ClassItem }) {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const { data: mySeminars = [] } = useApiQuery<MySeminar[]>(['my-seminars', user?.id], '/seminars/mine', !!user?.id);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['my-seminars'] });
  const join = useMutation({
    mutationFn: (classId: string) => api(`/seminars/${classId}/signup`, { method: 'POST' }),
    onSuccess: refresh,
    meta: { successMessage: t('seminars.joined') },
  });
  const cancel = useMutation({
    mutationFn: (classId: string) => api(`/seminars/${classId}/signup`, { method: 'DELETE' }),
    onSuccess: refresh,
    meta: { successMessage: t('seminars.cancelled') },
  });

  const money = (v: string) => formatMoney(v, i18n.language);
  const mine = mySeminars.find((s) => s.classId === cls.id);
  if (mine) {
    return (
      <span className="block space-y-2">
        <span className="flex flex-wrap items-center justify-between gap-x-3 rounded-sm bg-seminar/10 min-h-11 px-3 py-1 text-sm">
          <span>
            <strong className="text-seminar">{t('seminars.signedUp')}</strong> ·{' '}
            {mine.paidAt ? t('seminars.paid') : t('seminars.pendingAmount', { price: money(mine.amount) })}
          </span>
          {!mine.paidAt && (
            <Button variant="link" className="h-11 px-2 text-seminar" onClick={() => cancel.mutate(cls.id)}>
              {t('seminars.cancel')}
            </Button>
          )}
        </span>
        {!mine.paidAt && <span className="block text-xs text-muted-foreground">{t('seminars.payAtAcademy')}</span>}
      </span>
    );
  }
  if (!cls.date || cls.date < todayYmd()) {
    return null;
  }
  return (
    <Button
      className="h-11 w-full bg-seminar text-seminar-foreground hover:bg-seminar/90"
      loading={join.isPending}
      onClick={() => join.mutate(cls.id)}
    >
      {t('seminars.join', { price: money(cls.studentPrice ?? '0') })}
    </Button>
  );
}
