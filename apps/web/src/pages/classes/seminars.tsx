import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { api } from '@/lib/api';
import { errorKey } from '@/lib/api-errors';
import { toast } from '@/lib/toast';
import { formatMoney, todayYmd } from '@/lib/format';
import { useApiQuery } from '@/hooks/use-api';
import type { ClassItem, ClassTeacher } from '@/lib/schedule';
import { ClassesTabs } from '@/components/schedule/classes-tabs';
import { PageLoader } from '@/components/page-loader';
import { TeacherLine } from '@/components/schedule/class-timeline';
import { ClassCreateDialog, type ClassCreateValues } from '@/components/schedule/class-create-dialog';
import { SeminarSignup } from '@/components/schedule/seminar-signup';

// A Seminar with the Owner's totals, from GET /api/seminars.
export interface SeminarSummary {
  classId: string;
  name: string;
  date: string;
  startTime: string;
  endTime: string;
  teacher: ClassTeacher | null;
  guestTeacherName: string | null;
  participants: number;
  paidCount: number;
  received: string;
  pending: string;
}

// "SEX / 13 / NOV": the Seminar's date at a glance.
function DateBlock({ date }: { date: string }) {
  const { i18n } = useTranslation();
  const d = new Date(`${date}T00:00`);
  const part = (opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(i18n.language, opts).replace('.', '');
  return (
    <span className="flex w-13 shrink-0 flex-col items-center rounded-sm bg-seminar/10 py-1.5 font-heading uppercase leading-tight text-seminar">
      <span className="text-xs">{part({ weekday: 'short' })}</span>
      <span className="text-2xl">{d.getDate()}</span>
      <span className="text-xs">{part({ month: 'short' })}</span>
    </span>
  );
}

function SeminarRow({
  date,
  name,
  startTime,
  endTime,
  teacher,
  guestTeacherName,
  children,
}: {
  date: string;
  name: string;
  startTime: string;
  endTime: string;
  teacher?: ClassTeacher | null;
  guestTeacherName?: string | null;
  children?: ReactNode;
}) {
  return (
    <>
      <DateBlock date={date} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-heading text-lg uppercase leading-tight">{name}</span>
        <span className="text-sm text-foreground/80">
          {startTime.slice(0, 5)} – {endTime.slice(0, 5)}
        </span>
        <TeacherLine teacher={teacher} guestTeacherName={guestTeacherName} />
        {children}
      </span>
    </>
  );
}

function OwnerSeminars() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const { data: seminars = [], isLoading } = useApiQuery<SeminarSummary[]>(['seminars'], '/seminars');

  async function createSeminar(values: ClassCreateValues) {
    try {
      await api('/classes', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          type: values.type,
          recurrence: 'once',
          date: values.date,
          startTime: values.startTime,
          endTime: values.endTime,
          teacherId: values.teacherId,
          guestTeacherName: values.guestTeacherName,
          academyId: user.academyId,
          isSeminar: true,
          studentPrice: values.studentPrice,
          outsiderPrice: values.outsiderPrice,
        }),
      });
    } catch (err) {
      toast.error(t(errorKey(err)));
      throw err;
    }
    queryClient.invalidateQueries({ queryKey: ['seminars'] });
    queryClient.invalidateQueries({ queryKey: ['classes', user.academyId] });
    toast.success(t('seminars.created'));
    setCreateOpen(false);
  }

  if (isLoading) {
    return <PageLoader />;
  }

  const today = todayYmd();
  const upcoming = seminars.filter((s) => s.date >= today);
  const past = seminars.filter((s) => s.date < today).reverse();
  const money = (v: string) => formatMoney(v, i18n.language);

  const row = (s: SeminarSummary) => (
    <li key={s.classId}>
      <Link
        to={`/classes/seminars/${s.classId}`}
        className="flex items-center gap-3 rounded-sm border border-seminar bg-card p-3 text-foreground no-underline transition-colors hover:bg-muted/50"
      >
        <SeminarRow {...s}>
          {s.participants === 0 ? (
            <span className="text-sm text-muted-foreground">{t('seminars.noParticipantsYet')}</span>
          ) : (
            <span className="text-sm">
              <span className="text-success-text">{t('seminars.receivedAmount', { amount: money(s.received) })}</span>
              {' · '}
              <span className="text-seminar">{t('seminars.pendingAmount', { price: money(s.pending) })}</span>
              {' · '}
              {t('seminars.people', { count: s.participants })}
            </span>
          )}
        </SeminarRow>
        <ChevronRight className="size-5 shrink-0 text-seminar" aria-hidden />
      </Link>
    </li>
  );

  return (
    <div className="space-y-5">
      <ClassesTabs />
      <ClassCreateDialog seminar open={createOpen} onOpenChange={setCreateOpen} onSubmit={createSeminar} />
      <h2 id="seminars-upcoming" className="font-heading text-sm uppercase tracking-wider text-muted-foreground">
        {t('seminars.upcoming')}
      </h2>
      {upcoming.length === 0 ? (
        <p className="text-muted-foreground">{t('seminars.noneUpcoming')}</p>
      ) : (
        <ul aria-labelledby="seminars-upcoming" className="flex flex-col gap-2">
          {upcoming.map(row)}
        </ul>
      )}
      {past.length > 0 && (
        <details className="border-t border-border pt-2">
          <summary className="flex min-h-11 cursor-pointer items-center font-heading text-sm uppercase tracking-wider text-muted-foreground">
            {t('seminars.past', { count: past.length })}
          </summary>
          <ul className="flex flex-col gap-2 pt-2">{past.map(row)}</ul>
        </details>
      )}
    </div>
  );
}

function StudentSeminars() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const { data: classes = [], isLoading } = useApiQuery<ClassItem[]>(
    ['classes', user?.academyId],
    `/classes?academyId=${user?.academyId}`,
    !!user?.academyId,
  );
  if (isLoading) {
    return <PageLoader />;
  }
  const today = todayYmd();
  const upcoming = classes
    .filter((c) => c.isSeminar && c.date && c.date >= today)
    .sort((a, b) => a.date!.localeCompare(b.date!) || a.startTime.localeCompare(b.startTime));

  return (
    <div className="space-y-5">
      <ClassesTabs />
      <p className="text-sm text-muted-foreground">{t('seminars.sectionHint')}</p>
      <h2 id="seminars-upcoming" className="sr-only">
        {t('seminars.upcoming')}
      </h2>
      {upcoming.length === 0 ? (
        <p className="text-muted-foreground">{t('seminars.noneUpcoming')}</p>
      ) : (
        <ul aria-labelledby="seminars-upcoming" className="flex flex-col gap-2">
          {upcoming.map((cls) => (
            <li key={cls.id} className="flex flex-col gap-3 rounded-sm border border-seminar bg-card p-3">
              <span className="flex items-start gap-3">
                <SeminarRow {...cls} date={cls.date!} />
              </span>
              <SeminarSignup cls={cls} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The "Seminários" tab of Aulas: the Owner manages them, a Student signs up (ADR 0005).
export default function SeminarsPage() {
  const { data: session } = useSession();
  return isOwner(session?.user as any) ? <OwnerSeminars /> : <StudentSeminars />;
}
