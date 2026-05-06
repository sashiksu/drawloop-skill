/**
 * Layout preview: estimate orientation, shape, and subgraph ordering of a
 * Mermaid flowchart BEFORE rendering it. The full Mermaid → Excalidraw pipeline
 * runs in the browser (bundled deps), but for orientation guidance we only need
 * a lightweight DAG built from the textual edges plus a subgraph-membership
 * map.
 *
 * Algorithm:
 *   1. Parse `flowchart` lines, ignoring directives.
 *   2. Track subgraph membership: which subgraph each node belongs to.
 *   3. Extract edges with the regex `id[label?] -...> id[label?]`.
 *   4. Compute longest-path rank from every source node (incoming = 0).
 *   5. depth = max(rank)+1; maxWidth = max(nodes-at-rank).
 *   6. Suggest TB if depth > maxWidth, else LR.
 *   7. Build subgraph adjacency matrix (edge counts between every pair).
 *   8. Greedy-reorder subgraphs so high-traffic pairs are adjacent.
 *   9. Surface complexity-gate flags (>25 nodes, >5 subgraphs, etc.).
 *  10. Render the diagram in Unicode box-drawing characters so the terminal
 *      preview is visually meaningful (not just dashes).
 *
 * Usage:
 *   npx tsx scripts/preview-layout.ts path/to/mermaid.txt
 *   echo "$MERMAID" | npx tsx scripts/preview-layout.ts -
 */

import { readFile } from "node:fs/promises";

type Graph = {
  labels: Map<string, string>;
  outgoing: Map<string, string[]>;
  incoming: Map<string, string[]>;
  subgraphs: Map<string, string>; // nodeId -> subgraphId
  subgraphTitles: Map<string, string>; // subgraphId -> display title
  subgraphOrder: string[]; // declaration order
};

function parseMermaid(src: string): Graph {
  const labels = new Map<string, string>();
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const subgraphs = new Map<string, string>();
  const subgraphTitles = new Map<string, string>();
  const subgraphOrder: string[] = [];

  const ensureNode = (id: string, label?: string, currentSubgraph?: string | null) => {
    const existing = labels.get(id);
    if (label) labels.set(id, label);
    else if (!existing) labels.set(id, id);
    if (!outgoing.has(id)) outgoing.set(id, []);
    if (!incoming.has(id)) incoming.set(id, []);
    if (currentSubgraph && !subgraphs.has(id)) subgraphs.set(id, currentSubgraph);
  };

  // Require a terminating `>` so single dashes inside labels (e.g. `image-resize`,
  // `X-Ray`) don't accidentally tokenize as edges. Covers `-->`, `==>`, `-.->`.
  const edgeRe =
    /([A-Za-z0-9_]+)(?:\[([^\]]+)\]|\(([^)]+)\))?\s*[-=.~]{1,3}>\s*([A-Za-z0-9_]+)(?:\[([^\]]+)\]|\(([^)]+)\))?/;
  // Matches `subgraph Foo` and `subgraph Foo ["Display Title"]`.
  const subgraphRe = /^subgraph\s+([A-Za-z0-9_]+)(?:\s*\[\s*"?([^"\]]+)"?\s*\])?/;

  // Strip Mermaid's textual edge-labels so the simpler edgeRe can run.
  // Handles `-- text -->`, `-. text .->`, `== text ==>`, and `|text|` forms.
  const stripEdgeLabel = (line: string): string =>
    line
      .replace(/\|[^|]*\|/g, "")
      .replace(/--\s+[^-]+?\s+-->/g, " --> ")
      .replace(/-\.\s+[^.]+?\s+\.->/g, " -.-> ")
      .replace(/==\s+[^=]+?\s+==>/g, " ==> ");

  const stack: string[] = [];

  for (const raw of src.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("%%")) continue;
    if (/^(flowchart|graph)\b/i.test(line)) continue;
    const sgMatch = line.match(subgraphRe);
    if (sgMatch) {
      const id = sgMatch[1];
      const title = sgMatch[2] ?? id;
      if (!subgraphTitles.has(id)) {
        subgraphTitles.set(id, title);
        subgraphOrder.push(id);
      }
      stack.push(id);
      continue;
    }
    if (/^end\b/.test(line)) {
      stack.pop();
      continue;
    }
    const currentSubgraph = stack[stack.length - 1] ?? null;
    const stripped = stripEdgeLabel(line);
    const m = stripped.match(edgeRe);
    if (!m) {
      // Standalone node declaration: `Foo["Bar"]`
      const nodeOnly = line.match(/^([A-Za-z0-9_]+)(?:\[([^\]]+)\]|\(([^)]+)\))/);
      if (nodeOnly) {
        const [, id, lblRect, lblRound] = nodeOnly;
        ensureNode(id, lblRect ?? lblRound, currentSubgraph);
      }
      continue;
    }
    const [, a, laRect, laRound, b, lbRect, lbRound] = m;
    ensureNode(a, laRect ?? laRound, currentSubgraph);
    ensureNode(b, lbRect ?? lbRound, currentSubgraph);
    outgoing.get(a)!.push(b);
    incoming.get(b)!.push(a);
  }
  return { labels, outgoing, incoming, subgraphs, subgraphTitles, subgraphOrder };
}

