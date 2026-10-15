"use client";

import { useState, type ReactNode } from "react";
import { ZoomIn } from "lucide-react";
import { ImageLightbox } from "@/components/images/image-lightbox";
import { cn } from "@/lib/utils";

export function TournamentCoverHero({
  coverUrl,
  tournamentName,
  children,
  className,
}: {
  coverUrl: string | null | undefined;
  tournamentName: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section
      className={cn(
        "grain relative flex min-h-[min(72vh,44rem)] flex-col overflow-hidden border-b border-line sm:min-h-[min(68vh,48rem)]",
        className
      )}
    >
      {coverUrl && (
        <>
          <button
            type="button"
            aria-label={`View full cover image for ${tournamentName}`}
            onClick={() => setOpen(true)}
            className="absolute inset-0 z-0 cursor-zoom-in border-0 bg-ink p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass focus-visible:ring-offset-2 focus-visible:ring-offset-ink"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt=""
              fetchPriority="high"
              className="size-full object-cover object-[center_35%] opacity-55 sm:opacity-50"
            />
          </button>
          <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-ink via-ink/80 to-ink/25" />
          <span className="pointer-events-none absolute right-4 top-4 z-[2] flex items-center gap-1.5 rounded-full border border-bone/20 bg-ink/60 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-bone/80 backdrop-blur-sm sm:right-6 sm:top-6">
            <ZoomIn className="size-3.5" aria-hidden />
            Tap to enlarge
          </span>
          <ImageLightbox
            open={open}
            onOpenChange={setOpen}
            src={coverUrl}
            alt={`${tournamentName} cover`}
            title={tournamentName}
          />
        </>
      )}
      <div className="court-grid pointer-events-none absolute inset-0 z-[1] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
      <div className="relative z-10 flex flex-1 flex-col">{children}</div>
    </section>
  );
}
