import { DEFAULT_AFTER_LOGIN, safeNextPath } from "@/lib/auth/paths";
import { DevLoginForm } from "./dev-login-form";
import { GoogleSignInButton } from "./google-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeNextPath(next) ?? DEFAULT_AFTER_LOGIN;
  const devLogin = process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN === "true";

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Masuk ke BusinessNote</h1>
        <p className="text-sm text-muted-foreground">
          Hitung HPP, harga jual, dan laba usahamu.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          Gagal masuk. Silakan coba lagi.
        </p>
      )}
      <GoogleSignInButton next={target} />
      {devLogin && <DevLoginForm next={target} />}
    </main>
  );
}
