import { escapeHtml } from "@/lib/email/escape";
import { button, layout } from "@/lib/email/partner-email";
import { formatPhp } from "@/lib/format";

/** To the organizer after an admin reviews their withdrawal. */
export function withdrawalReviewedEmail(x: {
  approved: boolean;
  amountCents: number;
  methodLabel: string;
  note: string | null;
  walletUrl: string;
}) {
  const amount = formatPhp(x.amountCents);
  const body = x.approved
    ? `<h1 style="margin:0 0 12px;font-size:24px;color:#e0dac8">${escapeHtml(amount)} is on its way</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#e0dac8">Your withdrawal to <strong>${escapeHtml(x.methodLabel)}</strong> was approved and sent.</p>
${x.note ? `<p style="margin:0 0 16px;font-size:14px;color:#c9c2b0">Reference: <strong style="color:#e0dac8">${escapeHtml(x.note)}</strong></p>` : ""}`
    : `<h1 style="margin:0 0 12px;font-size:24px;color:#e0dac8">Your withdrawal was declined</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#e0dac8">${escapeHtml(amount)} is back in your available balance.</p>
${x.note ? `<p style="margin:0 0 16px;font-size:14px;color:#c9c2b0">Reason: ${escapeHtml(x.note)}</p>` : ""}`;
  return {
    subject: x.approved ? `Withdrawal sent — ${amount}` : `Withdrawal declined — ${amount}`,
    html: layout(`${body}${button(x.walletUrl, "Open my wallet")}`, "You're receiving this because you requested a withdrawal on RegMyTourna."),
  };
}
