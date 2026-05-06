export type Palette = {
  name: string;
  description?: string;
  canvasBackground: string;
  roles: Record<string, { fill: string; stroke: string }>;
};

type Element = {
  id: string;
  type: string;
  customData?: { role?: string; [k: string]: unknown };
  backgroundColor?: string;
  strokeColor?: string;
};

const RECOLORABLE_TYPES = new Set(["rectangle", "ellipse", "diamond"]);

export function applyPalette<T extends Element>(elements: T[], palette: Palette): T[] {
  return elements.map((el) => {
    if (!RECOLORABLE_TYPES.has(el.type)) return el;
    const role = el.customData?.role ?? "default";
    const colors = palette.roles[role] ?? palette.roles.default;
    if (!colors) return el;
    return { ...el, backgroundColor: colors.fill, strokeColor: colors.stroke };
  });
}
