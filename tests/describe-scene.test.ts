import { describe, expect, it } from "vitest";
import { type SceneSummary, describeScene } from "../ui/src/lib/describe-scene";

describe("describeScene", () => {
  it("summarizes element types and counts", () => {
    const elements = [
      {
        id: "1",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        customData: { role: "service" },
      },
      {
        id: "2",
        type: "rectangle",
        x: 200,
        y: 0,
        width: 100,
        height: 50,
        customData: { role: "data" },
      },
      {
        id: "3",
        type: "arrow",
        x: 100,
        y: 25,
        width: 100,
        height: 0,
      },
    ];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture cast
    const s: SceneSummary = describeScene(elements as any);
    expect(s.elementCount).toBe(3);
    expect(s.byType.rectangle).toBe(2);
    expect(s.byType.arrow).toBe(1);
    expect(s.elements[0].role).toBe("service");
    expect(s.bbox).toEqual([0, 0, 300, 50]);
  });

  it("returns empty bbox for empty scene", () => {
    const s = describeScene([]);
    expect(s.elementCount).toBe(0);
    expect(s.bbox).toEqual([0, 0, 0, 0]);
  });
});
