import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { signOut, useSession } from '@/lib/auth-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Receipt,
  Trophy,
  Languages,
  Palette,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';

type HubRow = {
  to: string;
  labelKey: string;
  Icon: typeof Receipt;
};

const ROWS: HubRow[] = [
  { to: '/me/billing', labelKey: 'me.billingStatus', Icon: Receipt },
  { to: '/tournaments', labelKey: 'me.tournaments', Icon: Trophy },
  { to: '/me/language', labelKey: 'me.language', Icon: Languages },
  { to: '/me/theme', labelKey: 'me.theme', Icon: Palette },
  { to: '/settings', labelKey: 'me.settings', Icon: Settings },
];

export default function MePage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const navigate = useNavigate();
  const user = session?.user as
    | { name?: string; belt?: string; email?: string }
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
            <span className="font-heading text-lg">{user?.name}</span>
            {user?.belt ? (
              <span className="text-xs uppercase text-muted-foreground">
                {user.belt}
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
        {ROWS.map(({ to, labelKey, Icon }) => (
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

      <Button variant="destructive" onClick={handleSignOut} className="h-12">
        <LogOut className="mr-2 h-4 w-4" />
        {t('me.signOut')}
      </Button>
    </div>
  );
}
