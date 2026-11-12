import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { errorKey } from '@/lib/api-errors';
import { formatMoney } from '@/lib/format';
import { useApiQuery } from '@/hooks/use-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Person {
  id: string;
  name: string;
}

interface Agreement {
  id: string;
  name: string;
  sharePercent: number;
  addOnPrice: string | null;
  active: boolean;
  teachers: Person[];
  students: { recruited: number; addOn: number };
}

const chip = 'rounded-full bg-secondary px-2.5 py-1 text-xs';

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>) {
  for (const key of ['agreements', 'students', 'student', 'overdue', 'finance-payouts', 'finance-balance']) {
    queryClient.invalidateQueries({ queryKey: [key] });
  }
}

// Settings › Acordos: Teacher Agreements — who gets a share of what Students pay.
export function AgreementsCard() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Agreement | 'new' | null>(null);
  const [ending, setEnding] = useState<Agreement | null>(null);
  const { data = [] } = useApiQuery<Agreement[]>(['agreements'], '/agreements');
  const agreements = [...data.filter((a) => a.active), ...data.filter((a) => !a.active)];

  const endMutation = useMutation({
    mutationFn: (a: Agreement) => api(`/agreements/${a.id}/end`, { method: 'POST' }),
    meta: { successMessage: t('agreements.endedToast') },
    onSuccess: () => invalidateAll(queryClient),
    onSettled: () => setEnding(null),
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="font-heading text-lg uppercase">{t('agreements.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('agreements.intro')}</p>
        <ul className="space-y-3">
          {agreements.map((a) => (
            <li
              key={a.id}
              className={`relative flex flex-col gap-2 rounded-xl bg-secondary/40 p-4 ${a.active ? 'hover:bg-secondary/60' : 'opacity-60'}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-heading text-lg uppercase">
                  {a.active ? (
                    <button
                      type="button"
                      className="text-left after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-3 focus-visible:after:ring-ring/50"
                      onClick={() => setEditing(a)}
                    >
                      {a.name}
                    </button>
                  ) : (
                    a.name
                  )}
                </h3>
                <span className="font-mono text-primary">{a.sharePercent}%</span>
              </div>
              <span className="text-sm">{a.teachers.map((p) => p.name).join(' · ')}</span>
              <div className="flex flex-wrap gap-2">
                {!a.active && <span className={chip}>{t('agreements.ended')}</span>}
                {a.addOnPrice === null ? (
                  <span className={`${chip} text-muted-foreground`}>{t('agreements.noAddOn')}</span>
                ) : (
                  <span className={chip}>
                    {t('agreements.addOnChip', { price: formatMoney(a.addOnPrice, i18n.language) })}
                  </span>
                )}
                {a.students.recruited > 0 && (
                  <span className={chip}>{t('agreements.recruitedCount', { count: a.students.recruited })}</span>
                )}
                {a.students.addOn > 0 && (
                  <span className={chip}>{t('agreements.addOnCount', { count: a.students.addOn })}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
        <Button variant="outline" className="h-12 w-full border-dashed" onClick={() => setEditing('new')}>
          <Plus aria-hidden="true" />
          {t('agreements.new')}
        </Button>
      </CardContent>

      {editing && (
        <AgreementDialog
          agreement={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onEnd={(a) => {
            setEditing(null);
            setEnding(a);
          }}
        />
      )}

      <Dialog
        open={!!ending}
        onOpenChange={(open) => {
          if (!open) {
            setEnding(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading uppercase">{t('agreements.end')}</DialogTitle>
            <DialogDescription>{t('agreements.endConfirmText', { name: ending?.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEnding(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              loading={endMutation.isPending}
              onClick={() => ending && endMutation.mutate(ending)}
            >
              {t('agreements.endConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AgreementDialog({
  agreement,
  onClose,
  onEnd,
}: {
  agreement: Agreement | null;
  onClose: () => void;
  onEnd: (a: Agreement) => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(agreement?.name ?? '');
  const [teachers, setTeachers] = useState<Person[]>(agreement?.teachers ?? []);
  const [picking, setPicking] = useState(false);
  const [percent, setPercent] = useState(String(agreement?.sharePercent ?? 50));
  const [addOnOn, setAddOnOn] = useState(agreement ? agreement.addOnPrice !== null : false);
  const [price, setPrice] = useState(agreement?.addOnPrice ? String(Number(agreement.addOnPrice)) : '');
  const [error, setError] = useState<string | null>(null);
  const { data: candidates = [] } = useApiQuery<(Person & { role: string })[]>(
    ['teacher-candidates'],
    '/teachers/candidates',
  );
  const available = candidates.filter((c) => c.role === 'student' && !teachers.some((p) => p.id === c.id));

  // Same rounding as the payout: the teachers' share in cents, the rest stays with the academy.
  const priceCents = Math.round(Number(price) * 100);
  const shareCents = Math.round((priceCents * Number(percent)) / 100);
  const money = (cents: number) => formatMoney(cents / 100, i18n.language);

  const mutation = useMutation({
    mutationFn: () =>
      api(agreement ? `/agreements/${agreement.id}` : '/agreements', {
        method: agreement ? 'PUT' : 'POST',
        body: JSON.stringify({
          name,
          sharePercent: Number(percent),
          addOnPrice: addOnOn ? price : null,
          teacherIds: teachers.map((p) => p.id),
        }),
      }),
    meta: { silent: true, successMessage: t('agreements.saved') },
    onError: (err: Error) =>
      setError(t(err.message === 'INVALID_PAYOUT_TEACHER' ? 'agreements.errors.invalidTeacher' : errorKey(err))),
    onSuccess: () => {
      invalidateAll(queryClient);
      onClose();
    },
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase">
            {agreement ? t('agreements.editTitle', { name: agreement.name }) : t('agreements.new')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="agreement-name">{t('agreements.name')}</Label>
            <Input
              id="agreement-name"
              className="h-11"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              required
            />
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium">{t('agreements.teachers')}</span>
            <div className="flex flex-wrap gap-2">
              {teachers.map((p) => (
                <span key={p.id} className="flex h-9 items-center gap-1 rounded-full bg-secondary pl-3 pr-1">
                  {p.name}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t('agreements.removeTeacher', { name: p.name })}
                    onClick={() => setTeachers(teachers.filter((x) => x.id !== p.id))}
                  >
                    <X aria-hidden="true" />
                  </Button>
                </span>
              ))}
              {picking ? (
                <>
                  <Label htmlFor="agreement-teacher" className="sr-only">
                    {t('agreements.pickTeacher')}
                  </Label>
                  <select
                    id="agreement-teacher"
                    autoFocus
                    value=""
                    onChange={(e) => {
                      const picked = available.find((c) => c.id === e.target.value);
                      if (picked) {
                        setTeachers([...teachers, { id: picked.id, name: picked.name }]);
                        setPicking(false);
                      }
                    }}
                    className="h-9 rounded-full border border-border bg-card px-3 text-base md:text-sm"
                  >
                    <option value="">{t('agreements.pickTeacher')}</option>
                    {available.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-full border-dashed"
                  onClick={() => setPicking(true)}
                >
                  {t('agreements.addTeacher')}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t('agreements.teachersHint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agreement-percent">{t('agreements.percent')}</Label>
            <div className="flex items-center gap-2">
              <Input
                id="agreement-percent"
                className="h-11 w-24 font-mono"
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                required
              />
              <span aria-hidden="true">%</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('agreements.percentHint')}</p>
          </div>

          <section className="space-y-4 rounded-xl bg-secondary/40 p-4">
            <label className="flex min-h-11 items-center justify-between gap-3">
              <span className="flex flex-col">
                <span className="font-bold">{t('agreements.addOn')}</span>
                <span className="text-xs text-muted-foreground">{t('agreements.addOnHint')}</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-label={t('agreements.addOn')}
                checked={addOnOn}
                onChange={(e) => setAddOnOn(e.target.checked)}
                className="h-6 w-11 shrink-0 accent-primary"
              />
            </label>
            {addOnOn && (
              <div className="space-y-2">
                <Label htmlFor="agreement-price">{t('agreements.addOnPrice')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="agreement-price"
                    className="h-11 w-32 font-mono"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                  />
                  <span aria-hidden="true">€</span>
                </div>
                {price !== '' && (
                  <p className="text-xs text-muted-foreground">
                    {t('agreements.split', { teachers: money(shareCents), academy: money(priceCents - shareCents) })}
                  </p>
                )}
              </div>
            )}
          </section>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button type="submit" className="h-12 w-full" loading={mutation.isPending} disabled={teachers.length === 0}>
              {t('agreements.save')}
            </Button>
            {agreement && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-destructive"
                onClick={() => onEnd(agreement)}
              >
                {t('agreements.end')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
