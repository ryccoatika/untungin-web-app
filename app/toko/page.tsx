import Link from "next/link";
import { redirect } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";
import { SubmitButton } from "@/components/forms/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { listStores } from "@/lib/data/stores";
import { businessTypeLabel } from "@/lib/validation/store";

export default async function StoresPage() {
  const stores = await listStores();
  if (stores.length === 0) redirect("/onboarding");

  return (
    <main className="mx-auto w-full max-w-md space-y-6 px-4 py-10">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Toko kamu</h1>
        <form action={signOutAction}>
          <SubmitButton variant="ghost" size="sm" pendingText="Keluar…">
            Keluar
          </SubmitButton>
        </form>
      </div>
      <ul className="space-y-2">
        {stores.map((store) => (
          <li key={store.id}>
            <Link
              href={`/s/${store.id}/dashboard`}
              className="block rounded-lg border p-4 transition-colors hover:bg-accent"
            >
              <p className="truncate font-medium">{store.name}</p>
              <p className="text-sm text-muted-foreground">{businessTypeLabel(store.business_type)}</p>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/onboarding" className={buttonVariants({ className: "w-full" })}>
        Tambah toko
      </Link>
    </main>
  );
}
