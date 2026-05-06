# Excalidraw schema reference + hard gotchas

## File shape

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://github.com/sashiksu/drawloop-skill",
  "elements": [...],
  "appState": { "viewBackgroundColor": "#fff", "gridSize": 20 },
  "files": { "<fileId>": { "id", "mimeType", "dataURL", "created" } }
}
```

## Common element shapes

### Rectangle with label (skeleton form)

When generating, prefer `convertToExcalidrawElements` with skeleton:
```json
{ "type": "rectangle", "id": "r1", "x": 100, "y": 100, "width": 180, "height": 90,
  "label": { "text": "API Service" }, "customData": { "role": "service" } }
```

This auto-creates a bound text element with `boundElements` and `containerId` wired up. **Important:** `convertToExcalidrawElements` drops `customData` (Excalidraw issue #7654). Set role tags via `updateScene` AFTER conversion.

### Arrow

```json
{ "type": "arrow", "id": "a1", "x": 280, "y": 145, "width": 120, "height": 0,
  "points": [[0,0],[120,0]], "endArrowhead": "arrow",
  "startBinding": { "elementId": "r1", "focus": 0, "gap": 2 },
  "endBinding": { "elementId": "r2", "focus": 0, "gap": 2 } }
```

Always use `startBinding`/`endBinding` rather than absolute coordinates — the binding survives moves.

### Image (icon)

```json
{ "type": "image", "id": "img1", "x": 100, "y": 100, "width": 32, "height": 32,
  "fileId": "abc123", "status": "saved", "customData": { "iconSource": "spring" } }
```

The `fileId` references `files["abc123"]`. The dataURL there carries the SVG.

## Hard gotchas (these ship broken diagrams)

1. **Diamonds are not arrow targets.** Arrow binding to diamonds is brittle — the arrow can render in the wrong location. Use rectangles for any node an arrow connects to. Reserve diamonds for terminal decision indicators that aren't arrow-bound, OR accept the limitation.
2. **Labels need TWO elements in raw JSON form.** A labeled rectangle in raw form is `{ ...rectangle, boundElements: [{ id: "t1", type: "text" }] }` PLUS `{ type: "text", containerId: "rect-id", text: "..." }`. The skeleton + `convertToExcalidrawElements` handles this for you — use it.
3. **`customData` is dropped during skeleton conversion** (issue #7654). Set role tags AFTER `convertToExcalidrawElements`.
4. **Arrow `points` are RELATIVE to `x`/`y`.** First point is usually `[0, 0]`. Don't paste absolute coords there.
5. **`width`/`height` can be negative** (mirroring) — when iterating bbox, use `Math.abs`.
6. **Files must be in `files`** — referencing `fileId` without an entry in `files` shows a broken-image placeholder.
7. **`appState.viewBackgroundColor`** controls the export background. Without `exportBackground: true` in the export call, you get a transparent PNG.
