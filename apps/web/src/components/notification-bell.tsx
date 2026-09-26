import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { isOwner } from '@/lib/roles';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, MessageCircle, Mail, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    mutationFn: ({ studentId, muted }: { studentId: string; muted: boolean }) =>
      api(`/students/${studentId}/notifications`, {
        method: 'PUT',
        body: JSON.stringify({ muted }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overdue'] });
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
      days: item.daysOverdue,
    });
    window.open(`https://wa.me/${item.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  }

  if (!isOwner(user)) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        className="relative text-muted-foreground hover:text-foreground"
        aria-label={t('notifications.title')}
      >
        <Bell size={20} />
        {unmutedCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unmutedCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-border">
            <h3 className="font-heading text-sm uppercase tracking-wider">{t('notifications.title')}</h3>
          </div>

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
                      {formatMoney(item.amountDue, i18n.language)} &middot; {t('notifications.daysOverdue', { days: item.daysOverdue })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {item.phone && (
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => handleWhatsApp(item)}>
                        <MessageCircle size={14} className="mr-1" />
                        {t('notifications.sendReminder')}
                      </Button>
                    )}
                    {item.kind === 'student' && (
                      <StudentActions
                        student={item}
                        emailSent={emailSentFor.has(item.studentId)}
                        emailPending={emailMutation.isPending}
                        onEmail={() => emailMutation.mutate(item.studentId)}
                        onMute={() => muteMutation.mutate({ studentId: item.studentId, muted: true })}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
        <Mail size={14} className="mr-1" />
        {emailSent ? t('notifications.emailSent') : t('notifications.sendEmail')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs text-muted-foreground"
        aria-label={t('notifications.mute', { name: student.studentName })}
        onClick={onMute}
      >
        <BellOff size={14} />
      </Button>
    </>
  );
}
