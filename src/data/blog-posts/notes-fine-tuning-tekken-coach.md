---
title: "Notes From Fine-Tuning a Tekken Coach"
slug: notes-from-fine-tuning-a-tekken-coach
publishDate: 8 Aug 2026
description: "The companion to 'The Token Reckoning.' The strategy post argued that high-volume agentic work lands on fine-tuned open weights, that fine-tuning buys policy and not knowledge, and that the harness comes first. This is the build that taught me all of it the hard way — a Tekken 8 frame-data and punish coach, fine-tuned locally on an M5 Max with MLX. Including the runs I burned: an adapter that trained itself into pure token soup behind a loss that never converged, a memory wall that crashed the whole machine, and a masking bug that trained 40 tokens out of 1,489."
---

<style>
/* Post-local styles — used only by this post's figures */

/* Domain primer box */
.primer {
  margin: 2.2rem 0;
  max-width: var(--measure);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--bg-soft);
  padding: 1.2rem 1.4rem;
}
.primer-label {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0 0 0.8rem;
}
.primer dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1.1rem; }
.primer dt { font-weight: 600; color: var(--fg); font-size: 0.9rem; font-family: var(--font-mono); }
.primer dd { margin: 0; color: var(--fg-dim); font-size: 0.92rem; line-height: 1.55; }

/* Inline tag pills (masked / trained, etc.) */
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
.tag.is-trained { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 50%, transparent); }
.tag.is-hot { color: var(--hot); border-color: color-mix(in srgb, var(--hot) 50%, transparent); }

/* Turn list — trace anatomy (which spans train vs are masked) */
.turns { display: flex; flex-direction: column; gap: 0.4rem; }
.turn {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--bg-soft);
  padding: 0.6rem 0.85rem;
}
.turn-role {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--accent);
  min-width: 5.5rem;
}
.turn-body { flex: 1; font-size: 0.88rem; color: var(--fg-dim); }
.turn.is-target { border-left: 3px solid var(--accent); }

