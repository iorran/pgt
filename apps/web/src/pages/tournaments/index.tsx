import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { MapPin, Calendar } from 'lucide-react';

interface Tournament {
  id: string;
  name: string;
  date: string;
  location: string;
  federation?: string;
}

interface RosterEntry {
  id: string;
  studentName: string;
  belt: string;
  weightClass: string;
}

export default function TournamentsPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [signupTournamentId, setSignupTournamentId] = useState<string | null>(null);
  const [rosterTournamentId, setRosterTournamentId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const { data: tournaments = [], isLoading } = useApiQuery<Tournament[]>(
    ['tournaments', user?.academyId],
    `/tournaments?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const { data: roster = [] } = useApiQuery<RosterEntry[]>(
    ['tournament-roster', rosterTournamentId!],
    `/tournaments/${rosterTournamentId}/roster`,
    !!rosterTournamentId,
  );

  const createMutation = useMutation({
    mutationFn: (body: any) =>
      api<Tournament>('/tournaments', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
    },
  });

  const signupMutation = useMutation({
    mutationFn: ({ tournamentId, body }: { tournamentId: string; body: any }) =>
      api(`/tournaments/${tournamentId}/signup`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      setMsg(t('tournaments.signupSuccess'));
      setSignupTournamentId(null);
      signupForm.reset();
      setTimeout(() => setMsg(''), 3000);
    },
    onError: () => {
      setMsg(t('tournaments.signupError'));
    },
  });

  const createForm = useForm({
    defaultValues: {
      name: '',
      date: '',
      location: '',
      federation: '',
    },
    onSubmit: async ({ value }) => {
      await createMutation.mutateAsync({ ...value, academyId: user.academyId });
      createForm.reset();
      setCreateDialogOpen(false);
    },
  });

  const signupForm = useForm({
    defaultValues: {
      weightClass: '',
    },
    onSubmit: async ({ value }) => {
      if (!signupTournamentId) {
        return;
      }
      await signupMutation.mutateAsync({
        tournamentId: signupTournamentId,
        body: { studentId: user.id, weightClass: value.weightClass },
      });
    },
  });

  function viewRoster(tournamentId: string) {
    if (rosterTournamentId === tournamentId) {
      setRosterTournamentId(null);
      return;
    }
    setRosterTournamentId(tournamentId);
  }

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl uppercase tracking-tight">{t('tournaments.pageTitle')}</h1>

        {user?.role === 'instructor' && (
          <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) { createForm.reset(); } }}>
            <DialogTrigger render={<Button />}>
              {t('tournaments.createTournament')}
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-heading text-xl uppercase">{t('tournaments.createTournament')}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createForm.handleSubmit();
                }}
                className="space-y-4"
              >
                <createForm.Field name="name">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('tournaments.tournamentName')}</Label>
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </createForm.Field>
                <createForm.Field name="date">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('classes.date')}</Label>
                      <Input
                        type="date"
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </createForm.Field>
                <createForm.Field name="location">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('tournaments.location')}</Label>
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                        required
                      />
                    </div>
                  )}
                </createForm.Field>
                <createForm.Field name="federation">
                  {(field) => (
                    <div className="space-y-2">
                      <Label>{t('tournaments.federation')}</Label>
                      <Input
                        value={field.state.value}
                        onChange={(e) => field.handleChange(e.target.value)}
                        onBlur={field.handleBlur}
                      />
                    </div>
                  )}
                </createForm.Field>
                <Button type="submit" className="w-full" loading={createMutation.isPending}>{t('common.create')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {msg && <p className="text-sm font-bold text-primary">{msg}</p>}

      {tournaments.length === 0 ? (
        <p className="text-muted-foreground">{t('common.noResults')}</p>
      ) : (
        <div className="space-y-4">
          {tournaments.map(tr => (
            <Card key={tr.id} className="rounded-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="font-heading text-xl">{tr.name}</CardTitle>
                  <div className="flex items-center gap-2 shrink-0">
                    {tr.federation && (
                      <Badge variant="outline">{tr.federation}</Badge>
                    )}
                    {user?.role === 'student' && (
                      <Dialog open={signupTournamentId === tr.id} onOpenChange={(open) => {
                        setSignupTournamentId(open ? tr.id : null);
                        if (!open) { signupForm.reset(); }
                      }}>
                        <DialogTrigger render={<Button size="sm" variant="outline" />}>
                          {t('tournaments.signUp')}
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle className="font-heading text-lg uppercase">{t('tournaments.signUp')}</DialogTitle>
                          </DialogHeader>
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              signupForm.handleSubmit();
                            }}
                            className="space-y-4"
                          >
                            <signupForm.Field name="weightClass">
                              {(field) => (
                                <div className="space-y-2">
                                  <Label>{t('tournaments.weightClass')}</Label>
                                  <Input
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                    required
                                  />
                                </div>
                              )}
                            </signupForm.Field>
                            <Button type="submit" className="w-full" loading={signupMutation.isPending}>{t('common.confirm')}</Button>
                          </form>
                        </DialogContent>
                      </Dialog>
                    )}
                    {user?.role === 'instructor' && (
                      <Button size="sm" variant="outline" onClick={() => viewRoster(tr.id)}>
                        {t('tournaments.viewRoster')}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5" />
                    <span className="font-mono">{new Date(tr.date).toLocaleDateString()}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {tr.location}
                  </span>
                </div>

                {/* Roster (inline, expandable) */}
                {rosterTournamentId === tr.id && (
                  <div className="pt-2 border-t border-border">
                    <h3 className="font-heading text-sm uppercase mb-2">{t('tournaments.roster')}</h3>
                    {roster.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('common.noResults')}</p>
                    ) : (
                      <div className="rounded-sm border border-border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-border">
                              <TableHead>{t('students.name')}</TableHead>
                              <TableHead>{t('students.belt')}</TableHead>
                              <TableHead>{t('tournaments.weightClass')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {roster.map(r => (
                              <TableRow key={r.id} className="border-border">
                                <TableCell>{r.studentName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs uppercase">{r.belt}</Badge>
                                </TableCell>
                                <TableCell className="font-mono">{r.weightClass}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
