import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import { PageLoader } from '@/components/page-loader';
import { TabsNav } from '@/components/tabs-nav';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchCombobox } from '@/components/search-combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { QueryError } from '@/components/query-error';
import { formatList, formatMoney } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';

export interface FamilyMember {
  id: string;
  name: string;
  phone: string | null;
  belt: string;
  monthlyFee: string | null;
}

export interface FamilyResponsible {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  trains: boolean;
}

export interface Family {
  id: string;
  name: string;
  responsible: FamilyResponsible | null;
  agreedPrice: string | null;
  priceReviewNeeded: boolean;
  familyFee: string;
  members: FamilyMember[];
}

interface Suggestion {
  phone: string;
  students: { id: string; name: string }[];
}

interface StudentRow {
  id: string;
  name: string;
  familyId?: string | null;
}

type DialogState = { mode: 'create'; members: { id: string; name: string }[] } | { mode: 'edit'; familyId: string };

const selectClass = 'flex h-11 md:h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-base md:text-sm';

// Every family change can move students, fees and overdue records.
export function invalidateFamilyQueries(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of ['families', 'family-suggestions', 'students', 'student', 'overdue', 'my-payment-status']) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

const FAMILY_ERRORS: Record<string, string> = {
  STUDENT_IN_FAMILY: 'families.errors.studentInFamily',
  EMAIL_TAKEN: 'families.errors.emailTaken',
  RESPONSIBLE_REQUIRED: 'families.errors.responsibleRequired',
  FAMILY_RESPONSIBLE_REQUIRED: 'families.errors.familyResponsibleRequired',
  MEMBER_HAS_LOGIN: 'families.errors.memberHasLogin',
};

export function familyErrorKey(err: Error) {
  return FAMILY_ERRORS[err.message] ?? 'common.genericError';
}

const NEW_RESPONSIBLE = '__new';

