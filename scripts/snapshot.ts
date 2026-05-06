import { copyFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function snapshot(path: string): string {
  if (!existsSync(path)) return "";
  const id = String(Date.now());
  copyFileSync(path, `${path}.bak-${id}`);
  return id;
}

// Detect direct invocation; pathToFileURL handles paths with spaces.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: npx tsx scripts/snapshot.ts <path>");
    process.exit(1);
  }
  const id = snapshot(path);
  if (!id) {
    console.error(`File not found: ${path}`);
    process.exit(1);
  }
  console.log(id);
}
