/* globals jOmnis, Global, DataObject, IfcElementQuantity, IfcPhysicalComplexQuantity, IfcPhysicalSimpleQuantity*/

// This method is called implicitly by JSON.stringify.
Map.prototype.toJSON = function() {
    var obj = {};
    for (var [key, value] of this)
        obj[key] = value;
    return obj;
};

var oBimServerUtils = (function() {
    "use strict";

    /**
     * Wrappa jOmnis.sendControlEvent
     * @param {String} evType Nome dell'evento
     * @param {Any} data Oggetto JavaScript con i dati da inviare ad Omnis 
     * @returns 
     */
    var __sendControlEvent = function(evType, data, callback) {
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



    return {

        sendControlEvent: __sendControlEvent
    };
})();

console.log("Loaded: ", oBimServerUtils);