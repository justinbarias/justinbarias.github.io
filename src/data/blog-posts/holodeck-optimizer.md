---
title: "Your Eval Suite Is Already a Loss Function"
slug: your-eval-suite-is-already-a-loss-function
publishDate: 06 Jun 2026
description: "Everyone tuning an agent runs the same manual loop: change a knob, re-run the evals, squint at the score, repeat. But the moment you wrote an eval suite, you defined a loss function. You just weren't optimizing against it. This post walks the theory, and how I turned it into `holodeck test optimize`: a coordinate-descent optimizer that tunes the numbers with Optuna and the prompt with an LLM standing in for the gradient."
---

## Table of Contents

- [The loop everyone runs by hand](#the-loop-everyone-runs-by-hand)
- [The eval suite was a loss function the whole time](#the-eval-suite-was-a-loss-function-the-whole-time)
- [Two problems: no gradient, and mixed axes](#two-problems-no-gradient-and-mixed-axes)
- [Coordinate descent, with an LLM for the text](#coordinate-descent-with-an-llm-for-the-text)
- [How it fits into holodeck](#how-it-fits-into-holodeck)
- [Acceptance, and the part I haven't solved yet](#acceptance-and-the-part-i-havent-solved-yet)
- [What you get out the other end](#what-you-get-out-the-other-end)
- [Where this goes next](#where-this-goes-next)

---

A couple of days ago I gave a talk at [AI Engineer Melbourne](https://webdirections.org/ai-engineer/speakers/justin-barias.php) called *"Stop vibing your agents to production: applying ML discipline to agent development."* The whole argument was that we already know how to do this. It's just ML engineering, wearing a different hat. Version your artifacts. Treat your evaluators as loss functions. Search your hyperparameters instead of guessing at them. Near the end I said, more or less out loud, that I was building an optimizer into HoloDeck to close the loop on that last part. This post is that optimizer.

So let me start where the talk started, with the loop everyone runs by hand. If you've shipped an agent, you've run it. You change the temperature, or you reword a paragraph of the system prompt, you re-run your evaluations, you look at the numbers, and you decide whether that was better or worse. Then you do it again. And again. You stop when the scores look decent or when you run out of patience, whichever comes first.

I've done this enough times that I started to resent it. Not because it doesn't work, but because of *how* it works. It's slow, it's driven by vibes, and the gains don't stack. The point of the talk, and of this post, is that the loop is something with a name, and once you name it you can hand it to a machine. Below is the realisation, and what I built into [HoloDeck](https://docs.useholodeck.ai/) once I had it.

## The loop everyone runs by hand

The loop, drawn out: pick a change, re-run the suite, eyeball the result, go around again.

![The manual agent-tuning loop: pick a change (a knob or a prompt reword), re-run the full eval suite, eyeball whether the scores got better, and loop. Keep the change if it looks better, revert if it looks worse, and stop when you're tired rather than when it converged.](https://justinbarias.io/assets/blog/holodeck-optimizer-01-manual-loop.png)

Three things are wrong with it.

It's tedious. Every pass is a full eval run, real model calls, real metric work, and you're babysitting a terminal while it grinds. Annoying, but you can live with it.

Worse: you're flying blind. You tighten the prompt, conciseness ticks up, you move on. A day later you notice groundedness dropped two points back when you made that edit, and you never caught it because you were watching the number you were trying to move, not the one you broke. I can't track six metrics by eye across a dozen edits. Neither can you.

And the edits don't stack. Every one is judged on its own, against whatever the agent looked like a moment ago, and there's no record of the path you took. You can't tell whether you're climbing or wandering. You stop because you're tired, not because you got somewhere.

## The eval suite was a loss function the whole time

This is the thing I'd been walking past. The reason you can run this loop at all is that you already have an evaluation suite. Some metrics (groundedness, conciseness, a custom G-Eval criterion, whatever), each one scoring the agent's answers on your test cases, each one producing a number.

Collapse those numbers into one. Weight the metrics by how much you care, take a weighted mean, and define:

```
loss = 1 − weighted_mean
```

Perfect agent scores 1.0 everywhere, so loss is 0.0. Worse agent, higher loss. That's a loss function: the scalar an optimizer minimizes. I'd been computing it by hand and eyeballing it every run; I just never called it that.

And once "better" is a *number that goes down*, the manual loop stops being a craft and starts being a search. "Change something, re-run, keep it if the number dropped" is not vibes anymore. It's the inner loop of an optimizer, run by a human who doesn't know that's what they're doing.

So why am *I* in this loop? I had the loss function and a way to score it. I just wasn't optimizing against it; I was the optimizer, running by hand, one slow trial at a time.

## Two problems: no gradient, and mixed axes

If this were a normal optimization problem, you'd reach for gradient descent and be done. It isn't, for two reasons, and both reasons shape everything that follows.

**There's no gradient.** The loss comes out the far end of a pile of LLM calls and metric judges. You can't differentiate it. Nudge the temperature by 0.01 and you have no analytic handle on which way the loss moved; you can only run the whole suite again and find out. This is the world of *derivative-free* optimization, and it's well-trodden: when you can't compute a gradient, you sample.

**The axes aren't the same kind of thing.** Some of what you tune is numeric and continuous: `model.temperature`, a retriever's `top_k`, a `min_score` threshold. You can put those on a number line. But the single biggest lever on an agent's behaviour is the *instruction text*, and text doesn't live on a number line. "Rewrite this paragraph to be firmer about citing sources" is not a step in any direction you can express as a float.

So you've got a non-differentiable objective over a search space that's part numbers, part prose. That combination is exactly what makes this awkward, and it's also what points straight at the technique that fits.

## Coordinate descent, with an LLM for the text

When you can't move all your variables at once, you move them a group at a time. Freeze most of the axes, optimize the rest, then switch which ones are frozen. That's **coordinate descent**, and it's the oldest trick in the derivative-free book. It's a clean fit here, because the two kinds of axis want completely different machinery.

For the numbers, freeze the text and run a real numeric optimizer over the knobs. I use [Optuna](https://optuna.org/)'s TPE sampler: it models which regions of the parameter space tend to produce low loss and samples the promising ones, instead of blindly gridding. That's the **numeric phase.**

For the text, freeze the numbers and do the thing you can't do with a number line, but borrow the *shape* of gradient descent anyway. In real gradient descent the gradient tells you which direction reduces the loss. Here, a **Critic** model plays that role: it looks at the cases the agent is currently failing and writes, in plain language, what's wrong and which way to push, a natural-language "gradient." Then an **Applier** model takes that critique and rewrites the instructions accordingly. Score the rewrite. If it's better, keep it and critique again from there; if not, the chain doesn't advance. That's the **textual phase**: iterative refinement, each step building on the failing cases the last one left behind.

I didn't invent this part. It's the [TextGrad](https://arxiv.org/abs/2406.07496) framing (Yuksekgonul et al., 2024): treat the natural-language critique as a "gradient" and the rewrite as a step in its direction, iterating in place the way real gradient descent updates a variable. The same lineage runs through OPRO, ProTeGi, and DSPy. Splitting it into two separate calls, one that *describes* the gradient and one that *applies* it, is what keeps the whole thing legible: you can read exactly why each rewrite happened, and you could ablate either half. The textual phase is that loop, gated so only a rewrite that actually lowers the loss advances the best agent.

One numeric phase followed by one textual phase is a **cycle**. And the reason you cycle, rather than tuning numbers once and text once and calling it done, is that they interact. The best temperature for one set of instructions isn't the best temperature for the rewritten ones. So you go around again: re-tune the numbers now that the text has moved, then re-tune the text now that the numbers have moved. Each kind of change compounds on the other's gains.

![Coordinate descent across two cycles. Each cycle is a numeric phase (freeze the text, tune the numbers with Optuna TPE) followed by a textual phase (freeze the numbers, a Critic writes the gradient and an Applier rewrites). One advancing baseline governs both: a trial only sticks if it beats the current best by min_delta. The best candidate carries forward into the next cycle, and the single lowest-loss candidate across every trial is written out as best.yaml.](https://justinbarias.io/assets/blog/holodeck-optimizer-02-coordinate-descent.png)

The compounding is the whole point, and it's what the manual loop can't give you. There's a single **baseline**, the best candidate found so far, and it only ever moves forward. A trial is accepted only if it beats that baseline. The baseline never moves backward, so every accepted change is measured against the best version of everything that came before it, not against whatever you happened to be looking at a minute ago.

## How it fits into holodeck

This is `holodeck test optimize`. If you already have an `agent.yaml` with an evaluations block, you add one more section, `evaluations.optimizer`, declaring the loss weights and which axes the optimizer is allowed to touch.

```yaml
evaluations:
  metrics:
    - type: standard
      metric: groundedness
    - type: geval
      name: Conciseness
      criteria: "The response is concise and avoids redundancy."
  optimizer:
    loss:                       # metric weights; loss = 1 - weighted_mean
      groundedness: 2.0
      Conciseness: 1.0
    axes:
      numeric:                  # query-time hyperparameters (Optuna TPE)
        - path: model.temperature
          type: float
          range: [0.0, 1.0]
        - path: tools[name=knowledge_base].top_k
          type: int
          range: [3, 12]
      textual:                  # instruction text rewritten by Critic/Applier
        - path: instructions.inline
          max_chars: 6000
    max_cycles: 3
    numeric_phase: { max_trials: 12, patience: 5 }   # patience: give up after 5 non-improving trials
    textual_phase: { max_trials: 5, patience: 3 }
    min_delta: 0.01             # minimum loss reduction required to accept
    seed: 42
```

Then you run it:

```bash
holodeck test optimize agent.yaml
```

It streams the loss of every trial as it goes, and prints a baseline → best summary at the end.

The vocabulary is worth pinning down, because the whole thing nests neatly and the words mean specific things. Smallest to largest:

| Term | What it is |
| --- | --- |
| **Trial** | The atomic unit. One candidate config, scored once = one full eval pass over your test set = one `loss` number. Every row in `trials.jsonl` is a trial. |
| **Phase** | A sweep over *one kind of axis*. The numeric phase tunes the numbers via Optuna; the textual phase rewrites instructions. Each phase runs many trials. |
| **Cycle** | One numeric phase followed by one textual phase: freeze the text and tune the numbers, then freeze the numbers and tune the text. |
| **Baseline** | The best candidate so far. The bar every trial must beat (by `min_delta`) to be accepted. Starts as the unchanged agent, scored once. |

Drawn as a tree, the run nests run → cycle → phase → trial, with each trial bottoming out in one real evaluation pass:

![How a run nests. A RUN with max_cycles runs a baseline scoring plus a series of cycles. Each cycle contains phases (numeric via Optuna, or textual via Critic/Applier). Each phase runs trials, where one trial is one candidate config scored by a full eval pass: real LLM and metric work, which is what costs tokens and wall-time. Patience bounds each phase, stopping it early once N trials in a row fail to improve.](https://justinbarias.io/assets/blog/holodeck-optimizer-03-run-nesting.png)

The budgets matter because of that bottom row. Every trial is a real evaluation run, so the number of trials is the main driver of how long the optimization takes and how many tokens it burns. Three knobs bound it. `max_cycles` caps the outer loop. Each phase's `max_trials` is a *ceiling* on its trials, not a quota it has to fill. And `patience` is the early-stopping rule borrowed straight from training loops: count the trials in a row that fail to beat the current best, and once that count hits the patience value, the phase gives up and moves on. A `patience: 5` numeric phase quits after five consecutive misses, even if it had budget for more. So the example above is *up to* `3 × (12 + 5) = 51` trials plus the baseline, and in practice usually far fewer, because phases stop the moment they stall instead of grinding through their whole ceiling.

One detail I care about: **your original `agent.yaml` is never touched.** The optimizer overlays its candidate changes on an in-memory copy. The best candidate gets written to a separate `best.yaml`, with secrets kept templated as `${VAR}`. The file is rebuilt from the un-substituted source, so it never leaks a resolved credential. You review the result and copy it over yourself, if you want it.

## Acceptance, and the part I haven't solved yet

The accept rule is deliberately strict. A candidate's loss has to *undercut the current best by more than `min_delta`*. Ties don't count. A change that's 0.001 better than the baseline when `min_delta` is 0.01 is treated as noise and rejected. This is what keeps the baseline meaningful: it only advances on changes big enough to believe in.

A couple of smaller decisions fall out of taking the loss seriously. Metric runs that *error* are excluded from the mean rather than scored as zero, because an exception talking to a judge model shouldn't masquerade as "the agent gave a terrible answer." But a legitimate `0.0` score is kept, because that one *is* the agent being bad.

One caveat, and it's a real one. This is an MVP. Acceptance is just the raw loss delta: no holdout split, no repeated trials, no variance bar. So on a noisy suite, a small `min_delta` chases the noise: the optimizer "finds" a win that's really two test cases flipping by luck, accepts it, and builds everything after on top of a number that meant nothing. Set `min_delta` high enough that a single case flipping can't clear it.

That's a patch, not a fix. The fix is variance-aware acceptance: holdout splits, repeated scoring, a real significance bar. It's the v1 follow-up, and the single biggest thing between this and something you'd trust unattended.

A second rough edge: today the run only persists its full state at the end. Each trial is live, billable, and minutes long, so a process that dies mid-run throws away work you've already paid for. That one's already designed (below) and mostly a matter of building it.

## What you get out the other end

Every run writes a `results/optimizer/<run-id>/` directory:

- **`best.yaml`**: the best candidate, ready to copy over your original. Secrets stay templated.
- **`trials.jsonl`**: one record per trial. The full audit trail: every config tried, its loss, whether it was accepted. This is the thing the manual loop never gave you, a record of the actual path, not just the endpoint.
- **`report.md`**: baseline versus best, the edits that were accepted, and a per-phase summary.

And because every trial is a real `holodeck test` run under the hood, it inherits the same observability wiring. If your agent has an `observability` block pointed at an OTLP collector, the optimize run exports a span tree (root, baseline, cycle, phase, trial) with each trial's evaluation spans nesting underneath, plus metrics for trial loss, best loss after each accepted improvement, and the overall baseline-to-best improvement. You can literally watch the loss come down in Grafana or Aspire, trial by trial. When observability is off, none of that fires and the optimizer behaves exactly as before, same as the rest of HoloDeck.

The trial spans carry only primitives, by the way: numeric params as a JSON string, the textual axis *name*, and a short human-readable edit summary. Never the instruction text and never a resolved secret. The same restraint as `best.yaml`, for the same reason.

## Where this goes next

The MVP stops at "find candidate improvements against quality." Three things take it further, and none of them require tearing up what's already there.

**Variance-aware acceptance** is first, for the reason above. Right now the accept rule trusts a single noisy number. The fix is the standard ML hygiene the talk was about in the first place: score on repeated runs, hold out a slice of cases the optimizer never tunes against, and put a real significance bar in front of the accept instead of a raw delta. That turns "this candidate looks 0.02 better" into "this candidate is better, and here's the confidence," which is what you'd want before letting it run overnight.

**Checkpointing and resume** falls out of a decision already made: the audit log *is* the checkpoint. Each completed trial already appends a row to `trials.jsonl`. Make that write atomic and per-trial, give the run a deterministic id from a fingerprint of the agent, the config, and the seed, and resuming is just replaying the log: rebuild the running best from the accepted rows, re-hydrate each numeric phase's Optuna study from its own trials so the sampler isn't reset, and carry on from the last complete row. No separate pickle, no second source of truth. Kill the run, resume it, don't re-pay for a single trial you already finished. The contract's written; it's mostly build.

**Cost and latency budgets** change what "best" means, and the obvious move here is the wrong one. Folding cost into the loss with some weight breaks the `[0, 1]` loss and the single advancing baseline the whole compounding loop is built on. So cost and latency don't go in the loss. They go in the *accept rule*, as a hard budget gate: a candidate has to beat the best loss by `min_delta` **and** come in under your declared cost and latency ceilings. Quality stays the only thing minimized; the budget just decides which improvements are allowed to count. Cost is priced tokens against a model price table. For local models, where tokens are free, the latency ceiling carries the economic signal instead, which is the case you actually care about. The accept rule gains one conjunct; nothing else moves.

Further out, the gap against the rest of the field is few-shot demonstration optimization, the lever DSPy leans on hardest. That one needs real surface area: a first-class slot for demonstrations on the agent schema, and a third proposer to select them. It's a v2 headline, not a quiet patch.

The core needed almost no new machinery. The loss function already existed; it was your eval suite, read sideways. Coordinate descent is decades old. Optuna does the numeric search. The one genuinely new piece is using an LLM as a stand-in for the gradient on the text axis, and even that is just "look at what's failing, say what to change," which is what you were doing by hand. The optimizer isn't doing anything you couldn't do. It's doing what you were already doing, except it doesn't get tired, it doesn't miss that groundedness dropped while you were fixing conciseness, and it keeps a receipt for every step.

The caveat stands: until variance-aware acceptance lands, this finds *candidate* improvements, and `min_delta` is what stops it from fooling itself on a noisy suite. But even now, it beats sitting in the loop by hand. Run it on your own suite overnight and see what it turns up. Worst case you've spent some tokens; best case you wake up to a `best.yaml` that beats anything you'd have found by hand.

---

## References

- Barias, Justin. ["Stop vibing your agents to production: applying ML discipline to agent development."](https://webdirections.org/ai-engineer/speakers/justin-barias.php) AI Engineer Melbourne, 4 June 2026.
- HoloDeck. ["Optimizing Agents (`holodeck test optimize`)."](https://docs.useholodeck.ai/) HoloDeck documentation.
- Yuksekgonul, M., Bianchi, F., Boen, J., Liu, S., Huang, Z., Guestrin, C., and Zou, J. ["TextGrad: Automatic 'Differentiation' via Text."](https://arxiv.org/abs/2406.07496) arXiv:2406.07496, 2024.
- Yang, C., Wang, X., Lu, Y., Liu, H., Le, Q.V., Zhou, D., and Chen, X. ["Large Language Models as Optimizers (OPRO)."](https://arxiv.org/abs/2309.03409) arXiv:2309.03409, 2023.
- Pryzant, R., Iter, D., Li, J., Lee, Y.T., Zhu, C., and Zeng, M. ["Automatic Prompt Optimization with 'Gradient Descent' and Beam Search (ProTeGi)."](https://arxiv.org/abs/2305.03495) arXiv:2305.03495, 2023.
- Khattab, O., Singhvi, A., Maheshwari, P., Zhang, Z., Santhanam, K., et al. ["DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines."](https://arxiv.org/abs/2310.03714) arXiv:2310.03714, 2024.
- Akiba, T., Sano, S., Yanase, T., Ohta, T., and Koyama, M. ["Optuna: A Next-generation Hyperparameter Optimization Framework."](https://optuna.org/) Proceedings of the 25th ACM SIGKDD International Conference on Knowledge Discovery & Data Mining, 2019.
- Wright, S.J. ["Coordinate descent algorithms."](https://link.springer.com/article/10.1007/s10107-015-0892-3) Mathematical Programming, 151(1), 2015.
