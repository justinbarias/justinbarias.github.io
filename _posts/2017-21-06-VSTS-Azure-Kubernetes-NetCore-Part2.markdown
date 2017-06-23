---
layout: post
title:  "A continuous delivery pipeline for .NET core with Azure, VSTS, ACS, and Kubernetes - Part 2"
date:   2017-06-21 13:18:00 +1000
categories: ExpertsLive,AzureGlobalBootcamp,Kubernetes,Azure,VSTS,Containers
comments: true
---

Part 2! - We'll be talking about:

* Kubernetes concepts
* Setting up our Kubernetes cluster using ACS (not to be confused with ACS engine)
* Setting up our VSTS build agent


Kubernetes concepts
=======================
Now, my intention is not to replace the official Kubernetes [documentation](https://kubernetes.io/docs/home/), which is awesome, btw. But for the purposes of this, i'll be describing the important stuff.

* Pod - is basically, the smallest logical resource in a Kubernetes cluster. Most often than not, a Pod = container. There are instances, however, where a Pod can contain multiple containers, which applies for tightly coupled containers (which IMO, means you've incorrectly designed your bounded context).
* Service - a load balancer, technically. But this is a logical representation of an "app" - which can be anything, a front-end app, an API, a worker service, a database, etc.
* Replica Set - a construct that manages the count and health of a pod or pods.
* Deployments - is a construct used to capture a desired state of a pod, or pods, along with a ReplicaSet used to manage these pods.
* YAML files - I actually don't know what Kubernetes calls these, but they're just that, YAML files. These YAML files are "infrastructure code" that define these resources that you build and deploy in Kubes.
* kubectl - the CLI used to manage kubernetes and kubernetes resources.

Build your first kubernetes cluster
=======================
In Azure, there are two ways to build a Kubernetes cluster. Using the Azure Container Service, or using ACS Engine.
What? ACS just stands for Azure Container Service right? Well yeah. The Azure Container Services builds out a pre-configured container cluster with the orchestrator of your choice, within an isolated VNET, with a pre-set node SKU. Most of the time, that's good enough. However, if you want to have a say with the virtual network, the size of the nodes, specific kubernetes version, you'll need to use the ACS engine. Since we don't need all that, let's go ahead and use the Azure Container Service.

Doesn't make sense to reinvent the wheel, so I'll be referencing the [Kubernetes guide on ACS](https://docs.microsoft.com/en-us/azure/container-service/container-service-kubernetes-walkthrough). 
But I'll be explaining in detail what happens under the hood.

{% highlight bash %}
    az acs create --orchestrator-type=kubernetes \
    --resource-group myResourceGroup \
    --name=myK8sCluster \
    --agent-count=2 \
    --generate-ssh-keys 

{% endhighlight %}

Should come out with something similar to this:
![acscreate.png](/assets/acscreate.png)

What that block of az cli does are the following:
* Creates a service principal, assigns the "contributor" right to that specific resource group which you had nominated
* Generates a private/public key pair (which gets placed under ~/.ssh)
* Builds a virtual network to host K8s master and agent nodes
* Storage accounts to place the virtual machine hard disks
* Builds a load balancer which exposes SSH to the master node/s
* Builds a VM availability set (scalesets not yet supported for kubernetes), which then spins up the VMs hosting the K8s Master Nodes and K8s Agent Nodes
* Builds a public IP bound to said load balancer
* Network security groups to protect virtual networks
* Builds a routing table to handle network traffic between Pods and Nodes (which is regularly managed by the K8s network controller) - this is important, since Kubernetes does away with the messy port translation/mapping done by non-Kubernetes orchestrators.
* Builds an **azure.json** config file (which contains the details about the Azure RM API, which resource groups, vnets, routing tables) which is then passed into the K8s nodes for the kubelet to consume.
* Builds **kubeconfig**, which is the master cluster config file of the Kubernetes cluster.
* And... voila! You have a working kubernetes cluster!

Then, we run this:


{% highlight bash %}
    az acs kubernetes get-credentials --resource-group=myResourceGroup --name=myK8sCluster

{% endhighlight %}

What this does is fairly simple, it simply runs an scp command to copy the **config** file for kubectl to consume. This file gets transferred to your local machine, and gets placed in the ~/.kube folder.

Now, you can run kubectl! To test, you should run
{% highlight bash %}
    kubectl cluster-info

{% endhighlight %}

Should come out with:
![clusterinfo.png](/assets/cluster-info.png)

Setting up our VSTS build agent
=======================
To setup a proper build/release pipeline for any docker-based application, obviously you will need the docker runtime in your build/release agents. If we were managing our own build server (e.g. Jenkins etc.), it would be as simple as installing docker, kubectl on your jenkins server, then installing the docker and kubernetes plugin. But since we're using a hosted service, we will need to find a way to use a VSTS build agent that has everything we need (e.g. .NET Core, Docker Engine, Kubectl). Also, we want it as lite-touch as it can come - of course, we can build our own VSTS agent(linux server), but that just contradicts the reason why VSTS is so attractive. How about using a docker container as our build agent? Now that sounds like a good compromise.


Prepare VSTS
---------------------
Before we touch kubernetes, we need to prep VSTS to receive connections from a docker container-hosted VSTS agent. Which is pretty easy.

* Just login to VSTS, hit Config->Agent Queues
![agent-queues.png](/assets/agent-queues.png)
* New Queue, enter the new Hosted Queue Name
![hosted-queues.png](/assets/hosted-queue.png)
* Also, make sure to prepare a PAT token. See this [guide](https://www.visualstudio.com/en-us/docs/setup-admin/team-services/use-personal-access-tokens-to-authenticate) on how to make PAT tokens.

Deploy VSTS agent docker image to kubernetes
---------------------
Good thing Microsoft thought of this already - and have built specific docker images **just** for build/release tasks in VSTS. The repo is [here](https://hub.docker.com/r/microsoft/vsts-agent/). Remember that dockerfile we talked about in Part 1?

  {% highlight dockerfile %}

  FROM microsoft/vsts-agent:latest
  RUN apt-get update && apt-get install -y dotnet-dev-1.0.1
  CMD ["./start.sh"]

  {% endhighlight %}

Oh but where are we gonna host this? Wonder if there's any docker cluster hanging around nearby. Let's deploy it in the kubernetes cluster we stood up in the previous step!

We have a YAML file below that tells kubernetes to run that VSTS agent as a pod, in that same kubernetes cluster we did a while ago.

{% highlight yaml %}

apiVersion: v1
kind: Pod
metadata:
  name: vstsagent
  labels:
    purpose: vstsagent

spec:
  containers:
  - name: vstsagent
    image: docker.io/jbdemo/vstsagent:latest
    volumeMounts:
    - mountPath: /var/run/docker.sock
      name: docker-host
    env:
    - name: VSTS_ACCOUNT
      value: "jbdemo"
    - name: VSTS_TOKEN
      value: "redacted"
    - name: VSTS_AGENT
      value: "VSTSLinuxAgent"
    - name: VSTS_POOL
      value: "VSTSLinuxAgent"
    - name: VSTS_WORK
      value: "/var/vsts/$VSTS_AGENT"
  volumes:
    - name: docker-host
      hostPath:
        path: /var/run/docker.sock

{% endhighlight %}

Let's go through the YAML file:
This block tells kubes which image to run, in this case, we're pulling directly from the Microsoft dockerhub image. We're also labelling the pod, for best practice's sake:

{% highlight yaml %}

apiVersion: v1
kind: Pod
metadata:
  name: vstsagent
  labels:
    purpose: vstsagent
spec:
  containers:
  - name: vstsagent
    image: docker.io/jbdemo/vstsagent:latest
{% endhighlight %}


This block tells the VSTS agent, through environment variables, to which VSTS account it should connect, the name of the Agent Pool, the PAT TOKEN (VSTS_TOKEN), etc.

{% highlight yaml %}
    env:
    - name: VSTS_ACCOUNT
      value: "jbdemo"
    - name: VSTS_TOKEN
      value: "redacted"
    - name: VSTS_AGENT
      value: "VSTSLinuxAgent"
    - name: VSTS_POOL
      value: "VSTSLinuxAgent"
    - name: VSTS_WORK
      value: "/var/vsts/$VSTS_AGENT"
  volumes:
    - name: docker-host
      hostPath:
        path: /var/run/docker.sock

{% endhighlight %}

The last block below mounts the path /var/run/docker.sock, which is the docker daemon path on the docker host, on the pod. This is so that the pod can access and run docker commands like docker build, run, push, etc.

{% highlight yaml %}
  volumes:
    - name: docker-host
      hostPath:
        path: /var/run/docker.sock

{% endhighlight %}

Now that's out of the way, we go and create the deployment.
{% highlight bash %}
kubectl create -f Documents/Git/ExpertsLiveCD/vsts/vsts-agent.yaml
{% endhighlight %}

Should come out with something like:
![deploy-vstsagent.png](/assets/deploy-vstsagent.png)

To check the status of the pod deployment, run
{% highlight bash %}
kubectl describe pods
{% endhighlight %}
![describe-pods.png](/assets/describe-pods.png)

It should eventually tell you that it's started:
![pod-started.png](/assets/pod-started.png)

Now to verify that, let's head back to VSTS to see if our agent is indeed recognized by VSTS:
![agent-online.png](/assets/agent-online.png)

Summary
===========
Voila! That completes part 2! Part 3 will be about putting it all together, prepping our build and release pipelines!

Cheers!!