import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const status = JSON.parse(
  execSync("npx supabase status -o json", { encoding: "utf8" }),
);
const pick = (...keys) => keys.map((k) => status[k]).find(Boolean);

const vars = {
  NEXT_PUBLIC_SUPABASE_URL: pick("API_URL"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick("PUBLISHABLE_KEY", "ANON_KEY"),
  SUPABASE_SECRET_KEY: pick("SECRET_KEY", "SERVICE_ROLE_KEY"),
};

for (const [key, value] of Object.entries(vars)) {
  if (!value) {
    throw new Error(
      `Missing ${key}. Keys in supabase status: ${Object.keys(status).join(", ")}`,
    );
  }
}

const path = ".env.local";
// Also drop the retired dev-login flag from older .env.local files.
const managed = [...Object.keys(vars), "NEXT_PUBLIC_ENABLE_DEV_LOGIN"];
const kept = existsSync(path)
  ? readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line && !managed.some((k) => line.startsWith(`${k}=`)))
  : [];
const lines = [...kept, ...Object.entries(vars).map(([k, v]) => `${k}=${v}`)];
writeFileSync(path, `${lines.join("\n")}\n`);
console.log(`Wrote ${Object.keys(vars).length} Supabase vars to ${path}`);
