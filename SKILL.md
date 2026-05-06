---
name: drawloop-skill
description: Open a local Excalidraw editor in the browser, generate diagrams from a description, edit interactively, swap palettes, and save back to disk. Use when the user wants to create or refine an architecture/flowchart/system diagram.
---

# drawloop-skill — Bidirectional Excalidraw editor as a Claude skill

drawloop-skill runs a local Node + Hono server that opens a browser-embedded Excalidraw editor on a single port. You generate the initial scene; the user edits interactively (drag, recolor, delete, switch palette); the file on disk is the single source of truth.

## When to invoke

- User asks to draw / create / generate a diagram
- User asks to refine an existing `.excalidraw` file
- User wants to switch palette or recolor a diagram
- User wants to render a `.excalidraw` to PNG

## How to invoke — one-shot pattern

When the user asks for a new diagram, run **this single Bash recipe**. Don't ask the user to run anything; you do it all and end with a clickable URL.

```bash
SKILL_DIR=~/.claude/skills/drawloop-skill
PORT=8787

# 1. One-time UI build (~10s, only on first invocation per machine).
[[ -d "$SKILL_DIR/ui/dist" ]] || (cd "$SKILL_DIR" && npm run build:ui)

# 2. Start server idempotently. If something is already on PORT and it's
#    drawloop-skill, reuse it; otherwise spawn fresh.
if ! curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
  cd "$SKILL_DIR" && nohup env PORT=$PORT npx tsx server.ts \
    >/tmp/drawloop-skill.log 2>&1 </dev/null &
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 0.5
    curl -fs "http://localhost:$PORT/api/health" >/dev/null 2>&1 && break
  done
fi

# 3. Generate the diagram. <OUT_PATH> = the user's requested path
#    (resolve to absolute first), <MERMAID> + <ROLES_JSON> = your inferred values.
USER_PATH="<USER_PATH>"
mkdir -p "$(dirname "$USER_PATH")"
# Portable absolute-path resolution (works on macOS BSD + GNU; doesn't need the file to exist).
OUT_PATH="$(cd "$(dirname "$USER_PATH")" && pwd)/$(basename "$USER_PATH")"
cd "$SKILL_DIR" && npx tsx scripts/generate-template.ts \
  --server "http://localhost:$PORT" \
  --out "$OUT_PATH" \
  --palette "<PALETTE>" \
  --mermaid "<MERMAID_SYNTAX>"

# 4. Print the URL — percent-encode the path so spaces and other unsafe chars
#    don't truncate the URL when pasted into a browser address bar.
ENCODED_PATH=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$OUT_PATH")
echo "Open: http://localhost:$PORT/?path=$ENCODED_PATH"
```

**The script** writes a scene with `_drawloopSkillPending = { mermaid, roles, icons, palette }`. The browser resolves it on load (parses Mermaid → tags roles → applies palette → saves resolved scene back). The user sees a "Loading…" placeholder for ~200ms, then the diagram.

**Roles** are passed via the script's stdin or by writing the file directly via `/api/save` if `--roles` isn't enough. The current script accepts only `--mermaid`/`--out`/`--palette`/`--server`; for richer payloads (roles/icons) **POST directly to `/api/save`**:

```bash
USER_PATH="<USER_PATH>"
mkdir -p "$(dirname "$USER_PATH")"
ABSPATH="$(cd "$(dirname "$USER_PATH")" && pwd)/$(basename "$USER_PATH")"

# Build the scene JSON inline; the browser resolves _drawloopSkillPending.
SCENE=$(cat <<JSON
{
  "type": "excalidraw",
  "version": 2,
  "elements": [{
    "type": "text", "id": "drawloop-skill-loading", "x": 100, "y": 100,
    "width": 400, "height": 40,
    "text": "Loading diagram…",
    "fontSize": 20, "fontFamily": 1, "textAlign": "left", "verticalAlign": "top",
    "strokeColor": "#64748B", "backgroundColor": "transparent", "fillStyle": "solid",
    "strokeWidth": 1, "strokeStyle": "solid", "roughness": 1, "opacity": 100,
    "seed": 1, "version": 1, "versionNonce": 1, "isDeleted": false, "groupIds": [],
    "boundElements": null, "link": null, "locked": false, "angle": 0
  }],
  "appState": {"viewBackgroundColor": "#F8FAFC", "gridSize": 20},
  "files": {},
  "_drawloopSkillPending": {
    "mermaid": "<MERMAID_SYNTAX>",
    "roles": <ROLES_JSON>,
    "icons": <ICONS_JSON>,
    "palette": "<PALETTE_NAME>",
    "layout": "dagre"
  }
}
JSON
)
curl -fsS -X POST "http://localhost:$PORT/api/save" \
  -H "content-type: application/json" \
  -d "{\"path\": \"$ABSPATH\", \"json\": $SCENE}" >/dev/null

# Percent-encode the path so the URL stays intact when pasted into a browser.
ENCODED_PATH=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$ABSPATH")
echo "Open: http://localhost:$PORT/?path=$ENCODED_PATH"
```

## Workflow contracts

When the user asks to **create a new diagram**:

