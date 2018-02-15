/* globals Global, BimServerClient, jOmnis */

class Exporter {
    constructor($container, parent) {
    
        this.$container = $container;
        this.parent = parent;

        this.notifier = new Notifier();
        this.notifier.setSelector(".exporter .exporterStatus .status");

        this.mimeTypeOverride = "text/plain";

        this.projects = new Map();
        this.projectsToExport = new Map(); // Mappa poid -> [roids]
        this.allRoids = [];
        this.serializers = new Map();

        this.$projectsTable = $container.find("#projects-table");
        this.$downloadsTable = $container.find("#downloads-table");
        this.$panelExport = $container.find("#panel-export");
        this.$panelProgress = $container.find("#panel-progress");

        $("#btnExport").on("click", this.exportButtonClick.bind(this));

        this.bimServerApi = null;
    }

    show(config) {
        this._initApi(config);
        this.$container.show();
    }

    hide() {
        this.$container.hide();
    }


    _initApi(config) {
        this.bimServerApi = new BimServerClient(config.address, this.notifier, Global.translate);

        // Aggiungo il metodo che ritorna una promessa
        var bimServerApi = this.bimServerApi;
        bimServerApi.pCall = function(serivce, method, params) {
            return new Promise(function(resolve, reject) {
                bimServerApi.call(serivce, method, params, function(data) {
                    resolve(data);
                }, function(error){
                    reject(error);
                });
            }.bind(this));
        };

        // Inizializza le API
        this.bimServerApi.init(function(api, serverInfo) {
            if (serverInfo.serverState === "RUNNING") {
                console.log("8bim: server running, api loaded.");
                this.bimServerApi = api;
                // Effettua il login
                this.bimServerApi.login(config.username, config.password, function() {
                    this.bimServerApi.resolveUser(function() {
                        console.log("8bim: user resolved.");
                        this._onLoginDone();
                    }.bind(this));
                }.bind(this));
            } else {
                console.log("8bim: error loading the api. Maybe the server is not yet started or reacheable.");
                this.notifier.setError(Global.translate("CONNECTION_ERROR_RETRY"));
                
            }
        }.bind(this));
    }

    _buildTableRow(cols, isHeader) {
        var $row = $("<tr />");
        cols.forEach(function(c) {
            var $cell = (isHeader)? $(`<th>${c}</th>`): $(`<td>${c}</td>`);
            $row.append($cell);
        });
        return $row;
    }


    _onLoginDone() {
        // Carica i progetti
        this.bimServerApi.call("ServiceInterface", "getAllProjects", {
            "onlyTopLevel": "true",
            "onlyActive": "true"
        }, function (projects) {
            console.log("Progetti presenti", projects);
            
            var $header = $("<thead />");
            $header.append(this._buildTableRow(["Id", "name", "schema", "oid", "Esporta", "Opzioni"], true));

            this.$projectsTable.append($header);

            var $tbody = $("<tbody />");
            
            projects.forEach(function (project) {
                this.projects.set(project.oid, project);
                this.allRoids = this.allRoids.concat(this.allRoids, project.revisions);

                var $row = this._buildTableRow([project.id, project.name, project.schema, project.oid], false);

                var chId = `ch-${project.oid}`;
                
                var $checkbox = $("<input type=\"checkbox\" />");
                $checkbox.attr("id", chId);
                $checkbox.attr("data-poid", project.oid);
                $checkbox.on("change", this.exportCheckboxChange.bind(this));
                
            
                var $cell = $("<td />");
                $cell.append($checkbox);
                
                $row.append($cell);

            
                var $optionCell = $("<td />");

                var $optionLast = $("<input type=\"radio\"/>");
                $optionLast.attr("id", `rd-last-${project.oid}`);
                $optionLast.attr("checked", true);
                $optionLast.attr("name", `rd-${project.oid}`);
                $optionLast.attr("disabled", true);
                $optionLast.attr("data-poid", project.oid);
                $optionLast.on("change", this.radioButtonChange.bind(this));
                
                
                var $labelOptionLast = $("<label />");
                $labelOptionLast.text("Ultima revisione");
                $labelOptionLast.attr("for", `rd-last-${project.oid}`);

                $optionCell.append($optionLast);
                $optionCell.append($labelOptionLast);

                var $optionAll = $("<input type=\"radio\" />");
                $optionAll.attr("id", `rd-all-${project.oid}`);
                $optionAll.attr("name", `rd-${project.oid}`);
                $optionAll.attr("disabled", true);
                $optionAll.attr("data-poid", project.oid);
                $optionAll.on("change", this.radioButtonChange.bind(this));
                
                
                var $labelOptionAll = $("<label />");
                $labelOptionAll.text(`Tutte le revisioni (${project.revisions.length})`);
                $labelOptionAll.attr("for", `rd-all-${project.oid}`);

                $optionCell.append($optionAll);
                $optionCell.append($labelOptionAll);


                $row.append($optionCell);

                $tbody.append($row);
            }.bind(this));

            this.$projectsTable.append($tbody);
            
            this.loadSerializers();
        }.bind(this));
    }

