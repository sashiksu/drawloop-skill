import { createHash } from "node:crypto";

export type EmbedOptions = {
  x: number;
  y: number;
  size: number;
  iconShort?: string;
};

export type ExcalidrawFile = {
  id: string;
  mimeType: "image/svg+xml" | "image/png";
  dataURL: string;
  created: number;
};

export type EmbedResult = {
  element: {
    type: "image";
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fileId: string;
    status: "saved";
    strokeColor: string;
    backgroundColor: string;
    fillStyle: string;
    strokeWidth: number;
    strokeStyle: string;
    roughness: number;
    opacity: number;
    seed: number;
    version: number;
    versionNonce: number;
    isDeleted: boolean;
    groupIds: string[];
    boundElements: null;
    link: null;
    locked: boolean;
    angle: number;
    customData?: { iconSource?: string };
  };
  fileId: string;
  file: ExcalidrawFile;
};

export function embedIconAsImage(svg: string, opts: EmbedOptions): EmbedResult {
  const fileId = createHash("sha256").update(svg).digest("hex").slice(0, 24);
  const dataURL = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  const elementId = createHash("sha256")
    .update(`${fileId}:${opts.x}:${opts.y}`)
    .digest("hex")
    .slice(0, 16);

  return {
    element: {
      type: "image",
      id: elementId,
      x: opts.x,
      y: opts.y,
      width: opts.size,
      height: opts.size,
      fileId,
      status: "saved",
      strokeColor: "transparent",
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 0,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      seed: Math.floor(Math.random() * 1_000_000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1_000_000),
      isDeleted: false,
      groupIds: [],
      boundElements: null,
      link: null,
      locked: false,
      angle: 0,
      customData: { iconSource: opts.iconShort },
    },
    fileId,
    file: {
      id: fileId,
      mimeType: "image/svg+xml",
      dataURL,
      created: Date.now(),
    },
  };
}
