---
layout: post
title:  "Continuous Delivery for Visual Studio Team Services and Azure"
date:   2017-01-20 14:59:00 +1000
categories: ContinuousDelivery
comments: true
---

First post for the year! So you might know that I do alot of work a certain large retail organisation (up to you to guess which one).
A specific project required me to develop a continuous delivery pipeline for this legacy system.

A bit of background:
* Runs on IIS 8
* .NET 4.0 Runtime
* A monolithic application which we're trying to slowly decouple

Toolset of choice (was decided by the customer):
* Powershell DSC + Azure Automation
* Visual Studio Team Services
* Azure VM ScaleSets 

You might notice that's a complete end-to-end Microsoft stack - not entirely ideal for non-PaaS workload.
Also, you might know how Microsoft is pushing **hard** on PaaS, but is severely limiting especially when porting legacy apps and with almost no semblance of distributed computing unless we go containers.

 This post will focus on one of the limitations this toolset brings about - 
 *interoperability between the build/release server (VSTS) and the configuration management toolset (Powershell DSC).*,
 and about how I overcame these limitations.

Visual Studio Team Services
---------------------
Now let me get this out first - VSTS is good for developing build/release pipelines when the target release environment is Microsoft's PaaS platform (AppServices/Cloud Services).

It is **not** a good tool for deploying anything in a cloud-agnostic way (e.g. IaaS or Container-based workload) - there I said it. 
I'm stuck with it though so I figured I'll just make do.

So a standard release process would probably look like this:
Build Artifact -> Populate Environment config (web.config xml) -> Repackage into Nuget -> Use web deploy

However, in a continuous delivery pipeline, it would/should look like something similar to this:
![CDPipeline](/assets/CD-VSTS-DSC.png)

As virtual machines scale up/down, get turn apart/rebuilt all over again - the instances themselves need to know where, what package to pull from the Repo.
Enter VSTS Package Management - because I'm lazy, I don't want to spin up/maintain my own Nuget Server. 
VSTS Package management supports v2/v3 version of Nuget - so there's support for legacy Nuget clients. However, for some reason, it does not support Nuget API keys for access.
There is, however, an option to use personal access tokens (PAT) - which offers a similar experience of using API keys. Problem with PATs is they expire.

Powershell DSC
---------------------
Powershell DSC is an amazing addition to Powershell since V4 - i prefer Chef, but Powershell DSC is slowly growing on me. 
Now - for my Powershell DSC configuration, obviously we'd want a DSC config that would install IIS features, build IIS App Pools, Sites, Virtual Directories - etc.
What's missing? Getting your code into the VM.

In Docker containers, you would probably do a Git Pull, mount a shared volume, do an NPM install or probably a simple COPY/ADD command. 
But since we're deploying compiled code, a Git Pull won't cut it. Fortunately, we have VSTS package management. 
At first, I thought it to be a fairly straightforward approach, to use the [PackageManagementProvider](https://blogs.msdn.microsoft.com/powershell/2015/05/05/desired-state-configuration-resources-for-packagemanagement-providers/) Resource.

Unfortunately, this DSC package doesn't support VSTS Package Management as it leverages the built in Package Management Provider powershell CMDlets.
These are:

* Register-PackageSource, and
* Install-Package

So, I had to write my own DSC Script Resource to do the following:

1. Download the latest version of Nuget.exe
2. Register VSTS Package management as a source
3. Pull Nuget packages from that feed

### Install Nuget.exe

To install nuget.exe, funny enough, I've had to use chocolatey. Pretty simple here, just import the cChoco module and you're done.

{% highlight powershell %}

        cChocoInstaller installChoco
        {
            InstallDir = "c:\choco"
        }

        cChocoPackageInstaller installNugetCLI
        {
            Name        = "nuget.commandline"
            DependsOn   = "[cChocoInstaller]installChoco"
        }

         cChocoPackageInstaller installNugetCLI
        {
            Name        = "nuget.commandline"
            DependsOn   = "[cChocoInstaller]installChoco"
        }

{% endhighlight %}

### Add VSTS Package Management feed

A bit more going on here. I use the Script DSC resource to register the VSTS package source feed.
Obviously, this gets fed through a Powershell Parameter, along with VSTS credentials.
For simplicity, I just use the PAT - which allows you to put in any username you want.
For more information about the DSC Script resource, read [this](https://msdn.microsoft.com/en-us/powershell/dsc/scriptresource)

{% highlight powershell %}

   Script addNugetSource
      {
        GetScript = {
            $scriptBlock = {C:\choco\lib\NuGet.CommandLine\tools\nuget.exe sources}
            $result = Invoke-Command -ScriptBlock $scriptBlock
            $pkgSourcePattern = "*" + $Using:pkgSourceUri + "*"
            if($result -like $pkgSourcePattern)
            {
                return @{            
                    Result = "SourceFound"          
                }      
            }
            else
            {
            return @{            
                    Result = "SourceMissing"          
                } 
            }

        }

        SetScript = {
                     
            $scriptBlock = {param($pkgSource,$pkgKey)
            C:\choco\lib\NuGet.CommandLine\tools\nuget.exe sources remove -name nugetPkg
             C:\choco\lib\NuGet.CommandLine\tools\nuget.exe sources add -name nugetPkg -source $pkgSource -UserName anyuser -Password $pkgKey}
            Invoke-Command $scriptBlock -argumentList $Using:pkgSourceUri,$Using:pkgSourceKey
            
            Write-Verbose "Adding source $Using:pkgSourceUri with $Using:pkgSourceKey"
        }

        TestScript = {
            ##addNugetSource is idempotent
            return $false
        }
        DependsOn = "[cChocoPackageInstaller]installNugetCLI"
      }

{% endhighlight %}

### Pull Nuget Package

Lastly, once the source is installed, let's grab that Nuget Package! Same goings on here - using the Script DSC resource,
and making use of the same parameters that are fed in ($pkgSourceUri, $pkgName, $buildVersion).

{% highlight powershell %}

        Script pullNugetPkg
        {
            GetScript = {

            $scriptBlock = {C:\choco\lib\NuGet.CommandLine\tools\nuget.exe sources}
            $result = Invoke-Command -ScriptBlock $scriptBlock
            $pkgSourcePattern = "*" + $Using:pkgSourceUri + "*"
            if($result -like $pkgSourcePattern)
            {
                return @{            
                    Result = "SourceFound"          
                }      
            }
            else
            {
            return @{            
                    Result = "SourceMissing"          
                } 
            }
        }
        SetScript = {
            $scriptBlock = {param($pkgSourcePull,$pkgNamePull,$pkgVersion)C:\choco\lib\NuGet.CommandLine\tools\nuget.exe install $pkgNamePull -Source $pkgSourcePull -Version $pkgVersion -ExcludeVersion -outputdirectory "C:\inetpub"}
            Invoke-Command $scriptBlock -ArgumentList $Using:pkgSourceUri,$Using:pkgName,$Using:buildVersion   
        }
        TestScript = {
           return $false

        }
            DependsOn = "[Script]addNugetSource"
        }

{% endhighlight %}

Summary
---------------------
You can grab the DSC Configuration [here](https://raw.githubusercontent.com/justinbarias/PowershellRepo/master/NugetDSC/NugetDSC.ps1). I'll probably package this up into a DSC resource on its own once I find the time.
Have fun!!