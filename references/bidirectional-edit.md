# Bidirectional edit protocol

After the user clicks Save in the browser, the `.excalidraw` file on disk reflects exactly what they want. Your job on the next turn: make targeted edits without re-doing their work.

## Step 1 — Read the summary, not the full file

```ts
const r = await fetch(`${SERVER_URL}/api/describe?path=${encodeURIComponent(path)}`);
const summary: SceneSummary = await r.json();
```

`SceneSummary` shape:
```ts
{
  elementCount: number;
  byType: Record<string, number>;     // { rectangle: 12, arrow: 8, text: 5 }
  elements: Array<{
    id: string;
    type: string;
    role?: string;
    label?: string;
    pos: [number, number];
    size: [number, number];
    boundTo?: string[];
  }>;
  bbox: [number, number, number, number];
}
```

Use this to identify target elements by `id`. Don't read the whole `.excalidraw` JSON yet.

## Step 2 — Read just the targeted elements

```ts
import { readFile } from "node:fs/promises";
const file = JSON.parse(await readFile(path, "utf8"));
const target = file.elements.find((e: { id: string }) => e.id === targetId);
```

## Step 3 — Edit minimally

Per `editor-protocol.md`:
- Edit `text`, add/remove `boundElements`, recolor by changing `customData.role` then re-applying the palette
- Do NOT change `x`, `y`, `width`, `height`, or arrow routing

## Step 4 — Snapshot + write

```ts
await fetch(`${SERVER_URL}/api/save`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ path, json: file }),
});
```

The server auto-snapshots before write. The browser hot-reloads via SSE.

## When the user wants you to reposition

If they say "align these horizontally" or "evenly space these," then layout changes are explicitly authorized. Snapshot first, do the layout, write back. The user can always restore from `.bak-<ts>` if they don't like the result.

## Common follow-up patterns

| User says | Do |
|---|---|
| "rename X to Y" | Find element with `label === "X"`, change `text` |
| "make Z purple" | Set `customData.role = "ai"`, apply palette |
| "delete the Y box" | Find element by label, remove from `elements[]` (mark `isDeleted: true` to preserve undo) |
| "add a Cache between A and B" | Add new rect element + 2 new arrows, leave A and B's positions alone |
| "swap to AWS palette" | Just `POST /api/apply-palette { path, palette: "aws" }` |
