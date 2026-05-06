# Icons reference

Icons are embedded as Excalidraw `image` elements that reference SVG data URIs in `files`. Discovery happens **at runtime** — no hardcoded registry. Search the live catalogs and pick the best hit.

## Sources searched

| Source | Catalog size | License | Strength |
|---|---|---|---|
| **simpleicons** | ~3,300 brand logos | CC0 (no attribution) | Brand identity (Spring, Postgres, AWS, Cloudflare) |
| **Iconify** | ~200,000 icons across 150+ sets | Mostly MIT/ISC | UI/abstract icons (database, shield, user); some niche brand sets |

## Icon-spec format for `_drawloopSkillPending.icons`

The browser resolver embeds icons inside their parent rectangle (anchored top-left). Specs are colon-delimited:

| Source | Format | Example |
|---|---|---|
| Iconify | `iconify:<set>:<name>` | `iconify:logos:postgresql` |
| Simple Icons | `simpleicons:<name>` | `simpleicons:redis` |

Bare names like `"postgresql"` will NOT resolve — the source prefix is mandatory.

The resolver:
1. Fetches the SVG via `/api/icon`
2. Hashes it (`sha256` truncated to 24 chars) for the `fileId`
3. Adds an `image` element at `(rect.x + 10, rect.y + (rect.height - 28) / 2)`, size 28×28
4. Reserves 40px on the rectangle's left for the icon and re-aligns the label text to the right

If a fetch fails, the icon is silently skipped — the diagram still renders without it.

## Discovery flow

### Step 1 — Search

```ts
const r = await fetch(`${SERVER_URL}/api/icon-search?q=postgres`);
const hits = await r.json();
// → [
//     { source: "simpleicons", name: "postgresql", label: "PostgreSQL", score: 100 },
//     { source: "iconify", set: "lucide", name: "database", label: "database", score: 60 },
//     ...
//   ]
```

The endpoint queries simpleicons (cached 24h) + Iconify (live), merges and ranks the results. Highest `score` first. Empty array means no matches.

### Step 2 — Pick

Read the ranked list and pick the `(source, name[, set])` that best fits the element. When a brand exists, prefer simpleicons (it's the official logo, CC0). Fall back to Iconify for generic/UI concepts.

### Step 3 — Fetch the SVG

```ts
// simpleicons:
const r = await fetch(`${SERVER_URL}/api/icon?source=simpleicons&name=postgresql`);

// iconify (set required):
const r = await fetch(`${SERVER_URL}/api/icon?source=iconify&set=lucide&name=database`);

const svg = await r.text();
```

The `/api/icon` endpoint caches each SVG at `icons/cache/<hash>.svg`. The `x-cache: HIT|MISS` response header tells you whether it came from cache.

### Step 4 — Embed

```ts
import { embedIconAsImage } from "../server/embed-icon";
const { element, file, fileId } = embedIconAsImage(svg, {
  x: 100, y: 100, size: 32, iconShort: "postgres",
});
scene.elements.push(element);
scene.files[fileId] = file;
```

## Smart query patterns

**Expand abbreviations before searching.** Search engines need real words.

| If the user says... | Search for... |
|---|---|
| "jwt" | "JSON Web Tokens" or "json-web-tokens" |
| "gcp" | "Google Cloud" |
| "k8s" | "Kubernetes" |
| "ssh" | "OpenSSH" |
| "ml" | "machine learning" |
| "db" | "database" |
| "lb" | "load balancer" |

If the first search returns no hits, try a broader synonym (e.g., "vault" → "lock" → "shield").

## Anchor-mode vs standalone-mode

- **Standalone**: the icon IS the visual — just an image element on its own
- **Anchor**: the icon sits inside a labeled rectangle. Place at `(rect.x + 8, rect.y + 8)` for top-left positioning. Add a separate text label below or to the right.

## Caching

- Icon SVGs cached at `icons/cache/<sha256(source+name)[:32]>.svg` (gitignored)
- Simpleicons catalog cached in process memory for 24h
- Iconify search is live (no cache)

To force a fresh icon: `rm icons/cache/*.svg`. To force a fresh simpleicons catalog: restart the server.

## When discovery fails

- The `/api/icon` endpoint returns 404 when the upstream returns non-SVG content (typical for typo'd names)
- The `/api/icon-search` endpoint returns `[]` for queries with no hits (try a broader synonym)
- If both simpleicons CDN and Iconify API are down, search returns `[]`; surface that to the user rather than silently shipping iconless diagrams
