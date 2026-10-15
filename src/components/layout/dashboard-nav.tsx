import { Compass, Home, LayoutDashboard, Ticket, Trophy, UserRound, Wallet } from "lucide-react";
import type { SideNavLink } from "@/components/layout/side-nav";

/** Players: find events, track entries. No organizer tools, no wallet. */
export const playerLinks: SideNavLink[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/entries", label: "My entries", icon: Ticket },
  { href: "/settings", label: "Profile", icon: UserRound },
];

/** Organizers: run events and get paid. Their own entries live in the player view. */
export const organizerLinks: SideNavLink[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/organizer/tournaments", label: "My events", icon: Trophy },
  { href: "/organizer/wallet", label: "Wallet", icon: Wallet },
  { href: "/settings", label: "Profile", icon: UserRound },
];
