import Link from "next/link";
import { ArrowRight, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyAndSettle } from "@/lib/payments/settle";

export default async function RegisterSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ registration?: string; venue?: string; waitlist?: string }>;
}) {
  const { slug } = await params;
  const { registration, venue, waitlist } = await searchParams;
  const atVenue = venue === "1";
  const position = waitlist ? Number(waitlist) || null : null;
  const onWaitlist = waitlist !== undefined;
  // back from PayMongo: confirm the payment right away instead of waiting on the webhook
  if (registration && !atVenue && !onWaitlist && /^[0-9a-f-]{36}$/i.test(registration)) {
    await verifyAndSettle(registration).catch(() => undefined);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center sm:py-28">
      <span className="mx-auto flex size-20 items-center justify-center rounded-full border border-umber bg-espresso animate-in zoom-in-50 duration-500">
        <span className="flex size-12 items-center justify-center rounded-full bg-bone text-ink">
          {onWaitlist ? <Clock className="size-6" strokeWidth={2.5} /> : <Check className="size-6" strokeWidth={3} />}
        </span>
      </span>
      <h1 className="display mt-8 text-6xl text-bone animate-rise">
        {onWaitlist ? (position ? `Waitlist #${position}.` : "On the waitlist.") : atVenue ? "Slot reserved." : "You\u2019re in."}
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
        {onWaitlist
          ? "No payment yet. If a slot opens we'll move you in automatically and email you to choose how to pay."
          : atVenue
          ? "Pay at the registration desk on the day — cash or QR. You're confirmed once you've paid."
          : "Your entry is saved."}
      </p>

      <ol className="mx-auto mt-10 max-w-sm space-y-3 text-left text-sm animate-rise [animation-delay:200ms]">
        {(onWaitlist
          ? [
              "Your waitlist spot appears in My entries.",
              "When a team drops out, the next in line moves up — we'll email you.",
              "Then pick pay online or at the venue. Entry fees are non-refundable once paid.",
            ]
          : [
          "Your entry now appears on your dashboard.",
          atVenue ? "Bring your entry fee — the desk takes cash or QR." : "Track payment and confirmation status from there.",
          "On the day, check in at the desk before your first match.",
        ]).map((item, i) => (
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
