import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <AuthShell
      title="Welcome back."
      subtitle="Sign in to manage your tournaments and registrations."
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
