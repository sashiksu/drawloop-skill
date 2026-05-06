import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useEffect, useRef, useState } from "react";
import { ExportPngButton } from "./components/ExportPngButton";
import { SaveButton } from "./components/SaveButton";
import { StylingPanel } from "./components/StylingPanel";
import { api } from "./lib/api";
import { type Palette, applyPalette } from "./lib/apply-palette";
import { normalizeLayout } from "./lib/normalize-layout";

type DrawloopSkillPending = {
  mermaid: string;
  roles: Record<string, string>;
  icons: Record<string, string>;
  palette: string;
  // Optional layout engine. "elk" uses Mermaid's ELK renderer (better for
  // complex graphs with cross-subgraph edges); default is dagre.
  layout?: "dagre" | "elk";
};

type LoadedScene = {
  type?: string;
  elements?: unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
  _drawloopSkillPending?: DrawloopSkillPending;
};

async function sha256Hex(s: string): Promise<string> {
  const buf = new TextEncoder().encode(s);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Parse spec "iconify:set:name" or "simpleicons:name" → /api/icon URL.
function iconUrl(spec: string): string | null {
  const parts = spec.split(":");
  if (parts[0] === "iconify" && parts.length === 3) {
    return `/api/icon?source=iconify&set=${encodeURIComponent(parts[1])}&name=${encodeURIComponent(parts[2])}`;
  }
  if (parts[0] === "simpleicons" && parts.length === 2) {
    return `/api/icon?source=simpleicons&name=${encodeURIComponent(parts[1])}`;
  }
  return null;
}

// Brand-logo SVGs from `logos:*` are commonly wordmark+glyph with viewBox
// aspect ratios from 3:1 to 5:1. Forcing them into a fixed square stretches
// or letterboxes badly in Excalidraw. Read viewBox (or width/height attrs)
// to recover the intrinsic aspect; default to 1 if neither is parseable.
function svgAspectRatio(svg: string): number {
  const vb = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (vb) {
    const parts = vb[1].split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[3] > 0) return parts[2] / parts[3];
  }
  const w = svg.match(/\bwidth\s*=\s*["']([\d.]+)/i);
  const h = svg.match(/\bheight\s*=\s*["']([\d.]+)/i);
  if (w && h && Number(h[1]) > 0) return Number(w[1]) / Number(h[1]);
  return 1;
}

// Fetch each per-label icon, embed as a sibling image element, return a map
// of rectangleId → reserved horizontal width. Caller widens rectangles.
async function embedIcons(
  // biome-ignore lint/suspicious/noExplicitAny: element shape varies
  elements: any[],
  files: Record<string, unknown>,
  iconsByLabel: Record<string, string>,
): Promise<Map<string, number>> {
  const reserve = new Map<string, number>();
  if (!iconsByLabel || Object.keys(iconsByLabel).length === 0) return reserve;

  // biome-ignore lint/suspicious/noExplicitAny: element shape varies
  const textsByContainer = new Map<string, any>();
  for (const el of elements) {
    if (el?.type === "text" && el.containerId) textsByContainer.set(el.containerId, el);
  }

  // Icons render at fixed height; width follows the SVG's intrinsic aspect
  // (capped so a very wide wordmark doesn't push the rectangle absurdly wide).
  const iconHeight = 28;
  const iconWidthCap = 80;
  const ICON_LEFT_PAD = 12;
  const ICON_RIGHT_PAD = 12;
  // biome-ignore lint/suspicious/noExplicitAny: element shape varies
  const newImages: any[] = [];

  for (const el of elements) {
    if (el?.type !== "rectangle") continue;
    const text = textsByContainer.get(el.id);
    const label: string | undefined = text?.text;
    if (!label) continue;
    const spec = iconsByLabel[label];
    if (!spec) continue;
    const url = iconUrl(spec);
    if (!url) continue;
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const svg = await r.text();
      const aspect = svgAspectRatio(svg);
      const iconWidth = Math.max(
        iconHeight,
        Math.min(iconWidthCap, Math.round(iconHeight * aspect)),
      );
      const fileId = (await sha256Hex(svg)).slice(0, 24);
      const dataURL = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
      const elementId = (await sha256Hex(`${fileId}:${el.id}`)).slice(0, 16);
      const iconX = (el.x ?? 0) + ICON_LEFT_PAD;
      const iconY = (el.y ?? 0) + ((el.height ?? iconHeight) - iconHeight) / 2;
      newImages.push({
        type: "image",
        id: elementId,
        x: iconX,
        y: iconY,
        width: iconWidth,
        height: iconHeight,
        fileId,
        status: "saved",
        strokeColor: "transparent",
        backgroundColor: "transparent",
        fillStyle: "solid",
        strokeWidth: 0,
        strokeStyle: "solid",
        roughness: 0,
        opacity: 100,
        seed: Math.floor(Math.random() * 1_000_000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 1_000_000),
        isDeleted: false,
        groupIds: [],
        boundElements: null,
        link: null,
        locked: false,
        angle: 0,
        customData: { iconSource: spec },
      });
      files[fileId] = {
        id: fileId,
        mimeType: "image/svg+xml",
        dataURL,
        created: Date.now(),
      };
      // Reserve the icon's full horizontal footprint on the rectangle's left:
      // left pad + actual icon width + gap before text.
      reserve.set(el.id, ICON_LEFT_PAD + iconWidth + ICON_RIGHT_PAD);
    } catch {
      // skip icons we can't fetch; diagram still renders without them
    }
  }
  for (const img of newImages) elements.push(img);
  return reserve;
}

// Mermaid lays out using its own font metrics; Excalidraw renders in Virgil.
// Long labels overflow when widths don't match. Heuristic widening fixes it
// and shifts the contained text right past any embedded icon.
// Returns rectId → widened-by-N-px so arrows can be re-anchored.
function fitTextInRectangles(
  // biome-ignore lint/suspicious/noExplicitAny: element shape varies
  elements: any[],
  iconReserve: Map<string, number>,
): Map<string, number> {
  const deltas = new Map<string, number>();
  // biome-ignore lint/suspicious/noExplicitAny: element shape varies
  const textsByContainer = new Map<string, any>();
  for (const el of elements) {
    if (el?.type === "text" && el.containerId) {
      textsByContainer.set(el.containerId, el);
    }
  }
  for (const el of elements) {
    if (el?.type !== "rectangle") continue;
    const text = textsByContainer.get(el.id);
    const label: string | undefined = text?.text;
    if (!label) continue;
    const fontSize = text.fontSize ?? 20;
    const charWidth = fontSize * 0.65;
    const horizontalPadding = 24;
    const iconSpace = iconReserve.get(el.id) ?? 0;
    const minWidth = Math.ceil(label.length * charWidth + horizontalPadding * 2 + iconSpace);
    const currentWidth = el.width ?? 0;
    if (currentWidth < minWidth) {
      deltas.set(el.id, minWidth - currentWidth);
      el.width = minWidth;
      text.width = minWidth - horizontalPadding * 2;
    }
    if (iconSpace > 0) {
      text.x = (el.x ?? 0) + iconSpace + horizontalPadding / 2;
      text.textAlign = "left";
    }
  }
  return deltas;
}

// Excalidraw arrows have absolute coordinates; bindings are metadata that
// don't auto-update when the bound rectangle resizes. After widening
// rectangles on the right, shift each outgoing arrow's start so it reattaches
// to the new right edge — and compensate the points array so the endpoint
// stays put.
function adjustArrowsForResize(
  // biome-ignore lint/suspicious/noExplicitAny: element shape varies
  elements: any[],
  deltas: Map<string, number>,
): void {
  if (deltas.size === 0) return;
  for (const el of elements) {
    if (el?.type !== "arrow") continue;
    const startId: string | undefined = el.startBinding?.elementId;
    if (!startId) continue;
    const delta = deltas.get(startId);
    if (!delta) continue;
    el.x = (el.x ?? 0) + delta;
    if (Array.isArray(el.points) && el.points.length > 1) {
      el.points = el.points.map((p: [number, number], i: number) =>
        i === 0 ? p : [p[0] - delta, p[1]],
      );
    }
  }
}

// Cheap node-count estimate from raw Mermaid. Counts unique identifiers that
// appear with a `[label]` or `(label)` suffix, OR on either side of an arrow.
// Doesn't need a real parser — close enough to gate renderer selection.
function countMermaidNodes(mermaid: string): number {
  const ids = new Set<string>();
  const decl = /([A-Za-z0-9_]+)(?:\[[^\]]+\]|\([^)]+\))/g;
  const arrow = /([A-Za-z0-9_]+)\s*[-=.~]{1,3}>\s*([A-Za-z0-9_]+)/g;
  let m: RegExpExecArray | null = decl.exec(mermaid);
  while (m) {
    ids.add(m[1]);
    m = decl.exec(mermaid);
  }
  m = arrow.exec(mermaid);
  while (m) {
    ids.add(m[1]);
    ids.add(m[2]);
    m = arrow.exec(mermaid);
  }
  return ids.size;
}

async function resolvePendingScene(scene: LoadedScene, path: string): Promise<LoadedScene> {
  const pending = scene._drawloopSkillPending;
  if (!pending) return scene;

  const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
  const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");

  // Mermaid's defaults pack nodes ~50px apart, which feels cramped on the
  // Excalidraw canvas. Bumping spacing produces a more readable initial layout.
  // The package's MermaidConfig type only exposes `curve`, but parseMermaid
  // forwards the full object to mermaid.initialize, so the extra dagre keys
  // (nodeSpacing/rankSpacing) and `defaultRenderer` take effect at runtime —
  // cast to satisfy TS.
  //
  // Renderer selection: explicit pending.layout wins; otherwise auto-flip to
  // ELK for graphs above the dagre comfort zone (>25 nodes in the Mermaid
  // source — counted via `[...]` declarations and the right-hand side of `-->`).
  const nodeCount = countMermaidNodes(pending.mermaid);
  const renderer =
    pending.layout === "elk" || (pending.layout !== "dagre" && nodeCount > 25) ? "elk" : "dagre";
  // biome-ignore lint/suspicious/noExplicitAny: package's MermaidConfig type is narrower than runtime
  const mermaidConfig: any = {
    flowchart: {
      curve: "linear",
      nodeSpacing: 80,
      rankSpacing: 100,
      defaultRenderer: renderer,
    },
  };
  const { elements: skeletons } = await parseMermaidToExcalidraw(pending.mermaid, mermaidConfig);
  // biome-ignore lint/suspicious/noExplicitAny: skeleton type isn't exported
  const converted = convertToExcalidrawElements(skeletons as any) as Array<{
    id?: string;
    text?: string;
    customData?: Record<string, unknown>;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }>;
  // Shift bounding box origin to (80, 80) so the diagram has breathing room.
  const elements = normalizeLayout(converted, 80);

  // Re-tag elements with customData.role from the pending hints (key = label or id).
  for (const el of elements) {
    const key = el.text ?? el.id;
    if (!key) continue;
    const role = pending.roles[key];
    if (role) el.customData = { ...(el.customData ?? {}), role };
  }

  // Embed icons (mutates elements + files), widen rectangles to fit text +
  // icon footprint, then re-anchor outgoing arrows so they start at the new
  // right edge.
  const files: Record<string, unknown> = { ...(scene.files ?? {}) };
  // biome-ignore lint/suspicious/noExplicitAny: element shape varies
  const iconReserve = await embedIcons(elements as any[], files, pending.icons ?? {});
  // biome-ignore lint/suspicious/noExplicitAny: element shape varies
  const widenDeltas = fitTextInRectangles(elements as any[], iconReserve);
  // biome-ignore lint/suspicious/noExplicitAny: element shape varies
  adjustArrowsForResize(elements as any[], widenDeltas);

  // Apply chosen palette.
  let viewBackgroundColor = "#FFFFFF";
  try {
    const palettesRes = await fetch("/api/palettes");
    if (palettesRes.ok) {
      const palettes = (await palettesRes.json()) as Array<{
        name: string;
        canvasBackground: string;
      }>;
      const chosen = palettes.find((p) => p.name === pending.palette);
      if (chosen) viewBackgroundColor = chosen.canvasBackground;

      const fullRes = await fetch(`/api/palette/${encodeURIComponent(pending.palette)}`);
      if (fullRes.ok) {
        const palette = (await fullRes.json()) as Palette;
        // biome-ignore lint/suspicious/noExplicitAny: element shape varies
        const recolored = applyPalette(elements as any, palette);
        elements.length = 0;
        elements.push(...recolored);
      }
    }
  } catch {
    // palette resolution is best-effort
  }

  const resolved: LoadedScene = {
    type: "excalidraw",
    elements,
    appState: { ...(scene.appState ?? {}), viewBackgroundColor },
    files,
  };

  // Persist resolved scene; this also drops _drawloopSkillPending.
  await fetch("/api/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, json: resolved }),
  });

  return resolved;
}

