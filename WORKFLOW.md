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
- [ ] Each service exposes `/metrics` in Prometheus format
- [ ] `prometheus.yml` scrape config targets all three services
- [ ] `prometheus` container added to compose, confirmed all targets show "UP"
- [ ] `grafana` container added to compose, Prometheus datasource provisioned automatically
- [ ] At least one dashboard provisioned automatically, showing live request/error data

## Phase 4 — Resilience: circuit breaker
- [ ] Circuit breaker implemented around gateway → one downstream service call
- [ ] Circuit breaker state exposed as a metric
- [ ] Circuit breaker state visible on the Grafana dashboard
- [ ] Verified: manually killing the downstream service trips the breaker (visible in dashboard/logs), and it closes again once the service is back

## Phase 5 — Chaos tool
- [ ] Chaos tool can list the project's running containers
- [ ] Chaos tool can kill a target container on command
- [ ] Chaos tool can restart it after a delay
- [ ] Full demo run end-to-end: healthy → chaos triggered → dashboard shows degradation → circuit breaker trips → service restarts → dashboard shows recovery
- [ ] Demo run documented in `README.md` (steps + what to expect, maybe a screenshot or two)

## Phase 6 — Stretch goal: cloud deployment (only attempt after Phase 5 is fully done and demoed)
- [ ] Decide: single cloud provider, which one, what's free-tier eligible
- [ ] Deploy the Compose stack (or a simplified version) to that provider
- [ ] Confirm the live demo still works against the cloud deployment
- [ ] Document cost/cleanup steps so nobody leaves resources running and gets billed

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
