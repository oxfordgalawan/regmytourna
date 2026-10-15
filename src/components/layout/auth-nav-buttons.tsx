"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env/client";
import { isSuperAdmin } from "@/lib/auth/is-super-admin";

export function AuthNavButtons({ stacked = false }: { stacked?: boolean }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [homeHref, setHomeHref] = useState("/dashboard");
  const [superAdmin, setSuperAdmin] = useState(false);
  const size = stacked ? "lg" : "sm";

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      setLoggedIn(Boolean(user));
      if (user && isSuperAdmin(user)) {
        setSuperAdmin(true);
        setHomeHref("/super-admin");
      } else {
        setSuperAdmin(false);
        setHomeHref("/dashboard");
      }
    });
  }, []);

  if (loggedIn) {
    return (
      <>
        {superAdmin && (
          <span className="hidden rounded-full border border-brass/40 bg-brass/10 px-2.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-brass md:inline">
            Super admin
          </span>
        )}
        <Button size={size} asChild>
          <Link href={homeHref}>
            {superAdmin ? "Platform console" : "My dashboard"}
            <ArrowUpRight />
          </Link>
        </Button>
        <UserAccountMenu />
      </>
    );
  }

  return (
    <>
      <Button variant={stacked ? "outline" : "ghost"} size={size} asChild>
        <Link href="/login">Log in</Link>
      </Button>
      <Button size={size} asChild>
        <Link href="/signup">
          Create free account
          <ArrowUpRight />
        </Link>
      </Button>
    </>
  );
}
