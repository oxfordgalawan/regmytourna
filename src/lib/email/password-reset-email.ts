import { escapeHtml } from "@/lib/email/escape";

export function passwordResetEmailSubject(): string {
  return "Reset your RegMyTourna password";
}

export function passwordResetEmailHtml(params: {
  resetUrl: string;
  expiresMinutes?: number;
}): string {
  const expires = params.expiresMinutes ?? 60;
  const resetUrl = escapeHtml(params.resetUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0c0a09;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0c0a09;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
        <tr><td style="padding-bottom:20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#c9a227;">RegMyTourna</td></tr>
        <tr><td style="background:#161412;border:1px solid #2a2622;border-radius:16px;padding:28px 24px;">
          <h1 style="margin:0 0 12px;font-size:26px;font-weight:400;color:#f5f0e6;line-height:1.25;">Reset your password</h1>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#c4bcb0;">
            We received a request to change the password for your RegMyTourna account. Use the button below to choose a new password.
          </p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td style="padding:0 0 24px;">
              <a href="${resetUrl}" style="display:inline-block;background:#e8e0d0;color:#0c0a09;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">Set new password</a>
            </td></tr>
          </table>
          <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#9a9185;">
            This link expires in about ${expires} minutes. If the button does not work, copy and paste this URL into your browser:
          </p>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#c9a227;word-break:break-all;">
            <a href="${resetUrl}" style="color:#c9a227;">${resetUrl}</a>
          </p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #2a2622;">
            <tr><td style="padding:20px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#9a9185;">
              If you did not request a password reset, you can ignore this email. Your password will stay the same.
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6b6560;text-align:center;">
          RegMyTourna · Tournament registration &amp; management
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
