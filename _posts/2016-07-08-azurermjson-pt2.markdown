---
layout: post
title:  "Decomposing AzureRM JSON templates - Part 2"
date:   2016-07-08 11:12:00 +1000
categories: DevOps, AzureRM, Infrastructure-as-code
comments: true
---
Waaaay overdue. 
Disclaimer: Be prepared for a long read, and tons of JSON code blocks.

From my first post [Decomposing AzureRM Json templates - Part 1](/2016/05/19/firstblogpost/), I talked about making use of the following techniques to construct my ARM templates:

1. Template linking
2. Dynamic variable generation
3. Fixed configurations (property bags)

There's also the standard stuff of separating parameters from template definitions. I have promptly created two github repos representing each.

1. [armdeploy](https://github.com/justinbarias/armdeploy) - i will cover this in a separate blog post. Did some stuff around the copy() function of ARM templates to further simplify my parameters JSON template
2. [armtemplates](https://github.com/justinbarias/armtemplates) - this blog post will cover this in *detail*.


ARM Templates
---------------------

* **nic.json** - nothing special, contains a NIC Azure RM resource
{% highlight json %}

  "resources": [
    {
      "name": "[parameters('nicName')]",
      "type": "Microsoft.Network/networkInterfaces",
      "location": "[parameters('location')]",
      "apiVersion": "2015-05-01-preview",
      "properties": {
        "ipConfigurations": "[parameters('ipConfigurations')]",
        "dnsSettings": {
          "dnsServers": "[parameters('dnsServers')]"
        }
      }
    }
  ]
}

{% endhighlight %}
* **nsg-ad.json** - nothing special, contains an NSG Azure RM resource with inbound/outbound rules for a domain controller
{% highlight json %}
  "resources": [
    {
      "apiVersion": "[variables('apiVersion')]",
      "type": "Microsoft.Network/networkSecurityGroups",
      "name": "[parameters('networkSecurityGroupName')]",
      "location": "[resourceGroup().location]",
      "properties": {
        "securityRules": [
            {
                .....
            }


{% endhighlight %}
* **sharedresources.json** - contains the following resources:
    1. Storage Account(s) - straight resource deployment
    2. Public IP Address - straight resource deployment
    3. Vnet - linked deployment to *vnnet.json*. See the code snippet above to see how template linking works. Had to define a variable to point to the JSON template link hosted in github.

{% highlight json %}
  "variables": {
        "vnetTemplateUri": "[concat(parameters('assetLocation'),'Templates/vnet.json')]",
    }
    .
    .
    .
    "resources": [
        .....
          {
            "name": "VNet",
            "type": "Microsoft.Resources/deployments",
            "apiVersion": "2015-01-01",
            "properties": {
                "mode": "Incremental",
                "templateLink": {
                    "uri": "[variables('vnetTemplateUri')]",
                    "contentVersion": "1.0.0.0"
                },
                "parameters": {
                    "location": {
                        "value": "[parameters('location')]"
                    },
                    "virtualNetworkName": {
                        "value": "[parameters('virtualNetworkName')]"
                    },
                    "virtualNetworkAddressRange": {
                        "value": "[parameters('virtualNetworkAddressRange')]"
                    },
                    "subnetName": {
                        "value": "[parameters('adSubnetName')]"
                    },
                    "subnetRange": {
                        "value": "[parameters('adSubnet')]"
                    },
                    "gatewaySubnetRange": {
                        "value": "[parameters('gatewaySubnetRange')]"
                    },
                    "networkSecurityGroupName": {
                        "value": "[parameters('networkSecurityGroupName')]"
                    },
                    "assetLocation": {
                        "value": "[parameters('assetLocation')]"
                    },
                    "DNSServerAddress": {
                        "value": "[parameters('DNSServerAddress')]"
                    }
                }
            }
        },
        .....

    ]




{% endhighlight %}
* **vnet.json** - contains the following resources:

    1. VNET resource - straight up VNET resource deployment with aggregate subnet resources
    2. Network Security Group - linked deployment to deploy *nsg-ad.json*  bound to the subnets. Another example of linked deployment usage.
 
    {% highlight json %}
        "variables": {
        "nsgTemplateUri": "[concat(parameters('assetLocation'),'Templates/nsg-ad.json')]"
    },
  "resources": [
      {
  
            "name": "NSG",
            "type": "Microsoft.Resources/deployments",
            "apiVersion": "2015-01-01",
            "properties": {
                "mode": "Incremental",
                "templateLink": {
                    "uri": "[variables('nsgTemplateUri')]",
                    "contentVersion": "1.0.0.0"
                },
                "parameters": {
                    "networkSecurityGroupName": {
                        "value": "[parameters('networkSecurityGroupName')]"
                    }
                }
            }
        },
        {
            "name": "[parameters('virtualNetworkName')]",
            "type": "Microsoft.Network/virtualNetworks",
            "location": "[parameters('location')]",
            "apiVersion": "2015-05-01-preview",
            "dependsOn": [
                "[resourceId('Microsoft.Resources/deployments','NSG')]"
            ],
            "properties": {
                "addressSpace": {
                    "addressPrefixes": [
                        "[parameters('virtualNetworkAddressRange')]"
                    ]
                },

                "subnets": [
                    {
                        "name": "GatewaySubnet",
                        "properties": {
                            "addressPrefix": "[parameters('gatewaySubnetRange')]"

                        }
                    },
                    {
                        "name": "[parameters('subnetName')]",
                        "properties": {
                            "addressPrefix": "[parameters('subnetRange')]",
                            "networkSecurityGroup": {
                                "id": "[resourceId('Microsoft.Network/networkSecurityGroups', parameters('networkSecurityGroupName'))]"
                            }
                        }
                    }

                ]
            }
        }



    {% endhighlight %}

* **vnet-with-dns.json** - same as *vnet.json*, only with DNS server addresses included in the subnet definitions (see below). This is required so the proper AD DNS server address is plugged in to the VNET after proper DC promotion.
{% highlight json %}
{
            "name": "[parameters('virtualNetworkName')]",
            "type": "Microsoft.Network/virtualNetworks",
            "location": "[parameters('location')]",
            "apiVersion": "2015-05-01-preview",
            "properties": {
                "addressSpace": {
                    "addressPrefixes": [
                        "[parameters('virtualNetworkAddressRange')]"
                    ]
                },
                "dhcpOptions": {
                    "dnsServers": "[parameters('DNSServerAddress')]"
                },

{% endhighlight %}
* **vmfactory-with-dsc.json** -

> Now, this is where the cool stuff happens. As this covers alot of magic, this deserves a special section, with in-depth code block analysis.

The VMFactory JSON Template
---------------------

### Parameters Section 
I wont cover the parameters in detail, but to put some more context on how variable generation works, ill cover the minimum. Parameters are pretty straight forward, and you should get an understanding of what parameters are required once you see the *variables* and the *resources* section.
You can see below the parameter **vmRole**:
{% highlight json %}
 "parameters": {
        "vmRole": {
            "type": "string",
            "metadata": {
                "description": "The type of pre-configured VM to be provisioned"
            },
            "allowedValues": [
                "PDC",
                "PDCTest",
                "ADFSFARM",
                "ADFSPROX",
                "BDC",
                "AADC",
                "BDCTest"
            ],
            "defaultValue": "PDC"
        },

{% endhighlight %}

The **vmRole** parameter is basically what tells the VMFactory what type of VM it is. By feeding this to the template, it will automatically pick up the VM Role configurations defined in the property bags. Which leads us to the next section.

### Variables Section - The VMFactory property bags, dynamic variable generation

The first code block shows the general purpose variables such as osDiskname, dataDiskName etc. - which are dynamically generated by concatenating the **vmName** parameter, and the suffix "OSDisk.vhd".
These variables make sure that all VHD URIs are unique. Variables such as VNET ID and Subnet ID are also indicated here.

Lastly, but most importantly, we have the variable **vmDynamicRole**. This is the key cog in all of this - which concatenates the string "vmRole" and the parameter **vmRole**.
What is this for, you may ask? Well, take a look:

> Let's say, the Parameter **vmRole** has a value of *AADC*. (Which stands for Azure AD Connect)
> "vmRole" + "AADC" = **vmRoleAADC**. 

{% highlight json %}
"variables": {
    "osDiskName": "[concat(parameters('vmName'), 'OSDisk.vhd')]",
    "dataDiskName": "[concat(parameters('vmName'), 'DataDisk')]",
    "backupDiskName": "[concat(parameters('vmName'), 'BackupDisk')]",
    "backupDiskSize": 200,
    "backupDiskURI": "[concat('http://',parameters('backupStorageAccountName'),'.blob.core.windows.net/vhds0/', variables('backupDiskName'),'-1.vhd')]",
    "sharedResourcesRGId": "resourceId(parameters('sharedResourcesRGName')",
    "VnetID": "[resourceId(parameters('sharedResourcesRGName'),'Microsoft.Network/virtualNetworks', parameters('virtualNetworkName'))]",
    "adSubnetRef": "[concat(variables('VnetID'),'/subnets/',parameters('subnetName'))]",
    "vmDynamicRole": "[variables(concat('vmRole', parameters('vmRole')))]",
{% endhighlight %}

Still not seeing it? Well take a look at the next code block.
Here we have complex objects. Recommended reading, JSON complex [objects/schema](https://spacetelescope.github.io/understanding-json-schema/structuring.html)
Remember the scenario a while ago? **"vmRole" + "AADC" = vmRoleAADC**?
Do you see the complex object below named **vmRoleAADC*? Along with the child objects it has such as vmSize, osDiskURI, dataDiskURI etc.?

{% highlight json %}
 
    "vmRoleAADC": {
      "vmSize": "Standard_A2",
      "osDiskURI": "[concat('http://',parameters('newStorageAccountName'),'.blob.core.windows.net/vhds0/',variables('osDiskName'))]",
      "dataDiskURI": "[concat('http://',parameters('newStorageAccountName'),'.blob.core.windows.net/vhds0/', variables('dataDiskName'),'-1.vhd')]",
      "dataDiskSize": 20,
      "imagePublisher": "MicrosoftWindowsServer",
      "imageOffer": "WindowsServer",
      "imageSKU": "2012-R2-Datacenter",
      "dscConfigurationScript": "DefaultConfig.ps1",
      "dscConfigurationFunction": "DefaultConfig",
      "dscModuleURL": "[concat(parameters('assetLocation'),'DSC/DefaultConfig.ps1.zip')]",
      "dscConfigDataUrl": "[concat(parameters('assetLocation'),'DSC/Scripts/configdata.psd1')]"
    },
    "vmRoleBDCTest": {
      "vmSize": "Standard_A4",
      "osDiskURI": "[concat('http://',parameters('newStorageAccountName'),'.blob.core.windows.net/vhds0/',variables('osDiskName'))]",
      "dataDiskURI": "[concat('http://',parameters('newStorageAccountName'),'.blob.core.windows.net/vhds0/', variables('dataDiskName'),'-1.vhd')]",
      "dataDiskSize": 20,
      "imagePublisher": "MicrosoftWindowsServer",
      "imageOffer": "WindowsServer",
      "imageSKU": "2012-R2-Datacenter",
      "dscConfigurationScript": "CreateADBDC.ps1",
      "dscConfigurationFunction": "CreateADBDC",
      "dscModuleURL": "[concat(parameters('assetLocation'),'DSC/CreateADBDC.ps1.zip')]",
      "dscConfigDataUrl": "[concat(parameters('assetLocation'),'DSC/Scripts/configdata.psd1')]"
    },
    .
    .
    .
    .
    .
    .
  }

  {% endhighlight %}

By now, it should start making sense.
In our scenario, the variable **vmDynamicRole** will take the value of the complex object **vmRoleAADC*.

Which means, using an ARM variable reference

{% highlight json %}
"[variables('vmDynamicRole').*<complex object property>*]
{% endhighlight %}

For example:
{% highlight json %}
"[variables('vmDynamicRole').vmSize]
{% endhighlight %}

Allows us to dynamically get the value for *vmSize* of the given **vmRole**.
For **vmRoleAADC**, should yield the value **Standard_A2**.

Let that sink in a bit, and let's head to the section where the VMs are actually created.

### Resource Section - How to access property bags

In the code block below, we have the actual AzureRM Virtual Machine resource. 
Can you see how the **vmDynamicRole** variable is accessed?
And how it's child objects such as **imagePublisher**, **imageOffer**, **imageSKU**, **osDiskURI** are referenced?
{% highlight json %}
        {
            "apiVersion": "2015-06-15",
            "dependsOn": [
                "[resourceId('Microsoft.Network/networkInterfaces',parameters('vmNicName'))]",
                "[resourceId('Microsoft.Compute/availabilitySets',parameters('vmAvailabilitySetName'))]"
            ],
            "location": "[parameters('location')]",
            "name": "[parameters('vmName')]",
            "properties": {
                "hardwareProfile": {
                    "vmSize": "[variables('vmDynamicRole').vmSize]"
                },
                "availabilitySet": {
                    "id": "[resourceId('Microsoft.Compute/availabilitySets', parameters('vmAvailabilitySetName'))]"
                },
                "osProfile": {
                    "computerName": "[parameters('vmName')]",
                    "adminUsername": "[parameters('adminUsername')]",
                    "adminPassword": "[parameters('adminPassword')]"
                },
                "storageProfile": {
                    "imageReference": {
                        "publisher": "[variables('vmDynamicRole').imagePublisher]",
                        "offer": "[variables('vmDynamicRole').imageOffer]",
                        "sku": "[variables('vmDynamicRole').imageSKU]",
                        "version": "latest"
                    },
                    "osDisk": {
                        "name": "osdisk",
                        "vhd": {
                            "uri": "[variables('vmDynamicRole').osDiskURI]"
                        },
                        "caching": "ReadWrite",
                        "createOption": "FromImage"
                    },
                    "dataDisks": [
                        {
                            "vhd": {
                                "uri": "[variables('vmDynamicRole').dataDiskURI]"
                            },
                            "name": "[concat(parameters('vmName'),'-data-disk1')]",
                            "caching": "None",
                            "diskSizeGB": "[variables('vmDynamicRole').dataDiskSize]",
                            "lun": 0,
                            "createOption": "Empty"
                        },
                        {
                            "vhd": {
                                "uri": "[variables('backupDiskURI')]"
                            },
                            "name": "[variables('backupDiskName')]",
                            "caching": "None",
                            "diskSizeGB": "[variables('backupDiskSize')]",
                            "lun": 1,
                            "createOption": "Empty"
                        }

                    ]
                },
                "networkProfile": {
                    "networkInterfaces": [
                        {
                            "id": "[resourceId('Microsoft.Network/networkInterfaces',parameters('vmNicName'))]"
                        }
                    ]
                }
            },

            "type": "Microsoft.Compute/virtualMachines",
{% endhighlight %}

Also, take a look at the DSC resource here:
What? DSC? Don't worry, we'll cover how DSC works here on another post.
Also take a look at the "protectedSettings" section. This basically makes sure that no credentials are sent in plain text. Just make sure that the DSC
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
