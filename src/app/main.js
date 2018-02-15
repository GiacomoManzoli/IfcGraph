/* globals Global, PageChanger, BimServerClient, jOmnis ,Settings, loadForOmnis, Exporter, Importer*/

class Main {
    constructor() {
        this.importer = null;
        this.exporter = null;
        this.currentPage = null;
    
        this.$container = $(document).find("#main");

        // this.$container.find("#btnExportPanel").on("click", this.btnExporterPanelClick.bind(this));
        // this.$container.find("#btnImportPanel").on("click", this.btnImporterPanelClick.bind(this));

        Global.main = this;

        Global.initLocalization();
    }

    load() {
        var promise = new window.BimServerApiPromise();

        var $exportWrapper = this.$container.find(".exportWrapper");
        var $importWrapper = this.$container.find(".importWrapper");

        var exportPromise = loadForOmnis($exportWrapper, Settings.getAppAddress() + "exporter.html", function() {
            this.exporter = new Exporter($exportWrapper, this);
            this.currentPage = this.exporter;
        }.bind(this));

        var importPromise = loadForOmnis($importWrapper, Settings.getAppAddress() + "importer.html", function() {
            this.importer = new Importer($importWrapper, this);
        }.bind(this));



        promise.chain(exportPromise);
        promise.chain(importPromise);

        return promise.done(function() {
            jOmnis.sendEvent("evApplicationReady");
        }.bind(this));
    }

    showPage(page, config, data) {
        if (this.currentPage) {
            this.currentPage.hide();
        }
        this.currentPage = page;
        this.currentPage.show(config, data);
    }

    showExporter(config) {
        if (this.exporter) {
            this.showPage(this.exporter, config);
        }
    }   

    showImporter(config, data) {
        if (this.importer) {
            this.showPage(this.importer, config, data);
        }
    }

}