import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useApiQuery } from '@/hooks/use-api';
import { formatMoney, todayYmd } from '@/lib/format';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type MemberStatus = 'owed' | 'paid' | 'waived' | 'not-billed';

interface FamilyBilling {
  owedMonths: {
    month: string;
    fee: string;
    members: { studentId: string; status: MemberStatus }[];
  }[];
  suggestedMonths: string[];
  suggestedAmount: string;
}

interface Props {
  familyId: string;
  familyName: string;
  members: { studentId: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function FamilyPaymentDialog({ familyId, familyName, members, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { data: billing, isError } = useApiQuery<FamilyBilling>(
    ['families', familyId, 'billing'],
    `/families/${familyId}/billing`,
    open,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading uppercase tracking-wider">{t('billing.family.dialogTitle')}</DialogTitle>
          <DialogDescription>{familyName}</DialogDescription>
        </DialogHeader>
        {isError && (
          <p role="alert" className="text-sm text-destructive">
            {t('common.genericError')}
          </p>
        )}
        {billing && (
          <FamilyPaymentForm
            familyId={familyId}
            billing={billing}
            members={members}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

// Mounted once billing has loaded, so the initial selection comes straight from the API.
function FamilyPaymentForm({
  familyId,
  billing,
  members,
  onDone,
}: {
  familyId: string;
  billing: FamilyBilling;
  members: Props['members'];
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(billing.suggestedMonths);
  // null = follow the selected months' fees; set once the owner types an amount.
  const [manualAmount, setManualAmount] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(todayYmd());

  const names = new Map(members.map((m) => [m.studentId, m.name]));
  const months = billing.owedMonths.filter((m) => selected.includes(m.month)).map((m) => m.month);
  const feeCents = billing.owedMonths
    .filter((m) => selected.includes(m.month))
    .reduce((sum, m) => sum + Math.round(Number(m.fee) * 100), 0);
  const amount = manualAmount ?? (feeCents / 100).toFixed(2);

  const payMutation = useMutation({
    mutationFn: () =>
      api(`/families/${familyId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ months, amount: Number(amount).toFixed(2), paymentDate }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overdue'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['families'] });
      onDone();
    },
    // The inline alert shows a translated error instead of the raw API text.
    meta: { successMessage: t('billing.family.paymentRecorded'), silent: true },
  });

  function toggle(month: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, month] : prev.filter((m) => m !== month)));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        payMutation.mutate();
      }}
      className="space-y-4"
    >
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium mb-2">{t('billing.family.months')}</legend>
        {billing.owedMonths.map((m) => {
          const billable = m.members.filter((s) => s.status === 'owed' || s.status === 'paid');
          const paid = billable.filter((s) => s.status === 'paid').length;
          return (
            <div key={m.month} className="rounded-sm border border-border p-2">
              <label className="flex min-h-11 items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={selected.includes(m.month)}
                  onChange={(e) => toggle(m.month, e.target.checked)}
                />
                <span className="font-mono">{m.month}</span>
                <span className="ml-auto arena-stat">{formatMoney(m.fee, i18n.language)}</span>
              </label>
              {paid > 0 && (
                <p className="text-xs text-yellow-500">
                  {t('billing.family.partlyPaid', { paid, total: billable.length })}
                </p>
              )}
              <ul className="text-xs text-muted-foreground">
                {m.members.map((s) => (
                  <li key={s.studentId}>{`${names.get(s.studentId) ?? '-'} · ${t(`billing.family.status.${s.status}`)}`}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </fieldset>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="family-payment-amount">{t('billing.amount')}</Label>
          <Input
            id="family-payment-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setManualAmount(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="family-payment-date">{t('billing.date')}</Label>
          <Input
            id="family-payment-date"
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            required
          />
        </div>
      </div>
      {payMutation.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t('billing.family.paymentError')}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={months.length === 0} loading={payMutation.isPending}>
        {t('billing.family.submit')}
      </Button>
    </form>
  );
}
