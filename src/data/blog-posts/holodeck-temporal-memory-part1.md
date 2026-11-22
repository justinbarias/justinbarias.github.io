---
title: "Temporal Knowledge Graphs in HoloDeck, Part 1: When Did the Rule Change?"
slug: holodeck-temporal-memory-part1
publishDate: 22 Nov 2026
description: "GraphRAG lost steam on cost and rebuilds. Hybrid search over hierarchical documents carried my legislation agents a long way, until the question became 'when did this rule change, and where does that come from?' Why I added a Graphiti-based temporal knowledge graph to HoloDeck, and what an experiment on real Australian legislation taught me about ontology."
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
.cmp { display: grid; grid-template-columns: 1.1fr 1.3fr 1.3fr 1.2fr; border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; font-size: 0.86rem; }
.cmp > div { padding: 0.6rem 0.75rem; border-bottom: 1px solid var(--rule); color: var(--fg-dim); line-height: 1.45; }
.cmp > .h { font-family: var(--font-mono); font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); background: var(--bg-soft); }
.cmp > .n { color: var(--fg); font-weight: 600; }
.cmp > .is-hot { color: var(--hot); }
.cmp > .is-good { color: var(--accent); }
.cmp > div:nth-last-child(-n+4) { border-bottom: 0; }

.qa { display: flex; flex-direction: column; gap: 0.45rem; }
.qa-row { display: flex; justify-content: space-between; align-items: center; gap: 1rem; border: 1px solid var(--rule); border-radius: var(--radius); background: var(--bg-soft); padding: 0.6rem 0.9rem; }
.qa-q { font-size: 0.92rem; color: var(--fg); }
.qa-q small { display: block; color: var(--muted); font-size: 0.78rem; margin-top: 0.15rem; }
.refs-line { margin: 0.65rem 0 0 !important; font-family: var(--font-mono); font-size: 0.72rem; line-height: 1.5; color: var(--muted); }
.refs-line a { color: var(--accent); }
.tag { flex: none; font-family: var(--font-mono); font-size: 0.64rem; letter-spacing: 0.04em; text-transform: uppercase; padding: 0.12em 0.55em; border-radius: 999px; border: 1px solid var(--rule); color: var(--fg-dim); }
.tag.is-good { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 50%, transparent); }
.tag.is-hot { color: var(--hot); border-color: color-mix(in srgb, var(--hot) 50%, transparent); }
.tag.is-warn { color: var(--accent-2); border-color: color-mix(in srgb, var(--accent-2) 50%, transparent); }

