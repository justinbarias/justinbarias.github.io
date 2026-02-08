---
title: "Take Back the Stack. Your Cloud Provider Doesn't Want You To."
slug: take-back-the-stack
publishDate: 8 Feb 2026
description: "Cloud providers want to host your AI agents. I think it's time to stop letting them."
---
# Take Back the Stack. Your Cloud Provider Doesn't Want You To.

---

For the better part of a decade, I've watched organisations — hand over layer after layer of their engineering stack to cloud providers. And every single time, the justification was the same: "We don't have the skills to build this ourselves." Infrastructure? Outsource it. Platforms? Managed service. Data pipelines? Let AWS handle it. ML? Definitely outsource that.

And now it's happening again with AI agents. Azure has AI Foundry. AWS has Bedrock and AgentCore. Google has Vertex AI Engine. The pitch is identical to every pitch before it: "Don't build this. Consume ours. We'll handle the hard parts."

I'm tired of it. And for the first time, I think the excuse — "we can't build it ourselves" — is actually, provably, *wrong*.

---

## How We Got Here

I get it. The outsourcing made sense for a long time. Running data centres was expensive and painful. Managing Kubernetes at scale required a team most organisations couldn't hire. Building ML pipelines from scratch was a PhD-level exercise.

So we moved to the cloud. Then we moved to managed services on the cloud. Then we moved to managed AI services on the cloud. Each step was rational. Each step also meant we understood less and less about our own systems.

The progression looked something like:

> "We can't run data centres." Fair enough.
> "We can't manage Kubernetes." OK, sure.
> "We can't build ML pipelines." Debatable, but fine.
> "We can't build AI agents." Hang on.

That last one is where I draw the line. Because the thing that changed — the thing that most organisations haven't fully clocked yet — is that building software just got mass-democratised in a way that makes most of those "we can't" excuses evaporate.

## The Agent Platform Gold Rush (And Why You Should Be Suspicious)

Every major cloud provider is now racing to become the platform where your AI agents live. Let me spell out what that actually means.

**Azure AI Foundry** — model catalogue, prompt management, agent orchestration, evaluation tooling. All inside Azure. All wired into Azure services. All making it progressively harder to leave Azure.

**AWS Bedrock AgentCore** — same play, different logo. Build your agents on AWS, connect them to your AWS data, orchestrate them with AWS primitives. Your agents become structurally dependent on AWS. That's not a bug; that's their business model.

**Google Vertex AI Engine** — you see where this is going.

Here's what bugs me. These aren't just hosting platforms. They're becoming the *control plane* for your AI strategy. They decide what models you can use, how your agents are orchestrated, what telemetry you get, how your data flows. And once you've wired fifty agents into their proprietary service mesh, your switching costs aren't just high — they're existential.

For a startup? Fine. Use the managed thing. Ship fast, worry about lock-in later. But if you're a large enterprise, a government agency, any organisation where your value comes from the systems you build and the data you hold — you're handing over the keys. Again.

For organisations that need to meet regulatory requirements, and government institutions that need to consider who their service providers are -- **THIS IS A MATERIAL RISK**.

## Something Changed and Most People Missed It

While the cloud providers were building their agent hosting empires, something happened that completely rewrites the economics here.

Claude Code. Codex. Cursor. Cline. Aider. Pick your flavour.

These aren't your 2023 Copilot autocomplete toys. These are agentic coding assistants that *build entire systems*. They reason about architecture. They scaffold applications. They debug, refactor, write tests, and iterate across entire codebases. I've been using Claude Code daily for months and it still catches me off guard how much it can do.

Tasks that would've taken me a week — standing up a new service, wiring an API integration, building a deployment pipeline — now take an afternoon. Not because I'm cutting corners. Because the AI is doing 80% of the mechanical work and I'm doing the 20% that actually requires a brain: the architecture decisions, the domain logic, the "wait, that edge case will blow up in production" judgment calls.

And this is the part that matters: **the reason we outsourced all those engineering layers was because building them in-house was expensive.** You needed big teams. Deep expertise across a dozen domains. Months of runway.

What if that's not true anymore?

## You Don't Need a 10x Team. You Might Need Three People.

I'm going to say something that'll annoy some people: the era of needing ten-person platform teams to build internal tooling is over. Or at the very least, the bar has dropped *dramatically*.

A single engineer who knows their domain and knows how to drive an AI coding assistant can now:

- Scaffold infrastructure-as-code for an entire deployment pipeline in a day
- Build a custom agent orchestration layer that's tailored to your actual needs
- Write, test, and ship services at a pace that would've required a team of five
- Automate the operational drudgery that used to eat an entire SRE team's week

