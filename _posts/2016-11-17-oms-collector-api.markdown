---
layout: post
title:  "Ingesting log analytics data using the OMS HTTP collector API"
date:   2016-11-17 13:00:00 +1000
categories: DevOps, AzureRM, OMS, AzureSQL
comments: true
---

Gahh!! 5 months since my last blog post - found time during a the downtime of a so-called "Azure ExpressRoute - master class training".
Anyway, this post was inspired but some work I did with a customer that just went live a week ago - who used Azure SQL (single instance) - on a *P15* SKU. 
Yup, you read that right, the biggest SQL Tier in Azure SQL.

Currently, Azure SQL metrics cannot be ingested into OMS Log Analytics (without being part of a private preview - which is taking ages to process). So, I did what any engineer would do - do it yourself!

To start - two documents I referenced are:

1. Reference for the Azure RM metrics powershell command - [AzureRM Metrics powershell](https://docs.microsoft.com/en-us/powershell/resourcemanager/azurerm.insights/v1.0.12/Get-AzureRmMetric?redirectedfrom=msdn)

    Get-AzureRMMetric obviously is not only for SQL Azure, but for **any** Azure Resource. The problem here is that for each Azure resource, there is no form of documentation that tells us what metrics are available on which resources.
    So, i've gone ahead and done that for you, below are the available metrics for SQL Azure.

* connection_successful
* connection_failed
* blocked_by_firewall
* deadlock
* cpu_percent
* physical_data_read_percent
* log_write_percent
* dtu_consumption_percent
* storage
* xtp_storage_percent
* workers_percent
* sessions_percent
* dtu_limit
* dtu_used
* storage_percent

2. Reference for the OMS HTTP data collector API - [OMS Data Collector API](https://docs.microsoft.com/en-us/azure/log-analytics/log-analytics-data-collector-api)

I built a powershell script which achives the outcome I wanted, and is published here:

Which takes on the following parameters:

* CustomerId - your OMS workspace ID
* SharedKey - your OMS key
* LogType - your custom log type name
* TimeStampField (Optional) - if you wanted to specify any field in the JSON payload as the timestamp field. If left blank, the OMS API will use invocation time as the timestamp
* subscriptionID - subscriptionId where the Azure SQL database is located
* resourceGroupName - resource group where the Azure SQL database is located
* serverName - name of the Azure SQL Server 
* dbName - name of the Azure SQL database

Ingest-OMSData.ps1 consists of serveral functions:

* Build-Signature - builds the API authorisation signature
* Post-OMSData - invokes the OMS data collector API
* Extract-Telemetry - extracts the Azure SQL performance metrics
* Build-TelemtryJson - builds the JSON payload containing the performance metrics

{% highlight json %}
"type": "Microsoft.Compute/virtualMachines",

            "resources": [
                {
                    "type": "Microsoft.Compute/virtualMachines/extensions",
                    "name": "[concat(parameters('vmName'),'/', variables('vmDynamicRole').dscConfigurationFunction)]",
                    "apiVersion": "2015-06-15",
                    "location": "[parameters('location')]",
                    "dependsOn": [
                        "[resourceId('Microsoft.Compute/virtualMachines', parameters('vmName'))]"
                    ],
                    "properties": {
                        "publisher": "Microsoft.Powershell",
                        "type": "DSC",
                        "typeHandlerVersion": "2.17",
                        "settings": {
                            "wmfVersion": "latest",
                            "configuration": {
                                "url": "[variables('vmDynamicRole').dscModuleURL]",
                                "script": "[variables('vmDynamicRole').dscConfigurationScript]",
                                "function": "[variables('vmDynamicRole').dscConfigurationFunction]"
                            },
                            "configurationArguments": {
                                "domainName": "[parameters('domainName')]",
                                "domainNetBiosName": "[parameters('domainNetBiosName')]"
                            },
                            "privacy": {
                                "dataCollection": "disable"
                            }
                        },
                        "protectedSettings": {
                            "configurationArguments": {
                                "adminCreds": {
                                    "userName": "[parameters('adminUserName')]",
                                    "password": "[parameters('adminPassword')]"
                                },
                                "dsrmCreds": {
                                    "userName": "[parameters('adminUserName')]",
                                    "password": "[parameters('dsrmPassword')]"
                                }

                            }
                            
                        }
                    }

{% endhighlight %}

Summary
---------------------

That's alot to take in - but you may ask, why go through the trouble of architecting a complex way to create VMs?
Well, all in the line of re-usability, configuration management & code readability. This fixed config approach also allows you to keep the configurations of Vm types *sacred* while giving you freedom to define VM instances as you will.
In an actual production environment, you would have the *armtemplates* scripts secured by a more stringent change management process, while the *armdeploy* templates will be a bit more lax.
