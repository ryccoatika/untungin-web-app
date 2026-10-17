import { z } from "zod";
import { priceKey, type Overrides, type StoreData } from "@/lib/calc";
import { overridesToSearchParams, SIMULATION_LIMITS } from "@/lib/simulation/query";
import type { AnalysisSnapshot } from "./snapshot";

export const PRIORITIES = ["tinggi", "sedang", "rendah"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Extra list items are dropped (not an error) so one chatty answer still shows. */
export const MAX_ITEMS = 8;
/** −100…300% in the simulation URL is a sales multiplier of 0…4. */
const MAX_SALES_MULTIPLIER = 1 + SIMULATION_LIMITS.maxPct / 100;

const text = (max: number) => z.string().trim().min(1).max(max);
const list = <T extends z.ZodType>(item: T) => z.array(item).transform((items) => items.slice(0, MAX_ITEMS));

const simulationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("change_price"),
    product_id: z.string(),
    channel_id: z.string(),
    new_price: z.number().int().min(0).max(SIMULATION_LIMITS.maxPrice),
  }),
  z.object({
    type: z.literal("change_material_price"),
    material_id: z.string(),
    pct: z.number().min(SIMULATION_LIMITS.minPct).max(SIMULATION_LIMITS.maxPct),
  }),
  z.object({
    type: z.literal("change_sales_volume"),
    multiplier: z.number().min(0).max(MAX_SALES_MULTIPLIER),
  }),
]);
export type AiSimulation = z.infer<typeof simulationSchema>;

const issueSchema = z.object({
  title: text(200),
  explanation: text(1000),
  related_product_ids: z.array(z.string()),
  priority: z.enum(PRIORITIES),
});

// A bad simulation only loses the link, never the advice: it is checked separately below.
const recommendationSchema = z.object({ action: text(300), reason: text(1000), simulation: z.unknown().optional() });

const outputSchema = z.object({
  summary: text(2000),
  highlights: list(text(500)),
  issues: list(issueSchema),
  recommendations: list(recommendationSchema),
});

export type AnalysisOutput = {
  summary: string;
  highlights: string[];
  issues: { title: string; explanation: string; related_product_ids: string[]; priority: Priority }[];
  recommendations: { action: string; reason: string; simulation?: AiSimulation }[];
};

/** JSON Schema sent to Gemini as `responseJsonSchema` (spec §6.2). zod above is the real check. */
export const ANALYSIS_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "2 to 4 sentences." },
    highlights: { type: "array", items: { type: "string" }, maxItems: MAX_ITEMS },
    issues: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          explanation: { type: "string" },
          related_product_ids: { type: "array", items: { type: "string" } },
          priority: { type: "string", enum: [...PRIORITIES] },
        },
        required: ["title", "explanation", "related_product_ids", "priority"],
      },
    },
    recommendations: {
      type: "array",
      maxItems: MAX_ITEMS,
      items: {
        type: "object",
        properties: {
          action: { type: "string" },
          reason: { type: "string" },
          simulation: {
            anyOf: [
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["change_price"] },
                  product_id: { type: "string" },
                  channel_id: { type: "string" },
                  new_price: { type: "integer" },
                },
                required: ["type", "product_id", "channel_id", "new_price"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["change_material_price"] },
                  material_id: { type: "string" },
                  pct: { type: "number" },
                },
                required: ["type", "material_id", "pct"],
              },
              {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["change_sales_volume"] },
                  multiplier: { type: "number" },
                },
                required: ["type", "multiplier"],
              },
              { type: "null" },
            ],
          },
        },
        required: ["action", "reason"],
      },
    },
  },
  required: ["summary", "highlights", "issues", "recommendations"],
} as const;

/** Ids an answer may point at. A price line is "productId:channelId" with a saved price. */
export type KnownRefs = { productIds: Set<string>; materialIds: Set<string>; priceLines: Set<string> };

export function refsFromSnapshot(snapshot: AnalysisSnapshot): KnownRefs {
  return {
    productIds: new Set(snapshot.products.map((product) => product.id)),
    materialIds: new Set(snapshot.materials.map((material) => material.id)),
    priceLines: new Set(snapshot.products.flatMap((product) => product.lines.map((line) => priceKey(product.id, line.channelId)))),
  };
}

/** The same check against today's data, for analyses saved earlier. */
export function refsFromStoreData(data: StoreData): KnownRefs {
  const active = new Set(data.products.filter((product) => product.isActive).map((product) => product.id));
  const channels = new Set(data.channels.map((channel) => channel.id));
  return {
    productIds: active,
    materialIds: new Set(data.materials.map((material) => material.id)),
    priceLines: new Set(
      data.prices
        .filter((row) => active.has(row.productId) && channels.has(row.channelId))
        .map((row) => priceKey(row.productId, row.channelId)),
    ),
  };
}

function knownSimulation(raw: unknown, refs: KnownRefs): AiSimulation | undefined {
  const parsed = simulationSchema.safeParse(raw);
  if (!parsed.success) return undefined;
  const simulation = parsed.data;
  switch (simulation.type) {
    case "change_price":
      return refs.priceLines.has(priceKey(simulation.product_id, simulation.channel_id)) ? simulation : undefined;
    case "change_material_price":
      return refs.materialIds.has(simulation.material_id) ? simulation : undefined;
    case "change_sales_volume":
      return simulation;
  }
}

/**
 * Validates a model answer (or a saved one) and drops what points at unknown data: product ids leave
 * the issue, a bad simulation leaves the recommendation (the advice stays). Null when the shape is wrong.
 */
export function sanitizeOutput(raw: unknown, refs: KnownRefs): AnalysisOutput | null {
  const parsed = outputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { summary, highlights, issues, recommendations } = parsed.data;
  return {
    summary,
    highlights,
    issues: issues.map((issue) => ({
      ...issue,
      related_product_ids: [...new Set(issue.related_product_ids)].filter((id) => refs.productIds.has(id)),
    })),
    recommendations: recommendations.map(({ action, reason, simulation }) => {
      const known = knownSimulation(simulation, refs);
      return known ? { action, reason, simulation: known } : { action, reason };
    }),
  };
}

function toOverrides(simulation: AiSimulation): Overrides {
  switch (simulation.type) {
    case "change_price":
      return { prices: { [priceKey(simulation.product_id, simulation.channel_id)]: simulation.new_price } };
    case "change_material_price":
      return { materialPricePct: { [simulation.material_id]: simulation.pct } };
    case "change_sales_volume":
      return { salesMultiplier: simulation.multiplier };
  }
}

/** "Coba di simulasi" target (spec §6.2): the Phase 4 URL format. */
export function simulationHref(storeId: string, simulation: AiSimulation): string {
  return `/s/${storeId}/simulasi?${overridesToSearchParams(toOverrides(simulation))}`;
}
