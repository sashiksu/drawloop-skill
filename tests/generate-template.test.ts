import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateTemplate } from "../scripts/generate-template";
import { type ServerHandle, startServer } from "../server";

let handle: ServerHandle;
beforeAll(async () => {
  handle = await startServer({ port: 0 });
});
afterAll(async () => {
  await handle.stop();
});

describe("generateTemplate", () => {
  it("writes a scene with a _drawloopSkillPending payload and a placeholder element", async () => {
    const dir = mkdtempSync(join(tmpdir(), "drawloop-skill-gen-"));
    const path = join(dir, "gen.excalidraw");

    await generateTemplate({
      serverUrl: handle.url,
      mermaid: "flowchart LR\n  A[Start] --> B[Process] --> C[End]",
      roles: { A: "start", B: "service", C: "end" },
      icons: { B: "spring" },
      palette: "default",
      outPath: path,
    });

    expect(existsSync(path)).toBe(true);
    const scene = JSON.parse(readFileSync(path, "utf8"));
    expect(scene.type).toBe("excalidraw");

    // A placeholder element so the file renders something in any viewer.
    expect(scene.elements.length).toBeGreaterThan(0);
    expect(scene.elements[0].type).toBe("text");

    // The deferred pending payload that the UI resolves client-side.
    expect(scene._drawloopSkillPending).toBeDefined();
    expect(scene._drawloopSkillPending.mermaid).toContain("flowchart LR");
    expect(scene._drawloopSkillPending.roles).toEqual({
      A: "start",
      B: "service",
      C: "end",
    });
    expect(scene._drawloopSkillPending.icons).toEqual({ B: "spring" });
    expect(scene._drawloopSkillPending.palette).toBe("default");

    // Canvas background mirrors the chosen palette's background.
    expect(scene.appState.viewBackgroundColor).toBe("#F8FAFC");

    rmSync(dir, { recursive: true, force: true });
  });

  it("falls back to white canvas when palette name is unknown", async () => {
    const dir = mkdtempSync(join(tmpdir(), "drawloop-skill-gen-fb-"));
    const path = join(dir, "gen-fb.excalidraw");

    await generateTemplate({
      serverUrl: handle.url,
      mermaid: "flowchart LR\n  A --> B",
      roles: {},
      icons: {},
      palette: "nonexistent-palette",
      outPath: path,
    });

    const scene = JSON.parse(readFileSync(path, "utf8"));
    expect(scene.appState.viewBackgroundColor).toBe("#FFFFFF");

    rmSync(dir, { recursive: true, force: true });
  });
});
