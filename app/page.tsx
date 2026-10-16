import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  { title: "HPP otomatis", body: "Masukkan bahan dan takaran, biaya per porsi langsung terhitung." },
  { title: "Harga jual pas", body: "Saran harga sesuai target margin, termasuk potongan GoFood & marketplace." },
  { title: "Laba & balik modal", body: "Lihat laba bulanan, target jual per hari, dan kapan modal kembali." },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const loggedIn = Boolean(data?.claims);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-4 py-16">
      <div className="space-y-4">
        <p className="text-sm font-medium text-primary">BusinessNote</p>
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Tahu untung-rugi usahamu sejak hari pertama.
        </h1>
        <p className="text-lg text-muted-foreground">
          Hitung HPP dari bahan, biaya operasional, dan penyusutan alat. Dapatkan harga jual yang
          pas dan lihat kapan modalmu kembali — tanpa perlu paham akuntansi.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="rounded-lg border p-4">
            <p className="font-medium">{feature.title}</p>
            <p className="text-sm text-muted-foreground">{feature.body}</p>
          </li>
        ))}
      </ul>
      <Link
        href={loggedIn ? "/mulai" : "/login"}
        className={buttonVariants({ size: "lg", className: "w-full sm:w-auto sm:self-start" })}
      >
        {loggedIn ? "Buka aplikasi" : "Mulai gratis dengan Google"}
      </Link>
    </main>
  );
}
