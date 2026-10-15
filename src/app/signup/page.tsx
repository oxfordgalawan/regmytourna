import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { findInviteByToken } from "@/lib/registrations/partner-invites";
import { findSubstitution } from "@/lib/registrations/team-changes";

export const metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; next?: string; email?: string; invite?: string; substitute?: string }>;
}) {
  const { type, next, email, invite: token, substitute } = await searchParams;
  const invite = token ? await findInviteByToken(token) : null;
  const usable = invite && invite.status !== "declined" && !invite.linkedUserId;
  const sub = substitute ? await findSubstitution(substitute) : null;
  const subOpen = sub?.sub.status === "pending" && sub.leaving ? sub : null;
  return (
    <AuthShell
      title={usable || subOpen ? "Join your team" : "Create your account"}
      subtitle={
        subOpen
          ? `${subOpen.leaving!.name} asked you to take their place in ${subOpen.team.event.categoryName} at ${subOpen.team.event.tournamentName}. Create a free account and you're in.`
          : usable
            ? invite.partnerLeft
              ? `Your partner left ${invite.categoryName} at ${invite.tournament.name}, but your slot is held. Create a free account to keep it.`
              : `${invite.registrantName} added you to ${invite.categoryName} at ${invite.tournament.name}. Create a free account and the entry is yours too.`
            : "Join as a player or organizer — you can do both on RegMyTourna."
      }
    >
      <SignupForm
        defaultAccountType={type}
        next={next}
        defaultEmail={
          email ?? (subOpen ? subOpen.sub.substitute_email : usable ? invite.partnerEmail ?? undefined : undefined)
        }
        defaultName={subOpen ? subOpen.sub.substitute_name : usable ? invite.partnerName ?? undefined : undefined}
        inviteToken={usable ? token : undefined}
        substituteToken={subOpen ? substitute : undefined}
      />
    </AuthShell>
  );
}
