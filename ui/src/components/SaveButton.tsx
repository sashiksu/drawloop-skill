import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useState } from "react";
import { api } from "../lib/api";

type Status = "idle" | "saving" | "ok" | "err";

export function SaveButton({
  filePath,
  getApi,
}: {
  filePath: string;
  getApi: () => ExcalidrawImperativeAPI | null;
}) {
  const [status, setStatus] = useState<Status>("idle");

  async function save() {
    const ex = getApi();
    if (!ex) return;
    setStatus("saving");
    try {
      const elements = ex.getSceneElementsIncludingDeleted();
      const appState = ex.getAppState();
      const files = ex.getFiles();
      const json = {
        type: "excalidraw",
        version: 2,
        source: "https://github.com/sashiksu/drawloop-skill",
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize ?? 20,
        },
        files,
      };
      await api.save(filePath, json);
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("err");
    }
  }

  const label =
    status === "saving"
      ? "Saving…"
      : status === "ok"
        ? "Saved ✓"
        : status === "err"
          ? "Error"
          : "Save";

  return (
    <button
      type="button"
      onClick={save}
      disabled={status === "saving"}
      style={{
        padding: "4px 12px",
        fontSize: 13,
        border: "1px solid #1d4ed8",
        background: "#2563eb",
        color: "white",
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