function computeRanks(g: Graph): Map<string, number> {
  const ranks = new Map<string, number>();
  const visit = (n: string, depth: number, stack: Set<string>) => {
    if (stack.has(n)) return;
    const cur = ranks.get(n) ?? -1;
    if (cur >= depth) return;
    ranks.set(n, depth);
    stack.add(n);
    for (const next of g.outgoing.get(n) ?? []) visit(next, depth + 1, stack);
    stack.delete(n);
  };
  for (const [id, ins] of g.incoming) {
    if (ins.length === 0) visit(id, 0, new Set());
  }
  for (const id of g.labels.keys()) if (!ranks.has(id)) ranks.set(id, 0);
  return ranks;
}

type SubgraphPairCount = { from: string; to: string; count: number };

function subgraphAdjacency(g: Graph): SubgraphPairCount[] {
  const counts = new Map<string, number>();
  for (const [src, dests] of g.outgoing) {
    const sgA = g.subgraphs.get(src);
    if (!sgA) continue;
    for (const dst of dests) {
      const sgB = g.subgraphs.get(dst);
      if (!sgB || sgB === sgA) continue;
      const key = sgA < sgB ? `${sgA}::${sgB}` : `${sgB}::${sgA}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => {
      const [from, to] = key.split("::");
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count);
}

// Greedy reordering: start with the heaviest pair, then keep extending the
// chain by attaching whichever unplaced subgraph has the strongest pull
// toward either end. Falls back to declaration order for orphans.
function suggestSubgraphOrdering(g: Graph, pairs: SubgraphPairCount[]): string[] {
  const all = [...g.subgraphOrder];
  if (all.length <= 2 || pairs.length === 0) return all;

  const placed: string[] = [];
  const remaining = new Set(all);

  const heaviest = pairs[0];
  placed.push(heaviest.from, heaviest.to);
  remaining.delete(heaviest.from);
  remaining.delete(heaviest.to);

  const pull = (a: string, b: string) =>
    pairs.find((p) => (p.from === a && p.to === b) || (p.from === b && p.to === a))?.count ?? 0;

  while (remaining.size > 0) {
    let best: { id: string; side: "head" | "tail"; score: number } | null = null;
    for (const id of remaining) {
      const head = pull(id, placed[0]);
      const tail = pull(id, placed[placed.length - 1]);
      if (best === null || head > best.score || tail > best.score) {
        if (head >= tail) best = { id, side: "head", score: head };
        else best = { id, side: "tail", score: tail };
      }
    }
    if (!best) break;
    if (best.side === "head") placed.unshift(best.id);
    else placed.push(best.id);
    remaining.delete(best.id);
  }
  // Append any orphans (no inter-subgraph edges) in original order.
  for (const id of all) if (!placed.includes(id)) placed.push(id);
  return placed;
}

type Suggestion = {
  depth: number;
  maxWidth: number;
  orientation: "LR" | "TB";
  layers: string[][];
  edgeCount: number;
};

function analyze(g: Graph): Suggestion {
  const ranks = computeRanks(g);
  const depth = (Math.max(0, ...ranks.values()) || 0) + 1;
  const layers: string[][] = Array.from({ length: depth }, () => []);
  for (const [id, r] of ranks) layers[r].push(g.labels.get(id) ?? id);
  const maxWidth = Math.max(...layers.map((l) => l.length));
  const orientation = depth > maxWidth * 1.2 ? "TB" : "LR";
  const edgeCount = [...g.outgoing.values()].reduce((a, l) => a + l.length, 0);
  return { depth, maxWidth, orientation, layers, edgeCount };
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// Box-drawing renderer. Uses Unicode box characters so the terminal preview
// resembles a real diagram instead of bracketed labels with dashes.
function renderAscii(layers: string[][], orientation: "LR" | "TB"): string {
  const cellWidth = 18;
  const cellInner = cellWidth - 4; // borders + 1px pad on each side
  const cells = layers.map((row) => row.map((s) => clip(s, cellInner)));

  const top = (n: number) => `┌${"─".repeat(n)}┐`;
  const bot = (n: number) => `└${"─".repeat(n)}┘`;
  const mid = (l: string, n: number) => `│ ${l.padEnd(n - 2)} │`;

  if (orientation === "TB") {
    const lines: string[] = [];
    for (let r = 0; r < cells.length; r++) {
      const row = cells[r];
      lines.push(row.map(() => top(cellWidth - 2)).join("  "));
      lines.push(row.map((l) => mid(l, cellWidth - 2)).join("  "));
      lines.push(row.map(() => bot(cellWidth - 2)).join("  "));
      if (r < cells.length - 1) {
        lines.push(row.map(() => `${" ".repeat((cellWidth - 1) >> 1)}▼`.padEnd(cellWidth + 2)).join(""));
      }
    }
    return lines.join("\n");
  }

  // LR: each rank is a column, rows are slots within that column.
  const cols = cells.length;
  const rows = Math.max(...cells.map((c) => c.length));
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const top1: string[] = [];
    const mid1: string[] = [];
    const bot1: string[] = [];
    for (let c = 0; c < cols; c++) {
      const lbl = cells[c][r];
      if (lbl === undefined) {
        const blank = " ".repeat(cellWidth);
        top1.push(blank);
        mid1.push(blank);
        bot1.push(blank);
      } else {
        top1.push(top(cellWidth - 2));
        mid1.push(mid(lbl, cellWidth - 2));
        bot1.push(bot(cellWidth - 2));
      }
    }
    const arrow = " ▶ ";
    lines.push(top1.join("   "));
    lines.push(mid1.join(arrow));
    lines.push(bot1.join("   "));
    if (r < rows - 1) lines.push("");
  }
  return lines.join("\n");
}

// Complexity gate diagnostics — surfaces threshold breaches inline so the user
// sees them when reviewing the preview.
function complexityFlags(g: Graph, s: Suggestion): string[] {
  const flags: string[] = [];
  if (g.labels.size > 25) {
    flags.push(`⚠ ${g.labels.size} nodes (> 25): consider splitting into multiple views (cloud-presets.md)`);
  }
  if (g.subgraphOrder.length > 5) {
    flags.push(`⚠ ${g.subgraphOrder.length} subgraphs (> 5): split, OR set _drawloopSkillPending.layout to "elk"`);
  }
  if (s.depth > 8) {
    flags.push(`⚠ depth ${s.depth} (> 8): use LR orientation; TB will read as a tall ribbon`);
  }
  return flags;
}

async function readSource(arg: string): Promise<string> {
  if (arg === "-") {
    const chunks: Buffer[] = [];
    for await (const c of process.stdin) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString("utf8");
  }
  return readFile(arg, "utf8");
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: preview-layout.ts <mermaid-file | ->");
    process.exit(2);
  }
  const src = await readSource(arg);
  const g = parseMermaid(src);
  const s = analyze(g);
  const banner = s.orientation === "TB" ? "vertical (TB)" : "horizontal (LR)";

  const out: string[] = [
    "# Layout preview",
    `Nodes ${g.labels.size}  ·  Edges ${s.edgeCount}  ·  Depth ${s.depth}  ·  Widest rank ${s.maxWidth}`,
    `Suggested orientation: ${banner}`,
  ];

  const flags = complexityFlags(g, s);
  if (flags.length > 0) {
    out.push("");
    out.push(...flags);
  }

  if (g.subgraphOrder.length >= 2) {
    const pairs = subgraphAdjacency(g);
    const suggested = suggestSubgraphOrdering(g, pairs);
    const same =
      suggested.length === g.subgraphOrder.length &&
      suggested.every((id, i) => id === g.subgraphOrder[i]);
    out.push("");
    out.push("## Subgraphs");
    out.push(`Declared order:  ${g.subgraphOrder.map((id) => g.subgraphTitles.get(id) ?? id).join(" → ")}`);
    if (!same) {
      out.push(`Suggested order: ${suggested.map((id) => g.subgraphTitles.get(id) ?? id).join(" → ")}`);
      out.push("(reorder subgraph blocks in your Mermaid to match — heavy-traffic pairs land adjacent)");
    } else {
      out.push("(declared order is already optimal for the inter-subgraph edge density)");
    }
    if (pairs.length > 0) {
      out.push("Inter-subgraph edge counts (heaviest first):");
      for (const p of pairs.slice(0, 8)) {
        const a = g.subgraphTitles.get(p.from) ?? p.from;
        const b = g.subgraphTitles.get(p.to) ?? p.to;
        out.push(`  ${a} ↔ ${b}: ${p.count}`);
      }
    }
  }

  out.push("");
  out.push("## Shape preview");
  out.push(renderAscii(s.layers, s.orientation));
  out.push("");

  process.stdout.write(out.join("\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