export function App() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [pendingScene, setPendingScene] = useState<LoadedScene | null>(null);
  const [apiReady, setApiReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = params.get("path");
    if (!path) return;
    setFilePath(path);

    let cancelled = false;
    const reload = async () => {
      try {
        const scene = (await api.load(path)) as LoadedScene;
        const resolved = await resolvePendingScene(scene, path);
        if (!cancelled) setPendingScene(resolved);
      } catch {
        // load/resolve errors are surfaced in network tab; UI just keeps last good state
      }
    };

    reload();
    const es = api.watch(path, reload);
    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  // Push the loaded scene into Excalidraw once both are ready.
  useEffect(() => {
    if (!apiReady || !pendingScene || !apiRef.current) return;
    apiRef.current.updateScene({
      // biome-ignore lint/suspicious/noExplicitAny: Excalidraw types are wide
      elements: (pendingScene.elements ?? []) as any,
      // biome-ignore lint/suspicious/noExplicitAny: appState type intersects many fields
      appState: (pendingScene.appState ?? {}) as any,
    });
    if (pendingScene.files) {
      // biome-ignore lint/suspicious/noExplicitAny: file shape from server
      apiRef.current.addFiles(Object.values(pendingScene.files) as any);
    }
  }, [apiReady, pendingScene]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: "8px 16px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <strong>drawloop-skill</strong>
        {filePath && <span style={{ color: "#6b7280", fontSize: 13 }}>{filePath}</span>}
        <div style={{ flex: 1 }} />
        {filePath && (
          <StylingPanel
            filePath={filePath}
            onApplied={() => {
              /* SSE watch auto-reloads the canvas after server writes the file */
            }}
          />
        )}
        {filePath && <SaveButton filePath={filePath} getApi={() => apiRef.current} />}
        {filePath && <ExportPngButton filePath={filePath} getApi={() => apiRef.current} />}
      </div>
      <div style={{ flex: 1 }}>
        <Excalidraw
          excalidrawAPI={(api) => {
            apiRef.current = api;
            setApiReady(true);
          }}
        />
      </div>
    </div>
  );
}
