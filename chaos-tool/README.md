# Manual chaos CLI

Requires Node.js and Docker CLI/Compose with Docker running. No npm install is
needed. This CLI runs on the host, outside Compose.

Run from the repo root:

```powershell
node chaos-tool/cli.js list
node chaos-tool/cli.js kill user-service --restart-after 10
node chaos-tool/cli.js kill cerberus-user-service-1 --restart-after 10
```

Use either the service name or an exact container name from `list`. Only
`gateway`, `user-service`, and `order-service` are eligible. Prometheus and
Grafana are listed as protected. Project and directory labels are checked before
any kill/restart; unrelated containers and one-off Compose containers are refused.
If a service has multiple replicas, use its exact container name.

`kill` sends SIGKILL and restarts the same container ID after the delay
(default 30 seconds; configurable from 0 to 86400 seconds).
The process must stay running until restart. Ctrl+C or SIGTERM during the delay
triggers an immediate restart. If the process is forcibly terminated or Docker
becomes unavailable, recover with `docker compose start user-service`.
Restart confirms Docker's running state; application readiness and gateway
circuit-breaker recovery can take longer.

An npm equivalent is `npm --prefix chaos-tool start -- kill user-service --restart-after 10`.
Run the target-selection checks with `npm --prefix chaos-tool test`.
