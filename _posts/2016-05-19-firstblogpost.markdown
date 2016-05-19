---
layout: post
title:  "Decomposing AzureRM JSON templates"
date:   2016-05-19 10:12:00 +1000
categories: DevOps, AzureRM, Infrastructure-as-code
---

As my first post, I've decided to start talking about my current interest, *Infrastructure-as-Code* as part of my **DevOps** learning & practise.
I've delved with JSON files in deploying full environments for either Dev, Test, and Production. An have asked the question:
> How do I make AzureRM templates  more readable and reusable?

With a little search in the Azure Documentation site, i've come across this document: [World class ARM templates](http://download.microsoft.com/download/8/E/1/8E1DBEFA-CECE-4DC9-A813-93520A5D7CFE/World%20Class%20ARM%20Templates%20-%20Considerations%20and%20Proven%20Practices.pdf).

After a bit of reading, a few concepts caught my eye that can help readability and reusability:
1.   Template linking.
2.  Dynamic variable generation using concat.
3.  Fixed configurations v.s. Free-flowing configurations.

I will leave you to do the reading, but by now I hope you know where I'm going with this - **Decomposition**.


A First Level Header
====================

A Second Level Header
---------------------

Now is the time for all good men to come to
the aid of their country. This is just a
regular paragraph.

The quick brown fox jumped over the lazy
dog's back.

### Header 3

> This is a blockquote.
> 
> This is the second paragraph in the blockquote.
>
> ## This is an H2 in a blockquote