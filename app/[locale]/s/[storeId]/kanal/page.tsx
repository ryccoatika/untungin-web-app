import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { CalcChannel } from "@/lib/calc";
import { CHANNEL_TEMPLATES } from "@/lib/config/channel-templates";
import { loadStoreData } from "@/lib/data/load-store-data";
import { formatPercent, formatRupiah } from "@/lib/format";
import { addTemplateChannelAction, createChannelAction } from "./actions";
import { ChannelForm } from "./channel-form";
import { TemplateButton } from "./template-button";

export default async function ChannelsPage({ params }: { params: Promise<{ locale: string; storeId: string }> }) {
  const { storeId } = await params;
  const data = await loadStoreData(storeId);
  if (!data) notFound();
  const t = await getTranslations("Channels");
  const tCommon = await getTranslations("Common");
  const locale = await getLocale();

  const fees = (channel: Pick<CalcChannel, "commissionPct" | "fixedFee">) => {
    const pct = formatPercent(channel.commissionPct, locale);
    const fee = formatRupiah(channel.fixedFee, locale);
    if (channel.commissionPct > 0 && channel.fixedFee > 0) return t("feeBoth", { pct, fee });
    if (channel.commissionPct > 0) return t("feePct", { pct });
    if (channel.fixedFee > 0) return t("feeFixed", { fee });
    return t("feeNone");
  };
  const taken = new Set(data.channels.map((channel) => channel.name.trim().toLowerCase()));
  const templates = CHANNEL_TEMPLATES.filter((template) => !taken.has(template.name.toLowerCase()));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      <ul className="divide-y rounded-lg border">
        {data.channels.map((channel) => (
          <li key={channel.id}>
            <Link
              href={`/s/${data.store.id}/kanal/${channel.id}`}
              className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 hover:bg-accent/60"
            >
              <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{channel.name}</span>
              <span className="shrink-0 text-right text-sm text-muted-foreground">{fees(channel)}</span>
            </Link>
          </li>
        ))}
      </ul>

      {templates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("templatesTitle")}</CardTitle>
            <CardDescription>{t("templatesHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {templates.map((template) => (
                <li key={template.key}>
                  <TemplateButton
                    action={addTemplateChannelAction.bind(null, data.store.id, template.key)}
                    label={`${template.name} · ${fees(template)}`}
                  />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("addTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChannelForm
            id="add-channel"
            action={createChannelAction.bind(null, data.store.id)}
            submitLabel={tCommon("add")}
            pendingLabel={tCommon("addPending")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
