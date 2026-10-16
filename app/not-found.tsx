export default function RootNotFound() {
  return (
    <html lang="id">
      <head>
        <title>404 · Halaman tidak ditemukan / Page not found</title>
      </head>
      <body style={{ fontFamily: "sans-serif", padding: 16, textAlign: "center" }}>
        <h1>Halaman tidak ditemukan · Page not found</h1>
        <p>
          {/* A plain anchor on purpose: this page renders outside the locale layout. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/">Kembali ke beranda · Back to home</a>
        </p>
      </body>
    </html>
  );
}
