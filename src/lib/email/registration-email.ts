import { formatDateRange, formatPhp } from "@/lib/format";
import { escapeHtml } from "@/lib/email/escape";

export type RegistrationEmailKind = "registered" | "payment_confirmed" | "waitlisted" | "promoted";

export type RegistrationEmailContent = {
  kind: RegistrationEmailKind;
  playerName: string;
  tournamentName: string;
  divisionName: string;
  format: string;
  startDate: string | null;
  endDate: string | null;
  venueName: string | null;
  city: string | null;
  feeCents: number;
  currency: string;
  entryLabel: string;
  partnerLine?: string;
  statusTitle: string;
  statusDetail: string;
  statusTone: "good" | "warn" | "neutral";
  eventUrl: string;
  actionUrl?: string;
  actionLabel?: string;
};

export function describeRegistrationStatus(input: {
  status: string;
  payment_status: string;
  entry_source: string | null;
  feeCents: number;
  checkoutUrl?: string | null;
}): Pick<RegistrationEmailContent, "statusTitle" | "statusDetail" | "statusTone" | "actionUrl" | "actionLabel"> {
  const { status, payment_status, entry_source, feeCents, checkoutUrl } = input;

  if (payment_status === "paid" && (status === "confirmed" || status === "awaiting_partner")) {
    if (status === "awaiting_partner") {
      return {
        statusTitle: "Entry reserved — awaiting partner",
        statusDetail:
          "Your payment is received. Your entry will be fully confirmed once your partner accepts their invite.",
        statusTone: "good",
      };
    }
    if (feeCents === 0) {
      return {
        statusTitle: "Confirmed — no payment required",
        statusDetail: "You're on the entry list for this category. See you at the venue.",
        statusTone: "good",
      };
    }
    return {
      statusTitle: "Confirmed — payment received",
      statusDetail: "Your entry fee is paid and your slot is confirmed.",
      statusTone: "good",
    };
  }

  if (entry_source === "pay_at_venue" && payment_status !== "paid") {
    return {
      statusTitle: "Reserved — pay at the venue",
      statusDetail:
        "Your slot is held. Pay at the registration desk on event day (cash or QR). You're confirmed once payment is recorded.",
      statusTone: "warn",
    };
  }

  if (entry_source === "desk") {
    return {
      statusTitle: "Added at the registration desk",
      statusDetail:
        payment_status === "paid"
          ? "Payment was taken at the desk. Your entry is confirmed."
          : "Complete payment at the registration desk to confirm your slot.",
      statusTone: payment_status === "paid" ? "good" : "warn",
    };
  }

  if (checkoutUrl && payment_status === "pending") {
    return {
      statusTitle: "Awaiting online payment",
      statusDetail: "Your registration is saved. Complete payment to lock in your spot.",
      statusTone: "warn",
      actionUrl: checkoutUrl,
      actionLabel: "Complete payment",
    };
  }

  if (status === "awaiting_partner") {
    return {
      statusTitle: "Reserved — awaiting partner",
      statusDetail: "Your entry is saved. We'll email your partner to confirm their side of the team.",
      statusTone: "warn",
    };
  }

  if (status === "awaiting_payment" || payment_status === "pending") {
    return {
      statusTitle: "Awaiting payment",
      statusDetail: "Your slot is not confirmed until payment is completed.",
      statusTone: "warn",
    };
  }

  return {
    statusTitle: "Registration received",
    statusDetail: "Your entry has been recorded. Check the tournament page for the latest status.",
    statusTone: "neutral",
  };
}

const toneColors = {
  good: { bg: "#1a3d2e", border: "#3d8b6a", text: "#b8e6cf" },
  warn: { bg: "#3d3018", border: "#c9a227", text: "#f0dfa0" },
  neutral: { bg: "#2a2622", border: "#4a4540", text: "#e8e0d0" },
};

