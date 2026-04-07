interface OverduePaymentEmailProps {
  studentName: string;
  academyName: string;
  daysOverdue: number;
}

export function renderOverduePaymentEmail({ studentName, academyName, daysOverdue }: OverduePaymentEmailProps): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color:#141414;border:1px solid #262626;border-radius:8px;">
          <tr>
            <td style="padding:32px 32px 24px;text-align:center;">
              <h1 style="margin:0;font-size:36px;color:#f97316;letter-spacing:2px;">PGT</h1>
              <div style="width:48px;height:3px;background:#f97316;margin:12px auto 0;border-radius:2px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px;">
              <h2 style="margin:0 0 16px;font-size:20px;color:#fafafa;">Lembrete de Pagamento</h2>
              <p style="margin:0 0 16px;font-size:14px;color:#a3a3a3;line-height:1.6;">
                Olá <strong style="color:#fafafa;">${studentName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#a3a3a3;line-height:1.6;">
                Seu pagamento na <strong style="color:#fafafa;">${academyName}</strong> está <strong style="color:#f97316;">${daysOverdue} dias</strong> atrasado. Por favor, regularize o quanto antes para manter seu acesso às aulas.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #262626;text-align:center;">
              <p style="margin:0;font-size:11px;color:#525252;">PGT — Gestão de Academia BJJ</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
