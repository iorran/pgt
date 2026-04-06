import { useEffect, useState } from 'react';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface CompetitionResult {
  id: string;
  competitionName: string;
  date: string;
  position: number;
  status: string;
  studentName?: string;
  pointsAwarded?: number;
}

interface Season {
  id: string;
  name: string;
}

const POSITION_STYLES: Record<number, string> = {
  1: 'bg-arena-gold/20 text-arena-gold border-arena-gold/30',
  2: 'bg-arena-silver/20 text-arena-silver border-arena-silver/30',
  3: 'bg-arena-bronze/20 text-arena-bronze border-arena-bronze/30',
};

const POSITION_LABELS: Record<number, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
};

export default function ResultsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const [results, setResults] = useState<CompetitionResult[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState('');
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ competitionName: '', date: '', position: '1' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user?.academyId) return;
    api<Season[]>(`/seasons?academyId=${user.academyId}`)
      .then(data => {
        setSeasons(data);
        if (data.length > 0) setSeasonId(data[0].id);
      })
      .finally(() => setLoading(false));
  }, [user?.academyId]);

  useEffect(() => {
    if (!seasonId) return;
    if (user?.role === 'instructor') {
      api<CompetitionResult[]>(`/competition-results?seasonId=${seasonId}&status=pending`).then(setResults);
    }
  }, [seasonId, user?.role]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api('/competition-results', {
        method: 'POST',
        body: JSON.stringify({ ...form, position: Number(form.position), studentId: user.id, seasonId }),
      });
      setMsg(t('gamification.resultSubmitted'));
      setForm({ competitionName: '', date: '', position: '1' });
      setTimeout(() => setMsg(''), 3000);
    } catch {
      setMsg(t('gamification.resultError'));
    }
  }

  async function handleApproval(resultId: string, status: 'approved' | 'rejected') {
    await api(`/competition-results/${resultId}`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
    setResults(prev => prev.filter(r => r.id !== resultId));
  }

  if (loading) return <div className="p-6 text-muted-foreground">{t('common.loading')}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="font-heading text-3xl uppercase tracking-tight">{t('gamification.resultsTitle')}</h1>

      {user?.role === 'student' && (
        <Tabs defaultValue="submit">
          <TabsList>
            <TabsTrigger value="submit">{t('gamification.submitResult')}</TabsTrigger>
          </TabsList>
          <TabsContent value="submit" className="mt-4">
            {msg && <p className="text-sm font-bold text-primary mb-4">{msg}</p>}
            {seasons.length === 0 ? (
              <p className="text-muted-foreground">{t('gamification.noSeasons')}</p>
            ) : (
              <Card className="rounded-sm max-w-md">
                <CardHeader>
                  <CardTitle className="font-heading text-lg">{t('gamification.submitResult')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t('gamification.seasonsTitle')}</Label>
                      <select
                        value={seasonId}
                        onChange={e => setSeasonId(e.target.value)}
                        className="w-full rounded-sm border border-border bg-card px-3 py-2 text-sm"
                      >
                        {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('gamification.competitionName')}</Label>
                      <Input
                        value={form.competitionName}
                        onChange={e => setForm(f => ({ ...f, competitionName: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('classes.date')}</Label>
                      <Input
                        type="date"
                        value={form.date}
                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('gamification.position')}</Label>
                      <div className="flex gap-2">
                        {[1, 2, 3].map(pos => (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => setForm(f => ({ ...f, position: String(pos) }))}
                            className={`flex-1 py-2 rounded-sm border text-sm font-heading uppercase transition-colors ${
                              form.position === String(pos)
                                ? POSITION_STYLES[pos]
                                : 'border-border text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {t(`gamification.${pos === 1 ? 'first' : pos === 2 ? 'second' : 'third'}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button type="submit" className="w-full">{t('common.save')}</Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      {user?.role === 'instructor' && (
        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">{t('gamification.pendingResults')}</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4 space-y-4">
            <div>
              <select
                value={seasonId}
                onChange={e => setSeasonId(e.target.value)}
                className="rounded-sm border border-border bg-card px-3 py-2 text-sm font-heading"
              >
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {results.length === 0 ? (
              <p className="text-muted-foreground">{t('common.noResults')}</p>
            ) : (
              <div className="space-y-3">
                {results.map(r => (
                  <Card key={r.id} className="rounded-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-heading text-base">{r.studentName || '-'}</p>
                          <p className="text-sm text-muted-foreground">{r.competitionName}</p>
                          <p className="text-xs font-mono text-muted-foreground">{new Date(r.date).toLocaleDateString()}</p>
                        </div>
                        <Badge className={POSITION_STYLES[r.position] || ''}>
                          {POSITION_LABELS[r.position] || `${r.position}th`}
                        </Badge>
                        {r.status === 'approved' && r.pointsAwarded && (
                          <span className="arena-stat text-primary font-mono">+{r.pointsAwarded}pts</span>
                        )}
                        <div className="flex gap-2 shrink-0">
                          <Button size="sm" onClick={() => handleApproval(r.id, 'approved')}>
                            {t('gamification.approve')}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleApproval(r.id, 'rejected')}>
                            {t('gamification.reject')}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
