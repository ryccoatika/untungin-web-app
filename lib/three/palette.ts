/** Scene colours per theme (Three.js cannot read the oklch CSS tokens). Brand: emerald + amber coin. */
export type Palette = {
  bar: number;
  barTop: number;
  coin: number;
  coinEdge: number;
  base: number;
  positive: number;
  warning: number;
  negative: number;
  labelText: string;
  labelBackground: string;
};

export const PALETTES: { light: Palette; dark: Palette } = {
  light: {
    bar: 0x059669,
    barTop: 0x34d399,
    coin: 0xfcd34d,
    coinEdge: 0xf59e0b,
    base: 0xe5e7eb,
    positive: 0x10b981,
    warning: 0xf59e0b,
    negative: 0xef4444,
    labelText: "#111827",
    labelBackground: "rgba(255,255,255,0.92)",
  },
  dark: {
    bar: 0x10b981,
    barTop: 0x6ee7b7,
    coin: 0xfde68a,
    coinEdge: 0xfbbf24,
    base: 0x27272a,
    positive: 0x34d399,
    warning: 0xfbbf24,
    negative: 0xf87171,
    labelText: "#f9fafb",
    labelBackground: "rgba(24,24,27,0.92)",
  },
};
