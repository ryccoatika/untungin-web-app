import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const FEATURES = ["hpp", "price", "profit"] as const;

export default async function LandingPage() {
  const t = await getTranslations("Landing");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-4 py-16">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-primary">BusinessNote</p>
          <LocaleSwitcher />
        </div>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{t("heading")}</h1>
        <p className="text-lg text-muted-foreground">{t("intro")}</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature} className="rounded-lg border p-4">
            <p className="font-medium">{t(`features.${feature}.title`)}</p>
            <p className="text-sm text-muted-foreground">{t(`features.${feature}.body`)}</p>
          </li>
        ))}
      </ul>
      <Link
        href={loggedIn ? "/mulai" : "/login"}
        className={buttonVariants({ size: "lg", className: "w-full sm:w-auto sm:self-start" })}
      >
        {loggedIn ? t("openApp") : t("startFree")}
      </Link>
    </main>
  );
}
