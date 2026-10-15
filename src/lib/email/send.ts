import { Resend } from "resend";
import { getResendFrom, isResendConfigured } from "@/lib/env/server";
import { partnerAddedEmail, partnerDeclinedEmail } from "@/lib/email/partner-email";
import {
  passwordResetEmailHtml,
  passwordResetEmailSubject,
} from "@/lib/email/password-reset-email";

export async function sendPartnerInviteEmail(params: {
  to: string;
  tournamentName: string;
  inviteUrl: string;
}) {
  if (!isResendConfigured()) {
    console.warn("[email] Resend not configured; skipping partner invite");
    return { skipped: true as const };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: getResendFrom(),
    to: params.to,
    subject: `Partner invite — ${params.tournamentName}`,
    html: `<p>You have been invited to join <strong>${params.tournamentName}</strong>.</p><p><a href="${params.inviteUrl}">Accept invitation</a></p>`,
  });
  if (error) return { error: error.message };
  return { data };
}

/** "You were added as a partner" — two variants depending on whether they already have an account. */
export async function sendPartnerAddedEmail(params: Parameters<typeof partnerAddedEmail>[0] & { to: string }) {
  const { to, ...content } = params;
  const { subject, html } = partnerAddedEmail(content);
  return sendRegistrationEmail({ to, subject, html });
}

/** Tells the registrant their partner said "not me". */
export async function sendPartnerDeclinedEmail(params: Parameters<typeof partnerDeclinedEmail>[0] & { to: string }) {
  const { to, ...content } = params;
  const { subject, html } = partnerDeclinedEmail(content);
  return sendRegistrationEmail({ to, subject, html });
}

export async function sendPetitionDecisionEmail(params: {
  to: string;
  tournamentName: string;
  divisionName: string;
  status: "approved" | "rejected";
  note?: string | null;
  eventUrl: string;
}) {
  if (!isResendConfigured()) {
    console.warn("[email] Resend not configured; skipping petition decision email");
    return { skipped: true as const };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const approved = params.status === "approved";
  const subject = approved
    ? `Petition approved — ${params.tournamentName}`
    : `Petition update — ${params.tournamentName}`;
  const headline = approved ? "Your entry petition was approved" : "Your entry petition was not approved";
  const noteBlock = params.note
    ? `<p><strong>Organizer note:</strong> ${params.note.replace(/</g, "&lt;")}</p>`
    : "";
  const { data, error } = await resend.emails.send({
    from: getResendFrom(),
    to: params.to,
    subject,
    html: `<p>${headline}</p>
<p>Category: <strong>${params.divisionName}</strong> at <strong>${params.tournamentName}</strong>.</p>
${noteBlock}
<p><a href="${params.eventUrl}">View the tournament</a></p>`,
  });
  if (error) return { error: error.message };
  return { data };
}

export async function sendPasswordResetEmail(params: { to: string; resetUrl: string }) {
  if (!isResendConfigured()) {
    return { skipped: true as const };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: getResendFrom(),
    to: params.to,
    subject: passwordResetEmailSubject(),
    html: passwordResetEmailHtml({ resetUrl: params.resetUrl }),
  });
  if (error) return { error: error.message };
  return { data };
}

export async function sendRegistrationEmail(params: { to: string; subject: string; html: string }) {
  if (!isResendConfigured()) {
    console.warn("[email] Resend not configured; skipping registration email");
    return { skipped: true as const };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: getResendFrom(),
    to: params.to,
    subject: params.subject,
    html: params.html,
  });
  if (error) return { error: error.message };
  return { data };
}

/** @deprecated Use sendRegistrationEmail via notifyRegistrantAfterRegistration */
export async function sendRegistrationConfirmedEmail(params: {
  to: string;
  tournamentName: string;
}) {
  return sendRegistrationEmail({
    to: params.to,
    subject: `Registration confirmed — ${params.tournamentName}`,
    html: `<p>Your registration for <strong>${params.tournamentName}</strong> is confirmed.</p>`,
  });
}
