const percentFormatter = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}
