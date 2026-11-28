---
title: "Temporal Knowledge Graphs in HoloDeck, Part 2: Auditing a Graph That Rewrites History"
slug: holodeck-temporal-memory-part2
publishDate: 23 Nov 2026
description: "The experiment log behind HoloDeck's temporal memory tool. Eleven experiments on two compilations of an Australian Act: why Graphiti closed 38 facts the law never changed, what reasoning effort, an ontology and a text-diff closure check each fixed, and what a hostile reviewer still found."
---

<style>
/* Post-local styles: used only by this post's figures */
/* SVG chart base (same as agent-substrate-material-risk) */
.chart { width: 100%; height: auto; display: block; }
.chart text { fill: var(--muted); font-family: var(--font-mono); font-size: 11px; }
.chart .axis { stroke: var(--rule); stroke-width: 1; }
.chart .grid { stroke: var(--rule); stroke-width: 1; stroke-dasharray: 2 4; opacity: 0.7; }
.chart .lbl { fill: var(--fg-dim); }
.chart-legend { display: flex; gap: 1.3rem; flex-wrap: wrap; margin: 0.7rem 0 0; font-family: var(--font-mono); font-size: 0.72rem; color: var(--fg-dim); }
.chart-legend span { display: inline-flex; align-items: center; }
p code, li code { overflow-wrap: anywhere; }
.chart-legend i { display: inline-block; width: 15px; height: 3px; margin-right: 0.45rem; border-radius: 2px; }
.chart .bar-a { fill: var(--accent); }
.chart .bar-h { fill: var(--hot); }
.chart .bar-m { fill: var(--muted); opacity: 0.55; }
.chart .big { fill: var(--fg); font-size: 12px; }
.chart .on { fill: var(--bg); font-weight: 600; }
.chart .box { fill: var(--bg-soft); stroke: var(--rule); stroke-width: 1; }
.chart .box-you { fill: var(--bg-soft); stroke: var(--accent); stroke-width: 1.5; }
.chart .box-ext { fill: none; stroke: var(--rule); stroke-width: 1; stroke-dasharray: 4 3; }
.chart .ttl { fill: var(--fg); font-size: 12px; font-weight: 600; }
.chart .acc { fill: var(--accent); }
.chart .hot { fill: var(--hot); }
.chart .wire { stroke: var(--muted); stroke-width: 1.2; fill: none; }
.chart .wire-h { stroke: var(--hot); stroke-width: 1.5; fill: none; }

.grid3 { display: grid; grid-template-columns: 0.9fr 1.5fr 1.5fr; border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; font-size: 0.84rem; }
.grid3 > div { padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--rule); color: var(--fg-dim); line-height: 1.45; }
.grid3 > .h { font-family: var(--font-mono); font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); background: var(--bg-soft); }
.grid3 > .n { color: var(--fg); font-weight: 600; }
.grid3 > .is-hot { color: var(--hot); }
.grid3 > div:nth-last-child(-n+3) { border-bottom: 0; }

.runs { display: grid; grid-template-columns: 1.6fr repeat(4, 1fr); border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; font-size: 0.84rem; }
.runs > div { padding: 0.5rem 0.65rem; border-bottom: 1px solid var(--rule); color: var(--fg-dim); }
.runs > .h { font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); background: var(--bg-soft); }
.runs > .v { font-family: var(--font-mono); color: var(--fg); text-align: right; }
.runs > .v.good { color: var(--accent); }
.runs > .v.hot { color: var(--hot); }
.runs > div:nth-last-child(-n+5) { border-bottom: 0; }

.qa { display: flex; flex-direction: column; gap: 0.45rem; }
.qa-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; border: 1px solid var(--rule); border-radius: var(--radius); background: var(--bg-soft); padding: 0.55rem 0.9rem; }
.qa-q { font-size: 0.9rem; color: var(--fg); font-family: var(--font-mono); }
.tag { flex: none; font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.04em; text-transform: uppercase; padding: 0.12em 0.55em; border-radius: 999px; border: 1px solid var(--rule); color: var(--fg-dim); }
.tag.is-good { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 50%, transparent); }
.tag.is-hot { color: var(--hot); border-color: color-mix(in srgb, var(--hot) 50%, transparent); }
.tag.is-warn { color: var(--accent-2); border-color: color-mix(in srgb, var(--accent-2) 50%, transparent); }

.edges { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
.edge-card { border: 1px solid var(--rule); border-radius: var(--radius); background: var(--bg-soft); padding: 0.9rem 1rem; }
.edge-card h4 { margin: 0 0 0.5rem; font-family: var(--font-mono); font-size: 0.7rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); }
.edge-card h4.is-hot { color: var(--hot); }
.edge-line { font-family: var(--font-mono); font-size: 0.8rem; color: var(--fg); margin: 0.3rem 0; }
.edge-line .rel { color: var(--accent-2); }
.edge-card p { margin: 0.55rem 0 0 !important; font-size: 0.86rem; color: var(--fg-dim); line-height: 1.5; }

.phase { font-family: var(--font-mono); font-size: 0.68rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin: 2.6rem 0 -0.6rem; }

@media (max-width: 600px) {
  .grid3, .runs { font-size: 0.76rem; }
  .grid3 { grid-template-columns: 1fr 1.4fr 1.4fr; }
  .edges { grid-template-columns: 1fr; }
  .qa-row { flex-direction: column; align-items: flex-start; gap: 0.4rem; }
}
</style>

