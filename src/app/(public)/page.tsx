import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  ClipboardCheck,
  CreditCard,
  GitBranch,
  LayoutGrid,
  MonitorPlay,
  Search,
  Smartphone,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveScoreboard } from "@/components/marketing/live-scoreboard";
import { Marquee } from "@/components/marketing/marquee";
import { Reveal } from "@/components/motion/reveal";
import { TournamentCard } from "@/components/tournaments/tournament-card";
import { listPublicTournaments } from "@/lib/tournaments/queries";
import { isSupabaseConfigured } from "@/lib/env/server";

const playerSteps = [
  {
    title: "Pick your division",
    body: "Filter by city, date and skill bracket. Every fee and cutoff is on the page before you commit.",
  },
  {
    title: "Pay in one go",
    body: "GCash, Maya or card through PayMongo. Your slot is confirmed the moment payment clears.",
  },
  {
    title: "Show up and play",
    body: "Check in at the desk, find your court on the TV board, and follow live scores from your phone.",
  },
];

const organizerTools = [
  {
    icon: ClipboardCheck,
    title: "Registration desk",
    body: "Divisions, capacity caps, waitlists and partner invites — without a spreadsheet in sight.",
    span: "lg:col-span-2",
  },
  {
    icon: CreditCard,
    title: "Payments that reconcile",
    body: "Every entry is tied to a PayMongo payment. Paid and unpaid are never a guess.",
    span: "",
  },
  {
    icon: GitBranch,
    title: "Challonge sync",
    body: "Push confirmed players into your bracket and pull matches back in one click.",
    span: "",
  },
  {
    icon: Smartphone,
    title: "Court-side scoring",
    body: "Referees score on any phone. Undo is one tap; finals need a confirm.",
    span: "",
  },
  {
    icon: MonitorPlay,
    title: "TV display",
    body: "Put the venue board on any screen — courts, matches and scores update live.",
    span: "",
  },
];