I'm not saying fire your engineers, far from it. I'm saying the *shape* of the team changes. You don't need ten people doing ten things. You need two or three people who deeply understand your organisation, your architecture, and your constraints — and who can use AI to move at a pace that wasn't physically possible before 2024.

This is *especially* true for the kind of work that cloud providers want you to outsource. Agent orchestration? Pattern-heavy glue code. AI agents eat that for breakfast. Data pipeline wiring? Same. Deployment automation? Same. All the stuff that used to justify a managed service because "we don't have the headcount" — your headcount just got a 5x multiplier.

Some may say that outsourcing all these to an AI Agent provided by an AI lab could be a material risk as well, and that's a fair point. But using AI coding agents to build your own internal platforms is a fundamentally different proposition than outsourcing your entire agent strategy to a third-party service. The former is about augmenting your internal capabilities, while the latter is **about relinquishing control**.

## Stop Letting IT Gatekeep Developer Platforms

OK, here's where I'm really going to step on some toes.

If you're a large organisation thinking about this, your instinct is going to be: "Let's get IT to build a centralised platform." Don't. Please.

I've lived through this movie. IT builds a "developer portal" (if you're lucky) that's actually a ticket queue with a React frontend. Need an environment? Raise a ticket. Need a database? Another ticket. Need a deployment slot? Ticket, two-week SLA, hope you weren't trying to ship something this quarter. By the time you're actually writing code, the business has moved on and someone's asking why "digital transformation" isn't delivering results.

The starting point should be building *real* developer platforms. Self-service. Automated. Opinionated where it matters, flexible where it doesn't. And here's the kicker — **only developers will build what developers actually need.**

Platform engineering is not an IT governance function. It's a software engineering discipline. The people building your internal platform need to be people who feel the pain of not having one. People who've waited three weeks for a staging environment and thought "I could build a better system than this in a weekend." With AI coding assistants, that thought is now literally true.

Give a small, empowered team — even one or two devs — the mandate to build internal tooling. Give them Claude Code. Give them autonomy. Get IT out of the critical path for day-to-day development. Watch what happens.

## Build the Moat Around What Actually Matters

Here's the mental model I keep coming back to.

Your organisation's moat is not its cloud infrastructure. It never was. Nobody ever won a competitive advantage because they had a really nice Kubernetes cluster. Your moat is your domain knowledge. Your data. Your processes. The software that encodes all of that into systems that work.

Cloud infrastructure — provisioning VMs, managing databases, configuring load balancers — that's commodity toil. Important, but undifferentiated. It's exactly the kind of work AI agents are already good at handling.

So here's what I think the play is:

**Delegate the infrastructure toil to AI agents.** Use agentic coding assistants to automate your cloud operations. Let machines manage machines. This is what they're good at.

**Build your agent platforms in-house.** Don't hand your agent orchestration to AI Foundry or Bedrock AgentCore. Use Claude Code to build your own. With one or two engineers driving AI, this is genuinely achievable now — and the result will be tailored to your domain, wired into your data, and owned by you. Not rented.

**Spend your human engineering effort on what's actually unique to you.** The domain logic. The data models. The regulatory knowledge. The workflows that make your organisation yours. That's where engineers should be thinking, not fighting YAML configs for a managed service that doesn't quite do what you need.

I'm not anti-cloud. I'm not suggesting anyone go rack servers. Use cloud compute, managed databases, managed networking — consume the commodity layers, absolutely. But stop outsourcing the *intelligence* layer. Stop letting cloud providers become the operating system for your AI strategy. The tools to take it back exist today, right now, and the cost of doing it yourself just dropped by an order of magnitude.

## The Risk of Waiting

Some organisations will read this and think "we're not ready." They'll wait. They'll commission a strategy paper. They'll form a committee. They'll wait for IT to assess the tools. They'll wait for a vendor to package it all up in a nice procurement-friendly bundle.

And while they wait, they'll outsource the last engineering layers they had. They'll become fully dependent on platforms they don't understand, built by companies whose incentive is to keep them dependent for shareholder value. And when the pricing changes — and it always changes — they'll have zero internal capability to respond.

The organisations that start now, even messily, even with a tiny team, even with imperfect first attempts — they'll build the muscle memory that matters. They'll discover that two engineers with AI coding assistants can build things that would have required twenty people three years ago.

The cloud providers are betting you won't build. That the complexity will scare you off. That you'll keep paying rent on their platforms because it feels safer than trying.

I think they're wrong. And I think more engineers are starting to feel the same way.

---

*If you want to see what building these patterns looks like in practice, check out [HoloDeck](https://github.com/justinbarias/holodeck) — it's my open-source agent experimentation platform where I'm putting my money where my mouth is.*

---