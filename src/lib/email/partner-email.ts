import { escapeHtml } from "@/lib/email/escape";
import { formatDateRange } from "@/lib/format";

/** Email-safe layout in the app's palette (inline styles only). */
export function layout(
  body: string,
  footer = "You're receiving this because someone entered your email as their tournament partner."
) {
  return `<!doctype html><html><body style="margin:0;background:#000;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#e0dac8">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1f1610;border:1px solid #45301a;border-radius:16px">
<tr><td style="padding:28px 28px 8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#b98e5a;font-weight:bold">RegMyTourna</td></tr>
<tr><td style="padding:8px 28px 28px">${body}</td></tr>
</table>
<p style="font-size:12px;color:#8a8273;margin:16px 0 0">${escapeHtml(footer)}</p>
</td></tr></table></body></html>`;
}

export function button(href: string, label: string, primary = true) {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 18px;border-radius:10px;font-size:15px;font-weight:bold;text-decoration:none;${
    primary ? "background:#e0dac8;color:#000" : "border:1px solid #45301a;color:#e0dac8"
  }">${escapeHtml(label)}</a>`;
}

export function partnerAddedEmail(p: {
  partnerName?: string | null;
  registrantName: string;
  tournamentName: string;
  categoryName: string;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
  hasAccount: boolean;
  inviteUrl: string;
  eventUrl: string;
}) {
  const when = formatDateRange(p.startDate, p.endDate);
  const html = layout(`
<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#e0dac8">You're in${p.partnerName ? `, ${escapeHtml(p.partnerName)}` : ""}!</h1>
<p style="margin:0 0 18px;font-size:16px;line-height:1.5">
  <strong>${escapeHtml(p.registrantName)}</strong> added you as their partner in
  <strong>${escapeHtml(p.categoryName)}</strong> at <strong>${escapeHtml(p.tournamentName)}</strong>.
</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border:1px solid #45301a;border-radius:12px">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#c9c2b0">
    📅 ${escapeHtml(when)}${p.venue ? `<br>📍 ${escapeHtml(p.venue)}` : ""}
  </td></tr>
</table>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#c9c2b0">
  <strong style="color:#e0dac8">Nothing else is needed for you to play</strong> — your partner handled the entry.
</p>
${button(p.eventUrl, "View tournament & entries", false)}
${button(p.inviteUrl, p.hasAccount ? "Log in to see your entry" : "Create your free account")}
<p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:#c9c2b0">
  ${
    p.hasAccount
      ? "Log in to add this entry to your account — see your matches and results, and file a petition if you need to."
      : "With a free account you can see this entry in your app, follow your matches and results, and file a petition if you need to."
  }
</p>
<p style="margin:22px 0 0;font-size:13px;color:#8a8273">Not you? <a href="${escapeHtml(p.inviteUrl)}" style="color:#b98e5a">Let us know</a> and we'll tell ${escapeHtml(p.registrantName)}.</p>`);
  return { subject: `${p.registrantName} added you as partner — ${p.tournamentName}`, html };
}

export function partnerDeclinedEmail(p: {
  tournamentName: string;
  divisionName: string;
  partnerLabel: string;
  entriesUrl: string;
}) {
  const html = layout(`
<h1 style="margin:0 0 12px;font-size:24px;line-height:1.2;color:#e0dac8">Check your partner's details</h1>
<p style="margin:0 0 18px;font-size:16px;line-height:1.5">
  <strong>${escapeHtml(p.partnerLabel)}</strong> said they aren't your partner for
  <strong>${escapeHtml(p.divisionName)}</strong> at <strong>${escapeHtml(p.tournamentName)}</strong>.
  Maybe the email was mistyped?
</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#c9c2b0">Your entry is still saved. Update your partner so they get the invite.</p>
${button(p.entriesUrl, "Update my partner")}`);
  return { subject: `Partner update needed — ${p.tournamentName}`, html };
}
