# Annotations & code samples reference

When the user opts in to annotations during the pre-generation question, attach short text or code-style elements near each shape. The user can delete any they don't want from the live editor.

## When to ask

Always ask once per new-diagram request, before generation. Phrasing:

> "Want descriptive annotations or sample code blocks near each shape? They appear as separate text near the boxes; you can delete any of them in the live editor."

Default to **no** if the user is on auto mode and didn't answer in the same turn — annotations clutter the canvas, so opt-in only.

## What to write

- **Annotation** — one short line, ≤60 characters. Describes the shape's responsibility, the protocol on an outgoing edge, or a key constraint. *Examples:* `"Validates JWT, 5min cache"`, `"Postgres 16, primary"`, `"emits to topic 'orders.v1'"`.
- **Code sample** — 1-4 lines of representative code or config for the shape. *Examples:* a SQL DDL line for a `data` shape, a `kafka.send(...)` call for a service that publishes, a curl command for an API.

Keep both terse. The diagram is the primary signal; annotations are footnotes.

## How to position them

Annotations are separate text elements (not bound to the shape via `containerId`). Place them:

- **Below the shape** — `y = rect.y + rect.height + 8`, `x = rect.x`. Best default; reads naturally and doesn't crowd arrows.
- **Right of the shape** — `x = rect.x + rect.width + 12`, `y = rect.y`. Use only when a node is on the rightmost column with empty canvas to the right.

Bumping `rankSpacing` to ≥160 (already the default in App.tsx) gives enough vertical room for below-shape annotations without colliding with the next layer.

## Element shape

Annotation (regular text):

```json
{
  "type": "text",
  "text": "Validates JWT, 5min cache",
  "x": ..., "y": ...,
  "fontSize": 14,
  "fontFamily": 1,
  "strokeColor": "#64748B",
  "textAlign": "left",
  "verticalAlign": "top"
}
```

Code sample (Cascadia monospace, light-bg rectangle behind it for "code feel"):

```json
{
  "type": "rectangle",
  "x": ..., "y": ...,
  "width": ..., "height": ...,
  "backgroundColor": "#F1F5F9",
  "strokeColor": "#CBD5E1",
  "strokeWidth": 1,
  "roughness": 0,
  "customData": { "kind": "code-block" }
}
{
  "type": "text",
  "text": "INSERT INTO orders (...)\nVALUES (...)",
  "fontSize": 13,
  "fontFamily": 3,
  "x": ..., "y": ...
}
```

`fontFamily: 3` is Cascadia, the monospace face. The grey backdrop rectangle is what gives the code-block feel.

## Rule: annotations never block arrows

Place annotations on the side of the shape *opposite* to its primary outgoing edge. If a node has arrows going down and right, put annotations on the left or below-left. The widened `rankSpacing` (160) already buys vertical room for below-shape annotations.

## When the user says no

Skip the annotations entirely. Don't add empty text placeholders or "TODO" markers — the canvas should be clean.
