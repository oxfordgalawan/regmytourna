import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const columns = [
  {
    title: "Play",
    links: [
      { href: "/tournaments", label: "Find a tournament" },
      { href: "/dashboard", label: "My registrations" },
      { href: "/signup", label: "Create an account" },
    ],
  },
  {
    title: "Organize",
    links: [
      { href: "/signup?type=organizer", label: "Start organizing" },
      { href: "/organizer/tournaments", label: "Organizer tools" },
      { href: "/settings/connections", label: "Challonge sync" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-ink">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo />
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Registration, payments, brackets and live scores for pickleball — and whatever sport
            you run next.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="eyebrow">{col.title}</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-bone/75 transition-colors hover:text-bone"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="overflow-hidden border-t border-line">
        <p
          aria-hidden
          className="display mx-auto max-w-7xl translate-y-[18%] px-4 text-[22vw] leading-none text-espresso select-none sm:px-6 lg:text-[15rem]"
        >
          RegMyTourna
        </p>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5 font-mono text-xs text-muted-foreground sm:px-6">
          <span>© 2026 RegMyTourna</span>
          <span>Made for courts in the Philippines</span>
        </div>
      </div>
    </footer>
  );
}
