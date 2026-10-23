# PRD — Cerberus : Chaos Engineering & Observability Platform

> Replace `Cerberus` everywhere before committing. See naming suggestions in the accompanying message.

## 1. Problem Statement

Most student cloud projects only demonstrate the happy path. Real distributed systems fail constantly — services crash, networks slow down, dependencies go dark — and mature engineering orgs design for this reality rather than hoping it doesn't happen. This project builds a small, deliberately-breakable distributed system, instruments it for observability, injects controlled failure into it (chaos engineering), and implements a resilience pattern (circuit breaker) so the system degrades gracefully and recovers on its own — live, in front of evaluators.

## 2. Goals

- A working multi-service system running locally via Docker Compose.
- Real-time observability of that system via Prometheus + Grafana.
- A custom chaos tool that injects failure (kill a service, add latency) on demand or on a timer.
- At least one resilience pattern (circuit breaker) implemented and demonstrably working — i.e., visible in the dashboard when it trips and recovers.
- A reproducible, documented live demo: healthy state → inject chaos → observe degradation → observe recovery.

## 3. Non-Goals (explicitly out of scope for the core deliverable)

- Kubernetes — Docker Compose only. (Mention as "future work" in the report, do not implement.)
- Multi-cloud or production cloud deployment — local Docker Compose is the primary deliverable. Cloud deployment (single provider, e.g. AWS free tier) is a **stretch goal only**, attempted after the core is fully working, never before.
- More than 4 services.
- More than one resilience pattern implemented deeply (a shallow second pattern is acceptable if time allows, but circuit breaker must work well first).
- Authentication/authorization, payments, or any business-logic complexity — the services exist to demonstrate failure/recovery, not to be a real product.

## 4. System Components

| Component | Responsibility |
|---|---|
| `gateway` | Entry point. Receives requests, calls `user-service` and `order-service`. Implements the circuit breaker around at least one of these calls. |
| `user-service` | Minimal service with its own in-memory or lightweight DB (e.g. SQLite/Postgres container). Exposes a health endpoint and a `/metrics` endpoint. |
| `order-service` | Same shape as `user-service`, different fake domain (orders/products). Exists mainly to give the gateway a second downstream dependency. |
| `chaos-tool` | A standalone script/service (not part of the "real" app) that, on a timer or via manual trigger, kills, restarts, or throttles one of the above containers using the Docker SDK/CLI. |
| `prometheus` | Scrapes `/metrics` from gateway, user-service, order-service on an interval. |
| `grafana` | Visualizes Prometheus data on live dashboards: request rate, error rate, service up/down, circuit breaker state if exposed as a metric. |

## 5. Functional Requirements

**Gateway**
- Exposes a simple REST endpoint that triggers a call to `user-service` and/or `order-service`.
- Exposes `/metrics` in Prometheus format (request count, latency, error count).
- Exposes `/health`.
- Implements a circuit breaker around the call to at least one downstream service: tracks failures, opens the circuit after N consecutive failures, returns a fast fallback response while open, attempts a half-open retry after a cooldown.
- Circuit breaker state (closed/open/half-open) must be exposed as a metric so it's visible on the Grafana dashboard.

**user-service / order-service**
- Each exposes at least one meaningful endpoint and a `/metrics` + `/health` endpoint.
- Each must be independently killable without crashing the gateway process itself (gateway should handle the error, not crash).

**chaos-tool**
- Can list running containers belonging to this project.
- Can kill/stop a randomly chosen target container.
- Can optionally restart it after a delay (so the demo shows recovery, not permanent death).
- Runs as either a manual CLI command (`run chaos now`) or an optional timer loop — manual trigger first, timer loop only once that's solid.
- Must not touch `prometheus` or `grafana` containers (it attacks the *application*, not the *monitoring*).

