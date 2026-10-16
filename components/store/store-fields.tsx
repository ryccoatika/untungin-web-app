import { FieldError } from "@/components/forms/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BUSINESS_TYPES,
  BUSINESS_TYPE_LABELS,
  STORE_DEFAULTS,
  TARGET_MARKETS,
  TARGET_MARKET_LABELS,
} from "@/lib/validation/store";

export type StoreFieldDefaults = {
  name?: string;
  businessType?: string;
  targetMarket?: string | null;
  operatingDaysPerMonth?: number;
  targetMarginPct?: number;
};

type Props = {
  section: "identity" | "operations";
  defaults?: StoreFieldDefaults;
  errors?: Record<string, string[] | undefined>;
};

const selectClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function StoreFields({ section, defaults = {}, errors = {} }: Props) {
  if (section === "identity") {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="name">Nama toko</Label>
          <Input id="name" name="name" defaultValue={defaults.name} maxLength={60} required />
          <FieldError errors={errors.name} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="businessType">Jenis usaha</Label>
          <select
            id="businessType"
            name="businessType"
            defaultValue={defaults.businessType ?? ""}
            required
            className={selectClass}
          >
            <option value="" disabled>
              Pilih jenis usaha
            </option>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {BUSINESS_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <FieldError errors={errors.businessType} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="targetMarket">Target pasar (opsional)</Label>
          <select
            id="targetMarket"
            name="targetMarket"
            defaultValue={defaults.targetMarket ?? ""}
            className={selectClass}
          >
            <option value="">Belum tahu</option>
            {TARGET_MARKETS.map((market) => (
              <option key={market} value={market}>
                {TARGET_MARKET_LABELS[market]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Dipakai untuk menyesuaikan saran harga.
          </p>
          <FieldError errors={errors.targetMarket} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="operatingDaysPerMonth">Hari buka per bulan</Label>
        <Input
          id="operatingDaysPerMonth"
          name="operatingDaysPerMonth"
          inputMode="numeric"
          defaultValue={defaults.operatingDaysPerMonth ?? STORE_DEFAULTS.operatingDaysPerMonth}
          required
        />
        <p className="text-xs text-muted-foreground">
          Dipakai untuk menghitung biaya harian dan target penjualan per hari.
        </p>
        <FieldError errors={errors.operatingDaysPerMonth} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="targetMarginPct">Target margin (%)</Label>
        <Input
          id="targetMarginPct"
          name="targetMarginPct"
          inputMode="decimal"
          defaultValue={defaults.targetMarginPct ?? STORE_DEFAULTS.targetMarginPct}
          required
        />
        <p className="text-xs text-muted-foreground">
          Margin 40% artinya 40% dari harga jual adalah untung. Ini berbeda dengan markup 40%
          (harga = modal + 40%), yang hanya memberi margin sekitar 29%.
        </p>
        <FieldError errors={errors.targetMarginPct} />
      </div>
    </div>
  );
}
