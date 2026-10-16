import { ChevronsUpDown } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { StoreNav } from "@/components/store/store-nav";
import { buttonVariants } from "@/components/ui/button";
import { getStore } from "@/lib/data/stores";

export default async function StoreLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const store = await getStore(storeId);
  if (!store) notFound();

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-60 shrink-0 border-r p-4 md:block">
        <p className="mb-4 px-3 text-sm font-semibold">BusinessNote</p>
        <StoreNav storeId={store.id} variant="sidebar" />
      </aside>
      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background px-4 py-3 md:px-8">
          <Link
            href="/toko"
            aria-label="Ganti toko"
            className={buttonVariants({ variant: "outline", className: "max-w-[65vw] justify-between gap-2" })}
          >
            <span className="truncate">{store.name}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden />
          </Link>
          <form action={signOutAction}>
            <SubmitButton variant="ghost" size="sm" pendingText="Keluar…">
              Keluar
            </SubmitButton>
          </form>
        </header>
        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
      <StoreNav storeId={store.id} variant="bottom" />
    </div>
  );
}
