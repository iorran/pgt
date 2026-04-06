export function renderPasswordResetEmail(resetUrl: string): string {
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
              <h2 style="margin:0 0 16px;font-size:20px;color:#fafafa;">Recuperação de Senha</h2>
              <p style="margin:0 0 24px;font-size:14px;color:#a3a3a3;line-height:1.6;">
                Você solicitou a redefinição da sua senha. Clique no botão abaixo para criar uma nova senha.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${resetUrl}" style="display:inline-block;padding:12px 32px;background-color:#f97316;color:#0a0a0a;font-size:14px;font-weight:bold;text-decoration:none;border-radius:6px;letter-spacing:0.5px;">Redefinir Senha</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:12px;color:#737373;line-height:1.5;">
                Este link expira em <strong>1 hora</strong>. Se você não solicitou esta alteração, ignore este email.
              </p>
              <p style="margin:0;font-size:12px;color:#737373;line-height:1.5;">
                Se o botão não funcionar, copie e cole este link no navegador:
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#525252;word-break:break-all;">
                ${resetUrl}
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
