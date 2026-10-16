import Link from "next/link";
import { requireUser } from "@/lib/auth/require-user";
import { listStores } from "@/lib/data/stores";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  await requireUser();
  const stores = await listStores();
  const isFirstStore = stores.length === 0;

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">
          {isFirstStore ? "Selamat datang! Buat tokomu" : "Tambah toko baru"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Cukup isi data dasar. Semua bisa diubah nanti di Pengaturan.
        </p>
      </div>
      <OnboardingForm />
      {!isFirstStore && (
        <Link href="/toko" className="block text-center text-sm text-muted-foreground underline">
          Batal
        </Link>
      )}
    </main>
  );
}
