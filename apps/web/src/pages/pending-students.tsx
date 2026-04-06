import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PendingStudent {
  id: string;
  name: string;
  email: string;
  belt: string;
}

export default function PendingStudentsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();

  const { data: students = [], isLoading } = useApiQuery<PendingStudent[]>(
    ['pending-students', user?.academyId],
    `/academies/${user?.academyId}/pending`,
    !!user?.academyId,
  );

  const approveMutation = useMutation({
    mutationFn: (studentId: string) =>
      api(`/academies/${user.academyId}/approve/${studentId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-students'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (studentId: string) =>
      api(`/academies/${user.academyId}/reject/${studentId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-students'] });
    },
  });

  if (isLoading) {
    return <p className="text-muted-foreground p-6">{t('common.loading')}</p>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-heading text-2xl uppercase tracking-wide">
        {t('onboarding.pendingStudents')}
      </h1>

      {students.length === 0 ? (
        <p className="text-muted-foreground">{t('onboarding.noPending')}</p>
      ) : (
        <div className="grid gap-4">
          {students.map(student => (
            <Card key={student.id} className="bg-card border-border">
              <CardContent className="flex items-center justify-between py-4 px-6">
                <div>
                  <p className="font-heading text-lg">{student.name}</p>
                  <p className="text-sm text-muted-foreground">{student.email}</p>
                  <Badge className="mt-1" variant="secondary">
                    {student.belt}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => approveMutation.mutate(student.id)}>
                    {t('onboarding.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectMutation.mutate(student.id)}
                  >
                    {t('onboarding.reject')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
