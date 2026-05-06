# drawloop-skill

> A Claude Code skill for bidirectional Excalidraw diagram editing — Claude generates, you refine in the browser, both share the same file.

[![CI](https://github.com/sashiksu/drawloop-skill/actions/workflows/ci.yml/badge.svg)](https://github.com/sashiksu/drawloop-skill/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Demo:** https://sashiksu.github.io/drawloop-skill/

## What it does

drawloop-skill opens a local browser-embedded Excalidraw editor. Claude can:

- Generate the initial scene from a prompt (via Mermaid)
- Tag elements with semantic roles (`start`, `service`, `data`, …)
- Embed brand icons (Spring, Postgres, AWS, …) as image elements
- Make follow-up edits via a token-cheap structured scene summary

You can:

- Drag, recolor, delete elements interactively
- Switch palettes from a dropdown (default / warm / cool / mono / aws / azure / gcp / k8s)
- Save → file syncs to disk; Claude reads it on the next turn
- Export to PNG with one click

The `.excalidraw` file is the single source of truth — version-controllable.

## Install

Requires Node ≥20, npm, and Claude Code.

Clone the repo anywhere — `~/drawloop-skill`, `~/code/drawloop-skill`, whatever fits your layout. Only the symlink target (`~/.claude/skills/drawloop-skill`) is fixed.

```bash
# 1. Clone
git clone https://github.com/sashiksu/drawloop-skill.git ~/drawloop-skill
cd ~/drawloop-skill

# 2. Install dependencies (root install hoists into ui/ too)
npm install

# 3. Build the UI bundle (the server serves ui/dist; without this step the
#    browser tab loads but stays blank)
npm run build:ui

# 4. Expose drawloop-skill as a Claude Code skill
mkdir -p ~/.claude/skills
ln -s "$(pwd)" ~/.claude/skills/drawloop-skill
```

Verify the skill is wired up — open Claude Code and ask:

> "Draw a JWT auth diagram in `./diagrams/`."

Claude generates `./diagrams/jwt-auth.excalidraw`, starts a local server on port `8787`, and prints a clickable URL. If you instead get "I don't know how to draw," the symlink isn't being picked up — restart Claude Code or check `ls -l ~/.claude/skills/drawloop-skill`.

### Updating

```bash
cd ~/drawloop-skill
git pull
npm install            # only if dependencies changed
npm run build:ui       # rebuild the UI bundle
```

The skill picks up the new `SKILL.md` automatically; restart any running drawloop-skill server (`pkill -f "tsx server.ts"`) so it serves the freshly built bundle.

## Usage

In Claude Code, ask for any diagram:

> "Draw the OAuth 2.0 authorization code flow."
> "Sketch our microservice topology — frontend, BFF, two backend services, Postgres."
> "Refine the diagram I just edited — make the cache layer warm-coloured."

Claude generates a `.excalidraw` file, opens the browser editor, and lets you iterate. Drag nodes, swap palettes, hit Save, ask for refinements — the file on disk is the single source of truth.

## Develop

```bash
npm run dev          # server with watch (port 8787)
cd ui && npm run dev # UI with Vite HMR (separate port)
npm run check        # biome + tsc + vitest
npm run format       # biome format --write
```

Tests live in `tests/` and run under Node (no browser harness — pure functions are imported from `ui/src/lib/`).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[MIT](LICENSE).
