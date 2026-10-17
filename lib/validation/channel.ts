import { z } from "zod";
import { blankAs, MAX_AMOUNT, requiredName } from "./common";
import { localeNumber, wholeNumber } from "./number";

export const CHANNEL_DUPLICATE_KEY = "channel.duplicate";

export const CHANNEL_VALIDATION_KEYS = [
  "channel.nameRequired",
  "channel.nameTooLong",
  "channel.commissionNumber",
  "channel.commissionMin",
  "channel.commissionMax",
  "channel.feeNumber",
  "channel.feeMin",
  CHANNEL_DUPLICATE_KEY,
] as const;

export const channelInputSchema = z.object({
  name: requiredName("channel", 60),
  commissionPct: blankAs(
    "0",
    localeNumber(z.number({ error: "channel.commissionNumber" }).min(0, "channel.commissionMin").lt(100, "channel.commissionMax")),
  ),
  fixedFee: blankAs(
    "0",
    wholeNumber(
      z.number({ error: "channel.feeNumber" }).int("channel.feeNumber").min(0, "channel.feeMin").max(MAX_AMOUNT, "common.amountTooLarge"),
    ),
  ),
});

export type ChannelInput = z.infer<typeof channelInputSchema>;

export function toChannelColumns(input: ChannelInput) {
  return { name: input.name, commission_pct: input.commissionPct, fixed_fee: input.fixedFee };
}
