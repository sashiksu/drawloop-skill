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

## Powered by

drawloop-skill is built on top of excellent open-source projects. Without them, none of this would exist:

| Project | Role in drawloop-skill | License |
|---|---|---|
| [Excalidraw](https://excalidraw.com/) ([source](https://github.com/excalidraw/excalidraw)) | The hand-drawn canvas editor at the heart of the skill — every shape you drag is an Excalidraw element | MIT |
| [Mermaid](https://mermaid.js.org/) | Parses the textual diagram syntax that Claude generates into a node-and-edge graph | MIT |
| [mermaid-to-excalidraw](https://github.com/excalidraw/mermaid-to-excalidraw) | The bridge that converts Mermaid's graph into Excalidraw skeleton elements | MIT |
| [Eclipse Layout Kernel (ELK)](https://www.eclipse.org/elk/) | Alternate layout engine for graphs with heavy cross-subgraph traffic — auto-flipped above 25 nodes | EPL-2.0 |
| [Hono](https://hono.dev/) | Lightweight web framework powering the local Node server (`server.ts`) | MIT |
| [React](https://react.dev/) | UI framework for the browser editor | MIT |
| [Vite](https://vitejs.dev/) | Bundler for the editor UI; produces the static `ui/dist/` served by the server | MIT |
| [Iconify](https://iconify.design/) | Live icon catalog (200,000+ icons across 150+ sets) used by `/api/icon-search` | MIT |
| [Simple Icons](https://simpleicons.org/) | Brand-logo catalog (~3,300 logos) for service iconography (CC0 — no attribution required, but credit given anyway out of respect) | CC0 |

**Tooling:** [TypeScript](https://www.typescriptlang.org/), [Biome](https://biomejs.dev/) (lint + format), [Vitest](https://vitest.dev/) (test runner), [tsx](https://github.com/privatenumber/tsx) (Node TypeScript execution).

The skill itself is glue + opinions — the heavy lifting belongs to the projects above. Please star and support the upstream maintainers if drawloop-skill has been useful to you.

## License

[MIT](LICENSE).
