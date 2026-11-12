---
title: "Take Back the Stack, Again: Your Agent Substrate Is a Material Risk"
slug: agent-substrate-material-risk
publishDate: 13 Nov 2026
description: "Consulting, managed services, and low-code platforms were all priced on one fact: expertise was scarce. AI removed that scarcity. Now Microsoft and a new wave of MSPs want to run the agent substrate your organisation will operate on. If you own the moat, the data, the customers, and the domain knowledge, renting that substrate is a material risk."
---

<style>
/* Post-local styles — used only by this post's figures */

/* Three-column variant of the global .split */
.split.is-3 { grid-template-columns: repeat(3, 1fr); }
.split-col .split-foot {
  margin: 0.7rem 0 0;
  padding-top: 0.6rem;
  border-top: 1px dashed var(--rule);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--hot);
}
.split-col .split-foot.is-good { color: var(--accent); }

/* Status pills */
.tag {
  font-family: var(--font-mono);
  font-size: 0.64rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.12em 0.55em;
  border-radius: 999px;
  border: 1px solid var(--rule);
  color: var(--muted);
  white-space: nowrap;
}
.tag.is-good { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 50%, transparent); }
.tag.is-hot { color: var(--hot); border-color: color-mix(in srgb, var(--hot) 50%, transparent); }

/* Exit test — one row per layer */
.exit { display: flex; flex-direction: column; gap: 0.4rem; }
.exit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--bg-soft);
  padding: 0.6rem 0.85rem;
}
.exit-name { font-size: 0.9rem; color: var(--fg); }
.exit-note { font-size: 0.82rem; color: var(--fg-dim); margin-left: 0.4rem; }

/* Dependency stack */
.stack { display: flex; flex-direction: column; align-items: stretch; }
.stack-box {
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--bg-soft);
  padding: 0.8rem 1rem;
}
.stack-box.is-you { border-left: 3px solid var(--accent); }
.stack-box h4 {
  margin: 0 0 0.2rem;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--accent);
}
.stack-box p { margin: 0 !important; font-size: 0.9rem; color: var(--fg-dim); }
.stack-link {
  text-align: center;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--muted);
  padding: 0.35rem 0;
}

/* SVG chart */
.chart { width: 100%; height: auto; display: block; }
.chart text { fill: var(--muted); font-family: var(--font-mono); font-size: 11px; }
.chart .axis { stroke: var(--rule); stroke-width: 1; }
.chart .grid { stroke: var(--rule); stroke-width: 1; stroke-dasharray: 2 4; opacity: 0.7; }
.chart .series { fill: none; stroke-width: 2.5; stroke-linecap: round; }
.chart .dot { stroke: none; }
.chart .lbl { fill: var(--fg-dim); }
.chart-legend {
  display: flex;
  gap: 1.3rem;
  flex-wrap: wrap;
  margin: 0.7rem 0 0;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--fg-dim);
}
.chart-legend span { display: inline-flex; align-items: center; }
.chart-legend i { display: inline-block; width: 15px; height: 3px; margin-right: 0.45rem; border-radius: 2px; }

@media (max-width: 600px) {
  .split.is-3 { grid-template-columns: 1fr; }
  .exit-row { flex-direction: column; align-items: flex-start; gap: 0.3rem; }
  .exit-note { margin-left: 0; display: block; }
}
</style>

## Table of Contents

