"use client";

import type { CalcChannel, StoreData } from "@/lib/calc";
import type { FormAction } from "@/lib/forms";
import { PriceForm, type PriceDefaults } from "./price-form";

type Entry = { channel: CalcChannel; action: FormAction; defaults: PriceDefaults };

/** One price form per channel. StoreData crosses the server/client boundary once, not once per channel. */
export function PriceSection({ data, productId, inactive, entries }: { data: StoreData; productId: string; inactive: boolean; entries: Entry[] }) {
  return (
    <div className="space-y-6">
      {entries.map(({ channel, action, defaults }) => (
        <section key={channel.id} className="space-y-3">
          <h3 className="font-medium [overflow-wrap:anywhere]">{channel.name}</h3>
          <PriceForm
            id={`price-${channel.id}`}
            action={action}
            data={data}
            productId={productId}
            channel={channel}
            defaults={defaults}
            inactive={inactive}
          />
        </section>
      ))}
    </div>
  );
}
