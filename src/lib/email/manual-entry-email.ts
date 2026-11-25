import { escapeHtml } from "@/lib/email/escape";
import { formatDateRange } from "@/lib/format";
import { button, layout } from "@/lib/email/partner-email";

export function manualEntryEmail(p: {
  playerName?: string | null;
  tournamentName: string;
  categoryName: string;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  hasAccount: boolean;
  signUpUrl: string;
  logInUrl: string;
  eventUrl: string;
}) {
  const when = formatDateRange(p.startDate, p.endDate);
  const html = layout(
    `
<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#e0dac8">You're entered${p.playerName ? `, ${escapeHtml(p.playerName)}` : ""}</h1>
<p style="margin:0 0 18px;font-size:16px;line-height:1.5">
  The organizer added you to <strong>${escapeHtml(p.categoryName)}</strong> at
  <strong>${escapeHtml(p.tournamentName)}</strong>.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border:1px solid #45301a;border-radius:12px">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#c9c2b0">
    📅 ${escapeHtml(when)}${p.venue ? `<br>📍 ${escapeHtml(p.venue)}` : ""}
  </td></tr>
</table>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#c9c2b0">
  ${
    p.hasAccount
      ? 'Log in with this email and your entry will appear in <strong style="color:#e0dac8">My entries</strong> — no extra steps.'
      : "Create a free account with this email and your entry will show up in <strong style=\"color:#e0dac8\">My entries</strong> automatically."
  }
</p>
${button(p.hasAccount ? p.logInUrl : p.signUpUrl, p.hasAccount ? "Log in to see your entry" : "Create your free account")}
${button(p.eventUrl, "View tournament", false)}
`,
    "You're receiving this because an organizer entered your email for a tournament."
  );
  return { subject: `You're entered — ${p.tournamentName}`, html };
}