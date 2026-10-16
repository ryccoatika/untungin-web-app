import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Halaman tidak ditemukan</h1>
      <p className="text-sm text-muted-foreground">
        Halaman ini tidak ada, atau kamu tidak punya akses ke sana.
      </p>
      <Link href="/mulai" className={buttonVariants()}>
        Kembali ke aplikasi
      </Link>
    </main>
  );
}
