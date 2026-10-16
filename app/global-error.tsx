"use client";

// Renders outside the locale layout, so no message catalogs are available here.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: "sans-serif", padding: 16, textAlign: "center" }}>
        <h1>Terjadi kesalahan · Something went wrong</h1>
        <p>Maaf, ada yang tidak beres. · Sorry, something went wrong.</p>
        <button type="button" onClick={reset}>
          Coba lagi · Try again
        </button>
      </body>
    </html>
  );
}
