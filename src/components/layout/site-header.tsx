"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AuthNavButtons } from "@/components/layout/auth-nav-buttons";
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
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled || open
          ? "border-line bg-ink/85 backdrop-blur-md"
          : "border-transparent bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {navLinks.map((link) => {
            const active = link.href === "/tournaments" && pathname.startsWith("/tournaments");
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-full px-4 py-2 text-sm transition-colors",
                  active ? "bg-espresso text-bone" : "text-muted-foreground hover:text-bone"
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

      {open && (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 top-16 bottom-0 z-40 flex flex-col border-t border-line bg-ink px-4 pt-6 pb-8 animate-in fade-in-0 md:hidden"
        >
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
          <div className="mt-auto grid gap-2 [&>*]:w-full">
            <AuthNavButtons stacked />
          </div>
        </div>
      )}
    </header>
  );
}