## Table of Contents
- [The question and the corpus](#the-question-and-the-corpus)
- [How the tool is built](#how-the-tool-is-built)
- **Find the problem**
  - [Experiment 1: the full ingest](#experiment-1-the-full-ingest)
  - [Experiment 2: auditing every closure](#experiment-2-auditing-every-closure)
  - [Why Graphiti closes the wrong facts](#why-graphiti-closes-the-wrong-facts)
  - [Experiment 3: facts with no start date](#experiment-3-facts-with-no-start-date)
- **Improve the judge**
  - [Experiment 4: a stricter prompt](#experiment-4-a-stricter-prompt)
  - [Experiment 5: embedding similarity](#experiment-5-embedding-similarity)
  - [Experiment 7: reasoning effort](#experiment-7-reasoning-effort)
  - [Experiment 10: a decision model as judge](#experiment-10-a-decision-model-as-judge)
- **Improve the input**
  - [Experiment 8: ontology and a replacement guard](#experiment-8-ontology-and-a-replacement-guard)
  - [The full ingest: the ontology followed the Act's structure](#the-full-ingest-the-ontology-followed-the-acts-structure)
- **Use the text diff**
  - [Experiments 6 and 9: closing facts from the text diff](#experiments-6-and-9-closing-facts-from-the-text-diff)
- **Adversarial review**
  - [Experiment 11: an adversarial code review](#experiment-11-an-adversarial-code-review)
- [Next experiment: a domain-shaped ontology](#next-experiment-a-domain-shaped-ontology)
- [Where it stands](#where-it-stands)
- [Lessons that generalise](#lessons-that-generalise)

[Part 1](/blog/holodeck-temporal-memory-part1) explained why HoloDeck now has a temporal knowledge graph and gave the short version of the results. This part is the experiment log. I grouped the eleven experiments by what each one tried to fix. The experiment numbers keep the original run order.

## The question and the corpus

The question: when the 2026 compilation of an Act is ingested after the 2020 one, does the graph close exactly the facts that changed, and leave every other fact open?

The corpus: the *A New Tax System (Family Assistance) Act 1999* at compilation 101 (in force 1 July 2020) and compilation 124 (in force 1 July 2026). About 100,000 words each, from the Federal Register of Legislation, converted to markdown with one chunk per section. Every experiment starts from the baseline below and changes one knob.

<figure class="art"><div class="grid3">
<div class="h">Knob</div><div class="h">Baseline</div><div class="h">Note</div>
<div class="n">Graphiti</div><div>graphiti-core 0.31.2</div><div><code>add_episode</code> per chunk</div>
<div class="n">Stores</div><div>Neo4j 5.26, Qdrant 1.20</div><div>Graph in Neo4j, chunks in Qdrant</div>
<div class="n">Model</div><div>OpenAI gpt-6-luna</div><div>Extraction, judge and the agent</div>
<div class="n">Reasoning</div><div>Graphiti default <code>auto</code></div><div class="is-hot">Resolves to <code>none</code> (experiment 7)</div>
<div class="n">Embeddings</div><div>text-embedding-3-small</div><div>Local Ollama failed at corpus scale</div>
<div class="n">Entity types</div><div>6 names, no descriptions</div><div>No edge types: relations free-form</div>
<div class="n">Effective date</div><div>Front-matter <code>effective_date</code></div><div>Becomes each episode's reference time</div>
<div class="n">Episode id</div><div>Hash of namespace + section + text</div><div>Identical chunks are skipped</div>
</div></figure>

## How the tool is built

HoloDeck keeps its own rules in a service and talks to Graphiti through one port, `MemoryBackend`. The fact store can be replaced without touching the tools, the CLI or the workflows.

<figure class="art"><svg class="chart" viewBox="0 0 640 330" role="img" aria-label="Architecture: agent tools call the HoloDeck memory service, which reads chunks through ChunkSource from hierarchical document tools and writes facts through the MemoryBackend port to the Graphiti adapter and Neo4j">
<rect class="box" x="150" y="14" width="340" height="44" rx="6"></rect>
<text class="ttl" x="320" y="34" text-anchor="middle">Agent tools</text>
<text x="320" y="50" text-anchor="middle">memory_search · memory_timeline · memory_provenance</text>
<path class="wire" d="M320 58 V82"></path>
<rect class="box-you" x="110" y="82" width="420" height="78" rx="6"></rect>
<text class="ttl" x="320" y="102" text-anchor="middle">HoloDeck memory service</text>
<text x="320" y="120" text-anchor="middle">effective dates · content-hash episodes · ingest order</text>
<text x="320" y="136" text-anchor="middle">bi-temporal search rule · fusion with passages</text>
<text class="acc" x="320" y="152" text-anchor="middle">closure check (text diff, guard)</text>
<path class="wire" d="M200 160 V192"></path><path class="wire" d="M440 160 V192"></path>
<rect class="box" x="60" y="192" width="230" height="40" rx="6"></rect>
<text class="ttl" x="175" y="210" text-anchor="middle">ChunkSource</text><text x="175" y="225" text-anchor="middle">reads chunks and passage hits</text>
<rect class="box" x="350" y="192" width="230" height="40" rx="6"></rect>
<text class="ttl" x="465" y="210" text-anchor="middle">MemoryBackend port</text><text x="465" y="225" text-anchor="middle">ingest · search · timeline · purge</text>
<path class="wire" d="M175 232 V262"></path><path class="wire" d="M465 232 V262"></path>
<rect class="box-ext" x="60" y="262" width="230" height="52" rx="6"></rect>
<text class="ttl" x="175" y="282" text-anchor="middle">hierarchical_document tools</text><text x="175" y="298" text-anchor="middle">Qdrant: hybrid BM25 + vector</text>
<rect class="box-ext" x="350" y="262" width="230" height="52" rx="6"></rect>
<text class="ttl" x="465" y="282" text-anchor="middle">Graphiti adapter</text><text x="465" y="298" text-anchor="middle">add_episode → Neo4j</text>
</svg></figure>

Graphiti extracts facts and closes old ones inside one `add_episode` call. So every fix in this log runs after that call returns.

A fact is an edge between two entities. To close a fact, the store stamps two dates on that edge. The search rule follows from the two timelines. A fact is returned for valid time `V` and known time `K` when:

```text
created_at <= K
and (valid_at <= V or valid_at is null)
and (invalid_at is null or invalid_at > V or expired_at > K)
```

The last clause handles questions about the past. If a fact was open at `K`, search returns it, even if a later ingest closed it. Graphiti's filters cannot express that OR across two fields, so the backend runs two filtered searches and merges them. Search merges results in two steps. Graphiti merges keyword, vector and graph-walk results, then HoloDeck merges those facts with document passages. Neither step calls an LLM.

<p class="phase">Find the problem</p>

## Experiment 1: the full ingest

The baseline ingest of both compilations, run one episode at a time:

<figure class="art"><div class="metric-grid">
<div class="metric"><div class="metric-num">74<span class="metric-unit">min</span></div><p class="metric-label">Wall time</p></div>
<div class="metric"><div class="metric-num">3,111</div><p class="metric-label">LLM calls</p></div>
<div class="metric"><div class="metric-num">6.35<span class="metric-unit">M</span></div><p class="metric-label">Input tokens</p></div>
<div class="metric"><div class="metric-num">1,463</div><p class="metric-label">Facts</p></div>
<div class="metric"><div class="metric-num">1,015</div><p class="metric-label">Entities</p></div>
<div class="metric"><div class="metric-num">80</div><p class="metric-label">Facts closed</p></div>
</div></figure>

The 663 chunks gave 418 episodes. 243 chunks were skipped as identical, so only the 93 changed sections needed model calls the second time.

Each episode runs Graphiti's pipeline. Step 4 is the one this log is about, and HoloDeck overrides its prompt.

<figure class="art"><div class="flow">
<div class="flow-step"><div class="flow-num">1</div><h4>Extract entities</h4><p><code>extract_nodes.extract_text</code></p></div>
<div class="flow-step"><div class="flow-num">2</div><h4>Deduplicate entities</h4><p><code>dedupe_nodes.nodes</code></p></div>
<div class="flow-step"><div class="flow-num">3</div><h4>Extract facts</h4><p><code>extract_edges.edge</code></p></div>
<div class="flow-step"><div class="flow-num">4</div><h4>Resolve each new fact</h4><p><code>dedupe_edges.resolve_edge</code>, one call per fact</p><span class="flow-out">→ facts get closed here</span></div>
<div class="flow-step"><div class="flow-num">5</div><h4>Attributes and summaries</h4></div>
</div></figure>

## Experiment 2: auditing every closure

The 80 closed facts split three ways: 11 had end dates written into the Act itself, 6 were closed at 1 July 2020 by the 2026 text, and **63 were 2020 facts closed at 1 July 2026**. Those 63 are the cases this experiment tests.

For each one, a script found three things: the source section, the 2026 episode that closed it, and whether the wording still appeared in 2026. Then I checked every verdict by hand against the two compilations.

<figure class="art"><svg class="chart" viewBox="0 0 640 86" role="img" aria-label="22 real changes, 38 false closures, 3 unclear">
<rect class="bar-a" x="20" y="20" width="211" height="34" rx="3"></rect>
<rect class="bar-h" x="233" y="20" width="365" height="34" rx="3"></rect>
<rect class="bar-m" x="600" y="20" width="29" height="34" rx="3"></rect>
<text class="big on" x="30" y="42">22 real change</text><text class="big on" x="243" y="42">38 false closure</text>
<text x="618" y="76" text-anchor="end">3 unclear</text>
</svg></figure>

A real change was, for example, the Human Services Secretary definition. A false closure was, for example, the visa subclass 117 exclusion in 61AA, which did not change. A first pass by phrase search said 41 were false. A line-by-line diff relabelled four of them as real.

Two mechanisms produced the false closures.

<figure class="art"><div class="edges">
<div class="edge-card"><h4 class="is-hot">1 · Restated with different entities</h4>
<div class="edge-line">2020: 61AA <span class="rel">─excludes→</span> Subclass 117 visa</div>
<div class="edge-line">2026: Subclass 117 visa <span class="rel">─under→</span> Migration Act 1958</div>
<p>New entities, so not a duplicate</p></div>
<div class="edge-card"><h4 class="is-hot">2 · Closed by another section</h4>
<div class="edge-line">A definitions chunk</div>
<div class="edge-line">→ closes 3 facts about unchanged 3AA</div>
<p>About 15 closures like this</p></div>
</div></figure>

In the first, one changed line makes the whole section a new chunk, and the model links the restated facts to new entities. Graphiti only calls a fact a duplicate when it joins the same two entities, so the old fact can only be "contradicted". In the second, section 3AA was the same in both years, so its 2026 chunk was skipped and nothing restated its facts. They disappear from 1 July 2026.

For "what is the rule today?" a reworded copy often survives. For "what changed on 1 July 2026?" every false closure is a change that never happened.

## Why Graphiti closes the wrong facts

This is a known, open design gap in Graphiti. Other users report it on other corpora. From `utils/maintenance/edge_operations.py` in 0.31.2:

```text
for each new fact:
  duplicates  = edges between the SAME two entities        -> may be marked "duplicate"
  candidates  = top 10 of a BM25 + vector search over the WHOLE namespace,
                no filter, minus the same-pair edges        -> may only be marked "contradicted"
  the judge sees bare fact sentences: no dates, no source, no section
  a contradicted candidate that started earlier -> invalid_at = new fact's start date
```

A reworded copy of a fact is the most similar thing in the graph. It lands in the top 10 almost every time, and it can never count as a duplicate.

The [Zep paper](https://arxiv.org/abs/2501.13956) limits fact deduplication to the same entity pair and checks contradictions against "semantically related" edges without defining them. It evaluates on chat data only. Versioned documents re-extract unchanged text. Chat data rarely does that.

<figure class="art"><div class="refs"><h4>Graphiti tracker, all open on 12 Nov 2026</h4><ul>
<li><b><a href="https://github.com/getzep/graphiti/issues/1728">#1728</a></b>: whole-graph invalidation, 41% of facts closed</li>
<li><b><a href="https://github.com/getzep/graphiti/pull/1729">#1729</a></b>: replacement guard, not merged</li>
<li><b><a href="https://github.com/getzep/graphiti/pull/1772">#1772</a></b>: index range fix, not merged</li>
<li><b><a href="https://github.com/getzep/graphiti/issues/1666">#1666</a></b>: non-reasoning judges fail, 7/15 → 14/15 with reasoning</li>
<li><b><a href="https://github.com/getzep/graphiti/issues/1956">#1956</a></b>: current fact missed after about 10 past values</li>
<li><b><a href="https://github.com/getzep/graphiti/issues/1880">#1880</a></b>: validation hook proposal, not built</li>
</ul></div></figure>

Graphiti has no hook between its decision and the write. So HoloDeck checks closures after `add_episode` returns, and undoes the ones it cannot justify.

## Experiment 3: facts with no start date

**276 of 1,463 facts (19%) had no start date.** Graphiti leaves `valid_at` empty when the model gives no date, even though the episode carries one. An empty start reads as "from the beginning of time", so 78 facts first read from 2026 showed up in an "as of 2021" query. And Graphiti will not close a fact unless both facts have a start date, so undated facts can never be superseded.

The fix: after each episode, an undated fact takes the earliest effective date of the episodes it was read from.

```cypher
MATCH ()-[r:RELATES_TO]->()
WHERE r.group_id = $group_id AND r.valid_at IS NULL AND $uuid IN r.episodes
UNWIND r.episodes AS episode_uuid
OPTIONAL MATCH (ep:Episodic {uuid: episode_uuid}) WHERE ep.group_id = $group_id
WITH r, min(ep.valid_at) AS first_seen
SET r.valid_at = coalesce(first_seen, $reference_time)
```

A dry run predicted 198 facts dated 2020 and 78 dated 2026. The backfill dated exactly 276. The trade-off: dated facts can be closed, so more facts are exposed to the false closures above.

<p class="phase">Improve the judge</p>

## Experiment 4: a stricter prompt

Re-ingesting to test a prompt costs about 3,000 calls and an hour. So I built a **replay probe**: it builds the exact `resolve_edge` prompt for an old/new fact pair, calls the model the way Graphiti does, and prints a confusion table. 67 labelled cases (11 hand-written, 56 from the live closures), about one minute per run.

The stricter rewrite demanded a named attribute with two different values before closing anything:

```text
- Mark a fact as contradicted ONLY when you can name ONE single-valued attribute
  of ONE subject, and two DIFFERENT values of it.
- A fact that restates, paraphrases or summarises the same rule is NOT contradicted,
  even when it names different entities.
```

<figure class="art"><div class="runs" style="grid-template-columns:1.6fr repeat(3,1fr)">
<div class="h">Prompt</div><div class="h">Correct</div><div class="h">Wrongly closed</div><div class="h">Missed</div>
<div>Original override</div><div class="v">45 / 67</div><div class="v hot">12</div><div class="v">10</div>
<div>Stricter rewrite</div><div class="v">45 / 67</div><div class="v hot">12</div><div class="v">10</div>
</div></figure>

Both prompts scored the same. Graphiti does not allow "same fact, different entities" as an answer for a candidate, so no wording can fix it.

## Experiment 5: embedding similarity

Every fact already has an embedding. I expected a false closure to have a near-identical open twin in 2026, and a real change to have none.

<figure class="art"><div class="bars">
<div class="bar-row"><div class="bar-head"><b>Cosine ≥ 0.95 to an open 2026 fact</b><span class="bar-val">16 closures: 13 false, 2 unclear, 1 real</span></div><div class="bar-track"><div class="bar-fill is-hot" style="width:81%"></div></div></div>
<div class="bar-row"><div class="bar-head"><b>Below 0.95</b><span class="bar-val">mixed</span></div><div class="bar-track"><div class="bar-fill" style="width:50%;background:var(--muted)"></div></div></div>
</div></figure>

An indexed dollar amount is worded almost exactly like its predecessor. The threshold works as a backstop for identical text, but it is not the main fix.

## Experiment 7: reasoning effort

Graphiti's OpenAI client takes a `reasoning` argument. Its default is `'auto'`, and `'auto'` resolves to `'none'` for GPT-5.1 and every later model. HoloDeck never passed it. So the full ingest, the probes and the live check all ran with **no reasoning at all**.

I ran the 67-case replay at five efforts, one run each. The chart counts facts wrongly closed, out of 42 that must stay open. Overall accuracy is under each bar.

<figure class="art"><svg class="chart" viewBox="0 0 640 250" role="img" aria-label="Facts wrongly closed out of 42 by reasoning effort: none 12, low 8, medium 3, high 6, xhigh 3">
<line class="grid" x1="70" y1="40" x2="610" y2="40"></line><line class="grid" x1="70" y1="96.7" x2="610" y2="96.7"></line><line class="grid" x1="70" y1="153.3" x2="610" y2="153.3"></line>
<line class="axis" x1="70" y1="210" x2="610" y2="210"></line>
<text x="62" y="44" text-anchor="end">12</text><text x="62" y="101" text-anchor="end">8</text><text x="62" y="157" text-anchor="end">4</text><text x="62" y="214" text-anchor="end">0</text>
<rect class="bar-m" x="100" y="40" width="60" height="170" rx="3"></rect>
<rect class="bar-m" x="208" y="96.7" width="60" height="113.3" rx="3"></rect>
<rect class="bar-a" x="316" y="167.5" width="60" height="42.5" rx="3"></rect>
<rect class="bar-m" x="424" y="125" width="60" height="85" rx="3"></rect>
<rect class="bar-m" x="532" y="167.5" width="60" height="42.5" rx="3"></rect>
<text class="big" x="130" y="34" text-anchor="middle">12</text><text class="big" x="238" y="90" text-anchor="middle">8</text><text class="big" x="346" y="161" text-anchor="middle">3</text><text class="big" x="454" y="119" text-anchor="middle">6</text><text class="big" x="562" y="161" text-anchor="middle">3</text>
<text x="130" y="228" text-anchor="middle">none</text><text x="238" y="228" text-anchor="middle">low</text><text class="acc" x="346" y="228" text-anchor="middle">medium</text><text x="454" y="228" text-anchor="middle">high</text><text x="562" y="228" text-anchor="middle">xhigh</text>
<text x="130" y="244" text-anchor="middle">44/67</text><text x="238" y="244" text-anchor="middle">49/67</text><text x="346" y="244" text-anchor="middle">50/67</text><text x="454" y="244" text-anchor="middle">48/67</text><text x="562" y="244" text-anchor="middle">50/67</text>
</svg></figure>

Medium ties xhigh at a lower cost. High against medium suggests about three cases of run-to-run noise.

The missed-real-change count rose slightly with reasoning (11 → 14). That column is the probe's weak point: its live pairs are matched by word overlap, and a careful judge rightly declines a mismatched pair.

## Experiment 10: a decision model as judge

Graphiti 0.31.2 also ships `OpenAIDecisionsClient`. Each candidate becomes its own typed yes/no question with a probability, and its rules say a contradiction "needs explicit evidence that the old fact stopped being true". I sent it the same 67 replay cases and compared it with gpt-6-luna:

<figure class="art"><svg class="chart" viewBox="0 0 640 190" role="img" aria-label="Wrongly closed and missed real changes for four judges">
<text class="lbl" x="250" y="20">Wrongly closed (of 42)</text><text class="lbl" x="450" y="20">Missed (of 25)</text>
<text x="20" y="52">luna, reasoning none</text><rect class="bar-h" x="250" y="40" width="54" height="16" rx="2"></rect><text class="big" x="310" y="53">12</text><rect class="bar-m" x="450" y="40" width="79" height="16" rx="2"></rect><text class="big" x="535" y="53">11</text>
<text x="20" y="92">luna, reasoning medium</text><rect class="bar-h" x="250" y="80" width="14" height="16" rx="2"></rect><text class="big" x="270" y="93">3</text><rect class="bar-m" x="450" y="80" width="101" height="16" rx="2"></rect><text class="big" x="557" y="93">14</text>
<text x="20" y="132">Decisions, P ≥ 0.8</text><rect class="bar-h" x="250" y="120" width="5" height="16" rx="2"></rect><text class="big" x="261" y="133">1</text><rect class="bar-m" x="450" y="120" width="173" height="16" rx="2"></rect><text class="big" x="600" y="133" text-anchor="end">24</text>
<text x="20" y="172">Decisions, P ≥ 0.5</text><rect class="bar-h" x="250" y="160" width="9" height="16" rx="2"></rect><text class="big" x="265" y="173">2</text><rect class="bar-m" x="450" y="160" width="166" height="16" rx="2"></rect><text class="big" x="600" y="173" text-anchor="end">23</text>
</svg></figure>

It was the best guard against false closures that we tested, and it almost never found a real change. 18 of the 25 real changes scored a contradiction probability of exactly 0. Take "From 1 July 2020 the base rate is 100 dollars per week" against "From 1 July 2022 … 120 dollars per week". Asked "can both be true?", a model that reads the dates says yes: one held from 2020 to 2022, the other from 2022. Graphiti uses "contradicted" to mean "this replaces that". So a judge that asks "can both be true?" almost never closes a fact.

<p class="phase">Improve the input</p>

## Experiment 8: ontology and a replacement guard

The baseline graph had **672 distinct relation names** across 1,463 facts, and 104 entities that fit no type. The model chose new entities and relation names each time it read a section. That is mechanism 1 of experiment 2.

<figure class="art"><div class="qa">
<div class="qa-row"><span class="qa-q">A restated fact gets new entities and is closed</span><span class="tag is-good">mostly fixed</span></div>
<div class="qa-row"><span class="qa-q">An unrelated section's fact is closed</span><span class="tag is-warn">partly</span></div>
<div class="qa-row"><span class="qa-q">A real change is missed</span><span class="tag is-warn">partly</span></div>
<div class="qa-row"><span class="qa-q">A fact is never extracted</span><span class="tag is-hot">no</span></div>
<div class="qa-row"><span class="qa-q">The judge errs</span><span class="tag is-hot">no</span></div>
</div></figure>

A typed edge such as `EXCLUDES(Section → Visa)` puts both reads on the same pair, so Graphiti's duplicate path handles the restatement.

The first ontology for the Act, as it ships in the sample `agent.yaml` today. The full ingest later showed a problem with it (see [the next section](#the-full-ingest-the-ontology-followed-the-acts-structure)):

```yaml
schema_hints:
  entity_types:
    - {name: Section,     description: "A numbered section, subsection or clause of the Act, such as 61AA or 85CB."}
    - {name: DefinedTerm, description: "A term the Act defines, such as 'income year' or 'Human Services Secretary'."}
    - {name: Payment,     description: "A benefit, payment or subsidy paid under the Act."}
    - {name: Rate,        description: "A rate or amount of a payment."}
    - {name: Threshold,   description: "An income or rent threshold, limit or cap."}
    - {name: Visa,        description: "A visa class or subclass named by the Act."}
    - {name: Office,      description: "A minister, secretary, agency or office holder that exercises a power or duty."}
    - {name: Act,         description: "An Act of Parliament."}
  edge_types:
    - {name: DEFINES,       single_valued: true, attributes: [{name: meaning, type: string}]}
    - {name: HAS_RATE,      single_valued: true, key_attributes: [category],
       attributes: [{name: amount, type: number}, {name: unit, type: string}, {name: category, type: string}]}
    - {name: HAS_THRESHOLD, single_valued: true, key_attributes: [category],
       attributes: [{name: amount, type: number}, {name: category, type: string}]}
    - {name: EXCLUDES}
    - {name: EXERCISED_BY,  single_valued: true}
    - {name: REFERS_TO}
    - {name: APPLIES_TO}
  edge_type_map:
    - {source: Section, target: DefinedTerm, edges: [DEFINES]}
    - {source: Payment, target: Rate,        edges: [HAS_RATE]}
    - {source: Entity,  target: Threshold,   edges: [HAS_THRESHOLD]}
    - {source: Section, target: Visa,        edges: [EXCLUDES]}
    - {source: Entity,  target: Office,      edges: [EXERCISED_BY]}
    - {source: Section, target: Entity,      edges: [REFERS_TO, APPLIES_TO, EXCLUDES]}
```

The guard follows the shape of [#1729](https://github.com/getzep/graphiti/pull/1729). A fact that Graphiti closed stays closed only if the same episode produced a replacement. The replacement must join the same two entities, or share one entity in the same position with the same relation name. Otherwise the guard reopens the fact. With 672 free-form names, the guard matches nothing. With 24 names, it works.

The runs used a five-section corpus (sections 3, 3AA, 57GJ, 61AA and 85CB at both compilations, 11 episodes each), where every change is known. Run A predates the rename fix and the guard.

<figure class="art"><div class="runs">
<div class="h">Measure</div><div class="h">A: none</div><div class="h">B: medium</div><div class="h">C: + ontology</div><div class="h">D: + text close</div>
<div>Facts extracted</div><div class="v">65</div><div class="v">91</div><div class="v">129</div><div class="v">143</div>
<div>Distinct relation names</div><div class="v">40</div><div class="v">51</div><div class="v good">24</div><div class="v">n/a</div>
<div>Restatements merged</div><div class="v hot">4</div><div class="v good">22</div><div class="v">19</div><div class="v">n/a</div>
<div>Closures kept, all real</div><div class="v hot">0</div><div class="v">1</div><div class="v">3</div><div class="v good">12</div>
<div>Changed facts still open</div><div class="v hot">9</div><div class="v">3</div><div class="v hot">8</div><div class="v good">1</div>
<div>LLM calls</div><div class="v">122</div><div class="v">129</div><div class="v">207</div><div class="v">218</div>
<div>Time</div><div class="v">3 min</div><div class="v">6 min</div><div class="v">8 min</div><div class="v">8 min</div>
</div></figure>

No false closure survived in B, C or D.

- Reasoning merged the most restatements: 4 to 22.
- The ontology cut relation names from 51 to 24.
- The ontology cost 60% more calls.
- Missed closures are now the main gap: 8 in run C.

## The full ingest: the ontology followed the Act's structure

On 12 November I ingested both Acts (the Family Assistance Act and the Administration Act) with every fix on: reasoning at medium, this ontology, the guard and text closing. I read these counts from Neo4j near the end of the run, at 832 of about 851 episodes:

<figure class="art"><div class="metric-grid">
<div class="metric"><div class="metric-num">3</div><p class="metric-label">Undated facts (276 before)</p></div>
<div class="metric"><div class="metric-num">7,473</div><p class="metric-label">Facts, about 5× the first run</p></div>
<div class="metric"><div class="metric-num is-hot">72%</div><p class="metric-label">Entities that are Sections</p></div>
<div class="metric"><div class="metric-num is-hot">41%</div><p class="metric-label">Facts that are <code>REFERS_TO</code></p></div>
</div></figure>

Most of the graph described the structure of the Act.

The entity mix was Section 2,137, DefinedTerm 487, Rate 152, Threshold 139, Payment 137, Act 92, Office 46, Visa 19. I split the facts that join two entities by their endpoints, with a Section or Act counted as structure:

<figure class="art"><svg class="chart" viewBox="0 0 640 112" role="img" aria-label="Facts by endpoint type: 37 percent structure to structure, 49 percent structure to domain, 13 percent domain to domain">
<text class="lbl" x="20" y="28">Facts that join two entities, by what sits at each end</text>
<rect class="bar-m" x="20" y="44" width="222" height="34" rx="3"></rect>
<rect class="bar-h" x="244" y="44" width="294" height="34" rx="3"></rect>
<rect class="bar-a" x="540" y="44" width="78" height="34" rx="3"></rect>
<text class="big" x="30" y="66">37% structure → structure</text><text class="big on" x="254" y="66">49% structure → domain</text><text class="big on" x="548" y="66">13%</text>
<text class="acc" x="618" y="100" text-anchor="end">13% domain → domain</text>
</svg></figure>

Only about 1 fact in 8 is purely about the domain. The domain-to-domain facts are good facts. One example: "The individual's base rate is the Part A rate if it is greater than the individual's income and maintenance tested rate." Most other facts connect to Section nodes.

The ontology caused this. `Section` and `Act` were entity types, so every section reference became a node. `REFERS_TO` was an edge type, so every cross-reference became a fact. The extraction instructions framed the text as provisions, so the model attached each rule to its section, and not to the thing the rule is about.

These nodes repeat provenance that the episode already holds. They add noise to search results: a search for "FTB Part A rate" finds Section nodes as often as the rate. And they help explain why each episode made about twice as many model calls as in the first run.

The five-section runs did not show this, because five sections cannot show the shape of a 100,000-word graph. The ontology still did its job in experiment 8: it made two reads of the same rule land on the same entities. But the entities it chose were sections, not domain concepts.

<p class="phase">Use the text diff</p>

## Experiments 6 and 9: closing facts from the text diff

I hold both versions of every section. So instead of asking a model whether two paraphrases contradict, HoloDeck asks the text whether the sentence changed. Each episode carries its section id, number, heading path and the ids of every chunk in its section.

**Experiment 6 (reopen).** After each episode, for every fact Graphiti just closed:

<figure class="art"><div class="flow">
<div class="flow-step"><div class="flow-num">1</div><h4>Closed by an unrelated section?</h4><span class="flow-out">→ reopen</span></div>
<div class="flow-step"><div class="flow-num">2</div><h4>Is every old line still present?</h4><span class="flow-out">→ reopen</span></div>
<div class="flow-step"><div class="flow-num">3</div><h4>Find the fact's own line</h4><p>By word overlap</p></div>
<div class="flow-step"><div class="flow-num">4</div><h4>Is that line gone from the new section?</h4><p>Yes: keep closed. No: reopen.</p></div>
</div></figure>

Offline, on the 63 live closures, this reopened 37 of 38 false closures and kept 14 of 22 real changes closed.

The live five-section run found a bug: section 57GJ and its parent Division had been renamed, so "same number, same headings" failed and the check reopened three real closures. The fix compares parent headings by numbering only ("Part 3", "Division 7").

**Experiment 9 (close).** Run C showed that the check can only undo closures. So now the diff can close facts too. After the last chunk of a section is written, each open fact from the previous version is closed at the new document's date only when:

```text
old_best = best word overlap (Jaccard) of the fact with an OLD line   >= 0.2
that best old line is gone from the new section text
new_best = best overlap with a NEW line  <  old_best - 0.1
and the new version did not restate or confirm the fact
```

Run D is run C plus text closing, on the same five sections:

<figure class="art"><div class="metric-grid">
<div class="metric"><div class="metric-num">3 → 12</div><p class="metric-label">Closures kept, all real</p></div>
<div class="metric"><div class="metric-num">8 → 1</div><p class="metric-label">Changed facts still open</p></div>
<div class="metric"><div class="metric-num">+0</div><p class="metric-label">Extra LLM calls</p></div>
</div></figure>

Every change in the five sections closed, and the visa 117 exclusion stayed open. The one changed fact left open is a long summary sentence the model wrote across several lines of 57GJ, so no single old line matched it. Text closing is off by default (`close_on_text_change: true`), because it only makes sense for sources that come in versions.

<p class="phase">Adversarial review</p>

## Experiment 11: an adversarial code review

Codex (gpt-6-astra, high effort) reviewed the diff, about 5,150 lines across 29 files, prompted to refute it: break the bi-temporal rules, find concurrency windows, construct texts that close a true fact. 1,846 unit tests passed at the time. Verdict: **FAIL, 10 major findings and 1 minor.**

<figure class="art"><div class="grid3">
<div class="h">Finding</div><div class="h">Problem</div><div class="h">Fix</div>
<div class="n">Concurrent ingests</div><div>One ingest reopens another's closures</div><div>Check the episode's <code>entity_edges</code></div>
<div class="n">Retries</div><div>Retry misses earlier closures</div><div>Start at the first attempt</div>
<div class="n">Inverted intervals</div><div>Start date after end date</div><div>Check order before dating</div>
<div class="n">Out-of-order ingest</div><div>Old version closes a new fact</div><div><code>restated_later</code> rule</div>
<div class="n">Unrelated documents</div><div>Same heading, different documents</div><div><code>series_id</code> key</div>
<div class="n">Lost chunks</div><div>Only one old version compared</div><div>Compare all old versions</div>
<div class="n">Positional ids</div><div><code>chunk_3</code> matches across sections</div><div>Group by section number</div>
<div class="n">Pending siblings</div><div>Pending chunks counted as done</div><div>Wait for all chunks</div>
<div class="n">Reworded line</div><div>Small rewording closes a true fact</div><div>Containment rule (below)</div>
<div class="n">Tests that do not test</div><div>Fake driver skips real queries</div><div>Tests on real Neo4j</div>
</div></figure>

**Real Neo4j found bugs in the tests.** On the first real Neo4j run, 9 of 27 integration tests failed, and none was a query bug: tests reused fixed ids and overwrote each other in parallel. With unique ids, all 27 passed, twice in parallel and once in sequence.

**The reworded line.** The old line matched the fact at Jaccard 0.625. The new line matched at 0.27. Treating plurals as singular only raised it to 0.4. So the rule now asks a different question: *does the new line still contain the fact?*

```text
anchor = content_words(fact) & content_words(old_line)    # 2 words or more
keep the fact open if one new line contains every anchor word
  and adds no restrictive word (not, only, unless, except, ...)
  that the anchor lacks
```

<figure class="art"><div class="qa">
<div class="qa-row"><span class="qa-q">subsection (4) does not apply → subsections (4) and (4A) do not apply</span><span class="tag is-good">kept open</span></div>
<div class="qa-row"><span class="qa-q">does not apply → applies</span><span class="tag is-hot">closed</span></div>
<div class="qa-row"><span class="qa-q">The Secretary administers → The Chief Executive administers</span><span class="tag is-hot">closed</span></div>
<div class="qa-row"><span class="qa-q">The rate is $10 → The rate is $20</span><span class="tag is-hot">closed</span></div>
<div class="qa-row"><span class="qa-q">applies → applies only to new claims</span><span class="tag is-hot">closed</span></div>
<div class="qa-row"><span class="qa-q">applies to children → applies to children over 16</span><span class="tag is-warn">kept open (wrong)</span></div>
</div></figure>

These cases are pinned in unit tests. On 995 real facts from the 2020 Act, no decision changed: 33 facts close under both rules.

## Next experiment: a domain-shaped ontology

This experiment is designed but has not run. The hypothesis: an ontology built on the domain keeps the gains of experiment 8, gives a graph that answers domain questions, and costs fewer calls.

<figure class="art"><div class="split"><div class="split-col"><h4>Remove</h4><ul><li><code>Section</code>, <code>Act</code></li><li><code>REFERS_TO</code></li><li>Most cross-references</li></ul></div><div class="split-col"><h4>Add</h4><ul><li>Individual, Child</li><li>Care arrangement</li><li>Income test</li><li>Eligibility condition</li><li>Obligation, Power</li></ul></div></div></figure>

Keep `DefinedTerm`, `Payment`, `Rate`, `Threshold`, `Office` and `Visa`. Add one line to the extraction instructions: a section number is where a rule lives, not what the rule is about.

<figure class="art"><div class="flow">
<div class="flow-step"><div class="flow-num">1</div><h4>Run both ontologies on the five-section probe</h4><p>Same settings as run D</p></div>
<div class="flow-step"><div class="flow-num">2</div><h4>Compare the shape of the graph</h4><p>Domain facts, against 13% today</p></div>
<div class="flow-step"><div class="flow-num">3</div><h4>Compare closures</h4><p>Keep all 12 real changes</p></div>
<div class="flow-step"><div class="flow-num">4</div><h4>Compare cost</h4><p>Calls and tokens per episode</p></div>
<div class="flow-step"><div class="flow-num">5</div><h4>Then a full ingest</h4><p>Only if the probe holds</p></div>
</div></figure>

The risk to watch: the change that made experiment 8 work was fixed entity pairs. A domain ontology must still put two reads of the same rule on the same pair, or the false closures of experiment 2 come back.

## Where it stands

<figure class="art"><div class="split"><div class="split-col"><h4>Done</h4><ul><li>1,882 unit + 27 Neo4j tests pass</li><li>Closure check and #1729 guard</li><li><code>extraction_reasoning_effort</code></li><li><code>schema_hints</code> ontology</li></ul></div><div class="split-col"><h4>Open</h4><ul><li>Single writer not enforced</li><li>Full-ingest closures unchecked</li><li>Domain ontology untested</li><li>No dates for PDF or Word</li><li>Passages lack provenance</li></ul></div></div></figure>

One side finding: the agent once cited a figure ($69,390) that appears in neither compilation, against its instructions. A temporal graph does not stop the answering model from inventing numbers.

## Lessons that generalise

<figure class="art"><div class="flow">
<div class="flow-step"><div class="flow-num">1</div><h4>Audit closures against the source text</h4><p>38 of 63 closures were wrong</p></div>
<div class="flow-step"><div class="flow-num">2</div><h4>An LLM reading the same text twice gives different facts</h4><p>An ontology reduces the difference</p></div>
<div class="flow-step"><div class="flow-num">3</div><h4>When the source has versions, compare the versions</h4><p>A diff is exact. A model is not.</p></div>
<div class="flow-step"><div class="flow-num">4</div><h4>Check the defaults you did not set</h4><p><code>auto</code> meant no reasoning</p></div>
<div class="flow-step"><div class="flow-num">5</div><h4>Build a replay probe before tuning prompts</h4><p>1 minute, against 1 hour</p></div>
<div class="flow-step"><div class="flow-num">6</div><h4>Chat benchmarks do not cover documents</h4></div>
<div class="flow-step"><div class="flow-num">7</div><h4>Give every fact a start date</h4><p>Use the document date</p></div>
<div class="flow-step"><div class="flow-num">8</div><h4>"Contradiction" is the wrong question</h4><p>Ask whether one fact replaces another</p></div>
<div class="flow-step"><div class="flow-num">9</div><h4>Get an adversarial review from another model</h4><p>It found 10 major problems</p></div>
<div class="flow-step"><div class="flow-num">10</div><h4>Ask whether the new text still contains the fact</h4><p>Not whether it looks similar</p></div>
<div class="flow-step"><div class="flow-num">11</div><h4>Model the domain, not the document</h4><p>Section numbers are provenance</p></div>
</div></figure>

---

_Code: the sample agent is in `sample/temporal-memory/`. The closure check is in `src/holodeck/lib/memory/backends/graphiti_closure.py`. The replay probe is in `scripts/memory_resolve_edge_replay.py`. HoloDeck docs: [docs.useholodeck.ai](https://docs.useholodeck.ai). Source text: Federal Register of Legislation, compilations C2020C00214 and C2026C00331, CC BY 4.0._
