import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ServerHandle, startServer } from "../server";

let handle: ServerHandle;

beforeAll(async () => {
  handle = await startServer({ port: 0 });
});
afterAll(async () => {
  await handle.stop();
});

describe("server", () => {
  it("responds to /api/health with ok=true", async () => {
    const res = await fetch(`${handle.url}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});

describe("/api/load", () => {
  let dir: string;
  let file: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "drawloop-skill-"));
    file = join(dir, "test.excalidraw");
    writeFileSync(file, JSON.stringify({ type: "excalidraw", elements: [{ id: "a" }] }));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the file's JSON contents", async () => {
    const res = await fetch(`${handle.url}/api/load?path=${encodeURIComponent(file)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe("excalidraw");
    expect(body.elements[0].id).toBe("a");
  });

  it("returns 400 if path is missing", async () => {
    const res = await fetch(`${handle.url}/api/load`);
    expect(res.status).toBe(400);
  });

  it("returns 404 if file does not exist", async () => {
    const res = await fetch(`${handle.url}/api/load?path=/nonexistent.excalidraw`);
    expect(res.status).toBe(404);
  });
});

describe("/api/save", () => {
  let dir: string;
  let file: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "drawloop-skill-save-"));
    file = join(dir, "save.excalidraw");
    writeFileSync(file, JSON.stringify({ type: "excalidraw", elements: [], version: 1 }));
  });
  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writes JSON and creates a backup snapshot", async () => {
    const newJson = { type: "excalidraw", elements: [{ id: "x" }], version: 2 };
    const res = await fetch(`${handle.url}/api/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: file, json: newJson }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.snapshotId).toBe("string");

    const written = JSON.parse(readFileSync(file, "utf8"));
    expect(written.version).toBe(2);

    const backups = readdirSync(dir).filter((f) => f.startsWith("save.excalidraw.bak-"));
    expect(backups.length).toBe(1);
  });
});

describe("/api/watch", () => {
  it("pushes a 'change' event when the watched file is modified", async () => {
    const dir = mkdtempSync(join(tmpdir(), "drawloop-skill-watch-"));
    const file = join(dir, "watch.excalidraw");
    writeFileSync(file, "{}");

    const res = await fetch(`${handle.url}/api/watch?path=${encodeURIComponent(file)}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    setTimeout(() => writeFileSync(file, '{"changed": true}'), 50);

    // First read: ": connected" comment frame. Loop until we see the change event.
    let text = "";
    while (!text.includes("event: change")) {
      const { value, done } = await reader.read();
      if (done) break;
      text += decoder.decode(value);
    }
    expect(text).toContain("event: change");

    await reader.cancel();
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("/api/export-png", () => {
  it("writes a PNG buffer to the given path", async () => {
    const dir = mkdtempSync(join(tmpdir(), "drawloop-skill-png-"));
    const target = join(dir, "out.png");

    const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0]);
    const formData = new FormData();
    formData.append("path", target);
    formData.append("blob", new Blob([fakePng], { type: "image/png" }));

    const res = await fetch(`${handle.url}/api/export-png`, {
      method: "POST",
      body: formData,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const written = readFileSync(target);
    expect(written[0]).toBe(0x89);
    expect(written[1]).toBe(0x50);

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("/api/palettes", () => {
  it("lists palette files from palettes/ dir", async () => {
    const res = await fetch(`${handle.url}/api/palettes`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // biome-ignore lint/suspicious/noExplicitAny: test fixture cast
    expect(body.find((p: any) => p.name === "default")).toBeTruthy();
  });
});

describe("/api/apply-palette", () => {
  it("rewrites file with new palette colors", async () => {
    const dir = mkdtempSync(join(tmpdir(), "drawloop-skill-pal-"));
    const file = join(dir, "p.excalidraw");
    writeFileSync(
      file,
      JSON.stringify({
        type: "excalidraw",
        elements: [
          {
            id: "1",
            type: "rectangle",
            customData: { role: "service" },
            backgroundColor: "#000",
            strokeColor: "#000",
          },
        ],
      }),
    );

    const res = await fetch(`${handle.url}/api/apply-palette`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: file, palette: "default" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.changedCount).toBe(1);

    const written = JSON.parse(readFileSync(file, "utf8"));
    expect(written.elements[0].backgroundColor).toBe("#FFF3CD");

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("/api/design-guide", () => {
  it("returns the design guide JSON", async () => {
    const res = await fetch(`${handle.url}/api/design-guide`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe(1);
    expect(body.palette.available).toContain("aws");
    expect(body.antiPatterns.length).toBeGreaterThan(0);
  });
});

describe("/api/screenshot", () => {
  it("returns 501 Not Implemented (deferred to client-side export)", async () => {
    const res = await fetch(`${handle.url}/api/screenshot?path=/whatever.excalidraw`);
    expect(res.status).toBe(501);
    const text = await res.text();
    expect(text).toContain("Not implemented");
  });
});

describe("/api/describe", () => {
  it("returns a SceneSummary for the given file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "drawloop-skill-desc-"));
    const file = join(dir, "desc.excalidraw");
    writeFileSync(
      file,
      JSON.stringify({
        type: "excalidraw",
        elements: [
          {
            id: "1",
            type: "rectangle",
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            customData: { role: "service" },
          },
        ],
      }),
    );

    const res = await fetch(`${handle.url}/api/describe?path=${encodeURIComponent(file)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.elementCount).toBe(1);
    expect(body.byType.rectangle).toBe(1);
    expect(body.elements[0].role).toBe("service");

    rmSync(dir, { recursive: true, force: true });
  });
});

describe("/api/snapshot and /api/restore", () => {
  it("creates a labeled snapshot and restores from it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "drawloop-skill-snap-"));
    const file = join(dir, "snap.excalidraw");
    writeFileSync(file, JSON.stringify({ version: 1 }));

    const snapRes = await fetch(`${handle.url}/api/snapshot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: file, label: "before-edit" }),
    });
    expect(snapRes.status).toBe(200);
    const { snapshotId } = await snapRes.json();
    expect(typeof snapshotId).toBe("string");

    writeFileSync(file, JSON.stringify({ version: 2 }));

    const restoreRes = await fetch(`${handle.url}/api/restore`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: file, snapshotId }),
    });
    expect(restoreRes.status).toBe(200);
    const restored = JSON.parse(readFileSync(file, "utf8"));
    expect(restored.version).toBe(1);

    rmSync(dir, { recursive: true, force: true });
  });
});
