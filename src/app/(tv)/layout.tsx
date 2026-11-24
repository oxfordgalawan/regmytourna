/** TV / venue displays: no site header or footer. */
export default function TvLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh flex-1">{children}</div>;
}