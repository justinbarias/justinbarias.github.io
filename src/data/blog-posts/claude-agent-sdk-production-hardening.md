---
title: "Production Considerations for the Claude Agent SDK, Part 2: Security Hardening"
slug: claude-agent-sdk-production-hardening
publishDate: 25 May 2026
description: "Part 2 of 2. Permission posture, container runtime hardening, prompt-injection defenses, and an opt-in credential boundary — what I changed after I stopped the OOMs."
---

> **This is Part 2 of a two-part series.** [Part 1](/blog/claude-agent-sdk-production-considerations/) covered performance and sizing. This post covers the security story.

## Table of Contents

- [What was wrong with the defaults](#what-was-wrong-with-the-defaults)
- [Permission posture: fail closed by default](#permission-posture-fail-closed-by-default)
- [Container hardening on ACA](#container-hardening-on-aca)
- [Prompt-injection defenses](#prompt-injection-defenses)
- [The credential boundary](#the-credential-boundary)
- [Putting the layers together](#putting-the-layers-together)
- [What I'd do differently](#what-id-do-differently)
- [Wrapping up](#wrapping-up)

---

## What was wrong with the defaults

Part 1 was about not running out of memory. This post is about what I noticed once the replica stopped exit-137'ing: the default config I was running was alarmingly permissive.

Three things in particular:

1. **Permission mode.** I'd been running with `permission_mode: acceptAll`, which the SDK maps to `bypassPermissions` — *the SDK permission system is off entirely*. Bash, Write, Edit, WebFetch are all unconditionally available. A prompt-injection payload in any document the agent reads can issue arbitrary shell commands inside the container. I missed this when I shipped.
2. **The credential surface.** OAuth tokens, Azure keys, Qdrant JWTs — all of them lived in container env vars. Every SDK subprocess and every tool subprocess inherited them. No boundary. Nothing redacting tool outputs before they entered the model context. Nothing redacting credential-shaped strings in OTel traces.
3. **The container was a default container.** Read-write root, default capability set, no readiness gating between cold start and traffic, public ingress on by default because the sample agent I copied set it to `true`.

I never deliberately chose any of these. They were the path of least resistance during early development and they survived into production because nothing forced me to revisit them.

The fix landed in four independently shippable pieces. This post walks through them in the order I shipped.

---

## Permission posture: fail closed by default

The migration story is the worst part. `permission_mode: manual` (the SDK's "ask the user") wedges in serve mode because there's no operator at a terminal. So the path everyone takes is `acceptAll`, which disables permissions entirely. **The path of least resistance was the least safe one.**

The fix is layered.

**Auto-disallow the risky built-ins.** Regardless of what `permission_mode` is set to, any of `{Bash, Write, Edit, WebFetch}` that the operator hasn't explicitly declared in `agent.tools` gets added to `disallowed_tools`. If you don't ask for Bash, you don't get Bash.

**`manual` maps to `plan` in serve mode.** The SDK's `plan` mode lets the agent reason but blocks tool execution. In serve mode — where there's no human-in-the-loop — this is what `manual` should have meant from the start. Interactive contexts (`holodeck test run`, `holodeck chat`) keep SDK `default` so prompting still works.

**`acceptAll` is deprecated.** Loading an agent with `permission_mode: acceptAll` fails closed unless the operator also sets:

```yaml
claude:
  i_understand_this_is_unsafe: true
```

The flag's name is the point. No clever shorter name. The friction is the feature. The error message names the migration path:

```
ERROR loading agent 'my-agent':
  permission_mode 'acceptAll' is deprecated because it disables the
  Claude SDK permission system entirely. This is the most direct path
  from prompt-injection to arbitrary tool execution.

  To migrate:
    1. List the tools your agent actually needs in `agent.tools`, or
    2. Add `claude.i_understand_this_is_unsafe: true` to keep the
       legacy behavior.
```

**A typed `claude.permissions` block.** For operators who want explicit control instead of reading the validator source to learn what's auto-derived:

```yaml
claude:
  permissions:
    allowed_tools: [Read, Grep]
    disallowed_tools: [Bash, Write, Edit, WebFetch]
    permission_mode: plan
```

Explicit values win over auto-derivation. When the block is absent, defaults run.

What this *doesn't* fix: permissions are an SDK-level allowlist, not an OS-level sandbox. An agent that legitimately needs `Read` and gets told to read `/etc/passwd` will read it. That's what the next two sections are for.

---

## Container hardening on ACA

The generated Dockerfile and ACA template had a few things wrong by default:

- Node.js was always installed (~40–80 MiB of image bloat) even though the SDK ships its own bundled CLI binary. Node's only needed if a stdio MCP server's `command` requires it.
- The corpus directories (`/app/data`, `/app/instructions`) were owned by the runtime user. Writable from the agent.
- No distinct readiness probe — replicas accepted traffic before tool init finished.
- Public ingress was the path the samples took because that's what the sample YAML set.

The Dockerfile changes are easy:

```dockerfile
# Conditional — omit when no stdio MCP needs Node
RUN apt-get update && apt-get install -y nodejs npm

# Corpus is root-owned and a-w; runtime user reads, never writes
COPY --chown=root:root data /app/data
COPY --chown=root:root instructions /app/instructions
RUN chmod -R a-w /app/data /app/instructions

# Writable scratch via tmpfs (mounted by ACA as EmptyDir)
RUN mkdir -p /var/holodeck/work && chown holodeck:holodeck /var/holodeck/work
```

ACA is where it gets awkward. The original spec called for the standard Kubernetes securityContext block — `runAsNonRoot`, `readOnlyRootFilesystem`, `allowPrivilegeEscalation: false`, `capabilities: drop: [ALL]`. **None of those are exposed by Azure Container Apps.** Not at any API version I could find, not against the `azure-mgmt-appcontainers` v4 SDK, not against the raw ARM API 2026-01-01. I went through the [Microsoft ACA security baseline](https://learn.microsoft.com/en-us/security/benchmark/azure/baselines/azure-container-apps-security-baseline) to confirm: the platform's default capability set is Microsoft-controlled. Customers can't further restrict it from a manifest.

What ACA *does* expose is `Volume(storage_type=EmptyDir)` + `VolumeMount`. That's the one securityContext-adjacent primitive I could use. EmptyDir is per-replica, cleared on replica restart. Same operational property as tmpfs for our purposes: tool outputs and SDK scratch never persist across replicas. So the generated template adds:

```python
volumes = [
    Volume(name="tmp", storage_type=StorageType.EMPTY_DIR),
    Volume(name="sdk-scratch", storage_type=StorageType.EMPTY_DIR),
]
volume_mounts = [
    VolumeMount(volume_name="tmp", mount_path="/tmp"),
    VolumeMount(volume_name="sdk-scratch", mount_path="/var/holodeck/work"),
]
```

Non-root is enforced at the image layer (`USER holodeck` UID 1000) since ACA has no manifest field to assert it. Read-only-corpus is enforced by `chmod a-w` in the Dockerfile since ACA has no `readOnlyRootFilesystem`. The gaps I can't close on ACA — seccomp profiles, capability dropping, pid limits, userns-remap — I document explicitly in `docs/security/aca-limitations.md` rather than pretend they're handled.

So: **the manifest is as hardened as ACA permits, and the image layer compensates for what ACA won't expose.** Self-hosted Docker users can layer on `--cap-drop ALL` and friends themselves. We don't template them because we can't enforce them everywhere.

Two smaller wins shipped alongside this:

- **Ingress defaults to `false`.** If an operator opts into public ingress, the CLI warns at deploy time, naming the FQDN that will become reachable. Non-fatal, just deliberate.
- **Readiness probe distinct from liveness.** `/health` confirms the process is alive. The new `/ready` returns 200 only after `tool_init_manager` reports tools initialized. ACA holds traffic off until `/ready` is green, so cold replicas no longer race tool init.

---

## Prompt-injection defenses

Even with permissions locked down, the agent still runs with whatever filesystem and network the container gives it. Tool outputs still flow into the model context. OTel traces still capture everything. Prompt-injection payloads can target the *allowed* tools.

The defense here is heuristic, not airtight. The point is to add layers that change the cost of an attack — knowing none of them is a wall.

**Credential redaction in tool outputs.** Tool outputs flow back into the model context. A bundled PostToolUse hook scans `tool_result.content` for credential-shaped patterns and replaces them with `[REDACTED:<kind>]`:

| Pattern | Replaced with |
|---|---|
| `sk-ant-api03-…` | `[REDACTED:anthropic-key]` |
| `AKIA[0-9A-Z]{16}` | `[REDACTED:aws-access-key]` |
| `ghp_[A-Za-z0-9]{36}` | `[REDACTED:github-token]` |
| JWT (`eyJ…\.…\.…`) | `[REDACTED:jwt]` |
| `Bearer [A-Za-z0-9_\-\.]+` in HTTP headers | `Bearer [REDACTED]` |

Default on. Opt-out via `claude.disable_default_hooks: true` with a loud warning at load that names the agent. Operators with a legitimate need for credential-shaped strings in context can also override per-tool via the existing user-hook surface from spec 028.

**OTel attribute redaction, independent of hooks.** The hook above only protects the model context. OTel traces with `capture_content: true` capture tool outputs separately, before any hook fires. A `RedactingSpanProcessor` scrubs `tool.input.*`, `tool.output.*`, and `gen_ai.*` span attributes using the same patterns. Critically, this is **not** gated on `disable_default_hooks` — an operator can't accidentally disable trace redaction by disabling hooks.

**Default-on subprocess env scrubbing.** Easy to miss, but it matters. The Claude SDK ships two CLI-level flags:

- `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` — the SDK subprocess strips most env vars before spawning *its* child processes (Bash tool, stdio MCP servers).
- `CLAUDE_CODE_MCP_ALLOWLIST_ENV=1` — stdio MCP subprocesses only receive their declared `env` block from `agent.yaml`.

Both default-on in HoloDeck now, set as `ClaudeAgentOptions.env`. Bash tool subprocesses no longer inherit Anthropic/cloud creds. Stdio MCP servers see only the env vars their tool config explicitly declares. Opt-out via `claude.disable_subprocess_env_scrub: true`.

Two caveats:

1. The **SDK subprocess itself** still inherits the full parent (HoloDeck-serve) env. There's no SDK lever for that. The structural fix is the credential boundary, covered next.
2. The original spec called for a Bash AST deny list as another default hook. I dropped it before shipping. The SDK already parses Bash into an AST and matches it against `allowed_tools` permission rules, and the auto-disallow rule above means `Bash` isn't even available unless the operator declares it. A regex-based deny list on top would have been redundant — and would have produced false positives I'd then have had to apologize for.

What this *doesn't* fix: an attacker who base64-encodes their payload defeats both the redaction (no pattern match) and the Bash defenses (the AST sees an opaque blob). That's what the credential boundary is for.

---

## The credential boundary

The first three sections close the common failure modes for single-tenant deployments. They don't move credentials out of the agent's environment. Anthropic's [secure-deployment guide](https://code.claude.com/docs/en/agent-sdk/secure-deployment) describes the "proxy pattern" for when you need that. The situations where it applies:

- The agent processes content from multiple tenants in the same container.
- The agent reads untrusted documents whose contents could include prompt-injection payloads designed to exfiltrate credentials.
- Compliance requires that credentials never appear in the agent's process environment.

The default profile keeps the env-var model. Operators with these constraints opt in:

```yaml
deployment:
  security_profile: hardened   # default | hardened
```

When `hardened` is set, `holodeck deploy run` provisions the Container App with two containers instead of one:

![Hardened profile architecture: agent container (no creds, ANTHROPIC_BASE_URL pointed at localhost:7000) sends all egress through an Envoy sidecar that holds the secrets, injects auth headers, and enforces a domain allowlist; non-allowlisted destinations return 403.](https://justinbarias.io/assets/blog/agent-sdk-production-02-hardened-sidecar.png)

The mechanics:

1. The deployer reads credentials from the operator's environment once, creates ACA `Secrets`, discards the in-memory copies.
2. Secrets are projected as files (mode `0400`) under `/var/run/secrets/envoy/` — **mounted only on the sidecar, not the agent**.
3. The Envoy bootstrap config (with the domain allowlist baked in) is generated from `agent.yaml` and projected to the sidecar at `/etc/envoy/bootstrap.yaml`.
4. The agent container gets `ANTHROPIC_BASE_URL=http://localhost:7000`, `HTTPS_PROXY=http://localhost:7000`, and `HOLODECK_HARDENED=1`. **No credential env vars.**
5. At startup, `claude_backend.py` reads `HOLODECK_HARDENED=1` and asserts no `ANTHROPIC_API_KEY` / `CLAUDE_CODE_OAUTH_TOKEN` / `AWS_*` / `AZURE_OPENAI_API_KEY` / `QDRANT_API_KEY` is present in `os.environ`. Failure on that check is a fail-closed startup. The agent never serves traffic with credentials it shouldn't have.

The domain allowlist is derived from explicit `agent.yaml` fields, not inferred:

- `api.anthropic.com` whenever the model provider is Anthropic.
- The embedding provider's endpoint, if a vectorstore or hierarchical_document tool is configured.
- Each vector-store backend's host — when the backend is HTTPS-based and its Python client supports a base-URL override.
- Nothing else. Anything not on the list gets a 403 with an `application/problem+json` body.

What this *doesn't* cover, honestly:

- **AWS Bedrock / GCP Vertex / Anthropic Foundry are out of v1.** SigV4 (AWS) and GCP-auth (Vertex) sign requests with credentials baked into the cloud SDK client *before* the HTTP layer. A localhost proxy that just forwards the request would either need to re-sign with its own credentials, or pair with cloud-native workload identity (IRSA on EKS, Workload Identity on GKE) — neither of which applies to ACA. The hardened profile rejects these auth providers with a clear error pointing at the follow-up spec.
- **TLS interception for arbitrary HTTPS** would need a CA injected into the agent's trust store. Not shipping in v1. HTTP-MCP servers with bearer-token auth in headers go through opaque tunnels and the sidecar enforces destination domain only, not credential injection.
- **Stdio MCP credentials stay on the agent container.** They're inside the SDK subprocess inheritance chain. The credential boundary protects the LLM credentials, not every per-MCP API key. The sidecar protects the *destination* of MCP egress when the MCP respects `HTTPS_PROXY`; it doesn't move per-MCP keys into the sidecar.
- **One tenant per replica.** Hard isolation between multiple end-customers concurrently in the same container is a separate spec — that's Anthropic's Pattern 1 (per-session ephemeral containers), and HoloDeck doesn't ship a deployer for it today.

I sat on this one the longest before shipping. The surface area is real (one new generator module, deployer extension, backend guard, validator) and the risks compound in ways the unit tests can't catch. The boot guard turned out to be the load-bearing part: an agent that has no credentials and is told `ANTHROPIC_BASE_URL=http://localhost:7000` will fail-closed if you forget to start the sidecar — which is exactly what you want.

---

## Putting the layers together

Stacked up, the four layers look like this:

![Defense-in-depth chain: a prompt-injection payload arriving in a tool result passes through four independent layers — permission allowlist, PostToolUse credential redaction, subprocess env scrub, and the egress allowlist with credential injection.](https://justinbarias.io/assets/blog/agent-sdk-production-03-defense-in-depth.png)

No single layer is a wall. Permissions can be over-declared. Redaction can miss a base64'd payload. Env scrubbing leaves the SDK subprocess itself with the parent env. The egress proxy doesn't intercept arbitrary TLS. But each layer raises the cost of the next step in the attack, and the layers degrade independently.

If I had to give up exactly one, I'd give up the redaction layer — it's heuristic by nature. The other three each close a structurally different class of attack.

---

## What I'd do differently

If I were starting from scratch knowing all this:

**1. The safe path has to be the default path.** Operators don't read security docs before shipping their first agent. They copy a sample and tweak the system prompt. If the sample has `permission_mode: acceptAll`, that's what production runs. Make the safe choice the obvious one — auto-disallow on, manual→plan in serve, deprecation error on `acceptAll`.

**2. Cloud-native isn't automatically more secure.** I spent real time trying to make ACA's security model match Kubernetes', and the honest answer is: it doesn't, by design. Microsoft owns the runtime. The customer's lever is the image and the manifest, in that order. Lean on the image more than the manifest if you're on ACA. Self-hosted Docker on K8s lets you use the full security primitives — different deployment story, document the gap.

**3. Credentials in env vars age badly.** It's the easiest pattern at v0 and the hardest one to refactor at v2. If I'd shipped HoloDeck with `security_profile: hardened` as the only option and made the env-var model the opt-out, I think it would have been the better trade — but I'd have lost some operator-friendliness on day one. The opt-in story we ended up with is the compromise I can live with.

**4. The Bash AST hook I planned wasn't worth it.** I had a whole `claude_hooks` Bash deny list designed and partly written. Dropping it before shipping was the right call once I realized the SDK's own permission rules already AST-parse Bash commands and the auto-disallow rule means most agents don't have Bash at all. A regex layer on top would have been ceremony, not defense.

---

## Wrapping up

The Claude Agent SDK shipping story has two halves. Part 1 was about not running out of memory. This post is about not running out of trust: secure-by-default permissions, container hardening within ACA's limits, credential redaction in the model context and OTel traces, an opt-in proxy that holds the credentials so the agent doesn't have to.

None of this is exotic. Anthropic's [hosting](https://code.claude.com/docs/en/agent-sdk/hosting) and [secure-deployment](https://code.claude.com/docs/en/agent-sdk/secure-deployment) docs describe the patterns. The work is mostly in making them defaults so operators inherit them instead of having to opt in.

The implementation lives in HoloDeck's [`src/holodeck/lib/backends/`](https://github.com/justinbarias/holodeck/tree/main/src/holodeck/lib/backends) (permissions, hooks, OTel redaction) and [`src/holodeck/deploy/`](https://github.com/justinbarias/holodeck/tree/main/src/holodeck/deploy) (Dockerfile, ACA template, Envoy generator). The spec, plans, and the OOM saga that started all of this are under [`specs/034-production-hardening/`](https://github.com/justinbarias/holodeck/tree/main/specs/034-production-hardening). If you're shipping a Claude Agent SDK service and you haven't audited the defaults yet, the spec's "What's broken today" table is a good place to start.

---

**Previously:** [Part 1 — Performance & Sizing](/blog/claude-agent-sdk-production-considerations/) covers the OOM-stability story and the per-turn memory math that lets you size a replica defensibly.
