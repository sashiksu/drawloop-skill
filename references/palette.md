# Palette reference

Palettes live in `palettes/<name>.json`. Each is a fill/stroke mapping by semantic role.

## Available palettes

- `default` — Slate-and-pastel (canvas `#F8FAFC`)
- `warm` — Earth-tones (canvas `#FFFBEB`)
- `cool` — Blues + teals (canvas `#F0F9FF`)
- `mono` — Greyscale (canvas `#FAFAFA`)
- `aws` — AWS architecture (orange/blue accents)
- `azure` — Azure (cyan/blue)
- `gcp` — Google Cloud (red/blue/yellow/green)
- `k8s` — Kubernetes (signature blues)

## Roles

Every recolorable element (rectangle / ellipse / diamond) should carry `customData.role` so palette swaps work. Roles:

| Role | Use for |
|---|---|
| `start` | Entry point, trigger, request origin |
| `end` | Success outcome, terminal state, response |
| `decision` | Conditional branching (diamond) |
| `client` | Browser, mobile, external system |
| `service` | Internal service, function, API |
| `data` | Database, durable store |
| `cache` | Ephemeral / volatile store |
| `ai` | LLM, model, inference component |
| `default` | Fallback (used when no role tag) |

## How palette swap works

`POST /api/apply-palette { path, palette }` reads the file, walks `elements[]`, looks up `customData.role`, replaces `backgroundColor` + `strokeColor` from the palette's `roles[role]`. Sets `appState.viewBackgroundColor` to the palette's `canvasBackground`. Auto-snapshots before the write.

## Adding a new palette

Drop a new `palettes/<name>.json` matching the shape of `palettes/default.json`. The `/api/palettes` endpoint reads the directory at request time — no rebuild needed.
