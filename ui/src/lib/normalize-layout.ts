/**
 * Translates every element by a single (dx, dy) so the bounding box of the
 * scene starts at (padding, padding). Mermaid's dagre layout often places the
 * top-left node near (0, 0) or at small positive offsets; on the Excalidraw
 * canvas this looks cramped against the corner. Shifting to a uniform padding
 * gives the diagram breathing room without disturbing relative positions.
 *
 * Arrow `points` are relative to the arrow's own x/y in Excalidraw, so they
 * are not re-translated.
 */
export type Positioned = {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Excalidraw arrow/line points are relative to the element's own x/y, so
  // they ride along when we shift x/y — they do not need their own translate.
  points?: Array<[number, number]>;
};

export function normalizeLayout<T extends Positioned>(elements: T[], padding = 80): T[] {
  if (elements.length === 0) return elements;

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const el of elements) {
    if (typeof el.x === "number" && typeof el.y === "number") {
      if (el.x < minX) minX = el.x;
      if (el.y < minY) minY = el.y;
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return elements;

  const dx = padding - minX;
  const dy = padding - minY;
  if (dx === 0 && dy === 0) return elements;

  return elements.map((el) => {
    if (typeof el.x !== "number" || typeof el.y !== "number") return el;
    return { ...el, x: el.x + dx, y: el.y + dy };
  });
}
