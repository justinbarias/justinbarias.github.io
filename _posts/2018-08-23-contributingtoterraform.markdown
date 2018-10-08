---
layout: post
title:  "Contributing to Terraform - creating a resource in the AzureRm provider"
date:   2018-08-23 09:00:00 +1000
categories: oss, golang, terraform
comments: true
---

The last couple of months have involved me going deep into Terraform, so deep, that I've started finding myself finding the current Azure provider a little bit lacking. So I decided to fork, branch, and PR. I'll go step by step on the high level steps required in extending a terraform provider - namely, creating a brand new Provider resource.

## Go - a brilliant, yet simple language

Even prior to messing around with Terraform, I've made learning Go a goal as contributing to k8s is something I want to be able to do in the short term. This however, isn't meant to give a review for Go, so I'll make it really short and succint.

It felt alot like working on C's strongly-typed goodness, but with all the modern conveniences of Javascript ECMAScript 6 (or any modern OOP language like C#). Another thing that felt refreshing is that Go isn't object oriented, **but** with an interface construct - without all the emotional baggage of inhertance, classes, etc. Don't get me started on Go's concurrency model as well (async programming is a **breeze**).

I'll probably stop here before I spark another language/paradigm debate/war.. But I can start to see why Go is used for most of the Cloud Native Computing Foundation projects.

## Terraform plugin framework

Terraform's plugin framework, while not documented well beyond a simple "Hello World" example, is very simple, and easily understandable simply by looking at code of the actual providers. This is mainly due to Go's simplicity, and the way the provider framework was designed.

