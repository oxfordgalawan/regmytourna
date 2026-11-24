import { formatDateRange, formatPhp } from "@/lib/format";
import { escapeHtml } from "@/lib/email/escape";
import { button, layout } from "@/lib/email/partner-email";

export type OrganizerEntryEmailInput = {
  tournamentName: string;
  tournamentId: string;
  divisionName: string;
  format: string;
  entryLabel: string;
  feeCents: number;
  currency: string;
  paymentMethod: "online" | "qr" | "cash" | "free";
  startDate: string | null;
  endDate: string | null;
  venueName: string | null;
  city: string | null;
  registrationsUrl: string;
};

function paymentMethodLabel(method: OrganizerEntryEmailInput["paymentMethod"]) {
  switch (method) {
    case "online":
      return "Paid online";
    case "qr":
      return "Paid via QR at the desk";
    case "cash":
      return "Paid cash at the desk";
    default:
      return "Free entry (confirmed)";
  }
}

export function organizerEntryEmail(input: OrganizerEntryEmailInput) {
  const paid = input.feeCents > 0 && input.paymentMethod !== "free";
  const subject = paid ? `Payment received — ${input.tournamentName}` : `New entry — ${input.tournamentName}`;
  const headline = paid ? "A registration was paid" : "New confirmed entry";
  const when = formatDateRange(input.startDate, input.endDate);
  const venue = [input.venueName, input.city].filter(Boolean).join(" · ") || "Venue TBA";
  const fee =
    input.feeCents > 0 ? formatPhp(input.feeCents, input.currency) : "Free";

  const html = layout(
    `<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#e0dac8">${escapeHtml(headline)}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.5;color:#c9c2b0">
  <strong>${escapeHtml(input.entryLabel)}</strong> is registered for
  <strong>${escapeHtml(input.divisionName)}</strong> (${escapeHtml(input.format)}) at
  <strong>${escapeHtml(input.tournamentName)}</strong>.
</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#e0dac8">
  <tr><td style="padding:6px 0;color:#8a8273;width:110px;vertical-align:top">Payment</td><td style="padding:6px 0">${escapeHtml(paymentMethodLabel(input.paymentMethod))}</td></tr>
  <tr><td style="padding:6px 0;color:#8a8273;vertical-align:top">Entry fee</td><td style="padding:6px 0">${escapeHtml(fee)}</td></tr>
  <tr><td style="padding:6px 0;color:#8a8273;vertical-align:top">When</td><td style="padding:6px 0">${escapeHtml(when)}</td></tr>
  <tr><td style="padding:6px 0;color:#8a8273;vertical-align:top">Where</td><td style="padding:6px 0">${escapeHtml(venue)}</td></tr>
</table>
${button(input.registrationsUrl, "View registrations")}`,
    "You're receiving this because you organize this event on RegMyTourna."
  );

  return { subject, html };
}