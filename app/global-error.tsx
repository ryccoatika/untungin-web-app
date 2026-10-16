"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: "sans-serif", padding: 16, textAlign: "center" }}>
        <h1>Terjadi kesalahan</h1>
        <p>Maaf, ada yang tidak beres. Silakan coba lagi.</p>
        <button type="button" onClick={reset}>
          Coba lagi
        </button>
      </body>
    </html>
  );
}
