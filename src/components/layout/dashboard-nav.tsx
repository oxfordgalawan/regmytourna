import { Compass, LayoutDashboard, Settings, Trophy, Wallet } from "lucide-react";
import type { SideNavLink } from "@/components/layout/side-nav";

/** Main navigation for players and organizers (sidebar on desktop, tab bar on mobile). */
export const dashboardLinks: SideNavLink[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/organizer/tournaments", label: "My events", icon: Trophy },
  { href: "/organizer/wallet", label: "Wallet", icon: Wallet },
  { href: "/tournaments", label: "Browse", icon: Compass },
  { href: "/settings", label: "Settings", icon: Settings },
];
