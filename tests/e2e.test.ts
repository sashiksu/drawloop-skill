/**
 * End-to-end smoke covering the server-side flow.
 *
 * Note: the original plan asserted post-render state (3+ role-tagged
 * rectangles after generateTemplate). Since /api/from-mermaid was deferred
 * to the browser (commit 71a8eb2), generateTemplate now writes a placeholder
 * scene with a _drawloopSkillPending payload — the actual rectangles are
 * materialized by the browser. This e2e instead simulates the post-resolution
 * state by writing a pre-resolved scene directly, then exercises every
 * server endpoint a real session uses: describe → apply-palette → export-png.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

describe("end-to-end happy path", () => {
  it("generate-template writes a pending scene, then describe → palette swap → export PNG round-trip", async () => {
    const dir = mkdtempSync(join(tmpdir(), "drawloop-skill-e2e-"));
    const path = join(dir, "e2e.excalidraw");

    // 1. generateTemplate writes a deferred-rendering scene.
    await generateTemplate({
      serverUrl: handle.url,
      mermaid: "flowchart LR\n  Client --> API --> DB",
      roles: { Client: "client", API: "service", DB: "data" },
      icons: {},
      palette: "default",
      outPath: path,
    });
    const pending = JSON.parse(readFileSync(path, "utf8"));
    expect(pending._drawloopSkillPending.roles.Client).toBe("client");

    // 2. Simulate browser resolution: rewrite the file with role-tagged rectangles.
    const resolvedScene = {
      type: "excalidraw",
      version: 2,
      elements: [
        {
          id: "client-r",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 160,
          height: 80,
          customData: { role: "client" },
          backgroundColor: "#000",
          strokeColor: "#000",
        },
        {
          id: "api-r",
          type: "rectangle",
          x: 200,
          y: 0,
          width: 160,
          height: 80,
          customData: { role: "service" },
          backgroundColor: "#000",
          strokeColor: "#000",
        },
        {
          id: "db-r",
          type: "rectangle",
          x: 400,
          y: 0,
          width: 160,
          height: 80,
          customData: { role: "data" },
          backgroundColor: "#000",
          strokeColor: "#000",
        },
      ],
      appState: { viewBackgroundColor: "#F8FAFC" },
      files: {},
    };
    writeFileSync(path, JSON.stringify(resolvedScene, null, 2));

    // 3. /api/describe returns a summary.
    const descRes = await fetch(`${handle.url}/api/describe?path=${encodeURIComponent(path)}`);
    const summary = await descRes.json();
    expect(summary.elementCount).toBe(3);
    expect(summary.byType.rectangle).toBe(3);

    // 4. /api/apply-palette recolors by role.
    const swapRes = await fetch(`${handle.url}/api/apply-palette`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, palette: "aws" }),
    });
    expect(swapRes.status).toBe(200);
    const after = JSON.parse(readFileSync(path, "utf8"));
    const serviceEl = after.elements.find(
      (e: { customData?: { role?: string } }) => e.customData?.role === "service",
    );
    expect(serviceEl?.backgroundColor).toBe("#FFE4C4"); // aws palette service fill

    // 5. /api/export-png writes a PNG buffer.
    const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const fd = new FormData();
    fd.append("path", path.replace(".excalidraw", ".png"));
    fd.append("blob", new Blob([fakePng], { type: "image/png" }));
    const pngRes = await fetch(`${handle.url}/api/export-png`, {
      method: "POST",
      body: fd,
    });
    expect(pngRes.status).toBe(200);

    rmSync(dir, { recursive: true, force: true });
  });
});