**Observability**
- `prometheus.yml` scrape config targets all three app services.
- Grafana has at least one dashboard, provisioned (not manually clicked together each time), showing: per-service up/down, request rate, error rate, circuit breaker state.

## 6. Tech Stack

- Services: Node.js for gateway, user-service, and order-service, with a separate package.json per service. Framework selection is deferred.
- Orchestration: Docker + Docker Compose.
- Metrics: `prom-client` (Node.js), to be approved before adding the dependency.
- Circuit breaker: `opossum` (Node.js) or a small hand-rolled implementation if the team wants the extra learning (recommended if time allows; it's not complex). Any dependency must be approved before adding it.
- Monitoring: Prometheus + Grafana, both official Docker images.
- Chaos tool: a manual Node.js CLI outside Compose, acting on the Docker socket through a Docker SDK or the `docker` CLI, with its own package.json.

## 7. Architecture (reference)

```
chaos-tool ──(kills/restarts)──▶ [gateway | user-service | order-service]
gateway ──(circuit breaker)────▶ user-service, order-service
all three services ──(expose /metrics)──▶ prometheus ──(datasource)──▶ grafana
```

## 8. Success Criteria / Definition of Done

- `docker compose up` brings up all 5 containers (gateway, user-service, order-service, prometheus, grafana) cleanly with one command.
- Grafana dashboard loads automatically via provisioning (no manual setup needed after `up`) and shows live data.
- Running the chaos tool against `user-service` visibly shows it going down in Grafana, the gateway's circuit breaker tripping (visible as a metric/log), and both recovering once the service restarts — without anyone restarting Docker Compose itself.
- A `README.md` documents: architecture, how to run it, how to run the chaos demo, and what each team member built.

## 9. Team & Ownership

Fill in once roles are assigned (see WORKFLOW.md for suggested split):
- Gateway + circuit breaker:
- user-service:
- order-service:
- Observability (Prometheus/Grafana) + chaos-tool:

## 10. Control Panel

A host-only Node.js control panel runs with `node control-panel/server.js` on localhost:4000 using built-in modules only. One plain HTML/CSS/JS page polls every second for the three application containers' running/stopped status, gateway circuit metric, and live traffic counters, offers Kill (without automatic restart) and Restart controls, auto-starts traffic to `/users` and `/orders` once per second, and links to Grafana. Target validation is imported from `chaos-tool/cli.js`; Prometheus and Grafana remain protected. This adds no Compose service. Event logs, embedded Grafana, and additional failure modes are deferred.

## 11. Phase 8 — Controlled experiments

The control panel's Run experiment button executes two sequential 60-second rounds, breaker ON then OFF. Each sends 20 requests per second total (10 to `/users`, 10 to `/orders`), requests a validated user-service kill at second 15 and restart at second 40, and shows live progress followed by an ON/OFF comparison table. Background traffic pauses and manual controls lock during experiments; user-service, the previous breaker mode, and background traffic are restored afterward, including on failure or graceful shutdown. No dependencies or Compose services are added.

Gateway `POST /admin/breaker` accepts the plain-text body `on` or `off` without restarting; changing mode resets consecutive failures and closes the circuit. OFF bypasses the breaker and calls user-service directly. Access uses the existing localhost-only Compose port publication plus socket-peer, Host, and Origin checks; the Docker bridge gateway is accepted for forwarded host connections, while container peers are rejected. This assumes the existing Compose network and localhost binding remain intact.

Tables append to `experiments/results.md` with request counts, success/error percentages, nearest-rank p50/p95 latency in milliseconds (all completed responses and network/time-out errors across both routes), and `/users` recovery seconds from the restart request to the first successful post-restart request. No observed recovery within the round is reported explicitly. Each round schedules 1,200 requests independently with a five-second client timeout and records actual chaos-action timing and per-route results alongside the table. Startup checks and cleanup are outside each 60-second measurement window; a pair takes slightly over two minutes. Failed runs show their error and do not save a completed comparison.
