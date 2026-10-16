import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getStore } from "@/lib/data/stores";
import { formatPercent } from "@/lib/format";
import { businessTypeLabel } from "@/lib/validation/store";

export default async function DashboardPage({ params }: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store) notFound();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold [overflow-wrap:anywhere]">{store.name}</h1>
        <p className="text-sm text-muted-foreground">{businessTypeLabel(store.business_type)}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Dasar perhitungan</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Hari buka per bulan</p>
            <p className="text-lg font-medium">{store.operating_days_per_month} hari</p>
          </div>
          <div>
            <p className="text-muted-foreground">Target margin</p>
            <p className="text-lg font-medium">{formatPercent(store.target_margin_pct)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
