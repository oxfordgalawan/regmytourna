"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { RegistrationAuthDialog } from "@/components/auth/registration-auth-dialog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type AuthTab = "login" | "signup";

export function TournamentRegisterGuestAuth({ variant }: { variant: "sidebar" | "mobile" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<AuthTab>("login");

  function openAuth(nextTab: AuthTab) {
    setTab(nextTab);
    setOpen(true);
  }

  function onAuthenticated() {
    router.refresh();
  }

  const dialog = (
    <RegistrationAuthDialog open={open} onOpenChange={setOpen} initialTab={tab} onAuthenticated={onAuthenticated} />
  );

  if (variant === "mobile") {
    return (
      <>
        <Button size="lg" type="button" onClick={() => openAuth("login")}>
          Register now
        </Button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <div>
        <p className="text-sm leading-relaxed text-bone/75">
          Log in or create a free account to pick a category and pay. It takes about a minute.
        </p>
        <div className="mt-5 grid gap-2">
          <Button size="lg" type="button" onClick={() => openAuth("login")}>
            <LogIn />
            Log in to register
          </Button>
          <Button size="lg" variant="outline" type="button" onClick={() => openAuth("signup")}>
            Create an account
          </Button>
        </div>
      </div>
      {dialog}
    </>
  );
}

/** Mobile bar when user is signed in — scroll to register. */
export function TournamentRegisterNowLink() {
  return (
    <Button size="lg" asChild>
      <Link href="#register">Register now</Link>
    </Button>
  );
}