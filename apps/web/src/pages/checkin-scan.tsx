import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useSession } from '@/lib/auth-client';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Status = 'scanning' | 'processing' | 'success' | 'error';

const SCANNER_ELEMENT_ID = 'pgt-qr-scanner';

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
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const urlToken = searchParams.get('token');
  const urlClassId = searchParams.get('classId');
  const hasUrlCredentials = Boolean(urlToken && urlClassId);

  // Mode A: credentials present in URL (student scanned the academy QR
  // with their phone's native camera). Process the check-in immediately.
  // Mode B: no credentials (student opened the app and tapped the FAB).
  // Render the in-app scanner with html5-qrcode and process the decoded
  // URL the same way Mode A does.
  const [status, setStatus] = useState<Status>(
    hasUrlCredentials ? 'processing' : 'scanning',
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

  // Mode A — URL-driven check-in
  useEffect(() => {
    if (!session || !hasUrlCredentials) return;
    void submitCheckin(urlToken!, urlClassId!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hasUrlCredentials]);

  // Mode B — in-app QR scanner
  useEffect(() => {
    if (!session || hasUrlCredentials || status !== 'scanning') return;

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;
    let cancelled = false;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decodedText) => {
          if (cancelled) return;
          const parsed = parseCheckinUrl(decodedText);
          if (!parsed) {
            setErrorMsg(t('checkin.invalidQr'));
            setStatus('error');
            await scanner.stop().catch(() => undefined);
            return;
          }
          cancelled = true;
          setStatus('processing');
          await scanner.stop().catch(() => undefined);
          await submitCheckin(parsed.token, parsed.classId);
        },
        () => {
          // Per-frame decode failure — silently keep scanning.
        },
      )
      .catch((err: Error) => {
        setErrorMsg(
          err.name === 'NotAllowedError'
            ? t('checkin.cameraDenied')
            : t('checkin.cameraUnavailable'),
        );
        setStatus('error');
      });

    return () => {
      cancelled = true;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => undefined);
      }
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, hasUrlCredentials, status]);

  if (!session) return null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center arena-stripes px-4 py-8">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-8 pb-8 px-8 text-center space-y-6">
          <h1 className="font-display text-4xl text-primary leading-none arena-glow">
            PGT
          </h1>

          {status === 'scanning' && (
            <>
              <p className="text-sm text-muted-foreground">
                {t('checkin.scanInstruction')}
              </p>
              <div
                id={SCANNER_ELEMENT_ID}
                className="mx-auto w-full max-w-xs overflow-hidden rounded-xl border border-border"
              />
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
