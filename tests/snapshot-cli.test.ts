import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { snapshot } from "../scripts/snapshot";

describe("snapshot CLI helper", () => {
  it("creates a backup file alongside the source", () => {
    const dir = mkdtempSync(join(tmpdir(), "drawloop-skill-cli-snap-"));
    const file = join(dir, "thing.excalidraw");
    writeFileSync(file, "{}");

    const id = snapshot(file);
    expect(id).toMatch(/^\d+$/);
    const backups = readdirSync(dir).filter((f) => f.startsWith("thing.excalidraw.bak-"));
    expect(backups.length).toBe(1);

    rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty string when source missing", () => {
    const id = snapshot("/nonexistent/x.excalidraw");
    expect(id).toBe("");
  });
});
