import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
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
  const [students, setStudents] = useState<PendingStudent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.academyId) return;
    api<PendingStudent[]>(`/academies/${user.academyId}/pending`)
      .then(data => {
        setStudents(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user?.academyId]);

  async function handleApprove(studentId: string) {
    await api(`/academies/${user.academyId}/approve/${studentId}`, { method: 'POST' });
    setStudents(prev => prev.filter(s => s.id !== studentId));
  }

  async function handleReject(studentId: string) {
    await api(`/academies/${user.academyId}/reject/${studentId}`, { method: 'POST' });
    setStudents(prev => prev.filter(s => s.id !== studentId));
  }

  if (loading) {
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
                  <Button size="sm" onClick={() => handleApprove(student.id)}>
                    {t('onboarding.approve')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(student.id)}
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
