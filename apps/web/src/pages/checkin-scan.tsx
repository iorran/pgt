import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Status = 'camera-starting' | 'scanning' | 'processing' | 'success' | 'error';

function parseCheckinUrl(raw: string): { token: string; classId: string } | null {
  try {
    const url = new URL(raw);
    const token = url.searchParams.get('token');
    const classId = url.searchParams.get('classId');
    if (token && classId) return { token, classId };
    return null;
  } catch {
    return null;
  }
}

export default function CheckinScanPage() {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlToken = searchParams.get('token');
  const urlClassId = searchParams.get('classId');
  const hasUrlCredentials = Boolean(urlToken && urlClassId);

  // Mode A: credentials in URL (student scanned the academy totem QR
  //   with their phone's native camera). Process the check-in now.
  // Mode B: no credentials (student opened the app and tapped the FAB).
  //   Render an in-app scanner that decodes the QR, extracts the same
  //   token + classId, and processes the check-in the same way.
  const [status, setStatus] = useState<Status>(
    hasUrlCredentials ? 'processing' : 'camera-starting',
  );
  const [errorMsg, setErrorMsg] = useState('');

  async function submitCheckin(token: string, classId: string) {
    try {
      await api('/checkins', {
        method: 'POST',
        body: JSON.stringify({ classId, source: 'qr', token }),
      });
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  // Mode A
  useEffect(() => {
    if (!session || !hasUrlCredentials) return;
    void submitCheckin(urlToken!, urlClassId!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hasUrlCredentials]);

  useEffect(() => {
    if (status !== 'camera-starting') return;
    const timer = setTimeout(() => setStatus('scanning'), 1500);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status !== 'scanning' || !import.meta.env.DEV) return;
    const timer = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(
        '[checkin-scan] Scanner still in "scanning" status after 15s — no QR detected or camera not initialised',
      );
    }, 15_000);
    return () => clearTimeout(timer);
  }, [status]);

  function handleScan(results: IDetectedBarcode[]) {
    if (results.length === 0) return;
    if (status !== 'camera-starting' && status !== 'scanning') return;
    const parsed = parseCheckinUrl(results[0].rawValue);
    if (!parsed) {
      setErrorMsg(t('checkin.invalidQr'));
      setStatus('error');
      return;
    }
    setStatus('processing');
    void submitCheckin(parsed.token, parsed.classId);
  }

  function handleScannerError(err: unknown) {
    const e = err as { name?: string; message?: string };
    if (e?.name === 'NotAllowedError') {
      setErrorMsg(t('checkin.cameraDenied'));
    } else if (e?.name === 'NotFoundError') {
      setErrorMsg(t('checkin.noCameraFound'));
    } else if (!window.isSecureContext) {
      setErrorMsg(t('checkin.insecureContext'));
    } else {
      const detail = e?.message ? ` (${e.message})` : '';
      setErrorMsg(`${t('checkin.cameraUnavailable')}${detail}`);
    }
    setStatus('error');
  }

  if (!session) {
    const query = searchParams.toString();
    const target = `/checkin${query ? `?${query}` : ''}`;
    return (
      <Navigate
        to={`/login?redirect=${encodeURIComponent(target)}`}
        replace
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center arena-stripes px-4 py-8">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-8 pb-8 px-8 text-center space-y-6">
          <h1 className="font-display text-4xl text-primary leading-none arena-glow">
            PGT
          </h1>

          {(status === 'camera-starting' || status === 'scanning') && (
            <>
              <p className="text-sm text-muted-foreground">
                {status === 'camera-starting'
                  ? t('checkin.cameraStarting')
                  : t('checkin.scanInstruction')}
              </p>
              <div className="relative mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-border">
                <Scanner
                  onScan={handleScan}
                  onError={handleScannerError}
                  constraints={{ facingMode: 'environment' }}
                  formats={['qr_code']}
                  scanDelay={300}
                />
                {status === 'camera-starting' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                    <span className="font-heading uppercase tracking-wider text-sm text-muted-foreground">
                      {t('checkin.cameraStarting')}
                    </span>
                  </div>
                )}
              </div>
              <Button variant="outline" onClick={() => navigate('/')}>
                {t('common.cancel')}
              </Button>
            </>
          )}

          {status === 'processing' && (
            <p className="text-muted-foreground">{t('common.loading')}</p>
          )}

          {status === 'success' && (
            <>
              <p className="text-xl text-primary font-heading uppercase">
                {t('classes.checkinSuccess')}
              </p>
              <Button onClick={() => navigate('/')}>{t('common.back')}</Button>
            </>
          )}

          {status === 'error' && (
            <>
              <p className="text-destructive">{errorMsg}</p>
              <Button variant="outline" onClick={() => navigate('/')}>
                {t('common.back')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
