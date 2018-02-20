/* global LazyLoad, Settings, bimserverapi, jOmnis, Main */
"use strict";

var Global = {};
Global.baseDir = document.location.protocol + "//" + document.location.host + document.location.pathname;

if (Global.baseDir.substring(Global.baseDir.length - 4) === ".htm") {
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


function loadOmnisInterface(callback) {

    var omnisData = [
        Global.baseDir.replace('8bim_migration_tool/', "") + "omn_list_base.js?_v=" + Global.version,
        Global.baseDir.replace('8bim_migration_tool/', "") + "omnishtmlcontrol.js?_v=" + Global.version
    ];
    // Se sono da localhost sono fuori da Omnis e quindi dialogo con il mio server e non con Omnis!
    if (window.location.port === "8288" && window.location.hostname === "localhost") {
        console.info("MOCK!");
        omnisData = [
            Settings.getOmnisApiAddress() + "__omnis_mock.js?_v" + Global.version
        ];
    } else {
        console.log(window.location);
    }

    var bimFiles = [
        Settings.getOmnisApiAddress() + "8bim.js?_v=" + Global.version,
        Settings.getOmnisApiAddress() + "omnisinterface.js?_v=" + Global.version
    ];
    var all = [omnisData, bimFiles].reduce(function (a, b) { return a.concat(b); }, []);
    LazyLoad.js(all, callback);
}

function loadControllers(callback) {

    var controllers = [
        "main.js",
        "importer.js",
        "exporter.js"
    ];
    controllers = controllers.map(function (x) { return Settings.getAppAddress() + x + "?_v=" + Global.version; });

    var toLoad = [Settings.getSrcAddress() + "utils.js?_v=" + Global.version];
    toLoad = toLoad.concat(controllers);

    LazyLoad.js(toLoad, callback);
}

function loadResources() {

    Global.setLanguage = function (lang) {
        Global.language = lang;
        window.translations = lang == "it" ? window.translations_it : window.translations_en;
    };

    Global.translate = function (id) {
        var key = id.toUpperCase();
        var translations = window.translations;
        if (translations.hasOwnProperty(id)) {
            return window.translations[id];
        } else if (translations.hasOwnProperty(key)) {
            return window.translations[key];
        } else {
            console.warn("TRANSLATE", "Traduzione non trovata per", key);
            return key;
        }
    };

    Global.initLocalization = function ($container) {
        var $all = ($container) ? $container.find("[data-localize]") : $("[data-localize]");
        $all.localize("8bim", {
            language: Global.language,
            pathPrefix: Settings.getCommonAddress() + "translations"
        });

    };

    Global.checkServerConnection = function checkServerConnection(address, successCallback, errorCallback) {   
        $.getJSON(address + "/x.getbimserveraddress", function() {
            successCallback();
        }).fail(function() {
            errorCallback();
        });
    };

    loadBimViewsStyles(undefined);

    loadDependencies(function () {
        // imposto la lingua di default
        Global.setLanguage("en");
        // loadBimLegacyApi(function() {
        //     var legacyApi = {
        //         client: window.BimServerClient,
        //         promise: window.BimServerApiPromise
        //     };
        //     window.legacyApi = legacyApi;

        loadBimServerApi(function () {
            // Compatibilità con il nuovo sistema di moduli
            window.BimServerClient = bimserverapi.default;
            window.BimServerApiPromise = bimserverapi.BimServerApiPromise;


            

            loadControllers(function () {
                loadOmnisInterface(function () {
                    // L'onload viene effettuato quanto tutto è caricato (solo se ho il mock)
                    if (window.location.port === "8288" && window.location.hostname === "localhost") {
                        jOmnis.onLoad();
                    }

                    jOmnis.onOmnisCommunicationEnstablished = function () {
                        $(".indexcontainer").load(Settings.getAppAddress() + "main.html", function () {
                            var main = new Main();
                            main.load().done(function () {
                                $('#logo').hide(true);
                                $('#loader-4').hide(true);
                                $('.indexcontainer').show();
                            });
                        });
                    };
                });
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
    Settings.getVersion(function (version) {
        console.log("Environment Version:", navigator.userAgent);
        Global.version = version + "-" + new Date().getTime();
        Global.versionClean = version;
        loadResources();
    });
});