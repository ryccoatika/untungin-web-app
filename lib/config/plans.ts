// Store limits are also enforced by a DB trigger; keep in sync with
// supabase/migrations/20261016000003_store_limit.sql.
export const PLAN_LIMITS = {
  free: { maxStores: 2, aiAnalysesPerDay: 3 },
  pro: { maxStores: 10, aiAnalysesPerDay: 20 },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

export function toPlan(value: string | null | undefined): Plan {
  return value === "pro" ? "pro" : "free";
}

export function canCreateStore(plan: Plan, currentCount: number): boolean {
  return currentCount < PLAN_LIMITS[plan].maxStores;
}
