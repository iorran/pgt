import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, MessageCircle, Mail, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { toast } from '@/lib/toast';
import { formatMoney } from '@/lib/format';

interface OverdueStudent {
  kind: 'student';
  studentId: string;
  studentName: string;
  email: string;
  phone: string | null;
  amountDue: string;
  daysOverdue: number;
  notificationsMuted: boolean;
}

// Families have no email/mute of their own (those are per student): WhatsApp only.
interface OverdueFamily {
  kind: 'family';
  familyId: string;
  familyName: string;
  phone: string | null;
  amountDue: string;
  daysOverdue: number;
}

type OverdueItem = OverdueStudent | OverdueFamily;

const itemKey = (item: OverdueItem) => (item.kind === 'family' ? `f-${item.familyId}` : item.studentId);
const itemName = (item: OverdueItem) => (item.kind === 'family' ? item.familyName : item.studentName);
const isMuted = (item: OverdueItem) => item.kind === 'student' && item.notificationsMuted;

export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [emailSentFor, setEmailSentFor] = useState<Set<string>>(new Set());

  const { data: overdueItems = [] } = useApiQuery<OverdueItem[]>(
    ['overdue', user?.academyId],
    `/payments/overdue?academyId=${user?.academyId}`,
    !!user?.academyId && isOwner(user),
  );

  const visibleItems = overdueItems.filter((item) => !isMuted(item));
  const unmutedCount = visibleItems.length;

  const muteMutation = useMutation({
    mutationFn: ({ studentId, muted }: { studentId: string; muted: boolean; name: string }) =>
      api(`/students/${studentId}/notifications`, {
        method: 'PUT',
        body: JSON.stringify({ muted }),
      }),
    onSuccess: (_, { studentId, muted, name }) => {
      queryClient.invalidateQueries({ queryKey: ['overdue'] });
      if (muted) {
        toast(t('notifications.mutedToast', { name }), {
          action: {
            label: t('common.undo'),
            onClick: () => muteMutation.mutate({ studentId, muted: false, name }),
          },
        });
      }
    },
  });

  const emailMutation = useMutation({
    mutationFn: (studentId: string) =>
      api(`/payments/overdue/${studentId}/notify`, { method: 'POST' }),
    onSuccess: (_, studentId) => {
      setEmailSentFor(prev => new Set(prev).add(studentId));
    },
  });

  function handleWhatsApp(item: OverdueItem) {
    if (!item.phone) {
      return;
    }
    const message = t('notifications.overdueMessage', {
      name: itemName(item),
      count: item.daysOverdue,
    });
    window.open(`https://wa.me/${item.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  }

  if (!isOwner(user)) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground hover:text-foreground"
            aria-label={unmutedCount > 0 ? `${t('notifications.title')} (${unmutedCount})` : t('notifications.title')}
          />
        }
      >
        <Bell className="size-5" />
        {unmutedCount > 0 && (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
          >
            {unmutedCount}
          </span>
        )}
      </SheetTrigger>

      <SheetContent side="right" className="gap-0 overflow-y-auto overscroll-contain">
        <SheetHeader className="border-b border-border pr-12">
          <SheetTitle className="font-heading text-sm uppercase tracking-wider">{t('notifications.title')}</SheetTitle>
        </SheetHeader>

        {visibleItems.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {t('notifications.noOverdue')}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visibleItems.map((item) => (
              <div key={itemKey(item)} className="p-3 space-y-2">
                <div>
                  <p className="text-sm font-medium">{itemName(item)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(item.amountDue, i18n.language)} &middot; {t('notifications.daysOverdue', { count: item.daysOverdue })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.phone && (
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => handleWhatsApp(item)}>
                      <MessageCircle />
                      {t('notifications.sendReminder')}
                    </Button>
                  )}
                  {item.kind === 'student' && (
                    <StudentActions
                      student={item}
                      emailSent={emailSentFor.has(item.studentId)}
                      emailPending={emailMutation.isPending}
                      onEmail={() => emailMutation.mutate(item.studentId)}
                      onMute={() => muteMutation.mutate({ studentId: item.studentId, muted: true, name: item.studentName })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StudentActions({
  student,
  emailSent,
  emailPending,
  onEmail,
  onMute,
}: {
  student: OverdueStudent;
  emailSent: boolean;
  emailPending: boolean;
  onEmail: () => void;
  onMute: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Button variant="outline" size="sm" className="text-xs" onClick={onEmail} disabled={emailSent || emailPending}>
        <Mail />
        {emailSent ? t('notifications.emailSent') : t('notifications.sendEmail')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        aria-label={t('notifications.mute', { name: student.studentName })}
        onClick={onMute}
      >
        <BellOff />
      </Button>
    </>
  );
}
