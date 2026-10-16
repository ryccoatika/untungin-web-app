"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 py-10 text-center">
      <h1 className="text-2xl font-semibold">Terjadi kesalahan</h1>
      <p className="text-sm text-muted-foreground">
        Maaf, ada yang tidak beres. Silakan coba lagi.
      </p>
      <Button onClick={reset}>Coba lagi</Button>
      <Link href="/mulai" className={buttonVariants({ variant: "outline" })}>
        Kembali ke beranda
      </Link>
    </main>
  );
}
