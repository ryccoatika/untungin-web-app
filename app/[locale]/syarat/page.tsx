import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import type { AppLocale } from "@/i18n/routing";
import { OPERATOR } from "@/lib/legal/operator";
import { publicPageMetadata, SITE_NAME } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Terms");
  const locale = (await getLocale()) as AppLocale;
  return { title: t("title"), ...publicPageMetadata(locale, "/syarat", `${t("title")} · ${SITE_NAME}`, t("summary")) };
}

export default async function TermsPage() {
  const t = await getTranslations("Terms");
  const mail = (chunks: React.ReactNode) => (
    <a href={`mailto:${OPERATOR.email}`} className="font-medium underline underline-offset-4">
      {chunks}
    </a>
  );
  const privacy = (chunks: React.ReactNode) => (
    <Link href="/privasi" className="font-medium underline underline-offset-4">
      {chunks}
    </Link>
  );
  const section = (title: string, children: React.ReactNode, id?: string) => (
    <section id={id} className="scroll-mt-6 space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
  const list = (key: string) => (
    <ul className="list-disc space-y-1 pl-5">
      {(t.raw(key) as string[]).map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10 text-sm leading-relaxed [overflow-wrap:anywhere]">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="inline-flex min-h-10 items-center rounded-md">
          <BrandLogo />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />
        </div>
      </div>
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("updated")}</p>
      </header>
      <p>{t("summary")}</p>
      {section(t("aboutTitle"), <p>{t.rich("aboutBody", { name: OPERATOR.name, email: OPERATOR.email, privacy })}</p>)}
      {section(t("whoTitle"), <p>{t("whoBody")}</p>)}
      {section(t("accountTitle"), list("accountItems"))}
      {section(t("dataTitle"), <p>{t.rich("dataBody", { privacy })}</p>)}
      {section(
        t("estimatesTitle"),
        <>
          <p>{t("estimatesIntro")}</p>
          {list("estimatesItems")}
        </>,
      )}
      {section(t("aiTitle"), list("aiItems"), "ai")}
      {section(t("fairTitle"), list("fairItems"))}
      {section(t("asIsTitle"), list("asIsItems"))}
      {section(t("liabilityTitle"), <p>{t("liabilityBody")}</p>)}
      {section(t("endingTitle"), <p>{t("endingBody")}</p>)}
      {section(t("changesTitle"), <p>{t("changesBody")}</p>)}
      {section(t("lawTitle"), <p>{t("lawBody")}</p>)}
      {section(t("contactTitle"), <p>{t.rich("contactBody", { email: OPERATOR.email, mail })}</p>)}
    </main>
  );
}
