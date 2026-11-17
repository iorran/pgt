import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signOut, useSession } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { beltKey } from '@/lib/belts';
import { isOwner } from '@/lib/roles';
import { formatList } from '@/lib/format';
import { useApiQuery } from '@/hooks/use-api';
import {
  Receipt,
  Trophy,
  Languages,
  Settings,
  LogOut,
  ChevronRight,
  HandCoins,
} from 'lucide-react';

type HubRow = {
  to: string;
  labelKey: string;
  Icon: typeof Receipt;
  ownerOnly?: boolean;
};

const ROWS: HubRow[] = [
  { to: '/me/billing', labelKey: 'me.billingStatus', Icon: Receipt },
  { to: '/tournaments', labelKey: 'me.tournaments', Icon: Trophy },
  { to: '/me/language', labelKey: 'me.language', Icon: Languages },
  { to: '/settings', labelKey: 'me.settings', Icon: Settings, ownerOnly: true },
];

export default function MePage() {
  const { t, i18n } = useTranslation();
  const { data: session } = useSession();
  // Only Class Teachers of a class with a Payout Sheet get any.
  const { data: payoutSheets = [] } = useApiQuery<{ className: string }[]>(['my-payout-sheets'], '/me/payout-sheets');
  const navigate = useNavigate();
  const user = session?.user as
    | { name?: string; belt?: string; email?: string; role?: string }
    | undefined;

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--pgt-green)] font-display text-xl text-white">
            {(user?.name ?? 'A').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex flex-col">
            <h1 className="font-heading text-lg">{user?.name}</h1>
            {user?.belt ? (
              <span className="text-xs uppercase text-muted-foreground">
                {t(beltKey(user.belt))}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {payoutSheets.length > 0 && (
        <Link to="/me/payout" className="flex items-center gap-3 rounded-xl bg-primary p-4 text-primary-foreground">
          <HandCoins className="size-6 shrink-0" aria-hidden />
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="font-bold">{t('myPayout.entry')}</span>
            <span className="text-sm">{formatList(payoutSheets.map((s) => s.className), i18n.language)}</span>
          </span>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </Link>
      )}

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {ROWS.filter((row) => !row.ownerOnly || isOwner(user)).map(({ to, labelKey, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-h-[56px] items-center gap-4 px-4 py-3 transition-colors duration-[var(--motion-fast)] active:bg-muted/50"
          >
            <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
            <span className="flex-1 font-body">{t(labelKey)}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Link>
        ))}
      </div>

      <Button variant="outline" onClick={handleSignOut} className="h-12">
        <LogOut className="mr-2 h-4 w-4" />
        {t('me.signOut')}
      </Button>
    </div>
  );
}
