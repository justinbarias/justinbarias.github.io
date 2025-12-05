---
title: "HoloDeck Part 2: What's Out There for AI Agents"
slug: holodeck-part2-comparison
publishDate: 15 Nov 2024
description: A look at the current landscape of AI agent platforms - LangSmith, MLflow, PromptFlow, and the major cloud providers. What they do well, what's missing.
---

In [Part 1](/blog/holodeck-part1-problem), I talked about why agent development feels broken. Before building something myself, I spent time looking at what's already out there. Here's what I found.

---

## This is Part 2 of a 3-Part Series

1. [Why It Feels Broken](/blog/holodeck-part1-problem) - What's wrong with agent development
2. **What's Out There** (You are here)
3. [What I'm Building](/blog/holodeck-part3-solution) - HoloDeck's approach and how it works

---

## The Landscape

A bunch of platforms tackle parts of this problem. I wanted something open-source, self-hosted, and config-driven—something that fits into existing CI/CD workflows without vendor lock-in. That shaped how I evaluated these tools.

---

## Developer Tools & Frameworks

### LangSmith (LangChain Team)

LangSmith is really good at what it does—production observability and tracing for LangChain apps. If you're already in the LangChain ecosystem and need monitoring, it's solid.

| Aspect                  | HoloDeck                                                                    | LangSmith                              |
| ----------------------- | --------------------------------------------------------------------------- | -------------------------------------- |
| **Deployment Model**    | Self-hosted (open-source)                                                   | SaaS only                              |
| **CI/CD Integration**   | CLI-based, works in any pipeline                                            | API-based, needs cloud connectivity    |
| **Agent Definition**    | Pure YAML                                                                   | Python code + LangChain SDK            |
| **Primary Focus**       | Agent experimentation & deployment                                          | Production observability & tracing     |
| **Agent Orchestration** | Multi-agent patterns                                                        | Not designed for multi-agent workflows |
| **Agent Evaluation**    | Custom criteria, LLM-as-judge, NLP metrics (BLEU, METEOR, ROUGE, F1)        | LLM-as-judge, custom evaluators        |
| **Self-Hosted LLMs**    | Native support (Ollama, vLLM, OpenAI-compatible)                            | Via LangChain integrations             |

Different tools for different problems. LangSmith is about monitoring production apps; I was looking for something to help with the build-and-test loop.

---

### MLflow GenAI (Databricks)

MLflow is a beast for ML experiment tracking. Their GenAI additions are interesting, but it's designed for model comparison rather than agent workflows. If you're already using MLflow for ML ops, the GenAI features slot in nicely.

| Aspect                      | HoloDeck                                              | MLflow GenAI                                   |
| --------------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| **CI/CD Integration**       | CLI-native                                            | Python SDK + REST API                          |
| **Infrastructure**          | Lightweight, portable                                 | Heavy (ML tracking server, often Databricks)   |
| **Agent Support**           | Purpose-built for agents                              | Focused on model evaluation                    |
| **Multi-Agent**             | Native orchestration patterns                         | Single model/variant comparison                |
| **Complexity**              | Minimal (YAML)                                        | Higher (ML engineering mindset)                |
| **Agent Evaluation**        | Custom criteria, LLM-as-judge, NLP metrics            | LLM-as-judge, custom scorers                   |

The infrastructure overhead was the main thing that put me off. I wanted something lighter.

---

### Microsoft PromptFlow

PromptFlow has a nice visual approach—you can see your flows as graphs, which is great for understanding what's happening. But it's really about individual functions and tools, not full agent orchestration.

| Aspect                  | HoloDeck                                              | PromptFlow                                   |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------- |
| **CI/CD Integration**   | CLI-first                                             | Python SDK, Azure-centric                    |
| **Scope**               | Full agent lifecycle                                  | Individual tools & functions                 |
| **Design Target**       | Multi-agent workflows                                 | Single tool/AI function development          |
| **Configuration**       | Pure YAML                                             | Visual flow graphs + low-code Python         |
| **Agent Orchestration** | Multi-agent patterns                                  | Not designed for multi-agent                 |
| **Self-Hosted**         | Yes                                                   | Limited (designed for Azure)                 |
| **Agent Evaluation**    | Custom criteria, LLM-as-judge, NLP metrics            | LLM-as-judge (GPT-based), F1/BLEU/ROUGE      |

If you're building individual AI functions and live in Azure, PromptFlow makes sense. For agent-level work, it's not quite there.

---

## The Cloud Providers

All three major clouds have agent platforms now. They're impressive, but they come with the obvious trade-off: you're locked into their ecosystem.

### Azure AI Foundry (Microsoft)

Azure AI Foundry is Microsoft's enterprise play. It integrates with the whole Microsoft stack—Teams, Copilot, etc. If you're already a Microsoft shop, there's a lot to like.

| Aspect                  | HoloDeck                                 | Azure AI Foundry                              |
| ----------------------- | ---------------------------------------- | --------------------------------------------- |
| **Deployment Model**    | Self-hosted (open-source)                | SaaS (Azure-dependent)                        |
| **CI/CD Integration**   | CLI, works anywhere                      | Azure DevOps/GitHub Actions                   |
| **Agent Definition**    | Pure YAML                                | Semantic Kernel SDK + Logic Apps              |
| **Primary Focus**       | Experimentation & deployment             | Enterprise agent orchestration                |
| **Agent Orchestration** | Multi-agent patterns                     | Multi-agent via Semantic Kernel               |
| **Self-Hosted**         | Yes                                      | No (Azure required)                           |
| **Agent Evaluation**    | Custom criteria, LLM-as-judge, NLP       | LLM-as-judge, NLP metrics                     |

The Semantic Kernel framework is interesting, but the Azure dependency is real.

---

### Amazon Bedrock AgentCore (AWS)

Bedrock AgentCore is AWS's managed agent service. Good for running agents at scale if you're already on AWS and using their model offerings.

| Aspect                  | HoloDeck                                 | Amazon Bedrock AgentCore                    |
| ----------------------- | ---------------------------------------- | ------------------------------------------- |
| **Deployment Model**    | Self-hosted (open-source)                | SaaS (AWS-managed)                          |
| **CI/CD Integration**   | CLI, works anywhere                      | AWS CodePipeline/API-based                  |
| **Agent Definition**    | Pure YAML                                | Code (SDK + LangGraph, CrewAI, etc.)        |
| **Primary Focus**       | Experimentation & deployment             | Enterprise agent operations at scale        |
| **Agent Orchestration** | Multi-agent patterns                     | Multi-agent collaboration (supervisor modes)|
| **Self-Hosted**         | Yes                                      | No (AWS required)                           |
| **Agent Evaluation**    | Custom criteria, LLM-as-judge, NLP       | LLM-as-judge, custom metrics, RAG eval      |
| **Self-Hosted LLMs**    | Native support (Ollama, vLLM)            | Bedrock models only                         |

If you want to use local models or run outside AWS, this isn't really an option.

---

### Vertex AI Agent Engine (Google Cloud)

Google's entry into the agent space. The A2A protocol for multi-agent communication is interesting. Like the others, you're tied to GCP.

| Aspect                  | HoloDeck                                 | Vertex AI Agent Engine                      |
| ----------------------- | ---------------------------------------- | ------------------------------------------- |
| **Deployment Model**    | Self-hosted (open-source)                | SaaS (GCP-managed)                          |
| **CI/CD Integration**   | CLI, works anywhere                      | Cloud Build/GitHub Actions                  |
| **Agent Definition**    | Pure YAML                                | Code (ADK, LangChain, LangGraph)            |
| **Primary Focus**       | Experimentation & deployment             | Production agent runtime                    |
| **Agent Orchestration** | Multi-agent patterns                     | Multi-agent via A2A protocol                |
| **Self-Hosted**         | Yes                                      | No (GCP required)                           |
| **Agent Evaluation**    | Custom criteria, LLM-as-judge, NLP       | LLM-as-judge (Gemini), ROUGE/BLEU           |
| **Self-Hosted LLMs**    | Native support (Ollama, vLLM)            | vLLM in Model Garden (complex setup)        |

Similar story—great if you're committed to GCP, but not portable.

---

## What's Missing

After looking at all of these, here's what I couldn't find:

- **Self-hosted and cloud-agnostic** - Everything is either SaaS or tied to a specific cloud
- **Declarative agent definition** - Most require SDK code, not just config
- **Vendor-neutral CI/CD** - The integrations assume you're using their ecosystem
- **Testing + evaluation + deployment in one place** - Usually you're stitching together multiple tools

This is the gap I'm trying to fill with HoloDeck. Not saying it's better than these tools—they're solving different problems. But if you care about portability and owning your workflow, there wasn't much out there.

---

## Quick Reference

| If you need...                           | Look at...               |
| ---------------------------------------- | ------------------------ |
| Production observability for LangChain   | LangSmith                |
| ML experiment tracking at scale          | MLflow                   |
| Visual prompt flow design on Azure       | PromptFlow               |
| Enterprise agents in Microsoft ecosystem | Azure AI Foundry         |
| Managed agents on AWS                    | Bedrock AgentCore        |
| Production runtime on GCP                | Vertex AI Agent Engine   |
| Self-hosted, config-driven, CI/CD-native | HoloDeck                 |

---

## Next Up

In [Part 3](/blog/holodeck-part3-solution), I'll walk through how HoloDeck works—the design decisions, the YAML config approach, the SDK, and what's actually built vs. what's still on the roadmap.

[Continue to Part 3 →](/blog/holodeck-part3-solution)