export function buildRegistrationEmailHtml(c: RegistrationEmailContent) {
  const tone = toneColors[c.statusTone];
  const headline = {
    payment_confirmed: "Payment received — you're confirmed",
    registered: "You're registered",
    waitlisted: "You're on the waitlist",
    promoted: "A slot opened — you're in!",
  }[c.kind];
  const sub = {
    payment_confirmed: `Thanks for completing payment for ${escapeHtml(c.tournamentName)}.`,
    registered: `Here's a summary of your entry for ${escapeHtml(c.tournamentName)}.`,
    waitlisted: `${escapeHtml(c.divisionName)} at ${escapeHtml(c.tournamentName)} is full, so we saved your place in line.`,
    promoted: `Someone left ${escapeHtml(c.divisionName)} at ${escapeHtml(c.tournamentName)} and you were next on the waitlist.`,
  }[c.kind];
  const showRefundNote = c.feeCents > 0 && c.kind !== "waitlisted";

  const dates = formatDateRange(c.startDate, c.endDate);
  const venue = [c.venueName, c.city].filter(Boolean).join(" · ") || "Venue to be announced";
  const fee = c.feeCents > 0 ? formatPhp(c.feeCents, c.currency) : "Free entry";

  const detailRows = [
    ["Category", `${c.divisionName} (${c.format})`],
    ["Entry", c.entryLabel],
    ...(c.partnerLine ? [["Partner", c.partnerLine] as const] : []),
    ["Dates", dates],
    ["Venue", venue],
    ["Entry fee", fee],
  ];

  const rowsHtml = detailRows
    .map(
      ([label, value]) => `
    <tr>
      <td style="padding:10px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#9a9185;width:120px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;font-size:15px;color:#f5f0e6;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`
    )
    .join("");

  const actionBlock =
    c.actionUrl && c.actionLabel
      ? `
    <tr><td colspan="2" style="padding:24px 0 8px;">
      <a href="${escapeHtml(c.actionUrl)}" style="display:inline-block;background:#e8e0d0;color:#0c0a09;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:10px;">${escapeHtml(c.actionLabel)}</a>
    </td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:#0c0a09;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0c0a09;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;">
        <tr><td style="padding-bottom:20px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#c9a227;">RegMyTourna</td></tr>
        <tr><td style="background:#161412;border:1px solid #2a2622;border-radius:16px;padding:28px 24px;">
          <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#9a9185;">Hi ${escapeHtml(c.playerName)},</p>
          <h1 style="margin:0 0 8px;font-size:26px;font-weight:400;color:#f5f0e6;line-height:1.25;">${escapeHtml(headline)}</h1>
          <p style="margin:0 0 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#c4bcb0;">${sub}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;background:${tone.bg};border:1px solid ${tone.border};border-radius:12px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 6px;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${tone.border};">Status</p>
              <p style="margin:0 0 8px;font-size:18px;color:${tone.text};">${escapeHtml(c.statusTitle)}</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#e8e0d0;">${escapeHtml(c.statusDetail)}</p>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #2a2622;">
            ${rowsHtml}
            ${actionBlock}
            ${
              showRefundNote
                ? `<tr><td colspan="2" style="padding:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#9a9185;">Entry fees are non-refundable once paid.</td></tr>`
                : ""
            }
            <tr><td colspan="2" style="padding:20px 0 0;">
              <a href="${escapeHtml(c.eventUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#c9a227;text-decoration:underline;">View tournament page</a>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:20px 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6b6560;text-align:center;">
          You're receiving this because you registered on RegMyTourna. Keep this email for your records.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function registrationEmailSubject(kind: RegistrationEmailKind, tournamentName: string) {
  if (kind === "payment_confirmed") {
    return `Payment confirmed — ${tournamentName}`;
  }
  if (kind === "waitlisted") return `You're on the waitlist — ${tournamentName}`;
  if (kind === "promoted") return `A slot opened for you — ${tournamentName}`;
  return `Registration received — ${tournamentName}`;
}
