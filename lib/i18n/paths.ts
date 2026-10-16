import { routing, type AppLocale } from "@/i18n/routing";

function isAppLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value);
}

/** Splits "/en/s/x" into { locale: "en", rest: "/s/x" }; unprefixed paths get locale null. */
export function splitLocale(pathname: string): { locale: AppLocale | null; rest: string } {
  const [, first = "", ...tail] = pathname.split("/");
  if (!isAppLocale(first)) return { locale: null, rest: pathname };
  const rest = `/${tail.join("/")}`.replace(/\/+$/, "");
  return { locale: first, rest: rest === "" ? "/" : rest };
}

/** Puts `path` (which may carry ?query/#hash and an existing prefix) under `locale`. */
export function withLocale(path: string, locale: AppLocale): string {
  const cut = path.search(/[?#]/);
  const pathname = cut === -1 ? path : path.slice(0, cut);
  const suffix = cut === -1 ? "" : path.slice(cut);
  const { rest } = splitLocale(pathname || "/");
  return `${rest === "/" ? `/${locale}` : `/${locale}${rest}`}${suffix}`;
}
