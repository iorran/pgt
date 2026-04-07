import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CheckinScanPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const token = searchParams.get('token');
  const classId = searchParams.get('classId');

  useEffect(() => {
    if (!session || !token || !classId) {
      return;
    }

    api('/checkins', {
      method: 'POST',
      body: JSON.stringify({ classId, source: 'qr', token }),
    })
      .then(() => setStatus('success'))
      .catch((err: Error) => {
        setStatus('error');
        setErrorMsg(err.message);
      });
  }, [session, token, classId]);

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center arena-stripes px-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-8 pb-8 px-8 text-center space-y-6">
          <h1 className="font-display text-4xl text-primary leading-none arena-glow">PGT</h1>

          {status === 'loading' && (
            <p className="text-muted-foreground">{t('common.loading')}</p>
          )}

          {status === 'success' && (
            <>
              <p className="text-xl text-primary font-heading uppercase">{t('classes.checkinSuccess')}</p>
              <Button onClick={() => navigate('/')}>{t('common.back')}</Button>
            </>
          )}

          {status === 'error' && (
            <>
              <p className="text-destructive">{errorMsg}</p>
              <Button variant="outline" onClick={() => navigate('/')}>{t('common.back')}</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