export default function FamiliesPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const { data: families = [], isLoading, isError, refetch } = useApiQuery<Family[]>(['families'], '/families');
  const { data: suggestions = [] } = useApiQuery<Suggestion[]>(['family-suggestions'], '/families/suggestions');
  const { data: students = [] } = useApiQuery<StudentRow[]>(
    ['students', user?.academyId],
    `/students?academyId=${user?.academyId}`,
    !!user?.academyId,
  );

  const dismissMutation = useMutation({
    mutationFn: (phone: string) =>
      api('/families/suggestions/dismiss', { method: 'POST', body: JSON.stringify({ phone }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-suggestions'] });
    },
  });

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      <TabsNav title={t('nav.students')} items={studentTabs(t)} />

      {families.length > 0 && (
        <Button onClick={() => setDialog({ mode: 'create', members: [] })}>{t('families.new')}</Button>
      )}

      {isError ? (
        <QueryError onRetry={() => void refetch()} />
      ) : families.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('families.empty')}
          description={t('emptyState.families.description')}
          action={
            <Button onClick={() => setDialog({ mode: 'create', members: [] })}>{t('emptyState.families.action')}</Button>
          }
          help="Criar uma Família"
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {families.map(f => (
            <li key={f.id}>
              <Card>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h2 className="font-heading text-lg uppercase">{f.name}</h2>
                      <p className="text-sm text-muted-foreground">{formatList(f.members.map(m => m.name), i18n.language)}</p>
                      {f.responsible && (
                        <p className="text-sm">{`${t('families.responsible')}: ${f.responsible.name}`}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`${t('common.edit')} ${f.name}`}
                      onClick={() => setDialog({ mode: 'edit', familyId: f.id })}
                    >
                      {t('common.edit')}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="arena-stat text-xl text-primary">{formatMoney(f.familyFee, i18n.language)}</span>
                    {f.agreedPrice != null && <Badge variant="secondary">{t('families.agreedPrice')}</Badge>}
                  </div>
                  {f.priceReviewNeeded && <p className="text-sm text-destructive">{t('families.priceReviewNeeded')}</p>}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {suggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading uppercase tracking-wider text-base">{t('families.suggestions')}</h2>
          <ul className="grid gap-3">
            {suggestions.map(s => (
              <li
                key={s.phone}
                className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-border p-3"
              >
                <div>
                  <p className="font-medium">{formatList(s.students.map(st => st.name), i18n.language)}</p>
                  <p className="text-sm text-muted-foreground font-mono">{s.phone}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setDialog({ mode: 'create', members: s.students })}>
                    {t('families.createFamily')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={dismissMutation.isPending && dismissMutation.variables === s.phone}
                    onClick={() => dismissMutation.mutate(s.phone)}
                  >
                    {t('families.dismiss')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog
        open={!!dialog}
        onOpenChange={open => {
          if (!open) {
            setDialog(null);
          }
        }}
      >
        <DialogContent>
          {dialog && (
            <FamilyForm
              key={dialog.mode === 'edit' ? dialog.familyId : 'create'}
              dialog={dialog}
              family={dialog.mode === 'edit' ? families.find(f => f.id === dialog.familyId) : undefined}
              students={students}
              onDone={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function studentTabs(t: (key: string) => string) {
  return [
    { to: '/students', label: t('nav.students') },
    { to: '/pending', label: t('onboarding.pendingStudents') },
    { to: '/students/families', label: t('families.title') },
  ];
}

function FamilyForm({
  dialog,
  family,
  students,
  onDone,
}: {
  dialog: DialogState;
  family?: Family;
  students: StudentRow[];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = dialog.mode === 'edit';
  const [name, setName] = useState(family?.name ?? '');
  const [draftMembers, setDraftMembers] = useState(dialog.mode === 'create' ? dialog.members : []);
  const [responsibleId, setResponsibleId] = useState(family?.responsible?.id ?? '');
  const [newResponsible, setNewResponsible] = useState({ name: '', email: '' });
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [ownEmail, setOwnEmail] = useState('');
  const [agreedPrice, setAgreedPrice] = useState(family?.agreedPrice ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const members = isEdit ? (family?.members ?? []) : draftMembers;
  const memberIds = new Set(members.map(m => m.id));
  // Students not yet in a family can be added.
  const candidates = students.filter(s => !s.familyId && !memberIds.has(s.id));

  const onError = (err: Error) => setError(t(familyErrorKey(err)));
  const onSuccess = () => {
    setError(null);
    invalidateFamilyQueries(queryClient);
  };

  const isNewResponsible = responsibleId === NEW_RESPONSIBLE;
  const responsiblePayload = isNewResponsible ? { responsible: newResponsible } : { responsibleId };
  const responsibleChanged = isEdit && responsibleId !== (family?.responsible?.id ?? '');
  const hasResponsible = isNewResponsible ? !!newResponsible.name.trim() && !!newResponsible.email.trim() : !!responsibleId;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        if (responsibleChanged) {
          await api(`/families/${family!.id}/responsible`, {
            method: 'PUT',
            body: JSON.stringify(isNewResponsible ? newResponsible : { userId: responsibleId }),
          });
        }
        return api(`/families/${family!.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, agreedPrice: agreedPrice || null }),
        });
      }
      return api('/families', {
        method: 'POST',
        body: JSON.stringify({
          name,
          memberIds: draftMembers.map(m => m.id),
          ...responsiblePayload,
          agreedPrice: agreedPrice || undefined,
        }),
      });
    },
    meta: { silent: true, successMessage: t('families.saved') },
    onError,
    onSuccess: () => {
      onSuccess();
      onDone();
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (studentId: string) =>
      api(`/families/${family!.id}/members`, { method: 'POST', body: JSON.stringify({ studentId }) }),
    meta: { silent: true },
    onError,
    onSuccess,
  });

  // An own email lets the removed person create their login alone ("Primeiro acesso").
  const removeMemberMutation = useMutation({
    mutationFn: ({ studentId, email }: { studentId: string; email: string }) =>
      api(`/families/${family!.id}/members/${studentId}`, {
        method: 'DELETE',
        body: JSON.stringify(email.trim() ? { email: email.trim() } : {}),
      }),
    meta: { silent: true },
    onError,
    onSuccess: () => {
      onSuccess();
      setRemoving(null);
      setOwnEmail('');
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () => api(`/families/${family!.id}/responsible/invite`, { method: 'POST' }),
    meta: { silent: true, successMessage: t('families.inviteSent') },
    onError,
  });

  const deleteMutation = useMutation({
    mutationFn: () => api(`/families/${family!.id}`, { method: 'DELETE' }),
    meta: { silent: true, successMessage: t('families.deleted') },
    onError,
    onSuccess: () => {
      onSuccess();
      onDone();
    },
  });

  function addMember(student: { id: string; name: string }) {
    if (isEdit) {
      addMemberMutation.mutate(student.id);
    } else {
      setDraftMembers(ms => [...ms, { id: student.id, name: student.name }]);
    }
  }

  function removeMember(member: { id: string; name: string }) {
    if (isEdit) {
      setRemoving(member);
      return;
    }
    if (responsibleId === member.id) {
      setResponsibleId('');
    }
    setDraftMembers(ms => ms.filter(m => m.id !== member.id));
  }

  if (removing) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{`${t('families.removeMember')} ${removing.name}`}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('families.removeExplain')}</p>
        <div className="space-y-2">
          <Label htmlFor="family-own-email">{t('families.ownEmail')}</Label>
          <Input id="family-own-email" type="email" value={ownEmail} onChange={e => setOwnEmail(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setRemoving(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            loading={removeMemberMutation.isPending}
            onClick={() => removeMemberMutation.mutate({ studentId: removing.id, email: ownEmail })}
          >
            {t('families.confirmRemove')}
          </Button>
        </DialogFooter>
      </>
    );
  }

  if (confirmDelete) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{t('families.deleteTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('families.deleteConfirm')}</p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmDelete(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="destructive" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
            {t('families.deleteTitle')}
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-heading uppercase tracking-wider">
          {isEdit ? family?.name : t('families.new')}
        </DialogTitle>
      </DialogHeader>
      <form
        className="flex flex-col gap-4"
        onSubmit={e => {
          e.preventDefault();
          saveMutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="family-name">{t('families.name')}</Label>
          <Input id="family-name" value={name} onChange={e => setName(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('families.members')}</p>
          <ul aria-label={t('families.members')} className="divide-y divide-border rounded-sm border border-border">
            {members.map(m => (
              <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-1">
                <span>{m.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`${t('families.removeMember')} ${m.name}`}
                  disabled={isEdit && m.id === family?.responsible?.id}
                  onClick={() => removeMember(m)}
                >
                  {t('families.remove')}
                </Button>
              </li>
            ))}
          </ul>
          <Label htmlFor="family-search">{t('families.searchMembers')}</Label>
          <SearchCombobox
            id="family-search"
            items={candidates}
            value={null}
            onChange={s => s && addMember(s)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="family-responsible">{t('families.responsible')}</Label>
          <select
            id="family-responsible"
            value={responsibleId}
            onChange={e => setResponsibleId(e.target.value)}
            className={selectClass}
          >
            <option value="">{t('families.chooseResponsible')}</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
            {family?.responsible && !family.responsible.trains && (
              <option value={family.responsible.id}>{family.responsible.name}</option>
            )}
            <option value={NEW_RESPONSIBLE}>{t('families.newResponsible')}</option>
          </select>
          <p className="text-xs text-muted-foreground">{t('families.responsibleHelp')}</p>
          {isNewResponsible && (
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="family-responsible-name">{t('families.responsibleName')}</Label>
                <Input
                  id="family-responsible-name"
                  value={newResponsible.name}
                  onChange={e => setNewResponsible(r => ({ ...r, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="family-responsible-email">{t('families.responsibleEmail')}</Label>
                <Input
                  id="family-responsible-email"
                  type="email"
                  value={newResponsible.email}
                  onChange={e => setNewResponsible(r => ({ ...r, email: e.target.value }))}
                />
              </div>
            </div>
          )}
          {responsibleChanged && family?.responsible?.trains && (
            <p className="text-sm text-destructive">{t('families.loginMoves')}</p>
          )}
          {isEdit && family?.responsible && !responsibleChanged && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={inviteMutation.isPending}
              onClick={() => inviteMutation.mutate()}
            >
              {t('families.sendInvite')}
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="family-agreed-price">{t('families.familyAgreedPrice')}</Label>
          <Input
            id="family-agreed-price"
            type="number"
            min="0"
            step="0.01"
            placeholder={t('families.agreedPricePlaceholder')}
            value={agreedPrice}
            onChange={e => setAgreedPrice(e.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          {isEdit && (
            <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
              {t('common.delete')}
            </Button>
          )}
          <Button type="submit" disabled={members.length === 0 || !hasResponsible} loading={saveMutation.isPending}>
            {isEdit ? t('common.save') : t('common.create')}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
