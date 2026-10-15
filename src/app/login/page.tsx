import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; message?: string }>;
}) {
  const { next, message } = await searchParams;
  return (
    <AuthShell
      title="Welcome back."
      subtitle="Sign in to manage your tournaments and registrations."
    >
      <LoginForm next={next} flashMessage={message === "password_updated" ? "Your password was updated. Sign in with your new password." : undefined} />
    </AuthShell>
  );
}
