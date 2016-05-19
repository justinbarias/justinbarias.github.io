---
layout: post
title:  "Decomposing AzureRM JSON templates - Part 1"
date:   2016-05-19 10:12:00 +1000
categories: DevOps, AzureRM, Infrastructure-as-code
---

As my first post, I've decided to start talking about my current interest, *Infrastructure-as-Code* as part of my **DevOps** learning & practise.
I've delved with JSON files in deploying full environments for either Dev, Test, and Production. An have asked the question:

> How do I make AzureRM templates  more readable and reusable?

With a little search in the Azure Documentation site, i've come across this document: [World class ARM templates](http://download.microsoft.com/download/8/E/1/8E1DBEFA-CECE-4DC9-A813-93520A5D7CFE/World%20Class%20ARM%20Templates%20-%20Considerations%20and%20Proven%20Practices.pdf).

After a bit of reading, a few concepts caught my eye that can help readability and reusability:

1.  Template linking.
2.  Dynamic variable generation using concat.
3.  Fixed configurations v.s. Free-flowing configurations.

I will leave you to do the reading, but by now I hope you know where I'm going with this - **Decomposition**.

I have here a JSON file, which I used in an old project previously, from the Azure quickstart templates:

* [JSON deployment template](https://raw.githubusercontent.com/justinbarias/PowershellRepo/master/ARMDeploymentTemplates/ADDCARMTemplate.json)

Breaking it down
---------------------
Breaking down the JSON template above, what it does is deploy the following, with all the possible parameters required to deploy the template:

* Azure VNET and Subnets - has also been decomposed into its own JSON file (vnet.json)
* Azure Storage Account
* Azure Load Balancer, front end IP pool, back-end IP pool
* Azure VNIC (x 2) - which has already been nicely decomposed into its own JSON file (nic.json)
* Azure Virtual Machine (x 2) - with DSC configuration files bootstrapped
* Updating the VNETs to include AD DC DNS server IP addresses, once the DSC scripts have completed

As you can see, the template above is a whopping **700+ LoC**, and unless you have VS2015 fired up with that fancy JSON explorer, understanding the template is gonna take alot of time and coffee.

After digesting the *World-class ARM templates* document, I've set my approach on working to decompose that **HUGE** JSON file. 

1. Decompose shared resources like VNETs, Subnets, Load Balancers, Availability Sets - calling it *sharedresources.json*
2. Take the fixed configuration approach for VM provisioning - calling it *vmfactory.json*
* This is where we define the "t-shirt sizes" as suggested by the document, and will be calling them "vmRoles" instead
* As a *"factory"* this JSON file is meant to be re-used over and over again, across different requirements. Wonder if AzureRM will allow "importing" of variables from an external JSON file?
* We will be using the concept of *"dynamic variable generation"* here, as it has to churn out different configs depending on the parameters passed
3. Take optional items like DSC configuration scripts as optional items - haven't decided on what to call it yet.

As of writing of this blog post, I have successfully done items 1 and 2, and will detail the approach and some code snippets on Parts 2, 3, etc..
You can take a look at the progress of stuff i've committed to github as a VS2015 [solution](https://github.com/justinbarias/PowershellRepo/raw/master/AzureResourceGroup1).
Will be reorganising my repos soon - apologies for the mess of a repo I have!

Stay posted for further blog updates!!