import Link from "next/link";
import { NAV_BACK } from "@/lib/nav-transitions";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/logo";

/** Top-down pickleball court, drawn to scale (20ft × 44ft, 7ft kitchen). */
function CourtDiagram() {
  return (
    <svg viewBox="0 0 220 440" className="h-full w-auto" fill="none" aria-hidden>
      <rect x="1" y="1" width="218" height="438" stroke="var(--bone)" strokeOpacity="0.35" strokeWidth="2" />
      <path d="M1 220h218" stroke="var(--bone)" strokeOpacity="0.6" strokeWidth="3" />
      <path d="M1 143h218M1 297h218" stroke="var(--bone)" strokeOpacity="0.35" strokeWidth="2" />
      <path d="M110 1v142M110 297v142" stroke="var(--bone)" strokeOpacity="0.35" strokeWidth="2" />
      <rect x="1" y="143" width="218" height="154" fill="var(--umber)" fillOpacity="0.35" />
      <circle cx="160" cy="80" r="6" fill="var(--bone)" className="animate-pulse-dot" />
    </svg>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-5 py-8 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between">
          <Logo />
          <Link
            transitionTypes={NAV_BACK}
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-bone"
          >
            <ArrowLeft className="size-4" />
            Back to site
          </Link>
        </div>
        <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-12">
          <h1 className="display text-5xl text-bone sm:text-6xl animate-rise">{title}</h1>
          <p className="mt-3 text-bone/65 animate-rise [animation-delay:80ms]">{subtitle}</p>
          <div className="mt-10 animate-rise [animation-delay:160ms]">{children}</div>
        </main>
      </div>

      <div
        className="grain relative hidden overflow-hidden border-l border-umber bg-espresso lg:block"
        aria-hidden
      >
        <div className="court-grid absolute inset-0 opacity-70" />
        <div className="absolute inset-y-16 right-[-9rem] opacity-50">
          <CourtDiagram />
        </div>
        <div className="absolute -top-32 -left-32 size-[30rem] rounded-full bg-umber/50 blur-[120px]" />
        <div className="relative flex h-full flex-col justify-between p-14">
          <p className="eyebrow text-bone/70">RegMyTourna · Tournament desk</p>
          <div>
            <p className="display max-w-md text-7xl text-bone xl:text-8xl">
              Register.
              <br />
              Pay.
              <br />
              <span className="text-brass">Compete.</span>
            </p>
            <p className="mt-6 max-w-sm text-bone/60">
              One account for every event — whether you&apos;re holding the paddle or the
              clipboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
