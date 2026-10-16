import {
  Home,
  Megaphone,
  Calendar,
  ImageIcon,
  Sparkles,
  BarChart3,
  TrendingUp,
  ShieldCheck,
  Settings,
  CreditCard,
  Smartphone,
  Plug,
  Search,
  Users,
  CircleHelp,
  LifeBuoy,
} from "lucide-react";
import type { ComponentType } from "react";

export type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

export const nav: NavItem[] = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/ai-studio", label: "AI Studio", icon: Sparkles },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/assets", label: "Assets", icon: ImageIcon },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/growth-intelligence", label: "Growth", icon: TrendingUp },
  { href: "/seo", label: "SEO", icon: Search },
  { href: "/compliance-center", label: "Compliance", icon: ShieldCheck },
  { href: "/integrations", label: "Integrations", icon: Plug },
  { href: "/devices", label: "Devices", icon: Smartphone },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/workspace", label: "Workspace", icon: Users },
  { href: "/help", label: "Help Center", icon: CircleHelp },
  { href: "/support", label: "Support", icon: LifeBuoy },
  { href: "/settings", label: "Settings", icon: Settings },
];
