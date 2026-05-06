import { describe, expect, it } from "vitest";
import { normalizeLayout } from "../ui/src/lib/normalize-layout";

describe("normalizeLayout", () => {
  it("shifts the bounding box so its top-left sits at (padding, padding)", () => {
    const els = [
      { id: "a", type: "rectangle", x: 200, y: 150, width: 100, height: 60 },
      { id: "b", type: "rectangle", x: 350, y: 280, width: 100, height: 60 },
    ];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture cast
    const result = normalizeLayout(els as any, 80);
    expect(result[0].x).toBe(80);
    expect(result[0].y).toBe(80);
    // Relative offsets between elements are preserved.
    expect(result[1].x).toBe(80 + (350 - 200));
    expect(result[1].y).toBe(80 + (280 - 150));
  });

  it("uses padding=80 by default", () => {
    const els = [{ id: "a", type: "rectangle", x: 0, y: 0, width: 50, height: 50 }];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture cast
    const result = normalizeLayout(els as any);
    expect(result[0].x).toBe(80);
    expect(result[0].y).toBe(80);
  });

  it("translates negative coordinates into the positive quadrant", () => {
    const els = [
      { id: "a", type: "rectangle", x: -50, y: -30, width: 80, height: 40 },
      { id: "b", type: "rectangle", x: 100, y: 60, width: 80, height: 40 },
    ];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture cast
    const result = normalizeLayout(els as any, 50);
    expect(result[0].x).toBe(50);
    expect(result[0].y).toBe(50);
    expect(result[1].x).toBe(50 + 150);
    expect(result[1].y).toBe(50 + 90);
  });

  it("translates arrows by the same offset (points stay relative)", () => {
    const els = [
      { id: "rect", type: "rectangle", x: 200, y: 200, width: 100, height: 60 },
      {
        id: "arrow",
        type: "arrow",
        x: 250,
        y: 260,
        width: 100,
        height: 80,
        points: [
          [0, 0],
          [100, 80],
        ],
      },
    ];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture cast
    const result = normalizeLayout(els as any, 80);
    // Both elements shifted by the same dx/dy = (-200+80, -200+80) = (-120, -120)
    expect(result[0].x).toBe(80);
    expect(result[1].x).toBe(250 - 120);
    expect(result[1].y).toBe(260 - 120);
    // points are relative to x/y in Excalidraw, so they must NOT be re-translated.
    expect(result[1].points).toEqual([
      [0, 0],
      [100, 80],
    ]);
  });

  it("returns an empty array unchanged", () => {
    expect(normalizeLayout([])).toEqual([]);
  });

  it("ignores elements without numeric x/y when computing the bounding box", () => {
    const els = [
      { id: "a", type: "rectangle", x: 100, y: 100, width: 50, height: 50 },
      // biome-ignore lint/suspicious/noExplicitAny: deliberately malformed
      { id: "b", type: "text" } as any,
    ];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture cast
    const result = normalizeLayout(els as any, 40);
    expect(result[0].x).toBe(40);
    expect(result[0].y).toBe(40);
    // Malformed element passes through unchanged.
    expect(result[1]).toEqual({ id: "b", type: "text" });
  });
});