- [Nine months later](#nine-months-later)
- [Built on scarce intelligence](#built-on-scarce-intelligence)
- [Borrowed moats and owned moats](#borrowed-moats-and-owned-moats)
- [The core line moved](#the-core-line-moved)
- [Why this is a material risk](#why-this-is-a-material-risk)
- [You fund their learning](#you-fund-their-learning)
- [Be wary of MSPs that want to run your substrate](#be-wary-of-msps-that-want-to-run-your-substrate)
- [If you buy from an MSP, ask for receipts](#if-you-buy-from-an-msp-ask-for-receipts)
- [What to own and what to rent](#what-to-own-and-what-to-rent)

## Nine months later

In February I wrote [Take Back the Stack](/blog/take-back-the-stack). I argued that organisations keep handing their engineering layers to cloud providers because "we do not have the skills". Since then, the pitch has grown.

Microsoft now sells agents at every level of the stack. Copilot Studio is the low-code builder for makers and IT. Copilot Cowork puts agents into everyday Microsoft 365 work. Foundry Agent Service, generally available since March, is the pro-code runtime for developers. Entra Agent ID and Agent 365 sit across all of them for identity and governance. Together they make one offer: build your agents here, run them here, give them identities here, and govern them here.

Managed service providers have joined in with agent platforms of their own. One Australian example is LAB3's [Forge](https://www.lab3.com.au/opinion/forge-secure-agentic-ai-platform), a secure agentic platform for regulated clients. It is built on the Microsoft Agent Framework and hosted on AKS, with Microsoft Foundry as its agent engine. LAB3 manages it inside the client tenant, and says it went from prototype to client capability in about six months.

In February the question was who hosts your agents. The question now is who runs the place where your organisation does its work.

## Built on scarce intelligence

Three kinds of firm sell expertise into large organisations. Consultancies sell decisions. Managed service providers sell operations. Platform vendors like Microsoft sell platforms, with low-code tools so that people who cannot write code can still build.

<figure class="art"><div class="split is-3"><div class="split-col"><h4>Consulting</h4><p>Sells the decision.</p><ul><li>Strategy and target architecture</li><li>The recommendation the board signs</li><li>Experts you cannot hire</li></ul><p class="split-foot">Priced on scarce judgment</p></div><div class="split-col"><h4>Managed services</h4><p>Sells the operation.</p><ul><li>Runs the systems you do not want to run</li><li>Shares one skilled team across many clients</li><li>Engineers you cannot hire</li></ul><p class="split-foot">Priced on scarce skills</p></div><div class="split-col"><h4>Low-code platforms</h4><p>Sells the platform.</p><ul><li>Builders for people who cannot code</li><li>The vendor runs the runtime</li><li>Developers you cannot hire</li></ul><p class="split-foot">Priced on scarce developers</p></div></div><figcaption class="art-cap">Three business models, one premise: <b>you cannot get this expertise yourself</b>.</figcaption></figure>

The three models look different, but they rest on the same fact. Expertise was scarce and expensive, and most organisations were unable to hire enough of it. These firms collected the expertise, spread it across many clients, and charged a margin. The margin was the price of scarcity.

AI removes the scarcity. Guido Appenzeller at a16z [tracked the price](https://a16z.com/llmflation-llm-inference-cost/) of the cheapest model that reaches a fixed benchmark score. For the same capability, the cost falls about ten times every year.

<figure class="art"><svg class="chart" viewBox="0 0 640 300" role="img" aria-label="Cost per million tokens for the cheapest model at MMLU 42, falling from 60 dollars in November 2021 to 6 cents in November 2024, on a log scale"><line class="grid" x1="70" y1="40" x2="610" y2="40"></line><line class="grid" x1="70" y1="92.5" x2="610" y2="92.5"></line><line class="grid" x1="70" y1="145" x2="610" y2="145"></line><line class="grid" x1="70" y1="197.5" x2="610" y2="197.5"></line><line class="axis" x1="70" y1="40" x2="70" y2="250"></line><line class="axis" x1="70" y1="250" x2="610" y2="250"></line><text x="62" y="44" text-anchor="end">$100</text><text x="62" y="96" text-anchor="end">$10</text><text x="62" y="149" text-anchor="end">$1</text><text x="62" y="201" text-anchor="end">$0.10</text><text x="62" y="254" text-anchor="end">$0.01</text><text x="108" y="270" text-anchor="middle">2022</text><text x="275" y="270" text-anchor="middle">2023</text><text x="441" y="270" text-anchor="middle">2024</text><polyline class="series" style="stroke:var(--accent)" points="80,51.6 580,209.2"></polyline><circle class="dot" style="fill:var(--hot)" cx="80" cy="51.6" r="5"></circle><circle class="dot" style="fill:var(--accent)" cx="580" cy="209.2" r="5"></circle><text class="lbl" x="92" y="46">GPT-3, Nov 2021: $60</text><text class="lbl" x="570" y="232" text-anchor="end">Llama 3.2 3B, Nov 2024: $0.06</text><text class="lbl" x="350" y="110" text-anchor="middle">1,000x cheaper in 3 years</text></svg><div class="chart-legend"><span><i style="background:var(--accent)"></i>Cheapest model at MMLU 42, $ per million tokens (log scale)</span></div><figcaption class="art-cap">Source: a16z, "LLMflation", Nov 2024. GPT-4-level models fell about <b>62x</b> from March 2023 over the same period.</figcaption></figure>

The cheap part is the generic expertise these firms resold. That includes the analysis, the architecture pattern, the integration code, and the runbook. Coding agents now produce most of that work for anyone who knows what to ask for. LAB3's six months is the evidence. A small team with coding agents built an agent platform, and your team can do the same.

Some value remains after the margin goes. Consultancies still sell accountability and the comfort of a big name on the recommendation. Managed service providers still sell capacity.

<aside class="callout"><p class="callout-label">The argument in one line</p><p>Consulting, managed services, and low-code platforms charged a margin on scarce expertise. AI made that expertise cheap. What is left does not justify handing over your agentic future.</p></aside>

## Borrowed moats and owned moats

People say that with AI there is no moat. I agree, for one kind of company. A firm whose whole value is scarce talent has a borrowed moat, and it drains as the talent gets cheap.

Your organisation has a different moat. It holds the data, the customers, the regulatory knowledge, and years of insight into how the work gets done. AI does not make any of that cheaper. It makes it more valuable, because an agent is only as good as the context it gets.

<figure class="art"><div class="split"><div class="split-col"><h4>Borrowed moat: the enablers</h4><p>Value comes from expertise you lack.</p><ul><li>Scarce engineers and architects</li><li>Reusable playbooks from other clients</li><li>Vendor certifications and partner status</li></ul><p class="split-foot">Drains as expertise gets cheap</p></div><div class="split-col"><h4>Owned moat: you</h4><p>Value comes from what only you hold.</p><ul><li>Customers and their history</li><li>Proprietary data</li><li>Domain and regulatory knowledge</li><li>How the work really gets done</li></ul><p class="split-foot is-good">Grows as agents need context</p></div></div><figcaption class="art-cap">"No moat" is true for the enablers. <b>The enablers now need your moat more than you need theirs.</b></figcaption></figure>

## The core line moved

Some outsourcing still makes sense. A good MSP runs payroll systems, end-user devices, and network operations cheaper than you can, and none of these sets you apart. The old rule was to keep the core and outsource the rest. The rule still holds, but the line has moved.

I think agents will become the main workload type of an organisation. Today a company runs on bespoke web apps, desktop apps, spreadsheets, and the people who move data between them. More of that work moves into agents. Agents will process the claims, reconcile the accounts, triage the tickets, and answer the customers. The apps stay, but more and more they become tools that agents call.

If that premise is right, the agent substrate is core. Your processes live there as prompts, workflows, and tool permissions. Your institutional memory lives there as context and retrieval indexes. Your audit trail is written there. By the old rule, you keep it.

<figure class="art"><div class="split"><div class="split-col"><h4>Before agents</h4><p>Core: products, customers, data.</p><ul><li>Outsource infrastructure</li><li>Outsource IT operations</li><li>Outsource platforms</li></ul><p class="split-foot is-good">Sensible: none of it held the work</p></div><div class="split-col"><h4>With agents</h4><p>Core now also includes:</p><ul><li>The agent loop and runtime</li><li>Workflows and business rules</li><li>Evaluations and traces</li></ul><p class="split-foot">Outsource these and the work leaves with them</p></div></div><figcaption class="art-cap">The rule did not change. <b>Agents moved into the core.</b></figcaption></figure>

The workflows matter most. MSP platforms ship their own workflow engines, and Microsoft builds the same idea into Agent Framework workflows and Copilot Studio agent flows. The deterministic part of a workflow holds your approval thresholds, routing rules, compliance checks, and the order of steps in a regulated process. That is your business logic in its most exact form. In my [Temporal post](/blog/holodeck-agents-on-temporal) I argued that this layer belongs in a portable engine you control. Now the vendors want it too.

## Why this is a material risk

I work in Australia, so the frame I reach for is APRA's CPS 230. The standard asks regulated entities to identify their critical operations and their material service providers. It then asks them to manage the risk that a provider fails, changes terms, or exits. Other regulators use similar language. If a third party controls something your critical operations depend on, you must show that you can survive without them.

If your claims process runs as agents on a vendor runtime, that runtime is part of a critical operation. So ask the exit question that every outsourcing policy contains. Can you move this to another provider, or bring it in house, within a reasonable time, with no loss of service?

<figure class="art"><div class="exit"><div class="exit-row"><span class="exit-name">Prompts and instructions<span class="exit-note">plain text</span></span><span class="tag is-good">moves</span></div><div class="exit-row"><span class="exit-name">Workflow definitions<span class="exit-note">vendor format</span></span><span class="tag is-hot">stuck</span></div><div class="exit-row"><span class="exit-name">Agent identities and tool grants<span class="exit-note">vendor governance plane</span></span><span class="tag is-hot">stuck</span></div><div class="exit-row"><span class="exit-name">Policies and approval rules<span class="exit-note">vendor policy engine</span></span><span class="tag is-hot">stuck</span></div><div class="exit-row"><span class="exit-name">Evaluation history<span class="exit-note">if it exists at all</span></span><span class="tag is-hot">stuck</span></div><div class="exit-row"><span class="exit-name">Traces and audit logs<span class="exit-note">vendor telemetry</span></span><span class="tag is-hot">stuck</span></div><div class="exit-row"><span class="exit-name">Integrations<span class="exit-note">rebuilt on the new platform</span></span><span class="tag is-hot">stuck</span></div></div><figcaption class="art-cap">The exit test for a typical outsourced agent platform. <b>The prompts move. Almost nothing else does.</b></figcaption></figure>

For most outsourced agent platforms today, the answer is no. And the team that has to plan the exit has never operated the platform.

A data centre outage stops your systems. A substrate outage, a price change, or a product retirement stops the work itself. That meets every definition of material risk I know.

## You fund their learning

The second cost is capability, and I think it is larger than the risk.

Block is the clearest example I know of a company that set out to become AI-native. Its CTO, Dhanji Prasanna, wrote an AI manifesto for Jack Dorsey, and the company reorganised around it. Prasanna talked about it on [Lenny's Podcast](https://www.lennysnewsletter.com/p/how-block-is-becoming-the-most-ai-native) last year. Block's first move was to build [goose](https://github.com/aaif-goose/goose), its own open-source agent, and put it in front of engineers and non-engineers alike. Block says goose saves its people 8 to 10 hours a week. In 2026 Dorsey went further and [cut about 40% of staff](https://venturebeat.com/orchestration/jack-dorseys-block-cuts-40-of-staff-4-000-people-and-yes-its-because-of-ai). His argument was that a smaller team that uses its own tools can deliver more. You can disagree with that decision and still see the pattern. Block owns the agent layer its organisation now runs on, because its own engineers wrote it.

Geoffrey Huntley made the same point from the engineer's side. He runs a [free workshop on how to build a coding agent](https://ghuntley.com/agent/). It shows that the core of an agent is small: a loop, a model call, and a set of tools. His request to engineers is direct: please build your own. The knowledge moves you from consumer of AI to producer of it.

An AI-native organisation is one where the people understand how agents work, where they fail, and how to redesign a process around them. You get that knowledge only when your own people do the work. When an MSP builds your agents, the knowledge flows the other way.

<figure class="art"><div class="flow"><div class="flow-step"><div class="flow-num">1</div><h4>You hire the MSP</h4><p>To build agents for a core process.</p><span class="flow-out">→ you pay</span></div><div class="flow-step"><div class="flow-num">2</div><h4>They learn your domain</h4><p>Your data, your edge cases, your exceptions, and what your best people know.</p><span class="flow-out">→ your moat moves to them</span></div><div class="flow-step"><div class="flow-num">3</div><h4>They turn it into product</h4><p>Playbooks, templates, and platform features.</p><span class="flow-out">→ their capability grows</span></div><div class="flow-step"><div class="flow-num">4</div><h4>They sell it again</h4><p>To the next client in your industry.</p><span class="flow-out">→ you keep the invoice</span></div></div><figcaption class="art-cap">You pay them to absorb your moat. <b>The learning is the asset, and it leaves the building.</b></figcaption></figure>

After three years you have a portfolio of agents and no one inside who knows why they behave the way they do. You have rented the capability, and you have to keep renting it.

## Be wary of MSPs that want to run your substrate

An MSP agent platform adds a second layer of dependency. Most of these platforms run on a hyperscaler's agent stack, often Microsoft's.

<figure class="art"><div class="stack"><div class="stack-box is-you"><h4>Your organisation</h4><p>Owns the data, the customers, and the domain knowledge.</p></div><div class="stack-link">↓ depends on</div><div class="stack-box"><h4>The MSP</h4><p>Manages the platform, the workflows, and the agents.</p></div><div class="stack-link">↓ depends on</div><div class="stack-box"><h4>The hyperscaler</h4><p>Supplies the agent engine, the models, and the runtime.</p></div></div><figcaption class="art-cap">Two parties sit between you and your own operations. <b>You have learned to operate neither.</b></figcaption></figure>

Many of these platforms make sensible design choices. They put deterministic workflows around agentic steps. They add policy engines, human approval for high-impact actions, and audit logs. My objection is about who owns them.

Then look at what the MSP announcements leave out. The ones I have read list agents, workflows, token budgets, access control, policy engines, approvals, and audit logs. Few of them say anything about evaluation. They name no test cases, no regression suites, and no measure of whether an agent gives the right answer. Cost is easy to measure. Correctness is the hard part of AI engineering, and it is what tells you an agent is safe to run on a critical operation.

A secure container runtime and a clean RBAC model tell you who can run an agent. They do not tell you whether the agent is right. So the offer comes down to this: host your business on us, and we will handle the rest.

Nobody has a long record of operating production agent platforms, MSPs included, because the field is about two years old. Many of the platforms on the market today were built in months by small teams with coding agents and a large Claude bill. That is a reasonable way to build software in 2026. It is how I build HoloDeck. If a small team at an MSP can build a credible platform in six months, a small team inside your organisation can build one too. And when your team builds it, the knowledge and the platform stay with you.

## If you buy from an MSP, ask for receipts

Do not trust a partner or MSP with your agent substrate because you trusted them with your infrastructure. Most of the MSPs I see selling agent platforms today come from infrastructure outsourcing. They ran data centres, then cloud landing zones, then managed services. Now they are trying their luck with AI. A good record in infrastructure tells you nothing about their ability to run agents in production.

Almost every one of them will tell you they have customers in production. Treat that as a claim to test.

<aside class="art refs"><h4>Receipts to ask for</h4><ul><li>Which processes run on the platform today, for which customers, and for how long?</li><li>How many agent runs a week, and what share needs a human to fix the result?</li><li>Can we talk to one of those customers without you in the room?</li><li>Show us the evaluation suite for one production agent. How many test cases, and what is the current pass rate?</li><li>Show us a regression that the evaluations caught before release.</li><li>Walk us through a production incident where an agent did the wrong thing. What failed, how did you find it, and what changed after?</li><li>Who on your team has built and operated an agent system in production, and what did they build before this platform?</li><li>If we leave, do we get the prompts, workflow definitions, tool permissions, evaluation history, and traces, in formats another platform can read?</li></ul></aside>

A partner with real experience can answer most of these with documents and names. If the answers are case studies, demos, and a slide about governance, treat the production claim as unproven. And if you find that you are now teaching your MSP how agents fail, keep that knowledge in house and build the platform yourself.

## What to own and what to rent

Choose the layers you own, and rent the rest. Here is the split I use.

<figure class="art"><div class="split"><div class="split-col"><h4>Rent: the commodity</h4><p>Cheap, portable, and the same for everyone.</p><ul><li>Model inference, from more than one provider</li><li>Compute, storage, and networking</li><li>Durable execution such as Temporal, open source</li><li>Coding agents to do most of the build work</li></ul></div><div class="split-col"><h4>Own: what encodes you</h4><p>Your business logic and your evidence.</p><ul><li>The agent loop and runtime, in code your team reads</li><li>Workflows, in a format no vendor controls</li><li>Tool registry, identities, and approval rules</li><li>Evaluation harness, test cases, and results history</li><li>Traces and audit logs, in OpenTelemetry, in your store</li></ul></div></div><figcaption class="art-cap">Apply the exit test to every item before you sign. <b>If a layer fails it and sits on a critical operation, bring it in house.</b></figcaption></figure>

Two or three engineers with coding agents can stand up a credible agent runtime in a quarter. They will make mistakes, and those mistakes are the training that turns your organisation into an AI-native one. If you outsource the substrate, the vendor's engineers get that training and keep it.

---

*HoloDeck is my attempt to show what the owned layers look like in practice. It is open source on [GitHub](https://github.com/justinbarias/holodeck).*
