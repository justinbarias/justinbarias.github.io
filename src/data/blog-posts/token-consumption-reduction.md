---
title: "How I Reduced My Agent's Token Consumption by 83%"
slug: holodeck-tool-search
publishDate: 16 Jan 2025
description: MCP servers are great until you realize you're burning tokens on 16 tool definitions for a simple "hi there". Here's how I implemented Anthropic's tool search pattern in Holodeck.
---

# How I Reduced My Agent's Token Consumption by 83%

I was building a research agent with HoloDeck for paper search, Brave Search for web lookups, and a memory MCP server for knowledge graphs. Pretty standard stuff.

Then I looked at my API call payload for a simple "hi there" message:

```json
{
  "messages": [...],
  "tools": [
    {"function": {"name": "vectorstore-search_papers", ...}},
    {"function": {"name": "brave_search-brave_image_search", ...}},
    {"function": {"name": "brave_search-brave_local_search", ...}},
    {"function": {"name": "brave_search-brave_news_search", ...}},
    {"function": {"name": "brave_search-brave_summarizer", ...}},
    {"function": {"name": "brave_search-brave_video_search", ...}},
    {"function": {"name": "brave_search-brave_web_search", ...}},
    {"function": {"name": "memory-add_observations", ...}},
    {"function": {"name": "memory-create_entities", ...}},
    {"function": {"name": "memory-create_relations", ...}},
    {"function": {"name": "memory-delete_entities", ...}},
    {"function": {"name": "memory-delete_observations", ...}},
    {"function": {"name": "memory-delete_relations", ...}},
    {"function": {"name": "memory-open_nodes", ...}},
    {"function": {"name": "memory-read_graph", ...}},
    {"function": {"name": "memory-search_nodes", ...}}
  ]
}
```

**16 tools.** For "hi there."

The Brave Search MCP server alone exposes 6 functions with verbose parameter schemas (country codes, language enums, pagination options). The memory server adds another 9. Every single request was burning tokens on tool definitions the model would never use.

## The Anthropic Inspiration

Anthropic's engineering team published a [fantastic post on advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use) that addressed exactly this problem. Their key insight: **don't load all tools upfront—discover them on demand.**

Their numbers were compelling: a five-server MCP setup went from ~55K tokens to ~8.7K tokens. An 85% reduction.

I wanted that for HoloDeck. But I'm using Microsoft's Semantic Kernel, not Claude's native tool system. So I had to figure out how to make it work.

## The Architecture

Here's what I built:

```
User Query
    │
    ▼
┌─────────────────────────────┐
│     ToolFilterManager       │
│  ┌───────────────────────┐  │
│  │      ToolIndex        │  │
│  │  • Tool metadata      │  │
│  │  • Embeddings         │  │
│  │  • BM25 index         │  │
│  │  • Usage tracking     │  │
│  └───────────────────────┘  │
│             │               │
│      search(query)          │
│             │               │
│             ▼               │
│    Filtered tool list       │
└─────────────────────────────┘
    │
    ▼
┌─────────────────────────────┐
│  FunctionChoiceBehavior     │
│  .Auto(filters={            │
│    "included_functions":    │
│      ["tool1", "tool2"]     │
│  })                         │
└─────────────────────────────┘
    │
    ▼
Semantic Kernel Agent Invocation
(only selected tools in context)
```

Three main components:

1. **ToolIndex** - Indexes all tools from Semantic Kernel plugins with embeddings and BM25 stats
2. **ToolFilterManager** - Orchestrates filtering and integrates with SK's execution settings
3. **FunctionChoiceBehavior** - SK's native mechanism for restricting which functions the LLM sees

## Building the Tool Index

The first challenge: extracting tool metadata from Semantic Kernel's plugin system. SK organizes tools as functions within plugins, so I needed to crawl that structure:

```python
async def build_from_kernel(
    self,
    kernel: Kernel,
    embedding_service: EmbeddingGeneratorBase | None = None,
    defer_loading_map: dict[str, bool] | None = None,
) -> None:
    plugins: dict[str, KernelPlugin] = getattr(kernel, "plugins", {})

    for plugin_name, plugin in plugins.items():
        functions: dict[str, KernelFunction] = getattr(plugin, "functions", {})

        for func_name, func in functions.items():
            full_name = f"{plugin_name}-{func_name}"

            # Extract description and parameters for search
            description = getattr(func, "description", "")
            parameters: list[str] = []

            func_params: list[KernelParameterMetadata] | None = getattr(
                func, "parameters", None
            )
            if func_params:
                for param in func_params:
                    if param.description:
                        parameters.append(f"{param.name}: {param.description}")

            # Create searchable metadata
            tool_metadata = ToolMetadata(
                name=func_name,
                plugin_name=plugin_name,
                full_name=full_name,
                description=description,
                parameters=parameters,
                defer_loading=defer_loading_map.get(full_name, True),
            )

            self.tools[full_name] = tool_metadata
```