export default async function HomePage() {
  let upcoming: Awaited<ReturnType<typeof listPublicTournaments>>["data"] = [];
  if (isSupabaseConfigured()) {
    try {
      const result = await listPublicTournaments({ pageSize: 3 });
      upcoming = result.data;
    } catch {
      upcoming = [];
    }
  }

  return (
    <>
      {/* HERO */}
      <section className="grain relative -mt-16 overflow-hidden pt-16">
        <div className="court-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -top-40 right-0 h-[38rem] w-[38rem] rounded-full bg-umber/40 blur-[140px]" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-24 lg:pb-28">
          <div>
            <p className="eyebrow flex items-center gap-3 animate-rise">
              <span className="h-px w-8 bg-brass" />
              Pickleball first · Built for the Philippines
            </p>
            <h1
              className="display mt-6 text-[clamp(2.9rem,11vw,8.5rem)] text-bone animate-rise"
              style={{ animationDelay: "80ms" }}
            >
              Your tournament
              <br />
              <span className="text-brass">starts</span> here.
            </h1>
            <p
              className="mt-7 max-w-xl text-lg leading-relaxed text-bone/70 animate-rise"
              style={{ animationDelay: "160ms" }}
            >
              Find an event, sign up with your partner and pay — in under two minutes. Organizers
              get the whole desk: entries, payments, brackets and live scores.
            </p>

            <form
              action="/tournaments"
              method="get"
              role="search"
              className="mt-9 flex max-w-xl items-center gap-2 rounded-full border border-line bg-espresso/80 p-1.5 pl-5 backdrop-blur focus-within:border-brass animate-rise"
              style={{ animationDelay: "240ms" }}
            >
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <label htmlFor="hero-search" className="sr-only">
                Search tournaments
              </label>
              <input
                id="hero-search"
                name="q"
                placeholder="City, venue or tournament name"
                className="h-11 min-w-0 flex-1 bg-transparent text-base text-bone outline-none placeholder:text-muted-foreground"
              />
              <Button type="submit" className="rounded-full px-5">
                Find events
              </Button>
            </form>

            <div
              className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm animate-rise"
              style={{ animationDelay: "320ms" }}
            >
              <Link
                href="/signup?type=organizer"
                className="group inline-flex items-center gap-1.5 font-medium text-bone underline decoration-umber decoration-2 underline-offset-[6px] hover:decoration-brass"
              >
                I&apos;m running a tournament
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <span className="text-muted-foreground">Publish an event in minutes</span>
            </div>
          </div>

          <div className="relative animate-rise" style={{ animationDelay: "200ms" }}>
            <LiveScoreboard />
            <div className="absolute -bottom-16 left-6 hidden items-center gap-3 rounded-2xl border border-line bg-ink/90 px-4 py-3 shadow-2xl backdrop-blur sm:flex">
              <span className="flex size-9 items-center justify-center rounded-full bg-bone text-ink">
                <CalendarCheck className="size-4" />
              </span>
              <div className="text-sm">
                <p className="font-medium text-bone">Entry confirmed</p>
                <p className="text-muted-foreground">Mixed Doubles 3.5 · ₱1,200 paid</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Marquee
        items={[
          "Register",
          "Pay",
          "Check in",
          "Brackets",
          "Court calls",
          "Live scores",
          "Results",
        ]}
      />

      {/* UPCOMING */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow">On the calendar</p>
            <h2 className="display mt-3 text-5xl text-bone sm:text-6xl">Upcoming tournaments</h2>
          </div>
          <Button variant="outline" asChild>
            <Link href="/tournaments">
              See all tournaments
              <ArrowUpRight />
            </Link>
          </Button>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {upcoming.map((t, i) => (
            <Reveal key={t.id} delay={i * 90}>
              <TournamentCard tournament={t} />
            </Reveal>
          ))}
          {!upcoming.length && (
            <EmptyState
              icon={Trophy}
              className="sm:col-span-2 lg:col-span-3"
              title="No tournaments on the calendar yet"
              description="Be the first — organizers can publish an event in a few minutes."
              action={
                <Button asChild>
                  <Link href="/signup?type=organizer">List a tournament</Link>
                </Button>
              }
            />
          )}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="scroll-mt-20 border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
          <Reveal className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-end">
            <div>
              <p className="eyebrow">For players</p>
              <h2 className="display mt-3 text-5xl text-bone sm:text-6xl">
                Three steps.
                <br />
                <span className="font-serif text-[0.85em] font-normal normal-case italic text-brass">
                  zero
                </span>{" "}
                group chats.
              </h2>
            </div>
            <p className="max-w-lg text-bone/65 lg:justify-self-end">
              No more screenshotting bank transfers or chasing the organizer on Messenger to ask
              if you&apos;re in.
            </p>
          </Reveal>

          <ol className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
            {playerSteps.map((step, i) => (
              <Reveal as="li" key={step.title} delay={i * 120} className="group bg-surface p-8">
                <span className="display text-8xl text-umber transition-colors duration-500 group-hover:text-brass">
                  0{i + 1}
                </span>
                <h3 className="mt-6 text-xl font-semibold text-bone">{step.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ORGANIZERS */}
      <section id="for-organizers" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-24 sm:px-6">
        <Reveal>
          <p className="eyebrow">For organizers</p>
          <h2 className="display mt-3 max-w-3xl text-5xl text-bone sm:text-6xl">
            Run the whole desk from one tab.
          </h2>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {organizerTools.map((tool, i) => (
            <Reveal
              key={tool.title}
              delay={i * 70}
              className={`group relative overflow-hidden rounded-2xl border border-line bg-surface p-7 transition-colors duration-300 hover:border-umber ${tool.span}`}
            >
              <tool.icon className="size-6 text-brass" aria-hidden />
              <h3 className="mt-10 text-lg font-semibold text-bone">{tool.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.body}</p>
              <span className="pointer-events-none absolute -right-6 -bottom-6 size-24 rounded-full bg-umber/0 blur-2xl transition-colors duration-500 group-hover:bg-umber/60" />
            </Reveal>
          ))}
          <Reveal
            delay={organizerTools.length * 70}
            className="flex flex-col justify-between rounded-2xl bg-bone p-7 text-ink sm:col-span-2 lg:col-span-1"
          >
            <LayoutGrid className="size-6" aria-hidden />
            <div className="mt-10">
              <p className="display text-4xl">Ready in minutes</p>
              <p className="mt-2 text-sm text-ink/70">Standard pickleball divisions are added for you.</p>
              <Button variant="umber" className="mt-5 w-full" asChild>
                <Link href="/signup?type=organizer">
                  Create organizer account
                  <ArrowRight />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24 sm:px-6">
        <Reveal className="grain relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-umber bg-espresso px-6 py-16 text-center sm:px-12 sm:py-24">
          <div className="court-grid pointer-events-none absolute inset-0 opacity-60" />
          <div className="relative">
            <h2 className="display mx-auto max-w-4xl text-[clamp(3rem,8vw,6.5rem)] text-bone">
              See you on court.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-bone/65">
              Find your next event, or put yours on the calendar.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button size="lg" asChild>
                <Link href="/tournaments">Browse tournaments</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/signup?type=organizer">Organize an event</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
