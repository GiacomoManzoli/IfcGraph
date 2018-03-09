/* global LazyLoad, Settings, bimserverapi, jOmnis, Main */
"use strict";

var Global = {};
Global.baseDir = document.location.protocol + "//" + document.location.host + document.location.pathname;

if (Global.baseDir.substring(Global.baseDir.length - 5) === ".html") {
    Global.baseDir = Global.baseDir.substring(0, Global.baseDir.lastIndexOf("/"));
}
if (Global.baseDir.substring(Global.baseDir.length - 1) !== "/") {
    Global.baseDir = Global.baseDir + "/";
}

var baseJsDir = Global.baseDir + "src/";
var baseCssDir = Global.baseDir + "css/";
var base = document.getElementsByTagName("base");
base[0].href = Global.baseDir;

function loadBimServerApi(callback) {
    LazyLoad.js([Settings.getBimServerApiAddress() + "/bimserverapi.umd.js?_v=" + Global.version], callback);
}

function loadDependencies(callback) {
    var jsToLoad = [
        Settings.getCommonAddress() + "jquery/jquery-2.2.0.js?_v=" + Global.version,
        Settings.getCommonAddress() + "main.js?_v=" + Global.version,
        Settings.getCommonAddress() + "jquery/jquery.cookie.js?_v=" + Global.version,
        Settings.getCommonAddress() + "jquery/jquery.numeric.js?_v=" + Global.version,
        Settings.getCommonAddress() + "jquery/jquery.enterpress.js?_v=" + Global.version,
        Settings.getCommonAddress() + "jquery/jquery.dragbetter.js?_v=" + Global.version,
        Settings.getCommonAddress() + "base64unicode.js?_v=" + Global.version,
        Settings.getCommonAddress() + "jquery/jquery.ui.widget.js?_v=" + Global.version,
        Settings.getCommonAddress() + "jquery/jquery.scrollTo.js?_v=" + Global.version,
        Settings.getCommonAddress() + "jquery/jquery.localize.min.js?_v=" + Global.version,

        Settings.getCommonAddress() + "String.js?_v=" + Global.version,
        Settings.getCommonAddress() + "bootstrap.js?_v=" + Global.version,
        Settings.getCommonAddress() + "Variable.js?_v=" + Global.version,
        Settings.getCommonAddress() + "EventRegistry.js?_v=" + Global.version,
        Settings.getCommonAddress() + "sha256.js?_v=" + Global.version,
        Settings.getCommonAddress() + "utils.js?_v=" + Global.version,
        Settings.getCommonAddress() + "formatters.js?_v=" + Global.version,
        Settings.getCommonAddress() + "pagechanger.js?_v=" + Global.version,
        Settings.getCommonAddress() + "notifier.js?_v=" + Global.version,
        Settings.getCommonAddress() + "d3.v4.min.js?_v=" + Global.version,
        Settings.getCommonAddress() + "d3-graphviz.min.js?_v=" + Global.version,
        Settings.getCommonAddress() + "viz.1.8.js?_v=" + Global.version,
        

        Settings.getCommonAddress() + "translations/translations_en.js?_v=" + Global.version,
        Settings.getCommonAddress() + "translations/translations_it.js?_v=" + Global.version
    ];
    LazyLoad.js(jsToLoad, callback);
}

function loadBimViewsStyles(callback) {
    var cssToLoad = [
        baseCssDir + "material-icons.css?_v=" + Global.version,
        baseCssDir + "bootstrap.min.css?_v=" + Global.version,
        baseCssDir + "main.css?_v=" + Global.version,
        baseCssDir + "bootstrap-vert-tabs.min.css?_v=" + Global.version,
        baseCssDir + "custom.css?_v=" + Global.version
    ];
    LazyLoad.css(cssToLoad, callback);
}

function loadControllers(callback) {

    var controllers = [
        "main.js"
    ];
    controllers = controllers.map(function (x) { return Settings.getAppAddress() + x + "?_v=" + Global.version; });

    var toLoad = [Settings.getSrcAddress() + "utils.js?_v=" + Global.version];
    toLoad = toLoad.concat(controllers);

    LazyLoad.js(toLoad, callback);
}

function loadResources() {
    loadBimViewsStyles(undefined);

    loadDependencies(function () {
     

        loadBimServerApi(function () {
            // Compatibilità con il nuovo sistema di moduli
            window.BimServerClient = bimserverapi.default;
            window.BimServerApiPromise = bimserverapi.BimServerApiPromise;

            loadControllers(function () {


                var ADDRESS = "http://localhost:8082";
                var USERNAME = "bim@888sp.it";
                var PASSWORD = "bim";


                Global.bimServerApi = new window.BimServerClient(ADDRESS);
                Global.bimServerApi.init(function (api, serverInfo) {
                    console.log(serverInfo);
                    if (serverInfo.serverState === "RUNNING") {
                        console.log("8bim: server running, api loaded.");
                        Global.bimServerApi = api;
                        Global.serverAddress = ADDRESS;

                        Global.bimServerApi.login(USERNAME, PASSWORD, function () {
                            Global.bimServerApi.resolveUser(function () {
                                $('#logo').hide(true);
                                $('#loader-4').hide(true);
                                $('.indexcontainer').show();
                                $(".indexcontainer").load(Settings.getAppAddress() + "main.html", function () {
                                    Global.main = new Main();
                                });
                            });
                        });
                    }
                });

                var bimServerApi = Global.bimServerApi;
                bimServerApi.pCall = function(serivce, method, params) {
                    return new Promise(function(resolve, reject) {
                        bimServerApi.call(serivce, method, params, function(data) {
                            resolve(data);
                        }, function(error){
                            reject(error);
                        });
                    }.bind(this));
                };

               
            });
            //var othis = this;
            var jQueryLoad = $.fn.load;

            $.fn.load = function (url, params, callback) {
                url += "?_v=" + Global.version;
                return jQueryLoad.apply(this, arguments);
            };
        });
        // });

    });
}

LazyLoad.js([baseJsDir + "settings.js?_v=" + new Date().getTime()], function () {
    Settings.getVersion(function () {
        console.log("Environment Version:", navigator.userAgent);
        loadResources();
    });
});