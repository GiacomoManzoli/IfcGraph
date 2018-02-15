/* globals oBimProjectManager, oBimSurferWrapper, oBimFilterManager, Global, ReferenceDataValue, ListDataValue, BimServerClient, oBimServerUtils, PageChanger, InitProject, Project, Main, IfcObject, IfcPropertySet, IfcSimpleProperty, IfcElementQuantity, IfcPhysicalComplexQuantity, IfcPhysicalSimpleQuantity */

var oBimServer = (function() {
    "use strict";

    // ---- GESTIONE DEL PROGETTO CORRENTE ------    
    var setCurrentProject = function(poid) {
        console.log("8bim: Inizializzo il proegetto corrente...", poid);
       
        return oBimServerUtils.getProject(poid)
            .then(function(project) {
                console.log("8bim: Progetto corrente inizializzato.", project);
                oBimProjectManager.setCurrentProject(project);
                oBimServerUtils.sendControlEvent('evSetCurrentProject');
                return project;
            });
    };
    // Setup comunicazione con il server
    // ----------------------------------------------------------------------------------
    var _BimServerIsServerUp = function(address, successCallback, errorCallback) {
        $.getJSON(address + "/x.getbimserveraddress", function() {
            successCallback();
        }).fail(function() {
            errorCallback();
        });
    };

    var BimServerLoadApi = function(address) {
        function onServerDown() {
            console.log("8bim: error loading the api. Maybe the server is not yet started or reacheable.");
            Global.notifier.setError(Global.translate("CONNECTION_ERROR_RETRY"));
            oBimServerUtils.sendControlEvent("evApiNotReady");
        }

        function onServerUp() {
            Global.bimServerApi = new BimServerClient(address, Global.notifier, Global.translate);
            Global.bimServerApi.init(function(api, serverInfo) {
                if (serverInfo.serverState === "RUNNING") {
                    console.log("8bim: server running, api loaded.");
                    Global.bimServerApi = api;
                    Global.serverAddress = address;
                    oBimServerUtils.sendControlEvent("evApiLoaded");
                } else {
                    console.log("8bim: error loading the api. Maybe the server is not yet started or reacheable.");
                    Global.notifier.setError(Global.translate("CONNECTION_ERROR_RETRY"));
                    oBimServerUtils.sendControlEvent("evApiNotReady");
                }
            });
        }
        _BimServerIsServerUp(address, onServerUp, onServerDown);
    };

    var BimServerLogin = function(user, password) {
        console.log("8bim: " + user + " logging in...");
        // login
        Global.bimServerApi.login(user, password, function(data) {
            console.log("8bim: logged in. Resolving user " + user);
            // permessi utente
            Global.bimServerApi.resolveUser(function(user) {
                console.log("8bim: user resolved.");
                // caricamento pagina principale
                $(".indexcontainer").load(Settings.getAppAddress() + "main.html", function() {
                    new Main(Global.serverAddress, user).show(false);
                    //TODO: spostare in funzione all'interno di main
                    $('#logo').hide(true);
                    $('#loader-4').hide(true);
                    oBimServerUtils.sendControlEvent("evLoginDone");
                });
            });
        });
    };

    var BimServerOnCantConnect = function() {
        $('#loader-4').hide(true);
    };

    // Dati relativi all'entita' progetto
    // ----------------------------------------------------------------------------------
    var BimServerGetProjectOidFromName = function(name) {
        //rimpiazza il metodo GetProjectOidFromGuid
        var promise = new window.BimServerApiPromise();
        Global.bimServerApi.call("ServiceInterface", "getProjectsByName", {
            name: name
        }, function(data) {
            if (data.length > 0) {
                console.log("8bim : project with name " + name + " found on this server. Oid: ", data);
                oBimServerUtils.sendControlEvent('evGetProjectOidFromName', data);
            } else {
                console.log("8bim : project with name " + name + "NOT found on this server.");
                oBimServerUtils.sendControlEvent('evProjectNotFound', {
                    'name': name,
                    'data': data
                });
            }
            promise.fire();
        });
        return promise;
    };

    // Caricamento dati elementi del progetto
    // ----------------------------------------------------------------------------------
    var BimServerGetUMs = function() {
        var project = oBimProjectManager.getCurrentProject();
       
        console.log("getUMs", project);

        return oBimServerUtils.getDataObjectsByType(project, "IfcSIUnit", false)
            .then(function(objectsDetail) {
                var UMs = [];
                var umObject = {};
                objectsDetail.forEach(function(objectDetail) {
                    umObject = {};
                    objectDetail.values.forEach(function(element) {
                        umObject[element.name] = element.getValue();
                    });
                    UMs.push(umObject);
                });
                console.log("getUMs", UMs);
                oBimServerUtils.sendControlEvent('evGetUMs', UMs);
            });
    };

    /**
     * Ritorna tutte le categorie di elementi ifc presenti nel
     * progetto.
     */
    var BimServerGetSummary = function() {
        var project = oBimProjectManager.getCurrentProject();
        console.log("BimServerGetSummary", project);
        Global.bimServerApi.callWithNoIndication("ServiceInterface", "getRevisionSummary", {
            roid: project.lastRevisionId
        }, function(summary) {
            oBimServerUtils.sendControlEvent('evGetSummary', summary);
        });
    };

    var BimServerGetCategories = function(IfcType, rowForwardData) {
        var project = oBimProjectManager.getCurrentProject();
        console.log("BimServerGetCategories", project.oid);
        return oBimServerUtils.getDataObjectsByType(project, IfcType, false)    
            .then(function(dataObjects) {
                console.log("Passo 1 - Ad ogni oggetto associo la sua categoryRef", dataObjects);
                
                var objectsWithCategoryRef = [];

                dataObjects.forEach(function(dataObject) {
                    var ifcObject = new IfcObject(dataObject);
                    
                    objectsWithCategoryRef.push({
                        element: ifcObject,
                        categoryRef: ifcObject.getIfcRelDefinesByTypeReference()
                    });
                });
                //console.log("Passo 1 [DONE] - objectsWithCategoryRef", objectsWithCategoryRef);                
                return objectsWithCategoryRef;
            })
            .then(function(objectsWithCategoryRef) {
                console.log("Passo 2 - Raggruppo per oggetti dello stesso Type");
                console.log("objectsWithCategoryRef", objectsWithCategoryRef);

                var groupedCategoryRef = new Map(); // dizionario indicizzato typeRel.oid 

                objectsWithCategoryRef.forEach(function(objWithCategoryRef) {
                    if (groupedCategoryRef.has(objWithCategoryRef.categoryRef.oid)) {
                        groupedCategoryRef.get(objWithCategoryRef.categoryRef.oid).elements.push(objWithCategoryRef.element);
                    } else {
                        groupedCategoryRef.set(objWithCategoryRef.categoryRef.oid, {
                            categoryRef: objWithCategoryRef.categoryRef,
                            elements: [objWithCategoryRef.element]
                        });
                    }
                });
                return groupedCategoryRef;
            })
            .then(function(groupedCategoryRef) {
                console.log("Passo 3 - Popolo le informazioni per i vari categorRef", groupedCategoryRef);

                var dataPromises = [];

                groupedCategoryRef.forEach(function(value, key) {
                    // value è un oggetto {categoryRef, obj}
                    // key è l'oid del riferimento
                    // Recupero i valori dell'oggeto IfcRelDefinesByType
                    if (key != -1) {
                        var dataPromise = oBimServerUtils.getDataObjectByOid(project, key)
                            .then(function(data) {
                                // Appena li ho popolo il raggruppamento
                                value.category = data;
                            });
                        dataPromises.push(dataPromise);
                    } else {
                        // Categoria generica
                        value.category = { __type: "SDataObject", guid: null, oid: -1, rid: 0, type: "Generico", values: [] };
                    }
                });
                return Promise.all(dataPromises)
                    .then(function() {
                        return groupedCategoryRef;
                    });
            })
            .then(function(groupedCategoryRef) {
                //console.log("Passo 4 - Carico i dettagli delle varie relazioni IfcRelDefinesByType", groupedCategoryRef);
                var dataPromises = [];
                groupedCategoryRef.forEach(function(value, key) {
                    if (key != -1) { // non è la categoria generica
                        var relatingTypeProperty = value.category.values.filter(function(val) {
                            return (val instanceof ReferenceDataValue) &&
                                val.name === "RelatingType";
                        })[0];
                        console.log(relatingTypeProperty);
                        var dataPromise = oBimServerUtils.getDataObjectByOid(project, relatingTypeProperty.oid)
                            .then(function(data) {
                                value.category = data;
                            });
                        dataPromises.push(dataPromise);
                    } else {
                        value.category = { __type: "SDataObject", guid: null, oid: -1, rid: 0, name: "Generico", values: [], type: "FAKE" };
                    }
                });
                return Promise.all(dataPromises)
                    .then(function() { return groupedCategoryRef; });
            })
            .then(function(groupedCategoryRef) {
                // Converto la mappa in un array e lo mando ad Omnis.
                var splatMap = [];
                groupedCategoryRef.forEach(function(value) {
                    splatMap.push(value);
                });
                console.log("BimServerGetCategories", splatMap);
                oBimServerUtils.sendControlEvent('evGetCategories', [splatMap, rowForwardData]);
            });
    };
    
    /**
     * BimServerGetQuantities: Ritorna le quantità, se presenti, per
     * l'elemento con oid passato come parametro.
     * @param {Number} targetOid id dell'elemento di cui ritornare le quantità.
     * @param {String} evName nome dell'evento di risposta
     */
    var BimServerGetQuantities = function(targetOid, evName) {
        /* 
         * GM_20190112: Cambiato pametro da getNames:Bool a evName:String
         * GM_20171219: Rimosso parametro "all" per specificare se recuperare tutte le quantità o meno
         *              La versione precedente di getQuantitites lo predisponeva ma non lo utilizzava        
         */
        // Nullcheck
        evName = evName ? evName : 'evSendQuantities'; 
        // Se non ho un oid valido non eseguo il metodo
        if (targetOid === 0 || targetOid === -1) { console.error('BimServerGetQuantities - No OID', targetOid); return; }
        
        var DEBUG_CONSOLE_GRUOP_NAME = 'BimServerGetQuantities '+targetOid; // ConsoleGruop per facilitare il debug
        console.group(DEBUG_CONSOLE_GRUOP_NAME);
        console.log("BimServerGetQuantities", targetOid);
        var project = oBimProjectManager.getCurrentProject();
        
        return oBimServerUtils.getDataObjectByOid(project, targetOid)    
            .then(function(targetObject) {
                targetObject = new IfcObject(targetObject);
                // targetObject è l'oggetto identificato dall'oid ricevuto come parametro
                console.log("TargetObject", targetObject);
                var propertiesList = targetObject.getIfcRelDefinesByPropertiesReferences();
                console.log("PropertiesList", propertiesList);
                
                // Recupera i vari oggetti IfcRelDefinesByProperties
                var promises = propertiesList.reduce(function(partial, property) {
                    partial.push(oBimServerUtils.getDataObjectByOid(project, property.oid));
                    return partial;
                }, []);
                return Promise.all(promises);
            })
            .then(function(propertiesObjectList){
                console.log("PropertiesObjectList", propertiesObjectList);
                // Estraggo le quantità
                var quantities = [];
                propertiesObjectList.forEach(function(property) {
                    var propertyQuantities = property.values.filter(function(value) {
                        return (
                            (value instanceof ReferenceDataValue) &&
                            value.name == "RelatingPropertyDefinition" &&
                            value.referencedType == "IfcElementQuantity" // altro e' IfcPropertySet
                        );
                    });
                    //console.log(propertyQuantities);
                    quantities.push.apply(quantities, propertyQuantities);
                });

                // Ritorna un array di riferimenti a IfcElementQuantity
                return quantities;
            })
            .then(function(quantityReferences) {
                // Popolo le quantità
                console.log("Quantities References", quantityReferences);
                var promises = [];
                quantityReferences.forEach(function(quantityRef) {
                    var p = oBimServerUtils.getDataObjectByOid(project, quantityRef.oid)
                        .then(function (ifcElementQuantity) {
                            return new IfcElementQuantity(ifcElementQuantity);
                        });
                    promises.push(p);
                });
                return Promise.all(promises);
            })
            .then(function(ifcElementQuantites) {
                console.log("ifcElementQuantites", ifcElementQuantites);
                // GM 20180119 - ArchiCAD v22 
                // IfcElementQuantities è un'array di DataObject rappresentanti istanze IfcElementQuantities
                // Ogni oggetto ha un valore "Quantities" che riferisce le quantità contenute nell'insieme
                // queste quantità possono essere di tipo
                // - IfcPhysicalComplexQuantity -> Contiene le SimpleQuantity di uno strato.
                // - IfcPhysicalSimpleQuantity (IfcQuantityArea/Volume, ecc.) -> Quantità dell'elemento
                
                // Il caricamento delle quantità è asincrono!
                var quantitiesPromises = [];
                ifcElementQuantites.forEach(function(ifcElementQuantity) {
                    // Costruisco l'oggetto quantità
                    //ifcElementQuantity = new IfcElementQuantity(ifcElementQuantity);
                    
                    // Popolo i riferimenti alle singole quantità
                    // Utilizzo una promessa per ognuno dei vari elementi                    
                    var elementPromises = [];
                    ifcElementQuantity.references.forEach(function(oid) {
                        // Carico l'oggetto riferito
                        var quantityElementPromise = oBimServerUtils.getDataObjectByOid(project, oid)
                            .then(function(item) {
                                if (item.type == "IfcPhysicalComplexQuantity") {
                                    // Nel caso delle IfcPhysicalComplexQuantity devo popolare anche
                                    // le quantità che la compongono!
                                    var complexQuantity = new IfcPhysicalComplexQuantity(item);
                                    var complexQuantityOids = complexQuantity.getContainedQuantitiesOid();
                                    return oBimServerUtils.getDataObjectsByOidArray(project, complexQuantityOids)
                                        .then(function (items) {                                            
                                            var simpleQuantities = items.map(function(simpleQty) { return new IfcPhysicalSimpleQuantity(simpleQty); });
                                            complexQuantity.quantities = simpleQuantities;
                                            ifcElementQuantity.complexQuantities.push(complexQuantity);
                                        });
                                } else {
                                    ifcElementQuantity.simpleQuantities.push(new IfcPhysicalSimpleQuantity(item));
                                    return Promise.resolve();
                                }
                            });
                        elementPromises.push(quantityElementPromise);
                    }); 
                    // Quando tutte le promesse sono soddisfatte, oggetto ifcElementQuantity è popolato per side effect
                    // Posso quindi fare una promessa che aspetta tutte le singole promesse
                    quantitiesPromises.push(Promise.all(elementPromises).then(function () {
                        return ifcElementQuantity;
                    }));
                });

                // Promessa risolta con tutte i vari IfcElementQuantity completi e pronti all'uso
                return Promise.all(quantitiesPromises); 
            })
            .then(function (ifcElementQuantites) {
                console.log("GetQuantities - Filled quantites", ifcElementQuantites);
                var allQuantities = ifcElementQuantites.map(function (ifcElementQuantity) {
                    return ifcElementQuantity.toOmnisFormat().map(function (simpleQty) { 
                        return {
                            name: ifcElementQuantity.name, 
                            object: simpleQty
                        }; 
                    });
                }).reduce(function (a,b) {return a.concat(b); }, []);
                console.log("Sending quantities back to Omnis", allQuantities);
                oBimServerUtils.sendControlEvent(evName, allQuantities);
                console.groupEnd(DEBUG_CONSOLE_GRUOP_NAME);
            });
    };
 
    var BimServerLoadAll = function() {
        console.time("newTAKEOFF");
        var project = oBimProjectManager.getCurrentProject();
        var ifcTypes = [
            'IfcElementQuantity',
            'IfcRelDefinesByProperties',
            'IfcRelDefinesByType',
            'IfcPhysicalComplexQuantity',     
            'IfcQuantityArea',
            'IfcQuantityVolume',
            'IfcQuantityLength',
            'IfcQuantityCount',
            'IfcQuantityWeight',
            'IfcQuantityTime'
        ];
        // Carico quasi tutto quello che mi serve con una chiamata
        // GM - Usare il ByType è ESTREMAMENTE più efficiente del ByOid
        //      quindi tocca adattarsi.
        oBimServerUtils.getDataObjectsByTypesArray(project, ifcTypes, false)
            .then(function(data) {
                var fetchedElements = new Map();
                // Metto gli array al loro posto dentro fetchedElements in modo da ottenere una mappa
                // Map<TipoIfc, ArrayDiElementiConQuelTipo>
                data.forEach(function(d) { if (d[0]) { fetchedElements.set(d[0].type, d); } });
                console.log("Fetched elements", fetchedElements);
                // Passo 1. FEMO ORDINE
                //          Ho tirato su più IfcRelDefinesByProperties di quelli che mi servono
                //          A me servono solo quelli che riferiscono un IfcElementQuantity
                // ------------------------------------------------------------------------------------
                var ifcObjectToFetch = new Set();   // Classi di IfcObject a cui sono collegate le
                                                    // IfcRelDefByProperties (utile per il Passo 5)
                // ------------------------------------------------------------------------------------
                var relDefByProps = fetchedElements.get("IfcRelDefinesByProperties");
                relDefByProps = relDefByProps.filter(function (elem) {
                    var propDef = elem.findValueInObjectValues("RelatingPropertyDefinition");
                    if (propDef.referencedType === "IfcElementQuantity"){
                        var relatedObjectsValue = elem.findValueInObjectValues("RelatedObjects");
                        
                        console.assert(relatedObjectsValue instanceof ListDataValue);
                        console.assert(relatedObjectsValue.values.length === 1);
                        // Man mano che scorro le RelDefByProp mi salvo il tipo Ifc dell'oggetto
                        // al quale è collegata la property, utile per il passo 5
                        ifcObjectToFetch.add(relatedObjectsValue.values[0].referencedType);
                        return true;
                    } else {
                        return false;
                    }
                });

                console.log("ifcObjectToFetct", ifcObjectToFetch);
                if (ifcObjectToFetch.size === 0) {
                    // Nessun oggetto ha delle quantità associate, non ha senso fare il takeOff
                    console.timeEnd("newTAKEOFF");
                    oBimServerUtils.sendControlEvent('evTakeOff', {});
                    oBimServerUtils.sendControlEvent('evWarnNoQuantity', {
                        message: Global.translate("WARN_NO_TAKEOFF_QTY"),
                        title: Global.translate("WARN_NO_TAKEOFF_QTY_TITLE")
                    });
                    return; 
                }

                fetchedElements.set("IfcRelDefinesByProperties", relDefByProps);
                console.log("Passo 1. Fetched elements (DefByProp filtrate)", fetchedElements);
                // Passo 2. KEEP CALM AND CARRY A MAP
                //          Trasformo le liste in un unica mappa, indicizzata per OID
                var memoryMap = new Map();
                fetchedElements.forEach(function(elements) {
                    elements.forEach(function(elem) {
                        memoryMap.set(elem.oid, elem);
                    });
                });
                console.log("Passo 2. Memory Cache", memoryMap);
                // OK, tempo di mettere un po' di cose assieme!
                // Paritamo dalle quantità!
                // Passo 3. Ricostruisco gli IfcElementQuantity
                // GM - 20180125: Controllo di avere delle quantità a disposizione! potri non averle
                var elementQuantities = [];
                if (fetchedElements.has('IfcElementQuantity')) {
                    elementQuantities = fetchedElements.get('IfcElementQuantity').map(function (ifcElementQuantity) {
                        var myQuantity = new IfcElementQuantity(ifcElementQuantity);
                        myQuantity.references.forEach(function(oid) {
                            var item = memoryMap.get(oid);
                            if (item.type == "IfcPhysicalComplexQuantity") {
                                var complexQuantity = new IfcPhysicalComplexQuantity(item);
                                complexQuantity.getContainedQuantitiesOid().forEach(function(simpleOid) {
                                    var simpleQty = new IfcPhysicalSimpleQuantity(memoryMap.get(simpleOid));
                                    complexQuantity.quantities.push(simpleQty);
                                });
                                myQuantity.complexQuantities.push(complexQuantity);
                            } else {
                                myQuantity.simpleQuantities.push(new IfcPhysicalSimpleQuantity(item));
                            }
                        });  
                        // Aggiorno la mappa
                        memoryMap.set(myQuantity.oid, myQuantity);
                        return myQuantity;                  
                    });
                } else {
                    console.warn("TakeOff senza quantità! (Passo 3)");
                }
                
                // Aggiorno le quantità
                fetchedElements.set('IfcElementQuantity', elementQuantities);
                console.log("Passo 3. Quantità ricostruite", elementQuantities);
                // -------------------------------------------------------------------------------------
                // Passo 4. Carico gli IfcObjectType
                //          Uso le IfcRelDefineByType per caricare gli IfcObjectType 
                //          (Me li preparo prima per questioni di efficienza)
                var ifcObjectTypesToFetch = new Set();
                fetchedElements.get('IfcRelDefinesByType').forEach(function(relDefType) {
                    var relatingTypeValue = relDefType.findValueInObjectValues('RelatingType');
                    console.assert(relatingTypeValue !== null);
                    ifcObjectTypesToFetch.add(relatingTypeValue.referencedType);
                });
                console.log("Passo 4. IfcObjectsType [To fetch]", ifcObjectTypesToFetch);
                oBimServerUtils.getDataObjectsByTypesArray(project, Array.from(ifcObjectTypesToFetch), false)
                    .then(function(ifcObjectTypesFetched) {
                        console.log("Passo 4. IfcObjectsType", ifcObjectTypesFetched);
                        // ifcObjectTypesFetched è un'array di array, ognuno contente gli oggetti
                        // di una determinata tipologia.
                        // Spiattello l'array di array in un array
                        ifcObjectTypesFetched = ifcObjectTypesFetched.reduce(function(partial, current){
                            return partial.concat(current);
                        }, []);
                        // Mappo gli oggetti fetchati nella mia MemoryMap!
                        ifcObjectTypesFetched.forEach(function(ifcObjectType) {
                            memoryMap.set(ifcObjectType.oid, ifcObjectType);
                        });
                        // -------------------------------------------------------------------------------------
                        // Passo 5. Carico gli IfcObject
                        //          Uso le IfcRelDefinesByProperties per caricare gli oggetti per i quali
                        //          sono disponibili delle quantità
                        var allRefDefByProperties = fetchedElements.get('IfcRelDefinesByProperties');
                        console.log("allRel", allRefDefByProperties);
                        console.log("IfcObjectToFetch", ifcObjectToFetch);
                        oBimServerUtils.getDataObjectsByTypesArray(project, Array.from(ifcObjectToFetch), false)
                            .then(function (ifcObjectFetched) {
                                // ifcObjectFetched è un'array di array, ognuno contente gli oggetti
                                // di una determinata tipologia.
                                // Spiattello l'array di array in un array
                                ifcObjectFetched = ifcObjectFetched.reduce(function(partial, current){
                                    // Nello spiattellare li converto!
                                    return partial.concat(current.map(function(o) { return new IfcObject(o); }));
                                }, []);
                                console.log("Passo 5. Fetched Object", ifcObjectFetched);
                                // -------------------------------------------------------------------------------
                                // Passo 6. Associo ad ogni Object il suo ObjectType (categoria) e le sue quantità
                                // Passo 6.1.   Associo ObjectType
                                //              (Nel farlo lo aggiungo anche nella MemoryMap, facilita 6.2)
                                ifcObjectFetched.forEach(function(ifcObject) {
                                    memoryMap.set(ifcObject.oid, ifcObject);
                                    var refDefByType = ifcObject.getIfcRelDefinesByTypeReference();
                                    // L'elmento potrebbe avere un ObjectType indefinito!
                                    if (refDefByType.oid != -1) {
                                        var defByType = memoryMap.get(refDefByType.oid);
                                        var refValue = defByType.findValueInObjectValues("RelatingType");
                                        ifcObject.setObjectType(memoryMap.get(refValue.oid));
                                    }
                                }); 
                                // Passo 6.2.   Associo le quantities
                                fetchedElements.get('IfcRelDefinesByProperties').forEach(function(relDefByProp) {
                                    // Per il Passo 1 sono tutte relazioni che collegano un oggetto ad alcune
                                    // delle sue quantità
                                    var ifcObjRef = relDefByProp.findValueInObjectValues("RelatedObjects").values[0];
                                    var ifcObject = memoryMap.get(ifcObjRef.oid);
                                    var ifcQtyRef = relDefByProp.findValueInObjectValues("RelatingPropertyDefinition");
                                    var ifcQty = memoryMap.get(ifcQtyRef.oid);
                                    ifcObject.quantities.push(ifcQty);
                                });
                                console.log("Passo 6. Fetched Object [With Type and Quantites]", ifcObjectFetched);
                                // -------------------------------------------------------------------------------                                
                                // Gran finale!
                                // Mando gli la risposta ad Omnis
                                var omnisResponse = new Map();
                                ifcObjectFetched.forEach(function(ifcObject) {
                                    // formato di Omnis
                                    var qtaDettaglio = ifcObject.quantities.map(function(qty) { return qty.toOmnisFormat(); });
                                    // Riduco qtaDettaglio da Array di Array ad Array 
                                    qtaDettaglio = qtaDettaglio.reduce(function(a,b) { return a.concat(b);}, []);
                                    var oo = {
                                        descElemento: ifcObject.name,
                                        guidElemento: ifcObject.guid,
                                        tipoElemento: ifcObject.type,                                        
                                        guidCategoria: (ifcObject.definedByType)? ifcObject.definedByType.guid : undefined,
                                        qtaDettaglio: qtaDettaglio
                                    };
                                    omnisResponse.set(ifcObject.guid, oo);
                                });
                                console.timeEnd("newTAKEOFF");
                                oBimServerUtils.sendControlEvent('evTakeOff', omnisResponse.toJSON());
                            });
                    });
            });
    };

    var BimServerGetTree = function(omnisCallback) {
        console.log("BimServerGetTree", omnisCallback);
        // funzioni ausiliarie
        function buildTreeNode(object) {
            //console.log("BimServerGetTree - buildTreeNode", object.object._t);
            var newNode = {};
            newNode.oid = object.oid;
            newNode.guid = object.object.GlobalId;
            newNode.type = object.getType();
            newNode.name = object.object.Name || object.getName() || 'non definito';
            newNode.children = [];
            // newNode.obj = object;
            return newNode;
        }

        function loadBuildingStorey(object, parentNode) {
            //console.log("BimServerGetTree - loadBuildingStorey", object, parentNode);
            var promise = new window.BimServerApiPromise();
           
            object.getContainsElements(function(relReferencedInSpatialStructure) {
                relReferencedInSpatialStructure.getRelatedElements(function(relatedElement) {
                    buildDecomposedTree(relatedElement, parentNode);
                }).done(function() {
                    object.getIsDecomposedBy(function(isDecomposedBy) {
                        // GM - NON STA FARTI VENIRE LA STRANA IDEA DI USARE !== CHE DA PROBLEMI!                    
                        if (isDecomposedBy != null) {
                            isDecomposedBy.getRelatedObjects(function(relatedObject) {
                                buildDecomposedTree(relatedObject, parentNode);
                            });
                        }
                    });
                });
            }).done(function() {
                promise.fire();
            });
            return promise;
        }

        function buildDecomposedTree(object, parentNode) {
            //console.log("BimServerGetTree - buildDecomposedTree", object.object._t, parentNode);

            var newNode;
            if (object.object._t === "IfcProject") {
                newNode = parentNode;
            } else {   
                //var newNode = buildTreeNode(object);
                newNode = buildTreeNode(object);
                parentNode.children.push(newNode);
            }

            if (object.getType() == "IfcBuildingStorey") {
                //console.log("BimServerGetTree - buildDecomposedTree - IfcBuildingStorey", object.object._t);
                return loadBuildingStorey(object, newNode);
            } else {
                //console.log("BimServerGetTree - buildDecomposedTree - NO IfcBuildingStorey", object.object._t);
                var promise = new window.BimServerApiPromise();
                object.getIsDecomposedBy(function(isDecomposedBy) {
                    isDecomposedBy.getRelatedObjects(function(relatedObject) {
                        buildDecomposedTree(relatedObject, newNode);
                    });
                }).done(function() {
                    // GM - NON STA FARTI VENIRE LA STRANA IDEA DI USARE !== CHE DA PROBLEMI!
                    if (object.getContainsElements != null) {
                        object.getContainsElements(function(containedElement) {
                            containedElement.getRelatedElements(function(relatedElement) {
                                buildDecomposedTree(relatedElement, newNode);
                            });
                        });
                    }
                    promise.fire();
                });
                return promise;
            }
        }

        // carico i dati e li spedisco ad omnis
        var model = oBimProjectManager.getDefaultModel();
         
        model.getAllOfType("IfcProject", true, function(project) {
            //console.log("model.getAllOfType - project ", project);
            var root = buildTreeNode(project);
            //console.log("-------------");
            buildDecomposedTree(project, root).done(function() {
                //console.log("getTree done", root);
                oBimServerUtils.sendControlEvent('evGetTree', root, omnisCallback);
            });
        });
    
    };

  

    // Caricamento proprieta' elemento passato come parametro
    // ----------------------------------------------------------------------------------
    var BimServerGetObjectProperties = function(oid) {
        var o = this;
        o.pSet = {};
        o.db = [];

        if (oid === 0 || oid === -1) {
            console.error("BimServerGetObjectProperties - OID non valido");
            return;
        }
        
        var project = oBimProjectManager.getCurrentProject();
        // Recupero l'oggetto
        console.time("NEWGET");
        oBimServerUtils.getDataObjectByOid(project, oid)
            .then(function (dataObject) {
                var ifcObject = new IfcObject(dataObject);
                console.log("BimServerGetObjectProperties ifcObject", ifcObject);
                // Estraggo i riferimetni alle proprietà dell'oggetto
                var propertiesRelOids = ifcObject.getIfcRelDefinesByPropertiesReferences().map(function (ref) {
                    return ref.oid;
                });                
                // Carico gli oggetti IfcRelDefinesByProperties
                oBimServerUtils.getDataObjectsByOidArray(project, propertiesRelOids)
                    .then(function (ifcRels) {
                        console.log("IfcRelDefinesByProperties", ifcRels);
                        // Filtro e tengo solo le relazioni che vanno verso delle proprietà!
                        ifcRels = ifcRels.filter(function(ifcRel) {
                            return ifcRel.findValueInObjectValues("RelatingPropertyDefinition").referencedType === "IfcPropertySet";
                        });
                        // Ottengo gli Oid dei IfcPropertySet
                        var propertiesSetOids = ifcRels.map(function (ifcRelDefineByProperties) {
                            return ifcRelDefineByProperties.findValueInObjectValues("RelatingPropertyDefinition").getValue();
                        });
                        return oBimServerUtils.getDataObjectsByOidArray(project, propertiesSetOids);
                    })
                    .then(function(propertiesSets) {
                        console.log("GetProperties - propertiesSets",propertiesSets);
                        var setsPromises = propertiesSets.map(function (propertiesSet) {
                            propertiesSet = new IfcPropertySet(propertiesSet);
                            // Estraggo gli oids delle singole proprietà.
                            var propertiesOids = propertiesSet.getPropertyOids();
                            
                            // Promessa con set pieno
                            return oBimServerUtils.getDataObjectsByOidArray(project, propertiesOids)
                                .then(function (properties) {
                                    propertiesSet.properties = properties.map(function (x) { return new IfcSimpleProperty(x); });
                                    return propertiesSet;
                                });
                        });
                        return Promise.all(setsPromises);
                    })
                    .then(function (propertiesSets) {
                        console.log("GetProperties - propertiesSets [filled]", propertiesSets);
                        var omnisData = new Map();
                        propertiesSets.forEach(function(propertiesSet) {
                            var values = propertiesSet.properties.map(function (simpleProperty) {
                                return { [simpleProperty.name]: simpleProperty.value };
                            });
                            omnisData.set(propertiesSet.name, {
                                name: propertiesSet.name,
                                type: propertiesSet.type,
                                values: values
                            });
                        });
                        console.timeEnd("NEWGET");
                        oBimServerUtils.sendControlEvent("evGetProperties", omnisData.toJSON());
                    });
            }); 
    };


    var BimServerGetCategoriesList = function(projectId) {
        console.log("BimServerGetCategoriesList", projectId);
        
        var project = oBimProjectManager.getCurrentProject();

        oBimServerUtils.getDataObjectsByType(project, "IfcRelDefinesByType", false)
            .then(function(dataObjects) {
                return oBimServerUtils.getDataObjectsDetails(project, dataObjects, function(val) {
                    return val.name === "RelatingType";
                });
            })
            .then(function(typeObjects) {
                console.log("typeObjects", typeObjects);
                var typesMap = new Map();

                typeObjects.forEach(function(obj) {
                    // Barbatrucco per risalire alla tipologia dell'oggetto
                    // http://www.buildingsmart-tech.org/ifc/review/IFC4Add2/ifc4-add2-rv/html/schema/ifcproductextension/lexical/ifcbuildingelementtype.htm
                    var key = obj.type.replace("Type", "").replace("Style", "");
                    var item = { "guid": obj.guid, "name": obj.name };

                    if (typesMap.has(key)) {
                        typesMap.get(key).push(item);
                    } else {
                        typesMap.set(key, [item]);
                    }
                });
                return typesMap;
            })
            .then(function(typesMap) {
                oBimServerUtils.sendControlEvent('evGetCategoriesList', typesMap);
            });
    };


    // Interazione da Omnis verso componente oBrowser.
    // ---------------------------------------------------------------------------------

    var BimServerShowLoadIFC = function() {
        console.log("BimServerShowLoadIFC");
        var container = $(".main .maincontainer");
        var pageChanger = new PageChanger($(".main .nav"), container);

        pageChanger.changePage(container, Settings.getAppAddress()+"initproject.html", function() {
            return new InitProject(container);
        });
    };

    /**
     * BimServerShowSingleProject: visualizza il progetto passato come
     * parametro.
     * @return {object} una istanza della classe Project. (Senza la S
     * finale!!)
     */
    var BimServerShowSingleProject = function() {
        console.log("BimServerShowSingleProject");
        var pageChanger = new PageChanger($(".main .nav"), $(".main .maincontainer"));
        var container = $(".main .maincontainer");

        pageChanger.changePage(container, Settings.getAppAddress() + "project.html", function() {

            return new Project(container, Global.main);
        });
    };

    /**
     * Seleziona nell'interfaccia del bim, l'oggetto con l'id passato
     * come parametro.
     * @param {Number} oid id dell'elemento da selezionare
     * @return -
     */
    /*
     * TODO: deprecato in 1.5
     * Aggiornare OMNIS, nell'evClick deve essere chiamato il ShowByGuid.
     */
    var BimServerShowDataObjectByOid = function(oid) {
        console.log("BimServerShowDataObjectByOid", oid);
        var currentModel = oBimProjectManager.getDefaultModel();
        var othis = this;
        
        currentModel.get(oid, function(object) {
            console.log("BimServerShowDataObjectByOid - object", object);
            oBimSurferWrapper.selectNode(currentModel.roid, object, othis);
        });
       
    };
    /**
     * Seleziona nell'interfaccia del bim, l'oggetto con l'id passato
     * come parametro.
     * @param {Number} guid guid dell'elemento da selezionare
     * @return -
     */
    var BimServerShowDataObjectByGuid = function(guid) {
        console.log("BimServerShowDataObjectByGuid", guid);

        var currentModel = oBimProjectManager.getDefaultModel();
        
        var othis = this;

        currentModel.getByGuids([guid], function(data) {
            // TODO: testare!
            oBimFilterManager.filterByGUIDs([guid])
                .then(function() {
                    oBimSurferWrapper.selectNode(currentModel.roid, data, othis);
                });
        });
    };


    // Caricamento e evidenziazione elementi computati
    // ----------------------------------------------------------------------------------
    var BimServerGetElementsInBOQ = function(action) {
        // chiamato direttamente da 3dview.html
        console.log("BimServerGetElementsInBOQ", action);
        oBimServerUtils.sendControlEvent('evShowElementsInBOQ', {
            'name': 'evGetElements'
        });
    };

    var BimServerClearFilter = function () {
        console.log("BimServerClearFilter");
        oBimFilterManager.resetFilter();
    };

    var BimServerFilterByGuids = function(guidsJson) {
        console.log("BimServerFilterByGuids", guidsJson);

        oBimFilterManager.filterByGUIDs(JSON.parse(guidsJson));
    };

    var BimServerFilterByType = function(ifcType) {
        console.log("BimServerFilterByType", ifcType);
        oBimFilterManager.filterByType(ifcType);
    };

    var BimServerFilterByObjectType = function(ifcObjectType, objectTypeGuid) {
        console.log("BimServerFilterByObjectType", ifcObjectType, objectTypeGuid);
        
        oBimFilterManager.filterByObjectType(ifcObjectType, objectTypeGuid);
    };


    var BimServerFilterByMultipleObjectTypes = function(ifcObjectType, typesGuids) {
        // ifcObjectType -> stringa
        // typesGuids -> Array di guid
        var objectTypes = JSON.parse(typesGuids).map(function (guid) { 
            return {
                objectType: ifcObjectType,
                guid: guid
            };
        });
        oBimFilterManager.filterByMultipleObjectTypes(objectTypes);
    };

    var BimServerShowAlert = function(message, timeToShow) {
        return Global.notifier.setError(message, timeToShow);
    };

    var BimServerSetLanguage = function(lang) {
        console.log("8bim: setLanguage");
        Global.setLanguage(lang);
        Global.initLocalization(true); // true -> traduce anche l'albero
    };

    // PUBLIC API
    // ------------------------------------------------------------------------------------------

    return {
        utils: oBimServerUtils,

        // Getter e setter per il progetto corrente
        setCurrentProject: setCurrentProject,

        loadApi: BimServerLoadApi,
        login: BimServerLogin,
        setLanguage: BimServerSetLanguage,

        // Getters
        getProjectOidFromName: BimServerGetProjectOidFromName,

        getObjectProperties: BimServerGetObjectProperties,
        getCategories: BimServerGetCategories,
        getQuantities: BimServerGetQuantities,
        getSummary: BimServerGetSummary,
        getTree: BimServerGetTree,
        getUMs: BimServerGetUMs,

        getCategoriesList: BimServerGetCategoriesList,

        // Setters
        showDataObjectByGuid: BimServerShowDataObjectByGuid, 
        showDataObjectByOid: BimServerShowDataObjectByOid, // DEPRECATO
        clearFilter: BimServerClearFilter,
        filterByGuids: BimServerFilterByGuids,
        filterByType: BimServerFilterByType,
        filterByObjectType: BimServerFilterByObjectType,
        filterByMultipleObjectTypes: BimServerFilterByMultipleObjectTypes,
        
        showSingleProject: BimServerShowSingleProject,
        getElementsInBOQ: BimServerGetElementsInBOQ,
        onCantConnect: BimServerOnCantConnect,
        showLoadIFC: BimServerShowLoadIFC,
        showAlert: BimServerShowAlert,

        // quantity takeoff
        getAll: BimServerLoadAll
    };
})();

console.log("Loaded: ", oBimServer);