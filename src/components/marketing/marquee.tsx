import { cn } from "@/lib/utils";

export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = (
    <ul className="flex shrink-0 items-center" aria-hidden>
      {items.map((item) => (
        <li key={item} className="flex items-center">
          <span className="display px-8 text-3xl text-bone/90 sm:text-4xl">{item}</span>
          <span className="size-2 rotate-45 bg-brass" />
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={cn(
        "group relative flex overflow-hidden border-y border-umber bg-umber/25 py-5 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]",
        className
      )}
    >
      <p className="sr-only">{items.join(", ")}</p>
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {row}
        {row}
      </div>
    </div>
  );
}
