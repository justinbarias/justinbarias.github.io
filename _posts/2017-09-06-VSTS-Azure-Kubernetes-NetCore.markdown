---
layout: post
title:  "A continuous delivery pipeline for .NET core with Azure, VSTS, ACS, and Kubernetes - Part 1"
date:   2017-06-09 14:51:00 +1000
categories: ExpertsLive,AzureGlobalBootcamp,Kubernetes,Azure,VSTS,Containers
comments: true
---

First post in quite a while. Mouthful title! Before we go further, let's get the definitions done:
* .NET Core - specifically, I'm using .NET core MVC
* ACS - Azure container service. Very very, different from AWS ECS. And that's good. ECS is Amazon's try at building their own container cluster orchestrator. "Try" being the operative word, it is as half-baked as any orchestrator can come. No service discovery, no persistent storage, no messaging, no K/V store, i could go on. ACS however, is **not** a container orchestrator. It's a container orchestrator **orchestrator**. Let that sink in a bit. It basically handles Azure Compute Management, Supporting infrastructure (VNETs, NSGs, Storage Accounts), **and** provisions the orchestrator of your choice. Options today are Kubernetes, DC/OS, Swarm.
* Kubernetes - Container orchestrator build by ex-Googlers.  Fun fact - Brendan Burns, creator of Kubernetes [joins Microsoft](https://architecht.io/kubernetes-creator-brendan-burns-on-joining-microsoft-and-where-were-really-at-with-containers-ac7d496911af).
* VSTS - Really?

Now, I could start slow, purely talk about Kubernetes basics, or maybe talk about dotnetcore and how to docker-ize it. But I believe that any piece of tech only delivers value in one place, and no, that's not in your dev machine nor the Git repo. It's in production.

Hence, I'd like to take you on the journey of building a build/release pipeline for running .NET core in **production systems** on a Kubernetes cluster. This will be a 3-part series:
Part 1 will be .NET core, docker basics and stuff, some container best practices.
Part 2 will be about Azure Container Services,  Kubernetes, talking about key concepts like Pods, Services, and YAML IaC files, and putting it all together
Part 3 will be about VSTS, setting up the build agent, build & release pipelines.


Strap in, here's part 1!

Scaffolding using Yeoman 
=======================

Devs nowadays shouldn't handcraft projects and workspaces. Yeoman's the man (or woman)!

{% highlight bash %}
    yo aspnet

{% endhighlight %}

You'll get:

![aspnet.png](/assets/yoaspnet.png)

We'll choose *Web Application* here, obviously.

Building and Running .NET core 
=======================

For this example, I'm using the .NET core MVC sample application (.NET core MVC, Bootstrap JS:

![app.png](/assets/app.png)

With the following folder structure:

![folder.png](/assets/workspace.png)

By navigating to the project folder, then running the command:
{% highlight bash %}
    dotnet restore

    dotnet run

{% endhighlight %}

That allows us to build our .NET core app.

Compiling and docker-izing 
--------------------------

Now that we can run that .NET core app, it's time to **dockerize!** (okay that sounded terrible).

To start off, we need a **dockerfile**. A dockerfile tells the docker engine what to put into your docker image, which base docker image to use, and what you want it to use as an *entrypoint*.

One thing to note (actually, three things):
Container best practice tells us that we should have at least *3 different types of docker images* to use per app, for different purposes. That means, three different dockerfiles.
* Dev image - This is dev-controlled, dev tells what's in it, dev manages it, dev uses it. **Not for production use**.
  Here's the dev dockerfile:

  {% highlight dockerfile %}

  FROM microsoft/dotnet:1.1.1-sdk
  WORKDIR /app

  COPY ExpertsLiveWebApp.csproj .
  RUN dotnet restore

  COPY . .
  RUN dotnet publish -c Debug -o publish
  ENTRYPOINT ["dotnet", "publish/ExpertsLiveWebApp.dll"]

  {% endhighlight %}
* Build image - Ops-controlled. Tailor-made for build agents and build tasks, test agents and tasks. Used by devs for build workflows. **Used only for production build agents**, still **not for production workload**.

  Here's the build agent dockerfile (yes, the build agents are on a docker container - docker building docker!).
  {% highlight dockerfile %}

  FROM microsoft/vsts-agent:latest
  RUN apt-get update && apt-get install -y dotnet-dev-1.0.1
  CMD ["./start.sh"]

  {% endhighlight %}
* Production image - Ops-controlled. Locked down. Lean. Purpose-built for production workload.

  And here's the build/production dockerfile:

  {% highlight dockerfile %}

  FROM microsoft/dotnet:1.1.1-sdk
  WORKDIR /app

  COPY publish/ExpertsLiveWebApp ./
  ENTRYPOINT ["dotnet", "ExpertsLiveWebApp.dll"]

  {% endhighlight %}

  Image #2 is simple enough, we point it to the Microsoft-provided build agent for VSTS, using *start.sh* as the entry point to run the VSTS agent.

  Image #1 and #3 are very similar. I'll point out the difference in the code block below. The code block below is the block present in #1, but absent in #3.

  {% highlight dockerfile %}

  COPY ExpertsLiveWebApp.csproj .
  RUN dotnet restore


  COPY . .
  RUN dotnet publish -c Debug -o publish
  {% endhighlight %}

  What this does basically, is:
  * Copy the .NET project file (csproj)
  * Restore dependencies
  * Copy the application source code 
  * Build/Compile the Debug build profile for said app

  Since this is the "dev" docker image, we're doing a build on our local dev machine. This is the "dev" part of the workflow. 

  So, our docker dev workflow would be:
  * Clean the workspace of non-docker build files! Namely /publish, /bin and /obj. This is because if you run docker build with these folders in your local workspace, these would be copied along into the docker staging environment.
  * Run *Docker build* {% highlight bash %} docker build . -f dockerfile-dev{% endhighlight %}
  ![dockerbuild.png](/assets/dockerbuild.png)
  * Run *Docker run* {% highlight bash %} docker run -d -p 5000:5000 6eb380961880{% endhighlight %}
  ![dockerrun.png](/assets/dockerrun.png)

  To prove I'm not cheating, here's a view of the container thru Kitematic:
  ![dockerrun.png](/assets/kitematic.png)

That's it for part 1! We now have an app, and have established a typical dev machine workflow.

Part 2 is about Kubernetes, ACS, and the bits necessary to run our UAT environments, PROD environment, and stuff.

You can find the source code, and future stuff I'll be showing in [here](https://github.com/justinbarias/ExpertsLiveRepo)