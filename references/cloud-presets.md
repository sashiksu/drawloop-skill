# Cloud architecture presets

For AWS / Azure / GCP / K8s diagrams, combine the matching palette with the matching icon set.

## View-per-concern — split before you draw

Cloud reference architectures (AWS, Azure, GCP, multi-cloud, hybrid) all publish their systems as **multiple narrow diagrams**, never one big sheet. When the system crosses the complexity gate (see `pattern-library.md`), pick the split that matches your domain. The rule is universal; the labels depend on what you're drawing.

### Common splits by domain

Pick the row that matches the system you're drawing. Each row's views become separate `.excalidraw` files in the same kebab-case folder.

| Domain | Typical view splits |
|---|---|
| **Request/response services** (web/SaaS, mobile backends, APIs) | `sync-request-flow` · `async-events` · `analytics-ml` · `observability` |
| **Data platforms** (lakehouse, warehouse, ETL) | `ingest` · `transform-pipeline` · `serving-layer` · `governance-lineage` |
| **ML systems** (training + inference) | `data-prep` · `training-pipeline` · `model-serving` · `monitoring-drift` |
| **IoT / streaming** | `device-fleet` · `ingest-edge` · `stream-processing` · `cold-storage-analytics` |
| **Identity / security** | `auth-flow` · `policy-plane` · `secrets-and-keys` · `audit-and-detection` |
| **Network topology** | `regions-and-az` · `vpc-peering` · `hybrid-onprem` · `egress-and-cdn` |
| **Platform / infrastructure** | `control-plane` · `data-plane` · `tenant-isolation` · `disaster-recovery` |
| **Batch / scheduled jobs** | `orchestrator-and-triggers` · `worker-pools` · `state-stores` · `retry-and-deadletter` |

### When the domain doesn't match a row

If your system spans multiple rows (e.g. a SaaS product with a heavy ML side and a data lake), use a **two-axis split**: pick the *primary* domain, render its views, then add ML/data views as siblings.

### When NOT to split

A small system — fewer than ~20 components and no significant cross-zone arrows — should stay as one diagram. The relationships *are* the story; splitting hides them. The complexity gate fires only when auto-layout starts failing, not as a default.

### Naming convention

One folder per system, kebab-case views inside:

```
<provider>-<system-name>/
  <view-1>.excalidraw
  <view-2>.excalidraw
  ...
```

E.g. `aws-payments-platform/sync-request-flow.excalidraw`, `gcp-iot-fleet/device-fleet.excalidraw`, `azure-data-lake/ingest.excalidraw`.

## Subgraph ordering matters

Even within a single view, the order in which you declare `subgraph` blocks determines layout. Mermaid places them in declaration order. Always declare them in *flow order* and put high-traffic pairs adjacent:

- Bad: `Edge → Compute → Observability → Data → Async` (Observability talks to Compute heavily; placing Data between them forces Compute→Obs arrows to leap over Data)
- Good: `Edge → Compute → Observability → Data → Async` (if Compute↔Obs is the heaviest pair) OR `Edge → Compute → Data → Async → Observability` (if Compute and Data each emit telemetry)

Run `scripts/preview-layout.ts` on your draft Mermaid — it now emits a suggested subgraph ordering based on edge density.

## AWS

- Palette: `aws`
- Icons: simpleicons brands (`amazonaws`, plus services if available)
- Library bundle: install `https://libraries.excalidraw.com/?theme=light&useHash=true&libs=aws-architecture` via the Excalidraw library panel
- Common roles → AWS components:
  - `start` → API Gateway
  - `service` → Lambda, ECS, EC2
  - `data` → DynamoDB, RDS, S3
  - `cache` → ElastiCache
  - `ai` → SageMaker, Bedrock
  - `client` → CloudFront, Route 53

## Azure

- Palette: `azure`
- Icons: simpleicons (`microsoftazure`)
- Library bundle: `https://libraries.excalidraw.com/?libs=azure-architecture`
- Common roles → Azure components:
  - `start` → Front Door, App Gateway
  - `service` → Functions, App Service, AKS
  - `data` → Cosmos DB, SQL Database
  - `cache` → Cache for Redis
  - `ai` → OpenAI Service, Cognitive Services

## GCP

- Palette: `gcp`
- Icons: simpleicons (`googlecloud`)
- Common roles → GCP components:
  - `start` → Cloud Load Balancing
  - `service` → Cloud Run, Cloud Functions, GKE
  - `data` → Firestore, Cloud SQL, BigQuery
  - `cache` → Memorystore
  - `ai` → Vertex AI

## Kubernetes

- Palette: `k8s`
- Icons: simpleicons (`kubernetes`)
- Library bundle: `https://libraries.excalidraw.com/?libs=k8s`
- Common roles:
  - `start` → Ingress
  - `service` → Service / Deployment / Pod
  - `data` → PersistentVolumeClaim, StatefulSet
  - `client` → External traffic

## Installing a library bundle

In the editor, open the library panel (book icon, top-right) and paste the library URL. Or open the editor with `?addLibrary=<url>` query param to auto-install on first load.

The drawloop-skill bundle (`libraries/drawloop-skill-shapes.excalidrawlib`) is auto-installed by the React UI.
