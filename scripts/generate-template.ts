/**
 * Generation script: writes a `.excalidraw` file with a `_drawloopSkillPending`
 * payload containing Mermaid syntax + role hints + chosen palette + icon
 * mapping. The React UI (Task 30+) reads the pending field on load, converts
 * Mermaid to elements client-side, applies roles and palette, then saves the
 * resolved scene back and removes the pending field.
 *
 * This indirection exists because @excalidraw/excalidraw and
 * @excalidraw/mermaid-to-excalidraw are bundler-built and don't run under
 * raw Node + tsx (see Task 13 / Task 24 deferral notes).
 */

export type GenerateOptions = {
  serverUrl: string;
  mermaid: string;
  roles: Record<string, string>;
  icons: Record<string, string>;
  palette: string;
  outPath: string;
};

export type DrawloopSkillPending = {
  mermaid: string;
  roles: Record<string, string>;
  icons: Record<string, string>;
  palette: string;
};

export async function generateTemplate(opts: GenerateOptions): Promise<void> {
  const paletteRes = await fetch(`${opts.serverUrl}/api/palettes`);
  if (!paletteRes.ok) throw new Error(`palettes lookup failed: ${paletteRes.status}`);
  const palettes = (await paletteRes.json()) as Array<{
    name: string;
    canvasBackground: string;
  }>;
  const chosen = palettes.find((p) => p.name === opts.palette);

  const pending: DrawloopSkillPending = {
    mermaid: opts.mermaid,
    roles: opts.roles,
    icons: opts.icons,
    palette: opts.palette,
  };

  // Placeholder element so the file renders something in any Excalidraw viewer
  // even before the drawloop-skill UI runs the Mermaid → Excalidraw conversion.
  const placeholder = {
    type: "text",
    id: "drawloop-skill-loading",
    x: 100,
    y: 100,
    width: 400,
    height: 40,
    text: "Loading diagram… (open in drawloop-skill UI to render)",
    fontSize: 20,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    strokeColor: "#64748B",
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    seed: 1,
    version: 1,
    versionNonce: 1,
    isDeleted: false,
    groupIds: [],
    boundElements: null,
    link: null,
    locked: false,
    angle: 0,
  };

  const scene = {
    type: "excalidraw",
    version: 2,
    source: "https://github.com/sashiksu/drawloop-skill",
    elements: [placeholder],
    appState: {
      viewBackgroundColor: chosen?.canvasBackground ?? "#FFFFFF",
      gridSize: 20,
    },
    files: {},
    _drawloopSkillPending: pending,
  };

  const saveRes = await fetch(`${opts.serverUrl}/api/save`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path: opts.outPath, json: scene }),
  });
  if (!saveRes.ok) throw new Error(`save failed: ${saveRes.status}`);
}

// Detect direct invocation; pathToFileURL handles paths with spaces.
const { pathToFileURL: _pathToFileURL } = await import("node:url");
if (process.argv[1] && import.meta.url === _pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (k: string) => {
    const i = args.indexOf(`--${k}`);
    return i === -1 ? undefined : args[i + 1];
  };
  const out = opt("out");
  const mermaid = opt("mermaid");
  const palette = opt("palette") ?? "default";
  const serverUrl = opt("server") ?? "http://localhost:8787";
  if (!out || !mermaid) {
    console.error(
      "Usage: npx tsx scripts/generate-template.ts --out <path> --mermaid <syntax> [--palette <name>] [--server <url>]",
    );
    process.exit(1);
  }
  await generateTemplate({
    serverUrl,
    mermaid,
    roles: {},
    icons: {},
    palette,
    outPath: out,
  });
}
