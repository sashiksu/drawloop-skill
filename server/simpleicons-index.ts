const INDEX_URL = "https://cdn.jsdelivr.net/npm/simple-icons@latest/_data/simple-icons.json";
const TTL = 24 * 60 * 60 * 1000;

export type SimpleiconEntry = { title: string; slug: string; hex?: string };

let cache: { fetched: number; data: SimpleiconEntry[] } | null = null;

export async function getSimpleiconsIndex(): Promise<SimpleiconEntry[]> {
  if (cache && Date.now() - cache.fetched < TTL) return cache.data;
  const r = await fetch(INDEX_URL);
  if (!r.ok) throw new Error(`simpleicons index fetch failed: ${r.status}`);
  const json = (await r.json()) as { icons: SimpleiconEntry[] };
  cache = { fetched: Date.now(), data: json.icons };
  return json.icons;
}

export function _resetCache(): void {
  cache = null;
}
