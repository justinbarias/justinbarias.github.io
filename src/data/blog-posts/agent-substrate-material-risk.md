---
title: "Take Back the Stack, Again: Your Agent Substrate Is a Material Risk"
slug: agent-substrate-material-risk
publishDate: 1 Nov 2026
description: "In February I argued that organisations keep outsourcing their engineering layers to cloud providers. Nine months later the pitch is bigger. Microsoft and a new wave of MSPs want to own the substrate your agents run on. If agents become the main way an organisation operates, that substrate is the organisation, and handing it over is a material risk."
---

## Table of Contents

- [Nine months later](#nine-months-later)
- [The premise: agents become the workload](#the-premise-agents-become-the-workload)
- [Why this is a material risk](#why-this-is-a-material-risk)
- [The same argument, one layer higher](#the-same-argument-one-layer-higher)
- [You cannot outsource becoming AI-native](#you-cannot-outsource-becoming-ai-native)
- [Be wary of MSPs that want to run your substrate](#be-wary-of-msps-that-want-to-run-your-substrate)
- [If you buy from an MSP, ask for receipts](#if-you-buy-from-an-msp-ask-for-receipts)
- [What to own and what to rent](#what-to-own-and-what-to-rent)

## Nine months later

In February I wrote [Take Back the Stack](/blog/take-back-the-stack). For a decade, organisations handed layer after layer of their stack to cloud providers because "we do not have the skills". AI coding agents made that excuse much weaker, and I said the agent layer was the place to stop. Since then, the pitch has grown.

Microsoft now sells agents at every level of the stack. Copilot Studio is the low-code builder for makers and IT. Copilot Cowork puts agents into everyday Microsoft 365 work. Foundry Agent Service, generally available since March, is the pro-code runtime for developers. Entra Agent ID and Agent 365 sit across all of them for identity and governance. Each piece is reasonable on its own. Together they make one offer: build your agents here, run them here, give them identities here, and govern them here.

A second group has now joined the hyperscalers. Managed service providers are building agent platforms of their own and selling them to their clients. One Australian example is LAB3's [Forge](https://www.lab3.com.au/opinion/forge-secure-agentic-ai-platform). LAB3 describes it as a secure agentic platform for regulated clients. It is built on the Microsoft Agent Framework and hosted on AKS, with Microsoft Foundry as its agent engine. LAB3 manages it inside the client tenant, and says it went from prototype to client capability in about six months.

In February the question was who hosts your agents. The question now is who owns the place where your organisation does its work, and that raises the stakes.

## The premise: agents become the workload

Everything below depends on one premise. I think agents will become the main workload type of an organisation. Today a company runs on bespoke web apps, desktop apps, spreadsheets, and the people who move data between them. Over the next few years, more of that work moves into agents. Agents will process the claims, reconcile the accounts, triage the tickets, and answer the customers. The apps stay, but more and more they become tools that agents call.

If that premise is wrong, the rest of this post matters less. If it is right, the agent substrate stops being one platform among many. It becomes the operating environment of the organisation. Your processes live there as prompts, workflows, and tool permissions. Your institutional memory lives there as context and retrieval indexes. Your customer conversations happen there. Your audit trail is written there. This environment is what the vendors want to own.

## Why this is a material risk

I work in Australia, so the frame I reach for is APRA's CPS 230. The standard asks regulated entities to identify their critical operations and their material service providers. It then asks them to manage the risk that a provider fails, changes terms, or exits. Other regulators use similar language. If a third party controls something your critical operations depend on, you must be able to show that you can survive without them.

Apply that test to an outsourced agent substrate. If your claims process runs as agents on a vendor runtime, the vendor runtime is part of a critical operation. If the workflow definitions use that vendor's format, your process logic is held in that format. If the agent identities, tool grants, and approval rules live in that vendor's governance plane, your control framework lives there too. If the traces and evaluation results stay in that vendor's telemetry, your evidence that the process works stays there as well.

Now ask the exit question that every outsourcing policy contains. Can you move this to another provider, or bring it in house, within a reasonable time, with no loss of service? For most outsourced agent platforms today, the answer is no. The prompts can move. The workflows, identities, policies, evaluation history, and integrations mostly cannot. And the team that has to plan the exit has never operated the platform.

A data centre outage stops your systems. A substrate outage, a price change, or a product retirement stops the work itself, and that meets every definition of material risk I know.

## The same argument, one layer higher

The points from February still apply. Every layer we outsourced came with the same pitch, and each step was rational on its own terms:

> "We cannot run data centres."
> "We cannot manage Kubernetes."
> "We cannot build data platforms."
> "We cannot build ML pipelines."

Each step also reduced what the organisation understood about its own systems. That trade was acceptable while the outsourced layer only held workloads. A managed database holds your data, but your engineers still write the code that gives the data meaning. A managed Kubernetes cluster runs your services, but you still write the services.

The agent substrate is different in kind. It holds the logic of the work, and the systems that do the work. When you outsource it, you outsource the layer where your organisation's decisions are encoded, and your operations leave the building with it.

## You cannot outsource becoming AI-native

The second cost is capability, and I think it is larger than the risk.

Block is the clearest example I know of a company that set out to become AI-native. Its CTO, Dhanji Prasanna, wrote an AI manifesto for Jack Dorsey, and the company reorganised around it. Prasanna talked about it on [Lenny's Podcast](https://www.lennysnewsletter.com/p/how-block-is-becoming-the-most-ai-native) last year. Block's first move was to build [goose](https://github.com/aaif-goose/goose), its own open-source agent, and put it in front of engineers and non-engineers alike. Block says goose saves its people 8 to 10 hours a week. In 2026 Dorsey went further and [cut about 40% of staff](https://venturebeat.com/orchestration/jack-dorseys-block-cuts-40-of-staff-4-000-people-and-yes-its-because-of-ai). His argument was that a smaller team that uses its own tools can deliver more. You can disagree with that decision and still see the pattern. Block owns the agent layer its organisation now runs on, because its own engineers wrote it.

Geoffrey Huntley made the same point from the engineer's side. In his [free workshop on how to build a coding agent](https://ghuntley.com/agent/), he shows that the core of an agent is small: a loop, a model call, and a set of tools. His request to engineers is direct: please build your own. The reason is that the knowledge moves you from consumer of AI to producer of it.

An AI-native organisation is one where the people understand how agents work, where they fail, and how to redesign a process around them. You get that knowledge only when your own people do the work. They build the loop, wire the tools, write the evaluations, watch the traces, and fix the failures in production.

If a vendor or an MSP does all of that for you, they get the learning and you get an invoice. After three years you have a portfolio of agents and no one inside who knows why they behave the way they do. You have rented the capability, and you have to keep renting it.

## Be wary of MSPs that want to run your substrate

An MSP agent platform adds a second layer of dependency. Most of them run on a hyperscaler's agent stack, often Microsoft's. The MSP manages the platform, the hyperscaler supplies the engine, and the client gets the agents. So the client depends on two parties for its agent substrate, and it has learned to operate neither of them.

Many of these platforms make sensible design choices. They put deterministic workflows around agentic steps. They add policy engines, human approval for high-impact actions, and audit logs. That is close to what I argued when I [moved HoloDeck onto Temporal](/blog/holodeck-agents-on-temporal). My objection is about who owns them.

The workflows make the ownership problem worse. MSP platforms ship their own workflow engines, and Microsoft builds the same idea into Agent Framework workflows and Copilot Studio agent flows. The deterministic part of a workflow holds your approval thresholds, your routing rules, your compliance checks, and the order of steps in a regulated process. That is your business logic, written down in the most exact form your organisation has.

So the vendors now want the deterministic layer around the agents as well, the part that I argued belongs in a portable engine you control. With agents, workflows, identities, policies, and telemetry on one platform, the entire business runs on someone else's product.

Then look at what the MSP announcements leave out. The ones I have read list agents, workflows, token budgets, access control, policy engines, approvals, and audit logs. Few of them say anything about evaluation. They name no test cases, no regression suites, and no measure of whether an agent gives the right answer. Dashboards for activity and cost are common. Cost is easy to measure. Correctness is the hard part of AI engineering. It is also what tells you an agent is safe to run on a critical operation.

A secure container runtime and a clean RBAC model tell you who can run an agent. They do not tell you whether the agent is right. So the offer comes down to this: host your business on us, and we will handle the rest.

Nobody has a long record of operating production agent platforms, MSPs included, because the field is about two years old. Many of the platforms on the market today were built in months by small teams with coding agents and a large Claude bill. That is a reasonable way to build software in 2026. It is how I build HoloDeck.

So consider what you buy from an MSP agent platform. You pay a services firm to learn on your processes. It uses the same tools your own engineers can use, on a substrate it also rents. If a small team at an MSP can build a credible platform in six months, a small team inside your organisation can build one too. And when your team builds it, the knowledge and the platform stay with you.

## If you buy from an MSP, ask for receipts

Do not trust a partner or MSP with your agent substrate because you trusted them with your infrastructure. Most of the MSPs I see selling agent platforms today come from infrastructure outsourcing. They ran data centres, then cloud landing zones, then managed services. Now they are trying their luck with AI. A good record in infrastructure tells you nothing about their ability to run agents in production.

Almost every one of them will tell you they have customers in production. Treat that as a claim to test. Ask for receipts:

- Which processes run on the platform in production today, for which customers, and for how long?
- How many agent runs a week do those processes handle, and what share needs a human to fix the result?
- Can we talk to one of those customers without the MSP in the room?
- Show us the evaluation suite for one production agent. How many test cases does it have, and what is the current pass rate?
- Show us a regression that the evaluations caught before release.
- Walk us through a production incident where an agent did the wrong thing. What failed, how did you find it, and what changed after?
- Who on your team has built and operated an agent system in production, and what did they build before this platform?
- If we leave, what do we take with us? Ask for the prompts, workflow definitions, tool permissions, evaluation history, and traces, in formats that another platform can read.

A partner with real experience can answer most of these with documents and names. If the answers are case studies, demos, and a slide about governance, treat the production claim as unproven. And if you find that you are now teaching your MSP how agents fail, keep that knowledge in house and build the platform yourself.

## What to own and what to rent

Choose the layers you own, and rent the rest. Here is the split I use.

Rent the commodity layers:

- Model inference, from more than one provider where you can.
- Compute, storage, and networking from your cloud provider.
- Durable execution engines such as Temporal, which are open source and portable.
- Coding agents to do most of the build work.

Own the layers that encode your organisation:

- The agent loop and the runtime contract, in code your team can read.
- Workflow and process definitions, in a format that is not tied to one vendor.
- The tool registry, with agent identities, permissions, and approval rules.
- The evaluation harness, test cases, and the history of results.
- Traces and audit logs, in your own store, in an open format such as OpenTelemetry.

Then apply the exit test to each item before you sign anything. If a layer fails the test and it sits on a critical operation, bring it in house or keep a tested path out.

Two or three engineers with coding agents can stand up a credible agent runtime in a quarter. They will make mistakes, and those mistakes are the training that turns your organisation into an AI-native one. If you outsource the substrate, the vendor's engineers get that training and keep it.

---

*HoloDeck is my attempt to show what the owned layers look like in practice. It is open source on [GitHub](https://github.com/justinbarias/holodeck).*
