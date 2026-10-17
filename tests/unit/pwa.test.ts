import { describe, expect, it } from "vitest";
import { installHint } from "@/lib/pwa";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

describe("installHint", () => {
  it("iPhone Safari installs through Share", () => expect(installHint(IPHONE_SAFARI, false)).toBe("ios"));
  it("iPad Safari installs through Share", () => expect(installHint(IPAD_SAFARI, false)).toBe("ios"));
  it("iPhone Chrome also installs through Share", () => expect(installHint(IPHONE_CHROME, false)).toBe("ios"));
  it("Android Chrome uses the install prompt", () => expect(installHint(ANDROID_CHROME, false)).toBe("prompt"));
  it("desktop Chrome uses the install prompt", () => expect(installHint(DESKTOP_CHROME, false)).toBe("prompt"));
  it("is hidden when already installed", () => {
    for (const ua of [IPHONE_SAFARI, ANDROID_CHROME, DESKTOP_CHROME]) expect(installHint(ua, true)).toBe("hidden");
  });
});
