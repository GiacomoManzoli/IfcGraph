/* globals Global, jOmnis */

jOmnis.sendEvent = function sendEvent(evType, data, callback) {
    var message = {
        evType: evType
    };
    if (data !== undefined) {
        message.data = (typeof(data) === "string") ? data : JSON.stringify(data);
    }
    if (callback !== undefined) {
        message.callback = callback;
    }
    jOmnis.sendControlEvent(message);
};

jOmnis.callbackObject = {
    omnisOnLoad: function () {
        console.log('8bim: Omnis interface loaded. Waiting for the communication link...');
    },
    omnisOnWebSocketOpened: function () {
        console.log('8bim: web socket opened.');
        jOmnis.sendEvent('evOmnisCommunicationEstablished');
        if (jOmnis.onOmnisCommunicationEnstablished) {
            jOmnis.onOmnisCommunicationEnstablished();        
        }
    },
    omnisSetData: function (params) {
        console.log("omnisSetData", params);
    },
    omnisGetData: function (params) {
        console.log("omnisGetData", params);
    },
   
    // ------ esportazione ------
    showExport: function(params) {
        console.log(params);
        var serverConfig = JSON.parse(params.C1);
        if (Global.main.exporter) {
            Global.main.showExporter(serverConfig);
        }
    },

    onFilePartSaved: function(params) {
        console.log("OI", "onFilePartSaved", params);
        if (Global.main.exporter) {
            var partIndex = params.C1;
            Global.main.exporter.onFilePartSaved(partIndex);
        } 
    },

    onFileSaved: function(params) {
        console.log("OI", "onFileSaved", params);
        if (Global.main.exporter) {
            var downloadId = params.C1;
            Global.main.exporter.onFileSaved(downloadId);
        } 
    },

    // ------ importazione ------
    showImport: function(params) {
        console.log(params);
        var serverConfig = JSON.parse(params.C1);
        var files = JSON.parse(params.C2);
        files = files.map(function (file) {
            return {
                name: file[0],
                schema: file[1],
                fileUrl: file[2],
                revisionId: file[3],
                revisionComment: file[4]
            };
        });
        console.log(files);
        if (Global.main.importer) {
            Global.main.showImporter(serverConfig, files);
        }
    },
   
    // Gestione della lingua
    setLanguage: function (params) {
        var lang = params.C1;
        console.log("8bim: setLanguage");
        Global.setLanguage(lang);
        Global.initLocalization();
    }
};