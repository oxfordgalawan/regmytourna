import { AppAreaLayout } from "@/components/layout/app-area-layout";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppAreaLayout>{children}</AppAreaLayout>;
}
