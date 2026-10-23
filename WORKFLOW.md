# WORKFLOW.md — Task Checklist

Update this file after every completed task (see AGENTS.md). Check boxes, add a one-line note. Do not jump ahead to a later phase before the current one is fully checked off and verified.

## Phase 0 — Repo & scaffold
- [ ] GitHub repo created, cloned locally
- [ ] `PRD.md`, `AGENTS.md`, `WORKFLOW.md` committed at root
- [x] Folder structure scaffolded (empty service folders + root `docker-compose.yml` stub)

## Phase 1 — Service skeletons (no business logic yet)
- [x] `gateway`: boots, responds on `/health`
- [x] `user-service`: boots, responds on `/health`
- [x] `order-service`: boots, responds on `/health`
- [x] All three start together via `docker compose up` on a shared network

## Phase 2 — Minimal real functionality + inter-service calls
- [x] `gateway` can call `user-service` and get a real response
- [x] `gateway` can call `order-service` and get a real response
- [x] Verified: killing `user-service` manually causes a handled error in `gateway`, not a crash

## Phase 3 — Observability
- [x] Each service exposes `/metrics` in Prometheus format
- [x] `prometheus.yml` scrape config targets all three services
- [x] `prometheus` container added to compose, confirmed all targets show "UP"
- [x] `grafana` container added to compose, Prometheus datasource provisioned automatically
- [x] At least one dashboard provisioned automatically, showing live request/error data

## Phase 4 — Resilience: circuit breaker
- [x] Circuit breaker implemented around gateway → one downstream service call
- [x] Circuit breaker state exposed as a metric
- [x] Circuit breaker state visible on the Grafana dashboard
- [x] Verified: manually killing the downstream service trips the breaker (visible in dashboard/logs), and it closes again once the service is back

## Phase 5 — Chaos tool
- [x] Chaos tool can list the project's running containers
- [x] Chaos tool can kill a target container on command
- [x] Chaos tool can restart it after a delay
- [x] Full demo run end-to-end: healthy → chaos triggered → dashboard shows degradation → circuit breaker trips → service restarts → dashboard shows recovery
- [x] Demo run documented in `README.md` (steps + what to expect, maybe a screenshot or two)

## Phase 6 — Stretch goal: cloud deployment (only attempt after Phase 5 is fully done and demoed)
- [ ] Decide: single cloud provider, which one, what's free-tier eligible
- [ ] Deploy the Compose stack (or a simplified version) to that provider
- [ ] Confirm the live demo still works against the cloud deployment
- [ ] Document cost/cleanup steps so nobody leaves resources running and gets billed

## Phase 7 — Control Panel (host only)
- [x] Document the Control Panel scope and Phase 7 checklist
- [x] Build the dependency-free host server and single-page controls with shared chaos-tool target validation
- [x] Verify every API endpoint with curl, including protected targets and the user-service kill/status transition
- [x] Auto-start panel traffic, refresh live counters every second, label service roles, and auto-scale Grafana request-rate/latency panels with millisecond latency
- [ ] Future: event log (deferred)
- [ ] Future: Grafana embed (deferred)
- [ ] Future: additional failure modes (deferred)

## Phase 8 — Control panel experiments
- [x] Add the localhost-only runtime gateway breaker toggle without dependencies
- [x] Add one-click ON/OFF 60-second experiments, live progress, comparison tables, and experiments/results.md
- [x] Verify both real rounds, localhost restrictions, control locking, and restored services; commit results