    loadSerializers() {
        /* 
        * Da notare che questa cacchio di API non ha senso!
        * Ogni progetto può essere serializzato con qualsiasi cosa...
        */
        this.bimServerApi.call("PluginInterface", "getAllSerializersForRoids", {
            roids: this.allRoids,
            onlyEnabled: true
        }, function(serializers) {
            serializers.forEach(function(serializer){
                this.serializers.set(serializer.name, serializer);
            }.bind(this));
        }.bind(this));
    }

    exportCheckboxChange(ev) {
        var poid = parseInt(ev.currentTarget.dataset.poid);
        var project = this.projects.get(poid);
        
        var checked = ev.currentTarget.checked;
        var $radioGruop = $(`input[name=rd-${poid}]`);
        $radioGruop.attr("disabled",!checked);
        var $radioChecked = $radioGruop.filter(`:checked`);
        
        if (checked) {
            var onlyLast = $radioChecked.attr("id").indexOf("last") !== -1;
            this.projectsToExport.set(poid, onlyLast? [project.lastRevisionId] : project.revisions);
        } else {
            this.projectsToExport.delete(poid);
        }
    }

    radioButtonChange(ev) {
        console.log(ev);
        var poid = parseInt(ev.currentTarget.dataset.poid);
        var project = this.projects.get(poid);
        if (ev.currentTarget.checked) {
            var onlyLast = ev.currentTarget.id.indexOf("last") !== -1;
            this.projectsToExport.set(poid, onlyLast? [project.lastRevisionId] : project.revisions);    
        }
    }

    exportButtonClick() {
        console.log(this.projectsToExport);

        // Preparo le informazioni riguardo le revisioni che devo scaricare
        this.downloads = [];
        var downloadPromises = [];
        this.projectsToExport.forEach(function(roids, poid) {
            var project = this.projects.get(poid);
            var serializer = (project.schema === "ifc2x3tc1")? this.serializers.get("Ifc2x3tc1") : this.serializers.get("Ifc4");

            // Per ogni progetto recupera le informazioni sulle revisioni
            var promise = this.bimServerApi.pCall("ServiceInterface", "getAllRevisionsOfProject", {poid: poid})
                .then(function(revs) {

                    roids.forEach(function(roid){
                        // cerca la revisione con l'oid corrente
                        var rev = revs.find(function(r) {return r.oid === roid;});
                        var id = `DWN-${this.downloads.length}`;
                        this.downloads.push({
                            id: id,
                            name: project.name,
                            revision: {
                                id: rev.id,
                                comment: rev.comment
                            },
                            request: {
                                "roids": [roid],
                                "query": '{"includeAllFields": true}',
                                "serializerOid": serializer.oid,
                                "sync": false
                            },
                            serializerOid: serializer.oid,
                            topicId: -1 // id del download (lato BIMserver), -1 perché deve ancora inziare
                        });
                    }.bind(this));
                }.bind(this));
            downloadPromises.push(promise);    
        }.bind(this));

        Promise.all(downloadPromises)
            .then(function() {
                // Inizio a processare i download
                this.startDownloads();
            }.bind(this));
    }

    startDownloads() {
        this.$panelExport.hide();
        this.$panelProgress.show();

        this.currentDownload = 0;
    
        var $header = $("<thead />");
        $header.append(this._buildTableRow(["DNW", "Progetto", "Revisione", "Avanzamento", "Stato"], true));

        this.$downloadsTable.append($header);

        var $tbody = $("<tbody />");

        this.downloads.forEach(function(download){
            var $row = this._buildTableRow([download.id, download.name, download.revision.comment]);

            // --- cella per progressbar
            var $progressCell = $("<td />");
            $progressCell.attr("id", download.id);
            var $barHolder = $("<div />");
            $barHolder.attr("class", "progressBarHolder");

            var $downloadProgressBar = $("<div />");
            $downloadProgressBar.attr("class", "downloadProgressBar progress");
            $barHolder.append($downloadProgressBar);
            
            var $progressBar = $("<div />");
            $progressBar.attr("class", "progress-bar");
            $downloadProgressBar.append($progressBar);
            $progressCell.append($barHolder);

            $row.append($progressCell);

            // --- cella per operazione
            var $opCell = $("<td />");
            var $span = $("<span />");
            $span.text("In attesa");
            $span.attr("id", `${download.id}-action`);

            $opCell.append($span);
            $row.append($opCell);

            $tbody.append($row);
        }.bind(this));

        this.$downloadsTable.append($tbody);
        
        
        this.startSingleDownload();
    }

