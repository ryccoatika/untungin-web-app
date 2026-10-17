import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DeleteButton } from "@/components/forms/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { loadStoreData } from "@/lib/data/load-store-data";
import { deleteChannelAction, updateChannelAction } from "../actions";
import { ChannelForm } from "../channel-form";

type Params = Promise<{ locale: string; storeId: string; channelId: string }>;

export default async function EditChannelPage({ params }: { params: Params }) {
  const { storeId, channelId } = await params;
  const data = await loadStoreData(storeId);
  const channel = data?.channels.find((c) => c.id === channelId);
  if (!data || !channel) notFound();
  const t = await getTranslations("Channels");
  const tCommon = await getTranslations("Common");

  return (
    <div className="max-w-xl space-y-6">
      <Link href={`/s/${data.store.id}/kanal`} className={buttonVariants({ variant: "ghost", className: "-ml-3" })}>
        <ArrowLeft className="size-4" aria-hidden />
        {tCommon("back")}
      </Link>
      <h1 className="text-2xl font-semibold">{t("editTitle")}</h1>
      <Card>
        <CardContent>
          <ChannelForm
            action={updateChannelAction.bind(null, data.store.id, channel.id)}
            defaults={{ name: channel.name, commissionPct: String(channel.commissionPct), fixedFee: String(channel.fixedFee) }}
            submitLabel={tCommon("save")}
            pendingLabel={tCommon("savePending")}
          />
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{t("deleteWarning")}</p>
      <DeleteButton action={deleteChannelAction.bind(null, data.store.id, channel.id)} label={t("delete")} />
    </div>
  );
}
