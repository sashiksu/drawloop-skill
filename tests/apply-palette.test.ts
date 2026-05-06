import { describe, expect, it } from "vitest";
import { type Palette, applyPalette } from "../ui/src/lib/apply-palette";

const palette: Palette = {
  name: "test",
  canvasBackground: "#F8FAFC",
  roles: {
    service: { fill: "#FFF3CD", stroke: "#92400E" },
    data: { fill: "#D1FAE5", stroke: "#047857" },
    default: { fill: "#FFFFFF", stroke: "#1E293B" },
  },
};

describe("applyPalette", () => {
  it("recolors elements by customData.role", () => {
    const els = [
      {
        id: "1",
        type: "rectangle",
        customData: { role: "service" },
        backgroundColor: "#000",
        strokeColor: "#000",
      },
      {
        id: "2",
        type: "rectangle",
        customData: { role: "data" },
        backgroundColor: "#000",
        strokeColor: "#000",
      },
    ];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture cast
    const result = applyPalette(els as any, palette);
    expect(result[0].backgroundColor).toBe("#FFF3CD");
    expect(result[0].strokeColor).toBe("#92400E");
    expect(result[1].backgroundColor).toBe("#D1FAE5");
  });

  it("falls back to default role when role is missing or unknown", () => {
    const els = [
      { id: "1", type: "rectangle", backgroundColor: "#000", strokeColor: "#000" },
      {
        id: "2",
        type: "rectangle",
        customData: { role: "unknown-role" },
        backgroundColor: "#000",
        strokeColor: "#000",
      },
    ];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture cast
    const result = applyPalette(els as any, palette);
    expect(result[0].backgroundColor).toBe("#FFFFFF");
    expect(result[1].backgroundColor).toBe("#FFFFFF");
  });

  it("does not mutate text or arrow stroke meaning", () => {
    const els = [
      {
        id: "1",
        type: "text",
        customData: { role: "service" },
        backgroundColor: "transparent",
        strokeColor: "#000",
      },
      { id: "2", type: "arrow", strokeColor: "#000" },
    ];
    // biome-ignore lint/suspicious/noExplicitAny: test fixture cast
    const result = applyPalette(els as any, palette);
    expect(result[0].backgroundColor).toBe("transparent");
    expect(result[1].strokeColor).toBe("#000");
  });
});
