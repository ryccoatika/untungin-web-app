import { expect, test } from "@playwright/test";

const SITE = "https://untungin.ryccoatika.com";

for (const [path, title] of [
  ["/id", "Untungin — Hitung HPP & Laba Usaha"],
  ["/en", "Untungin — Calculate COGS & Business Profit"],
  ["/id/privasi", "Kebijakan privasi · Untungin"],
  ["/en/privasi", "Privacy policy · Untungin"],
  ["/id/syarat", "Syarat & Ketentuan · Untungin"],
  ["/en/syarat", "Terms & Conditions · Untungin"],
] as const) {
  test(`${path} has link-preview tags, a canonical link and hreflang`, async ({ page }) => {
    await page.goto(path);
    const meta = (key: string) => page.locator(`meta[property="${key}"], meta[name="${key}"]`);
    const locale = path.slice(1, 3);
    await expect(page).toHaveTitle(title);
    await expect(meta("og:title")).toHaveAttribute("content", title);
    await expect(meta("og:description")).toHaveAttribute("content", /.{40,}/);
    await expect(meta("og:url")).toHaveAttribute("content", `${SITE}${path}`);
    await expect(meta("og:type")).toHaveAttribute("content", "website");
    await expect(meta("og:site_name")).toHaveAttribute("content", "Untungin");
    await expect(meta("og:image")).toHaveCount(1);
    await expect(meta("og:image")).toHaveAttribute("content", `${SITE}/${locale}/opengraph-image`);
    await expect(meta("og:image:width")).toHaveAttribute("content", "1200");
    await expect(meta("og:image:height")).toHaveAttribute("content", "630");
    await expect(meta("twitter:card")).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `${SITE}${path}`);
    const rest = path.slice(3);
    await expect(page.locator('link[rel="alternate"][hreflang="id"]')).toHaveAttribute("href", `${SITE}/id${rest}`);
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute("href", `${SITE}/en${rest}`);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", `${SITE}/id${rest}`);
  });
}

test("the landing page describes the app as structured data", async ({ page }) => {
  await page.goto("/id");
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}");
  expect(data).toMatchObject({ "@type": "WebApplication", name: "Untungin", url: `${SITE}/id`, inLanguage: "id" });
});

for (const locale of ["id", "en"]) {
  test(`the ${locale} preview image is a 1200×630 PNG`, async ({ request }) => {
    const response = await request.get(`/${locale}/opengraph-image`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("image/png");
    const png = await response.body();
    // PNG IHDR: width and height are big-endian at bytes 16 and 20.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    // WhatsApp skips images much over 300 KB.
    expect(png.length).toBeLessThan(300_000);
  });
}

test("robots.txt keeps crawlers out of signed-in pages and points to the sitemap", async ({ request }) => {
  const text = await (await request.get("/robots.txt")).text();
  expect(text).toContain("Allow: /");
  for (const path of ["/*/s/", "/*/login", "/*/onboarding"]) expect(text).toContain(`Disallow: ${path}`);
  expect(text).toContain("Disallow: /*/syarat/setuju");
  expect(text).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});

test("the sitemap lists the public pages in both languages", async ({ request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort();
  expect(locs).toEqual([
    `${SITE}/en`,
    `${SITE}/en/privasi`,
    `${SITE}/en/syarat`,
    `${SITE}/id`,
    `${SITE}/id/privasi`,
    `${SITE}/id/syarat`,
  ]);
});
