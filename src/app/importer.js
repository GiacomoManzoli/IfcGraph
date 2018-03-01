/* globals Global, BimServerClient, Utils, jOmnis */
class Importer {
    constructor($container, parent) {
        this.MAX_CONNECTION_ATTEMPTS = parent.MAX_CONNECTION_ATTEMPTS || 2;
        
        this.$container = $container;
        this.parent = parent;

        this.bimServerApi = null;

        this.$projectsTable = $container.find("#projects-table");
        
        this.$panelConnection = $container.find("#panel-connection");
        this.$panelImport = $container.find("#panel-import");


        this.$progressBar = this.$panelConnection.find(".progress");
        
        this.$btnRetry = this.$panelConnection.find("#btn-retry-imp");
        this.$btnRetry.on("click", this.buttonRetryClick.bind(this));

        this.$btnAbort = this.$panelConnection.find("#btn-abort-imp");
        this.$btnAbort.on("click", function() { jOmnis.sendEvent("evServerUnreachable"); }.bind(this));
        

        this.$errorMessage = this.$panelConnection.find("#import-server-unreachable");
        this.$attemptsSpan = this.$panelConnection.find("#imp-attempts-span");

        this.projects = new Map(); // name -> revs
        this.projectsNames = [];

        this.connectionAttempts = 0;
        this.config = null;

    }

    show(config, files) {
        this.config = config;
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
    
        files.forEach(function (file) {
            var p = this.projects.get(file.name) || { id: `PRJ-${this.projects.size}`, name: file.name, schema: file.schema, revisions: [] };
            p.revisions.push({
                comment: file.revisionComment,
                id: file.revisionId,
                filePath: file.fileUrl
            });
            this.projects.set(file.name, p);
        }.bind(this));
        this.projectsNames = Array.from(this.projects.keys());
        // Popolo la tabella
        var $header = $("<thead />");

        $header.append(Utils.buildTableRow([
            { name: "Nome", localize: "import_project_name", class: "col-4" },
            { name: "Revisione", localize: "import_revision_name", class: "col-4" },
            { name: "Progresso", localize: "import_progress_bar", class: "col-2" },
            { name: "Stato", localize: "import_state", class: "col-2" }
        ], true));
        
        this.$projectsTable.append($header);
        var $tbody = $("<tbody />");
      
        this.projects.forEach(function(project) {
            // Ordina le revisioni
            project.revisions.sort(function(a,b) { return (a.id > b.id)? 1 : (a.id < b.id)? -1 : 0; });

            // Crea le righe
            project.revisions.forEach(function(rev) {
                var revString = `${rev.id} - ${rev.comment}`;
                var $row = Utils.buildTableRow([
                    { name: project.name, class: "col-4" }, 
                    { name: revString, class: "col-4" }
                ]);
                
                // --- cella per progressbar
                var $progressCell = $("<td />");
                $progressCell.attr("id", `${project.id}-R${rev.id}`);
                $progressCell.attr("class", "col-2");
                
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
                $opCell.attr("class", "col-2 center");
                var $span = $("<span />");
                $span.text(Global.translate("IMPORT_WAITING"));
                $span.attr("id", `${project.id}-R${rev.id}-action`);

                $opCell.append($span);
                $row.append($opCell);

                $tbody.append($row);    
            }.bind(this));
        }.bind(this));
        
        this.$projectsTable.append($tbody);

        this._initApi(config);
        Global.initLocalization();
        this.$container.show();
    }

    hide() {
        this.$container.hide();
    }

    _initApi(config) {
        this.$attemptsSpan.text(`${this.connectionAttempts+1}/${this.MAX_CONNECTION_ATTEMPTS}`);
        
        Global.checkServerConnection(config.address, function successCallback() {
            // Inizializza le API
            this.bimServerApi.init(function(api, serverInfo) {
                if (serverInfo.serverState === "RUNNING") {
                    console.log("8bim: server running, api loaded.");
                    this.bimServerApi = api;
                    // Effettua il login
                    this.bimServerApi.login(config.username, config.password, function() {
                        this.bimServerApi.resolveUser(function() {
                            console.log("8bim: user resolved.");

                            if (config.version !== this.bimServerApi.version.fullString) {
                                console.error(`Versione del server (${this.bimServerApi.version.fullString}) diversa da quella attesa (${config.version})`);                                
                                return;
                            }

                            this._onLoginDone();
                        }.bind(this));
                    }.bind(this));
                } else {
                    console.log("8bim: error loading the api. Maybe the server is not yet started or reacheable.");                
                }
            }.bind(this));
        }.bind(this), function errorCallBack() {
            this.connectionAttempts += 1;
            console.log(`Tentativo di connessione ${this.connectionAttempts} fallito...`, config);

            if (this.connectionAttempts < this.MAX_CONNECTION_ATTEMPTS) {
                window.setTimeout(this._initApi.bind(this, config), 10000);            
            } else {
                this.$errorMessage.show();
                
                this.$progressBar.removeClass("active");
                this.$progressBar.find(".progress-bar").css("background-color", "#999999");
                // jOmnis.sendEvent("evServerUnreachable");
            }
        }.bind(this));
    }

