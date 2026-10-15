"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env/client";
import { PROFILE_UPDATED_EVENT } from "@/lib/profile/events";
import { profileInitials } from "@/lib/profile/initials";
import { cn } from "@/lib/utils";

type AccountState = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

export function UserAccountMenu({ size = "md" }: { size?: "sm" | "md" }) {
  const router = useRouter();
  const [account, setAccount] = useState<AccountState | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setAccount(null);
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    const raw = profile?.avatar_url?.trim();
    setAccount({
      name: profile?.full_name?.trim() || user.email || "Account",
      email: user.email ?? "",
      avatarUrl: raw ? `${raw.split("?")[0]}?t=${Date.now()}` : null,
    });
  }, []);

  useEffect(() => {
    void load();
    const onUpdate = () => void load();
    window.addEventListener(PROFILE_UPDATED_EVENT, onUpdate);
    return () => window.removeEventListener(PROFILE_UPDATED_EVENT, onUpdate);
  }, [load]);

  async function signOut() {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const initials = profileInitials(account?.name ?? "", account?.email) || "U";
  const triggerPx = size === "md" ? "size-10" : "size-9";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={cn(
          "rounded-full ring-2 ring-brass/60 ring-offset-2 ring-offset-ink transition hover:ring-brass focus-visible:outline-none focus-visible:ring-brass",
          triggerPx
        )}
        aria-label="Account menu"
      >
        <Avatar className={cn("size-full after:hidden", size === "md" ? "text-sm" : "text-xs")}>
          {account?.avatarUrl ? <AvatarImage src={account.avatarUrl} alt="" /> : null}
          <AvatarFallback className="bg-espresso text-brass">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56 rounded-xl p-0">
        <div className="px-3 py-2.5">
          <p className="truncate font-semibold text-bone">{account?.name ?? "…"}</p>
          <p className="truncate text-sm text-muted-foreground">{account?.email ?? ""}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="gap-2 px-3 py-2" onClick={() => router.push("/settings")}>
          <UserRound className="size-4" />
          Edit profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" className="gap-2 px-3 py-2" onClick={() => void signOut()}>
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
