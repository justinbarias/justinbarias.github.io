---
layout: post
title:  "A production grade AKS environment - Part 2"
date:   2018-05-20 12:00:00 +1000
categories: Guide, AKS, LetsEncrypt
comments: true
---

By now you've probably heard of LetsEncrypt - the **only** free certificate signing service out there. For any production service, these endpoints must be published via an SSL-terminated endpoint, while the services internally need not be via HTTPs (they may not even be HTTP int he first place e.g. RPC). This is possible using a reverse proxy. The most common reverse proxy globally is NGINX, which to our luck is a native ingress controller in k8s. Read more about ingress controllers [here](https://kubernetes.io/docs/concepts/services-networking/ingress/#ingress-controllers). There are other options, such as cloud hosted and managed ones like [AWS application load balancer](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html) and [Azure Application gateway](https://docs.microsoft.com/en-us/azure/application-gateway/application-gateway-introduction). 


Expose your service
-------------------
Let's create a service template for our app:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: { { printf "%s-%s-service" .Release.Name .Chart.Name | trunc 63 } }
  labels:
    app:  { { printf "%s-%s" .Release.Name .Chart.Name | trunc 63 } }
    version: { { .Chart.Version } }
    release: { { .Release.Name } }
    heritage: { { .Release.Service } }
    release: { { .Release.Name } }
spec:
  type: "NodePort"
  ports:
    - name: http
      port: 80
      protocol: TCP
      targetPort: 5000
  selector:
      app: { { printf "%s-%s" .Release.Name .Chart.Name | trunc 63 } }
      version: { { .Chart.Version } }
      release: { { .Release.Name } }
```

This gets picked up by helm as long as its under the /templates/ folder.
Also, since we want our ingress controller to expose our service, we will set this service to simply be a "NodePort" type instead of "LoadBalancer".

Setup your ingress controller
-------------------

Install the nginx-ingress service in your kube cluster:

```bash
helm install stable/nginx-ingress --namespace kube-system --set rbac.create=false --set rbac.createRole=false --set rbac.createClusterRole=false
```

Since we're using AKS (which doesn't support helm-provided cluster level roles at the moment), we won't use RBAC for the nginx ingress service. I had some success, however, in creating a service account, assigning a cluster role binding for that SA, and using that service account in creating nginx ingress. But the command above will be the simpler approach.

This will create a deployment, pods, and a service (of type LoadBalancer) in our k8s cluster.

```bash
$ kubectl get service -l app=nginx-ingress --namespace kube-system

NAME                                       TYPE           CLUSTER-IP     EXTERNAL-IP     PORT(S)                      AGE
eager-crab-nginx-ingress-controller        LoadBalancer   10.0.182.160   51.145.155.210  80:30920/TCP,443:30426/TCP   20m
eager-crab-nginx-ingress-default-backend   ClusterIP      10.0.255.77    <none>          80/TCP                       20m
```

Now that we have a working ingress controller, we'll setup 1) our application's ingress resource, and the letsencrypt stuff.

Create your application's ingress resource
-------------------

Each application we host in k8s will need its own ingress resource. This doesn't create a dedicated nginx instance for each app, but rather,updates the nginx instance's nginx.conf to define rules for each application.

Below is the ingress template for our app. Again, make sure to place it in your /templates/ folder under your helm stuff.

```yaml
apiVersion: extensions/v1beta1
kind: Ingress
metadata:
  name: { { printf "%s-%s-ingress" .Release.Name .Chart.Name | trunc 63 } }
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  tls:
    - hosts:
      - www.dotnetcoreapp.com
      secretName: dotnetcoreapp-staging-tlscert
  rules:
    - host: www.dotnetcoreapp.com
      http:
       paths:
       - path: /
         backend:
          serviceName: { { printf "%s-%s-service" .Release.Name .Chart.Name | trunc 63 } }
          servicePort: 5000
   
```

Configure LetsEncrypt with your ingress controller
-------------------
Cert-manager is the k8s native service that hooks up your k8s cluster with letsencrypt (acme). The previous option used to be kube-lego (Which is now effectively dead).

Learn more about cert-manager [here](https://cert-manager.readthedocs.io/en/latest/index.html).


Using cert-manager, there are two ways to configure letsencrypt to issue certs for your domain.
* DNS based - requires you to create entries in your DNS registry
* HTTP based - creates HTTP pods/services to be accessed via your k8s cluster. The assumption is that your top-level DNS must point to your ingress controller.

We will go with the 2nd option.

Let's install cert-manager first:

```bash
helm install \
    --name cert-manager \
    --namespace kube-system \
    stable/cert-manager
```

### Issuer definition
Now let's create our issuer definition:

This creates a kubernetes native object (Issuer) provided by the certmanager api.

```yaml
apiVersion: certmanager.k8s.io/v1alpha1
kind: Issuer
metadata:
  name: letsencrypt-staging
  namespace: staging
