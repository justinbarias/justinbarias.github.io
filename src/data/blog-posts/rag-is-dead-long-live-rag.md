---
title: "RAG Is Dead. Long Live RAG. Or Is It?"
slug: rag-is-dead-long-live-rag
publishDate: 7 Feb 2026
description: "The hype cycle churned through RAG, GraphRAG, and vector-everything. Meanwhile, a quiet Anthropic blog post from 2024 showed us what actually works — and why most organisations are still getting information retrieval wrong."
---

_Heads up: this is a long one. Grab a coffee._

There's a running joke in the AI engineering community: every six months, someone publishes a post declaring RAG dead. And every six months, the rest of us are still building retrieval pipelines, because the alternative — cramming a million pages into a context window and praying — doesn't actually work.

So let me add to the pile. RAG is dead. Long live RAG. Or is it?

Welcome to this rabbit hole.

## What we're covering

- The Great Vector Gold Rush of 2023 (and why it mostly didn't work)
- GraphRAG's brief moment in the sun
- The Anthropic blog post that rewired my brain
- How I turned that into a tool for 800-page legislation (with reranking)
- Why structured data gets left out of every RAG conversation
- The agentic shift happening right now
- The information retrieval problem nobody actually solved

---

## The Great Vector Gold Rush

Cast your mind back to 2023. ChatGPT had just lit the world on fire and suddenly every database vendor on the planet had a vector announcement to make. Postgres got `pgvector`. Redis added vector similarity. Elasticsearch, MongoDB, Supabase — everyone scrambled to bolt on approximate nearest neighbour search like it was the new JSON column.

And enterprise teams took the bait. The playbook was dead simple:

1. Take your documents
2. Chunk them naively (every 500 tokens, maybe with some overlap)
3. Embed them with `text-embedding-ada-002`
4. Stuff them into a vector store
5. Wire up a chatbot
6. Ship it. Call it "AI-powered knowledge management"

Sound familiar? Yeah. Everyone did this.

I watched it play out firsthand. Business teams at my organisation (I work for the Federal Government) would come to us, exasperated:

> "We tried using Copilot with SharePoint. We even ingested everything into Dataverse. It can't seem to understand PDFs with tables! Also it hallucinated like nobody's business. Precision and recall scores were abysmal. The whole thing turned into unusable slop."

The frustration was real. The promise of "just ask your documents anything" crumbled the moment you needed an actual correct answer from an 800-page piece of legislation. And the root cause was always the same: **nobody was taking the information retrieval problem seriously.**

They were treating retrieval as a checkbox — "we have a vector store, done" — when it's actually the hardest part of the whole pipeline.

## GraphRAG and the Hype That Fizzled

Then came GraphRAG. Microsoft Research published a paper, the community got excited, and suddenly everyone was building knowledge graphs out of their document corpora. The idea had elegance: model entities and relationships explicitly, then traverse the graph during retrieval to capture multi-hop reasoning.

In practice? The extraction was brittle. The graphs were noisy. The latency was punishing. And for most use cases — "find me the section about reporting requirements in this regulation" — a well-built keyword index would have done the job in milliseconds.

GraphRAG didn't die, exactly. It found its niche in certain analytical workloads. But as a general-purpose retrieval upgrade for enterprise document search? It fizzled. The gap between research demo and production system was a chasm.

## The Blog Post That Changed Everything (For Me)

In late 2024, Anthropic's engineering team quietly published a blog post called [Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval). No fanfare. No "paradigm shift" language. Just a straightforward technique that made me stop what I was doing and redesign an entire tool.

The core insight is embarrassingly simple: **when you chunk a document, you destroy context. So put the context back before you embed.**

Here's what I mean. Traditional RAG takes a chunk like _"The Administrator shall submit a report within 30 days"_ and embeds it in isolation. Which administrator? Which report? 30 days from what? The chunk lost all of that when it got ripped out of the document.

Contextual Retrieval takes the same chunk and prepends a short, LLM-generated summary of where it sits in the document: _"This chunk is from Title IV, Chapter 2, Section 403(b) of the Clean Air Act, which covers administrative reporting requirements."_ Then you embed the whole thing.

That's it. That's the technique.

### The Pipeline

Let me draw it out, because this is where it gets interesting — Anthropic doesn't just add context to embeddings. They build a **hybrid index** that combines vector search and BM25 keyword search, blended with Reciprocal Rank Fusion. The full pipeline looks like this:

```
═══════════════════════════════════════════════════════════════════════
  CONTEXTUAL RETRIEVAL PIPELINE (Anthropic)
═══════════════════════════════════════════════════════════════════════

  INDEXING PHASE
  ──────────────

  Full Document
       │
       ▼
  ┌─────────────────────────────────────┐
  │          Chunk Document             │
  │  (split into semantic chunks)       │
  └──────────────────┬──────────────────┘
                     │
          ┌──────────┴──────────┐
          │  For each chunk...  │
          ▼                     ▼
  ┌───────────────┐    ┌────────────────────────────┐
  │  Raw Chunk    │    │  Full Document + Chunk      │
  │               │───▶│         ↓                   │
  │  "The Admin   │    │  LLM generates context:     │
  │   shall       │    │  "This chunk is from        │
  │   submit a    │    │   Section 403(b) of the     │
  │   report      │    │   Clean Air Act, Title IV,  │
  │   within      │    │   covering administrative   │
  │   30 days"    │    │   reporting requirements."  │
  │               │    └─────────────┬──────────────┘
  └───────────────┘                  │
                                     ▼
                     ┌───────────────────────────────┐
                     │     Contextualized Chunk       │
                     │  "Section 403(b), Clean Air    │
                     │   Act, Title IV, admin         │
                     │   reporting. The Admin shall   │
                     │   submit a report within       │
                     │   30 days"                     │
                     └───────────────┬───────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                  │
                    ▼                                  ▼
          ┌─────────────────┐              ┌─────────────────┐
          │  Embed (dense)  │              │  Index (BM25)   │
          │  via model      │              │  keyword index  │
          └────────┬────────┘              └────────┬────────┘
                   │                                │
                   ▼                                ▼
          ┌─────────────────┐              ┌─────────────────┐
          │  Vector Index   │              │  BM25 Index     │
          │  (semantic)     │              │  (lexical)      │
          └─────────────────┘              └─────────────────┘


  QUERY PHASE
  ───────────

  User Query: "What are the reporting requirements?"
       │
       ├──────────────────────────────┐
       │                              │
       ▼                              ▼
  ┌──────────────┐           ┌──────────────┐
  │ Vector Search│           │ BM25 Search  │
  │ (semantic    │           │ (keyword     │
  │  similarity) │           │  matching)   │
  └──────┬───────┘           └──────┬───────┘
         │                          │
         │  rank_1, rank_2, ...     │  rank_1, rank_2, ...
         │                          │
         └────────────┬─────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │  Reciprocal Rank       │
         │  Fusion (RRF)          │
         │                        │
         │  score(d) = Σ 1/(k+r)  │
         │  where k=60, r=rank    │
         │                        │
         │  Merges both result    │
         │  sets into one ranked  │
         │  list                  │
         └───────────┬────────────┘
                     │
                     ▼
         ┌────────────────────────┐
         │  Reranker (optional)   │
         │  Re-scores top-N       │
         │  for final ordering    │
         └───────────┬────────────┘
                     │
                     ▼
         ┌────────────────────────┐
         │  Top-K chunks → LLM   │
         │  for generation        │
         └────────────────────────┘
```

This is the key thing most people miss: **it's not just contextual embeddings.** The real power comes from the hybrid approach — vector search catches the semantic intent ("reporting requirements") while BM25 catches the exact terms ("Section 403(b)"). RRF merges both ranked lists so you get the best of both worlds without having to tune a linear combination weight.

### The Numbers

The results are anything but simple:

| Technique                            | Failure Rate | Reduction |
| ------------------------------------ | ------------ | --------- |
| Baseline (naive RAG)                 | 5.7%         | —         |
| + Contextual Embeddings              | 3.7%         | **-35%**  |
| + Contextual Embeddings + BM25 (RRF) | 2.9%         | **-49%**  |
| + All of the above + Reranking       | 1.9%         | **-67%**  |

From 5.7% down to 1.9%. That's not a typo — **a 67% reduction in retrieval failures** just by preserving context and combining search modalities. And the cost? Roughly a dollar per million document tokens with prompt caching. In a world where a single hallucinated legal citation can cost a business real money, that's essentially free.

What struck me wasn't just the effectiveness — it was the _simplicity_. No graph construction. No elaborate multi-agent retrieval choreography. Just: understand your document's structure, preserve it through the chunking process, use both vector AND keyword search, and let the fusion algorithm sort it out.

## From Insight to Implementation: The Hierarchical Document Tool

This blog post became the direct inspiration for a new tool I'm building in [HoloDeck](https://github.com/justinbarias/holodeck), my open-source agent experimentation platform. I call it the **Hierarchical Document Tool**, and it takes Anthropic's approach and pushes it further — specifically for the kind of deeply structured documents I deal with at work.

The problem I'm solving is legislative analysis. We're talking about statutes, regulations, and policy documents that are 800 to 1,000 pages long, with intricate hierarchical structure: Titles, Chapters, Sections, Subsections, Paragraphs, Subparagraphs. A single piece of analysis might span multiple such documents. Getting retrieval wrong isn't just annoying — it means an agent cites the wrong section of law, or misses a critical cross-reference.

Here's where the Hierarchical Document Tool goes beyond what Anthropic described:

### Structure-aware chunking

Instead of blindly splitting on token count, the tool parses markdown (converted from any source format) and chunks along structural boundaries. Every chunk retains its full parent chain as metadata:

```json
["Title I", "Chapter 2", "Section 203", "Subsection (a)", "Paragraph (1)"]
```

When a chunk is retrieved, you know _exactly_ where it lives in the document hierarchy. No more "this chunk mentions a 30-day deadline but I have no idea which part of which law it came from."

### Contextual embeddings via LLM

Following Anthropic's approach, each chunk is sent through a lightweight LLM call (Claude Haiku or anything with a large enough context window) that generates a 50–100 token context preamble from the full document and the chunk's structural location. A chunk like _"The Administrator shall submit a report within 90 days"_ gets prepended with something like: _"This chunk is from Section 203 of the Environmental Protection Act, Title IV, Chapter 2, which covers administrative reporting requirements for regulated entities."_

The contextualized text — preamble plus original chunk — is what gets embedded and indexed. The whole context generation pipeline for a 100-page document costs roughly **$0.03** with prompt caching, runs 10 chunks concurrently, and falls back gracefully to raw chunks if the LLM call fails. Three cents. For a hundred pages. I'll take that trade every time.

### Hybrid search with tiered keyword strategy

This is where it gets fun. The tool maintains **three** parallel indices: dense (embedding) for semantic search, sparse (BM25) for keyword search, and exact match for precise lookups like section numbers (to be built).

What makes this interesting is the keyword search layer. Not every vector store supports native hybrid search, so the tool uses a tiered strategy:

- **Tier 1 — Native hybrid**: If your provider supports it (Azure AI Search, Weaviate, Qdrant), use the built-in hybrid capabilities
- **Tier 2 — OpenSearch**: Route to an OpenSearch endpoint for production-grade BM25
- **Tier 3 — In-memory BM25**: Fall back to an in-memory index for development and testing

All three search modalities run in parallel and merge via Reciprocal Rank Fusion (`score(d) = sum of weight_i / (k + rank_i)`, with k=60 by default) with configurable weights.

And because RRF is rank-based, it doesn't require score normalization across different search engines. The best BM25 result gets a big boost even if its raw score is on a different scale than the embedding similarity. This means you can tune the weights to favor precision (keyword) or recall (semantic) without worrying about score calibration.

When someone searches for "Section 403(b)(2)", the exact match index catches it instantly. When they search for "What are the environmental reporting requirements?", the semantic index handles it. In practice, most queries benefit from all three.

### Reranking: the final 18% that matters

Look at Anthropic's numbers again. Contextual embeddings + BM25 gets you from 5.7% to 2.9% — a 49% reduction. But adding a reranker on top pushes that to 1.9% — another 18 percentage points of improvement. That last mile matters a _lot_ when you're working with legal text where "close enough" isn't.

Here's what reranking actually does: after RRF merges your vector and keyword results into a single ranked list, you take the top N candidates (say, 30) and pass them through a cross-encoder model that scores each candidate _in the context of the original query_. Unlike embedding similarity — which compares pre-computed vectors — a cross-encoder sees the query and the document chunk together, which lets it catch nuances that embedding distance misses.

The trade-off is latency. Cross-encoders are slower because they can't pre-compute anything — every query-document pair needs a forward pass. But we're talking about scoring 20–30 candidates, not your entire corpus. In practice, that's under 500ms, which is plenty fast for most use cases.

Reranking isn't in HoloDeck yet — it's next on the roadmap. But I've already designed it as an opt-in extension for vectorstore tools, and the plan supports two providers:

- **Cohere Rerank API** — cloud-hosted, fast, no infrastructure to manage. Great for getting started
- **vLLM** — self-hosted reranking models for teams with data privacy requirements or who want to run open-source cross-encoders. vLLM exposes a Cohere-compatible `/v1/rerank` endpoint, so the same client code works for both

The config will be dead simple. Add `rerank: true` to any vectorstore tool and you're done:

```yaml
tools:
  - name: knowledge_search
    type: vectorstore
    config:
      index: product-docs
    rerank: true
    reranker:
      provider: cohere
      model: rerank-english-v3.0
      api_key: ${COHERE_API_KEY}
```

A few things I'm particularly happy with in the design so far:

- **Candidate pool sizing**: By default, the reranker gets `top_k * 3` candidates. If you're returning 10 results, the system fetches 30 from the initial search, reranks all 30, then returns the top 10. More candidates = better reranking quality, at the cost of slightly more latency. You can tune `rerank_top_n` directly if you want to dial this in
- **Graceful fallback**: If the reranker fails (network timeout, rate limit, service down), the system silently falls back to the original ranked results and logs a warning. Your search doesn't break just because the reranker had a bad day. Configuration errors like bad API keys still fail fast though — you want to know about those immediately, not discover them at 2am
- **Zero breaking changes**: Existing vectorstore configs without `rerank: true` work exactly as before. The whole thing is opt-in

### Definition and cross-reference extraction

Legal and regulatory documents are _riddled_ with defined terms ("_Administrator_ means the Administrator of the Environmental Protection Agency") and cross-references ("as described in Section 201(a)(1)(b)"). If you've ever tried to read legislation, you know the pain — half the document is just pointing at other parts of the document.

The tool detects definitions sections and extracts them into a separate, always-available reference. Cross-references are identified and stored so agents can navigate related sections.

This is still evolving — planned improvements include explicit tools that let agents look up term definitions on demand and resolve section cross-references directly (more on this in the agentic shift section below).

### The YAML

And because HoloDeck is a no-code agent platform, all of this is configured through YAML:

```yaml
tools:
  - name: legislative_search
    type: hierarchical_document
    source: ./regulations
    contextual_embeddings: true
    context_model:
      provider: azure_openai
      name: gpt-5-mini # use a cheap, fast model but with a large context window
      temperature: 0.0
    context_max_tokens: 100
    context_concurrency: 10
    chunking_strategy: structure
    max_chunk_tokens: 800
    semantic_weight: 0.5
    keyword_weight: 0.3
    exact_weight: 0.2
    # rerank: true          # coming soon
    # reranker:
    #   provider: cohere
    #   model: rerank-english-v3.0
```

One YAML block. Structure-aware chunking, contextual embeddings with a cheap LLM, triple-index hybrid search — and reranking once that lands. No Python required. I'm pretty happy with how this turned out.

## Don't Forget Structured Data

While we're on the topic of retrieval, there's another blind spot in the "RAG everything" approach that nobody talks about: **structured data**.

Most enterprise RAG discussions focus exclusively on unstructured content — PDFs, Word docs, policy manuals. But organisations sit on mountains of structured data in CSVs, JSON feeds, databases, and APIs. An agent doing legislative analysis might need to cross-reference a regulation with a structured dataset of enforcement actions, compliance filings, or budget allocations.

Any serious RAG strategy needs to account for both:

- **Unstructured content** → chunking-embedding-retrieval pipeline
- **Structured data** → query interfaces (SQL, API calls, structured search)

Treating everything as "documents to embed" is how you end up with a chatbot that can vaguely summarise a spreadsheet but can't tell you the exact value in row 47. Don't be that team.

## The Agentic Shift

Meanwhile, the landscape is shifting under our feet. Tools like Claude Code, OpenAI Codex, and others are introducing sophisticated agentic workflows where the AI doesn't just retrieve — it _reasons about what to retrieve, how to retrieve it, and what to do with the results_.

I wrote about this in a previous post, [Agentic Memory: Bash + File System Is All You Need](https://justinbarias.io/blog/agentic-memory-filesystem-part-1/), exploring how advanced memory management for agents can be as simple as reading and writing files. The same principle applies to retrieval: the most effective systems aren't the ones with the most exotic retrieval algorithm. They're the ones where the agent has the right tools — lookup a definition, navigate to a section, search by keyword, search by concept — and the judgment to use them appropriately.

This is why I'm building the Hierarchical Document Tool as a _toolkit_, not a monolithic search endpoint. Today the tool exposes hybrid search with structure-aware results. But the roadmap includes giving agents explicit primitives:

- A **definition lookup tool** so the agent can resolve defined terms on demand ("What does 'Administrator' mean in this Act?")
- A **section navigation tool** that lets agents traverse the document hierarchy directly ("Go to Title 1, Chapter 3, Section 201(a)(1)(b)")

Instead of one big search call, the agent gets the building blocks to reason about information retrieval the way a human researcher would — look up a term, follow a cross-reference, search semantically, then search by keyword to confirm. That's the real unlock.

## The Problem That Was Never Solved

Here's what I keep coming back to: **information retrieval is a decades-old problem, and we haven't solved it.** We've just been cycling through new implementations of the same fundamental challenge.

Before LLMs, we had TF-IDF, BM25, latent semantic analysis, learning-to-rank. These techniques powered search engines that actually worked, that billions of people relied on daily. Then the LLM wave hit, and somehow the industry collectively decided to replace all of that hard-won information retrieval knowledge with "just embed everything and do cosine similarity."

That was never going to be enough. Embeddings are powerful for capturing semantic similarity, but they're terrible at exact matching, structured lookups, and preserving document hierarchy. BM25 is excellent at keyword precision but misses conceptual relationships. The answer — as Anthropic demonstrated with the hybrid pipeline above — is to combine them thoughtfully. And to respect the structure of the documents you're working with.

The organisations I see struggling with RAG aren't struggling because the technology is bad. They're struggling because they skipped the boring parts: understanding their document structures, building proper indexing pipelines, implementing hybrid search, testing retrieval quality independently from generation quality. They jumped straight to the chatbot demo and wondered why it hallucinated.

## RAG Isn't Dead. We Just Never Did It Right.

The hype cycle wants to move on. Context windows are growing. Some argue we'll eventually just stuff everything into the prompt. Maybe. But for the foreseeable future — for the 800-page statutes, the multi-document regulatory analyses, the enterprise knowledge bases with tens of thousands of documents — retrieval is still the bottleneck, and getting it right still matters enormously.

Anthropic's contextual retrieval technique isn't magic. It's just good engineering: understand what information is lost in your pipeline, and put it back. Combine vector and keyword search with RRF instead of betting everything on embeddings. Add a reranker if you can. The Hierarchical Document Tool I'm building takes that same philosophy and extends it to deeply structured documents where _position in the hierarchy is meaning itself_.

RAG had promise. It still does. But it's time we stopped treating information retrieval as a solved problem that just needs a vector database, and started treating it as the hard, nuanced, domain-specific engineering challenge it's always been.

The shiny new thing will always be tempting. But sometimes the biggest gains come from going back and doing the old thing properly.

---

_This post is part of a series on building AI agent tooling. Read my previous post on [Agentic Memory: Bash + File System Is All You Need](https://justinbarias.io/blog/agentic-memory-filesystem-part-1/) for more on the patterns I'm implementing in HoloDeck._
