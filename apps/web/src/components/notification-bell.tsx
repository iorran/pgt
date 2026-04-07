import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { useApiQuery } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, MessageCircle, Mail, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OverdueStudent {
  studentId: string;
  studentName: string;
  email: string;
  phone: string | null;
  planName: string;
  daysOverdue: number;
  notificationsMuted: boolean;
}

export function NotificationBell() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [emailSentFor, setEmailSentFor] = useState<Set<string>>(new Set());

  const { data: overdueStudents = [] } = useApiQuery<OverdueStudent[]>(
    ['overdue', user?.academyId],
    `/payments/overdue?academyId=${user?.academyId}`,
    !!user?.academyId && user?.role === 'instructor',
  );

  const unmutedCount = overdueStudents.filter(s => !s.notificationsMuted).length;

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

  function handleWhatsApp(student: OverdueStudent) {
    if (!student.phone) {
      return;
    }
    const message = t('notifications.overdueMessage', {
      name: student.studentName,
      days: student.daysOverdue,
    });
    window.open(`https://wa.me/${student.phone}?text=${encodeURIComponent(message)}`, '_blank');
  }

  if (user?.role !== 'instructor') {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t('notifications.title')}
      >
        <Bell size={20} />
        {unmutedCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unmutedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-border">
            <h3 className="font-heading text-sm uppercase tracking-wider">{t('notifications.title')}</h3>
          </div>

          {overdueStudents.filter(s => !s.notificationsMuted).length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('notifications.noOverdue')}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {overdueStudents.filter(s => !s.notificationsMuted).map(student => (
                <div key={student.studentId} className="p-3 space-y-2">
                  <div>
                    <p className="text-sm font-medium">{student.studentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.planName} &middot; {t('notifications.daysOverdue', { days: student.daysOverdue })}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {student.phone && (
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => handleWhatsApp(student)}>
                        <MessageCircle size={14} className="mr-1" />
                        {t('notifications.sendReminder')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => emailMutation.mutate(student.studentId)}
                      disabled={emailSentFor.has(student.studentId) || emailMutation.isPending}
                    >
                      <Mail size={14} className="mr-1" />
                      {emailSentFor.has(student.studentId) ? t('notifications.emailSent') : t('notifications.sendEmail')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      onClick={() => muteMutation.mutate({ studentId: student.studentId, muted: true })}
                    >
                      <BellOff size={14} />
                    </Button>
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
