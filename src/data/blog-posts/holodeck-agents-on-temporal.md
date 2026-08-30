---
title: "Killing My Own Workflow Engine: HoloDeck Agents on Temporal"
slug: holodeck-agents-on-temporal
publishDate: 30 Aug 2026
description: "Four months ago I wrote that workflows are a solved problem and every agent framework reinventing them would age badly. Then I looked at HoloDeck's own roadmap and found a handrolled workflow engine staring back at me. This is the story of deleting it, and what replaced it: HoloDeck agents as first-class Temporal activities, with schema gates enforced at the activity boundary and deterministic validation-and-repair loops wrapped around every AI step."
---

## Table of Contents

- [I should take my own advice](#i-should-take-my-own-advice)
- [What the deterministic spine got right](#what-the-deterministic-spine-got-right)
- [The pivot: agents as activities](#the-pivot-agents-as-activities)
- [The gate lives inside the activity](#the-gate-lives-inside-the-activity)
- [Validation and repair](#validation-and-repair)
- [Not every failure deserves a retry](#not-every-failure-deserves-a-retry)
- [Writing your own validation gates](#writing-your-own-validation-gates)
- [What stays deterministic](#what-stays-deterministic)
- [What I'm seeing at work](#what-im-seeing-at-work)

---

Back in April I wrote [a post arguing that agent workflows are a solved problem](/blog/agent-workflows-solved-problem-reinvented). Finite state machines, distributed sagas, durable execution: we've had production-grade orchestration for over a decade, and every agent framework shipping its own graph runtime was reinventing it. The advice was blunt. Ship great agent primitives, and compose them with the orchestration tools that already exist.

Then I looked at HoloDeck's own spec backlog and found spec 036: the "deterministic spine." A workflow YAML format. A DAG runner. A hand-rolled execution model. I was building the exact thing I'd told everyone else to stop building.

## I should take my own advice

In past me's defense, 036 wasn't a graph dataflow engine. It came from a real problem: if you put an LLM in charge of control flow, you can't audit the control flow. The spine was deterministic by design. Agents lived at the edges, their outputs passed through JSON Schema gates, and routing decisions ran through DMN decision tables evaluated with a restricted FEEL subset. The internal slogan: "the LLM is never the spine."

Right idea, wrong packaging. To ship it, HoloDeck would have had to own a workflow definition format, a runner, retry semantics, crash recovery, replay. Which is precisely the list of things Temporal, DurableTask, and friends have spent years getting right, and precisely the list I said nobody should rebuild.

So we archived 036 and wrote spec 040 instead. The one-line summary: **HoloDeck does not ship a workflow engine. It ships agents that plug into yours.**

## What the deterministic spine got right

Before the eulogy, credit where it's due. Three primitives from 036 survived the pivot untouched:

1. **Schema gates.** Every agent output validates against a JSON Schema before anything downstream sees it. The gate-validated object is the canonical value; the raw model text never crosses the boundary.
2. **Decision tables.** DMN-style tables with FEEL expressions, restricted to a fixed subset that's rejected statically at load time. Deterministic routing you can diff in a pull request.
3. **The invariant.** The LLM is never the spine.

The punchline: Temporal already enforces that invariant. Its cardinal rule is that workflow code must be deterministic, because recovery works by replaying your code against the event history. Anything nondeterministic (network calls, random numbers, LLM invocations) must live in activities. So "the LLM is never in workflow code" stops being a design principle we enforce and becomes a property the engine enforces for us.

## The pivot: agents as activities

The new shape is simple. You author a Temporal workflow in Python, the way Temporal users already do. HoloDeck turns each `agent.yaml` into a named activity your workflow calls. The no-code surface stays at the agent level, where it belongs; the workflow is always real code.

On the worker side, a factory binds an agent definition to an activity:

```python
from holodeck.temporal import agent_activity

activity_fn = agent_activity(node, base_dir)
# an async callable decorated @activity.defn(name=node.id)
```

Or you skip the Python entirely and host agents from a `worker.yaml`:

```yaml
temporal:
  address: localhost:7233
  namespace: default
  task_queue: hardship

nodes:
  - id: evidence
    edge:
      agent: agents/evidence/agent.yaml
    gate:
      schema: gates/evidence.schema.json
  - id: letter_writer
    edge:
      agent: agents/letter-writer/agent.yaml
    gate:
      schema: gates/letter.schema.json
```

```bash
holodeck worker --config worker.yaml --task-queue hardship
```

The `nodes:` list in that file is registration only. Zero control flow. There is deliberately no way to express "then call this node" in YAML, because the moment we add one, we've shipped a workflow engine again.

Worth spelling out what that command actually buys you, because "no Python" oversells it. `holodeck worker` starts an activities-only Temporal worker: it reads the config, connects to Temporal, registers one activity per `nodes:` entry, and polls the task queue. When a workflow schedules the `evidence` activity, this process runs the agent, gates the output, and returns the validated dict. It never runs a workflow. The orchestration half is always your Python.

The workflow side is plain Temporal:

```python
from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from holodeck.temporal.models import (
        ActivityParameters,
        AgentActivityInput,
        AgentActivityResult,
    )


@workflow.defn
class EvidenceWorkflow:
    @workflow.run
    async def run(self, statement: str) -> dict:
        params = ActivityParameters(
            start_to_close=timedelta(minutes=3),
            maximum_attempts=3,
        )
        result = await workflow.execute_activity(
            "evidence",                      # the agent's node id
            AgentActivityInput(message=statement),
            result_type=AgentActivityResult,
            **params.to_activity_kwargs(),
        )
        return result.output                 # gate-validated, always
```

One activity call is one full agent run: backend built, agent invoked, output gated, backend torn down. Stateless by design. Credentials and file paths get resolved worker-side at registration time, so they never enter an activity payload or the workflow history.

So a deployment is two processes. `holodeck worker` hosts the agents and holds the model credentials; a second, small Python worker hosts your workflow classes. The split earns its keep: the workflow worker carries no LLM credentials and no backend SDK, the agent worker carries no business logic, and each scales on its own. The only fully no-code path is the ops one: someone else already wrote and deployed the workflow, and you run `holodeck worker` to supply its agents.

![Two-worker deployment: your worker (small Python, workflow classes and decision tables, no LLM credentials) schedules the evidence activity onto Temporal's task queue. The holodeck worker (no code, one activity per node, holds the model credentials) polls the queue, runs the agent, gates the output, and the validated object lands in event history, which replays back to the workflow.](../../assets/images/holodeck-temporal-04-two-workers.png)

## The gate lives inside the activity

The design decision I care most about. The schema gate from 036 moved to the one place where it changes the semantics of the whole system.

![Gate inside the activity: workflow code calls execute_activity, the activity builds the backend, invokes the agent, and runs the raw model output through the JSON Schema gate. Valid output becomes the AgentActivityResult and lands in event history; invalid output fails the attempt and the retry policy runs the agent again. The raw model output never crosses into history.](../../assets/images/holodeck-temporal-01-gate-inside-activity.png)

The activity validates the agent's structured output against the node's JSON Schema *before it returns*. If validation fails, the activity attempt fails. Two consequences, and they compound:

**Temporal event history contains validated objects only.** History is your audit trail and your replay substrate. If unvalidated model output could land in it, every downstream consumer (and every replay) would have to re-litigate whether the payload is usable. Instead, the contract is structural: if it's in history, it passed the gate.

**Replay never invokes an LLM.** When Temporal replays a workflow after a crash, activity results come from the log. The five-dollar agent call from step 3 doesn't rerun because your container restarted. This was one of the acceptance criteria for the whole spec, with a test to hold it.

## Validation and repair

This is the part of the durable-execution bet I didn't fully appreciate when I wrote the April post.

A gate rejection is classified as a *retryable* activity fault. So Temporal's own retry policy becomes your repair loop:

![Validation and repair as a retry loop: the workflow calls execute_activity once. Attempt 1 returns free text and the gate rejects it; attempt 2 returns the wrong shape and the gate rejects it; attempt 3 passes the gate and the validated output goes back to the workflow and into event history.](../../assets/images/holodeck-temporal-02-validate-repair-loop.png)

You get a validation-and-repair loop pair around every agent call, and you wrote none of it. The validation half is the deterministic gate. The repair half is Temporal's retry machinery: backoff, max attempts, per-error-type opt-outs. If you'd rather fail fast on gate rejections for a particular step, that's one line in the caller:

```python
RetryPolicy(non_retryable_error_types=["GateValidationError"])
```

No custom retry decorator, no while-loop wrapping a parse-and-pray call, no half-tested backoff arithmetic. The engine you already trusted with durability also runs your repair loop.

## Not every failure deserves a retry

Retrying is only correct when the failure is *evidence about the model*. The activity boundary classifies errors into two channels that never mix.

A gate rejection or a transport error is evidence about the model or the wire. Retryable. Running the agent again can genuinely produce a different, valid answer.

A missing `agent.yaml`, an unloadable gate schema, a path that escapes the base directory, absent credentials: those are authoring faults. No number of retries fixes a broken worker configuration, and each retry of an agent call bills a model invocation. These cross the boundary as `ApplicationError(non_retryable=True)` and fail immediately.

Most authoring faults don't even get that far. The factory resolves the agent path, loads the gate schema, and checks that the agent declares a `response_format` at registration time, before the worker starts. An agent that could never produce structured output fails when you start the worker, not per-execution at a model call each.

I learned the cost of getting this wrong at work, not in HoloDeck. A misconfigured step that retries five times before dying doesn't just delay the failure; it bills you five times for the privilege.

## Writing your own validation gates

The built-in gate is JSON Schema, and it's mandatory: there is no ungated agent activity in v1 (an escape hatch is an explicit ask-first decision in the spec). But "JSON Schema" covers more business logic than people give it credit for. Where it runs out, the rules move into workflow code.

First move: push the rule into the schema. Enums, ranges, patterns, and conditional `if`/`then` blocks encode a lot of what teams call business rules. A hardship-claim gate might look like:

```json
{
  "type": "object",
  "required": ["evidence_type", "amount_claimed"],
  "properties": {
    "evidence_type": {
      "enum": ["medical", "job_loss", "disaster"]
    },
    "amount_claimed": { "type": "number", "minimum": 0 }
  },
  "if": {
    "properties": { "evidence_type": { "const": "medical" } }
  },
  "then": {
    "required": ["provider_name"]
  }
}
```

One caveat worth knowing: the gate and the model's `response_format` are separate schemas, and they support different things. The gate runs the full `jsonschema` library, so `if`/`then` works. The providers' constrained decoding does not: OpenAI's strict structured outputs reject `if`/`then`/`else` as unsupported keywords, and Anthropic's structured outputs cover a similar subset. So the model can't be forced to honor the conditional at generation time. It gets a simpler `response_format` it can satisfy, and the gate enforces the conditional after the fact; a violation is a rejection, and the retry runs. "Medical claims must name a provider" is a business rule the gate handles, just post-hoc rather than at decode time.

Some rules can't live in a schema: cross-field arithmetic, checks against reference data, anything tabular. Those belong in workflow code, as your own deterministic gate around the activity call. The repair loop is a plain `for` loop, and `AgentActivityInput.context` is the feedback channel (the activity renders it into the prompt as a JSON block, deterministically):

```python
@workflow.run
async def run(self, claim: str) -> dict:
    feedback = None
    for attempt in range(3):
        result = await workflow.execute_activity(
            "claim_extractor",
            AgentActivityInput(message=claim, context=feedback),
            result_type=AgentActivityResult,
            **params.to_activity_kwargs(),
        )
        errors = check_claim_rules(result.output)   # your pure function
        if not errors:
            return result.output
        feedback = {
            "validation_errors": errors,
            "previous_output": result.output,
        }
    raise ApplicationError("claim failed business validation", non_retryable=True)
```

A plain `for` loop looks primitive next to a retry policy, but it has to be workflow code, and the reason is mechanical: a `RetryPolicy` re-executes the activity with the identical input. It can resample; it cannot carry feedback. The moment the next attempt needs different input, it's a new activity invocation, and workflow code is the only place that decides inputs. (Temporal does have one native cross-attempt channel, heartbeat details, but HoloDeck activities deliberately don't heartbeat in v1.) The loop is also less primitive than it looks: each iteration is durable, each attempt's input and output lands in event history, and a crash mid-loop resumes at the right iteration.

`check_claim_rules` is whatever your domain needs: "amount claimed must not exceed 80% of the invoice total," "the provider must appear in the accredited list you loaded at module import time." As long as it's a pure function over the gated output, it's replay-safe. If your rules are tabular, skip the hand-written function and use the decision-table helper (next section): the table is the rule set, versioned and reviewable.

This loop is one step up from Temporal's blind retry: the agent sees *why* its last answer was rejected, because the errors ride into the next attempt's prompt. Shape enforcement inside the activity, meaning enforcement in the workflow. Two gates, each in the layer that can actually check it.

## What stays deterministic

The 036 decision tables survive as workflow-safe helpers. Same tables, same hit policies, same `Verdict` type, now evaluated inside workflow code:

```python
from holodeck.temporal.deterministic import evaluate, load_decision_table

table = load_decision_table("hardship_policy.yaml")   # module import time

# inside the workflow, after the evidence agent returns:
verdict = evaluate(table, result.output)
if verdict.outcome == "approve":
    await workflow.execute_activity("letter_writer", ...)
```

Tables load at module import time, versioned with the workflow code, so a policy change is a code change with a diff and a review. The helpers import no I/O modules, and a unit test proves they pass Temporal's workflow sandbox validation. That test is the reason `temporalio` is pinned exactly (1.32.0 as of this writing): the sandbox APIs it leans on are marked not yet stable.

So the shape of a full workflow is: agent activity extracts evidence (gated), a decision table routes on it (deterministic, in workflow code), another agent activity writes the letter (gated). AI at the edges, rules in the spine. Same philosophy as 036, running on an engine we didn't have to build.

## What I'm seeing at work

The last few months of my day job have been shipping AI features into workflow-shaped systems, and the pattern that keeps winning is the one the April post gestured at but didn't name: **AI-infused workflows, not AI-driven workflow orchestration.**

AI-driven orchestration puts the model in charge of what happens next; the workflow becomes whatever the model decides, and your audit story is a transcript. AI-infused workflows keep the orchestration deterministic (a state machine, a saga, a Temporal workflow) and embed AI inside individual steps: extract this, classify that, draft the other thing. Control flow stays reviewable. The model does the work; it doesn't steer the ship.

AI-infused steps fail the same way every time: the model returns something almost right. Wrong shape, missing field, confident nonsense in a valid envelope. Every team I've watched ship this ends up writing the same pair of things around every AI step: a deterministic validator that checks the output, and a repair loop that reruns or patches when validation fails. Handrolled, that's retry counters, backoff logic, and dead-letter handling scattered across every step, each copy slightly different, each tested to a slightly different standard.

Durable execution collapses that entire pattern into configuration:

- validator inside the activity
- rejection as a retryable fault
- repair as retry policy

Written once, enforced by the engine, uniform across every step. That's the actual argument for building on Temporal rather than alongside it: the validate-and-repair pair every AI-infused step needs is exactly the shape of an activity with a retry policy.

One of the systems I've been building at work uses an LLM-assisted conversation to author business rules, which compile to a DMN intermediate representation. The authoring conversation is the messy, non-deterministic activity at the boundary. The DMN layer is the deterministic engine underneath: re-execute it against any input and you get the same answer, byte for byte, with a full trace of why. Temporal and the DurableTask family arrived at the identical structure from the fault-tolerance side. Record every decision in an append-only event history, then rebuild state by replaying deterministic code over the log.

![Rules authoring with the same shape: an LLM-assisted authoring conversation sits at the non-deterministic boundary and compiles to a DMN intermediate representation in the deterministic core, which re-executes against any input to the same answer byte for byte. Both the conversation's revisions and the engine's answers feed the citation trail and divergence log.](../../assets/images/holodeck-temporal-03-rules-authoring-loop.png)

In both worlds, the log is the audit artifact. Temporal's event history plays the same role as the rule system's citation trail and divergence log. And once you see it that way, the sovereignty question reduces to a single design decision: where does the deterministic engine physically live, and who holds its history? For government systems, that's not an implementation detail. It's the whole game.

---

## References

- Barias, Justin. ["Agent Workflows: A Solved Problem, Reinvented."](/blog/agent-workflows-solved-problem-reinvented) April 2026.
- Temporal. ["Python SDK — Workflow determinism and the sandbox."](https://docs.temporal.io/develop/python/) Temporal documentation.
- Anthropic. ["Building Effective Agents."](https://www.anthropic.com/research/building-effective-agents) Anthropic Research, December 2024. Still the clearest statement of the workflows-versus-agents line.
