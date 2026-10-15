import { escapeHtml } from "@/lib/email/escape";
import { button, layout } from "@/lib/email/partner-email";
import { formatDateRange } from "@/lib/format";

/** Emails for team changes: substitutes, a partner leaving, partner swaps, cancellations. */

export type EventInfo = {
  tournamentName: string;
  categoryName: string;
  startDate: string | null;
  endDate: string | null;
  venue: string | null;
};

const FOOTER = "You're receiving this because of a change to a team entry on RegMyTourna.";

const h1 = (text: string) =>
  `<h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#e0dac8">${text}</h1>`;
const p = (text: string, muted = false) =>
  `<p style="margin:0 0 16px;font-size:${muted ? 14 : 16}px;line-height:1.5;color:${muted ? "#c9c2b0" : "#e0dac8"}">${text}</p>`;
const b = (text: string) => `<strong>${escapeHtml(text)}</strong>`;

function eventBox(e: EventInfo, extra?: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;border:1px solid #45301a;border-radius:12px">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#c9c2b0">
    <strong style="color:#e0dac8">${escapeHtml(e.categoryName)}</strong> · ${escapeHtml(e.tournamentName)}<br>
    📅 ${escapeHtml(formatDateRange(e.startDate, e.endDate))}${e.venue ? `<br>📍 ${escapeHtml(e.venue)}` : ""}${
      extra ? `<br>${extra}` : ""
    }
  </td></tr></table>`;
}

const nonRefundable = p("Entry fees are non-refundable — the paid slot stays with the team.", true);

/** To the person asked to take someone's place. */
export function substituteInviteEmail(x: {
  event: EventInfo;
  requesterName: string;
  partnerName: string | null;
  paid: boolean;
  url: string;
}) {
  const html = layout(
    `${h1(`${escapeHtml(x.requesterName)} asked you to take their place`)}
${p(
  `${b(x.requesterName)} can't play anymore and would like you to take their spot${
    x.partnerName ? `, partnering ${b(x.partnerName)}` : ""
  }.`
)}
${eventBox(x.event, x.paid ? "✅ Entry fee already paid" : "💳 Entry fee not paid yet")}
${p("Nothing changes until you accept. If you say yes, you're on the team right away.", true)}
${button(x.url, "See the invite & accept")}`,
    FOOTER
  );
  return { subject: `${x.requesterName} asked you to take their place — ${x.event.tournamentName}`, html };
}

/** To the player who left, once the substitute accepted. */
export function substituteAcceptedForLeaverEmail(x: { event: EventInfo; substituteName: string }) {
  const html = layout(
    `${h1("Your spot is covered")}
${p(`${b(x.substituteName)} accepted and took your place. You're no longer on this team.`)}
${eventBox(x.event)}`,
    FOOTER
  );
  return { subject: `${x.substituteName} took your place — ${x.event.tournamentName}`, html };
}

/** To the partner who stays, once a substitute joined. */
export function substituteJoinedForPartnerEmail(x: {
  event: EventInfo;
  substituteName: string;
  leaverName: string;
  entriesUrl: string;
}) {
  const html = layout(
    `${h1(`Meet your new partner: ${escapeHtml(x.substituteName)}`)}
${p(`${b(x.leaverName)} couldn't play, so ${b(x.substituteName)} took their place on your team.`)}
${eventBox(x.event)}
${button(x.entriesUrl, "View our entry")}`,
    FOOTER
  );
  return { subject: `${x.substituteName} is your new partner — ${x.event.tournamentName}`, html };
}

/** To the requester when the substitute said no. */
export function substituteDeclinedEmail(x: { event: EventInfo; substituteName: string; entriesUrl: string }) {
  const html = layout(
    `${h1(`${escapeHtml(x.substituteName)} can't take your place`)}
${p("You're still on the team. You can ask someone else, or leave the team instead.")}
${eventBox(x.event)}
${button(x.entriesUrl, "Manage my entry")}`,
    FOOTER
  );
  return { subject: `${x.substituteName} declined — ${x.event.tournamentName}`, html };
}

/** To the player who stays when their partner left the team. */
export function partnerLeftEmail(x: {
  event: EventInfo;
  leaverName: string;
  stayerName: string | null;
  paid: boolean;
  hasAccount: boolean;
  url: string;
}) {
  const html = layout(
    `${h1(`${escapeHtml(x.leaverName)} left your team`)}
${p(
  `${x.stayerName ? `Hi ${escapeHtml(x.stayerName)}, ` : ""}${b(x.leaverName)} can't play anymore. ${
    x.paid ? "Your paid slot is still held for you." : "Your slot is still held for you."
  }`
)}
${eventBox(x.event)}
${p("You can:", true)}
<ul style="margin:0 0 18px;padding-left:20px;font-size:15px;line-height:1.7;color:#e0dac8">
  <li><strong>Invite a new partner</strong> and keep playing, or</li>
  <li><strong>Cancel the slot</strong> so another team can take it.</li>
</ul>
${x.paid ? nonRefundable : ""}
${button(x.url, x.hasAccount ? "Choose what to do" : "Create free account to keep the slot")}
${
  x.hasAccount
    ? ""
    : p("You'll need a free account to manage the entry — it takes a minute and your email is filled in.", true)
}`,
    FOOTER
  );
  return { subject: `${x.leaverName} left your team — ${x.event.tournamentName}`, html };
}

/** To a partner the captain replaced. */
export function partnerRemovedEmail(x: { event: EventInfo; captainName: string }) {
  const html = layout(
    `${h1("You've been removed from a team")}
${p(`${b(x.captainName)} changed their partner, so you're no longer on this entry.`)}
${eventBox(x.event)}
${p("If this is a mistake, contact them or the organizer.", true)}`,
    FOOTER
  );
  return { subject: `Team update — ${x.event.tournamentName}`, html };
}

/** To the other player when the entry was cancelled. */
export function entryCancelledEmail(x: { event: EventInfo; byName: string }) {
  const html = layout(
    `${h1("Your entry was cancelled")}
${p(`${b(x.byName)} cancelled your team's entry, and the slot was released.`)}
${eventBox(x.event)}
${p("Entry fees are non-refundable. Want to play anyway? Register again if there's still space.", true)}`,
    FOOTER
  );
  return { subject: `Entry cancelled — ${x.event.tournamentName}`, html };
}
