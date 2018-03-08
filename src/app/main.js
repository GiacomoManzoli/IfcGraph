/* globals Global, PageChanger, BimServerClient, jOmnis ,Settings, loadForOmnis, Exporter, Importer, Viz*/


class Main {
    constructor() {
        this.$container = $(document).find("#main");

        this.$projectList = this.$container.find("#projects-list");
        this.$projectTitle = this.$container.find("#project-name");
        this.$mainContent = this.$container.find("#main-content");
        this.$graphHolder = this.$container.find("#graph-holder");
        

        this.$objectsList = this.$container.find("#objects-list");

        this.currentProject = null;
        this.currentRoid = -1;

        this.objects = new Map();
        

        this.relationsToFollow = new Set(["_rIsTypedBy", "_rIsDefinedBy", "_rHasAssociations"]);

        this.graph = {
            full: "",
            nodes: "",
            edges: ""
        }

        this.loadProjects();
    }

    loadProjects() {
        this.$projectList.empty();
        Global.bimServerApi.pCall("ServiceInterface", "getAllProjects", {
            "onlyTopLevel": true,
            "onlyActive": true
        })
        .then((data) => {
            data.forEach((project) => {
                var $li = $("<li />");
                $li.attr("data-oid", project.oid);
                $li.text(project.name);
                $li.on('click', this.selectProjectClick.bind(this));
                this.$projectList.append($li);
            });
            
        });
    }
    selectProjectClick(ev) {
        const poid = parseInt(ev.currentTarget.dataset.oid);
        Global.bimServerApi.pCall("ServiceInterface", "getProjectByPoid", {poid: poid})
            .then((project) => {
                this.currentProject = project;
                this.currentRoid = project.lastRevisionId;
                this.$projectList.hide();
                this.$projectTitle.text(project.name);
                this.$mainContent.show();

                this.model = Global.bimServerApi.getModel(poid, this.currentRoid, project.schema, false);
                this.loadObjects();
            });
    }

    loadObjects() {
        // TODO: caricare la query dalla textarea
        var query = {
            type: "IfcWall"
        };
        this.$objectsList.empty();
        this.model.query(query, (o) => {
            let object = o.object;
            let $li = $(`<li data-oid="${object.oid}">${object.GlobalId} - ${object._t} - ${object.Name}</li>`);
            $li.on("click", this.selectObjectClick.bind(this));
            this.$objectsList.append($li);
        }).done(() => {
            // Tutti gli oggetti sono stati caricati
        });
    }
    
    selectObjectClick(ev) {
        let oid = parseInt(ev.currentTarget.dataset.oid);
        this.loadObject(oid)
            .then(() => {
                this.updateGraph();
            });
    }

    
    loadObject(oid) {
        let promise = new Promise((resolve) => {
            
            this.model.get(oid, (o) => {
                let object = o.object;
                this.objects.set(oid, {
                    _t: object._t,
                    GlobalId: object.GlobalId,
                    oid: oid,
                    Name: object.Name
                });
    
                // debugger;
                
                // http://viz-js.com/
                // http://www.graphviz.org/pdf/dotguide.pdf
                // https://github.com/mdaines/viz.js/
                // https://graphviz.gitlab.io/_pages/doc/info/lang.html
    
                // https://www.graphviz.org/documentation/
    
                this.graph.nodes += `${oid} [shape=box;label="${object._t}\\n${object.Name}\\n${object.GlobalId} - ${object.oid}"] \n`;
    
                let relations = ["_rIsTypedBy", "_rIsDefinedBy", 
                "_rHasAssociations", "_RelatingPropertyDefinition", "_rRelatingClassification", 
                "_rRelatingMaterial", "_rRelatingType", "_rMaterials", "_rHasProperties",
                "_rForLayerSet", "_rMaterialLayers", "_rMaterial", "_RelatingPropertyDefinition", "_rQuantities", "_rHasQuantities", "_rRelatingPropertyDefinition",
                "_rHasProperties"];
                
                let newOids = [];
    
                relations.forEach(rel => {
                    if (object[rel]) {
                        let x = object[rel];
                        if (!(x instanceof Array)) {
                            x = [x];
                        }
                        x.forEach((o2) => {
                            this.graph.edges += `${oid} -> ${o2._i};\n`;
                            newOids.push(o2._i);
                        });
                       
                    }
                });
            
                let promises = newOids.map((oid2) => { return this.loadObject(oid2); });
                if (promises.length > 0) {
                    Promise.all(promises)
                        .then(() => { resolve(); });
                } else {
                    resolve();
                }
                //this.updateGraph();
            });
        });
        
      
        return promise;
    }

    updateGraph() {
        this.graph.string = `digraph G {\n${this.graph.nodes + "\n" + this.graph.edges}\n}`;
        console.clear();
        // console.log(this.graph.string);
        let svgGraph = Viz(this.graph.string);
        // let image = Viz.svgXmlToPngImageElement(svgGraph);
        Viz.svgXmlToPngBase64(svgGraph, undefined, (err, image) => {
            if (err) {console.error(err);}
            this.$graphHolder.attr("src", `data:image/png;base64,${image}`);
        });
        // console.log(Viz(this.graph.string));

    }
}

if (window && !window.Main)  {
    window.Main = Main;
}