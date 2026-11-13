import Link from "next/link";
import { ChevronDown } from "lucide-react";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/**
 * Layout for the Terms and Privacy pages: title, "in short" summary, a table
 * of contents (sticky on desktop, collapsible on phones) and numbered sections.
 */
export function LegalDoc({
  title,
  updated,
  intro,
  summary,
  sections,
  other,
}: {
  title: string;
  updated: string;
  intro: React.ReactNode;
  summary: string[];
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  const toc = (
    <ol className="space-y-1 text-sm">
      {sections.map((s, i) => (
        <li key={s.id}>
          <a href={`#${s.id}`} className="flex gap-2 rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-bone/[0.05] hover:text-bone">
            <span className="w-5 shrink-0 font-mono text-xs leading-5 text-brass/80">{i + 1}</span>
            <span>{s.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-16 pb-24 sm:px-6 lg:pt-20">
      <header className="max-w-3xl">
        <p className="eyebrow text-muted-foreground">Legal</p>
        <h1 className="display mt-3 text-5xl text-bone sm:text-6xl">{title}</h1>
        <p className="mt-3 font-mono text-xs text-muted-foreground">Last updated {updated}</p>
        <div className="mt-6 text-base leading-relaxed text-bone/75">{intro}</div>
      </header>

      <div className="mt-12 grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <details className="group rounded-xl border border-line bg-espresso/50 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium text-bone">
              On this page
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-line p-2">{toc}</div>
          </details>
          <div className="hidden lg:block">
            <p className="eyebrow mb-3 px-2 text-muted-foreground">On this page</p>
            {toc}
            <Link href={other.href} className="mt-6 block px-2 text-sm text-brass hover:underline">
              {other.label} →
            </Link>
          </div>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <section className="rounded-2xl border border-brass/30 bg-brass/[0.06] p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-bone">In short</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-bone/80">
              {summary.map((s) => (
                <li key={s} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brass" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              This summary is for convenience. The full text below is what applies.
            </p>
          </section>

          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 border-b border-line py-9 last:border-b-0">
              <h2 className="flex items-baseline gap-3 text-xl font-semibold text-bone sm:text-2xl">
                <span className="font-mono text-sm text-brass">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </h2>
              <div className="legal-body mt-4 space-y-4 text-[0.95rem] leading-relaxed text-bone/75 [&_a]:text-brass [&_a]:underline-offset-4 hover:[&_a]:underline [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-bone [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-bone [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-brass">
                {s.body}
              </div>
            </section>
          ))}

          <Link href={other.href} className="mt-6 inline-block text-sm text-brass hover:underline lg:hidden">
            {other.label} →
          </Link>
        </article>
      </div>
    </div>
  );
}
