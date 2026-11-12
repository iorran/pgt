import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useApiQuery } from '@/hooks/use-api';
import { formatList, formatMoney, formatMonth, shiftMonth, todayYmd } from '@/lib/format';
import { SubpageHeader } from '@/components/subpage-header';

// What a teacher on a Teacher Agreement sees (ADR 0006): who is in it and whether they paid, never amounts.
export type MyAgreement = {
  agreement: { id: string; name: string; teachers: { id: string; name: string }[] };
  month: string;
  confirmed: string | null;
  students: { studentId: string; name: string; kind: 'addOn' | 'recruited'; checkins: number; paid: boolean }[];
};

export function useMyAgreements(month: string) {
  return useApiQuery<MyAgreement[]>(['my-agreements', month], `/me/agreements?month=${month}`);
}

export const thisMonth = () => todayYmd().slice(0, 7);

export default function TeacherAgreementPage() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [month, setMonth] = useState(thisMonth);
  const { data, isLoading } = useMyAgreements(month);
  const entry = data?.find((a) => a.agreement.id === id);
  const atCurrent = month >= thisMonth();
  const button =
    'inline-flex size-11 items-center justify-center rounded-md text-foreground hover:bg-muted disabled:text-muted-foreground/40 disabled:hover:bg-transparent';

  return (
    <div className="flex flex-col gap-4">
      <SubpageHeader title={t('teacherAgreement.title', { name: entry?.agreement.name ?? '' })} />
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label={t('finance.prevMonth')}
          className={button}
          onClick={() => setMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <p aria-live="polite" className="font-heading text-xl uppercase">
          {formatMonth(month, i18n.language)}
        </p>
        <button
          type="button"
          aria-label={t('finance.nextMonth')}
          className={button}
          disabled={atCurrent}
          onClick={() => setMonth(shiftMonth(month, 1))}
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : !entry ? (
        <p className="text-sm text-muted-foreground">{t('teacherAgreement.empty')}</p>
      ) : (
        <>
          <section className="flex flex-col gap-1 rounded-xl bg-card p-4">
            <span className="text-sm text-muted-foreground">
              {t('teacherAgreement.payout', {
                teachers: formatList(
                  entry.agreement.teachers.map((tc) => tc.name),
                  i18n.language,
                ),
              })}
            </span>
            {entry.confirmed !== null ? (
              <>
                <span className="font-mono text-3xl font-bold text-primary">
                  {formatMoney(entry.confirmed, i18n.language)}
                </span>
                <span className="flex items-center gap-1.5 text-sm font-semibold text-success-text">
                  <Check className="size-4" aria-hidden />
                  {t('teacherAgreement.confirmedBy')}
                </span>
              </>
            ) : (
              <>
                <span className="font-heading text-xl">{t('teacherAgreement.notConfirmed')}</span>
                <span className="text-sm text-muted-foreground">{t('teacherAgreement.notConfirmedHint')}</span>
              </>
            )}
          </section>
          <StudentGroup
            title={t('teacherAgreement.recruited', {
              count: entry.students.filter((s) => s.kind === 'recruited').length,
            })}
            students={entry.students.filter((s) => s.kind === 'recruited')}
          />
          <StudentGroup
            title={t('teacherAgreement.addOn', {
              name: entry.agreement.name,
              count: entry.students.filter((s) => s.kind === 'addOn').length,
            })}
            students={entry.students.filter((s) => s.kind === 'addOn')}
          />
        </>
      )}
    </div>
  );
}

function StudentGroup({ title, students }: { title: string; students: MyAgreement['students'] }) {
  const { t } = useTranslation();
  if (students.length === 0) {
    return null;
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-heading text-sm uppercase tracking-wide text-muted-foreground">{title}</h2>
      <ul aria-label={title} className="flex flex-col divide-y divide-border rounded-xl bg-card">
        {students.map((s) => (
          <li key={s.studentId} className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
            <span>{s.name}</span>
            <span className="flex shrink-0 gap-3 text-sm">
              <span className="text-muted-foreground">{t('teacherAgreement.checkins', { count: s.checkins })}</span>
              <span className={s.paid ? 'font-semibold text-success-text' : 'font-semibold text-warning-text'}>
                {s.paid ? t('teacherAgreement.paid') : t('teacherAgreement.pending')}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
