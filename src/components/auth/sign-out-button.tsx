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
  iconOnly = false,
}: {
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  className?: string;
  /** compact icon button (label kept for screen readers) */
  iconOnly?: boolean;
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
      aria-label={iconOnly ? "Sign out" : undefined}
      title={iconOnly ? "Sign out" : undefined}
    >
      <LogOut />
      {!iconOnly && "Sign out"}
    </Button>
  );
}
