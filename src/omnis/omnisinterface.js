/* globals Global, jOmnis, oBimServer */

jOmnis.sendEvent = function sendEvent(evType, data, callback) {
    // console.log("oBimServerUtils - sending ", evType, data);
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
    },
    omnisSetData: function (params) {
        console.log("omnisSetData", params);
    },
    omnisGetData: function (params) {
        console.log("omnisGetData", params);
    },
   
    // ------ esportazione ------
    showExport: function(params) {
        var serverConfig = params.C1;
        if (Global.main.exporter) {
            Global.main.showExporter(serverConfig);
        }
    },

    onDownloadCompleted: function(params) {
        console.log("OI", "onDownloadCompleted", params);
        if (Global.main.exporter) {
            var downloadId = params.C1;
            Global.main.exporter.onDownloadCompleted(downloadId);
        } 
    },

    // ------ importazione ------
    showImport: function(params) {
        var serverConfig = params.C1;
        var files = params.C2;
        if (Global.main.importer) {
            Global.main.showImporter(serverConfig, files);
        }
    },


    // Funzioni che erano in getData
    // -------------------------------------------------
    loadBimServerApi: function (params) {
        return oBimServer.loadApi(params.C1);
    },
    bimServerLogin: function (params) {
        return oBimServer.login(params.C1, params.C2);
    },
   
    showLoadIFC: function () {
        return oBimServer.showLoadIFC();
    },
  
    showAlert: function (params) {
        return oBimServer.showAlert(params.C1, params.C2);
    },
    onCantConnect: function () {
        return oBimServer.onCantConnect();
    },
 
   
    // Gestione della lingua
    setLanguage: function (params) {
        return oBimServer.setLanguage(params.C1);
    }
};