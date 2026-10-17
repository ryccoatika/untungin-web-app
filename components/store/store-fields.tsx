import { useTranslations } from "next-intl";
import { FieldError } from "@/components/forms/field-error";
import { NativeSelect } from "@/components/forms/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BUSINESS_TYPES,
  STORE_DEFAULTS,
  TARGET_MARKETS,
} from "@/lib/validation/store";

export type StoreFieldDefaults = {
  name?: string;
  businessType?: string;
  targetMarket?: string | null;
  operatingDaysPerMonth?: number | string;
  targetMarginPct?: number | string;
};

type Props = {
  section: "identity" | "operations";
  defaults?: StoreFieldDefaults;
  errors?: Record<string, string[] | undefined>;
};

export function StoreFields({ section, defaults = {}, errors = {} }: Props) {
  const t = useTranslations("StoreFields");
  const tType = useTranslations("BusinessType");
  const tMarket = useTranslations("TargetMarket");

  if (section === "identity") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="name">{t("name")}</Label>
          <Input id="name" name="name" defaultValue={defaults.name} maxLength={60} required />
          <FieldError errors={errors.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="businessType">{t("businessType")}</Label>
          <NativeSelect
            id="businessType"
            name="businessType"
            defaultValue={defaults.businessType ?? ""}
            required
          >
            <option value="" disabled>
              {t("businessTypePlaceholder")}
            </option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {tType(type)}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={errors.businessType} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="targetMarket">{t("targetMarket")}</Label>
          <NativeSelect
            id="targetMarket"
            name="targetMarket"
            defaultValue={defaults.targetMarket ?? ""}
          >
            <option value="">{t("targetMarketUnknown")}</option>
            {TARGET_MARKETS.map((market) => (
              <option key={market} value={market}>
                {tMarket(market)}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            {t("targetMarketHint")}
          </p>
          <FieldError errors={errors.targetMarket} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="operatingDaysPerMonth">{t("operatingDays")}</Label>
        <Input
          id="operatingDaysPerMonth"
          name="operatingDaysPerMonth"
          inputMode="numeric"
          defaultValue={defaults.operatingDaysPerMonth ?? STORE_DEFAULTS.operatingDaysPerMonth}
          required
        />
        <p className="text-xs text-muted-foreground">
          {t("operatingDaysHint")}
        </p>
        <FieldError errors={errors.operatingDaysPerMonth} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="targetMarginPct">{t("targetMargin")}</Label>
        <Input
          id="targetMarginPct"
          name="targetMarginPct"
          inputMode="decimal"
          defaultValue={defaults.targetMarginPct ?? STORE_DEFAULTS.targetMarginPct}
          required
        />
        <p className="text-xs text-muted-foreground">
          {t("targetMarginHint")}
        </p>
        <FieldError errors={errors.targetMarginPct} />
      </div>
    </div>
  );
}