    buttonRetryClick() {
        this.$errorMessage.hide();
        
        this.connectionAttempts = 0;
        
        this.$progressBar.addClass("active");
        this.$progressBar.find(".progress-bar").css("background-color", "");

        this._initApi(this.config);
    }

    
    _onLoginDone() {
        this.$panelConnection.hide();
        this.$panelImport.show();
        this.deserializer = {};
        console.log("importer, loginDone");
        // Carico i deserializzatoir
        this._getSuggestedDeserializerOidForSchema('ifc4')
            .then(function(ifc4Oid) {
                this.deserializer.ifc4 = ifc4Oid;
                return this._getSuggestedDeserializerOidForSchema('ifc2x3tc1');
            }.bind(this))
            .then(function(ifc2x3Oid) {
                this.deserializer.ifc2x3tc1 = ifc2x3Oid;


                this.boundedProgressHandler = this.progressHandler.bind(this);
                // Inizio a creare i progetti
                this.startUploadProjects();

            }.bind(this));
    }

    startUploadProjects() {
        this.currentProjectIndex = 0;
        this.uploadSingleProject();
    }

    uploadSingleProject() {
        // Recupero i dati del progetto
        var projectName = this.projectsNames[this.currentProjectIndex];
        var projectDummy = this.projects.get(projectName);
        console.log("upload single project");
  
        this.bimServerApi.pCall("ServiceInterface", "addProject", {
            projectName: projectDummy.name,
            schema: projectDummy.schema
        }).then(function (project) {
            console.log("creato progetto", project.name);
            projectDummy.project = project;
            projectDummy.currentRevision = 0;

            this.uploadSingleRevision();

        }.bind(this));
    }

    uploadSingleRevision() {
        console.log("upload single revision");
        var projectName = this.projectsNames[this.currentProjectIndex];
        var projectDummy = this.projects.get(projectName);
        var project = projectDummy.project;

        var revision = projectDummy.revisions[projectDummy.currentRevision];
        console.log("revision: ", revision.filePath);

        var fileName = revision.filePath.substring(revision.filePath.lastIndexOf("/")+1);
        console.log("fileName", fileName);
        revision.fileName = fileName;

        this.bimServerApi.pCall("ServiceInterface", "checkinFromUrl", {
            deserializerOid: this.deserializer[project.schema],
            comment: revision.comment,
            merge: false,
            poid: project.oid,
            url: revision.filePath,
            sync: false,
            fileName: fileName
        }).then(function(topicId) {
            console.log("registro l'handler");
            projectDummy.progressDoneHandled = false; // Mi sono accorto di aver già completato la revisione!
            projectDummy.topicId = topicId; // Id del task
            this.bimServerApi.registerProgressHandler(topicId, this.boundedProgressHandler);
        }.bind(this));
    }

    onRevisionUploaded(project, revision) {
        console.log("revision uploaded", revision.fullFileName);
        var projectDummy = this.projects.get(project.name);

        var nextRevisionOfThisProject = projectDummy.currentRevision +1;
        if (nextRevisionOfThisProject === projectDummy.revisions.length) {
            // Ho completato il caricamento del progetto
            var nextProjectIndex = this.currentProjectIndex +1;

            jOmnis.sendEvent("evProjectUploaded", projectDummy);
            
            if (nextProjectIndex === this.projectsNames.length) {
                // Ho finito i progetti!
                this.onImportComplete();
            } else {
                this.currentProjectIndex = nextProjectIndex;
                this.uploadSingleProject();
            }
        } else {
            // Ho un'altra revisione da caricare
            projectDummy.currentRevision = nextRevisionOfThisProject;
            this.uploadSingleRevision();
        }
    }

    onImportComplete() {
        console.log("Migrazione completata");
       
        jOmnis.sendEvent("evImportComplete");
    }

