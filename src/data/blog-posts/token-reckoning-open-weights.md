---
title: "The Token Reckoning"
slug: the-token-reckoning
publishDate: 22 Jun 2026
description: "The default today is to start with a frontier model and build agents on top. That's the correct way to start. It is not where high-volume, policy-bound work ends up. As agentic token volume compounds, the workloads that have a fixed action space and a hard conformance requirement land on fine-tuned open-weight models. This post is about why that migration is an economic inevitability, and what you actually have to build first to make it — the harness and the eval set, in that order."
---

## Table of Contents

- [The default, and why it's correct](#the-default-and-why-its-correct)
- [The reckoning is a volume problem, not a price problem](#the-reckoning-is-a-volume-problem-not-a-price-problem)
- [The escape hatch everyone reaches for is the wrong one](#the-escape-hatch-everyone-reaches-for-is-the-wrong-one)
- [What fine-tuning is actually for](#what-fine-tuning-is-actually-for)
- [This is well-trodden ground, not a science project](#this-is-well-trodden-ground-not-a-science-project)
- [The harness is the precondition](#the-harness-is-the-precondition)
- [The journey, in five moves](#the-journey-in-five-moves)
- [The eval set is the exit](#the-eval-set-is-the-exit)
- [Why open weights, and why it's sharper in regulated work](#why-open-weights-and-why-its-sharper-in-regulated-work)
- [Where this leaves you](#where-this-leaves-you)

---

I spent the last stretch fine-tuning small open-weight models on my own hardware to find out, hands-on, what fine-tuning is and isn't good for. The technical write-up of that is a separate post. This one is the conclusion I didn't expect to reach: for a large class of production workloads, starting on a frontier model is correct, and *staying* there is a decision you make by default rather than on purpose. The economics make the migration off frontier models inevitable for high-volume agentic work. Most teams are not building the two things that make that migration possible.

## The default, and why it's correct

The current default is rational, and I want to be clear about that before I argue with it. You start with the strongest frontier model you can call, you build an agent on top, and you ship. You should. A frontier model is the fastest way to find out whether the task is even tractable, the agent loop converges, and the product is worth building. It is a general-purpose instrument, and at the start of a project generality is exactly what you're paying for, because you don't yet know which specific capability you need.

The mistake is treating that first architecture as the final one. The frontier model is the right place to *start* and the right place to *bootstrap from*. It is not, for a workload that runs millions of times a month against a fixed set of actions, the right place to *land*.

## The reckoning is a volume problem, not a price problem

The token reckoning is not "frontier models are expensive." Per-token prices have fallen and will keep falling. The reckoning is that **agentic workloads multiply token volume per unit of work**, and that multiplication outruns the price curve.

A single chat turn is one prompt and one completion. An agent solving the same task is not one call. It is a loop: read the tools, plan, call a tool, read the result, plan again, call another tool, and so on until it answers. Every step re-sends the system prompt and the tool schemas, re-reads the accumulated context, and emits more tokens. A task that looks like 500 tokens in a demo is 15,000 tokens in an agent that took eight steps to get there — and in production you run that task continuously, not once.

<figure class="art">
  <div class="bars">
    <div class="bar-row">
      <div class="bar-head"><span><b>One chat turn</b> — prompt + completion</span><span class="bar-val">~500 tok</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:3.3%"></div></div>
    </div>
    <div class="bar-row">
      <div class="bar-head"><span><b>Same task, 8-step agent loop</b> — schema re-sent each step</span><span class="bar-val">~15,000 tok</span></div>
      <div class="bar-track"><div class="bar-fill is-hot" style="width:100%"></div></div>
    </div>
  </div>
  <figcaption class="art-cap">The same unit of work. <b>~30× the tokens</b> — and the multiplier is set by your architecture, not your vendor's price list.</figcaption>
</figure>

So the cost line is per-token price multiplied by a volume that your *architecture* sets, not your vendor. This is the number that is invisible at POC scale and dominant at production scale. It is also the number that does not bend the way you need it to, because the part you control — volume — is structural to how agents work, and the part the vendor controls — price — is already being competed down to near the floor for everyone at once, which means it gives you no relative advantage.

When that line item becomes the thing the CFO asks about, the obvious lever is to run the high-volume, repetitive portion of the workload on a model you host, on hardware whose cost you amortize, at a per-token cost that approaches the cost of electricity. That is an open-weight model. The question is not *whether* that pressure arrives. It's whether, when it does, you have built the things that let you act on it.

## The escape hatch everyone reaches for is the wrong one

When a team first decides to move off frontier models, the instinct is almost always the same: *fine-tune a model that knows our domain.* Train it on the policy documents, the past tickets, the product catalogue, the regulations. Make a model that has our knowledge baked in.

This does not work, and it's worth understanding why at the mechanism level, because the misunderstanding is what wastes the budget.

A transformer does not store facts in a place you can point at. Knowledge is smeared diffusely across the feed-forward layers as a kind of soft key-value memory, and it is entangled with everything else the model knows. A fine-tune — especially a parameter-efficient one, which is what you can actually afford to run repeatedly — adjusts a small, low-rank slice of the weights. That slice is enough to shift *behavior*. It is nowhere near enough to reliably write hundreds of exact, arbitrary facts into the model's memory, and worse, attempting it teaches the model to produce *confident, fluent, wrong* facts, because it has learned the shape of an answer without a reliable copy of the content.

I watched this happen directly on a tiny domain. The model learned the language and the patterns of the task within a few hundred training steps, and it still could not be trusted to recall an exact number, because exact recall is not what the mechanism does. Brute-forcing facts into weights is a dead end. If your reason for fine-tuning is "so the model knows our stuff," stop — that job belongs to retrieval and tools, where the facts stay correct, current, and auditable.

## What fine-tuning is actually for

Here is the inversion that took me a real build to internalize. Fine-tuning is not for knowledge. It is for **behavior, policy, judgment, and format** — the parts of the task that have a *right way to be done* rather than a *right fact to recall*.

And the highest-value version of that behavior, the one with a direct economic argument, is **enforcing policy by teaching the model to call tools correctly**. Not "knowing" the policy as text. *Executing* it: which tool to reach for, in what order, with what arguments, when to refuse, when to stop. The model's job becomes orchestration and conformance. The facts come from the tools the orchestration calls.

This split is the whole game:

<figure class="art">
  <div class="split">
    <div class="split-col">
      <h4>Facts → tools / retrieval</h4>
      <p>Exact values, anything that changes.</p>
      <ul>
        <li>Always correct</li>
        <li>Patchable without retraining</li>
        <li>Auditable by construction</li>
      </ul>
    </div>
    <div class="split-col">
      <h4>Policy → fine-tune</h4>
      <p>Process, sequencing, voice, when to abstain.</p>
      <ul>
        <li>Which tool, in what order</li>
        <li>When to refuse, when to stop</li>
        <li>Enforced, not just requested</li>
      </ul>
    </div>
  </div>
  <figcaption class="art-cap">Knowledge and behaviour are different jobs. <b>Putting either on the wrong side</b> is the most expensive mistake in the build.</figcaption>
</figure>

The economic value of a fine-tuned specialist is that it *reliably does the procedure your business requires* — every time, at hosted-model cost, without a 2,000-token system prompt of instructions it might ignore on the eighth agent step. You are not buying a model that knows more. You are buying a model that *behaves correctly under your policy*, cheaply, at volume.

## This is well-trodden ground, not a science project

It's worth stopping to say that none of this is exotic. If you're a decision-maker weighing whether this is a research bet or a known quantity: teaching a model to call tools by fine-tuning on tool-use traces is first-class, well-trodden practice. The "tool-use" and "instruct" variants of the open base models you'd be hosting are *produced this way*. The technique here — supervised fine-tuning on `system + tools → call → result → answer`, with the prompt masked so loss lands only on the model's own actions — and the architecture — *behaviour to the fine-tune, knowledge to tools and retrieval* — are textbook.

<figure class="art refs">
  <h4>Prior art — tool-calling fine-tuning</h4>
  <ul>
    <li><b>Toolformer</b> (Meta) — the model learns, by self-supervision, which API to call and when.</li>
    <li><b>Gorilla / BFCL</b> — the Berkeley Function-Calling Leaderboard, the de-facto benchmark for measuring function-calling behaviour.</li>
    <li><b>ToolBench / ToolLLM</b> — large-scale instruction tuning for general tool use.</li>
    <li><b>Functionary, Hermes, Glaive</b> — open models and datasets built specifically around structured tool-calling.</li>
  </ul>
</figure>

Three honest caveats, because the point is to make this decision soundly, not to sell it:

- **It is not the default.** Prompting a strong base model often suffices. Reach for a fine-tune when volume, conformance, or data-sovereignty pressure makes the hosted-and-frozen specialist worth the effort — not before.
- **You're training a specialist, not a general tool-caller.** One fixed tool set, one policy. That narrowness is a feature: it's what makes a small open model competitive with a frontier model on *this* task.
- **The proof is a behavioural eval, not a vibe.** The standard is BFCL-style: does the fine-tuned adapter actually beat the well-prompted base model on the cases that matter? Which is exactly why the eval set, below, is non-negotiable.

## The harness is the precondition

This is the part almost nobody states out loud, and it's the most important thing in this post.

<aside class="callout">
  <p class="callout-label">The core realization</p>
  <p>You cannot fine-tune the policy until you have built the harness. The tools <strong>are</strong> the action space the policy operates over — and using them is what generates the training data.</p>
</aside>

The harness is the set of tools the model acts through — the action space. The policy you want to enforce is *defined over that action space*: "look up the value before you apply it," "refuse if the question is out of scope," "prefer the action that holds your position when no strong option exists." None of those sentences mean anything until the tools they refer to exist. There is no policy to learn in the abstract; there is only correct and incorrect *use of specific tools*.

And there's a second reason, just as binding. **The harness is what generates your training data.** The traces you fine-tune on — system prompt, tool call, tool result, answer — are *recordings of the harness being used*. No harness, no traces. No traces, nothing to fine-tune. The data does not exist independently of the tools; it is a byproduct of running them.

So the order is not "collect data, then build tools, then fine-tune." It is: **design the harness first.** Define the tools, define the policy over them, and the data and the fine-tuning target both fall out of that definition. Teams that skip this and go looking for a dataset to fine-tune on are solving the second problem before the first one exists.

## The journey, in five moves

Put together, the migration off frontier models is a sequence, and each step produces the input the next one needs.

<figure class="art">
  <div class="flow">
    <div class="flow-step">
      <div class="flow-num">1</div>
      <h4>Build the harness on a frontier model</h4>
      <p>Use the strongest model as the bootstrapping engine and data generator. Design and harden the tools while it does the heavy lifting.</p>
      <span class="flow-out">→ a working action space</span>
    </div>
    <div class="flow-step">
      <div class="flow-num">2</div>
      <h4>Build the data-engineering pipeline</h4>
      <p>Turn harness usage into training traces. Unglamorous and decisive — it sets the ceiling on everything downstream.</p>
      <span class="flow-out">→ trainable traces</span>
    </div>
    <div class="flow-step">
      <div class="flow-num">3</div>
      <h4>Build the eval set — first, on purpose</h4>
      <p>Before you fine-tune anything. The single highest-leverage artifact, and the one most likely to be skipped.</p>
      <span class="flow-out">→ the definition of "good enough"</span>
    </div>
    <div class="flow-step">
      <div class="flow-num">4</div>
      <h4>Fine-tune open weights — A/B several</h4>
      <p>No model wins by default. Fine-tune a few candidates on the same data and let the eval set pick.</p>
      <span class="flow-out">→ a hosted specialist</span>
    </div>
    <div class="flow-step">
      <div class="flow-num">5</div>
      <h4>Close the loop</h4>
      <p>Keep collecting traces, evaluating, re-tuning. Frontier stays as fallback and teacher — no longer the high-volume core.</p>
      <span class="flow-out">→ continuous improvement</span>
    </div>
  </div>
  <figcaption class="art-cap">Each step's output is the next step's input. <b>Skip step 1 and there is nothing to fine-tune; skip step 3 and you can never prove you're allowed to leave.</b></figcaption>
</figure>

1. **Build the harness on a frontier model.** Use the strongest model you have as both the bootstrapping engine and the data generator. It's good enough to drive the tools correctly out of the box, which lets you design and harden the action space and the policy while the model does the heavy lifting. This is the frontier model's best and most durable role: teacher, not runtime.
2. **Build the data-engineering pipeline.** Turn harness usage into training traces. This is unglamorous and decisive in equal measure — formatting, masking the right tokens, splitting multi-step interactions so each decision is learnable, deduplicating the redundant cases, balancing the rare-but-critical ones. The quality of this pipeline sets the ceiling on everything downstream. (The next post is largely a tour of the ways I got this wrong.)
3. **Build the eval set — first, and on purpose.** Before you fine-tune anything. More on this below, because it is the single highest-leverage artifact in the whole process and the one most likely to be skipped.
4. **Fine-tune open weights, and A/B several of them.** There is no model that wins by default. Pick a few open-weight candidates in the size class you can host, fine-tune each on the same data, and let the eval set decide. The "best" base model for your policy is an empirical question, and it's cheap to answer once the eval exists.
5. **Close the loop.** Keep collecting traces from production, keep evaluating, keep fine-tuning. The frontier model stays in the architecture — as a fallback for the long tail and as the teacher for the next round of data — but it is no longer carrying the high-volume core.

## The eval set is the exit

If you take one operational instruction from this post, take this: **the eval set is your exit strategy from frontier models, and you cannot leave without it.**

Here is the logic. The only honest reason to move a workload from a frontier model to a fine-tuned open-weight model is that the open-weight model is *good enough at your specific task*. "Good enough" is not a feeling. It is a measurement against a fixed set of cases that represent the job — the right tool chosen, the right arguments, the policy honored, the out-of-scope question refused. That measurement *is* the eval set.

Without it, the migration is a leap of faith, and leaps of faith do not survive contact with a production incident. With it, the migration is a number: the fine-tuned model scores within tolerance of the frontier model on the cases that matter, at a fraction of the cost, so you cut over. The eval set converts "should we trust the cheaper model?" from an argument into a check.

It also tells you something the cost argument can't: *what the fine-tune actually bought you.* In my own build, the eval made it unambiguous that the base model already knew how to format a tool call and was already appropriately cautious — and that everything the fine-tune added was domain *policy*: which tool, and one specific situational rule the base model got wrong almost every time. That is the thesis of this entire series, confirmed by measurement rather than asserted.

<figure class="art">
  <div class="metric-grid">
    <div class="metric">
      <div class="metric-num">62 → 100</div>
      <p class="metric-label">Tool-name accuracy — which tool to call</p>
    </div>
    <div class="metric">
      <div class="metric-num">56 → 94</div>
      <p class="metric-label">Exact-call accuracy — right tool, right arguments</p>
    </div>
    <div class="metric">
      <div class="metric-num is-hot">8 → 82</div>
      <p class="metric-label">The one situational policy rule the base model kept missing</p>
    </div>
  </div>
  <figcaption class="art-cap">A specialist fine-tune vs. its own well-prompted base, on held-out cases. <b>Arg formatting and restraint barely moved — they were already good. Policy is what the fine-tune bought.</b> The full account is in the next post.</figcaption>
</figure> You don't get that clarity without the eval, and without that clarity you're fine-tuning blind.

Build it first. Build it before the data pipeline is even finished if you can. It is the contract that defines "done," and it is the bridge you actually walk across to get off frontier models.

## Why open weights, and why it's sharper in regulated work

Everything above is an economic argument that applies to anyone running agents at volume. In regulated and government settings — which is where I work — it stops being merely economic and becomes structural, for reasons that have nothing to do with token price:

- **Data sovereignty.** In a lot of public-sector and regulated-finance work, the data physically cannot leave the building. That alone removes the frontier-API option for the sensitive core of the workload and forces an on-premises, open-weight model. Fine-tuning is then how you lift that on-prem model up to the task.
- **Conformance and audit, baked in.** When the requirement is "always attach this disclaimer," "answer only from the retrieved source and cite it," "abstain when the source is silent," a fine-tune trained to *behave* that way is more defensible than a prompt that asks for it. The policy is in the model's behavior, demonstrable on the eval set, not riding on instructions that can be overridden mid-conversation.
- **No silent vendor drift.** A hosted model you fine-tuned and froze does not change underneath you when a provider ships a new version. For a system that has to pass the same audit next quarter as it did this one, *reproducibility is a feature*, and you only get it by owning the weights.
- **Unit economics at volume.** The same cost argument as everyone else, except the volumes in document triage, extraction, and classification are enormous and the tasks are narrow — which is precisely the profile where a hosted, fine-tuned specialist beats a frontier API by an order of magnitude.

The highest-yield fine-tunes in this setting are not chatbots. They're classification and extraction, structured and conformant output, grounded-and-citing retrieval behavior, and policy or guardrail enforcement — the unglamorous, high-volume, conformance-bound work that a regulated organization runs constantly and cannot send to someone else's API. That is the work that lands on fine-tuned open weights first, and hardest.

## Where this leaves you

The strategic picture, stated plainly:

- Frontier models are where you **start** and where you **bootstrap**. Keep using them for that. They are the best teacher and data generator you have.
- High-volume, policy-bound workloads will **land** on fine-tuned open-weight models, because agentic token volume makes the economics inevitable and, in regulated settings, because the data can't leave anyway.
- Fine-tuning buys you **behavior and policy enforcement**, not knowledge. Knowledge stays in tools and retrieval, where it remains correct and auditable.
- You cannot fine-tune the policy until you have **designed the harness**, because the tools are the action space the policy is defined over and the source of the training data.
- The **eval set is the exit.** It is the measurement that lets you leave frontier models on purpose instead of staying on them by default.

None of this is a reason not to start on a frontier model today. It's a reason to start *building the harness and the eval set now*, while you're on the frontier model, so that when the token reckoning arrives — and for agentic workloads at scale, it arrives — you have already built the bridge across it.

The next post is the other side of this: the hard, low-level account of actually doing it. I built a specialist agent on consumer hardware, and almost every lesson in this strategic picture I learned by getting the build wrong first — broken adapters, a memory wall, a training run that scored a near-perfect loss while emitting pure garbage. That's where the abstractions above turn into error messages.
