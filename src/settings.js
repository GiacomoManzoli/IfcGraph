"use strict";

var Settings = {
    getPlugins: function() {
        return {
            relatics: {
                enabled: false
            }
        };
    },
    getTitle: function() {
        return "8BIM Migration Tool";
    },
    useBimSurfer: function() {
        return true;
    },
    getMenuItems: function() {
        return [];
    },
    usableBimServerVersion: function(version) {
        return (version.major == 1 && version.minor == 5);
    },
    getVersion: function(successCallback) {
        successCallback("1.0.0-SNAP");
    },
    getDefaultHiddenTypes: function() {
        return {
            "IfcOpeningElement": true,
            "IfcSpace": true
        };
    },
    getAppAddress: function () {
        return Global.baseDir + "src/app/";        
    },
    getBimServerApiAddress: function() {
        return Global.baseDir + "src/libs/bimserverapi/";
    },
    getBimSurferApiAddress: function() {
        return Global.baseDir + "src/libs/bimsurfer/";
    },
    getOmnisApiAddress: function() {
        return Global.baseDir + "src/omnis/";
    },
    getCommonAddress: function() {
        return Global.baseDir + "src/libs/common/";
    },
    createStartPage: function(container, main) {}
};