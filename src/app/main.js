/* globals Global, Viz, $*/

// http://viz-js.com/
// http://www.graphviz.org/pdf/dotguide.pdf
// https://github.com/mdaines/viz.js/
// https://graphviz.gitlab.io/_pages/doc/info/lang.html

// https://www.graphviz.org/documentation/

class GraphNode {
    constructor(oid, dataObject) {
        this.object = dataObject;
        this.oid = oid;
    }

    toGraphviz() {
        // https://www.graphviz.org/doc/info/colors.html
        const object = this.object;
        
        //if(object._t.indexOf("Quantity") !== -1 ) debugger;
        // Impostazioni dello stile
        let shape, bkg;
        if (object._t.toLowerCase().indexOf("rel") !== -1) {
            shape = "oval";
            bkg = `fillcolor=cornsilk, style=filled`;
        } else {
            shape = "box";
            bkg = `fillcolor=azure, style=filled`;
        }

        let label = this.object._t;
        if (this.object.Name) {
            label = `${label}\n${this.object.Name}`;

            if (object._t === "IfcPropertySingleValue" && object._eNominalValue && object._eNominalValue._v) {
                let val = object._eNominalValue._v;
                if (val) {
                    label = `${label}: ${val}`;
                }
            }

            if (object._t.startsWith("IfcQuantity")) {
                var valueName = `${object._t.replace("IfcQuantity", "")}Value`;
                if (object[valueName]) {
                    label = `${label}: ${object[valueName]}`;
                }
            }

        }
        if (this.object.GlobalId) {
            label = `${label}\n${this.object.GlobalId}`;
        }
        if (this.object.oid) {
            label = `${label}\n${this.object.oid}`;
        }   
        return `${this.oid} [shape=${shape},${bkg},label="${label}"] \n`;
    }
}

class GraphEdge {
    /**
     * 
     * @param {number} from 
     * @param {number} to 
     */
    constructor(from, to, name) {
        this.from = from;
        this.to = to;
        this.name = name;
    }

    toGraphviz() {
        let label = "";
        if (this.name) {
            const name = this.name.replace("_r", "");
            label = `[label="  ${name}"]`;
        }
        return `${this.from} -> ${this.to} ${label}\n`;
    }
}

class Graph {
    constructor() {
        /** @type Map.<number, Map.<number, GraphEdge>> */
        this.edges = new Map();
        
        /** @type Map.<number, GraphNode> */
        this.nodes = new Map();
    }

    addNode(node) {
        this.nodes.set(node.oid, node);
    }
    
    getNodes() {
        return Array.from(this.nodes.values()).map((n) => n);
    }

    addEdge(edge) {
        if (!this.edges.has(edge.from)) {
            this.edges.set(edge.from, new Map());
        }
        const edgeMap = this.edges.get(edge.from);
        edgeMap.set(edge.to, edge);
    }

    getEdges() {
        let edgesList = Array.from(this.edges.values()).reduce((partial, em) => {
            return partial.concat(Array.from(em.values()).map((e) => { return e; }));
        }, []);
        console.log("edgeList", edgesList);
        return edgesList;
    }


    toGraphviz() {
        const nodesGraphviz = this.getNodes().reduce((partial, n) => { return partial + n.toGraphviz(); }, "");
        const edgesGraphviz = this.getEdges().reduce((partial, e) => {return partial + e.toGraphviz(); }, "");
        
        return `digraph G {\n${nodesGraphviz} \n ${edgesGraphviz}\n}`;
    }
}

class Pattern {
    constructor(components) {
        this.components = components;
        this.total = components.length;
        this.current = -1;
    }
    
    step() {
        const nextPattern = new Pattern(this.components);
        nextPattern.current = this.current + 1;
        return nextPattern;
    }

    next() {
        const nextIndex = this.current + 1;
        if (nextIndex < this.total) {
            return this.components[nextIndex];
        } else {
            return null;
        }
    }

    getCurrent() {
        if (this.current < this.total) {
            return this.components[this.current];
        } else {
            return null;
        }
    }
    
}

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
        

        this.relationsToFollow = ["_rIsTypedBy", "_rIsDefinedBy", 
        "_rHasAssociations", "_RelatingPropertyDefinition", "_rRelatingClassification", 
        "_rRelatingMaterial", "_rRelatingType", "_rMaterials", "_rHasProperties",
        "_rForLayerSet", "_rMaterialLayers", "_rMaterial", "_RelatingPropertyDefinition", "_rQuantities", "_rHasQuantities", "_rRelatingPropertyDefinition",
        "_rHasProperties"];
        

        this.graph = new Graph();

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
        this.graph = new Graph();

        let pattern = ["IfcWall", "IfcRelDefinesByProperties", "IfcElementQuantity"];

        this.loadObject(oid, new Pattern(pattern))
            .then(() => {
                this.updateGraph();
            });
    }

    
    loadObject(oid, pattern) {
        const promise = new Promise((resolve) => {
            this.model.get(oid, (o) => {
                let object = o.object;
                const currentPattern = pattern.step();
                // debugger;

                if (currentPattern.getCurrent() !== object._t ) {
                    resolve();
                    return;
                }

                this.objects.set(oid, {
                    _t: object._t,
                    GlobalId: object.GlobalId,
                    oid: oid,
                    Name: object.Name
                });
    
                this.graph.addNode(new GraphNode(oid, object));
                let newOids = [];
    
                this.relationsToFollow.forEach(rel => {
                    if (object[rel]) {
                        let x = object[rel];
                        if (!(x instanceof Array)) {
                            x = [x];
                        }
                        x.forEach((o2) => {
                            let expected = currentPattern.next();
                            // debugger;
                            if (o2._t === expected) {
                                this.graph.addEdge(new GraphEdge(oid, o2._i, rel));
                                newOids.push(o2._i);
                            }


                        });
                       
                    }
                });
            
                let promises = newOids.map((oid2) => { return this.loadObject(oid2, currentPattern); });
                if (promises.length > 0) {
                    Promise.all(promises)
                        .then(() => { resolve(); });
                } else {
                    resolve();
                }
            });
        });
    
        return promise;
    }

    updateGraph() {
        // console.log(this.graph.string);
        const graphStr = this.graph.toGraphviz();
        // d3.select("#graph").graphviz().renderDot('digraph  {a -> b}');
        d3.select("#graph").graphviz().renderDot(graphStr);
        
        let svgGraph = Viz(graphStr);

        // let image = Viz.svgXmlToPngImageElement(svgGraph);
        Viz.svgXmlToPngBase64(svgGraph, undefined, (err, image) => {
            if (err) {console.error(err);}
            // const url = img.src.replace(/^data:image\/[^;]+/, 'data:application/octet-stream');
            const url = `data:image/png;base64,${image}`;
            $("#graph-download").attr("href", url).show();
            //this.$graphHolder.attr("src", `data:image/png;base64,${image}`);
        });
    }
}

if (window && !window.Main)  {
    window.Main = Main;
}