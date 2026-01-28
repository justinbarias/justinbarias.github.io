---
title: "Building a Filesystem + Bash Based Agentic Memory System (Part 1)"
slug: agentic-memory-filesystem-part-1
publishDate: 16 Jan 2026
description: "Part 1 of a 3-part series exploring how to give agents filesystem and bash access. Research, patterns, and design goals for building a sandboxed execution environment."
---

# Building a Filesystem + Bash Based Agentic Memory System (Part 1)

*Part 1 of 3: Research, Patterns, and Design Goals*

---

A few days ago, I wrote about [how I reduced my agent's token consumption by 83%](https://dev.to/jeremiahbarias/how-i-reduced-my-agents-token-consumption-by-83-57nh) by implementing a `ToolFilterManager` that dynamically selects which tools to expose based on query relevance. That tackled the first major pattern from Anthropic's [Advanced Tool Use](https://www.anthropic.com/engineering/advanced-tool-use) article—the **tool search tool**.

But that article describes *three* patterns, and I've been eyeing the second one: **programmatic tool calling**.

The idea is to let Claude "orchestrate tools through code rather than through individual API round-trips." Instead of the model making 20 sequential tool calls (each requiring an inference pass), it writes a single code block that executes all of them, processing outputs in a sandboxed environment without inflating context. Anthropic reports a 37% token reduction on complex tasks with this approach.

This got me thinking: what if we took this further? What if instead of code execution, we gave agents direct filesystem and bash access?

Welcome to Part 1 of this rabbit hole.

## What are we talking about?

- [Why Filesystem + Bash?](#why-filesystem--bash)
- [Existing Work](#existing-work)
- [How It Works: Traditional vs Filesystem-Based](#how-it-works-traditional-vs-filesystem-based)
- [Bridging the Gap: MCP as CLI](#bridging-the-gap-mcp-as-cli)
- [Design Goals for My Experiment](#design-goals-for-my-experiment)
- [What This Isn't](#what-this-isnt)
- [Next Up](#next-up)

---

## Why Filesystem + Bash?

Vercel published a piece on [building agents with filesystems and bash](https://vercel.com/blog/how-to-build-agents-with-filesystems-and-bash) that crystallized something I'd been mulling over. Their core insight:

> LLMs have been trained on massive amounts of code.

Models already know how to `grep`, `cat`, `find`, and `ls`. They've seen millions of examples of bash usage during training. You don't need to teach them your custom `SearchCodebase` tool—they already know `grep -r "pricing objection" ./transcripts/`.

Their results were compelling: a sales call summarization agent went from $1.00 to $0.25 per call on Claude Opus while *improving* output quality. That's not a typo—cheaper AND better.

The reason? **Contextual precision.** Vector search gives you semantic approximations. Prompt stuffing hits token limits. But `grep -r` returns exactly what you asked for, nothing more.

If you've used Claude Code, you've seen this pattern in action. The agent doesn't call abstract tools—it has a filesystem and runs commands against it. The model thinks in `cat`, `head`, `tail`, and `jq`, not `ReadFile(path="/foo/bar")`.

## Existing Work

I'm not the first person down this path.

**[AgentFS](https://docs.turso.tech/agentfs/introduction)** from Turso is a filesystem abstraction built on SQLite. Their pitch: "copy-on-write isolation, letting agents safely modify files while keeping your original data untouched." Everything lives in a single portable SQLite database—easy to snapshot, share, and audit. They've built CLI wrappers and SDKs for TypeScript, Python, and Rust. It's marked as ALPHA and explicitly not for production, but the architecture is interesting.

**Claude Code** is the obvious reference implementation. Anthropic gave their coding agent real filesystem access with sandboxing, and it works remarkably well. The agent naturally uses bash patterns it learned during training.

**Vercel's `bash-tool`** provides sandboxed bash execution alongside their AI SDK. Their examples show domain-to-filesystem mappings: customer support data organized by customer ID with tickets and conversations as nested files, sales transcripts alongside CRM records.

**[mcp-cli](https://www.philschmid.de/mcp-cli)** and **[mcptools](https://github.com/f/mcptools)** enable calling MCP servers from the command line. This is the missing link—it lets agents invoke MCP tools via bash and redirect output to files, bridging the gap between structured tool definitions and filesystem-based execution.

## How It Works: Traditional vs Filesystem-Based

Before diving deeper, let me illustrate the fundamental difference between these approaches.

### Traditional Agentic Tool Calling

```
═══════════════════════════════════════════════════════════════════════
  TRADITIONAL TOOL CALLING
═══════════════════════════════════════════════════════════════════════

  User Query ──────▶ Agent (sends ALL 16 tool definitions)
                                      │
                                      ▼
                              ┌───────────────┐
                              │      LLM      │
                              │ "I'll use     │
                              │ search_docs & │
                              │ query_database│
                              │ tools"        │
                              └───────┬───────┘
                                      │
                                      ▼
                         Agent Executes Tools
                         search_docs("pricing")
                         query_database("customers")
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │  RAW OUTPUT (1000s of tokens!)│
                      │  [full doc contents,          │
                      │   all 500 DB rows...]         │
                      └───────────────┬───────────────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │      LLM      │
                              │  (processes   │
                              │   ENTIRE      │
                              │   output)     │
                              └───────┬───────┘
                                      │
                                      ▼
                              ┌───────────────┐
                              │   Response    │
                              └───────────────┘

  Problems:
  ├── 🔴 All tool definitions sent every request (5,888 tokens just for schemas!)
  ├── 🔴 Full tool output dumped into context (DB query = 500 rows in context)
  └── 🔴 Each tool call = 1 inference round-trip
```

### Filesystem + Bash Based Tool Calling

```
═══════════════════════════════════════════════════════════════════════
  FILESYSTEM + BASH TOOL CALLING
═══════════════════════════════════════════════════════════════════════

  User Query ──────▶ Agent (sends sandbox tool + fs structure)
                                      │
                                      ▼
                              ┌───────────────┐
                              │      LLM      │
                              │ "I'll explore │
                              │  the data:    │
                              │  ls, cat..."  │
                              └───────┬───────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │                                                   │
            ▼                                                   │
  ┌───────────────────────┐                                     │
  │   Sandbox Execution   │                                     │
  │   $ ls ./customers/   │                                     │
  │   > acme/ globex/     │                                     │
  │     initech/ ...      │──────┐                              │
  └───────────────────────┘      │                              │
                                 │  (output written to file     │
                                 │   or returned as path)       │
                                 ▼                              │
                  ┌────────────────────────────┐                │
                  │           LLM              │                │
                  │  "Found customers. Now:    │                │
                  │   grep -r 'pricing' ./docs │                │
                  │   | head -20"              │                │
                  └─────────────┬──────────────┘                │
                                │                               │
                                ▼                               │
                  ┌───────────────────────┐                     │
                  │   Sandbox Execution   │                     │
                  │   $ grep -r 'pricing' │                     │
                  │     ./docs | head -20 │                     │
                  └─────────────┬─────────┘                     │
                                │                               │
                                ▼                               │
                  ┌────────────────────────────┐                │
                  │           LLM              │                │
                  │  "Need more detail on      │                │
                  │   enterprise tier:         │                │
                  │   awk '/enterprise/,/---/' │◀───────────────┘
                  │     ./docs/pricing.md"     │     (loop until
                  └─────────────┬──────────────┘      sufficient
                                │                     context)
                                ▼
                        ┌──────────────┐
                        │   Response   │
                        │  (with only  │
                        │   relevant   │
                        │   context)   │
                        └──────────────┘

  Benefits:
  ├── 🟢 Minimal tool definitions (just "sandbox" tool)
  ├── 🟢 Agent controls what enters context (grep, head, awk filter results)
  ├── 🟢 LLM already knows bash (trained on millions of examples)
  └── 🟢 Composable commands (pipes, redirects, filters)
```

### The Key Insight

The traditional approach treats the LLM as a passive consumer—it requests data and gets *everything* back. The filesystem approach treats the LLM as an active explorer—it navigates, filters, and retrieves only what it needs.

```
Traditional:    "Give me all the data, I'll figure it out"
                 └── Context explodes, tokens burn 🔥

Filesystem:     "Let me look around and grab what I need"
                 └── Context stays lean, costs drop 📉
```

## Bridging the Gap: MCP as CLI

The diagrams above assume files already exist in the sandbox. But where do they come from?

This is where MCP CLI tools bridge the gap. Instead of MCP servers returning results directly into the LLM's context, they can be invoked as bash commands that write output to files.

### MCP as CLI Commands

Several tools enable calling MCP servers from the command line:

**[mcp-cli](https://www.philschmid.de/mcp-cli)** by Phil Schmid uses a clean syntax:
```bash
# List available servers and tools
mcp-cli

# Inspect a tool's schema
mcp-cli filesystem/read_file

# Execute a tool
mcp-cli filesystem/read_file '{"path": "./README.md"}'
```

**[mcptools](https://github.com/f/mcptools)** offers similar functionality:
```bash
mcp call read_file --params '{"path":"README.md"}' npx -y @modelcontextprotocol/server-filesystem ~
```

### The Integration Pattern

Here's how traditional tools integrate with the filesystem approach:

```
═══════════════════════════════════════════════════════════════════════
  DATA INGESTION: MCP → SANDBOX FILESYSTEM
═══════════════════════════════════════════════════════════════════════

  ┌─ LLM decides it needs customer data ───────────────────────────────
  │
  │  "I need to query the database for enterprise customers.
  │   Let me fetch that data into my workspace."
  │
  └────────────────────────────┬───────────────────────────────────────
                               │
                               ▼
  ┌─ SANDBOX EXECUTION ────────────────────────────────────────────────
  │
  │  $ mcp-cli database/query_customers '{"tier": "enterprise"}' \
  │      > ./sandbox/data/customers.json
  │
  │  $ mcp-cli vectorstore/search '{"query": "pricing policy"}' \
  │      > ./sandbox/docs/pricing_results.json
  │
  │  $ mcp-cli brave-search/web_search '{"query": "competitor pricing"}' \
  │      > ./sandbox/research/competitors.json
  │
  └────────────────────────────┬───────────────────────────────────────
                               │
                               │  (data now exists as files)
                               ▼
  ┌─ SANDBOX FILESYSTEM STATE ─────────────────────────────────────────
  │
  │  ./sandbox/
  │  ├── data/
  │  │   └── customers.json          # 500 customer records
  │  ├── docs/
  │  │   └── pricing_results.json    # vectorstore search results
  │  └── research/
  │      └── competitors.json        # web search results
  │
  └────────────────────────────┬───────────────────────────────────────
                               │
                               ▼
  ┌─ LLM explores with bash (only pulls what it needs into context) ───
  │
  │  $ jq '.customers | length' ./sandbox/data/customers.json
  │  > 500
  │
  │  $ jq '.customers[] | select(.revenue > 1000000) | .name' \
  │      ./sandbox/data/customers.json | head -10
  │  > "Acme Corp"
  │  > "Globex Inc"
  │  > ...
  │
  │  $ grep -l "enterprise" ./sandbox/docs/*.json
  │  > ./sandbox/docs/pricing_results.json
  │
  └────────────────────────────────────────────────────────────────────
```

### Why This Matters

The traditional approach would send all 500 customer records directly into context. With filesystem-based execution:

1. **MCP call writes to file** → Data exists but isn't in context yet
2. **Agent uses `jq` to count** → Only "500" enters context (3 tokens)
3. **Agent filters with `jq`** → Only 10 company names enter context (~30 tokens)
4. **Agent got what it needed** → Instead of 500 records (~50,000 tokens)

Phil Schmid's [research on mcp-cli](https://www.philschmid.de/mcp-cli) showed this pattern reduces tool-related token consumption from ~47,000 tokens to ~400 tokens—**a 99% reduction**—because agents discover and use tools just-in-time rather than loading all definitions upfront.

### The Complete Flow

```
═══════════════════════════════════════════════════════════════════════
  COMPLETE FILESYSTEM + MCP FLOW
═══════════════════════════════════════════════════════════════════════

  User Query: "Which enterprise customers mentioned pricing concerns?"
                               │
                               ▼
  ┌─ STEP 1: Fetch data via MCP CLI ───────────────────────────────────
  │
  │ $ mcp-cli database/query_customers '{"tier":"enterprise"}' \
  │     > ./data/customers.json
  │
  │ $ mcp-cli crm/get_conversations '{"customer_ids":"$CUSTOMER_IDS"}' \
  │     > ./data/conversations.json
  │
  └────────────────────────────┬───────────────────────────────────────
                               │
                               ▼
  ┌─ STEP 2: Explore with bash ────────────────────────────────────────
  │
  │ $ jq -r '.[] | .id' ./data/customers.json | wc -l
  │ > 47
  │
  │ $ grep -l "pricing" ./data/conversations.json
  │ > (matches found)
  │
  │ $ jq '.[] | select(.text | contains("pricing")) | {customer, text}' \
  │     ./data/conversations.json > ./analysis/pricing_mentions.json
  │
  └────────────────────────────┬───────────────────────────────────────
                               │
                               ▼
  ┌─ STEP 3: Extract only relevant context ────────────────────────────
  │
  │ $ cat ./analysis/pricing_mentions.json | head -50
  │ > [{"customer": "Acme", "text": "pricing seems high..."},
  │ >  {"customer": "Globex", "text": "need better pricing..."}]
  │
  └────────────────────────────┬───────────────────────────────────────
                               │
                               ▼
                        ┌──────────────┐
                        │   Response   │
                        │  (informed   │
                        │   by ~50     │
                        │   relevant   │
                        │   lines)     │
                        └──────────────┘

  Token savings:
  ├── Without filesystem: 47 customers × 20 conversations × ~500 tokens = 470,000 tokens
  └── With filesystem: ~200 tokens (just the relevant pricing mentions)
```

## Design Goals for My Experiment

I want to build something that integrates with [Holodeck](https://github.com/justinbarias/holodeck-ai), which uses Semantic Kernel for agent orchestration. Here's what I'm aiming for:

### 1. Filesystem Security

Letting LLMs run bash commands on your actual filesystem is... not great. The horror stories write themselves.

My approach:
- **Copy-on-write isolation.** Like AgentFS, the agent operates in a sandboxed directory. Writes don't touch original files until explicitly committed.
- **Audit logging.** Every file operation gets logged. Every. Single. One. AgentFS makes this queryable, and I want the same—know what the agent did, when, and be able to roll it back.
- **Path restrictions.** The agent only sees paths within its sandbox. No `rm -rf /` accidents, no reading `~/.ssh/`.

This is non-negotiable for anything beyond toy experiments.

### 2. Token and Context Reduction

This is where the programmatic tool calling pattern really shines.

In traditional tool calling:
1. Model requests tool call
2. Tool executes
3. **Entire output goes back into context**
4. Model processes output
5. Repeat

Query a database with 1000 rows? That's 1000 rows in your context window. Every. Single. Time.

The filesystem pattern flips this:
- Command outputs get written to files
- To access results, the agent runs CLI commands: `head -20 results.json`, `jq '.users[] | .name' data.json`, `grep -c "error" logs.txt`
- The agent pulls in only what it needs, when it needs it, in the format it needs it

This is how Claude Code handles large codebases without blowing through context limits. It's also why Vercel saw their costs drop 75%.

### 3. Integration with Semantic Kernel Tool Calling

Here's where I want to experiment. Holodeck already has tool definitions—vectorstore searches, MCP servers, custom functions. What if these could execute in "filesystem mode"?

Imagine a `search_knowledge_base` tool that, instead of returning results directly:
1. Runs as a subprocess
2. Writes results to `./sandbox/outputs/search_001.json`
3. Returns just the path to the agent
4. Lets the agent `cat` or `jq` the file as needed

You get structured tool definitions for discoverability (the model knows what tools exist), but filesystem semantics for execution (the model controls what data actually enters context).

This could layer nicely with the tool search pattern I already built. Filter tools dynamically, *then* execute them in a sandboxed filesystem. Best of both worlds.

What might this look like in practice? Today, Holodeck tools are defined like this:

```yaml
tools:
  - name: knowledge_search
    type: vectorstore
    config:
      index: product-docs

  - name: brave_search
    type: mcp
    server: brave-search
```

What if we added an execution mode?

```yaml
tools:
  - name: knowledge_search
    type: vectorstore
    config:
      index: product-docs
    execution:
      mode: filesystem              # NEW: execute via CLI, write to file
      output_dir: ./sandbox/search

  - name: brave_search
    type: mcp
    server: brave-search
    execution:
      mode: filesystem
      output_dir: ./sandbox/web
```

The agent would then call these as CLI commands:
```bash
$ holodeck-tool knowledge_search '{"query": "pricing"}' > ./sandbox/search/001.json
$ holodeck-tool brave_search '{"query": "competitor analysis"}' > ./sandbox/web/001.json
```

Same tool definitions for discoverability. Filesystem semantics for execution. The agent still knows what tools exist (via the tool search pattern from my previous post), but now it controls *when* and *how much* of the output enters context.

### 4. Multi-Platform Support

I'm on macOS. Most servers run Linux. Some people poor souls use Windows.

The goal is cross-platform support, which means:
- No macOS-specific sandboxing (sorry, `sandbox-exec`)
- Abstracting filesystem operations through a clean interface
- Probably leaning on Docker for production isolation

This is the stretch goal. I'll be happy if macOS and Linux work cleanly.

## What This Isn't

To be clear: this is an experiment. I'm not replacing Holodeck's core execution model with bash. The standard tool calling flow works great for most use cases, and the tool search pattern I built already handles the "too many tools" problem.

What I'm building is an *additional* capability—a `sandbox` tool that agents can use when they need filesystem-style access for memory-intensive or retrieval-heavy tasks. Think of it as giving your agent a scratchpad with Unix superpowers.

The eventual API might look something like:

```yaml
tools:
  - name: sandbox
    type: sandbox
    config:
      base_path: ./workspace
      allowed_commands: [cat, grep, ls, head, tail, find, jq, awk]
      audit_log: ./logs/sandbox.log
      copy_on_write: true
```

But that's getting ahead of myself. Implementation is for Part 2.

## Next Up

In **Part 2**, I'll dig into implementation details:
- Setting up the sandboxed filesystem
- Copy-on-write semantics (probably borrowing ideas from AgentFS)
- The command execution layer with proper escaping and timeouts
- Audit logging and rollback

**Part 3** will cover Semantic Kernel integration—making existing tools execute in "filesystem mode" and exposing the whole thing as a Holodeck tool.

If you've built something similar or have thoughts on the approach, I'd love to hear about it.

---

*This post is part of a series on building filesystem-based agentic memory systems. Read my previous post on [reducing token consumption with tool search](https://dev.to/jeremiahbarias/how-i-reduced-my-agents-token-consumption-by-83-57nh) for context on the first pattern I implemented.*
