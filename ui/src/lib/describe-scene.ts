type ExcalidrawElement = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  customData?: { role?: string; [k: string]: unknown };
  boundElements?: Array<{ id: string }> | null;
  isDeleted?: boolean;
};

export type SceneSummary = {
  elementCount: number;
  byType: Record<string, number>;
  elements: Array<{
    id: string;
    type: string;
    role?: string;
    label?: string;
    pos: [number, number];
    size: [number, number];
    boundTo?: string[];
  }>;
  bbox: [number, number, number, number];
};

export function describeScene(elements: ExcalidrawElement[]): SceneSummary {
  const live = elements.filter((e) => !e.isDeleted);
  const byType: Record<string, number> = {};
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const el of live) {
    byType[el.type] = (byType[el.type] ?? 0) + 1;
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + Math.abs(el.width));
    maxY = Math.max(maxY, el.y + Math.abs(el.height));
  }

  const bbox: [number, number, number, number] =
    live.length === 0 ? [0, 0, 0, 0] : [minX, minY, maxX, maxY];

  return {
    elementCount: live.length,
    byType,
    elements: live.map((el) => ({
      id: el.id,
      type: el.type,
      role: el.customData?.role,
      label: el.text,
      pos: [el.x, el.y],
      size: [el.width, el.height],
      boundTo: el.boundElements?.map((b) => b.id),
    })),
    bbox,
  };
}
