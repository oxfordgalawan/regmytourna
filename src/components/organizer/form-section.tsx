import { cn } from "@/lib/utils";

/** Numbered step in the create-tournament form. */
export function FormSection({
  step,
  title,
  description,
  wide = false,
  children,
}: {
  step: number;
  title: string;
  description: string;
  /** stack the heading above the content so it can use the full width */
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid gap-6 border-t border-line py-10 first:border-t-0 first:pt-0",
        !wide && "lg:grid-cols-[15rem_1fr] lg:gap-12"
      )}
    >
      <div className={cn(wide && "max-w-xl")}>
        <p className="font-mono text-xs text-brass">0{step}</p>
        <h2 className="mt-2 text-lg font-semibold text-bone">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">{children}</div>
    </section>
  );
}
