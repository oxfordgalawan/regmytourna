"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AuthNavButtons } from "@/components/layout/auth-nav-buttons";
import { useSlidingIndicator } from "@/components/motion/use-sliding-indicator";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/tournaments", label: "Tournaments" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#for-organizers", label: "For organizers" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const tournamentsActive = pathname.startsWith("/tournaments");
  const { ref: navRef, style: pillStyle, ready: pillReady } = useSlidingIndicator<HTMLElement>(tournamentsActive);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close the mobile menu whenever the route changes
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      // stays pinned while page content animates underneath (see globals.css)
      style={{ viewTransitionName: "site-header" }}
      className={cn(
        "sticky top-0 border-b pt-[env(safe-area-inset-top)] transition-colors duration-300",
        open ? "z-[90]" : "z-50",
        scrolled || open
          ? "border-line bg-ink/95 backdrop-blur-md"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav ref={navRef} className="relative hidden items-center gap-1 md:flex" aria-label="Main">
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 rounded-full bg-espresso"
            style={pillStyle}
          />
          {navLinks.map((link) => {
            const active = link.href === "/tournaments" && tournamentsActive;
            return (
              <Link
                key={link.href}
                href={link.href}
                data-active={active}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-4 py-2 text-sm transition-colors duration-300",
                  active
                    ? cn("text-bone", !pillReady && "bg-espresso")
                    : "text-muted-foreground hover:text-bone"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <AuthNavButtons />
        </div>

        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-full border border-line text-bone md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {mounted &&
        open &&
        createPortal(
          <div
            id="mobile-menu"
            className="fixed inset-0 z-[80] flex flex-col bg-ink md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <div className="h-16 shrink-0 pt-[env(safe-area-inset-top)]" aria-hidden />
            <div className="flex min-h-0 flex-1 flex-col border-t border-line px-4 pt-6 pb-[max(2rem,env(safe-area-inset-bottom))] animate-in fade-in-0">
              <nav className="flex flex-col" aria-label="Mobile">
                {navLinks.map((link, i) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="display flex items-center justify-between border-b border-line py-5 text-4xl text-bone animate-rise"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {link.label}
                    <span className="font-mono text-xs font-normal text-muted-foreground">
                      0{i + 1}
                    </span>
                  </Link>
                ))}
              </nav>
              <div className="mt-auto grid gap-2 pt-8 [&>*]:w-full">
                <AuthNavButtons stacked />
              </div>
            </div>
          </div>,
          document.body
        )}
    </header>
  );
}
