import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ServerHandle, startServer } from "../server";
import { embedIconAsImage } from "../server/embed-icon";

let handle: ServerHandle;
beforeAll(async () => {
  handle = await startServer({ port: 0 });
});
afterAll(async () => {
  await handle.stop();
});

describe("icon round-trip", () => {
  it("fetches an icon, embeds it in a scene, saves, reloads, and the file is preserved", async () => {
    const iconRes = await fetch(`${handle.url}/api/icon?source=simpleicons&name=spring`);
    const svg = await iconRes.text();

    const { element, file, fileId } = embedIconAsImage(svg, {
      x: 50,
      y: 50,
      size: 32,
      iconShort: "spring",
    });

    const dir = mkdtempSync(join(tmpdir(), "drawloop-skill-rt-"));
    const path = join(dir, "rt.excalidraw");
    writeFileSync(path, "{}");

    const scene = {
      type: "excalidraw",
      version: 2,
      elements: [element],
      appState: { viewBackgroundColor: "#fff" },
      files: { [fileId]: file },
    };

    const saveRes = await fetch(`${handle.url}/api/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, json: scene }),
    });
    expect(saveRes.status).toBe(200);

    const written = JSON.parse(readFileSync(path, "utf8"));
    expect(written.elements[0].fileId).toBe(fileId);
    expect(written.files[fileId].dataURL).toContain("data:image/svg+xml;base64,");

    rmSync(dir, { recursive: true, force: true });
  });
});
