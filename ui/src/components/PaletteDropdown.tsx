import { useEffect, useState } from "react";
import { type PaletteSummary, api } from "../lib/api";

export function PaletteDropdown({
  filePath,
  onApplied,
}: {
  filePath: string;
  onApplied: () => void;
}) {
  const [palettes, setPalettes] = useState<PaletteSummary[]>([]);
  const [current, setCurrent] = useState<string>("default");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.palettes().then(setPalettes);
  }, []);

  async function change(name: string) {
    setBusy(true);
    setCurrent(name);
    try {
      await api.applyPalette(filePath, name);
      onApplied();
    } finally {
      setBusy(false);
    }
  }

  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 13,
        color: "#374151",
      }}
      title="Palette controls canvas background, shape fill colors, and shape stroke colors based on each shape's semantic role (client, service, data, cache, ai, etc.). It does not change arrow colors."
    >
      <span>Palette:</span>
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        disabled={busy || palettes.length === 0}
        style={{
          padding: "4px 8px",
          fontSize: 13,
          border: "1px solid #d1d5db",
          borderRadius: 6,
        }}
      >
        {palettes.map((p) => (
          <option key={p.name} value={p.name}>
            {prettyPaletteName(p.name)}
          </option>
        ))}
      </select>
    </label>
  );
}

function prettyPaletteName(name: string): string {
  // Brand acronyms stay uppercase; everything else gets title case.
  const acronyms = new Set(["aws", "gcp"]);
  if (acronyms.has(name)) return name.toUpperCase();
  if (name === "k8s") return "K8s";
  return name.charAt(0).toUpperCase() + name.slice(1);
}
