# Changelog

All notable changes to drawloop-skill are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial release: Node + Hono + Vite + React + Excalidraw editor
- 13 server endpoints (load, save, snapshot, restore, watch, describe, screenshot, export-png, from-mermaid, icon, icon-search, palettes, palette/:name, apply-palette, design-guide)
- 8 palettes (default, warm, cool, mono, aws, azure, gcp, k8s)
- Runtime icon discovery via simpleicons + Iconify (no hardcoded registry)
- drawloop-skill-shapes library bundle (7 starter shapes)
- SKILL.md router + 7 lazy-loaded references
- Auto-snapshot before every write; one-call restore
- SSE-driven hot-reload: browser refetches when the file changes on disk

### Notes on deferred endpoints

- `/api/screenshot` and `/api/from-mermaid` return 501. Both depend on `@excalidraw/excalidraw` and `@excalidraw/utils`, which are bundler-built and require browser globals. The browser handles Mermaid → Excalidraw conversion (Vite-resolved imports) and PNG export (`exportToBlob`); server-side equivalents would require `jsdom` or a headless renderer for marginal value.
