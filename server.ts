import { copyFileSync, existsSync, readdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { fileURLToPath, pathToFileURL } from "node:url";
import { type ServerType, serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { fetchIcon } from "./server/icons";
import { getSimpleiconsIndex } from "./server/simpleicons-index";
import { applyPalette } from "./ui/src/lib/apply-palette";
import { describeScene } from "./ui/src/lib/describe-scene";

const PALETTES_DIR = fileURLToPath(new URL("./palettes/", import.meta.url));
const UI_DIST_DIR = fileURLToPath(new URL("./ui/dist/", import.meta.url));

async function loadPalette(name: string) {
  return JSON.parse(await readFile(`${PALETTES_DIR}${name}.json`, "utf8"));
}

// Heuristic: if an SVG uses currentColor or has at most one explicit fill color,
// treat as monochrome and tint to theme. Brand logos with multiple distinct
// colors (Postgres, Firebase, etc.) are left untouched.
export function isMonochromeSvg(svg: string): boolean {
  if (svg.includes("currentColor")) return true;
  const fills = [...svg.matchAll(/fill="([^"]+)"/g)].map((m) => m[1].toLowerCase());
  const distinct = new Set(
    fills.filter((f) => f !== "none" && f !== "transparent" && f !== "currentcolor"),
  );
  return distinct.size <= 1;
}

export function tintMonochromeSvg(svg: string, color: string): string {
  let out = svg.replaceAll("currentColor", color);
  out = out.replace(/fill="#000(000)?"/gi, `fill="${color}"`);
  out = out.replace(/fill="black"/gi, `fill="${color}"`);
  out = out.replace(/stroke="#000(000)?"/gi, `stroke="${color}"`);
  out = out.replace(/stroke="black"/gi, `stroke="${color}"`);
  return out;
}

function snapshot(path: string): string {
  if (!existsSync(path)) return "";
  const id = String(Date.now());
  copyFileSync(path, `${path}.bak-${id}`);
  return id;
}

// @hono/node-server's serveStatic resolves `root` against process.cwd().
// When the server is started from a different directory than the project
// root (e.g. by Claude from the user's working dir), we need to convert
// our absolute UI_DIST_DIR into a CWD-relative path so it resolves correctly.
function relativeToCwd(absolutePath: string): string {
  const cwd = process.cwd();
  if (absolutePath.startsWith(`${cwd}/`)) {
    return absolutePath.slice(cwd.length + 1);
  }
  // If UI_DIST is outside CWD, fall back to absolute (serveStatic accepts both).
  return absolutePath;
}

export type ServerOptions = {
  port?: number;
};

export type ServerHandle = {
  url: string;
  app: Hono;
  stop: () => Promise<void>;
};

export async function startServer(opts: ServerOptions = {}): Promise<ServerHandle> {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.get("/api/load", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.text("Missing path", 400);
    if (!existsSync(path)) return c.text("Not found", 404);
    return c.body(await readFile(path), 200, { "content-type": "application/json" });
  });

  app.post("/api/save", async (c) => {
    const body = (await c.req.json()) as { path?: string; json?: unknown };
    if (!body.path || body.json === undefined) {
      return c.text("Missing path or json", 400);
    }
    const snapshotId = snapshot(body.path);
    await writeFile(body.path, JSON.stringify(body.json, null, 2));
    return c.json({ ok: true, snapshotId });
  });

  app.get("/api/watch", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.text("Missing path", 400);

    const { watch } = await import("node:fs");
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(enc.encode(": connected\n\n"));
        const watcher = watch(path, { persistent: false }, () => {
          controller.enqueue(enc.encode(`event: change\ndata: ${JSON.stringify({ path })}\n\n`));
        });
        c.req.raw.signal.addEventListener("abort", () => {
          watcher.close();
          try {
            controller.close();
          } catch {
            // already closed
          }
        });
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  });

  app.post("/api/snapshot", async (c) => {
    const body = (await c.req.json()) as { path?: string };
    if (!body.path) return c.text("Missing path", 400);
    const snapshotId = snapshot(body.path);
    return c.json({ snapshotId });
  });

  // /api/screenshot deferred: @excalidraw/utils is browser-only (needs document, self).
  // PNG export already runs client-side via /api/export-png (see ExportPngButton).
  // Re-enable with jsdom or a headless renderer if a server-side preview is needed.
  app.get("/api/palettes", async (c) => {
    const files = readdirSync(PALETTES_DIR).filter((f) => f.endsWith(".json"));
    const palettes = await Promise.all(
      files.map(async (f) => {
        const p = JSON.parse(await readFile(`${PALETTES_DIR}${f}`, "utf8"));
        return {
          name: p.name,
          description: p.description,
          canvasBackground: p.canvasBackground,
        };
      }),
    );
    return c.json(palettes);
  });

  app.get("/api/palette/:name", async (c) => {
    const name = c.req.param("name");
    const safe = name.replace(/[^a-z0-9-_]/gi, "");
    if (!safe || safe !== name) return c.text("Invalid palette name", 400);
    const path = `${PALETTES_DIR}${safe}.json`;
    if (!existsSync(path)) return c.text("Palette not found", 404);
    return c.body(await readFile(path), 200, { "content-type": "application/json" });
  });

  app.post("/api/apply-palette", async (c) => {
    const body = (await c.req.json()) as { path?: string; palette?: string };
    if (!body.path || !body.palette) return c.text("Missing path or palette", 400);
    const palette = await loadPalette(body.palette);
    const scene = JSON.parse(await readFile(body.path, "utf8"));
    const before = JSON.stringify(scene.elements);
    scene.elements = applyPalette(scene.elements ?? [], palette);
    scene.appState = {
      ...(scene.appState ?? {}),
      viewBackgroundColor: palette.canvasBackground,
    };
    snapshot(body.path);
    await writeFile(body.path, JSON.stringify(scene, null, 2));
    const beforeArr = JSON.parse(before) as unknown[];
    const changedCount = scene.elements.filter(
      (_: unknown, i: number) =>
        beforeArr[i] && JSON.stringify(beforeArr[i]) !== JSON.stringify(scene.elements[i]),
    ).length;
    return c.json({ ok: true, changedCount });
  });

  // Categorized palettes: separate dropdowns for background, fills, outlines, arrows.
  // Each category is its own subdirectory under palettes/. Each file holds both
  // light + dark variants so theme switching is one toggle, not two passes.
  app.get("/api/styling/palettes", async (c) => {
    const categories = ["background", "fills", "outlines", "arrows"] as const;
    const result: Record<string, Array<{ name: string; description?: string }>> = {};
    for (const cat of categories) {
      const dir = `${PALETTES_DIR}${cat}/`;
      if (!existsSync(dir)) {
        result[cat] = [];
        continue;
      }
      const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
      result[cat] = await Promise.all(
        files.map(async (f) => {
          const p = JSON.parse(await readFile(`${dir}${f}`, "utf8"));
          return { name: p.name, description: p.description };
        }),
      );
    }
    return c.json(result);
  });

  app.get("/api/styling/palette/:category/:name", async (c) => {
    const category = c.req.param("category");
    const name = c.req.param("name");
    const safeCat = category.replace(/[^a-z]/gi, "");
    const safeName = name.replace(/[^a-z0-9-_]/gi, "");
    if (!safeCat || !safeName) return c.text("Invalid category or name", 400);
    const path = `${PALETTES_DIR}${safeCat}/${safeName}.json`;
    if (!existsSync(path)) return c.text("Palette not found", 404);
    return c.body(await readFile(path), 200, { "content-type": "application/json" });
  });

  // Apply 4-category styling + theme in one shot. Uses the same role-tag walker
  // as applyPalette but reads colors from 4 separate palette objects rather
  // than one bundle.
  app.post("/api/apply-styling", async (c) => {
    type StyleBody = {
      path?: string;
      background?: string;
      fills?: string;
      outlines?: string;
      arrows?: string;
      theme?: "light" | "dark";
    };
    const body = (await c.req.json()) as StyleBody;
    if (!body.path) return c.text("Missing path", 400);
    const theme: "light" | "dark" = body.theme === "dark" ? "dark" : "light";

    const loadCat = async (cat: string, name?: string) => {
      if (!name) return null;
      const safeCat = cat.replace(/[^a-z]/gi, "");
      const safeName = name.replace(/[^a-z0-9-_]/gi, "");
      const fp = `${PALETTES_DIR}${safeCat}/${safeName}.json`;
      if (!existsSync(fp)) return null;
      return JSON.parse(await readFile(fp, "utf8"));
    };
    const bgPal = await loadCat("background", body.background);
    const fillsPal = await loadCat("fills", body.fills);
    const outlinesPal = await loadCat("outlines", body.outlines);
    const arrowsPal = await loadCat("arrows", body.arrows);

    const scene = JSON.parse(await readFile(body.path, "utf8"));
    const elements: any[] = scene.elements ?? [];

    for (const el of elements) {
      // biome-ignore lint/suspicious/noExplicitAny: element shape varies
      const role: string = (el?.customData as any)?.role ?? "default";

      if (el?.type === "rectangle" || el?.type === "ellipse" || el?.type === "diamond") {
        if (fillsPal?.[theme]?.[role]) el.backgroundColor = fillsPal[theme][role];
        else if (fillsPal?.[theme]?.default) el.backgroundColor = fillsPal[theme].default;
        if (outlinesPal?.[theme]?.[role]) el.strokeColor = outlinesPal[theme][role];
        else if (outlinesPal?.[theme]?.default) el.strokeColor = outlinesPal[theme].default;
      }

      if (el?.type === "arrow" || el?.type === "line") {
        if (arrowsPal?.[theme]) el.strokeColor = arrowsPal[theme];
      }

      if (el?.type === "text" && !el.containerId) {
        // Free-floating text (annotations) — outline color makes most sense.
        if (outlinesPal?.[theme]?.default) el.strokeColor = outlinesPal[theme].default;
      }

      if (el?.type === "image" && el.customData?.iconSource) {
        // Tint monochrome icons to contrast with the background; leave brand logos alone.
        const dataURL: string = el.fileId ? scene.files?.[el.fileId]?.dataURL ?? "" : "";
        if (dataURL.startsWith("data:image/svg+xml;base64,")) {
          const svg = Buffer.from(dataURL.slice("data:image/svg+xml;base64,".length), "base64").toString("utf8");
          if (isMonochromeSvg(svg)) {
            const targetColor = theme === "dark" ? "#E2E8F0" : "#1E293B";
            const tinted = tintMonochromeSvg(svg, targetColor);
            const newDataURL = `data:image/svg+xml;base64,${Buffer.from(tinted).toString("base64")}`;
            scene.files[el.fileId] = { ...scene.files[el.fileId], dataURL: newDataURL };
          }
        }
      }
    }

    if (bgPal?.[theme]) {
      scene.appState = {
        ...(scene.appState ?? {}),
        viewBackgroundColor: bgPal[theme],
      };
    }

    snapshot(body.path);
    await writeFile(body.path, JSON.stringify(scene, null, 2));
    return c.json({ ok: true });
  });

  // /api/from-mermaid deferred: @excalidraw/excalidraw and @excalidraw/mermaid-to-excalidraw
  // are browser-bundler builds (use extensionless imports like "roughjs/bin/rough"
  // that Node's strict ESM rejects). Mermaid → Excalidraw conversion runs
  // client-side in the React UI (Task 30+). Re-enable here only via vite-node
  // or a Vite SSR pipeline if a server-side path becomes needed.
  app.post("/api/export-png", async (c) => {
    const form = await c.req.formData();
    const path = form.get("path");
    const blob = form.get("blob");
    if (typeof path !== "string" || !(blob instanceof Blob)) {
      return c.text("Missing path or blob", 400);
    }
    const buf = Buffer.from(await blob.arrayBuffer());
    await writeFile(path, buf);
    return c.json({ ok: true });
  });

  app.post("/api/from-mermaid", async (c) => {
    const body = (await c.req.json()) as { syntax?: string };
    if (!body.syntax) return c.text("Missing syntax", 400);
    return c.text(
      "Not implemented: convert Mermaid client-side via @excalidraw/mermaid-to-excalidraw",
      501,
    );
  });

  app.get("/api/icon-search", async (c) => {
    const raw = (c.req.query("q") ?? "").trim();
    if (!raw) return c.text("Missing q", 400);
    const q = raw.toLowerCase();

    type SimpleHit = {
      source: "simpleicons";
      name: string;
      label: string;
      score: number;
    };
    type IconifyHit = {
      source: "iconify";
      set: string;
      name: string;
      label: string;
      score: number;
    };

    let simpleHits: SimpleHit[] = [];
    try {
      const idx = await getSimpleiconsIndex();
      simpleHits = idx
        .filter((i) => i.slug.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))
        .slice(0, 10)
        .map((i) => ({
          source: "simpleicons" as const,
          name: i.slug,
          label: i.title,
          score: i.slug === q ? 100 : i.slug.startsWith(q) ? 75 : 50,
        }));
    } catch {
      // simpleicons CDN failure is non-fatal
    }

    let iconifyHits: IconifyHit[] = [];
    try {
      const r = await fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(q)}&limit=10`,
      );
      if (r.ok) {
        const j = (await r.json()) as { icons?: string[] };
        iconifyHits = (j.icons ?? []).map((full) => {
          const [set, name] = full.split(":");
          return {
            source: "iconify" as const,
            set: set ?? "",
            name: name ?? "",
            label: name ?? "",
            score: name === q ? 100 : name?.startsWith(q) ? 60 : 30,
          };
        });
      }
    } catch {
      // iconify failure is non-fatal
    }

    const merged = [...simpleHits, ...iconifyHits].sort((a, b) => b.score - a.score).slice(0, 15);
    return c.json(merged);
  });

  app.get("/api/icon", async (c) => {
    const source = c.req.query("source");
    const name = c.req.query("name");
    const set = c.req.query("set") ?? "logos";
    if (!source || !name) return c.text("Missing source or name", 400);
    const spec =
      source === "simpleicons"
        ? ({ source: "simpleicons", name } as const)
        : ({ source: "iconify", set, name } as const);
    const result = await fetchIcon(spec);
    if (!result) return c.text("Icon not found", 404);
    return c.body(result.svg, 200, {
      "content-type": "image/svg+xml",
      "x-cache": result.cacheHit ? "HIT" : "MISS",
    });
  });

  app.get("/api/design-guide", async (c) => {
    return c.body(await readFile("./references/design-guide.json"), 200, {
      "content-type": "application/json",
    });
  });

  app.get("/api/screenshot", (c) =>
    c.text("Not implemented: use client-side export via /api/export-png", 501),
  );

  // Serve the built UI for any non-/api/ path.
  // The serveStatic root is relative to CWD, so resolve UI_DIST_DIR relative
  // to the server file's location and strip CWD when present.
  if (existsSync(UI_DIST_DIR)) {
    app.use(
      "/*",
      serveStatic({
        root: relativeToCwd(UI_DIST_DIR),
        // SPA fallback: rewrite "/" to "/index.html"; everything else stays as-is.
        rewriteRequestPath: (path) => (path === "/" ? "/index.html" : path),
      }),
    );
  }

  app.get("/api/describe", async (c) => {
    const path = c.req.query("path");
    if (!path) return c.text("Missing path", 400);
    if (!existsSync(path)) return c.text("Not found", 404);
    const scene = JSON.parse(await readFile(path, "utf8"));
    return c.json(describeScene(scene.elements ?? []));
  });

  app.post("/api/restore", async (c) => {
    const body = (await c.req.json()) as { path?: string; snapshotId?: string };
    if (!body.path || !body.snapshotId) {
      return c.text("Missing path or snapshotId", 400);
    }
    const backup = `${body.path}.bak-${body.snapshotId}`;
    if (!existsSync(backup)) {
      return c.text("Snapshot not found", 404);
    }
    copyFileSync(backup, body.path);
    return c.json({ ok: true });
  });

  const server: ServerType = serve({ fetch: app.fetch, port: opts.port ?? 0 });
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const port = (server.address() as AddressInfo).port;

  return {
    url: `http://localhost:${port}`,
    app,
    stop: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

// Detect direct invocation. Plain string-compare against `file://${argv[1]}` breaks
// when the path contains spaces (e.g. "Open Source") because import.meta.url
// URL-encodes them but argv[1] keeps the literal space. pathToFileURL normalizes both.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const handle = await startServer({ port: Number(process.env.PORT ?? 0) });
  console.log(`drawloop-skill listening at ${handle.url}`);
}
