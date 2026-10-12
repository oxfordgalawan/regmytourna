import { PageShell } from "@/components/layout/page-shell";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PageShell>{children}</PageShell>;
}
