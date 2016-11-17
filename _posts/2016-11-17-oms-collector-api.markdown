---
layout: post
title:  "Ingesting log analytics data using the OMS HTTP collector API"
date:   2016-11-17 01:00:00 +1000
categories: OMS
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
* Extract-Telemetry - extracts the Azure SQL performance metrics. Here, we specifiy a time interval, and a granularity interval. Some resources in Azure collect metrics in different granularities, in this case, Azure SQL does so in 5 minute granularity.
Prior to invoking *Get-AzureRMMetric*, we need to build the resource ID of the database. 

```powershell

function extractTelemetry($sqlServerName)
{
Set-AzureRmContext -SubscriptionId $subscriptionId

# Get resource usage metrics for an SQL DB for the specified time interval.
$endTime = [DateTime]::Now
$startTime = ([DateTime]::Now).AddMinutes(-5)

# Construct the SQL Server resource ID and retrive pool metrics at 5 minute granularity.
$serverResourceId = '/subscriptions/' + $subscriptionId + '/resourceGroups/' + $resourceGroupName + '/providers/Microsoft.Sql/servers/' + $serverName

# Get the list of databases in this pool.
$dbList = Get-AzureRmSqlDatabase -ResourceGroupName $resourceGroupName -ServerName $serverName

# Get resource usage metrics for a database in an elastic database for the specified time interval.
$dbMetrics = @()
foreach ($db in $dbList)
{
    if($db.databaseName -eq $dbName){
    $dbResourceId = '/subscriptions/' + $subscriptionId + '/resourceGroups/' + $resourceGroupName + '/providers/Microsoft.Sql/servers/' + $serverName + '/databases/' + $db.DatabaseName
    $dbMetrics += (Get-AzureRmMetric -ResourceId $dbResourceId -TimeGrain ([TimeSpan]::FromMinutes(5)) -StartTime $startTime -EndTime $endTime)
    }
 }

 return $dbMetrics
}

```

*Get-AzureRMMetric* returns a hashtable/array of Metric objects, with each metric object representing a specific metric.
These metric objects then have a property called *metricValues* which is another hashtable/array of the actual values of the metric. The length of the array depends on the time interval and the granularity you specified.
In this case, I always extract index 0 - as I only want once instance of the metric to pump into my JSON payload.

* Build-TelemetryJson - builds the JSON payload containing the performance metrics. Now this bit is pretty simple, you just need to build a payload either in this format:

```json
{
    "Key": "Value",
    "Key2": "Value2",
    "Key3": "Value3"

}
```
Or this format:

```json
[
{
    "Key": "Value",
    "Key2": "Value2",
    "Key3": "Value3"

},
{
    "Key": "Value",
    "Key2": "Value2",
    "Key3": "Value3"

},
]
```

If you read up on the OMS HTTP collector API documentation, OMS will infer the data type (string, date, integer, boolean), and will append a postfix (_s, _d, _n, _b) depending on the infered type.
Also, OMS will also append a postfix "_CL" on the LogType name you choose.

```powershell
function buildTelemetryJson($sqlServerName,$dbMetric)
{

    $resourceId = $dbMetric.resourceId
    $dbName = $resourceId.split("/")[-1]

    $dtu_consumption_percent = ($dbMetric | Where-Object {$_.name -eq 'dtu_consumption_percent'})
    $dtu_used = ($dbMetric | Where-Object {$_.name -eq 'dtu_used'})
    $storage_percent = ($dbMetric | Where-Object {$_.name -eq 'storage_percent'})
    $storage = ($dbMetric | Where-Object {$_.name -eq 'storage'})

    $json = "{"
    $json += "`"DBName`": `"" + $dbName + "`","
    $json += "`n`"dtuPct`": " + $dtu_consumption_percent.metricValues[0].Average + ","
    $json += "`n`"dtuUsed`": " + $dtu_used.metricValues[0].Average + ","
    $json += "`n`"stgBytes`": " + $storage.metricValues[0].Average + ","
    $json += "`n`"stgPct`": " + $storage_percent.metricValues[0].Average
    $json += "`n}"

    return $json
}

```

Summary
---------------------

Well - there you go! Feel free to expand the script to accomodate other Azure Resources (Web App, App Service Environments, etc.)