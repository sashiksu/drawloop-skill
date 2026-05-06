import { existsSync, rmSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { type ServerHandle, startServer } from "../server";
import { _resetCache } from "../server/simpleicons-index";

let handle: ServerHandle;
beforeAll(async () => {
  handle = await startServer({ port: 0 });
});
afterAll(async () => {
  await handle.stop();
  rmSync("./icons/cache", { recursive: true, force: true });
});

describe("/api/icon", () => {
  // Live integration: hits cdn.simpleicons.org. Skipped in CI because
  // GitHub-hosted runners get rate-limited / non-OK responses from that
  // CDN, which is environmental, not a real failure.
  it.skipIf(process.env.CI)(
    "returns SVG for a known simpleicons icon and caches it (live CDN)",
    async () => {
      const res = await fetch(`${handle.url}/api/icon?source=simpleicons&name=spring`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/svg+xml");
      const svg = await res.text();
      expect(svg).toContain("<svg");

      expect(existsSync("./icons/cache")).toBe(true);

      const cached = await fetch(`${handle.url}/api/icon?source=simpleicons&name=spring`);
      expect(cached.headers.get("x-cache")).toBe("HIT");
    },
  );

  it("returns SVG for a known simpleicons icon and caches it (mocked CDN)", async () => {
    rmSync("./icons/cache", { recursive: true, force: true });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (u.startsWith(handle.url))
        // biome-ignore lint/suspicious/noExplicitAny: pass-through cast
        return originalFetch(input as any, init);
      if (u === "https://cdn.simpleicons.org/spring") {
        return new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
          status: 200,
          headers: { "content-type": "image/svg+xml" },
        });
      }
      return new Response(`unmocked: ${u}`, { status: 599 });
    }) as unknown as typeof fetch;

    try {
      const res = await fetch(`${handle.url}/api/icon?source=simpleicons&name=spring`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/svg+xml");
      expect(res.headers.get("x-cache")).toBe("MISS");
      const svg = await res.text();
      expect(svg).toContain("<svg");

      expect(existsSync("./icons/cache")).toBe(true);

      const cached = await fetch(`${handle.url}/api/icon?source=simpleicons&name=spring`);
      expect(cached.headers.get("x-cache")).toBe("HIT");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns 400 for missing source or name", async () => {
    const res = await fetch(`${handle.url}/api/icon?source=simpleicons`);
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown icon", async () => {
    const res = await fetch(`${handle.url}/api/icon?source=simpleicons&name=__nope__xyz`);
    expect(res.status).toBe(404);
  });
});

describe("/api/icon-search (mocked sources)", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    _resetCache();
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (u.startsWith(handle.url))
        // biome-ignore lint/suspicious/noExplicitAny: pass-through cast
        return originalFetch(input as any, init);

      if (u.includes("simple-icons.json")) {
        return new Response(
          JSON.stringify({
            icons: [
              { title: "PostgreSQL", slug: "postgresql" },
              { title: "Spring", slug: "spring" },
              { title: "Redis", slug: "redis" },
            ],
          }),
        );
      }

      if (u.includes("api.iconify.design/search")) {
        const queryMatch = u.match(/query=([^&]+)/);
        const queryParam = queryMatch ? decodeURIComponent(queryMatch[1]) : "";
        const all = ["lucide:database", "mdi:database-outline"];
        const matched = all.filter((s) => s.includes(queryParam));
        return new Response(JSON.stringify({ icons: matched }));
      }

      return new Response(`unmocked: ${u}`, { status: 599 });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns 400 when q is missing", async () => {
    const res = await fetch(`${handle.url}/api/icon-search`);
    expect(res.status).toBe(400);
  });

  it("returns merged + ranked results from simpleicons + iconify", async () => {
    const res = await fetch(`${handle.url}/api/icon-search?q=postgres`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ source: string; name: string; score: number }>;
    expect(body.some((h) => h.source === "simpleicons" && h.name === "postgresql")).toBe(true);
    expect(body[0].score).toBeGreaterThanOrEqual(body[body.length - 1].score);
  });

  it("returns empty array when nothing matches", async () => {
    const res = await fetch(`${handle.url}/api/icon-search?q=___nothing___`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("falls back to simpleicons-only if Iconify fails", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (u.startsWith(handle.url))
        // biome-ignore lint/suspicious/noExplicitAny: pass-through cast
        return originalFetch(input as any, init);
      if (u.includes("simple-icons.json")) {
        return new Response(JSON.stringify({ icons: [{ title: "Spring", slug: "spring" }] }));
      }
      if (u.includes("api.iconify.design")) throw new Error("iconify down");
      return new Response("unmocked", { status: 599 });
    }) as unknown as typeof fetch;
    _resetCache();

    const res = await fetch(`${handle.url}/api/icon-search?q=spring`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body[0].source).toBe("simpleicons");
  });
});
