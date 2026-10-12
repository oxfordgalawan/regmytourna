import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = { title: "Sign up" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  return (
    <AuthShell
      title="Create your account"
      subtitle="Join as a player or organizer — you can do both on RegMyTourna."
    >
      <SignupForm defaultAccountType={type} />
    </AuthShell>
  );
}
