---
title: "From YAML to Production: Deploying HoloDeck Agents to Azure Container Apps"
slug: holodeck-deploy-azure
publishDate: 28 Jan 2026
description: A step-by-step walkthrough of building and deploying a customer support agent to Azure Container Apps using HoloDeck's new deploy command. No Kubernetes required.
---

# From YAML to Production: Deploying HoloDeck Agents to Azure Container Apps

Your agent works locally. The evaluations pass. Chat sessions flow smoothly. Now comes the question every agent developer faces: how do I get this thing into production?

Traditionally, this is where the real work begins—Dockerfiles, container registries, Kubernetes manifests, ingress controllers, health checks. But with HoloDeck's new `deploy` command, you can go from a local YAML configuration to a production endpoint in a few commands. No Kubernetes required.

In this guide, we'll walk through deploying a customer support agent to Azure Container Apps.

## The Customer Support Agent

Let's start with what we're deploying. The `customer-support` agent in `sample/customer-support/ollama/` (from [github.com/justinbarias/holodeck-samples](https://github.com/justinbarias/holodeck-samples)) is a context-aware support chatbot with:

- **Knowledge base search** via vector stores for product documentation
- **FAQ lookup** for quick answers to common questions
- **Product catalog search** for subscription plans and pricing
- **Conversation memory** via MCP for context persistence

Here's the core configuration:

```yaml
name: customer-support
description: Context-aware customer support agent with knowledge base integration

model:
  provider: ollama
  name: gpt-oss:20b
  temperature: 0.3
  max_tokens: 4096
  endpoint: http://truenas.home:11434

instructions:
  file: instructions/system-prompt.md

tools:
  # Knowledge Base - Product documentation and support articles
  - name: knowledge_base
    type: vectorstore
    description: Search product documentation and support articles
    database: chromadb
    embedding_model: nomic-embed-text:latest
    top_k: 5
    source: data/knowledge_base.md

  # FAQ Database - Frequently asked questions
  - name: faq
    type: vectorstore
    description: Search frequently asked questions for quick answers
    database: chromadb
    embedding_model: nomic-embed-text:latest
    source: data/faq.json
    top_k: 3

  # Memory - Conversation persistence via MCP
  - name: memory
    type: mcp
    description: Store and retrieve conversation context
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-memory"
```

No Python code. Just YAML. The agent knows how to search documentation, look up FAQs, and remember conversation context—all defined declaratively.

## Adding Deployment Configuration

To deploy this agent, we add a `deployment` section to `agent.yaml`. This tells HoloDeck where to push the container image and which cloud provider to use:

```yaml
deployment:
  registry:
    url: ghcr.io
    repository: justinbarias/customer-support-agent
  target:
    provider: azure
    azure:
      subscription_id: <guid-of-subscription-id>
      resource_group: holodeck-aca
      environment_name: holodeck-env
      location: australiaeast
  protocol: rest
  port: 8080
```

Let's break this down:

| Field | Description |
|-------|-------------|
| `registry.url` | Container registry (GitHub Container Registry in this case) |
| `registry.repository` | Repository name for the image |
| `target.provider` | Cloud provider (`azure`, `aws`, or `gcp`) |
| `target.azure.*` | Azure-specific settings—subscription, resource group, environment |
| `protocol` | API protocol (`rest` or `ag-ui` for CopilotKit) |
| `port` | Port the agent listens on |

## Building the Container Image

With the deployment configuration in place, building the image is a single command:

```bash
holodeck deploy build agent.yaml
```

Here's what happens:

```
Loading agent configuration from agent.yaml...

Build Configuration:
  Agent:     customer-support
  Image:     ghcr.io/justinbarias/customer-support-agent:3443eda
  Platform:  linux/amd64
  Protocol:  rest
  Port:      8080

Preparing build context...
Connecting to Docker...
Building image ghcr.io/justinbarias/customer-support-agent:3443eda...


============================================================
  Build Successful!
============================================================

  Image:    ghcr.io/justinbarias/customer-support-agent:3443eda
  ID:       sha256:b7e145183148...

  Next steps:
    Run locally:  docker run -p 8080:8080 ghcr.io/justinbarias/customer-support-agent:3443eda
    Push to registry:  docker push ghcr.io/justinbarias/customer-support-agent:3443eda
```

Behind the scenes, HoloDeck:

1. **Generates a Dockerfile** using the `holodeck-base` image
2. **Copies your agent files** (agent.yaml, instructions, data directories)
3. **Creates an entrypoint script** that runs `holodeck serve`
4. **Builds the image** with OCI-compliant labels
5. **Tags it** with the current git SHA (`3443eda`)

Want to see what would be built without actually building? Use `--dry-run`:

```bash
holodeck deploy build agent.yaml --dry-run
```

This shows the generated Dockerfile and build context without executing anything.

## Pushing to Registry

The `holodeck deploy push` command is planned but not yet implemented. For now, use Docker directly:

```bash
# Login to GitHub Container Registry
docker login ghcr.io -u USERNAME

# Push the image
docker push ghcr.io/justinbarias/customer-support-agent:3443eda
```

```
The push refers to repository [ghcr.io/justinbarias/customer-support-agent]
c57f153dc3b1: Pushed
cab5b36daf6a: Pushed
0190bcbc478d: Pushed
...
3443eda: digest: sha256:d807e905fed0... size: 4080
```

## Deploying to Azure Container Apps

With the image in the registry, deployment is another single command:

```bash
holodeck deploy run agent.yaml
```

```
Deploy Configuration:
  Agent:     customer-support
  Image:     ghcr.io/justinbarias/customer-support-agent:3443eda
  Tag:       3443eda
  Platform:  linux/amd64
  Provider:  azure
  Port:      8080

Deployment Successful!
  Service:   customer-support
  Status:    Succeeded
  URL:       https://customer-support.nicerock-800c6f60.australiaeast.azurecontainerapps.io
  Health:    https://customer-support.nicerock-800c6f60.australiaeast.azurecontainerapps.io/health
```

HoloDeck creates an Azure Container App with:

- **External ingress** with automatic HTTPS
- **Health checks** on `/health`
- **Auto-scaling** based on HTTP traffic
- **Environment variables** for LLM API keys (passed through securely)

The agent is now live at the generated URL.

## Testing the Deployed Agent

Let's verify the deployment with a health check:

```bash
curl https://customer-support.nicerock-800c6f60.australiaeast.azurecontainerapps.io/health
```

```json
{
  "status": "healthy",
  "agent_name": "customer-support",
  "agent_ready": true,
  "active_sessions": 0,
  "uptime_seconds": 14.41
}
```

The agent is healthy and ready to receive requests.

To chat with the agent:

```bash
curl -X POST https://customer-support.nicerock-800c6f60.australiaeast.azurecontainerapps.io/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is your return policy?"}'
```

## Managing Deployments

### Check Status

At any time, you can check the deployment status:

```bash
holodeck deploy status agent.yaml
```

```
Deployment Status
  Service:   customer-support
  Provider:  azure
  Status:    Succeeded
  URL:       https://customer-support.nicerock-800c6f60.australiaeast.azurecontainerapps.io
  Updated:   2026-01-28T00:27:28.537340+00:00
```

### Tear Down

When you're done, clean up the deployment:

```bash
holodeck deploy destroy agent.yaml
```

This removes the Container App from Azure. The image remains in the registry for future deployments.

### State Tracking

HoloDeck tracks deployment state locally in `.holodeck/deployments.json`. This allows it to manage updates and teardowns without querying the cloud provider each time.

## What About AWS and GCP?

AWS App Runner and GCP Cloud Run support are coming soon. The configuration looks similar:

```yaml
# AWS App Runner (planned)
deployment:
  target:
    provider: aws
    aws:
      region: us-east-1
      cpu: 1
      memory: 2048

# GCP Cloud Run (planned)
deployment:
  target:
    provider: gcp
    gcp:
      project_id: my-project
      region: us-central1
      memory: 512Mi
```

For now, you can use `holodeck deploy build` to create the container image, push it to any registry, and deploy manually to your preferred platform. See the [DIY Deployment section](https://docs.useholodeck.ai/guides/deployment/#diy-deployment) in the deployment guide for details.

## Conclusion

We went from a YAML configuration to a production API endpoint in four steps:

1. **Add deployment config** to agent.yaml
2. **Build** with `holodeck deploy build`
3. **Push** the image to a registry
4. **Deploy** with `holodeck deploy run`

No Dockerfiles to write. No Kubernetes to configure. No infrastructure to manage.

The full deployment documentation is available in the [Deployment Guide](https://docs.useholodeck.ai/guides/deployment). Give it a try with your own agents—and let us know how it goes.
