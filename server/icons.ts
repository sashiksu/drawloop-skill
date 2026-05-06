import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const CACHE_DIR = "./icons/cache";

export type IconSource =
  | { source: "simpleicons"; name: string }
  | { source: "iconify"; set: string; name: string };

function urlFor(s: IconSource): string {
  if (s.source === "simpleicons") return `https://cdn.simpleicons.org/${s.name}`;
  return `https://api.iconify.design/${s.set}:${s.name}.svg`;
}

function cachePath(s: IconSource): string {
  const key = createHash("sha256").update(JSON.stringify(s)).digest("hex").slice(0, 32);
  return `${CACHE_DIR}/${key}.svg`;
}

export type IconResult = { svg: string; cacheHit: boolean };

export async function fetchIcon(s: IconSource): Promise<IconResult | null> {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  const path = cachePath(s);
  if (existsSync(path)) {
    return { svg: readFileSync(path, "utf8"), cacheHit: true };
  }
  const res = await fetch(urlFor(s));
  if (!res.ok) return null;
  const svg = await res.text();
  if (!svg.includes("<svg")) return null;
  writeFileSync(path, svg);
  return { svg, cacheHit: false };
}
