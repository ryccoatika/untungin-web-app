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
