/* globals Global, BimServerClient, jOmnis, Utils */

class Exporter {
    constructor($container, parent) {
    
        this.$container = $container;
        this.parent = parent;


        this.mimeTypeOverride = "text/plain";

        this.projects = new Map();
        this.projectsToExport = new Map(); // Mappa poid -> [roids]
        this.allRoids = [];
        this.serializers = new Map();

        this.$projectsTable = $container.find("#projects-table");
        this.$downloadsTable = $container.find("#downloads-table");
        this.$panelExport = $container.find("#panel-export");
        this.$panelProgress = $container.find("#panel-progress");

        this.$btnExport = $("#btn-export");

        this.$btnExport.on("click", this.exportButtonClick.bind(this));
        $("#btn-check-all").on("click", this.checkAllButtonClick.bind(this));


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
        this.bimServerApi = new BimServerClient(config.address, undefined, Global.translate);

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
            }
        }.bind(this));
    }

    _onLoginDone() {
        // Carica i progetti
        this.bimServerApi.call("ServiceInterface", "getAllProjects", {
            "onlyTopLevel": "true",
            "onlyActive": "true"
        }, function (projects) {
            console.log("Progetti presenti", projects);
            
            var $header = $("<thead />");
            $header.append(Utils.buildTableRow([
                { name: "name", localize: "export_project_name", class: "col-5" },
                { name: "schema", localize: "export_project_schema", class: "col-2" },
                { name: "Esporta", localize: "export_action", class: "col-1" },
                { name: "Opzioni", localize: "export_options", class: "col-4" }
            ], true));

            this.$projectsTable.append($header);

            var $tbody = $("<tbody />");
            
            projects.forEach(function (project) {
                this.projects.set(project.oid, project);

                this.allRoids = this.allRoids.concat(project.revisions);                
               
                var $row = Utils.buildTableRow([
                    { name: project.name, class: "col-5" },
                    { name: project.schema, class: "col-2 center"}
                ], false);

                var chId = `ch-${project.oid}`;
                
                var $checkbox = $("<input type=\"checkbox\" />");
                $checkbox.attr("id", chId);
                $checkbox.attr("data-poid", project.oid);
                $checkbox.on("change", this.exportCheckboxChange.bind(this));
                
            
                var $cell = $("<td />");
                $cell.append($checkbox);
                $cell.attr("class", "col-1 center");
                
                $row.append($cell);

            
                var $optionCell = $("<td />");
                var $optionCellContent = $("<div class=\"radio-group disabled\"/>");
                $optionCellContent.attr("id", `rdg-${project.oid}`);
                
                var $optionLastDiv = $("<div />");
                var $optionLast = $("<input type=\"radio\"/>");
                $optionLast.attr("id", `rd-last-${project.oid}`);
                $optionLast.attr("checked", true);
                $optionLast.attr("name", `rd-${project.oid}`);
                $optionLast.attr("disabled", true);
                $optionLast.attr("data-poid", project.oid);
                $optionCell.attr("class", "col-4 center");
                $optionLast.on("change", this.radioButtonChange.bind(this));
                
                
                var $labelOptionLast = $("<label />");
                $labelOptionLast.text("Ultima revisione");
                $labelOptionLast.attr("data-localize", "export_rev_last");                
                
                $labelOptionLast.attr("for", `rd-last-${project.oid}`);

                $optionLastDiv.append($optionLast);
                $optionLastDiv.append($labelOptionLast);
                $optionCellContent.append($optionLastDiv);

                var $optionDiv = $("<div />");
                var $optionAll = $("<input type=\"radio\" />");
                $optionAll.attr("id", `rd-all-${project.oid}`);
                $optionAll.attr("name", `rd-${project.oid}`);
                $optionAll.attr("disabled", true);
                $optionAll.attr("data-poid", project.oid);
                $optionAll.on("change", this.radioButtonChange.bind(this));
                
                
                var $labelOptionAll = $("<label />");
                $labelOptionAll.append($("<span data-localize=\"export_rev_all\">Tutte le revisioni</span>"));     
                $labelOptionAll.append($(`<span> (${project.revisions.length})</span>`));
                $labelOptionAll.attr("for", `rd-all-${project.oid}`);
                

                $optionDiv.append($optionAll);
                $optionDiv.append($labelOptionAll);
                $optionCellContent.append($optionDiv);

                $optionCell.append($optionCellContent);
                $row.append($optionCell);

                $tbody.append($row);
            }.bind(this));

            this.$projectsTable.append($tbody);
            Global.initLocalization();
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
        var $radioGroup = $(`input[name=rd-${poid}]`);
        $radioGroup.attr("disabled",!checked);

        var $radioDiv = $(`div#rdg-${poid}`);
        $radioDiv.toggleClass("disabled");

        var $radioChecked = $radioGroup.filter(`:checked`);
        
        if (checked) {
            var onlyLast = $radioChecked.attr("id").indexOf("last") !== -1;
            this.projectsToExport.set(poid, onlyLast? [project.lastRevisionId] : project.revisions);
        } else {
            this.projectsToExport.delete(poid);
        }

        if (this.projectsToExport.size > 0) {
            this.$btnExport.attr("disabled", false);
        } else {
            this.$btnExport.attr("disabled", true);
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
                            schema: project.schema, 
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

    checkAllButtonClick(ev) {
        var select = ev.currentTarget.dataset.select;
        select = select !== undefined? (select === "true") : true;
        
        if (select) {
            // this.$container.find("input[type=checkbox]").attr("checked", true); // non sempre funziona
            var othis = this;
            this.$container.find("input[type=checkbox]").each(function () {
                this.checked = true;
                var poid = parseInt(this.dataset.poid);
                var project = othis.projects.get(poid);
        
                var $radioGroup = $(`input[name=rd-${poid}]`);
                var $radioChecked = $radioGroup.filter(`:checked`);
                var onlyLast = $radioChecked.attr("id").indexOf("last") !== -1;
                othis.projectsToExport.set(poid, onlyLast? [project.lastRevisionId] : project.revisions);
            });
            this.$container.find("input[type=radio]").attr("disabled", false);
            this.$container.find("div[id^=rdg]").removeClass("disabled");
        } else {
            // this.$container.find("input[type=checkbox]").attr("checked", false);
            this.$container.find("input[type=checkbox]").each(function () {this.checked = false;});
            this.$container.find("input[type=radio]").attr("disabled", true);
            this.$container.find("div[id^=rdg]").addClass("disabled");
            this.projectsToExport = new Map(); 
        }
        this.$btnExport.attr("disabled", !select);

        $(ev.currentTarget).attr("data-select", !select);
        $(ev.currentTarget).find("span").toggleClass("initialhide");
    }

    startDownloads() {
        this.$panelExport.hide();
        this.$panelProgress.show();

        this.currentDownload = 0;
    
        var $header = $("<thead />");
        $header.append(Utils.buildTableRow([
            { name: "Progetto", localize: "export_project_name", class: "col-3" },
            { name: "Revisione", localize: "export_project_revision", class: "col-3"  },
            { name: "Avanzamento", localize: "export_progress", class: "col-3"  },
            { name: "Stato", localize: "export_state", class: "col-3"  }
        ], true));

        this.$downloadsTable.append($header);

        var $tbody = $("<tbody />");

        this.downloads.forEach(function(download){
            var $row = Utils.buildTableRow([
                { name: download.name, class: "col-3" },  
                { name: download.revision.comment, class: "col-3" }
            ]);

            // --- cella per progressbar
            var $progressCell = $("<td />");
            $progressCell.attr("id", download.id);
            $progressCell.attr("class", "col-3");
            
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
            $opCell.attr("class", "col-3");
            
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