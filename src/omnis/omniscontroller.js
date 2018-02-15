/* globals PageChanger, jOmnis, Settings, Global, oBimServerUtils*/

class OmnisContorller {

    loadApi(address) {
        function onServerDown() {
            console.log("8bim: error loading the api. Maybe the server is not yet started or reacheable.");
            Global.notifier.setError(Global.translate("CONNECTION_ERROR_RETRY"));
            oBimServerUtils.sendControlEvent("evApiNotReady");
        }
    
        function onServerUp() {
            Global.bimServerApi = new BimServerClient(address, Global.notifier, Global.translate);
            Global.bimServerApi.init(function(api, serverInfo) {
                if (serverInfo.serverState === "RUNNING") {
                    console.log("8bim: server running, api loaded.");
                    Global.bimServerApi = api;
                    Global.serverAddress = address;
                    oBimServerUtils.sendControlEvent("evApiLoaded");
                } else {
                    console.log("8bim: error loading the api. Maybe the server is not yet started or reacheable.");
                    Global.notifier.setError(Global.translate("CONNECTION_ERROR_RETRY"));
                    oBimServerUtils.sendControlEvent("evApiNotReady");
                }
            });
        }
        _BimServerIsServerUp(address, onServerUp, onServerDown);
    }



    showMigration() {
        console.log("showMigration");
        var $container = $(".main .maincontainer");
        var pageChanger = new PageChanger($(".main .nav"), $container);
    
        pageChanger.changePage($container, Settings.getAppAddress()+"initproject.html", function() {
            return new InitProject(container);
        });
    }
}


var _BimServerIsServerUp = function(address, successCallback, errorCallback) {
    $.getJSON(address + "/x.getbimserveraddress", function() {
        successCallback();
    }).fail(function() {
        errorCallback();
    });
};

var BimServerLoadApi = function(address) {
    function onServerDown() {
        console.log("8bim: error loading the api. Maybe the server is not yet started or reacheable.");
        Global.notifier.setError(Global.translate("CONNECTION_ERROR_RETRY"));
        oBimServerUtils.sendControlEvent("evApiNotReady");
    }

    function onServerUp() {
        Global.bimServerApi = new BimServerClient(address, Global.notifier, Global.translate);
        Global.bimServerApi.init(function(api, serverInfo) {
            if (serverInfo.serverState === "RUNNING") {
                console.log("8bim: server running, api loaded.");
                Global.bimServerApi = api;
                Global.serverAddress = address;
                oBimServerUtils.sendControlEvent("evApiLoaded");
            } else {
                console.log("8bim: error loading the api. Maybe the server is not yet started or reacheable.");
                Global.notifier.setError(Global.translate("CONNECTION_ERROR_RETRY"));
                oBimServerUtils.sendControlEvent("evApiNotReady");
            }
        });
    }
    _BimServerIsServerUp(address, onServerUp, onServerDown);
};

var BimServerLogin = function(user, password) {
    console.log("8bim: " + user + " logging in...");
    // login
    Global.bimServerApi.login(user, password, function(data) {
        console.log("8bim: logged in. Resolving user " + user);
        // permessi utente
        Global.bimServerApi.resolveUser(function(user) {
            console.log("8bim: user resolved.");
            // caricamento pagina principale
            $(".indexcontainer").load(Settings.getAppAddress() + "main.html", function() {
                new Main(Global.serverAddress, user).show(false);
                //TODO: spostare in funzione all'interno di main
                $('#logo').hide(true);
                $('#loader-4').hide(true);
                oBimServerUtils.sendControlEvent("evLoginDone");
            });
        });
    });
};