spec:
  acme:
    # The ACME server URL
    server: https://acme-v01.api.letsencrypt.org/directory
    # Email address used for ACME registration
    email: dotnetcoreapp@dotnet.com
    # Name of a secret used to store the ACME account private key
    privateKeySecretRef:
      name: letsencrypt-staging
    # Enable the HTTP-01 challenge provider
    http01: {}
```

To get the status of your Issuer, run:

```bash
kubectl describe issuer letsencrypt-staging -n staging

Name:         letsencrypt-staging
Namespace:    staging
Labels:       <none>
Annotations:  kubectl.kubernetes.io/last-applied-configuration={"apiVersion":"certmanager.k8s.io/v1alpha1","kind":"Issuer","metadata":{"annotations":{},"name":"letsencrypt-staging","namespace":"staging"},"spec":{"a...
API Version:  certmanager.k8s.io/v1alpha1
Kind:         Issuer
Metadata:
  Cluster Name:
  Creation Timestamp:  2018-05-12T07:36:20Z
  Generation:          0
  Resource Version:    295889
  Self Link:           /apis/certmanager.k8s.io/v1alpha1/namespaces/staging/issuers/letsencrypt-staging
  UID:                 -------------------------
Spec:
  Acme:
    Email:  -----------
    Http 01:
    Private Key Secret Ref:
      Key:
      Name:  letsencrypt-staging
    Server:  https://acme-v01.api.letsencrypt.org/directory
Status:
  Acme:
    Uri:  https://acme-v01.api.letsencrypt.org/acme/reg/-----------
  Conditions:
    Last Transition Time:  2018-05-12T07:36:23Z
    Message:               The ACME account was registered with the ACME server
    Reason:                ACMEAccountRegistered
    Status:                True
    Type:                  Ready
Events:                    <none>
```

Once you get the message "The ACME account was registered with the ACME server".


### Certificate definition
Now let's create our Certificate template. This should go into your /helm/templates/ folder as well.

```yaml
apiVersion: certmanager.k8s.io/v1alpha1
kind: Certificate
metadata:
  name: dotnetcoreapp-staging-tlscert
  namespace: staging
spec:
  secretName: dotnetcoreapp-staging-tlscert
  issuerRef:
    name: letsencrypt-staging
  commonName: www.dotnetcoreapp.com 
  acme:
    config:
    - http01:
        ingressClass: nginx
      domains:
      - www.dotnetcoreapp.com
    - http01:
        ingress: { { printf "%s-%s-ingress" .Release.Name .Chart.Name | trunc 63 } }
```

To get the status of your certificate, run:

```bash
kubectl describe certificate dotnetcoreapp-staging-tlscert -n staging

Name:         dotnetcoreapp-staging-tlscert
Namespace:    staging
Labels:       <none>
Annotations:  kubectl.kubernetes.io/last-applied-configuration={"apiVersion":"certmanager.k8s.io/v1alpha1","kind":"Certificate","metadata":{"annotations":{},"name":"dotnetcoreapp-staging-tlscert","namespace":"staging"}...
API Version:  certmanager.k8s.io/v1alpha1
Kind:         Certificate
Metadata:
  Cluster Name:
  Creation Timestamp:  2018-05-12T23:28:23Z
  Generation:          0
  Resource Version:    437657
  Self Link:           /apis/certmanager.k8s.io/v1alpha1/namespaces/staging/certificates/dotnetcoreapp-staging-tlscert
  UID:                 ------------------------
Spec:
  Acme:
    Config:
      Domains:
        www.dotnetcoreapp.com
      Http 01:
        Ingress:
        Ingress Class:  nginx
      Domains:          <nil>
      Http 01:
        Ingress:  dotnetcoreapp-ingress
  Common Name:    www.dotnetcoreapp.com
  Dns Names:      <nil>
  Issuer Ref:
    Name:       letsencrypt-staging
  Secret Name:  dotnetcoreapp-staging-tlscert
Status:
  Acme:
    Authorizations:
      Account:  https://acme-v01.api.letsencrypt.org/acme/reg/-----------
      Domain:   www.dotnetcoreapp.com
      Uri:      https://acme-v01.api.letsencrypt.org/acme/challenge/-------------------/----------
  Conditions:
    Last Transition Time:  2018-05-12T23:28:44Z
    Message:               Certificate issued successfully
    Reason:                CertIssueSuccess
    Status:                True
    Type:                  Ready
Events:                    <none>
```

Certificate issuance normally takes a bit of time, but you should be able to track the status of the certificate request via the bash command above.

And that's it! The bonus here as well is that the issuer & certificate objects handle certificate renewal for you as well! How bout that?

Look out for part 3 for monitoring and log ingestion stuff!