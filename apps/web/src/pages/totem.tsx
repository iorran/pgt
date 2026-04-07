import { useEffect } from 'react';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { useApiQuery } from '@/hooks/use-api';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TokenData {
  classId: string;
  className: string;
  classType: string;
  startTime: string;
  endTime: string;
  token: string;
  expiresAt: string;
}

const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

export default function TotemPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const user = session?.user as any;

  const { data: tokens = [], refetch } = useApiQuery<TokenData[]>(
    ['checkin-tokens'],
    '/checkins/tokens',
    !!user?.academyId,
  );

  // Poll every 4 minutes to refresh tokens
  useEffect(() => {
    const interval = setInterval(() => refetch(), 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  return (
    <div className="min-h-screen bg-background p-8 flex flex-col items-center">
      <h1 className="font-display text-4xl text-primary mb-8 arena-glow">PGT</h1>

      {tokens.length === 0 ? (
        <div className="text-center mt-20">
          <p className="text-2xl text-muted-foreground">{t('totem.noClasses')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {tokens.map((tk) => (
            <Card key={tk.classId} className="text-center">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-center gap-2">
                  <h2 className="font-heading text-2xl uppercase">{tk.className}</h2>
                  <Badge variant="outline">{tk.classType}</Badge>
                </div>
                <p className="font-mono text-lg text-muted-foreground">
                  {tk.startTime} - {tk.endTime}
                </p>
                <div className="flex justify-center">
                  <QRCodeSVG
                    value={`${APP_URL}/checkin?token=${tk.token}&classId=${tk.classId}`}
                    size={250}
                    level="M"
                  />
                </div>
                <p className="text-sm text-muted-foreground">{t('totem.scanToCheckin')}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