## Notes log
<!-- Add one line per completed task here, e.g.: -->
<!-- 2026-10-05: Phase 1 gateway skeleton done, health endpoint verified via curl -->
2026-10-03: Scaffolded placeholder Dockerfiles and empty Node.js manifests, README, and five-service Compose stub; verified folder tree, manifest JSON, and exact service names without starting Phase 1.
2026-10-03: Gateway health skeleton implemented with Node.js built-in HTTP and standalone Dockerfile; syntax check passed, but Docker engine was unavailable and Desktop startup failed with access denied, so container/curl verification is pending and the gateway task remains unchecked.
2026-10-03: Phase 1 gateway verified via standalone docker build/run; startup log confirmed port 3000 and curl http://127.0.0.1:3000/health returned HTTP 200 with {"status":"ok"}; no Compose or downstream-service changes.
2026-10-03: Phase 1 user-service implemented with Node.js built-in HTTP and verified via standalone docker build/run; startup log confirmed port 3000 and curl http://127.0.0.1:3001/health returned HTTP 200 with {"status":"ok"}.
2026-10-03: Phase 1 order-service implemented with Node.js built-in HTTP and verified via standalone docker build/run; startup log confirmed port 3000 and curl http://127.0.0.1:3002/health returned HTTP 200 with {"status":"ok"}.
2026-10-04: Phase 1 complete: docker compose up --build --detach built and started all three services on cerberus_app; startup logs and running state confirmed, terminal curl returned HTTP 200 from all three /health endpoints, and gateway reached both downstream services by name.
2026-10-04: Phase 2 verified with docker compose up --build --detach gateway user-service order-service: direct and gateway GET /users and /orders returned HTTP 200 with sample data; docker compose stop user-service caused gateway GET /users to return HTTP 502 with {"error":"Downstream service unavailable","service":"user-service"}, while gateway remained running and /health and /orders returned HTTP 200; user-service left stopped.
2026-10-04: Phase 3 metrics endpoints added to all three app services with approved prom-client 15.1.3, completed-request counters and latency histograms labeled by service/method/route/status; Compose rebuild/start, raw curl HTTP 200 metrics output, health/business routes, and counter/histogram increments verified; Prometheus and Grafana remain pending.
2026-10-04: Phase 3 Prometheus added with official prom/prometheus:v3.13.4, read-only observability/prometheus.yml, persistent data volume and localhost port 9090; docker compose up --build --detach succeeded, /api/v1/targets reported gateway/user-service/order-service health=up with empty lastError, and the up query returned 1 for each; Grafana remains pending.
2026-10-04: Phase 3 Grafana added on localhost:3003 with persistent storage, anonymous Viewer access and file-provisioned Prometheus datasource/Cerberus Overview dashboard; Compose build/start and Grafana recreation verified startup provisioning, /api/ds/query returned all three services UP plus real request/error/latency samples after success/404 test traffic, and /d/cerberus-overview/cerberus-overview returned HTTP 200; circuit-breaker metrics remain Phase 4.
2026-10-04: Phase 4 verified with approved opossum 10.0.0 on gateway → user-service, 3-consecutive-failure trip and 30s cooldown: Compose rebuild/start passed; stopping user-service produced closed→open metrics on the third failure and a 3.4ms HTTP 503 fallback, /orders and /health stayed HTTP 200, restart/probe produced half_open→closed metrics and HTTP 200 /users; logs and Grafana /api/ds/query confirmed open=1/half-open=2/closed=0 timeline values; all services left running.
2026-10-04: Phase 5 manual Node.js/Docker CLI implemented without dependencies: project/directory/service allowlist checks, list, exact-name/service-name kill and configurable restart delay; 5 tests passed, live Prometheus/Grafana target attempts were rejected, and kill cerberus-user-service-1 --restart-after 10 logged exited/137 then running/true after 10s; user health and gateway /users returned HTTP 200 afterward, monitoring stayed running; full dashboard demo remains pending.
2026-10-04: Phase 5 complete: full Compose build/up and 60s user-service chaos run verified healthy→DOWN/Open→DOWN/Half-open→UP/Closed using Grafana panel API, Prometheus targets, raw circuit metrics and HTTP responses; CLI automatically restarted user-service, recovery /users was HTTP 200, monitoring IDs/start times stayed unchanged; README documents architecture, startup, repeatable demo commands, actual stage evidence and Git attribution.
2026-10-23: Added the Control Panel scope/checklist and implemented the host-only server/page without dependencies; Node syntax check, server startup, and all 5 existing chaos-tool tests passed, but Compose/curl verification and commit are pending because Windows command creation fails with Access is denied (os error 5).
2026-10-23: Verified Compose build/start, panel auto-traffic/counters/page and start/stop/kill/restart APIs via curl (errors increased during user-service outage; monitoring actions returned 403), 5 CLI tests, and reloaded Grafana auto-scaled panels with millisecond latency and non-zero gateway request rate (1.7975 req/s); user-service restored and traffic left on.
2026-10-23: Phase 8 verified with Compose build/start, curl ON/OFF=200, invalid body=400, cross-origin/container-peer=403 and concurrent controls=409, 9 tests, and two real 1,200-request rounds saved to experiments/results.md (ON/OFF success 72.33%/80.50%, p95 17.23/3006.71 ms, recovery 8.92/2.08 s); all services running, breaker ON, background traffic restored; no dependencies added.
