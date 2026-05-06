import { exportToBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useState } from "react";
import { api } from "../lib/api";

type Status = "idle" | "exporting" | "ok" | "err";

export function ExportPngButton({
  filePath,
  getApi,
}: {
  filePath: string;
  getApi: () => ExcalidrawImperativeAPI | null;
}) {
  const [status, setStatus] = useState<Status>("idle");

  async function exportPng() {
    const ex = getApi();
    if (!ex) return;
    setStatus("exporting");
    try {
      const blob = await exportToBlob({
        elements: ex.getSceneElementsIncludingDeleted(),
        appState: { ...ex.getAppState(), exportBackground: true },
        files: ex.getFiles(),
        mimeType: "image/png",
        quality: 1,
        exportPadding: 24,
      });
      const target = filePath.replace(/\.excalidraw$/, ".png");
      await api.exportPng(target, blob);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("err");
    }
  }

  const label =
    status === "exporting"
      ? "Exporting…"
      : status === "ok"
        ? "Exported ✓"
        : status === "err"
          ? "Error"
          : "Export PNG";

  return (
    <button
      type="button"
      onClick={exportPng}
      disabled={status === "exporting"}
      style={{
        padding: "4px 12px",
        fontSize: 13,
        border: "1px solid #047857",
        background: "#10b981",
        color: "white",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
