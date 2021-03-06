---
layout: post
title:  "A business case for Microservices in a not so hyperscale organization"
date:   2016-12-05 16:48:00 +1000
categories: Microservices, DesignPatterns
comments: true
---

Yay! My first blog post which doesn't involve code, nor infrastructure stuff..

Foreword
---------------------
Firstly, let me get this out - I do not condone Hype-driven development. For more details on Hype-driven development, check this awesome blog [post](https://blog.daftcode.pl/hype-driven-development-3469fc2e9b22?gi=441af6f2a370).

Another reference I like to make is Martin Fowler's ["You have to be this tall to use Microservices"](http://martinfowler.com/bliki/MicroservicePrerequisites.html)

Let's go through his points.

1. Rapid Provisioning - if you are still stuck with manually deploying your environments (dev/test/uat) then obviously moving to a modern design pattern is the least of your problems. 
I would argue that the easiest win, in starting a DevOps movement in your organisation is automating the provisoning and configuration of your (dev/uat/prod) environment.
Yes, I'm looking at *YOU* Ops folks - if you're not automating stuff, you're not using valuable time for continuous improvement.

2. Basic Monitoring - now this is a tricky thing - i don't think there are alot of native Microservices-based - but there are other ways to achieve this - for example, using containers. 
Container orchestration normally comes with native monitoring capabilities.

3. Rapid Application development - basically, Continuous Deployment(or Delivery). Quicker feedback loops which will
hopefully (a) *Decrease cycle time of stories from inception to release in production*, and (b) *Increase mean time to resolution of issues*.
If you're still waiting for weeks for that bug fix you PR'ed into the sprint/master branch to get deployed to get into production, tested, and reported back to you, 
breaking up your monolith will increase that cycle time time **exponentially**...

Regardless of whether you're looking at Microservices or not, the three points above are still worth enough investments to pursue in any organisation (hyperscale or not).

Lastly, this is not meant to discuss the other considerations of Microservices, namely, testing (read up on Consumer-defined contracts), 
security considerations, and organisational structure *(yes, breaking up your monolith means you should break up your teams)*.

This blog post is meant to de-hype Microservices, and make that design pattern as real as it can be in any organisation not named Netflix.


The **Journey to the cloud** phase
---------------------
Now, alot of organisations worth their salt are probably considering migrating some of/all their workload to the cloud. And like any project or initiative, would probably have to write up a business case.
And that business case will probably have to promise an outcome *X*, with a cost *Y*.

The outcome *X*, can either be faster cycle times, increased operational agility, ability to test/experiment in production.

While that *Y* will probably a dollar value you got from Cloud provider *Z* when you asked him/her to estimate your consumption for you.
Most often than not, that will probably be a horribly bloated value (but sorely underestimated still), and will probably get you fired outright if you put that into your business case.
You will probably, cut that in half, and will most likely get that business case approved, but still be held to the same promised outcomes.

You then kick off the project. You do a **"lift and shift"** strategy to minimise headcount, services cost, and timeline.
You will probably be a bit over schedule, but with a few sleepless nights and that dreaded **cutover**, you finish the migration.

You think to yourself, *"Job Done!"*, pat yourselves in the back, writeup a report to management that **"WE ARE IN THE CLOUD NOW"**, and enjoy a few beers.


The **I'm back to earth** phase
---------------------
Assuming your application is humming along just fine, you get a month of relative peace, then you get an email from your manager:

**Subject: Re: Overblown cloud OPEX**

You see the body of the email, and you get hit with a monthly cost worth half your annual salary.

**GULP**. 

You investigate, and it seems your scale-up rules were the culprit (you can't scale out because your app.. just doesn't support scaling out). 
Your monolith app, which ran on three web servers, a two-node RDBMS cluster, have scaled up through the SKUs like mad - and now cost a few thousand dollars per month.

The supposed savings, and new revenue/profit you get out of more agility is negated by the outstanding monthly costs you've racked up.



The **This is a conspiracy by cloud providers for us to buy into their Microservices cool-aid** phase
---------------------
You see folks, this comes down to how lean your infrastructure is, and by association, your code is.

**Fewer instances with large capacity cost more than having higher instance counts with lower capacity sizes**

basically,

**An instance  with 24GB of memory is roughly 1.5-1.8x more expensive than three instances with 8GB of memory**.
![VMSizeAWS](/assets/vmsize0.png)

For Azure, it doesn't necessarily show that same ratio of capacity vs cost, but basically, uplifting to higher SKUs is more than x2.0 the cost of the previous SKU.
![VMSizeAz](/assets/vmsize1.png)


And this is not only true for virtual servers, this is especially true for *physical servers*. 
If you ever built your own Desktop - you might have found out that buying an 8GB DDR4 RAM module is more expensive that buying two 4GB DDR4 RAM modules.

When talking about 1-3 servers, it seems like peanuts (take note these are hourly costs) - but put in a monthly time frame, with a cluster of bigger VM SKUs, the cost will start adding up.

This becomes even more evident when consuming services higher up the stack (PaaS).

What do I do now?
---------------------

First off, please don't go rewriting your entire code base - the best way to start off is to start building adapters around your legacy app, and start building new features/stories as Microservices around your legacy app.
This is called a [strangler application -as coined by Martin Fowler](https://www.martinfowler.com/bliki/StranglerApplication.html).
Also, be wary of the non-technical repercussions of moving to this architecture, ideally, you'd also be breaking your teams apart into cross-cutting teams (across capabilities, e.g. dev and ops), for each microservice.
So instead of adhering to Domain-driven design principles, I'd say it's more important to structure your microservice around your team's capabilities.

A great starting point as well is this great blog [post from Nginx](https://www.nginx.com/blog/refactoring-a-monolith-into-microservices/?utm_source=building-microservices-using-an-api-gateway&utm_medium=blog&utm_campaign=Microservices).


Summary
---------------------

TL;DR - it's cheaper to run smaller services than large monoliths in the cloud (regardless of the cloud provider).