1. Decide diagram type (architecture, flowchart, etc.) — see `references/pattern-library.md`.
2. Pick palette — see `references/palette.md`. Default to `"default"`.
3. Write a draft Mermaid syntax for the structure. Use external-actor and complexity-gate rules from `references/pattern-library.md`. Don't pick an orientation yet — the next step decides it.
4. **MANDATORY CHECKPOINT: preview the layout and confirm orientation with the user.** This step is not optional. Even if the user gave a domain hint (e.g. "AWS architecture"), you must still run the preview and ask. The only valid skip is if the user *explicitly* wrote `LR` or `TB` (or "horizontal" / "vertical") in their request.

   a. Write your draft Mermaid to a temp file (`/tmp/<slug>.mmd`).
   b. Run `npx tsx scripts/preview-layout.ts /tmp/<slug>.mmd` from `~/.claude/skills/drawloop-skill`.
   c. Paste the **entire** preview output into your reply to the user — including the box-drawing shape, the complexity flags (⚠ lines), and the suggested subgraph reordering.
   d. Ask, verbatim: *"Here's a preview of the structure. Render **horizontal (LR)** or **vertical (TB)**?"* If complexity flags fired, also ask: *"Should I split into multiple views, or render as one with the ELK layout engine?"*
   e. **Do not call `/api/save` until the user replies.** Treat this as a blocking question.
   f. Once the user answers, update the first line of your Mermaid to `flowchart LR` or `flowchart TB`. If they chose ELK, add `"layout": "elk"` to the `_drawloopSkillPending` block (see step 7). If they chose to split, restart at step 1 for each view.

5. Map labels → semantic roles (`{ "Client": "client", "API": "service", "DB": "data" }`).
6. For each label that should have an icon, search via `GET /api/icon-search?q=<term>` (expand abbreviations: `"jwt"` → `"JSON Web Tokens"`). Build `{ "Label": "icon-short-name" }` map. See `references/icons.md`.
7. Run the **one-shot recipe** above with everything filled in. The `_drawloopSkillPending` block accepts an optional `"layout": "elk"` field — set it when (a) the user chose ELK at step 4, or (b) the source has > 25 nodes and the user didn't want to split.
8. Print the URL to the user.

**Why step 4 is mandatory.** Auto-layout fails silently on complex graphs — you don't see the bad layout until the browser renders it, by which point the user has to redo the work. The preview catches this in 100ms in the terminal. Skipping it is the single biggest cause of bad drawloop-skill output.

When the user asks to **refine a diagram they edited**:

1. Read `references/bidirectional-edit.md` for sync rules.
2. `GET /api/describe?path=<file>` — read the compact scene summary, NOT the full file.
3. Identify target element(s) by id from the summary.
4. Read only the target elements via `JSON.parse(await readFile(path, "utf8"))`.
5. Apply minimal edits (text/colors/positions only when explicitly asked).
6. `POST /api/save` — auto-snapshots before write. Browser auto-reloads via SSE.

When the user asks to **swap palette**:

```bash
curl -fsS -X POST "http://localhost:$PORT/api/apply-palette" \
  -H "content-type: application/json" \
  -d '{"path":"<ABSPATH>","palette":"aws"}'
```

When the user asks to **export PNG**:

The Export PNG button in the browser produces the canonical output (matches what the user sees). Server-side rendering is deferred — see plan Task 13.

## Hard rules (`references/schema.md` for full list)

- **Diamonds are not arrow targets** — Excalidraw arrow binding to diamonds is brittle. Use rectangles for any node an arrow points to or from.
- **`label: { text }` shortcut** — when generating, prefer skeleton form `{ type: "rectangle", label: { text: "..." } }` over emitting two elements with `boundElements`/`containerId`.
- **`customData` is dropped** by `convertToExcalidrawElements` (Excalidraw issue #7654). The browser sets it via `updateScene` AFTER conversion.
- **Manual placements are sacred** — when the user has saved, never reposition existing elements unless they explicitly ask. See `references/editor-protocol.md`.
- **External actors live outside subgraphs** — Customer/Seller/Admin/third-party-API declarations must come BEFORE any `subgraph` block. See `references/pattern-library.md`.
- **Complexity gate** — > 25 nodes, > 5 subgraphs, or > 4 cross-zone edges means SPLIT into multiple views (see `references/cloud-presets.md`) or use `"layout": "elk"`. The preview script flags these.
- **Layout engine** — `_drawloopSkillPending.layout` defaults to `"dagre"`. Set to `"elk"` for complex graphs (auto-applied above 25 nodes). ELK handles cross-subgraph edges and crossing minimization much better than dagre.

## References (load only what you need)

| File | Load when |
|---|---|
| `references/palette.md` | Generating a diagram or swapping palette |
| `references/schema.md` | Editing JSON directly or generating elements |
| `references/editor-protocol.md` | Any write-back operation |
| `references/pattern-library.md` | Initial generation; concept→shape mapping |
| `references/bidirectional-edit.md` | Follow-up edits after a user save |
| `references/icons.md` | Anything visual; icon embedding |
| `references/cloud-presets.md` | Cloud architecture diagrams (AWS/Azure/GCP/K8s) |

Default loadout for initial generation: `palette.md` + `pattern-library.md` + `schema.md` + `icons.md`.
Default loadout for follow-up edit: `bidirectional-edit.md` only.
