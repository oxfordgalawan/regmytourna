"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/** Warm tones from the palette; a player always gets the same one. */
const TONES = [
  "from-[#5a3d22] to-[#2a1d12]",
  "from-[#6b4a2b] to-[#1f1610]",
  "from-[#45301a] to-[#140e09]",
  "from-[#7a5634] to-[#2e2014]",
  "from-[#3d2b1c] to-[#0f0b07]",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : (parts[0][1] ?? "");
  return (first + last).toUpperCase();
}

/** Profile photo when there is one; otherwise initials on a warm gradient. */
export function PlayerAvatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showPhoto = src && !broken;
  return (
    <span
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-espresso",
        !showPhoto && "bg-gradient-to-br",
        !showPhoto && TONES[hash(name) % TONES.length],
        className
      )}
      title={name}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="size-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <>
          {/* faint court line behind the letters */}
          <svg viewBox="0 0 40 40" aria-hidden className="absolute inset-0 size-full text-bone/10">
            <path d="M0 26h40M20 26v14" stroke="currentColor" strokeWidth="1" fill="none" />
          </svg>
          <span className="relative font-semibold tracking-wide text-bone text-[0.8em]">{initials(name)}</span>
        </>
      )}
    </span>
  );
}
