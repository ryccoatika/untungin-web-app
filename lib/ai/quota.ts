const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Asia/Jakarta (WIB) is UTC+7 all year; there is no daylight saving. */
const WIB_OFFSET_MS = 7 * HOUR_MS;

/** Start of the quota day (00:00 WIB, spec §6.1) that contains `now`. */
export function startOfJakartaDay(now: Date): Date {
  const local = now.getTime() + WIB_OFFSET_MS;
  const localMidnight = local - (((local % DAY_MS) + DAY_MS) % DAY_MS);
  return new Date(localMidnight - WIB_OFFSET_MS);
}

export function remainingQuota(limit: number, used: number): number {
  return Math.max(0, limit - used);
}
