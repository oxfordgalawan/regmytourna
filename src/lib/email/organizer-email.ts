import { escapeHtml } from "@/lib/email/escape";
import { button, layout } from "@/lib/email/partner-email";

/** "Juan invited you to co-organize Manila Open". */
export function organizerInviteEmail(x: {
  inviterName: string;
  tournamentName: string;
  hasAccount: boolean;
  url: string;
}) {
  const html = layout(
    `<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#e0dac8">Help run ${escapeHtml(x.tournamentName)}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#e0dac8"><strong>${escapeHtml(x.inviterName)}</strong> invited you to co-organize <strong>${escapeHtml(x.tournamentName)}</strong> on RegMyTourna.</p>
<p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#c9c2b0">As a co-organizer you can manage categories, players, brackets, the match queue, courts and umpires. Payouts stay with the event owner.</p>
${button(x.url, x.hasAccount ? "Accept invite" : "Create free account & accept")}
<p style="margin:18px 0 0;font-size:13px;color:#8a8273">Not expecting this? You can ignore this email.</p>`,
    "You're receiving this because an organizer invited your email to help run their event."
  );
  return { subject: `${x.inviterName} invited you to co-organize ${x.tournamentName}`, html };
}
