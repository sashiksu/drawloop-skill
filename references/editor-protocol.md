# Editor protocol — write-back rules

The `.excalidraw` file is the single source of truth. Both Claude and the browser read/write the same file.

## Save semantics

- Browser Save → POST `/api/save` → server auto-snapshots `<file>.bak-<timestamp>` → writes file
- Claude edit → POST `/api/save` → same flow
- Server's `node:fs.watch` detects the change → SSE pushes to browser → browser refetches via `/api/load` and calls `excalidrawAPI.updateScene`

## Sequencing rule

Edits are sequential — never simultaneous:
1. Claude writes → user sees update via SSE.
2. User edits + Saves → Claude reads next turn.
3. Repeat.

There is no merge logic. The most recent writer wins.

## "Manual placements are sacred"

When the user has saved, **never reposition** existing elements unless they explicitly ask. This is the contract. If the user asks for a layout change, they will say "align these" or "evenly space these" — until then, leave `x`/`y` alone.

You may always:
- Edit `text` of an existing element
- Add new elements
- Delete elements the user explicitly asked to delete
- Recolor via `customData.role` + apply-palette
- Add/remove `boundElements`

You may NOT (without explicit ask):
- Change `x`, `y`, `width`, `height` of existing elements
- Reroute existing arrows
- Reorder elements (which can affect visual stacking)

## Snapshots

Every write auto-snapshots. To roll back:
- `POST /api/restore { path, snapshotId }` where `snapshotId` is the timestamp from the `.bak-<id>` filename.
- Or just `cp <file>.bak-<id> <file>`.

Snapshots are gitignored. Clean periodically — `find . -name "*.bak-*" -mtime +7 -delete`.
