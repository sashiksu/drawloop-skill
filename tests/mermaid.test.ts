import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ServerHandle, startServer } from "../server";

let handle: ServerHandle;
beforeAll(async () => {
  handle = await startServer({ port: 0 });
});
afterAll(async () => {
  await handle.stop();
});

describe("/api/from-mermaid (deferred to client)", () => {
  it("returns 501 with a clear redirect message when syntax is provided", async () => {
    const syntax = "flowchart LR\n  A[Start] --> B[Process] --> C[End]";
    const res = await fetch(`${handle.url}/api/from-mermaid`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ syntax }),
    });
    expect(res.status).toBe(501);
    const text = await res.text();
    expect(text).toContain("client-side");
  });

  it("returns 400 for missing syntax (validates before deferring)", async () => {
    const res = await fetch(`${handle.url}/api/from-mermaid`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
