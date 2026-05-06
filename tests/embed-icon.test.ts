import { describe, expect, it } from "vitest";
import { type EmbedResult, embedIconAsImage } from "../server/embed-icon";

describe("embedIconAsImage", () => {
  it("returns an Excalidraw image element + a files entry from an SVG string", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>`;
    const result: EmbedResult = embedIconAsImage(svg, {
      x: 100,
      y: 100,
      size: 32,
      iconShort: "test-icon",
    });

    expect(result.element.type).toBe("image");
    expect(result.element.x).toBe(100);
    expect(result.element.y).toBe(100);
    expect(result.element.width).toBe(32);
    expect(result.element.fileId).toBe(result.fileId);
    expect(result.element.customData?.iconSource).toBeDefined();

    expect(result.file.mimeType).toBe("image/svg+xml");
    expect(result.file.dataURL).toContain("data:image/svg+xml;base64,");
    expect(result.file.id).toBe(result.fileId);
  });
});
