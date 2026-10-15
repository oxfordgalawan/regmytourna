import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata = {
  title: "Reset password",
};

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Choose a new password"
      subtitle="You're signed in from your reset link. Pick a strong password you have not used elsewhere."
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
