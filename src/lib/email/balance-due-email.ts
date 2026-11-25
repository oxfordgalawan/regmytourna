import { formatPhp } from "@/lib/format";
import { escapeHtml } from "@/lib/email/escape";

export function buildBalanceDueEmailHtml(input: {
  playerName: string;
  tournamentName: string;
  divisionName: string;
  format: string;
  entryLabel: string;
  feeDueCents: number;
  paidSoFarCents: number;
  balanceDueCents: number;
  currency: string;
  payUrl: string;
  organizerNote: string | null;
}) {
  const fee = formatPhp(input.feeDueCents, input.currency);
  const paid = formatPhp(input.paidSoFarCents, input.currency);
  const balance = formatPhp(input.balanceDueCents, input.currency);
  const noteBlock = input.organizerNote
    ? `<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#e8e0d0;">${escapeHtml(input.organizerNote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0c0a09;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0c0a09;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
        <tr><td style="padding:0 8px 20px;font-size:28px;font-weight:700;color:#f5f0e6;">Registration fee update</td></tr>
        <tr><td style="padding:8px;background:#2a2622;border:1px solid #4a4540;border-radius:12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:20px 24px;">
            <tr><td style="font-size:15px;line-height:1.65;color:#e8e0d0;">
              Hi ${escapeHtml(input.playerName)},<br/><br/>
              The registration fee for <strong>${escapeHtml(input.tournamentName)}</strong> was overlooked when it was first published
              (it was listed per team instead of per player). The correct fee has now been applied.
              <br/><br/>
              We apologize for the mistake and any inconvenience. Your team (<strong>${escapeHtml(input.entryLabel)}</strong> in
              ${escapeHtml(input.divisionName)}) already paid <strong>${paid}</strong>; the fee is now <strong>${fee}</strong>.
              Please pay the remaining <strong>${balance}</strong> to complete your entry.
              ${noteBlock}
            </td></tr>
            <tr><td style="padding:24px 0 8px;">
              <a href="${escapeHtml(input.payUrl)}" style="display:inline-block;background:#e8e0d0;color:#0c0a09;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">Pay remaining fee in My entries</a>
            </td></tr>
            <tr><td style="padding:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#9a9185;">
              Sign in to RegMyTourna, open <strong>My entries</strong>, and scan the QR for the balance. Entry fees remain non-refundable once paid.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}