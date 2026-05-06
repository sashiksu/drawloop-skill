import { useEffect, useState } from "react";

type Catalog = Record<"background" | "fills" | "outlines" | "arrows", Array<{ name: string; description?: string }>>;

const CATEGORY_LABELS: Record<keyof Catalog, string> = {
  background: "Background",
  fills: "Fills",
  outlines: "Outlines",
  arrows: "Arrows",
};

const TOOLTIPS: Record<keyof Catalog, string> = {
  background: "Canvas color behind everything.",
  fills: "Background color of each shape, mapped from its semantic role (client, service, data, etc.).",
  outlines: "Border color of each shape, also role-based.",
  arrows: "Color of all arrows / lines (single color, not role-based).",
};

function pretty(name: string): string {
  if (name === "aws" || name === "gcp") return name.toUpperCase();
  if (name === "k8s") return "K8s";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function StylingPanel({
  filePath,
  onApplied,
}: {
  filePath: string;
  onApplied: () => void;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [bg, setBg] = useState("default");
  const [fills, setFills] = useState("default");
  const [outlines, setOutlines] = useState("default");
  const [arrows, setArrows] = useState("default");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/styling/palettes")
      .then((r) => r.json())
      .then((data: Catalog) => setCatalog(data))
      .catch(() => setCatalog(null));
  }, []);

  async function apply(next: {
    background?: string;
    fills?: string;
    outlines?: string;
    arrows?: string;
    theme?: "light" | "dark";
  }) {
    setBusy(true);
    try {
      await fetch("/api/apply-styling", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: filePath,
          background: next.background ?? bg,
          fills: next.fills ?? fills,
          outlines: next.outlines ?? outlines,
          arrows: next.arrows ?? arrows,
          theme: next.theme ?? theme,
        }),
      });
      onApplied();
    } finally {
      setBusy(false);
    }
  }

  function dropdown(category: keyof Catalog, value: string, setValue: (v: string) => void) {
    const options = catalog?.[category] ?? [];
    return (
      <label
        key={category}
        title={TOOLTIPS[category]}
        style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#374151" }}
      >
        <span>{CATEGORY_LABELS[category]}:</span>
        <select
          value={value}
          disabled={busy || options.length === 0}
          onChange={(e) => {
            const v = e.target.value;
            setValue(v);
            apply({ [category]: v });
          }}
          style={{
            padding: "3px 6px",
            fontSize: 12,
            border: "1px solid #d1d5db",
            borderRadius: 4,
            background: "white",
          }}
        >
          {options.map((p) => (
            <option key={p.name} value={p.name}>
              {pretty(p.name)}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {dropdown("background", bg, setBg)}
      {dropdown("fills", fills, setFills)}
      {dropdown("outlines", outlines, setOutlines)}
      {dropdown("arrows", arrows, setArrows)}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          const next = theme === "light" ? "dark" : "light";
          setTheme(next);
          apply({ theme: next });
        }}
        title="Toggle light/dark theme. Applies to all four palette categories and tints monochrome icons."
        style={{
          padding: "4px 10px",
          fontSize: 12,
          border: "1px solid #d1d5db",
          borderRadius: 4,
          background: theme === "dark" ? "#1F2937" : "white",
          color: theme === "dark" ? "#F3F4F6" : "#374151",
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {theme === "light" ? "Light" : "Dark"}
      </button>
    </div>
  );
}
