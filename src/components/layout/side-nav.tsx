"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useSlidingIndicator } from "@/components/motion/use-sliding-indicator";
import { cn } from "@/lib/utils";

export type SideNavLink = { href: string; label: string; icon: LucideIcon; exact?: boolean };

/** Vertical sidebar nav whose highlight glides to the active item. */
export function SideNav({ links, label }: { links: SideNavLink[]; label: string }) {
  const pathname = usePathname() ?? "";
  const activeHref = links.find((l) =>
    l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/")
  )?.href;
  const { ref, style, ready } = useSlidingIndicator<HTMLElement>(activeHref);

  return (
    <nav
      ref={ref}
      className="relative flex flex-col gap-1"
      aria-label={label}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 rounded-lg bg-espresso"
        style={style}
      >
        <span className="absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-brass" />
      </span>
      {links.map((link) => {
        const active = link.href === activeHref;
        return (
          <Link
            key={link.href}
            href={link.href}
            data-active={active}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-300",
              active
                ? cn("text-bone", !ready && "bg-espresso")
                : "text-muted-foreground hover:bg-espresso/40 hover:text-bone"
            )}
          >
            <link.icon
              className={cn("size-4 transition-colors duration-300", active && "text-brass")}
              aria-hidden
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
