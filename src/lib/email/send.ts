import { Resend } from "resend";
import { isResendConfigured } from "@/lib/env/server";

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
    from: "RegMyTourna <onboarding@resend.dev>",
    to: params.to,
    subject: `Partner invite — ${params.tournamentName}`,
    html: `<p>You have been invited to join <strong>${params.tournamentName}</strong>.</p><p><a href="${params.inviteUrl}">Accept invitation</a></p>`,
  });
  if (error) return { error: error.message };
  return { data };
}

export async function sendRegistrationConfirmedEmail(params: {
  to: string;
  tournamentName: string;
}) {
  if (!isResendConfigured()) {
    return { skipped: true as const };
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: "RegMyTourna <onboarding@resend.dev>",
    to: params.to,
    subject: `Registration confirmed — ${params.tournamentName}`,
    html: `<p>Your registration for <strong>${params.tournamentName}</strong> is confirmed.</p>`,
  });
  if (error) return { error: error.message };
  return { data };
}