.reel { margin: 0; border: 1px solid var(--rule); border-radius: var(--radius); overflow: hidden; background: #000; }
.reel video { display: block; width: 100%; height: auto; }

.chart .bar-a { fill: var(--accent); }
.chart .bar-h { fill: var(--hot); }
.chart .bar-m { fill: var(--muted); opacity: 0.55; }
.chart .span-old { stroke: var(--hot); stroke-width: 10; stroke-linecap: round; }
.chart .span-new { stroke: var(--accent); stroke-width: 10; stroke-linecap: round; }
.chart .span-sys { stroke: var(--fg-dim); stroke-width: 2; stroke-dasharray: 4 4; }
.chart .tick { stroke: var(--rule); stroke-width: 1; }
.chart .big { fill: var(--fg); font-size: 12px; }
.chart .on { fill: var(--bg); font-weight: 600; }

.findings { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
.finding { border: 1px solid var(--rule); border-radius: var(--radius); background: var(--bg-soft); padding: 0.9rem 1.05rem; }
.finding h4 { margin: 0 0 0.35rem; font-size: 0.98rem; color: var(--fg); }
.finding p { margin: 0 !important; font-size: 0.88rem; line-height: 1.5; color: var(--fg-dim); }
.finding .k { font-family: var(--font-mono); font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); display: block; margin-bottom: 0.3rem; }

@media (max-width: 600px) {
  .cmp { grid-template-columns: 1fr 1fr; }
  .cmp > .h:nth-child(n+3):nth-child(-n+4) { display: none; }
  .findings { grid-template-columns: 1fr; }
  .qa-row { flex-direction: column; align-items: flex-start; gap: 0.4rem; }
}
</style>

## Table of Contents
- [Graphs for retrieval, so far](#graphs-for-retrieval-so-far)
- [The use case: legislation that changes](#the-use-case-legislation-that-changes)
- [The limitation: when did the rule change?](#the-limitation-when-did-the-rule-change)
- [Why a temporal graph](#why-a-temporal-graph)
- [See it run](#see-it-run)
- [TL;DR of the experiment](#tldr-of-the-experiment)
- [Why the ontology matters most](#why-the-ontology-matters-most)
- [Model the domain, not the document](#model-the-domain-not-the-document)
- [What I recommend](#what-i-recommend)

In February I wrote that [GraphRAG fizzled](/blog/rag-is-dead-long-live-rag) and that hybrid search over well-chunked, hierarchical documents does most of the work. I still think that is true. Now I have added a knowledge graph to [HoloDeck](https://useholodeck.ai), my open-source agent platform. This post explains why: one question type that hybrid search cannot answer well, and a kind of graph that is built for it.

Part 2 is the full experiment log. This part is the short version.

## Graphs for retrieval, so far

GraphRAG ([Edge et al., 2024](https://arxiv.org/abs/2404.16130)) asked an LLM to extract entities and relations from every chunk, clustered the graph into communities, and wrote a summary for each community. Those summaries answer "global" questions, such as "what are the main themes in this corpus?", that chunk search cannot.

It lost steam for four reasons.

<figure class="art"><div class="findings"><div class="finding"><span class="k">Cost</span><h4>Every chunk is an LLM call, several times over</h4></div><div class="finding"><span class="k">Time</span><h4>Indexing is slow, and so are global queries</h4></div><div class="finding"><span class="k">Change</span><h4>A small edit can reshape the communities</h4></div><div class="finding"><span class="k">Fit</span><h4>Most questions are local</h4></div></div></figure>

Lighter alternatives to GraphRAG followed. None of them answer the "when" question.

<figure class="art"><div class="cmp">
<div class="h">Approach</div><div class="h">What it builds</div><div class="h">When a document changes</div><div class="h">Answers "when did it change?"</div>
<div class="n">GraphRAG</div><div>Entity graph, community clusters, a summary per community</div><div class="is-hot">Re-cluster and re-summarise affected communities</div><div class="is-hot">No: facts carry no dates</div>
<div class="n">LazyGraphRAG</div><div>Cheap concept graph. Summaries wait until query time</div><div>Cheap to rebuild</div><div class="is-hot">No</div>
<div class="n">LightRAG</div><div>Entity and relation graph with dual-level keys</div><div>Incremental: new entities merged in</div><div class="is-hot">No: old and new facts sit side by side</div>
<div class="n">RAPTOR</div><div>A tree of recursive cluster summaries over chunks</div><div class="is-hot">Rebuild the branches above the change</div><div class="is-hot">No: a summary has no valid time</div>
<div class="n">Temporal KG (Graphiti)</div><div>Entity graph whose edges are facts with two timelines</div><div class="is-good">Incremental: one episode per changed chunk</div><div class="is-good">Yes, by design</div>
</div><p class="refs-line">Sources: GraphRAG <a href="https://arxiv.org/abs/2404.16130">2404.16130</a>, LightRAG <a href="https://arxiv.org/abs/2410.05779">2410.05779</a>, RAPTOR <a href="https://arxiv.org/abs/2401.18059">2401.18059</a>, Zep / Graphiti <a href="https://arxiv.org/abs/2501.13956">2501.13956</a>. </p></figure>

## The use case: legislation that changes

My work is government legislation and policy. For most questions, HoloDeck's [hierarchical document tool](/blog/rag-is-dead-long-live-rag) is enough. It uses structure-aware chunks (one chunk per section) and hybrid BM25 and vector search. Every chunk carries its Part, Division and section heading.

<figure class="art"><div class="qa">
<div class="qa-row"><span class="qa-q">What does section 61AA say about visas?<small>Find a provision</small></span><span class="tag is-good">hybrid search</span></div>
<div class="qa-row"><span class="qa-q">Who counts as a "Human Services Secretary"?<small>Find a definition</small></span><span class="tag is-good">hybrid search</span></div>
<div class="qa-row"><span class="qa-q">What is the child care subsidy rate for a low-income family?<small>Find a rate in the current text</small></span><span class="tag is-good">hybrid search</span></div>
<div class="qa-row"><span class="qa-q">What was the rate on 1 August 2020, and when did it change?<small>A value at a date, and the date it moved</small></span><span class="tag is-warn">agent loop, costly</span></div>
<div class="qa-row"><span class="qa-q">What changed in this Act on 1 July 2026, and which compilation says so?<small>Change detection with provenance</small></span><span class="tag is-hot">unreliable</span></div>
</div></figure>

## The limitation: when did the rule change?

This is where hybrid search came up short for me. The task was to track a rule or policy over time: find when it changed, where it changed, and trace the change back to the source compilation.

Hybrid search can do this with an agent on top, but only the hard way. Search does not know which of two near-identical passages is current. So the agent must fetch the section from each compilation, read both, and diff them in its own context. It must do this for every section that can have changed.

<figure class="art"><div class="flow">
<div class="flow-step"><div class="flow-num">1</div><h4>Search the 2020 compilation</h4><p>Find the section. Hope the right chunk is in the top 5.</p></div>
<div class="flow-step"><div class="flow-num">2</div><h4>Search the 2026 compilation</h4><p>Find the same section again. It can move or get a new name.</p></div>
<div class="flow-step"><div class="flow-num">3</div><h4>Read both into context</h4><p>Two full sections, often more for definitions they depend on.</p></div>
<div class="flow-step"><div class="flow-num">4</div><h4>Diff them in the prompt</h4><p>The model compares two long legal texts line by line.</p><span class="flow-out">→ misses small edits, invents others</span></div>
<div class="flow-step"><div class="flow-num">5</div><h4>Repeat for every candidate section</h4><p>"What changed?" has no single section to search for.</p><span class="flow-out">→ token cost grows with the corpus</span></div>
</div></figure>

<!-- TODO(justin): if you have a token or cost figure from the agentic hybrid-search baseline, add it here as a metric card. -->

Retrieval quality is fine. The index stores text, and text has no dates on it. This question needs a store whose facts carry dates.

## Why a temporal graph

A temporal knowledge graph stores a fact as an edge between two entities, and puts dates on the edge. [Graphiti](https://github.com/getzep/graphiti), Zep's open-source library, gives every fact two timelines:

- **Valid time**: when the fact was true outside the database. For legislation, that is when the rule was in force (`valid_at` to `invalid_at`).
- **System time**: when the store recorded it, and when it learned the fact had ended (`created_at`, `expired_at`).

<figure class="art"><svg class="chart" viewBox="0 0 640 250" role="img" aria-label="Two facts about the Human Services Secretary definition. The old fact is valid from 1 July 2020 to 1 July 2026. The new fact is valid from 1 July 2026 onwards. System time shows when each was recorded and when the old one expired.">
<line class="axis" x1="60" y1="212" x2="610" y2="212"></line>
<line class="tick" x1="90" y1="40" x2="90" y2="212"></line><line class="tick" x1="470" y1="40" x2="470" y2="212"></line>
<text x="90" y="230" text-anchor="middle">1 Jul 2020</text><text x="470" y="230" text-anchor="middle">1 Jul 2026</text>
<text class="lbl" x="60" y="34">Valid time</text>
<line class="span-old" x1="90" y1="62" x2="470" y2="62"></line>
<text class="big" x="98" y="88">Human Services Secretary = Secretary of the Department</text>
<line class="span-new" x1="470" y1="112" x2="600" y2="112"></line>
<text class="big" x="600" y="138" text-anchor="end">= CEO of Services Australia</text>
<text class="lbl" x="60" y="164">System time</text>
<line class="span-sys" x1="90" y1="172" x2="470" y2="172"></line>
<text x="98" y="192">expired_at: set when the 2026 compilation was ingested</text>
</svg></figure>

That design fixes the GraphRAG problems that matter here:

<figure class="art"><div class="split"><div class="split-col"><h4>GraphRAG</h4><p>"What are the themes?"</p><ul><li>Undated facts</li><li>Rebuild communities on change</li><li>Summaries without sources</li><li>LLM calls at query time</li></ul></div><div class="split-col"><h4>Temporal graph</h4><p>"What was true, and when?"</p><ul><li>Dated facts</li><li>Incremental ingest</li><li>Every fact cites its chunk</li><li>No LLM calls at query time</li></ul></div></div></figure>

Legislation fits it well. Rates, thresholds and definitions change on known dates. Most of the text does not change at all. And you can check every claim against the source.

In my test, I loaded the Family Assistance Act at two compilations, 1 July 2020 and 1 July 2026, with one chunk per section. Each chunk gets an id from a hash of its text. When the 2026 compilation arrived, unchanged sections had the same id, so the graph skipped them:

<figure class="art"><div class="metric-grid"><div class="metric"><div class="metric-num">663</div><p class="metric-label">Chunks in both compilations</p></div><div class="metric"><div class="metric-num">243</div><p class="metric-label">Unchanged, skipped</p></div><div class="metric"><div class="metric-num">93</div><p class="metric-label">Changed in 2026, extracted</p></div></div></figure>

In HoloDeck it is one tool block in `agent.yaml`, next to the document tools it reads from:

```yaml
- name: benefit_memory
  type: temporal_memory
  source_tools: [family_assistance_act, family_assistance_admin_act]
  backend:
    provider: graphiti
    driver: neo4j
  extraction_reasoning_effort: medium
  close_on_text_change: true
  effective_date_key: effective_date
```

The agent gets three tools: `memory_search` (facts and passages as of a date), `memory_timeline` (how one entity changed), and `memory_provenance` (which chunk a fact came from).

## See it run

This short reel walks through the pipeline (chunk, episode, ontology, entities, dated facts) and then the agent answering a dated question about the Administrative Appeals Tribunal and its replacement.

<figure class="art"><div class="reel"><video controls preload="metadata" playsinline poster="/assets/blog/holodeck-temporal-memory/temporal-memory-reel-poster.jpg"><source src="/assets/blog/holodeck-temporal-memory/temporal-memory-reel.mp4" type="video/mp4">Your browser cannot play this video.</video></div></figure>

## TL;DR of the experiment

I ingested the *A New Tax System (Family Assistance) Act 1999* at two compilations, 1 July 2020 and 1 July 2026, about 100,000 words each. Then I asked one question: when the 2026 text arrives, does the graph close exactly the facts that changed, and leave every other fact open?

Out of the box, it did not. The full ingest made 3,111 LLM calls in 74 minutes and produced 1,463 facts. Then I checked every closure by hand against both compilations:

<figure class="art"><svg class="chart" viewBox="0 0 640 112" role="img" aria-label="Of 63 facts closed by the 2026 compilation, 22 were real changes, 38 were false closures, 3 were unclear">
<text class="lbl" x="20" y="28">63 facts from 2020 that the 2026 compilation closed</text>
<rect class="bar-a" x="20" y="44" width="211" height="34" rx="3"></rect>
<rect class="bar-h" x="233" y="44" width="365" height="34" rx="3"></rect>
<rect class="bar-m" x="600" y="44" width="29" height="34" rx="3"></rect>
<text class="big on" x="30" y="66">22 real</text><text class="big on" x="243" y="66">38 false: the law did not change</text>
<text x="618" y="100" text-anchor="end">3 unclear</text>
</svg></figure>

Two mechanisms caused it. When one line of a section changes, Graphiti extracts the whole section again. The model re-words the facts and links them to *different* entities. Graphiti only treats a fact as a duplicate when it joins the same two entities, so the old copy can only be marked "contradicted". And the contradiction search runs over the whole graph, so a chunk from an unrelated section can close facts that it never mentions. Graphiti's own tracker has the same report ([getzep/graphiti#1728](https://github.com/getzep/graphiti/issues/1728)).

Then I applied the fixes one knob at a time, on five sections of the Act at both compilations, where every change was known. No false closure survived in runs B, C or D, and run D closed 12 of 13 real changes:

<figure class="art"><svg class="chart" viewBox="0 0 640 260" role="img" aria-label="Across runs A to D, real closures rose from 0 to 12 and changed facts left open fell from 9 to 1">
<line class="grid" x1="70" y1="30" x2="610" y2="30"></line><line class="grid" x1="70" y1="90" x2="610" y2="90"></line><line class="grid" x1="70" y1="150" x2="610" y2="150"></line>
<line class="axis" x1="70" y1="210" x2="610" y2="210"></line>
<text x="62" y="34" text-anchor="end">12</text><text x="62" y="94" text-anchor="end">8</text><text x="62" y="154" text-anchor="end">4</text><text x="62" y="214" text-anchor="end">0</text>
<rect class="bar-a" x="100" y="210" width="40" height="0"></rect><rect class="bar-h" x="144" y="75" width="40" height="135"></rect>
<rect class="bar-a" x="235" y="195" width="40" height="15"></rect><rect class="bar-h" x="279" y="165" width="40" height="45"></rect>
<rect class="bar-a" x="370" y="165" width="40" height="45"></rect><rect class="bar-h" x="414" y="90" width="40" height="120"></rect>
<rect class="bar-a" x="505" y="30" width="40" height="180"></rect><rect class="bar-h" x="549" y="195" width="40" height="15"></rect>
<text class="big" x="120" y="204" text-anchor="middle">0</text><text class="big" x="164" y="70" text-anchor="middle">9</text>
<text class="big" x="255" y="189" text-anchor="middle">1</text><text class="big" x="299" y="159" text-anchor="middle">3</text>
<text class="big" x="390" y="159" text-anchor="middle">3</text><text class="big" x="434" y="84" text-anchor="middle">8</text>
<text class="big" x="525" y="22" text-anchor="middle">12</text><text class="big" x="569" y="189" text-anchor="middle">1</text>
<text x="142" y="230" text-anchor="middle">A: baseline</text><text x="277" y="230" text-anchor="middle">B: + reasoning</text><text x="412" y="230" text-anchor="middle">C: + ontology</text><text x="547" y="230" text-anchor="middle">D: + text diff</text>
<text x="142" y="246" text-anchor="middle">none, no types</text><text x="277" y="246" text-anchor="middle">medium</text><text x="412" y="246" text-anchor="middle">+ guard</text><text x="547" y="246" text-anchor="middle">closes facts</text>
</svg><div class="chart-legend"><span><i style="background:var(--accent)"></i>Closures kept, all checked real</span><span><i style="background:var(--hot)"></i>Changed 2020 facts still open</span></div></figure>

<figure class="art"><div class="findings">
<div class="finding"><span class="k">Finding 1</span><h4>Audit closures against the source text</h4></div>
<div class="finding"><span class="k">Finding 2</span><h4>Check the defaults you did not set</h4></div>
<div class="finding"><span class="k">Finding 3</span><h4>Prompt rewrites changed nothing</h4></div>
<div class="finding"><span class="k">Finding 4</span><h4>"Contradiction" is the wrong question</h4></div>
<div class="finding"><span class="k">Finding 5</span><h4>When the source has versions, diff the versions</h4></div>
<div class="finding"><span class="k">Finding 6</span><h4>Ask a hostile reviewer</h4></div>
</div></figure>

## Why the ontology matters most

The baseline gave Graphiti six entity names and no edge types. The full graph ended up with **672 distinct relation names** across 1,463 facts. Each read of a section was a fresh guess at what the entities and relations were. That is exactly how a restated fact got new entities, and then got closed.

A typed ontology puts both reads of the same rule on the same pair of entities. On the same five sections, run B had no ontology and run C had the legislation ontology. Then Graphiti's duplicate path catches the restatement, and the contradiction path never sees it.

<figure class="art"><div class="bars">
<div class="bar-row"><div class="bar-head"><b>Distinct relation names</b><span class="bar-val">51 → 24</span></div><div class="bar-track"><div class="bar-fill is-hot" style="width:100%"></div></div><div class="bar-track"><div class="bar-fill" style="width:47%"></div></div></div>
<div class="bar-row"><div class="bar-head"><b>Real closures kept</b><span class="bar-val">1 → 3</span></div><div class="bar-track"><div class="bar-fill is-hot" style="width:33%"></div></div><div class="bar-track"><div class="bar-fill" style="width:100%"></div></div></div>
<div class="bar-row"><div class="bar-head"><b>LLM calls (the cost)</b><span class="bar-val">129 → 207</span></div><div class="bar-track"><div class="bar-fill is-hot" style="width:62%"></div></div><div class="bar-track"><div class="bar-fill" style="width:100%"></div></div></div>
</div></figure>

The ontology is plain YAML in the tool block. This is a slice of the first ontology I wrote for the Act. It produced the results above, and it has a flaw that the next section explains.

```yaml
schema_hints:
  entity_types:
    - {name: Section,     description: "A numbered section, subsection or clause, such as 61AA."}
    - {name: DefinedTerm, description: "A term the Act defines, such as 'income year'."}
    - {name: Payment,     description: "A benefit, payment or subsidy paid under the Act."}
    - {name: Threshold,   description: "An income or rent threshold, limit or cap."}
    - {name: Office,      description: "A minister, secretary or agency that exercises a power."}
  edge_types:
    - {name: DEFINES,       single_valued: true, attributes: [{name: meaning, type: string}]}
    - {name: HAS_THRESHOLD, single_valued: true, key_attributes: [category],
       attributes: [{name: amount, type: number}, {name: category, type: string}]}
    - {name: EXERCISED_BY,  single_valued: true}
    - {name: EXCLUDES}
```

`single_valued` and `key_attributes` carry the domain rule that matters most: a payment has *one* threshold per category at a time, so a new amount replaces the old one. Without that, the model has to guess.

<div class="callout"><p class="callout-label">The lesson</p><p>An LLM reading the same text twice does not produce the same facts. <strong>The ontology is what makes two reads comparable.</strong> Without it, every downstream fix is comparing noise.</p></div>

## Model the domain, not the document

The five-section runs said the ontology worked. The full ingest of both Acts showed what it had modelled. I looked at the graph and saw that the entities followed the structure of the legislation, and said little about the domain. The graph had 2,950 entities and 7,473 facts. Splitting the facts by their endpoints confirmed it. A Section or Act counts as structure, and anything else counts as domain: only about 1 fact in 8 is purely about the domain.

<figure class="art"><svg class="chart" viewBox="0 0 640 112" role="img" aria-label="Facts by endpoint type: 37 percent structure to structure, 49 percent structure to domain, 13 percent domain to domain">
<text class="lbl" x="20" y="28">Facts that join two entities, by what sits at each end</text>
<rect class="bar-m" x="20" y="44" width="222" height="34" rx="3"></rect>
<rect class="bar-h" x="244" y="44" width="294" height="34" rx="3"></rect>
<rect class="bar-a" x="540" y="44" width="78" height="34" rx="3"></rect>
<text class="big" x="30" y="66">37% structure → structure</text><text class="big on" x="254" y="66">49% structure → domain</text><text class="big on" x="548" y="66">13%</text>
<text class="acc" x="618" y="100" text-anchor="end">13% domain → domain</text>
</svg></figure>

I asked for this. `Section` and `Act` were entity types, so every "section 32AC" or "Division 2AA of Part 5" became a node. `REFERS_TO` was an edge type, so every cross-reference became a fact: 3,049 of them. The extraction instructions framed the text as provisions, so the model attached each rule to its section. It did not attach the rule to the person, payment or amount that the rule is about.

That has three costs:

- **It repeats provenance.** Each fact already records the episode it came from, and the episode knows its section and Act. `memory_provenance` reads them from there.
- **It crowds retrieval.** A search for "FTB Part A rate" lands on Section nodes and cross-references as often as on the rate.
- **It costs model calls.** More nodes and edges per episode mean more extraction and resolution work.

A domain-shaped ontology for the same Act removes the structure and adds the domain. It also adds one line to the extraction instructions: a section number is where a rule lives, not what the rule is about.

<figure class="art"><div class="split"><div class="split-col"><h4>Remove</h4><p>Structure</p><ul><li><code>Section</code>, <code>Act</code></li><li><code>REFERS_TO</code></li><li>Most cross-references</li></ul></div><div class="split-col"><h4>Add</h4><p>Domain</p><ul><li>Individual, Child</li><li>Care arrangement</li><li>Income test</li><li>Eligibility condition</li><li>Obligation, Power</li></ul></div></div></figure>

This is the next experiment, and it has not run yet. The plan is to run both ontologies on the same five-section probe and compare the entity mix, the share of domain facts, and the closures on the same 12 real changes. Only then does it go to a full ingest.

<div class="callout"><p class="callout-label">The second lesson</p><p>Legislation has a strong structure, and an ontology drifts toward it. <strong>Model what the rules are about. Keep the section number as provenance.</strong></p></div>

## What I recommend

If you put a temporal graph over versioned documents:

<figure class="art"><div class="flow">
<div class="flow-step"><div class="flow-num">1</div><h4>Write the ontology first, about the domain</h4><p>Entity types, edge types, and which edges are single-valued. Use the people, payments and amounts as entities, not the sections. Spend your domain expert's time here.</p></div>
<div class="flow-step"><div class="flow-num">2</div><h4>Date every fact from its document</h4><p>An undated fact is true forever and can never be closed. 19% of ours had no date.</p></div>
<div class="flow-step"><div class="flow-num">3</div><h4>Set the judge's reasoning effort yourself</h4><p>Medium, on our replay set. Do not trust <code>auto</code>.</p></div>
<div class="flow-step"><div class="flow-num">4</div><h4>Let the text diff decide closures</h4><p>Reopen a closure that the diff does not support. Close a fact whose source line changed.</p></div>
<div class="flow-step"><div class="flow-num">5</div><h4>Build a replay probe and a source audit</h4><p>67 labelled cases in one minute, instead of a 3,000-call re-ingest.</p></div>
</div></figure>

Hybrid search is still the first tool my agents reach for. The temporal graph sits beside it and earns its cost only on questions about time.

[Part 2](/blog/holodeck-temporal-memory-part2) walks through all eleven experiments: the audit method, why Graphiti closes the wrong facts, the reasoning sweep, the ontology runs, the text-diff closure check, what a hostile reviewer still found, and the design of the next experiment.

---

_HoloDeck is open source: [docs.useholodeck.ai](https://docs.useholodeck.ai). The Act text comes from the Federal Register of Legislation, compilations C2020C00214 and C2026C00331, licensed CC BY 4.0._
