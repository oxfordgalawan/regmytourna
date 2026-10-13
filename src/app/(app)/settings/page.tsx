import Link from "next/link";
import { ArrowUpRight, Bell, KeyRound, Link2, UserRound } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/settings/profile-form";
import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "Settings" };

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-6 border-t border-line py-10 first:border-t-0 first:pt-0 lg:grid-cols-[16rem_1fr] lg:gap-12">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-brass" aria-hidden />
        <div>
          <h2 className="font-semibold text-bone">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div>{children}</div>
    </section>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Account" title="Settings" />

      <div>
        <SettingsSection
          icon={UserRound}
          title="Profile"
          description="How you appear to organizers and partners."
        >
          <ProfileForm userId={user.id} profile={profile} email={user.email ?? ""} />
        </SettingsSection>

        <SettingsSection icon={KeyRound} title="Password" description="We'll email you a secure reset link.">
          <Button variant="outline" asChild>
            <Link href="/forgot-password">Change password</Link>
          </Button>
        </SettingsSection>

        <SettingsSection
          icon={Link2}
          title="Connected accounts"
          description="Optional: copy brackets to Challonge if you want them there too."
        >
          <Link
            href="/settings/connections"
            className="group flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-4 transition-colors hover:border-umber"
          >
            <span>
              <span className="block font-medium text-bone">Challonge</span>
              <span className="block text-sm text-muted-foreground">Manage connection</span>
            </span>
            <ArrowUpRight className="size-5 text-muted-foreground transition-colors group-hover:text-bone" />
          </Link>
        </SettingsSection>

        <SettingsSection
          icon={Bell}
          title="Notifications"
          description="Transactional emails only — no marketing."
        >
          <p className="max-w-lg text-sm leading-relaxed text-bone/70">
            Partner invites are emailed when you register for a doubles division. There&apos;s
            nothing to configure here yet.
          </p>
        </SettingsSection>
      </div>
    </div>
  );
}
