# AGENTS.md

This file is read by Codex CLI at the start of every session in this repo. Follow it exactly. If anything here conflicts with a prompt I give you in chat, ask me before proceeding rather than guessing which one wins.

## What this project is

Read `PRD.md` in full before doing anything else, every session. It is the source of truth for scope. If `PRD.md` and your own instincts disagree, `PRD.md` wins.

## Hard rules — do not violate these without being explicitly told to in a prompt

1. **Docker Compose only.** Never introduce Kubernetes, Helm, or any orchestrator beyond Compose unless a prompt explicitly asks for it.
2. **Exactly the services listed in PRD.md** — `gateway`, `user-service`, `order-service`, `chaos-tool`, `prometheus`, `grafana`. Do not add a database service, a cache, a message queue, or any "nice to have" infra unless a prompt explicitly asks for it.
3. **One language/framework for the app services**, as stated in PRD.md's Tech Stack section. Do not mix languages across services on your own initiative.
4. **No new dependencies without saying so.** Before adding any package not already in use, list it in your response (name, why it's needed) and wait for confirmation if I haven't already approved it in the prompt.
5. **Do only the task in the current prompt.** Do not refactor unrelated files, "improve" code outside the task's scope, or start the next phase early, even if you can see what's coming. If you notice something that should change elsewhere, mention it in your summary — don't just do it.
6. **Never touch cloud deployment, Terraform, or cloud provider credentials** unless a prompt is explicitly from Phase 6 (stretch goal) in `WORKFLOW.md`. The core project is 100% local.

## Workflow discipline

- `WORKFLOW.md` is the task checklist. At the start of a session, check which tasks are marked done and which is next/in-progress.
- After completing a task, update its checkbox in `WORKFLOW.md` and add one line noting what you did (not a full changelog — one line).
- Never mark a task done unless you've actually verified it (see Verification below). A task that "should work" but wasn't run is not done.

## Verification — always do this before saying a task is complete

- If you changed a service: actually run `docker compose up --build` (or the relevant subset) and confirm it starts without errors. Show me the relevant log lines or curl output, not just "it should work now."
- If you added a `/metrics` or `/health` endpoint: curl it and show the real output.
- If you touched Prometheus/Grafana config: confirm the target shows as "UP" in Prometheus's own targets page, or that the Grafana dashboard actually renders data — don't just confirm the YAML is syntactically valid.
- If something fails, say so plainly and show the actual error. Do not silently work around a failure by changing scope (e.g., switching libraries, removing a feature) without flagging it to me first.

## Communication style

- Before starting a multi-step task, give me a one or two sentence plan. If it's genuinely a one-line task, just do it.
- At the end of every task, give me a short summary: what changed, what you verified, what (if anything) is still open or needs my input.
- If a prompt is ambiguous or you're missing information you need (an API key, a decision between two reasonable approaches), ask — do not guess and silently pick one, especially for anything touching scope.
- Keep commit messages conventional: `feat: add health endpoint to user-service`, `fix: correct prometheus scrape interval`, `docs: update WORKFLOW.md`.

## Repo conventions

- Folder structure: one top-level folder per service (`gateway/`, `user-service/`, `order-service/`, `chaos-tool/`, `observability/` for prometheus+grafana config), plus root-level `docker-compose.yml`, `PRD.md`, `AGENTS.md`, `WORKFLOW.md`, `README.md`.
- Each service folder gets its own `Dockerfile` and its own dependency manifest (`package.json` or `requirements.txt`) — no shared/global dependency file across services.
- Commit after each verified task, not at the end of a long session. Small, reviewable commits.
