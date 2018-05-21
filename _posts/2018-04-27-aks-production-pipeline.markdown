---
layout: post
title:  "A production grade AKS environment - Part 1"
date:   2018-04-27 18:00:00 +1000
categories: Guide, AKS
comments: true
---

Remember that post I promised about running a full-fledged Kubernetes environment in under $150/month? Well, here it is!
Note, this is not a beginner-level guide - this assumes you have full working knowledge on kubernetes, kubectl, AKS, etc.


Prerequisites
-------------------

* Ideally, a linux/unix workstation machine (else run the Ubuntu subsystem in Windows 10).
* An Azure subscription which goes up to $150 ($200 would be better, which is perfect as this is the Bizpark grant $ IIRC)
* A live Kubernetes cluster (via AKS, which is the fastest way to provision a kubernetes cluster nowadays)
* A free VSTS account
* Docker 
* Azure CLI 
* Helm - install using ```brew install kubernetes-helm``` or whatever is required in your distro
* Kubectl - install using ``` brew install kubectl ``` or whatever is required in your distro
* Your application (regardless of which platform, node, .netcore, golang, etc)


Why Helm?
-------------------
This post isn't meant to get you up to speed with Helm. So if you need figuring out what helm is, read up first [here](https://helm.sh/).
In a nutshell though, Helm is your de-facto package manager for Kubernetes. If you've been using kubernetes for a while now, you'll soon realise that the config yml files in kubernetes is very limited. 
* No native versioning of releases
* No capability to dynamically replace values (without doing some funky string manipulation)
* Because of above, it's tough to reuse yml config files

Helm basically wraps up your config YMLs into a single releasable manifest (provided you group them logically). For this post, I'll be using helm to deploy the following in kubernetes:
* Grafana
* Prometheus
* My Application Stack

Installing helm on your K8s cluster
================
You've already installed Helm on your local machine. Now, we need to install Helm on your kubernetes cluster. This deploys a service called Tiller into your kubernetes cluster.

Now assuming you've setup kubectl, installing helm/tiller into K8s should be as simple as:
``` helm init ```

This gets the default context in your kube.config, and installs Tiller using the credentials specified.

![Helminit](/assets/helm-init.png)

Have a look at the kube-system namespace and you should see a **tiller-deploy** deployment. 

![TillerDeployment](/assets/deploy-tiller.png)

Prepping your build/release pipeline nodes
-------------------
Assuming you already have your VSTS account ready - this is where the magic starts.
We'll be deploying VSTS agents using helm. 

