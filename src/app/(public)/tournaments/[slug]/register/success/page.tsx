import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function RegisterSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ registration?: string; venue?: string }>;
}) {
  const { slug } = await params;
  const { registration, venue } = await searchParams;
  const atVenue = venue === "1";

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:py-28">
      <span className="mx-auto flex size-20 items-center justify-center rounded-full border border-umber bg-espresso animate-in zoom-in-50 duration-500">
        <span className="flex size-12 items-center justify-center rounded-full bg-bone text-ink">
          <Check className="size-6" strokeWidth={3} />
        </span>
      </span>
      <h1 className="display mt-8 text-6xl text-bone animate-rise">
        {atVenue ? "Slot reserved." : "You\u2019re in."}
      </h1>
      <p className="mx-auto mt-5 max-w-md text-bone/70 animate-rise [animation-delay:100ms]">
        Your registration is recorded
        {registration && (
          <>
            {" "}
            — reference <span className="font-mono text-bone">{registration.slice(0, 8).toUpperCase()}</span>
          </>
        )}
        .{" "}
        {atVenue
          ? "Pay at the registration desk on the day — cash or QR. You're confirmed once you've paid."
          : "Your entry is saved."}
      </p>

      <ol className="mx-auto mt-10 max-w-sm space-y-3 text-left text-sm animate-rise [animation-delay:200ms]">
        {[
          "Your entry now appears on your dashboard.",
          atVenue ? "Bring your entry fee — the desk takes cash or QR." : "Track payment and confirmation status from there.",
          "On the day, check in at the desk before your first match.",
        ].map((item, i) => (
          <li key={item} className="flex gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <span className="font-mono text-brass">0{i + 1}</span>
            <span className="text-bone/80">{item}</span>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Button size="lg" asChild>
          <Link href="/dashboard">
            Go to my dashboard
            <ArrowRight />
          </Link>
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href={`/tournaments/${slug}`}>Back to tournament</Link>
        </Button>
      </div>
    </div>
  );
}
