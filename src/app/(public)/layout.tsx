import { PageShell } from "@/components/layout/page-shell";
import { RouteTransition } from "@/components/motion/route-transition";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <RouteTransition scope="section">{children}</RouteTransition>
    </PageShell>
  );
}
