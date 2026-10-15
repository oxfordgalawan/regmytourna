"use client";

import { useState } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { LogOut, Loader2 } from "lucide-react";
import { signOutAction } from "@/app/actions/auth";
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
    try {
      const result = await signOutAction();
      if (result?.error) {
        setBusy(false);
        console.error("[sign-out]", result.error);
        window.location.assign("/");
      }
    } catch (err) {
      if (isRedirectError(err)) throw err;
      setBusy(false);
      console.error("[sign-out]", err);
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