Each tool becomes a searchable document combining its name, plugin, description, and parameter info.

## Three Search Methods

I implemented three ways to find relevant tools:

### 1. Semantic Search (Embeddings)

The obvious choice. Embed the query, embed the tools, compute cosine similarity:

```python
async def _semantic_search(
    self, query: str, embedding_service: EmbeddingGeneratorBase | None
) -> list[tuple[ToolMetadata, float]]:
    # Generate query embedding
    query_embeddings = await embedding_service.generate_embeddings([query])
    query_embedding = list(query_embeddings[0])

    results: list[tuple[ToolMetadata, float]] = []
    for tool in self.tools.values():
        if tool.embedding:
            score = _cosine_similarity(query_embedding, tool.embedding)
            results.append((tool, score))

    return results
```

Good for understanding intent. "Find information about refunds" matches `get_return_policy` even though they share no keywords. Scores range from 0.0 to 1.0, with good matches typically in the **0.4-0.6 range**.

### 2. BM25 (Keyword Matching)

Classic information retrieval using [Okapi BM25](https://www.staff.city.ac.uk/~seb/papers/Robertson_Zaragoza2009-FTIR.pdf) (Robertson & Zaragoza, 2009). Sometimes you want exact matches:

```python
def _bm25_score_single(self, query: str, tool: ToolMetadata) -> float:
    query_tokens = _tokenize(query)
    doc_tokens = _tokenize(self._create_searchable_text(tool))

    # Count term frequencies
    term_freq: dict[str, int] = {}
    for token in doc_tokens:
        term_freq[token] = term_freq.get(token, 0) + 1

    score = 0.0
    for term in query_tokens:
        if term not in term_freq:
            continue

        tf = term_freq[term]
        idf = self._idf_cache.get(term, 0.0)

        # BM25 formula
        numerator = tf * (self._BM25_K1 + 1)
        denominator = tf + self._BM25_K1 * (
            1 - self._BM25_B + self._BM25_B * doc_length / self._avg_doc_length
        )
        score += idf * (numerator / denominator)

    return score
```

Fast, no embeddings needed. Great for technical terms: "brave_search" should definitely match tools from the Brave Search plugin.

**Important gotcha:** The tokenizer must split on underscores! Tool names like `brave_web_search` need to tokenize as `["brave", "web", "search"]`, not as a single token. Otherwise queries containing "web" won't match the tool. I learned this the hard way when "find papers on the web" was returning `brave_image_search` instead of `brave_web_search`.

```python
def _tokenize(text: str) -> list[str]:
    # Use [a-zA-Z0-9]+ to split on underscores (not \w+ which includes them)
    tokens = re.findall(r"[a-zA-Z0-9]+", text.lower())
    return tokens
```

### 3. Hybrid (Reciprocal Rank Fusion)

Why choose? Combine both with [Reciprocal Rank Fusion](https://dl.acm.org/doi/10.1145/1571941.1572114) (Cormack et al., 2009):

```python
async def _hybrid_search(
    self, query: str, embedding_service: EmbeddingGeneratorBase | None
) -> list[tuple[ToolMetadata, float]]:
    semantic_results = await self._semantic_search(query, embedding_service)
    bm25_results = self._bm25_search(query)

    # Reciprocal Rank Fusion
    k = 60  # Constant from the original paper
    rrf_scores: dict[str, float] = {}

    semantic_sorted = sorted(semantic_results, key=lambda x: x[1], reverse=True)
    for rank, (tool, _) in enumerate(semantic_sorted):
        rrf_scores[tool.full_name] = rrf_scores.get(tool.full_name, 0.0) + 1 / (k + rank + 1)

    bm25_sorted = sorted(bm25_results, key=lambda x: x[1], reverse=True)
    for rank, (tool, _) in enumerate(bm25_sorted):
        rrf_scores[tool.full_name] = rrf_scores.get(tool.full_name, 0.0) + 1 / (k + rank + 1)

    # Normalize to 0-1 range (raw RRF scores are ~0.01-0.03)
    max_score = max(rrf_scores.values()) if rrf_scores else 1.0
    normalized = {name: score / max_score for name, score in rrf_scores.items()}

    return [(self.tools[name], score) for name, score in normalized.items()]
```

RRF rewards tools that rank highly in **both** methods without being dominated by either's raw scores.

**Critical detail:** Raw RRF scores are tiny (0.01-0.03 range) because of the formula `1/(k+rank+1)` with k=60. If you apply a `similarity_threshold` of 0.3 to raw scores, *everything* gets filtered out! You must normalize RRF scores to 0-1 range by dividing by the max score. After normalization, good matches score **0.8-1.0**.

## The Semantic Kernel Integration

Here's the clever bit. Semantic Kernel has a `FunctionChoiceBehavior` class that controls which functions the LLM can call. It supports a `filters` parameter:

```python
def create_function_choice_behavior(
    self, filtered_tools: list[str]
) -> FunctionChoiceBehavior:
    return FunctionChoiceBehavior.Auto(
        filters={"included_functions": filtered_tools}
    )
```

That's it. Pass in a list of tool names, and SK only sends those tool definitions to the LLM.

The manager wires it all together:

```python
async def prepare_execution_settings(
    self,
    query: str,
    base_settings: PromptExecutionSettings,
) -> PromptExecutionSettings:
    if not self.config.enabled:
        return base_settings

    # Filter tools based on query
    filtered_tools = await self.filter_tools(query)

    # Create behavior with only filtered tools
    function_choice = self.create_function_choice_behavior(filtered_tools)

    # Clone settings and attach filtered behavior
    cloned = self._clone_settings(base_settings)
    cloned.function_choice_behavior = function_choice

    return cloned
```

## Configuration

I made it all YAML-configurable because that's the HoloDeck way:

```yaml
tool_filtering:
  enabled: true
  top_k: 5                        # Max tools per request
  similarity_threshold: 0.5       # Minimum score for inclusion
  always_include:
    - search_papers               # Critical tools always available
  always_include_top_n_used: 0    # Disable until usage patterns stabilize
  search_method: hybrid           # Options: semantic, bm25, hybrid
```

### Sensible Defaults

Here's what I recommend starting with:

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| `top_k` | **5** | Enough tools for most tasks without token bloat |
| `similarity_threshold` | **0.5** | Include tools at least 50% as relevant as top result |
| `always_include` | **[]** | Agent-specific—add your critical tools here |
| `always_include_top_n_used` | **0** | Avoid early usage bias; enable after patterns stabilize |
| `search_method` | **hybrid** | Best of semantic + keyword matching |

### Threshold Tuning by Search Method

All search methods now return normalized scores in the 0-1 range, making the `similarity_threshold` consistent across methods:

| Method | Good Match Range | Recommended Threshold |
|--------|------------------|----------------------|
| **semantic** | 0.4 - 0.6 | 0.3 - 0.4 |
| **bm25** (normalized) | 0.8 - 1.0 | 0.5 - 0.6 |
| **hybrid** (normalized) | 0.8 - 1.0 | 0.5 - 0.6 |

A threshold of 0.5 means "include tools scoring at least 50% of what the top result scores." This filters out clearly irrelevant tools while keeping useful ones.

### Configuration Knobs

- **top_k**: How many tools max per request
- **similarity_threshold**: Below this score, tools get filtered out
- **always_include**: Your core tools that should always be available
- **always_include_top_n_used**: Adaptive optimization—frequently used tools stay in context. **Caution:** This tracks usage across requests, so early/accidental tool calls can bias future filtering. Keep at 0 during development.

Here's the full agent configuration I was testing with:

```yaml
# HoloDeck Research Agent Configuration
name: "research-agent"
description: "Research analysis AI assistant"

model:
  provider: azure_openai
  name: gpt-5.2

instructions:
  file: instructions/system-prompt.md

# Tools Configuration
tools:
  # Vectorstore for research paper search
  - type: vectorstore
    name: search_papers
    description: Search research papers and documents for relevant passages
    source: data/papers_index.json
    embedding_model: text-embedding-3-small
    top_k: 5
    database:
      provider: chromadb

  # Brave Search MCP Server (exposes 6 functions)
  - type: mcp
    name: brave_search
    description: Web search using Brave Search API
    command: npx
    args: ["-y", "@brave/brave-search-mcp-server"]
    env:
      BRAVE_API_KEY: ${BRAVE_API_KEY}

  # Memory MCP Server (exposes 9 functions)
  - type: mcp
    name: memory
    description: Persistent memory using local knowledge graph
    command: npx
    args: ["-y", "@modelcontextprotocol/server-memory"]

# Tool Filtering - This is where the magic happens
tool_filtering:
  enabled: true
  top_k: 5
  similarity_threshold: 0.5
  always_include:
    - search_papers
  always_include_top_n_used: 0
  search_method: hybrid
```

Three tool sources. 16 total functions exposed. Without filtering, every request sends all 16 tool schemas.

## The Results

Let me show you actual API payloads. With filtering **off**, here's what gets sent for a simple "hi there":

```json
{
  "messages": [
    {"role": "system", "content": "# System Prompt for research-agent..."},
    {"role": "user", "content": "hi there"}
  ],
  "model": "gpt-5.2",
  "tools": [
    {"type": "function", "function": {"name": "vectorstore-search_papers", "description": "Search research papers...", "parameters": {...}}},
    {"type": "function", "function": {"name": "brave_search-brave_image_search", "description": "Performs an image search...", "parameters": {"properties": {"query": {...}, "country": {...}, "search_lang": {...}, "count": {...}, "safesearch": {...}, "spellcheck": {...}}, ...}}},
    {"type": "function", "function": {"name": "brave_search-brave_local_search", ...}},
    {"type": "function", "function": {"name": "brave_search-brave_news_search", ...}},
    {"type": "function", "function": {"name": "brave_search-brave_summarizer", ...}},
    {"type": "function", "function": {"name": "brave_search-brave_video_search", ...}},
    {"type": "function", "function": {"name": "brave_search-brave_web_search", ...}},
    {"type": "function", "function": {"name": "memory-add_observations", ...}},
    {"type": "function", "function": {"name": "memory-create_entities", ...}},
    {"type": "function", "function": {"name": "memory-create_relations", ...}},
    {"type": "function", "function": {"name": "memory-delete_entities", ...}},
    {"type": "function", "function": {"name": "memory-delete_observations", ...}},
    {"type": "function", "function": {"name": "memory-delete_relations", ...}},
    {"type": "function", "function": {"name": "memory-open_nodes", ...}},
    {"type": "function", "function": {"name": "memory-read_graph", ...}},
    {"type": "function", "function": {"name": "memory-search_nodes", ...}}
  ]
}
```

**16 tools. 5,888 tokens.** For "hi there."

Look at those Brave Search parameter schemas—country code enums, language preferences, pagination options, safesearch filters. Each tool definition is a token hog.

With filtering **on**:

```json
{
  "messages": [
    {"role": "system", "content": "# System Prompt for research-agent..."},
    {"role": "user", "content": "hi there"}
  ],
  "model": "gpt-5.2",
  "tools": [
    {"type": "function", "function": {"name": "vectorstore-search_papers", ...}},
    {"type": "function", "function": {"name": "brave_search-brave_web_search", ...}}
  ]
}
```

**2 tools. 1,016 tokens.**

That's an **83% reduction**—from 5,888 tokens down to 1,016.

The logs tell the story:

```
Tool filtering: 2/16 tools selected for query: 'hi there...'
Selected tools: ['vectorstore-search_papers', 'brave_search-brave_web_search']
```

For a real research query like "Find papers on transformer architectures on the web", the filtering gets smarter:

```
Tool filtering: 3/16 tools selected
Selected tools: ['vectorstore-search_papers', 'brave_search-brave_web_search', 'memory-search_nodes']
```

The right tools. Automatically. Based on what the user actually asked.

## Lessons Learned

**1. MCP servers are tool factories.** A single MCP server can expose dozens of functions. Without filtering, your token costs explode.

**2. Tokenization matters for BM25.** Make sure your tokenizer splits on underscores so `brave_web_search` becomes `["brave", "web", "search"]`. Otherwise keyword matching fails on tool names.

**3. Normalize your search scores.** Raw BM25 scores range from 0-10+, and raw RRF scores are tiny (0.01-0.03). Both need normalization to 0-1 range, or your `similarity_threshold` won't work consistently. Semantic search (cosine similarity) is already 0-1.

**4. After normalization, thresholds are consistent.** With all methods normalized, good matches score 0.8-1.0 for BM25/hybrid, and 0.4-0.6 for semantic. A threshold of 0.5 works well across methods.

**5. always_include is your safety net.** Some tools are so core to your agent that you never want them filtered out. Make that explicit.

**6. Be careful with always_include_top_n_used.** This feature tracks usage and auto-includes frequently used tools. Sounds great, but early/accidental usage can bias future requests. Keep it at 0 during development.

## What's Next

This is just tool filtering. Anthropic's post also covers:

- **Programmatic tool calling**: Let the model write code to process intermediate results
- **Tool use examples**: Providing concrete usage patterns to reduce parameter ambiguity

I might implement those next. But for now, getting 83% token reduction with a few hundred lines of code feels pretty good.

---

The full implementation is in [HoloDeck's tool_filter module](https://github.com/justinbarias/holodeck/tree/main/src/holodeck/lib/tool_filter). PRs welcome.
