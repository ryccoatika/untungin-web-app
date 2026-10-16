import { LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

export type StoreNavItem = { labelKey: "dashboard" | "settings"; href: string; icon: LucideIcon };

export function storeNavItems(storeId: string): StoreNavItem[] {
  return [
    { labelKey: "dashboard", href: `/s/${storeId}/dashboard`, icon: LayoutDashboard },
    { labelKey: "settings", href: `/s/${storeId}/pengaturan`, icon: Settings },
  ];
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
