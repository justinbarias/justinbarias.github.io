---
title: "HoloDeck Samples"
slug: holodeck-samples
publishDate: 10 Jan 2026
description: Sample agents, prerequisites, and more for getting started with HoloDeck.
---

If you want to get moving fast with HoloDeck, this samples repo is the quickest on-ramp. It's a set of ready-to-run examples you can run, poke around in, and fork as templates:

https://github.com/justinbarias/holodeck-samples

---

## Table of Contents

- [Configuring Prerequisites](#configuring-prerequisites)
- [Explore the use cases](#explore-the-use-cases)
- [Coding assistant integration (Claude Code, GitHub Copilot)](#coding-assistant-integration-claude-code-github-copilot)

---

## Configuring Prerequisites

You'll need a handful of things installed to run the samples locally:

1. **Clone the repo**

   ```bash
   git clone https://github.com/justinbarias/holodeck-samples
   cd holodeck-samples
   ```

2. **Install HoloDeck CLI**

   You'll need Python 3.10+ and `uv`.

   ```bash
   # Install uv (if not already installed)
   curl -LsSf https://astral.sh/uv/install.sh | sh
   # or: brew install uv

   # Install HoloDeck with ChromaDB support
   uv tool install "holodeck-ai[chromadb]@latest" --prerelease allow --python 3.10

   # Verify installation
   holodeck --version
   ```

3. **Grab the supporting tools**

   - **Docker** for ChromaDB and the Aspire Dashboard
   - **Node.js 18+** for the CopilotKit frontend
   - **LLM provider**: OpenAI/Azure API keys, or install Ollama for local runs

4. **Fire up the shared infrastructure**

   ```bash
   ./start-infra.sh
   ```

   This spins up ChromaDB at `http://localhost:8000` and the Aspire Dashboard at `http://localhost:18888`.

5. **Pick a sample + provider**

   ```bash
   cd ticket-routing/openai  # or azure-openai, ollama
   cp .env.example .env
   ```

   Add your provider keys to `.env` (skip this for Ollama).

6. **Fire up the agent and frontend**

   ```bash
   holodeck serve agent.yaml --port 8001
   cd copilotkit
   npm install
   npm run dev
   ```

   Open `http://localhost:3000` and chat with the sample.

---

## Explore the use cases

Here are the four use cases, each with OpenAI, Azure OpenAI, and Ollama flavors:

- **Ticket Routing** (`ticket-routing/`) - Routes support tickets with structured outputs and confidence scores.
- **Customer Support** (`customer-support/`) - RAG-powered chatbot with memory and escalation.
- **Content Moderation** (`content-moderation/`) - Multi-category moderation with policy enforcement and consistency checks.
- **Legal Summarization** (`legal-summarization/`) - Clause extraction, risk flags, and summary quality metrics.

Each sample sticks to the same layout, so you can find stuff fast:

```
<use-case>/<provider>/
├── agent.yaml
├── config.yaml
├── .env.example
├── instructions/
├── data/
└── copilotkit/
```

---

## Coding assistant integration (Claude Code, GitHub Copilot)

The repo also comes with built-in prompts for both Claude Code and GitHub Copilot to speed up agent authoring and tuning.

**Claude Code**

- Slash commands live in `.claude/commands/`
- `/holodeck.create` - Guided wizard for creating a new agent
- `/holodeck.tune path/to/agent.yaml` - Tuning helper that boosts test performance

**GitHub Copilot**

- Prompt files live in `.github/prompts/`
- `holodeck-create` and `holodeck-tune` provide the same workflows as guided prompts
- In VS Code, type `/` or `#prompt:` in Copilot Chat to launch them

Both tools are great for small, reviewable tweaks. Keep secrets out of prompts, and sanity-check changes by running the sample after edits.

---

Star, clone, fork, or use however you like! If you run into issues, file them [here](https://github.com/justinbarias/holodeck-samples/issues).