/* SVG charts */
.chart { width: 100%; height: auto; display: block; }
.chart text { fill: var(--muted); font-family: var(--font-mono); font-size: 11px; }
.chart .axis { stroke: var(--rule); stroke-width: 1; }
.chart .grid { stroke: var(--rule); stroke-width: 1; stroke-dasharray: 2 4; opacity: 0.7; }
.chart .series { fill: none; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
.chart .wall { stroke: var(--hot); stroke-width: 1.5; stroke-dasharray: 5 4; }
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
.chart-legend i { display: inline-block; width: 15px; height: 3px; vertical-align: middle; margin-right: 0.45rem; border-radius: 2px; }

@media (max-width: 600px) {
  .primer dl { grid-template-columns: 1fr; gap: 0.15rem 0; }
  .primer dd { margin-bottom: 0.5rem; }
}
</style>

## Table of Contents

- [Why Tekken](#why-tekken)
- [Primer: the five terms you need](#primer-the-five-terms-you-need)
- [The first wall: the DoRA inference trap](#the-first-wall-the-dora-inference-trap)
- [The pivot: exact recall doesn't belong in weights](#the-pivot-exact-recall-doesnt-belong-in-weights)
- [Build the harness first](#build-the-harness-first)
- [The data is a byproduct of the harness](#the-data-is-a-byproduct-of-the-harness)
- [The masking spike: 40 tokens out of 1,489](#the-masking-spike-40-tokens-out-of-1489)
- [The memory wall](#the-memory-wall)
- [NaN loss: the truncation trap](#nan-loss-the-truncation-trap)
- [The broken adapter: token soup behind a loss that never converged](#the-broken-adapter-token-soup-behind-a-loss-that-never-converged)
- [The eval, measured against base](#the-eval-measured-against-base)
- [What generalizes](#what-generalizes)

---

In [the previous post](/blog/the-token-reckoning) I argued the strategy: high-volume agentic workloads will land on fine-tuned open-weight models, fine-tuning buys you *policy* rather than *knowledge*, and you cannot fine-tune the policy until you've built the harness. That post was the conclusion. This one is the evidence — the actual build that taught me every line of it, mostly by making me get it wrong first.

The build is a **Tekken 8 frame-data and punish coach**: an agent that answers "I blocked this move — what's my best punish?" correctly, using exact frame data. It ran entirely on a personal **M5 Max, 64 GB**, with **MLX / mlx-lm**, fine-tuning quantized Qwen models. No cloud, no API. The point was to feel every constraint directly.

## Why Tekken

The honest reason first: Tekken is close to my heart, and I still play it. For about two years after university in the Philippines it was more or less my life — I competed seriously, and it culminated in a top-10 national finish at one of the country's first national tournaments, on Tekken Tag Tournament 2. So this wasn't a neutral choice of toy domain. I know this game cold, and that turned out to matter for the build: when you're evaluating whether a model's advice is *correct*, there's no substitute for being able to look at an answer and know instantly that it's wrong.

The analytical reason: I needed a domain small enough to own completely but with both halves of the real problem in it. A fighting game fits this unusually well:

- **Exact recall.** Frame data is hundreds of precise integers — this move is 13 frames of startup, that one is −14 on block. Get a number wrong and the advice is not "slightly off," it's *dangerous*. This is the part that, in a real business, is your prices, your policy thresholds, your reference data.
- **Policy and judgment.** Given the exact numbers, *what should you do?* That's a procedure with rules: a blocked low has to be punished from a crouch, a launch is worth more than a poke, when nothing strong fits you hold your turn instead of trading. This is the part that, in a real business, is your process.

One small domain, both jobs. That's exactly the split the strategy post is about, which is why it was the right toy to build.

## Primer: the five terms you need

You don't need to play Tekken to follow this. Five terms carry the whole post.

<aside class="primer"><p class="primer-label">Domain primer</p><dl><dt>frame data</dt><dd>Every move's timing in frames (1/60s). The two that matter here: <b>startup</b> (how long until it hits) and <b>block advantage</b> (who moves first after it's blocked).</dd><dt>on block</dt><dd>A move that's "−14 on block" leaves the attacker recovering 14 frames slower than the defender. That gap is the punish window.</dd><dt>punish</dt><dd>After blocking an unsafe move, you hit back with something that fits in the gap. A guaranteed punish.</dd><dt>stance</dt><dd>Blocking a <b>low</b> forces you into a crouch, so only <b>while-standing</b> moves are valid as the punish. Getting this wrong is the classic mistake.</dd><dt>launcher</dt><dd>A move that on hit pops the opponent into the air for a full combo — the highest-value punish when the window allows it.</dd></dl></aside>

Everything below is just: get the numbers exactly right (a tools job), then apply the punish rules correctly (a fine-tuning job).

## The first wall: the DoRA inference trap

My very first fine-tune was a DoRA adapter on a 4-bit base. It trained fine. Then I served it and inference crawled at **4.1 tokens/sec**, and Activity Monitor showed the GPU barely working. The obvious reading — "it's not using the GPU" — was wrong, and chasing it would have wasted a day.

What's actually happening: a **DoRA adapter on a 4-bit base has no quantized fast-path in mlx-lm**. On every forward pass, `DoRALinear` dequantizes the base weight, runs a dense matmul, and recomputes a full weight-matrix norm. That's roughly 8× the work of the quantized kernel the base model would otherwise use. It *was* using the GPU the whole time — batch-1 decode is **memory-bandwidth-bound**, not compute-bound, so the GPU-compute percentage reads low even while the chip is saturated moving weights.

<figure class="art"><div class="bars"><div class="bar-row"><div class="bar-head"><span><b>DoRA adapter</b> on 4-bit base — dequant + dense matmul + norm every pass</span><span class="bar-val">4.1 tok/s</span></div><div class="bar-track"><div class="bar-fill is-hot" style="width:12%"></div></div></div><div class="bar-row"><div class="bar-head"><span><b>Fused / LoRA</b> — keeps the quantized kernel</span><span class="bar-val">~33 tok/s</span></div><div class="bar-track"><div class="bar-fill" style="width:100%"></div></div></div></div><figcaption class="art-cap"><b>Low GPU-compute % ≠ idle GPU.</b> Batch-1 decode is bandwidth-bound; the meter lies. The fix was to stop reading the meter and measure tokens/sec.</figcaption></figure>

The fix is either `mlx_lm.fuse` (fold the adapter into the base, keep it 4-bit, run with no adapter) or just train **LoRA** instead of DoRA, because LoRA uses `QLoRALinear` and keeps the quantized kernel. I switched to LoRA for everything after this, purely for fast adapter inference while iterating. First lesson, and it's a recurring one: **measure the thing you care about, don't infer it from a proxy meter.**

## The pivot: exact recall doesn't belong in weights

The more important early finding came once I actually chatted with the fine-tuned model. It had clearly learned the *language* of frame data — it talked like a Tekken coach, used the right structure, sounded fluent. And it could not be trusted to recall a single exact number.

This is not a training-harder problem. It's mechanical. A transformer stores facts diffusely across its feed-forward layers as a soft key-value memory, entangled with everything else it knows. A **low-rank adapter** adjusts a tiny slice of the weights — enough to shift *behavior*, nowhere near enough to reliably write hundreds of precise, arbitrary integers into memory. Worse, trying teaches the model to emit *confident, fluent, wrong* numbers, because it learned the shape of the answer without a reliable copy of the content.

So I stopped fighting it and split the responsibilities. This is the single most important architectural decision in the whole project:

<figure class="art"><div class="split"><div class="split-col"><h4>Facts → tools</h4><p>Frame data, name↔notation, exact numbers.</p><ul><li>Deterministic lookups over real data</li><li>Always correct, never hallucinated</li><li>Patch the data, not the model</li></ul></div><div class="split-col"><h4>Policy → fine-tune</h4><p>Which tool, stance rules, when to abstain.</p><ul><li>The punish procedure</li><li>The low→crouch→while-standing rule</li><li>Voice and restraint</li></ul></div></div><figcaption class="art-cap">The same split the strategy post argued for — discovered here the hard way, by watching a fluent model confidently invent frame data.</figcaption></figure>

## Build the harness first

Because facts are the tools' job, the tools came before any serious training. The data comes from **Wavu Wiki** (the community frame-data wiki, CC-BY-SA), pulled through its MediaWiki Cargo API. On top of that, three deterministic tools:

- `lookup_move(character, move)` — exact frame data for a move, by notation *or* name (fuzzy-matched, so "Electric Wind God Fist" resolves).
- `get_moves_for_frame_budget(character, frame_budget, stance)` — every move that fits a punish window, filtered by stance.
- `apply_move(...)` — given a blocked move's disadvantage, is a given punish actually guaranteed?

The policy lives in the **tool contract**, not in hope. `lookup_move` is a mandatory predecessor to `apply_move`. `get_moves_for_frame_budget` takes a `stance`, and when you've blocked a low it returns only while-standing moves. It also returns a `has_launcher` flag and the best on-block option, so the coaching rule — take the launcher if one fits, else take real damage, else hold your turn — is *grounded in tool output* rather than improvised by the model.

<figure class="art"><div class="flow"><div class="flow-step"><div class="flow-num">1</div><h4>Look up the blocked move</h4><p>Get its exact block disadvantage and whether it was a low. Always first — the rest depends on it.</p><span class="flow-out">→ −N frames, low/mid</span></div><div class="flow-step"><div class="flow-num">2</div><h4>Derive the stance</h4><p>Blocked a low? You're crouching, so only while-standing punishes are legal.</p><span class="flow-out">→ stance = crouching | standing</span></div><div class="flow-step"><div class="flow-num">3</div><h4>Get moves for the window</h4><p>Every punish that fits −N, filtered by stance, with launcher and best-on-block flags.</p><span class="flow-out">→ candidate punishes</span></div><div class="flow-step"><div class="flow-num">4</div><h4>Apply the policy</h4><p>Launcher if it fits; else solid damage; else hold your turn. The one rule the model has to learn.</p><span class="flow-out">→ the answer</span></div></div><figcaption class="art-cap">The harness encodes everything deterministic. The fine-tune only has to learn step 4's judgment and the stance reflex in step 2 — and, as the eval shows, that's exactly what it learned.</figcaption></figure>

This is what "design the harness first" means in practice. The action space *is* this set of tools and this contract. There is no policy to train in the abstract — only correct and incorrect use of these specific functions.

## The data is a byproduct of the harness

With the tools built, the training data writes itself — literally, because the traces *call the real tools*. `build_traces.py` generates tool-calling traces of the form `system + tools → tool call → tool result → answer`, where the tool results are the genuine JSON the tools return at inference time (so the model never trains on fabricated tool output). A deterministic skeleton drives the tool calls; an authored, seeded phrasing layer writes the natural-language around them.

Six trace types, deliberately including the two that aren't about calling a tool at all:

<figure class="art"><div class="turns"><div class="turn"><span class="turn-role">frame_data</span><span class="turn-body">single <code>lookup_move</code> — read one move's data</span></div><div class="turn"><span class="turn-role">punish_gen</span><span class="turn-body"><code>get_moves_for_frame_budget</code> — window + stance</span></div><div class="turn"><span class="turn-role">punish_chain</span><span class="turn-body"><code>lookup_move → get_moves</code> — the full derivation</span></div><div class="turn"><span class="turn-role">apply</span><span class="turn-body"><code>lookup_move → apply_move</code> — guaranteed or not</span></div><div class="turn"><span class="turn-role">abstain</span><span class="turn-body"><b>no tool</b> — don't call anything for a definition or mechanics question</span></div><div class="turn"><span class="turn-role">recovery</span><span class="turn-body">bad notation → tool error → retry the suggested move</span></div></div><figcaption class="art-cap"><b>abstain</b> and <b>recovery</b> are the ones that matter most and are easiest to forget: when <em>not</em> to call a tool, and how to recover when a call fails. 2,016 traces in total.</figcaption></figure>

That `abstain` type is the policy lesson hiding in plain sight: a tool-using model that calls a tool for *everything*, including "what is Heat?", is a worse agent than one that knows when the question doesn't need a tool at all.

## The masking spike: 40 tokens out of 1,489

Here's a bug that would have silently poisoned the whole run if I hadn't checked. mlx-lm's `--mask-prompt` (which makes loss fall only on the assistant's output, not the prompt) computes a **single mask offset = the length of `messages[:-1]`**. It masks everything up to the last message and trains the last message.

For a normal instruction pair that's correct. For a multi-turn tool trace it's a disaster. A trace is `system → user → assistant(tool call) → tool(result) → assistant(answer)`. With a single offset at the last message, **only the final answer trains** — every tool call in the middle is masked. I measured it on a real 2-tool trace:

```text
trace length:        1,489 tokens
trained (last msg):     40 tokens   ← only the final answer
masked:              1,449 tokens   ← BOTH tool calls, masked out
```

<figure class="art"><div class="bars"><div class="bar-row"><div class="bar-head"><span><b>What actually trained</b> — the final answer only</span><span class="bar-val">40 / 1,489</span></div><div class="bar-track"><div class="bar-fill is-hot" style="width:2.7%"></div></div></div></div><figcaption class="art-cap">Stock <code>--mask-prompt</code> on a tool trace trains <b>2.7%</b> of the tokens and masks both tool calls — exactly the behaviour you're trying to teach. The inverse, <code>mask_prompt=False</code>, is no better: it trains the <em>tool results</em> too, teaching the model to hallucinate JSON.</figcaption></figure>

Neither stock mode works. The fix that needs no patching of mlx-lm internals is **turn-splitting**: every assistant action becomes the *last* message of its own training row. A 2-tool chain becomes 3 rows — one ending at the first tool call, one ending at the second, one ending at the answer — so each row trains exactly the action you want, under the stock masker. The cost is re-encoding the long tool-schema prefix per row, which for a learning run is fine. 2,016 traces expanded to **4,886 rows** this way.

(There was a second, gnarlier masking issue — a reasoning-model template injecting a phantom `<think>` block into the target, and a `RecursionError` when I tried to shim it off because `TokenizerWrapper` forwards attribute writes to the inner tokenizer. The short version: clear the `_think_start` attribute instead of monkeypatching the method, and the empty think block lands on the masked side of the offset. Niche enough to footnote.)

## The memory wall

This is the one that cost the most time and crashed my Mac. With the trace data ready, every attempt to train OOM'd — `[METAL] Insufficient Memory` — even at batch 1 with gradient checkpointing. One diagnostic probe locked almost all of unified memory resident (it called `set_wired_limit(55.7GB)`) and took the whole machine down with it.

The root cause is specific and worth knowing if you train any linear-attention model on Metal. The Qwen3.5/3.6 architecture's attention block calls:

```python
gated_delta_update(..., use_kernel=not self.training)
```

The fast, memory-efficient custom Metal kernel is used **only in eval mode**. In *training* mode it takes a differentiable fallback — the exact thing the kernel exists to avoid — and that path is enormous. A probe that forgot `model.train()` actually errored with `[Primitive::vjp] Not implemented for CustomKernel`, which is how I found the branch in the first place. Measured, the differentiable path costs about **40 GB at sequence length 512** for the 27B dense model, and OOMs by 1024.

Worth being precise about *why*, because it's easy to misread this as a bug you could patch by upgrading. It isn't. A kernel built with `mx.fast.metal_kernel` is a `CustomKernel` primitive with **no VJP registered** — MLX custom kernels simply aren't differentiable unless someone hand-writes the backward pass with `@mx.custom_function`. So the eval-only kernel plus a differentiable training fallback is the *intended* design, not a missing feature; no version bump makes the kernel trainable on its own. The proper fix, if you actually need the kernel path during training, is to give it a custom VJP — which is exactly what **Unsloth** ships for this architecture (a memory-efficient GatedDeltaNet VJP via `@mx.custom_function`). That's the lever that would have let me train through a lean kernel instead of the giant fallback, and it's what I'd reach for next time rather than fighting the fallback's memory profile.

The reason my very first 2-character run trained fine is that its sequences were a few hundred tokens. The trace rows carry a ~1,240-token tool-schema prefix, pushing every row past the wall.

<figure class="art"><svg class="chart" viewBox="0 0 640 300" role="img" aria-label="GPU memory versus sequence length, approaching the wired-memory wall"><rect x="52" y="40" width="560" height="15.8" fill="var(--hot)" opacity="0.09"></rect><line class="wall" x1="52" y1="55.8" x2="612" y2="55.8"></line><text class="lbl" x="606" y="51" text-anchor="end">55.7 GB wired limit — crash zone</text><line class="grid" x1="52" y1="186.7" x2="612" y2="186.7"></line><line class="grid" x1="52" y1="113.3" x2="612" y2="113.3"></line><line class="axis" x1="52" y1="40" x2="52" y2="260"></line><line class="axis" x1="52" y1="260" x2="612" y2="260"></line><text x="44" y="264" text-anchor="end">0</text><text x="44" y="190" text-anchor="end">20</text><text x="44" y="117" text-anchor="end">40</text><text x="44" y="44" text-anchor="end">60</text><polyline class="series" style="stroke:var(--accent)" points="52,150 239,122 425,95 612,58"></polyline><circle class="dot" style="fill:var(--accent)" cx="52" cy="150" r="4"></circle><circle class="dot" style="fill:var(--accent)" cx="239" cy="122" r="4"></circle><circle class="dot" style="fill:var(--accent)" cx="425" cy="95" r="4"></circle><circle class="dot" style="fill:var(--hot)" cx="612" cy="58" r="4.5"></circle><text x="52" y="278" text-anchor="middle">512</text><text x="239" y="278" text-anchor="middle">1024</text><text x="425" y="278" text-anchor="middle">1536</text><text x="612" y="278" text-anchor="middle">2048</text><text class="lbl" x="600" y="74" text-anchor="end">OOM</text></svg><div class="chart-legend"><span><i style="background:var(--accent)"></i>27B dense, grad-checkpoint on (GB vs sequence length)</span></div><figcaption class="art-cap">Grad-checkpoint flattens the cross-layer term but <b>not</b> the per-layer differentiable attention or the 248k-vocab logits, both of which scale with sequence length. The climb runs straight into the wall.</figcaption></figure>

The fix was three levers together, not one:

1. **Switch to the MoE base** (`Qwen3.6-35B-A3B-4bit`). Same model family, so the traces render identically — same vocab, same tool-call template, zero rework — but the active parameter count per token is far smaller.
2. **Trim the tool schema.** The 41-character `enum` and verbose prose in the tool definitions were costing ~1,240 tokens of prefix on every row. Cutting them brought the schema to **551 tokens** and roughly halved the median row length.
3. **Collapse the system prompt.** Since the fine-tune learns the policy *from the traces*, the ~200-token coaching prompt was redundant scaffolding. I cut it to **~19 tokens**, kept identical across training and all inference paths.

Then grad-checkpoint on, `max_seq_length` 1024, batch 1, 8 adapted layers. But the lesson underneath the fix is the one I'd carry to any local training: **size for the whole machine, not the framework's ceiling.** My early probes measured MLX's active peak on an idle Mac. The real run failed anyway, because the trainer wires 55.7 GB at startup, the process RSS includes MLX's reclaimable cache, and my own editor and browser were eating 10–15 GB. A step that's "49.8 GB active" in isolation is a crash on a working machine. Never fill to the framework's limit, and never `set_wired_limit` high on the machine you're sitting at.

## NaN loss: the truncation trap

With memory finally fitting, the first run posted **iter-1 validation loss = `nan`**. NaN gradients poison everything downstream, so this had to be understood, not silenced.

The cause: mlx-lm **truncates** over-length rows from the *end*. A long chain's prompt-plus-prefix can exceed `max_seq` on its own, so the entire answer — the only part with loss — gets cut. Zero loss tokens on that row, `0/0`, NaN, and the NaN propagates.

The fix is to **filter, not truncate**: drop any row whose tokenized length exceeds `max_seq` before training, and report how many per split. Nothing gets silently half-trained, no targets vanish. About 15% of rows dropped at 1024 — all long chains, whose short *tool-call* rows (from turn-splitting) still train. Validation loss came back finite at 2.341. Truncation-from-the-end is a quietly dangerous default; if your loss ever goes NaN on step one, suspect it.

## The broken adapter: token soup behind a loss that never converged

A full 2,000-iteration run at lr 1e-4 finished, and its loss never actually converged — it bounced erratically the whole way, roughly **2.0 → 0.4**, averaging around **1.0**, which I'd waved off as batch-1 noise on a small batch size. I loaded the adapter and asked it to say hello. It replied:

```text
soup., the and the, a and a. the, soup and the a...
```

Pure token soup, on *"hello"*. A loss that never settled and a completely broken model. The diagnosis had to be systematic because my first guess (that adapting the MoE router had broken it) was wrong:

1. **Weights are sane** — zero NaN/inf, max magnitude 0.07. Not numerical divergence.
2. **Router hypothesis** — zeroing the adapted router/gate modules left it just as broken. Wrong cause.
3. **Scale sweep** — at adapter scale 2 it generated coherent text; at scale 20 (mlx-lm's *default*) it was garbage. So the default scale wasn't a misconfiguration in itself.
4. **Checkpoint sweep** — broken from iter 200 onward. Never coherent. Bad from early, not gradually over-trained.

The root cause ties it together: the LoRA **scale multiplies the gradients flowing into the adapter**, so the default scale of 20 is built to pair with a small learning rate (~1e-5). I had run **lr 1e-4 × scale 20 ≈ 10× the intended effective step**. The adapter lurched into a destructive direction within ~200 iterations, and the loss never recovered — it just bounced around ~1.0 for the rest of the run, which looked enough like batch-1 jitter that I didn't read it as divergence.

The most painful part: the warning was there the whole time, in the *shape* of the loss. In the first ~30 iterations it *rose*, 2.78 → 3.84 — and then, instead of settling, it bounced erratically between roughly 2.0 and 0.4 and never converged. I rationalized the early rise as warmup and the bouncing as small-batch noise. It was neither: it was the adapter training itself into garbage in real time, and I let a 2,000-iter run play out on top of it.

<figure class="art"><svg class="chart" viewBox="0 0 640 290" role="img" aria-label="Training loss: a broken high-learning-rate run versus a healthy run"><line class="grid" x1="48" y1="195" x2="612" y2="195"></line><line class="grid" x1="48" y1="140" x2="612" y2="140"></line><line class="grid" x1="48" y1="85" x2="612" y2="85"></line><line class="axis" x1="48" y1="30" x2="48" y2="250"></line><line class="axis" x1="48" y1="250" x2="612" y2="250"></line><text x="42" y="254" text-anchor="end">0</text><text x="42" y="199" text-anchor="end">1</text><text x="42" y="144" text-anchor="end">2</text><text x="42" y="89" text-anchor="end">3</text><text x="42" y="34" text-anchor="end">4</text><text x="48" y="268" text-anchor="middle">0</text><text x="330" y="268" text-anchor="middle">200</text><text x="612" y="268" text-anchor="middle">400 iters</text><polyline class="series" style="stroke:var(--accent)" points="48,189 118,219 189,233 330,247 471,249 612,250"></polyline><polyline class="series" style="stroke:var(--hot)" points="48,97 69,85 90,39 133,162 175,135 231,223 302,151 386,225 471,168 556,217 612,184"></polyline><circle class="dot" style="fill:var(--hot)" cx="90" cy="39" r="4"></circle><text class="lbl" x="100" y="34">early rise</text><text class="lbl" x="608" y="120" text-anchor="end">bounces ~1.0 — never converges</text></svg><div class="chart-legend"><span><i style="background:var(--hot)"></i>lr 1e-4 × scale 20 (broken)</span><span><i style="background:var(--accent)"></i>lr 1e-5 (healthy)</span></div><figcaption class="art-cap">The broken run's loss rose early, then bounced erratically around ~1.0 and <b>never converged</b> — which I dismissed as batch-1 noise. The healthy run descended smoothly to near-zero (and the ~0.001 / 0.009 figures belong to <em>it</em>, not the broken run). <b>The shape of the loss was the signal</b>, and free-generation confirmed it.</figcaption></figure>

The fix was a single change — **lr 1e-4 → 1e-5** — and the retrain was visibly healthy: a smooth descent, no early rise, validation 1.077 → 0.009 by iter 200. Three durable practices came out of it:

- **Tune the learning rate relative to the adapter scale**, not in isolation. They multiply.
- **Validate free generation, cheaply and early.** I built `check_adapter.py`, a fast tool-free generation check, so a broken adapter is caught in minutes at iter 200 instead of after a full run.
- **Write the adapter config up front.** It used to be written only on clean exit, so a Ctrl-C (which I now use to stop early) left checkpoints unloadable. Writing it before the training loop makes every checkpoint recoverable.

Loss bottomed out near zero by iter ~300 — templated targets memorize fast — so the risk had flipped from under- to over-training. I stopped at iter 400 and kept iter 200 for an A/B.

## The eval, measured against base

None of the above means anything without a number that says the fine-tune *worked*, and "worked" has to be measured against the well-prompted base model — the delta is the whole point.

The eval harness (`eval_suite.py`) is fully deterministic — no LLM judge anywhere in the loop. It works as follows:

- **Teacher-forced, per-decision.** Each of the 482 held-out trace rows is rendered up to its final message, with ground-truth prior tool results in the prefix. The model greedily decodes (temperature 0) its next action, which is compared against the row's target. Each decision is judged in isolation, so one early mistake can't cascade through the rest of a chain.
- **Three expected action kinds.** A row's target is either a specific tool call, an abstention (mechanics question — correct means *no* call emitted), or a final answer after tools (correct also means no spurious call).
- **Exact match after normalization.** Tool name must match exactly. Arguments are normalized first — casing, string-vs-integer, character-name canonicalization — then compared exactly, overall and per-argument. No partial credit, no fuzzy scoring.
- **Execution validity.** Every call the model emits is additionally *run against the real tools*; a call that errors is counted, even if it was never the expected action.

The same suite runs against each checkpoint and the base model, writing a JSON scorecard and a per-row CSV per run. Because decoding is greedy and grading is exact, the numbers are reproducible run to run.

<figure class="art"><svg class="chart" viewBox="0 0 640 300" role="img" aria-label="Eval metrics, base model versus fine-tuned adapter"><line class="grid" x1="44" y1="205" x2="620" y2="205"></line><line class="grid" x1="44" y1="150" x2="620" y2="150"></line><line class="grid" x1="44" y1="95" x2="620" y2="95"></line><line class="grid" x1="44" y1="40" x2="620" y2="40"></line><line class="axis" x1="44" y1="40" x2="44" y2="260"></line><line class="axis" x1="44" y1="260" x2="620" y2="260"></line><text x="38" y="264" text-anchor="end">0</text><text x="38" y="209" text-anchor="end">25</text><text x="38" y="154" text-anchor="end">50</text><text x="38" y="99" text-anchor="end">75</text><text x="38" y="44" text-anchor="end">100</text><rect x="82" y="124" width="36" height="136" style="fill:var(--muted)"></rect><rect x="125" y="40" width="36" height="220" style="fill:var(--accent)"></rect><text x="100" y="118" text-anchor="middle">62</text><text x="143" y="34" text-anchor="middle">100</text><rect x="220" y="137" width="36" height="123" style="fill:var(--muted)"></rect><rect x="263" y="53" width="36" height="207" style="fill:var(--accent)"></rect><text x="238" y="131" text-anchor="middle">56</text><text x="281" y="47" text-anchor="middle">94</text><rect x="358" y="242" width="36" height="18" style="fill:var(--muted)"></rect><rect x="401" y="80" width="36" height="180" style="fill:var(--accent-2)"></rect><text x="376" y="236" text-anchor="middle">8</text><text x="419" y="74" text-anchor="middle">82</text><rect x="496" y="51" width="36" height="209" style="fill:var(--muted)"></rect><rect x="539" y="62" width="36" height="198" style="fill:var(--accent)"></rect><text x="514" y="45" text-anchor="middle">95</text><text x="557" y="56" text-anchor="middle">90</text><text x="143" y="278" text-anchor="middle">tool-name</text><text x="281" y="278" text-anchor="middle">exact-call</text><text x="419" y="278" text-anchor="middle">stance ★</text><text x="557" y="278" text-anchor="middle">abstain</text></svg><div class="chart-legend"><span><i style="background:var(--muted)"></i>base</span><span><i style="background:var(--accent)"></i>fine-tuned (iter 400)</span><span><i style="background:var(--accent-2)"></i>stance — the largest gain</span></div><figcaption class="art-cap">The stance rule (low → punish from a crouch) went from <b>8% to 82%</b>. Abstention dropped slightly — the one honest regression. The full table is below.</figcaption></figure>

The full numbers:

| metric | base | iter 200 | iter 400 |
|---|---:|---:|---:|
| Tool-name accuracy | 62.2 | 94.4 | **100.0** |
| Exact-call accuracy | 55.7 | 92.1 | **93.6** |
| Stance (low→crouching) ★ | 8.2 | 73.7 | **82.2** |
| Abstention | 95.2 | 85.7 | 90.5 |
| Arg · character | 100 | 100 | 100 |
| Arg · move_id | 95.2 | 97.1 | 97.6 |
| Arg · frame_budget | 100 | 100 | 100 |
| Termination | 88.2 | 71.9 | 81.5 |
| per-tool: lookup / get_moves / apply | 49 / 100 / 50 | 100 / 78 / 100 | **100 / 100 / 100** |

The distribution of the gains matters more than the headline numbers. Look at *where* the base model was already good and where it wasn't. Base nailed **argument formatting** (character 100, frame_budget 100) and was **appropriately restrained** (abstention 95, termination 88). It already knew *how* to emit a well-formed tool call. What it lacked was the **domain policy**: *which* tool to call (lookup 49%, apply 50% — coin-flips), and the **stance rule**, which it got right 8% of the time.

That is exactly, and only, what the fine-tune moved. Tool selection went to 100, stance to 82. Formatting and restraint barely changed because they didn't need to. **Facts and format were never the model's job — the tools handle them. Policy was the job, and policy is what the fine-tune bought.** The architecture from the strategy post, confirmed in a table.

The honest caveat: the fine-tune slightly *eroded* the base's restraint — abstention 95 → 90, termination 88 → 81. It traded a little "don't over-call" for large gains in tool-selection and stance. For a v2 I'd upweight the `abstain` and answer-termination traces to claw that back. iter 400 was the keeper over iter 200 across the board, and the over-training I'd worried about at near-zero loss didn't actually bite by 400 — behavioral generalization kept improving after the loss flatlined, which is its own lesson about not trusting the loss curve's last decimal.

If you want to check the numbers yourself, the raw eval outputs — per-row results CSVs and metric JSONs for base, iter 200, and iter 400 — are committed in [`lora-blog-series/eval_runs`](https://github.com/justinbarias/justinbarias.github.io/tree/master/lora-blog-series/eval_runs) in this site's repo.

## What generalizes

Strip away the fighting game and these are the things I'd carry to any fine-tuning project, regulated or not:

- **Deterministic → tool, fuzzy → fine-tune.** Anything with a single right answer (exact values, name↔notation, the stance rule) goes in code. The adapter is for judgment.
- **Know your masking.** The single-offset `--mask-prompt` would have trained 2.7% of the right tokens silently. Inspect what actually trains.
- **Size memory for the whole machine.** The framework's active peak is not your real budget; the OS, the cache, and your own apps are in the same pool.
- **Filter, don't truncate.** End-truncation turns long rows into zero-loss NaN bombs.
- **Tune lr relative to adapter scale.** They multiply; the default scale wants a small lr.
- **A non-converging loss is a warning, not batch noise.** The broken run's loss rose early, then bounced ~2.0 → 0.4 and never settled — I rationalized it as batch-1 jitter when it was the adapter training itself into garbage. Watch the *shape*, and validate free generation early and cheaply (`check_adapter.py`); the loss curve was telling me the truth and I under-read it.
- **Always eval against base.** The headline isn't the adapter's score, it's the delta — and the delta tells you *what the fine-tune actually bought.* Here it bought policy, not knowledge.

That last point is the bridge back to [the strategy post](/blog/the-token-reckoning): the harness made the facts correct, the eval showed the policy moved, and the whole thing runs on a laptop. That is the migration path off frontier models the strategy post describes, demonstrated at small scale.
