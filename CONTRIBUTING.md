# Contributing to drawloop-skill

Contributions are welcome. drawloop-skill is a Claude Code skill — not an npm package — so the contribution surface is the GitHub repo and the skill files inside it.

## Development setup

```bash
git clone https://github.com/sashiksu/drawloop-skill.git
cd drawloop-skill
npm install
```

Run the test suite: `npm test`
Run lint + format check: `npm run check`
Auto-format: `npm run format`

## Pull requests

1. Branch from `main`: `git checkout -b feature/<name>` or `fix/<name>`
2. Add tests for any new code
3. `npm run check` must pass locally
4. Open a PR with a clear description of the change

## Adding a palette

Drop a new file in `palettes/<name>.json` matching the shape of `palettes/default.json`. The endpoint reads the directory at request time — no code change needed. Open a PR with the new file + a brief CHANGELOG entry.

## Adding icons

Icons are discovered at runtime via `/api/icon-search` (simpleicons + Iconify). There's no registry file to edit. If you find a brand or set that's missing, open an issue describing the search query and the expected match.

## Code style

- Biome handles lint + format (`npm run format`)
- TypeScript strict mode
- Vitest as test runner

## Reporting bugs

Use the GitHub Issues page. Include: Node version (`node --version`), OS, the `.excalidraw` file (if relevant), and steps to reproduce.
