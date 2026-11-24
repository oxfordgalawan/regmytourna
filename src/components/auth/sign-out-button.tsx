"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { performSignOut } from "@/lib/auth/perform-sign-out";
import { Button, type ButtonProps } from "@/components/ui/button";
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
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    const result = await performSignOut();
    if (result.error) {
      setBusy(false);
      console.error("[sign-out]", result.error);
      window.location.assign("/");
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      type="button"
      disabled={busy}
      onClick={() => void handleSignOut()}
      className={cn(className)}
      aria-label={iconOnly ? "Sign out" : undefined}
      title={iconOnly ? "Sign out" : undefined}
    >
      {busy ? <Loader2 className="animate-spin" /> : <LogOut />}
      {!iconOnly && (busy ? "Signing out…" : "Sign out")}
    </Button>
  );
}
