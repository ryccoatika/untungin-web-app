export type RenderMode = "3d" | "static";

/** What the browser tells us; the two counts are missing in some browsers. */
export type DeviceSignals = {
  reducedMotion: boolean;
  webgl: boolean;
  hardwareConcurrency?: number;
  deviceMemory?: number;
};

/** Spec §7: ≤ 2 cores or ≤ 2 GB counts as a weak device. */
export const WEAK_DEVICE_LIMIT = 2;

export function chooseRenderMode(signals: DeviceSignals): RenderMode {
  if (signals.reducedMotion || !signals.webgl) return "static";
  if (signals.hardwareConcurrency !== undefined && signals.hardwareConcurrency <= WEAK_DEVICE_LIMIT) return "static";
  if (signals.deviceMemory !== undefined && signals.deviceMemory <= WEAK_DEVICE_LIMIT) return "static";
  return "3d";
}
