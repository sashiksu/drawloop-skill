export type PaletteSummary = {
  name: string;
  description?: string;
  canvasBackground: string;
};

export const api = {
  load: async (path: string) => {
    const r = await fetch(`/api/load?path=${encodeURIComponent(path)}`);
    if (!r.ok) throw new Error(`load failed: ${r.status}`);
    return r.json();
  },
  save: async (path: string, json: unknown) => {
    const r = await fetch("/api/save", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, json }),
    });
    if (!r.ok) throw new Error(`save failed: ${r.status}`);
    return r.json() as Promise<{ ok: boolean; snapshotId: string }>;
  },
  palettes: async (): Promise<PaletteSummary[]> => {
    const r = await fetch("/api/palettes");
    if (!r.ok) throw new Error(`palettes failed: ${r.status}`);
    return r.json();
  },
  applyPalette: async (path: string, palette: string) => {
    const r = await fetch("/api/apply-palette", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path, palette }),
    });
    if (!r.ok) throw new Error(`apply-palette failed: ${r.status}`);
    return r.json() as Promise<{ ok: boolean; changedCount: number }>;
  },
  exportPng: async (path: string, blob: Blob) => {
    const fd = new FormData();
    fd.append("path", path);
    fd.append("blob", blob);
    const r = await fetch("/api/export-png", { method: "POST", body: fd });
    if (!r.ok) throw new Error(`export-png failed: ${r.status}`);
    return r.json() as Promise<{ ok: boolean }>;
  },
  watch: (path: string, onChange: () => void): EventSource => {
    const es = new EventSource(`/api/watch?path=${encodeURIComponent(path)}`);
    es.addEventListener("change", onChange);
    return es;
  },
};
