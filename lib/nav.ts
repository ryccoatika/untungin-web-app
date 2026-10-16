import { LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

export type StoreNavItem = { label: string; href: string; icon: LucideIcon };

export function storeNavItems(storeId: string): StoreNavItem[] {
  return [
    { label: "Dashboard", href: `/s/${storeId}/dashboard`, icon: LayoutDashboard },
    { label: "Pengaturan", href: `/s/${storeId}/pengaturan`, icon: Settings },
  ];
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
