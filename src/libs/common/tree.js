function Tree(selector) {
    var o = this;

    o.idToNodeMap = {};
    o.rootNode = Object.create(Node.prototype);
    o.rootNode.init(-1);
    o.rootNode.open();
    o.selectedNode = null;
    o.selectionListeners = [];

    this.add = function (node) {
        o.rootNode.add(node);
    };

    this.remove = function (node) {
        delete o.idToNodeMap[node.id];
    };

    this.find = function (id) {
        return o.idToNodeMap[id];
    };

    this.setSelectedNode = function (selectedNode) {
        o.selectedNode = selectedNode;
        o.selectionListeners.forEach(function (listener) {
            listener(selectedNode);
        });
    };

    o.rootNode.tree = o;
    o.idToNodeMap[-1] = o.rootNode;
    var ul = $("<ul>");
    ul.addClass("rootnode");
    selector.append(ul);
    o.rootNode.ul = ul;
}

function Node() { };

// GM - Aggiunto parametro ifcType e translateFn (sono opzionali, quindi possono essere undefined)
Node.prototype.init = function (id, title, object, ifcType, translateFn) {
    title = title || "";

    this.ifcType = ifcType;
    this.translateFn = translateFn;

    this.isOpen = false;
    this.id = id;
    this.title = title;
    this.object = object;
};

Node.prototype.linkClick = function () {
    if (this.onClick != null) {
        this.onClick(this);
    } else {
        this.toggle();
        this.select();
    }
};

Node.prototype.getOnLoadListeners = function () {
    if (this.onLoadListeners == null) {
        this.onLoadListeners = new EventRegistry();
    }
    return this.onLoadListeners;
};

Node.prototype.add = function (node) {
    node.parent = this;
    node.tree = this.tree;
    node.tree.idToNodeMap[node.id] = node;

    if (this.children == null) {
        this.children = [];
    }
    //	this.createDom();
    if (this.isOpen) {
        node.createDom();
    }
    if (this.sort) {
        var found = false;
        for (var i = 0; i < this.children.length; i++) {
            var diff = node.title.localeCompare(this.children[i].title);
            if (diff < 0) {
                this.children.splice(i, 0, node);
                found = true;
                break;
            }
        }
        if (!found) {
            this.children.push(node);
        }
    } else {
        this.children.push(node);
    }
};

Node.prototype.addToDom = function (creator) {
    if (this.ul == null) {
        this.creator = creator;
    } else {
        this.addButton(creator(this));
    }
};

Node.prototype.setIcon = function (icon) {
    this.iconclass = icon;
    if (this.icon != null) {
        this.icon.addClass(this.iconclass);
    }
};

Node.prototype.onLoad = function (listener) {
    this.getOnLoadListeners().register(listener);
    if (this.img != null) {
        this.img.addClass("treenodeclosed");
    }
};

Node.prototype.click = function (click) {
    this.onClick = click;
};

Node.prototype.createDom = function () {
    if (this.li == null) {
        this.li = $("<li class=\"treenode\">");
        this.li.attr("nodeid", this.id);
        this.div = $("<div class=\"treelabel\">");
        this.a = $("<a>" + this.title + "</a>");
        this.img = $("<div class=\"treeicon\"/>");
        this.img.click(this.toggle.bind(this));
        this.li.append(this.img);
        this.icon = $("<div class=\"treepreicon\">");
        this.li.append(this.icon);
        this.div.append(this.a);
        this.li.append(this.div);
        this.ul = $("<ul>");
        this.ul.hide();
        this.li.append(this.ul);
        this.a.click(this.linkClick.bind(this));
        
        // GM - Aggiunto per memorizzare il tipo (solo nei nodi da tradurre)
        // Ovvero nei gruppi delle categorie dell'albero.
        if (this.ifcType) {
            this.a.attr('data-ifc-type', this.ifcType);
            if (this.translateFn) {
                this.a.text(this.translateFn(this.ifcType));
            }
        }

        // GM - ... dopo i 20 caratteri
        var nodeTitle = this.a.text();
        if (nodeTitle.length > 25) {
            this.a.text(`${nodeTitle.substring(0,25)}...`);
        } 

        if (this.hint != null) {
            this.a.attr("title", this.hint);
        }

        if (this.button != null) {
            this.li.find(".treelabel").after(this.button);
        }

        if (this.iconclass != null) {
            this.icon.addClass(this.iconclass);
        }

        if (this.parent != null) {
            this.parent.createDom();
            this.parent.ul.append(this.li);
        }

        if (this.noChildren) {
            this.img.removeClass("treenodeopen");
            this.img.removeClass("treenodeclosed");
        } else {
            this.img.addClass("treenodeclosed");
        }

        if (this.creator != null) {
            var newNode = this.creator(this);
            this.addButton(newNode);
        }

        var o = this;
        if (this.children != null) {
            this.children.forEach(function (child) {
                o.ul.append(child.li);
            });
        }
    }
};