You'll need your:
* VSTS account name 
* Personal Access Token
* A new agent pool. Look [here](https://docs.microsoft.com/en-us/vsts/build-release/concepts/agents/pools-queues?view=vsts#creating-agent-pools-and-queues) for instructions how to do that. Take note of the agent pool name.

VSTS Docker Image
================

This guide uses one of my old vsts agent images [here](https://hub.docker.com/r/jbdemo/vstsagent/).
This already includes kubectl, dotnet, and helm. If you want the dockerfile i used to build this, check this out:

```dockerfile
FROM microsoft/vsts-agent:latest

# install kubectl
RUN curl -LO https://storage.googleapis.com/kubernetes-release/release/$(curl -s https://storage.googleapis.com/kubernetes-release/release/stable.txt)/bin/linux/amd64/kubectl && \
    chmod +x ./kubectl && \
     sudo mv ./kubectl /usr/local/bin/kubectl

# install helm
RUN curl https://raw.githubusercontent.com/kubernetes/helm/master/scripts/get > get_helm.sh && \
    chmod 700 get_helm.sh && \
    ./get_helm.sh && \
    helm init --client-only

# install angular cli
RUN npm i -g @angular/cli

#install headless chrome

RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - && \
  echo "deb http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list && \
  apt-get update && \
  apt-get install -y google-chrome-stable xvfb

ENV CHROME_BIN /usr/bin/google-chrome
    
CMD ["./start.sh"]
```

Wait, how do I move my kubernetes credentials to the VSTS pod then? Well, the short answer is, you don't need to!
That's the magic of hosting your release nodes in kuberenetes. If, however, you had a different cluster for your build stuff, and another cluster for workload stuff, then yes, you would have to somehow pass your /.kube/config file up (probably using a secret or configmap).

Our First Helm Chart
================
`
Now, we'll create a helm chart. Which is basically a collection of package metadata, and package sources (in the form of a couple of yaml files). A typical helm chart structure looks like this:

```
--<chart-folder-name>
---templates
-----deployment.yaml
---Chart.yaml
```

In our case, we want it to look like this:

```
--vsts
---templates
-----deployment.yaml
---Chart.yaml
```

Under templates, you can put as many deployment yaml files as you want. Normally you'd want one to deploy your secrets, configmaps, etc. For VSTS build agent pods, we'll keep it simple, and will stick to a single deployment.yaml.

Here's deployment.yaml:

```yml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: vstsagent2
spec:
  replicas: 2
  template:
    metadata:
      labels:
        app: vsts
    spec:
      volumes:
      - name: docker-host
        hostPath:
         path: /var/run/docker.sock
      containers:
        - name: hello-world
          image: docker.io/jbdemo/vstsagent:2.1
          env:
          - name: VSTS_ACCOUNT
            value: "<VSTS-ACCOUNT-NAME-HERE>"
          - name: VSTS_TOKEN
            value: "<PAT-TOKEN-HERE>"
          - name: VSTS_POOL
            value: "<VSTS-AGENT-POOL-NAME-HERE>"
          volumeMounts:
          - mountPath: /var/run/docker.sock
            name: docker-host
```

Deploy the VSTS Chart
================

Navigate to the ./vsts director, and run the command:

```bash
helm install .
```

Which spits out the following:

![VSTSHelmInstall](/assets/vsts-helm-install.png)

To verify, head over to your VSTS Account settings, and under agent pools:

![VSTSAgentPods](/assets/vsts-pods.png)

Voila! Free hosted VSTS nodes (well, not exactly, but we have cost effective ones).

Namespaces
-------------------

Again, read up on namespaces [here](), but in a nutshell, we will use namespaces to logically segregate resources running on our cluster. This also affects things like resource discovery (DNS), and references to secrets and configmaps. 
Since we want to keep costs below $200, we'll use a single cluster to host our multiple environments.

So let's go and create our namespaces:
* Staging - our production-like environment, we run regressions on this environment as part of our CD pipeline.
* Production - our production environment. Builds which pass regression on staging gets deployed here as part of our CD pipeline.

Let's create these:

```bash
kubectl create namespace staging
kubectl create namespace production
```

Now this means that all resources we create (via helm) should now add the ```--namespace <namespace-name>``` flag.

Builds and Container Registries
-------------------

Let's define our build definition for our application. In this case, it's a simple Angular2+DotnetCore app. On a high level, the build will look something like this:
* Get resources (from github)
* Restore dependencies (dotnet and npm)
* Build (dotnet build and webpack)
* Run tests (dotnet test and ng test)
* If successful, compile docker image.
* Push image to registry with proper tag

Image tagging
================

This is a hot point of debate - but i'll keep it simple. In our branching strategy we basically have develop and master.
Develop for day to day development work, then merge up to master with proper git tags (for versioning).

We'll tag images built off of master with:
* VSTS Build Id
* latest
* latest git tag (version tags - following semver)

We'll tag images built off of dev with:
* VSTS Build Id

Service endpoints
================

Before we can push images to dockerhub/private registries and deploy stuff to kubernetes, we'll have to setup service endpoints.

For kubernetes, it's as simple as copying the contents of your ~/.kube/config file into this dialog box:

![k8ssp](/assets/k8sserviceendpoint.png)

Creating a dockerhub service endpoint is easy enough:

![dockerhubsp](/assets/dockerhubsp.png)

Build definition
================

Nothing special with this build definition, aside from the specific image build tasks for master/develop. 

![builddef](/assets/BuildDef.png)

The only thing of note, possibly is the "Publish Artifact" phase. Wait, our artifact is a docker image, right? True!

However, we still have to worry about our Helm charts and scripts we want to use for our release. We want that under version control as well! We'll talk about that in specifics later.

So under my repo i have a folder (deploy):

```
---deploy
----helm
-----<application-name>
------Chart.yaml
------templates
------deployment.yaml
-------secrets.yaml
-----vsts
------Chart.yaml
------templates
-------deployment.yaml
----scripts
-----deploy.sh
```

Release definition
================

Nothing special with this as well. Obviously we want our release environments to mirror our kubernetes namespaces. 

![releasedef](/assets/ReleaseDef.png)

We've got a trigger configured to automatically deploy to staging.

For production, we'd either want to do a manual deployment approval, or probably make use of Function-based triggers, maybe evaluate regression results.

Let's look at the single task we have in our release:

![deployhelmchart](/assets/deployhelmchart.png)

We simply invoke deploy.sh. Pass in a couple of arguments - which will be described later.
$(releaseName) is simply $(Release.DefinitionName) + $(Release.Environment).

Now let's look at deploy.sh. This is where we use our helm charts and commands.

```bash
#!/bin/bash -x

#get base variables from args

release_base=$1 #passed from a VSTS variable
namespace=$3 #passed from the environment name in release management
postgresPassword=$4 #secret variable in VSTS
regcred=$2 #name of secret in kubernetes to pull image from
build_id=$5 #build id for the immutable image tag

#generate postgres release name
postgres_releasename=$release_base-postgres
#generate dotnetcoreapp release name
dotnetcoreapp_releasename=$release_base-dotnetcoreapp

#install/upgrade postgres deployment using helm chart stable/postgresql, here we pass $postgresPassword
helm upgrade $postgres_releasename stable/postgresql --install --force --namespace $namespace --set postgresPassword=$postgresPassword
#retrieve postgres_password via kubectl get secret
postgres_password=$(kubectl get secret --namespace $namespace $postgres_releasename-postgresql -o jsonpath="{.data.postgres-password}" | base64 --decode; echo)
#generate base64connectionstring
base64connstring=$(echo "User ID=postgres;Password=$postgres_password;Host=$postgres_releasename-postgresql;Port=5432;Database=dotnetcoreappdb;Pooling=true;" | base64 --wrap=0; echo)

#create helm deployment for dotnetcoreapp, here we pass registry credential name, connectionstring in base64, image/repo to pull from, image tag, and namespace to deploy to
helm upgrade $dotnetcoreapp_releasename $PWD/helm/dotnetcoreapp --install --force --debug --set registry.credentials=$regcred --set connectionString.base64connstring=$base64connstring --set image.repo=dotnetcoreappci --set image.tag=$build_id --namespace $namespace
```

Helm chart for our App
================
The last piece of the puzzle, the helm chart for your application. (Which is used in the release scripts above).

```
---deploy
----helm
-----<application-name>
------Chart.yaml
------templates
------deployment.yaml
-------secrets.yaml
```

### Chart.yaml

```yaml
name: dotnetcoreapp
version: 1.0.0
```

Pretty simple, the version here is **not** the app version, but rather, the chart version.

### deployment.yaml

Remember the ```bash helm upgrade``` command above with the --set arguments? These arguments get passed into **all the templates** we create and can be consumed globally. We use them in a template by invoking the Go template language syntax, for example:

```Go
.Values.Image.Tag
```
For the argument --set image.tag==tag-version

This deployment.yaml template creates the deployment definition (which creates the pod, replica set).

```yaml
apiVersion: extensions/v1beta1
kind: Deployment
metadata:
  name: { { printf "%s-%s" .Release.Name .Chart.Name | trunc 63 } }
  labels:
    app: { { printf "%s-%s" .Release.Name .Chart.Name | trunc 63 } }
    version: { { .Chart.Version } }
    release: { { .Release.Name } }
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: { { printf "%s-%s" .Release.Name .Chart.Name | trunc 63 } }
        version: { { .Chart.Version } }
        release: { { .Release.Name } }
    spec:
     imagePullSecrets:
     - name: { { .Values.registry.credentials } }
     containers:
      - name: dotnetcoreapp
        env:
        - name: DbContextSettings__ConnectionString
          valueFrom:
           secretKeyRef:
            name: { { printf "%s-%s-secret" .Release.Name .Chart.Name | trunc 63 } }
            key: connString
        image: { { printf "dotnetcoreappci/%s:%s" .Values.image.repo (toString .Values.image.tag)} }
        ports:
        - name: dotnet-port
          containerPort: 5000
```

### secrets.yaml

This template creates the secret which is consumed by our dotnetcore app. This is passed along the helm upgrade --set command.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: { { printf "%s-%s-secret" .Release.Name .Chart.Name | trunc 63 } }
type: Opaque
data:
  connString: { {  .Values.connectionString.base64connstring } }
```

Obviously, you could do the same with configmaps. 

This, is our CI-CD pipeline from build to release in a kubernetes cluster. 

Watch out for part 2 & 3 ! Which will cover the following:
* Monitoring (Prometheus + Grafana)
* Extend helm charts to include ingress controller config (especially for production)
* Modify production deployments to do rolling update policy on replication controllers, or do blue/green releases.
* Ingress controllers and ingresses, as well as securing them with TLS via LetsEncrypt