    progressHandler(topicId, state) {
        var projectName = this.projectsNames[this.currentProjectIndex];
        var projectDummy = this.projects.get(projectName);
        
        if (projectDummy.topicId !== topicId || projectDummy.progressDoneHandled) return; // Controllo del TopicId e download completato
        //                                          ^ necessario perché il metodo viene chiamato due volte dal progressHandler.
    
        var project = projectDummy.project;
        var revision = projectDummy.revisions[projectDummy.currentRevision];


        var uploadId = `${projectDummy.id}-R${revision.id}`;
        var $progressCell = $(this.$projectsTable[0]).find(`#${uploadId}`);
        var $progressSpan = $(this.$projectsTable[0]).find(`#${uploadId}-action`);



        console.log("this.progressHandler", state.stage, state.state, state.title, state.progress, $progressCell);
        var oldStage = this.stage;
        this.stage = state.stage;
        if (state.state == "AS_ERROR") {
            state.errors.forEach(function(error) {
                console.log(error);
            });
            $progressSpan.text(Global.translate("IMPORT_ERROR"));
            
            this.bimServerApi.unregisterProgressHandler(topicId, this.boundedProgressHandler);
        } else {
            if (oldStage != state.stage) {
                // Ho cambiato fase, resetto la progressBar
                $progressCell.find(".progressBarHolder .downloadProgressBar").remove();
                $progressCell.find(".progressBarHolder").append("<div class=\"downloadProgressBar progress\"><div class=\"progress-bar\"></div></div>");
            }
            if (state.progress == -1) {
                $progressCell.find(".downloadProgressBar").addClass("progress-striped").addClass("active");
                $progressCell.find(".downloadProgressBar .progress-bar").css("width", "100%");
            } else {
                $progressCell.find(".downloadProgressBar").removeClass("progress-striped").removeClass("active");
                $progressCell.find(".downloadProgressBar .progress-bar").css("width", parseInt(state.progress) + "%");
            }

            var titleKey = "IMPORT_WAITING";
            switch (state.stage) {
                case 2: titleKey = "IMPORT_DESERIALIZING"; break;
                case 3: // è una cosa volontaria, hanno la stessa stringa
                case 4: titleKey = "IMPORT_INVERSE"; break;
                case 5: titleKey = "IMPORT_STORING_DATA"; break;
                case 6: titleKey = "IMPORT_GEOMETRY"; break;
                case 7: titleKey = "IMPORT_GENERIC_OPERATION"; break;                
                case 8: titleKey = "IMPORT_STORE_DB"; break;
                case 9: titleKey = "IMPORT_CHECKIN"; break; // stage = 9 => state = finished
            }
            $progressSpan.text(Global.translate(titleKey));

            if (state.state === "FINISHED") {
                if (!projectDummy.progressDoneHandled) {
                    projectDummy.progressDoneHandled = true;
                    var timestamp = state.start;
                    
                    revision.fullFileName = Utils.getFullFileName(revision.fileName, timestamp);
                    this.onRevisionUploaded(project, revision);

                    // containerDiv.find(".checkin").parent().modal("hide");
                    this.bimServerApi.callWithNoIndication("ServiceInterface", "cleanupLongAction", {
                        topicId: topicId
                    }, function() {}).done(function() {
                        // This also automatically unregisters the progress handler, 
                        // so we only have to tell bimserverapi that it's unregistered
                        this.bimServerApi.unregister(this.boundedProgressHandler);
                        // successFunction();
                    }.bind(this));
                }
            } else if (state.state == "STARTED" || state.state == "NONE") {}
        }
    }

    _getSuggestedDeserializerOidForSchema(ifcSchema) {
        // Per ottenere i relativi Deserializer è presente l'API `getSuggestedDeserializerForExtension`
        // Nel caso di un progetto Ifc2x3 -> "Ifc2x3tc1 (Streaming)"
        // Nel caso di un progetto Ifc4 -> "Ifc4 (Streaming)"
        var name = (ifcSchema === "ifc2x3tc1") ? "Ifc2x3tc1 (Streaming)" : "Ifc4 (Streaming)";
        var promise = new Promise(function (resolve, reject) {
            this.bimServerApi.call("ServiceInterface", "getDeserializerByName", {
                deserializerName: name
            }, function (deserializer) {
                console.log("Deserializer", deserializer);
                resolve(deserializer.oid);
            }, function (error) {
                console.error(error);
                reject(error);
            });

        }.bind(this));
        return promise;
    }

}