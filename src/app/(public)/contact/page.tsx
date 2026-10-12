import { ArrowUpRight, Mail } from "lucide-react";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6 sm:py-28">
      <p className="eyebrow">Contact</p>
      <h1 className="display mt-3 text-6xl text-bone sm:text-8xl">Talk to us.</h1>
      <p className="mt-6 max-w-lg text-lg text-bone/70">
        Questions about an event, payments, or running your own tournament? Send us a note.
      </p>
      <a
        href="mailto:hello@regmytourna.com"
        className="group mt-12 flex items-center justify-between gap-6 rounded-2xl border border-umber bg-espresso p-6 transition-colors hover:bg-umber/40 sm:p-8"
      >
        <span className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-bone text-ink">
            <Mail className="size-5" />
          </span>
          <span>
            <span className="eyebrow block">Email</span>
            <span className="mt-1 block text-xl font-medium text-bone sm:text-2xl">
              hello@regmytourna.com
            </span>
          </span>
        </span>
        <ArrowUpRight className="size-6 text-bone transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
      </a>
    </div>
  );
}
