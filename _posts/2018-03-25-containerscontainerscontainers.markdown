---
layout: post
title:  "AKS (Azure Kubernetes Service) Teardown/Early Review"
date:   2018-03-25 18:00:00 +1100
categories: Teardown, Review, AKS
comments: true
---

Been a while since my last post. Let's get back to getting down and dirty! Here we have a teardown (well, not really a teardown) of Azure Kubernetes Service (the managed Kubernetes hosting option in Azure). Been using it for about 4 weeks running a sort of production workload (which is another blog post).

What's AKS?
-------------------
This is what Microsoft describes AKS as:
```
Azure Container Service (AKS) manages your hosted Kubernetes environment, 
making it quick and easy to deploy and manage containerized applications 
without container orchestration expertise. It also eliminates the burden 
of ongoing operations and maintenance by provisioning, upgrading, and 
scaling resources on demand, without taking your applications offline.
```

For people who actually know Kubernetes inside out, that doesn't really tell me much. So, what does Microsoft do for me, and what do I need to continue doing?

Let's compare that with Google's GKE [documentation](https://cloud.google.com/kubernetes-engine/docs/concepts/cluster-architecture), which explicitly says:
```
Cluster master
The cluster master runs the Kubernetes control plane processes, including 
the Kubernetes API server, scheduler, and core resource controllers. The 
master's lifecycle is managed by Kubernetes Engine when you create or delete 
a cluster. This includes upgrades to the Kubernetes version running on the 
cluster master, which Kubernetes Engine performs automatically, or manually 
at your request if you prefer to upgrade earlier than the automatic schedule.
```

So google tells us that they manage the API server, scheduler, and resource controller pods (which normally are part of the kube-system namespace). While Microsoft tells us... nothing basically. Good thing I'm here! The short answer is - basically Microsoft does exactly the same as google.

The bad news
================
 What this means is that access to the api-server, resource controller and scheduler is off limits (as they might be shared across multiple tenants). This can have multiple repercussions, e.g.:
* Monitoring these services is at this point a bit of an unknown. AKS doesn't give us an indication of whether these services are available or not. I've tried installing the Prometheus/Grafana stack, and all I get is an "unhealthy" report from these services (which is not true, as they work lol).
* Configuration invoked using a command line on api-server described [here](https://kubernetes.io/docs/reference/generated/kube-apiserver/) is basically not available for the likes of AKS (and GKE as well). **This is probably the biggest downside of using a managed/hosted kubernetes instance. Heaps of features depend on setting those flags on the kube-apiserver process, and are therefore rendered unavailable.** This all makes sense though as these providers might want to wrap their own services around those features (GKE does this by bootstrapping GCE IAM with kubernetes - good stuff). AKS however, doesn't, and basically leaves us to use the ***legacy*** authentication engine (cert-based).
* Running the add-on services will run on your workload nodes, (though with smart node labelling and targetting, you can limit them to specific nodes), not on your master nodes. For those who aren't k8s savvy, an example of add-on services are the service discovery service (lol), dashboard, overlay networks such as flannel (if needed, but I really don't see why you'd run this in a cloud provider), network policy services (for tighter network firewalls). Microsoft should probably put this on as a disclaimer, though these services don't consume much resources anyway.


Some gotchas
================
Another gotcha is monitoring. Since Kubernetes 1.8.x, the heapster service has basically been deprecated as the metrics aggregator for kubernetes. This has been replaced by the metrics server. The problem though is AKS still deploys heapster (which is now incompatible with some critical services such as the horizontal pod autoscaler) - which causes heaps of problems. Again using a regular BYO kubernetes cluster, you can set the api server flag to not use the rest-based metrics server via the ``` --horizontal-pod-autoscaler-use-rest-clients ``` flag, which unfortunately you can't do on AKS. So the solution would be to deploy the metrics-server yourself. Here's how to do it:

* Download the metrics-server deployment yamls [here](https://github.com/kubernetes-incubator/metrics-server/tree/master/deploy)
* Run kubectl create -f ./--download-folder--/

And that's it, you get the metrics-server pod, service, and your horizontal autoscaler will work again.

The verdict
-------------------
The biggest downside probably is the lack of authentication/SSO mechanism due to the reasons of above. This tells me that enterprise production consumption is probably still a ways off. Also, until Microsoft exposes AKS with ***all or most of the api-server config flag***, I'd probably not recommend AKS to mature kubernetes users. For a tech-savvy or probably startup organisations who dont mind getting dirty with SSH certs, running an AKS for under $100 a month (2-node Standard_A1 nodes) (where you can host your CI/CD pipeline workers, monitoring hosts, and staging & prod workload -- I promise, I shall blog about this) - this is a definite steal as you pay for just your worker nodes. In a BYO production k8s cluster, you normally run 2-3 master nodes (which can cost a fair bit in the cloud).

Well, that's it - a quick and dirty one! Let me know your thoughts in the comments section please!

