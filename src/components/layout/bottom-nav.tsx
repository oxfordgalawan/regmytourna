"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSlidingIndicator } from "@/components/motion/use-sliding-indicator";
import type { SideNavLink } from "@/components/layout/side-nav";
import { cn } from "@/lib/utils";

/** Phone/tablet tab bar. The highlight glides between tabs like the sidebar's. */
export function BottomNav({ links, label }: { links: SideNavLink[]; label: string }) {
  const pathname = usePathname() ?? "";
  const activeHref = links.find((l) =>
    l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(l.href + "/")
  )?.href;
  const { ref, style, ready } = useSlidingIndicator<HTMLDivElement>(activeHref);

  return (
    <nav
      aria-label={label}
      style={{ viewTransitionName: "app-bottom-nav" }}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] backdrop-blur-md lg:hidden"
    >
      <div
        ref={ref}
        className="relative mx-auto grid h-[4.25rem] max-w-xl"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
      >
        <span aria-hidden className="pointer-events-none absolute top-0 left-0 flex justify-center" style={style}>
          <span className="mt-2 h-8 w-14 rounded-full bg-umber" />
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
                "relative flex flex-col items-center justify-start gap-1 pt-2 text-[0.65rem] font-medium transition-colors duration-300 active:scale-95",
                active ? "text-bone" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                  active && !ready && "bg-umber"
                )}
              >
                <link.icon className={cn("size-5", active && "text-bone")} aria-hidden />
              </span>
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
