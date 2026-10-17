export type Moment = "welcome" | "firstProfit";

/** Which celebration to show on the dashboard, if any. Welcome wins; first profit shows once per store. */
export function momentToShow(input: { welcome: boolean; profitPositive: boolean; profitCelebrated: boolean }): Moment | null {
  if (input.welcome) return "welcome";
  if (input.profitPositive && !input.profitCelebrated) return "firstProfit";
  return null;
}

export function firstProfitKey(storeId: string): string {
  return `untungin:first-profit:${storeId}`;
}
