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
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatMoney } from '@/lib/format';

export interface FamilyMember {
  id: string;
  name: string;
  phone: string | null;
  belt: string;
  monthlyFee: string | null;
}

export interface Family {
  id: string;
  name: string;
  contactStudentId: string | null;
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

const selectClass = 'flex h-11 md:h-10 w-full rounded-sm border border-border bg-card px-3 py-2 text-sm';

// Every family change can move students, fees and overdue records.
export function invalidateFamilyQueries(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of ['families', 'family-suggestions', 'students', 'student', 'overdue', 'my-payment-status']) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export function familyErrorKey(err: Error) {
  return err.message === 'STUDENT_IN_FAMILY' ? 'families.errors.studentInFamily' : 'common.genericError';
}

export default function FamiliesPage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<DialogState | null>(null);

  const { data: families = [], isLoading } = useApiQuery<Family[]>(['families'], '/families');
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

      <Button onClick={() => setDialog({ mode: 'create', members: [] })}>{t('families.new')}</Button>

      {families.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">{t('families.empty')}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {families.map(f => (
            <li key={f.id}>
              <Card>
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <h2 className="font-heading text-lg uppercase">{f.name}</h2>
                      <p className="text-sm text-muted-foreground">{f.members.map(m => m.name).join(', ')}</p>
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
                  <p className="font-medium">{s.students.map(st => st.name).join(', ')}</p>
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
  const [contactId, setContactId] = useState(family?.contactStudentId ?? '');
  const [agreedPrice, setAgreedPrice] = useState(family?.agreedPrice ?? '');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const members = isEdit ? (family?.members ?? []) : draftMembers;
  const memberIds = new Set(members.map(m => m.id));
  const results = search
    ? students.filter(
        s => !s.familyId && !memberIds.has(s.id) && s.name.toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  const onError = (err: Error) => setError(t(familyErrorKey(err)));
  const onSuccess = () => {
    setError(null);
    invalidateFamilyQueries(queryClient);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return api(`/families/${family!.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name, contactStudentId: contactId || null, agreedPrice: agreedPrice || null }),
        });
      }
      return api('/families', {
        method: 'POST',
        body: JSON.stringify({
          name,
          memberIds: draftMembers.map(m => m.id),
          contactStudentId: contactId || undefined,
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

  const removeMemberMutation = useMutation({
    mutationFn: (studentId: string) => api(`/families/${family!.id}/members/${studentId}`, { method: 'DELETE' }),
    meta: { silent: true },
    onError,
    onSuccess,
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

  function addMember(student: StudentRow) {
    setSearch('');
    if (isEdit) {
      addMemberMutation.mutate(student.id);
    } else {
      setDraftMembers(ms => [...ms, { id: student.id, name: student.name }]);
    }
  }

  function removeMember(id: string) {
    if (contactId === id) {
      setContactId('');
    }
    if (isEdit) {
      removeMemberMutation.mutate(id);
    } else {
      setDraftMembers(ms => ms.filter(m => m.id !== id));
    }
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
            {t('common.confirm')}
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
                  onClick={() => removeMember(m.id)}
                >
                  {t('families.remove')}
                </Button>
              </li>
            ))}
          </ul>
          <Label htmlFor="family-search">{t('families.searchMembers')}</Label>
          <Input id="family-search" type="search" value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <ul aria-label={t('families.searchResults')} className="max-h-48 overflow-y-auto">
              {results.length === 0 ? (
                <li className="text-sm text-muted-foreground py-2">{t('common.noResults')}</li>
              ) : (
                results.map(s => (
                  <li key={s.id}>
                    <Button type="button" variant="ghost" className="w-full justify-start" onClick={() => addMember(s)}>
                      + {s.name}
                    </Button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="family-contact">{t('families.contact')}</Label>
          <select
            id="family-contact"
            value={contactId}
            onChange={e => setContactId(e.target.value)}
            className={selectClass}
          >
            <option value="">{t('families.noContact')}</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
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
          <Button type="submit" disabled={members.length === 0} loading={saveMutation.isPending}>
            {isEdit ? t('common.save') : t('common.create')}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
