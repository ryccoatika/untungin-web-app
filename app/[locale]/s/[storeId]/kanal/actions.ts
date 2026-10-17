"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { findTemplate } from "@/lib/config/channel-templates";
import { revalidateStore } from "@/lib/data/revalidate";
import type { FormState } from "@/lib/forms";
import { parseForm } from "@/lib/forms-server";
import { getValidationTranslator } from "@/lib/i18n/server";
import { isUuid } from "@/lib/uuid";
import { CHANNEL_DUPLICATE_KEY, channelInputSchema, toChannelColumns } from "@/lib/validation/channel";

const FIELDS = ["name", "commissionPct", "fixedFee"] as const;

type Supabase = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function storeChannels(supabase: Supabase, storeId: string) {
  const { data, error } = await supabase.from("sales_channels").select("id, name, sort_order").eq("store_id", storeId);
  if (error) throw error;
  return data;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function createChannelAction(storeId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseForm(channelInputSchema, formData, FIELDS);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const channels = await storeChannels(supabase, storeId);
  if (channels.some((channel) => sameName(channel.name, parsed.input.name))) {
    const tValidation = await getValidationTranslator();
    return { fieldErrors: { name: [tValidation(CHANNEL_DUPLICATE_KEY)] }, values: parsed.values };
  }
  const sortOrder = Math.max(0, ...channels.map((channel) => channel.sort_order)) + 1;
  const { error } = await supabase
    .from("sales_channels")
    .insert({ store_id: storeId, sort_order: sortOrder, ...toChannelColumns(parsed.input) });
  if (error) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: (await getTranslations("Channels"))("created") };
}

export async function addTemplateChannelAction(storeId: string, templateKey: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const template = findTemplate(templateKey);
  if (!isUuid(storeId) || !template) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  const channels = await storeChannels(supabase, storeId);
  if (channels.some((channel) => sameName(channel.name, template.name))) {
    return { message: (await getTranslations("Channels"))("templateExists", { name: template.name }) };
  }
  const sortOrder = Math.max(0, ...channels.map((channel) => channel.sort_order)) + 1;
  const { error } = await supabase.from("sales_channels").insert({
    store_id: storeId,
    sort_order: sortOrder,
    name: template.name,
    commission_pct: template.commissionPct,
    fixed_fee: template.fixedFee,
  });
  if (error) return { message: tCommon("saveFailed") };

  revalidateStore();
  return { ok: true };
}

export async function updateChannelAction(
  storeId: string,
  channelId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  const parsed = await parseForm(channelInputSchema, formData, FIELDS);
  if (parsed.error) return parsed.error;
  if (!isUuid(storeId) || !isUuid(channelId)) return { message: tCommon("notFound"), values: parsed.values };

  const { supabase } = await requireUser();
  const channels = await storeChannels(supabase, storeId);
  if (channels.some((channel) => channel.id !== channelId && sameName(channel.name, parsed.input.name))) {
    const tValidation = await getValidationTranslator();
    return { fieldErrors: { name: [tValidation(CHANNEL_DUPLICATE_KEY)] }, values: parsed.values };
  }
  const { data, error } = await supabase
    .from("sales_channels")
    .update(toChannelColumns(parsed.input))
    .eq("id", channelId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("saveFailed"), values: parsed.values };

  revalidateStore();
  return { ok: true, message: tCommon("saved"), values: parsed.values };
}

export async function deleteChannelAction(storeId: string, channelId: string): Promise<FormState> {
  const tCommon = await getTranslations("Common");
  if (!isUuid(storeId) || !isUuid(channelId)) return { message: tCommon("notFound") };

  const { supabase } = await requireUser();
  // Products need at least one channel to have a price.
  if ((await storeChannels(supabase, storeId)).length <= 1) {
    return { message: (await getTranslations("Channels"))("lastChannel") };
  }
  // Prices and channel-only composition rows cascade with the channel.
  const { data, error } = await supabase
    .from("sales_channels")
    .delete()
    .eq("id", channelId)
    .eq("store_id", storeId)
    .select("id");
  if (error || !data?.length) return { message: tCommon("deleteFailed") };

  revalidateStore();
  return redirect({ href: `/s/${storeId}/kanal`, locale: await getLocale() });
}
