import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { findInviteByToken } from "@/lib/registrations/partner-invites";

export const metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; next?: string; email?: string; invite?: string }>;
}) {
  const { type, next, email, invite: token } = await searchParams;
  const invite = token ? await findInviteByToken(token) : null;
  const usable = invite && invite.status !== "declined" && !invite.linkedUserId;
  return (
    <AuthShell
      title={usable ? "Join your team" : "Create your account"}
      subtitle={
        usable
          ? `${invite.registrantName} added you to ${invite.categoryName} at ${invite.tournament.name}. Create a free account and the entry is yours too.`
          : "Join as a player or organizer — you can do both on RegMyTourna."
      }
    >
      <SignupForm
        defaultAccountType={type}
        next={next}
        defaultEmail={email ?? (usable ? invite.partnerEmail ?? undefined : undefined)}
        defaultName={usable ? invite.partnerName ?? undefined : undefined}
        inviteToken={usable ? token : undefined}
      />
    </AuthShell>
  );
}
