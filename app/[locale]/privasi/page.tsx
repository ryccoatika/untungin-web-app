import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";

const OPERATOR = { name: "Rycco Atika", email: "me@ryccoatika.com" };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Privacy");
  return { title: t("title") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");
  const mail = (chunks: React.ReactNode) => (
    <a href={`mailto:${OPERATOR.email}`} className="font-medium underline underline-offset-4">
      {chunks}
    </a>
  );
  const section = (title: string, children: React.ReactNode) => (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10 text-sm leading-relaxed [overflow-wrap:anywhere]">
      <div className="flex items-center justify-between gap-2">
        <BrandLogo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("updated")}</p>
      </header>
      <p>{t("intro")}</p>
      {section(t("whoTitle"), <p>{t.rich("whoBody", { name: OPERATOR.name, email: OPERATOR.email, mail })}</p>)}
      {section(
        t("dataTitle"),
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("dataAccount")}</li>
          <li>{t("dataStore")}</li>
          <li>{t("dataAi")}</li>
        </ul>,
      )}
      {section(t("useTitle"), <p>{t("useBody")}</p>)}
      {section(
        t("thirdTitle"),
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("thirdSupabase")}</li>
          <li>{t("thirdGoogle")}</li>
          <li>{t("thirdGemini")}</li>
          <li>{t("thirdVercel")}</li>
        </ul>,
      )}
      {section(t("storageTitle"), <p>{t("storageBody")}</p>)}
      {section(t("deleteTitle"), <p>{t("deleteBody")}</p>)}
      {section(t("rightsTitle"), <p>{t.rich("rightsBody", { email: OPERATOR.email, mail })}</p>)}
    </main>
  );
}
