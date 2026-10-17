export const UNITS = ["g", "ons", "kg", "ml", "l", "pcs", "lusin"] as const;
export type Unit = (typeof UNITS)[number];
export type Dimension = "mass" | "volume" | "count";

const UNIT_INFO: Record<Unit, { dimension: Dimension; toBase: number }> = {
  g: { dimension: "mass", toBase: 1 },
  ons: { dimension: "mass", toBase: 100 },
  kg: { dimension: "mass", toBase: 1000 },
  ml: { dimension: "volume", toBase: 1 },
  l: { dimension: "volume", toBase: 1000 },
  pcs: { dimension: "count", toBase: 1 },
  lusin: { dimension: "count", toBase: 12 },
};

/** The unit every quantity of a dimension is converted to: g, ml, pcs. */
export const BASE_UNIT: Record<Dimension, Unit> = { mass: "g", volume: "ml", count: "pcs" };

export function isUnit(value: string): value is Unit {
  return (UNITS as readonly string[]).includes(value);
}

export function dimensionOf(unit: Unit): Dimension {
  return UNIT_INFO[unit].dimension;
}

export function toBase(qty: number, unit: Unit): number {
  return qty * UNIT_INFO[unit].toBase;
}

export function sameDimension(a: Unit, b: Unit): boolean {
  return dimensionOf(a) === dimensionOf(b);
}

export function unitsOf(dimension: Dimension): Unit[] {
  return UNITS.filter((unit) => dimensionOf(unit) === dimension);
}