Node.prototype.loadRecursiveSimple = function () {
    var promise = new window.BimServerApiPromise();
    if (this.onLoadListeners != null && this.onLoadListeners.size() > 0) {
        this.onLoadListeners.trigger(function (listener) {
            promise.chain(listener());
        });
        this.onLoadListeners.clear();
    } else {
        promise.fire();
    }
    var o = this;
    var newPromise = new window.BimServerApiPromise();
    promise.done(function () {
        if (o.children != null) {
            newPromise.chain(o.children.map(function (child) {
                return child.loadRecursiveSimple();
            }));
        } else {
            newPromise.fire();
        }
    });
    return newPromise;
};

Node.prototype.loadRecursively = function () {
    var promise = new window.BimServerApiPromise();
    this.setLoading();
    var o = this;
    this.loadRecursiveSimple().done(function () {
        o.doneLoading();
        promise.fire();
    });
    return promise;
};

Node.prototype.load = function () {
    var promise = new window.BimServerApiPromise();
    this.setLoading();
    if (this.onLoadListeners != null && this.onLoadListeners.size() > 0) {
        this.onLoadListeners.trigger(function (listener) {
            promise.chain(listener());
        });
        this.onLoadListeners.clear();
    } else {
        promise.fire();
    }
    var o = this;
    promise.done(function () {
        o.doneLoading();
    });
    return promise;
};

Node.prototype.open = function () {
    this.isOpen = true;
    this.createDom();
    var promise = this.load();
    var o = this;
    promise.done(function () {
        if (o.children != null && o.children.length > 0) {
            o.children.forEach(function (child) {
                child.createDom();
            });
            o.img.removeClass("treenodeclosed");
            o.img.addClass("treenodeopen");
        }
        if (o.ul != null) {
            if (o.li.find("ul").length == 0) {
                o.li.append(o.ul);
            } else {
                o.ul.show();
            }
        }
    });
    return promise;
};

Node.prototype.close = function () {
    this.isOpen = false;
    if (this.ul != null) {
        this.ul.hide();
    }
    if (this.children != null && this.children.length > 0) {
        this.img.removeClass("treenodeopen");
        this.img.addClass("treenodeclosed");
    }
};

Node.prototype.openRecursive = function () {
    this.open();
    if (this.parent != null) {
        this.parent.openRecursive();
    }
};

Node.prototype.select = function () {
    if (this.tree.selectedNode != null) {
        this.tree.selectedNode.unselect();
    }
    this.createDom();
    this.tree.setSelectedNode(this);
    this.li.addClass("selected");
};

Node.prototype.unselect = function () {
    console.log("this, unselect", this);
    this.tree.selectedNode = null;
    this.li.removeClass("selected");
};

Node.prototype.hint = function (hint) {
    this.hint = hint;
    if (this.a != null) {
        this.a.attr("title", hint);
    }
};

Node.prototype.setTitle = function (title) {
    this.a.html(title);
};

Node.prototype.hide = function () {
    this.li.hide();
};

Node.prototype.setLoading = function () {
    if (this.img != null) {
        this.img.removeClass("treenodeopen");
        this.img.removeClass("treenodeclosed");
        this.img.addClass("loading");
    }
};

Node.prototype.doneLoading = function () {
    if (this.img != null) {
        this.img.removeClass("loading");
        if (this.children != null && this.children.length > 0) {
            if (this.isOpen) {
                this.img.addClass("treenodeopen");
            } else {
                this.img.addClass("treenodeclosed");
            }
        }
    }
};

Node.prototype.toggle = function () {
    if (this.isOpen) {
        this.close();
    } else {
        this.open();
    }
};

Node.prototype.findFirstParentWithAttr = function (attrName) {
    if (this[attrName] != null) {
        return this;
    }
    if (this.parent != null) {
        return this.parent.findFirstParentWithAttr(attrName);
    } else {
        return null;
    }
};

Node.prototype.setNoChildren = function () {
    this.noChildren = true;
    if (this.img != null) {
        this.img.removeClass("treenodeopen");
        this.img.removeClass("treenodeclosed");
    }
}

Node.prototype.remove = function () {
    removeA(this.parent.children, this);
    if (this.parent.children.length == 0) {
        this.parent.img.removeClass("treenodeopen");
        this.parent.img.removeClass("treenodeclosed");
    }
    this.tree.remove(this);
    this.li.remove();
};

Node.prototype.listFilterByType = function (type) {
    var result = [];
    this.internalListFilterByType(result, type);
    return result;
};

Node.prototype.list = function () {
    var result = [];
    this.internalList(result);
    return result;
};

Node.prototype.internalList = function (result) {
    result.push(this);
    if (this.children != null) {
        this.children.forEach(function (subNode) {
            subNode.internalList(result);
        });
    }
};

Node.prototype.internalListFilterByType = function (result, type) {
    if (this.type == type) {
        result.push(this);
    }
    if (this.children != null) {
        this.children.forEach(function (subNode) {
            subNode.internalListFilterByType(result, type);
        });
    }
};

Node.prototype.addButton = function (button) {
    this.button = button;
    if (this.li != null) {
        this.li.find(".treelabel").after(this.button);
    }
};
