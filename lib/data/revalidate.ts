import "server-only";
import { revalidatePath } from "next/cache";

/** Refreshes every page of the current store (layout, dashboard, lists) after a mutation. */
export function revalidateStore() {
  revalidatePath("/[locale]/s/[storeId]", "layout");
}
