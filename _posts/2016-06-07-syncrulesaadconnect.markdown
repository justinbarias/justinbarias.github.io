---
layout: post
title:  "Cross-forest migration with an existing Azure ADSync installation"
date:   2016-06-17 09:24:00 +1000
categories: Cloud Identity, Azure AD, DirSync
---

A quick one coming right up!

In a current gig, I've been tasked to develop a migration strategy for a hybrid cloud identity environment.
We have the following:

1. A Windows Server 2003 domain, *sourcedomain.com*, syncing to an Azure AD instance *syncedsourcedomain.com*.
2. A brand new Windows Server 2012 R2 domain (hosted in Azure - the automation stuff i did there will be covered in another post), *targetdomain.com*.
3. A migration plan to migrate users/groups to *targetdomain.com* while keeping objects in *syncedsourcedomain.com* consistent. This is using ADMT.

As I wanted to focus on some advanced stuff in Azure AD Connect in this current blog post, here are the things that I've already done beforehand:

* Setup DNS forwarders between the two forests
* Setup bidirectional, two-way forest trust
* A prepared, tested migration script that does user & group migration with SID history migration [see link here](http://)

The Problem statement(s)
---------------------
* SourceAnchor attribute that was used previously was ObjectGUID - obviously this will not work in a cross-forest migration scenario as ObjectGUID changes during migration
* Current UPN at the source domain UPN is  *sourcedomain.com* - this is registered in the azure ad tenant. Obviously, setting up both public UPNs on both forests is not possible at all.
Image below depicts the current state:
![CurrentStateAzureADConnect](/assets/CurrentStateAADConnect.png)

The Solution
---------------------
Given the problem statements above, the solution will be twofold as well. 

* Reinstall Azure AD Connect and reconfigure the sourceAnchorAttribute/immutableId as something **not** the ObjectGUID
* Modify Azure AD Connect flow rules to **force** the UPN suffix to be "@sourcedomain.com" regardless if the user comes from the sourcedomain.com forest or syncedsourcedomain.com. What we want to achieve is depicted below:
![CurrentStateAzureADConnect](/assets/FutureStateAADConnect.png)

Details, details, details
---------------------

1. Reinstalling Azure AD Connect
* Before uninstalling/reinstalling Azure AD Connect/DirSync, the DirSync setting on the Azure AD tenant must be disabled first. Don't forget to run Connect-MsolService!
![DirSyncDisable](/assets/DirSyncDisable.png)
* Reinstall Azure AD Connect and make sure to choose Custom Settings
![AADC03](/assets/AADC03.png)
* Make sure both forests are added
![SyncForests](/assets/SyncForests.png)
* At "uniquely identifying users", make sure to choose an attribute **other than objectGUID**. In my gig's case, we went with **samAccountName**.
![SourceAnchorchange](/assets/SourceAnchorChange.png)
Now - this step is very important. What this will effectively do is change the *immutableID* property on the objects synced with Azure AD, into the new base64 converted samAccountName. The immutableId is your sourceAnchor property on your on-prem domain users.
This step makes sure that users in the metaverse are "hooked" properly to the respective sync-ed users in Azure AD. For more info on the immutableId, i'd recommend checking out this blog: [good stuff about immutableId](http://blogs.perficient.com/microsoft/2015/04/office-365-why-you-need-to-understand-immutableid/)
* Leave everything else at default, especially the attributes to flow - we will touch on that next using the Synchronization Rules Editor.

2. Modifying attribute flow rules
* Open up Synchronization Rules Editor. As reference, this is the end state that we want to be in:
![UPNFlow01](/assets/UPNFlow01.png)
* How do we get there? Create a new rule with the highest priority, connected system object: *user*, metaverse object type: *person*, link type: *join*.
Skip Scoping Filter and Join Rules.
![UPNFlow02](/assets/UPNFlow02.png)
* Then, at Transformations, add a new transformation. Choose Flow Type: *Expression*, target attribute: *userPrincipalName*, merge type: *update*, and source to:

> Left([userPrincipalName], InStr([userPrincipalName], "@")) & "jbdevops.com"

![UPNFlow03](/assets/UPNFlow03.png)



Summarize!
---------------------
Aaaaand... that's it - all user accounts will now sync with only one UPN (which you will define).
Again, what we did are:

* Turned off DirSync on the tenant level
* Reinstalled AAD Connect (choose a new sourceAnchor attribute), add the new forest/domain
* Modified sync rules to force UPN! (because you can't have both UPNs on both sides of the forest trust) 