---
layout: post
title:  "Ingesting log analytics data using the OMS HTTP collector API"
date:   2016-11-17 01:00:00 +1000
categories: OMS
comments: true
---

Gahh!! 5 months since my last blog post - found time during  the downtime of a so-called "Azure ExpressRoute - master class training".
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

I built a powershell script which achives the outcome I wanted, and is published here [Ingest-OMSData.ps1](https://raw.githubusercontent.com/justinbarias/PowershellRepo/master/OMS/Ingest-OMSData.ps1)


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

Summary
---------------------

Well - there you go! Feel free to expand the script to accomodate other Azure Resources (Web App, App Service Environments, etc.)