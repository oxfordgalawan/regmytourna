"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env/client";
import { cn } from "@/lib/utils";

export function SignOutButton({
  size = "sm",
  variant = "outline",
  className,
}: {
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const router = useRouter();

  async function handleSignOut() {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button
      variant={variant}
      size={size}
      type="button"
      onClick={handleSignOut}
      className={cn(className)}
    >
      <LogOut />
      Sign out
    </Button>
  );
}
