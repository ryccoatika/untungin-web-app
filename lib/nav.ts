import {
  Armchair,
  Ellipsis,
  FlaskConical,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingBasket,
  Sparkles,
  Store,
  type LucideIcon,
} from "lucide-react";

export type NavLabelKey = "dashboard" | "products" | "materials" | "channels" | "expenses" | "assets" | "simulation" | "analysis" | "settings" | "more";
export type StoreNavItem = { labelKey: NavLabelKey; href: string; icon: LucideIcon };

type PageKey = Exclude<NavLabelKey, "more">;

const PAGES: Record<PageKey, { path: string; icon: LucideIcon }> = {
  dashboard: { path: "dashboard", icon: LayoutDashboard },
  products: { path: "produk", icon: Package },
  materials: { path: "bahan", icon: ShoppingBasket },
  channels: { path: "kanal", icon: Store },
  expenses: { path: "biaya", icon: Receipt },
  assets: { path: "inventaris", icon: Armchair },
  simulation: { path: "simulasi", icon: FlaskConical },
  analysis: { path: "analisis", icon: Sparkles },
  settings: { path: "pengaturan", icon: Settings },
};

const MORE_KEYS = ["channels", "expenses", "assets", "simulation", "analysis", "settings"] as const;
export type MoreNavKey = (typeof MORE_KEYS)[number];

function item<K extends PageKey>(storeId: string, key: K): StoreNavItem & { labelKey: K } {
  return { labelKey: key, href: `/s/${storeId}/${PAGES[key].path}`, icon: PAGES[key].icon };
}

/** Desktop sidebar: every store page. */
export function storeNavItems(storeId: string): StoreNavItem[] {
  return (["dashboard", "products", "materials", "channels", "expenses", "assets", "simulation", "analysis", "settings"] as const).map((key) => item(storeId, key));
}

/** Phone bottom bar (spec §5.2): Dashboard, Produk, Bahan, Lainnya. */
export function bottomNavItems(storeId: string): StoreNavItem[] {
  return [
    ...(["dashboard", "products", "materials"] as const).map((key) => item(storeId, key)),
    { labelKey: "more", href: `/s/${storeId}/lainnya`, icon: Ellipsis },
  ];
}

/** Pages listed on the "Lainnya" page. */
export function moreNavItems(storeId: string): (StoreNavItem & { labelKey: MoreNavKey })[] {
  return MORE_KEYS.map((key) => item(storeId, key));
}

export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** "Lainnya" stays highlighted on its own page and on every page it links to. */
export function isMoreActive(pathname: string, storeId: string): boolean {
  return (
    isNavActive(pathname, `/s/${storeId}/lainnya`) || moreNavItems(storeId).some((entry) => isNavActive(pathname, entry.href))
  );
}
