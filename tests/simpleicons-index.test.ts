import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetCache, getSimpleiconsIndex } from "../server/simpleicons-index";

describe("getSimpleiconsIndex", () => {
  beforeEach(() => {
    _resetCache();
  });

  it("fetches the catalog on first call and caches the result", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            icons: [
              { title: "Spring", slug: "spring", hex: "#6DB33F" },
              { title: "PostgreSQL", slug: "postgresql", hex: "#4169E1" },
            ],
          }),
        ),
      ),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    try {
      const a = await getSimpleiconsIndex();
      const b = await getSimpleiconsIndex();

      expect(a.length).toBe(2);
      expect(a[0].slug).toBe("spring");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(a).toBe(b);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