A high level how-to-write-custom-providers document is specified [here](https://www.terraform.io/docs/extend/writing-custom-providers.html).

The key is how the Terraform core and Terraform plugins libraries were designed - probably a more advanced topic, so I won't cover it here.

TL;DR - the terraform plugins library abstracts your provider/resource code from the terraform core engine.

## The AzureRm provider

The AzureRm provider obviously, exists as a separate project in [github](https://github.com/terraform-providers/terraform-provider-azurerm), maintained by some Terraform employees, and open to contribution from anyone.

The AzureRm provider uses the [Go SDK for Azure](https://github.com/Azure/azure-sdk-for-go), while there may be instances that the API is ahead of the SDK (example: [Subscription Creation](https://docs.microsoft.com/en-us/azure/azure-resource-manager/programmatically-create-subscription?tabs=rest) is not yet available in the Go SDK), most often than not, you will find what you need in the Go SDK for Azure.

## Adding your own Azure resource for the AzureRm provider

To make it really simple, adding a new resource consists of:

* Define your resource schema & CRUD functions
* Registering your resource in provider.go
* Registering the resource provider in config.go (*Optional*)
* Configuring and registering your ARMClient in config.go
* Creating unit/acceptance tests for your new resource

We'll tackle each step one by one. And for this example, we'll use the actual new resource I created - the [azurerm_management_group](https://github.com/justinbarias/terraform-provider-azurerm/tree/iss1401-management-groups) resource.

## Defining resource schema & CRUD functions

Start off by creating your new resource type, in this case **resource_arm_management_group.go**.

### Define your schema

Here, you create a function with returns a type of **&schema.Resource type.

```go
func resourceManagementGroup() *schema.Resource {
	return &schema.Resource{
		Create: resourceManagementGroupCreateUpdate,
		Update: resourceManagementGroupCreateUpdate,
		Read:   resourceManagementGroupRead,
		Delete: resourceManagementGroupDelete,
		Importer: &schema.ResourceImporter{
			State: schema.ImportStatePassthrough,
		},

		Schema: map[string]*schema.Schema{
			"name": {
				Type:     schema.TypeString,
				Required: true,
				ForceNew: true,
			},

			"subscription_ids": {
				Type:     schema.TypeList,
				Optional: true,
				Elem: &schema.Schema{
					Type: schema.TypeString,
				},
			},
		},
	}
}
```


In this case, my management group resource only has 2 attributes, **name** and **subscription_ids** (which refer to the subscriptions associated with the management group).

### Build the CRUD functions

Now as you saw in the schema above, the Resource Type struct, it needs a callback function for the Create, Update, Read, Delete, and Importer functions.

I won't go through each CRUD function here (you may look at the source code for a proper example), but basically this is where you invoke the Azure Go SDK. Below is a sample code on how to retrieve the GO SDK Client instance, and to invoke it:

```go
	client := meta.(*ArmClient).managementGroupsClient
	subscriptionsClient := meta.(*ArmClient).managementGroupsSubscriptionClient
	ctx := meta.(*ArmClient).StopContext
```

In the case above, building the resource requires me to invoke the managementGroupsClient (Create the Management Group)and the managementGroupsSubscriptionClient (Assign subscriptions to management group).

Also, this is not meant to be a Go tutorial, so look up the concept of [Go Futures](http://www.golangpatterns.info/concurrency/futures) for async programming with Go.

Note that in order to properly do your CRUD functions, you'll have to read up on either the SDK/API. 

Best place to look is in the Go-SDK (which you'll have to go get anyway), and the Azure REST API spec [here](https://github.com/Azure/azure-rest-api-specs/tree/master/specification).

## Register your resource type in provider.go

After you've defined your resource, you must register it in the provider.go, specifically, in the Provider() function - this returns an instance of a resource provider. By registering your new resource, you're adding it in the **ResourcesMap** property of the provider object.

```go
ResourcesMap: map[string]*schema.Resource{
			"azurerm_azuread_application":                     resourceArmActiveDirectoryApplication(),
			"azurerm_azuread_service_principal":               resourceArmActiveDirectoryServicePrincipal(),
			// truncated for brevity
			"azurerm_management_group":                        resourceManagementGroup(),
			// truncated for brevity
			"azurerm_virtual_network_peering":                 resourceArmVirtualNetworkPeering(),
		},
```

## Configuring the resource client(ARMClient)

Next, you'll have to wire up and define the specific ArmClients that you need for your new resource types. If the new resource you're creating is already registered, then you may skip this step.

```go
// Management Groups
	managementGroupsClient             managementgroups.Client
    managementGroupsSubscriptionClient managementgroups.SubscriptionsClient
    
```

Create a function which configures your SDK clients, this passes through the config from the *ArmClient type into the specific clients you need to use.

```go
func (c *ArmClient) registerManagementGroupClients(endpoint string, auth autorest.Authorizer) {
	managementGroupsClient := managementgroups.NewClientWithBaseURI(endpoint)
	c.configureClient(&managementGroupsClient.Client, auth)
	c.managementGroupsClient = managementGroupsClient

	managementGroupsSubscriptionClient := managementgroups.NewSubscriptionsClientWithBaseURI(endpoint)
	c.configureClient(&managementGroupsSubscriptionClient.Client, auth)
	c.managementGroupsSubscriptionClient = managementGroupsSubscriptionClient
}
```

And, invoke that function into the GetArmClient function:

```go
client.registerManagementGroupClients(endpoint, auth)
```

## Creating Unit/Acceptance tests

Now, this wouldn't be FOSS compliant without any tests. This is arguably, the most complicated piece in this article. So I suggest you have a read of the Go Testing Package [first](https://golang.org/pkg/testing/).

Now my test code is split into two parts, the test data part, (the "Arrange" part of Arrange-Act-Assert):

```go
func testAzureRmManagementGroup_basic(ri int) string {
	return fmt.Sprintf(`
resource "azurerm_management_group" "test" {
  name         = "acctestmg-%d"
}
`, ri)
}

func testAzureRmManagementGroup_withSubscriptions(ri int, subscriptionID string) string {

	return fmt.Sprintf(`
resource "azurerm_management_group" "test" {
  name         = "acctestmg-%d"
  subscription_ids = [
	  "%q" 
	]
}
`, ri, subscriptionID)
}
func testAzureRmManagementGroup_NoSubscriptions(ri int, subscriptionID string) string {

	return fmt.Sprintf(`
resource "azurerm_management_group" "test" {
  name         = "acctestmg-%d"
}
`, ri)
}

```

Which creates and returns resource type sections in the HCL language, feeds it into the testing package, and simulates creation of resources.

And the actual test cases (the Act-Assert part)

```go
func TestAccAzureRMManagementGroup_withSubscriptions(t *testing.T) {
	resourceName := "azurerm_management_group.test"
	//use subscriptionID from ENV VARS

	ri := acctest.RandInt()
	subscriptionID := os.Getenv("ARM_SUBSCRIPTION_ID")
	resource.Test(t, resource.TestCase{
		PreCheck:     func() { testAccPreCheck(t) },
		Providers:    testAccProviders,
		CheckDestroy: testCheckAzureRMManagementGroupDestroy,
		Steps: []resource.TestStep{
			{
				Config: testAzureRmManagementGroup_NoSubscriptions(ri, subscriptionID),
				Check: resource.ComposeTestCheckFunc(
					testCheckAzureRMManagementGroupExists(resourceName),
					resource.TestCheckResourceAttr(resourceName, "subscription_ids.#", "0"),
				),
			},
			{
				Config: testAzureRmManagementGroup_withSubscriptions(ri, subscriptionID),
				Check: resource.ComposeTestCheckFunc(
					testCheckAzureRMManagementGroupExists(resourceName),
					resource.TestCheckResourceAttr(resourceName, "subscription_ids.#", "1"),
					resource.TestCheckResourceAttr(resourceName, "subscription_ids.#", subscriptionID),
				),
			},
			{
				Config: testAzureRmManagementGroup_NoSubscriptions(ri, subscriptionID),
				Check: resource.ComposeTestCheckFunc(
					testCheckAzureRMManagementGroupExists(resourceName),
					resource.TestCheckResourceAttr(resourceName, "subscription_ids.#", "0"),
				),
			},
		},
	})
}
```

This is only one of the test cases I wrote, so have a look at the code to see them all.

The test above tests whether the created resource in the Terraform graph was created with the associated subscriptions.

The most important pieces is the ```resource.Test()``` block, which is where I pass in the bootstrapped provider ```testAccProviders```, the callback function to check if the resource is destroyed ```testCheckAzureRMManagementGroupDestroy```, and the ```Steps```.

Each block of the Steps represent an action, or the Act-Assert part of my tests.
The ```Config``` section tells the block the test data to be used (defined in the first part).
While the ```Check``` block tells it the conditions to pass the test case the (Assert) part.

```go
{
				Config: testAzureRmManagementGroup_withSubscriptions(ri, subscriptionID),
				Check: resource.ComposeTestCheckFunc(
					testCheckAzureRMManagementGroupExists(resourceName),
					resource.TestCheckResourceAttr(resourceName, "subscription_ids.#", "1"),
					resource.TestCheckResourceAttr(resourceName, "subscription_ids.#", subscriptionID),
				),
},
```

Ideally, like any good unit test, you want to check for behaviour of your resource - so only cover test cases which outcomes are directly affected by your resource - do not test any internal implementation - for example, do not test specific CRUD functions by themselves, but rather, test the outcomes of your Terraform Resource.

# Wrapping up

That's it - now, this blog post really assumes alot of prerequisites - Go, Terraform, and Azure - so if nothing makes sense on your first read, I suggest you go for on the links scatted through the post first - then come back. 

Hopefully things will make more sense the second time around.