    startSingleDownload() {
        var download = this.downloads[this.currentDownload];
        // La query deve essere una stringa sennò sbomba!
        this.bimServerApi.pCall("ServiceInterface", "download", download.request)
            .then(function(data) {
                // il download è stato avviato
                console.log("Preparing download...", data);
                download.topicId = parseInt(data);

                this.boundedProgressHandler = this.progressHandler.bind(this);

                this.bimServerApi.registerProgressHandler(download.topicId, this.boundedProgressHandler);
            }.bind(this))
            .catch(function(exception) {
                this.afterDownload();
                console.error(exception.message);
            }.bind(this));
    }

    bimServerDownloadCompleted(download) {
        console.log("BIMserver export completed");

        var $actionSpan = $(this.$projectsTable[0]).find(`#${download.id}-action`);
        $actionSpan.text("Download completato.");
        
    }
    
    onDownloadCompleted(downloadId) {
       // console.log("Download completato");
        
        var $actionSpan = $(this.$downloadsTable[0]).find(`#${downloadId}-action`);
        var $progressCell = $(this.$downloadsTable[0]).find(`#${downloadId}`);
        
        $actionSpan.text("Esportazione completata.");
        $progressCell.find(".downloadProgressBar").removeClass("progress-striped").removeClass("active");



        var nextDownload = this.currentDownload + 1;
        if (nextDownload === this.downloads.length) {
            // Download completati
            jOmnis.sendEvent("evExportComplete");
        } else {
            // ci sono ancora dei download da fare:
            this.currentDownload = nextDownload;
            this.startSingleDownload();
        }

    }

    
    progressHandler(topicId, state) {
        console.log("progressHandler, this:", state.title, state.state, state.progress);
        
        var download = this.downloads[this.currentDownload];

        var $progressCell = $(this.$downloadsTable[0]).find(`#${download.id}`);
        var $actionSpan = $(this.$downloadsTable[0]).find(`#${download.id}-action`);
		if (topicId === download.topicId) {
		
            
			if (state.errors && state.errors.length > 0) {
				this.afterDownload();
				state.errors.forEach(function(error){
					console.log(error);
				});
			} else {

                if (state.progress === -1) {
                    $progressCell.find(".downloadProgressBar").addClass("progress-striped").addClass("active");
                    $progressCell.find(".downloadProgressBar .progress-bar").css("width", "100%");
                } 

				if (state.state=== "STARTED" && state.title === "Done preparing") {
					if (!download.prepareReceived) {
						download.prepareReceived = true;
                        
                        if (state.warnings.length > 0) {
							state.warnings.forEach(function(warning){
                                console.warn(warning);
							});
						}
						if (state.errors && state.errors.length > 0) {
	
							download.prepareReceived = false;
							download.topicId = null;
							
							state.errors.forEach(function(error){
                                console.error(error);
							});
						} else {
							// Waiting for the callback, because changing the window.location will cancel all running ajax calls
							var url = this.bimServerApi.generateRevisionDownloadUrl({
								topicId: download.topicId,
								zip: false,
								serializerOid: download.serializerOid,
                            });
                                        
                            if (this.mimeTypeOverride) {
								url += "&mime=" + this.mimeTypeOverride;
							}
                            console.log(url);

                            
                            $.get(url, undefined, function(con) {
                                                   
                                $actionSpan.text("Salvataggio del file in corso...");
                                $progressCell.find(".downloadProgressBar").addClass("progress-striped").addClass("active");
                                $progressCell.find(".downloadProgressBar .progress-bar").css("width", "100%");
                                jOmnis.sendEvent("evSaveFile", {download: download, content: con});
                            });
						}
					}
				} else if (state.state === "STARTED" && state.title === "Downloading...") {
                    $actionSpan.text("Esportazione in corso...");                
                    $progressCell.find(".downloadProgressBar").removeClass("progress-striped").removeClass("active");
                    $progressCell.find(".downloadProgressBar .progress-bar").css("width", parseInt(state.progress) + "%");
                } else if (state.state == "FINISHED") {
					this.bimServerApi.unregisterProgressHandler(download.topicId, this.boundedProgressHandler , function(){					
						this.bimServerApi.call("ServiceInterface", "cleanupLongAction", {topicId: download.topicId}, function(){});
						download.topicId = null;
                        download.prepareReceived = false;
                        this.bimServerDownloadCompleted(download);
     
					}.bind(this));
				}
			}
		}
    }
    
    cancel() {
		if (this.topicId) {
			this.bimServerApi.call("ServiceInterface", "terminateLongRunningAction", {topicId: this.topicId}, function(){
			});
		}
	}
	

    afterDownload() {
		// containerDiv.find(".fields, .downloadpopup .checkoutMessage").show();
		// containerDiv.find(".downloadProgressBar").hide();
		this.bimServerApi.unregisterProgressHandler(this.topicId, this.boundedProgressHandler, function(){
			this.prepareReceived = false;
			this.topicId = null;
		}.bind(this));
	}

}