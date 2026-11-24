import { QuickScoreSetupForm } from "@/components/quick-score/quick-score-setup-form";

export const metadata = {
  title: "Umpire tool",
  description: "Free pickleball scoring — no account. Share a live TV scoreboard link.",
};

export default function UmpireToolPage() {
  return (
    <main id="main" className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
      <div className="mx-auto max-w-xl text-center">
        <p className="eyebrow">Free · no account</p>
        <h1 className="display mt-3 text-5xl text-bone sm:text-6xl">Umpire tool</h1>
        <p className="mt-4 text-muted-foreground">
          Enter player names, score on your phone with the same court-side board as tournament umpires, then share a link or QR
          for the TV.
        </p>
      </div>
      <div className="mt-10">
        <QuickScoreSetupForm />
      </div>
    </main>
  );
}