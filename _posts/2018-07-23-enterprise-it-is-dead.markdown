---
layout: post
title:  "Enterprise IT is dead - long live enterprise IT... not."
date:   2018-07-23 09:30:00 +1000
categories: thoughts, opinionated
comments: true
---

Apologies for the clickbait title - but this seems to be the trend in making outrageous opinion posts. Except this isn't that outrageous, but heavily opinionated. These thoughts are purely my own, and do not reflect the opinions of my employer. 

Now - let's get this out of the way. Is Enterprise IT really dead? Not really. Nor will they be, as people who identify as part of enterprise IT seem to have the evolutionary gene of self preservation hardwired into every strand of their being. They simply will not die. There are a couple of external reasons as well why they will not:

1. Old school sales organisations in tech companies continue to stroke their ego (through lavish wine-and-dine activities to close deals and invitations to overseas conferences) and make them the centre of the IT world (or so they think)

2. They have (in larger organisations) made it inevitable for the business to do any meaningful business without going through Enterprise IT. In essence, they have taken legacy system of records hostage, which systems of engagements need to interface with to work properly. 

## What are the consequences?

1. The business either waits for Enterprise IT to catch up with their (the market's) demands, which leads them to die a slow spiral into irrelevance.

2. Or, the business finds a way to sneak out data from systems of records (through unsecure, unsanctioned manners which normally overlook industry regulation), and engage in rogue IT just to make something happen

In a nutshell, it's not technology, nor processes who seem to be the main blocker in true digital transformation. Especially in large organisations with a notion of "Central IT" - it's them. 

True digital transformation encourages - no, demands - autonomy of business units. Being able to deliver true business value in a speed where they can quickly churn out an MVP, measure ,learn, and finally scale/pivot can only be done when every station in the pipeline operate at the same speed. **Least common denominator** applies (which is why Hybrid Cloud was designed to fail - another blog post in the future). 

Central IT has no business, no knowledge, nor pedigree to tell the business how it should deliver products to their customers. 

## What's the fate of Enterprise IT?

If it were up to me? They should just disappear. Get out of the way. Or once they finally realise that the value is within the business - join the business. Transform IT into a cross functional organisation where they are deeply embedded within business units. 

However, based on what I learned recently, there *might* be another way. 

## The good of Enterprise IT

I've definitely gone out of my way to paint Enteprise IT in a bad light - however, they do have value within organisations. Especially in large organisations in highly regulated industries, they identify, measure, own, and mitigate risk outcomes. This is the single largest reason why Enterprise IT is the way they are. And demanding them to be quick and agile is a huge ask.

Their slowness mirrors how outdated regulation normally is - or how outdated the **understanding of the spirit** of regulation. I am in no way certified to make legal claims or statements, however, in court proceedings and outcomes, judges *sometimes* make rulings against the norm (or against legal precedent) as long as it is within the **spirit of the law in question**. Another factor in the slowness of IT is the lack of automation.

## The "other" way

Now, if Enterprise IT can't just magically disappear, or simply embed themselves deep into cross-functional roles within business units, another option is to drastically transform the type of organisation they have. 

Typical Enterprise IT organisations are top-heavy, drowning in N layers of mediocre middle management, and are scarce in good engineering people. They are, most often than not, glorified project management offices. **They deliver service in the speed of service request tickets.**

The Enterprise IT of the future - no, the present (in order for them to survive) - needs to become a software organisation. It is **ironic** that Enterprise IT is the last to become a software engineering organisation in a typical enterprise. Business units have started adopting the software/product engineering mindset at the start of the digital transformation wave. They have to become up to par with the software-as-a-service vendors the business units use and trust (even more so than they trust Enteprise IT). **They have to deliver service in the speed of an API call.**

## What does this mean?

Being a software organisation can mean many things - but can come down to three simple things:

1. Realise that their customer is the business (duh!)

2. They provide a product to the customer - and that product is consumption of compute, networking, and data. Those products can be either self-hosted, or "re-sold" from another service provider (cloud provider, whether IaaS, PaaS, or SaaS)

3. Their success is tied to their customer's success (as well as the customer's failure tied to their own)

There's the more technical stuff as well that they need to adopt an agile way of working, learn software engineering practices like CI/CD, lean software engineering, safe evolution of services, building services into smaller deployable units rather than large monolithic entities, software testing, service contract management etc..

## An example

Now all that sounds well and good (theoretically), but how does that become a reality. This example takes what my good colleage [Al Sheehan](https://www.linkedin.com/in/alsheehan/) and the Microsoft services team have done with one of our largest Enterprise clients.

Take into consideration how business units consume cloud services. Most often than not, they go direct to the cloud provider, spin up resources without regard for regulation and governance. What Enterprise IT can do is serve as a facade API in front of these cloud providers. Read up on facade pattern [here](https://en.wikipedia.org/wiki/Facade_pattern). An excerpt:

> A facade is an object that provides a simplified interface to a larger body of code, such as a class library.

Imagine that Enterprise IT facade to abstract the difficulty of regulation & governance, and simply provide a way for the business to make an API call, and get a workspace already pre-wired, pre-bootstrapped with all the regulation & governance goodness. 

![enterpriseitfacade](/assets/enterpriseitfacade.png)

Obviously, the facade is the easiest part to build. The underlying system which supports that (and which enterprise IT must maintain, develop, and evolve to serve business needs), is the hard part. Since we are dealing with mainly cloud-based infrastructure and wrapping a facade around it, an approach leveraging heavy automation and infrastructure code makes alot of sense.

## Taking it further

Lastly, taking Enterprise-IT-as-a-software-organisation to the next level is the concept of Enterprise-wide open source. Imagine creating a backend system which exposes an extensible interface that allows anyone in the organisation to contribute into the infrastructure repository. And as an opensource, community-maintained project, the way to introduce changes is via a pull request into a Git repo. The back-end system that supports the domain objects(workspaces) that the business consumes can be represented into project-level modules. Neatly separated into the kernel space, and the user space (again coined by Al).

All kernel modules are owned, maintained by Enterprise IT, while user space modules are for public usage, maintenance, and consumption.

![componentmodules](/assets/componentmodules.png).

## Wrapping up

That all seems a bit too much, and might sound like drinking too much of the "everyone is a software organisation, they just dont realise it yet" coolaid. This applies differently to different industries, countries, with differing engineering maturity, and regulation requirements. 

I still believe that the evaporation of the "Enterprise IT" role will eventually happen, as business become more savvy with technology and the implications that come with it - and the discipline it requires. 

One way or another, Enterprise IT must change.


