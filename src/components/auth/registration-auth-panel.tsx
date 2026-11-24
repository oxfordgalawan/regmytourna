"use client";

import { useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { SignupForm } from "@/components/auth/signup-form";
import { cn } from "@/lib/utils";

type AuthTab = "login" | "signup";

export function RegistrationAuthPanel({
  onAuthenticated,
  defaultTab = "login",
}: {
  onAuthenticated?: () => void;
  defaultTab?: AuthTab;
}) {
  const [tab, setTab] = useState<AuthTab>(defaultTab);

  return (
    <div className="space-y-5">
      <div>
        <p className="eyebrow text-brass">Sign in</p>
        <p className="display mt-1 text-2xl text-bone">Log in or create an account</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Continue here — you won&apos;t leave this screen.
        </p>
      </div>

      <div
        className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-ink/40 p-1"
        role="tablist"
        aria-label="Account"
      >
        {(
          [
            ["login", "Log in"],
            ["signup", "Create account"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === value ? "bg-bone text-ink" : "text-muted-foreground hover:text-bone"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "login" ? (
        <LoginForm
          embedded
          idPrefix="drawer-auth-login-"
          onSwitchToSignup={() => setTab("signup")}
          onAuthenticated={onAuthenticated}
        />
      ) : (
        <SignupForm
          defaultAccountType="player"
          embedded
          idPrefix="drawer-auth-signup-"
          onSwitchToLogin={() => setTab("login")}
          onAuthenticated={onAuthenticated}
        />
      )}
    </div>
  );
}