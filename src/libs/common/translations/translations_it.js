var translations = function () {
    return {
        "EXPORT_WAITING": "In attesa",
        "EXPORT_ERROR": "Errore!",
        "EXPORT_QUERY": "Preparo i dati...",
        "EXPORT_DOWNLOADING": "Download....",
        "EXPORT_DOWNLOAD_DONE": "Download completato",
        "EXPORT_SAVING_FILE": "Salvataggio del file...",
        "EXPORT_DONE": "Completato",

        "IMPORT_DESERIALIZING": "Deserializzazione...",
        "IMPORT_INVERSE": "Generazione modello...",
        "IMPORT_STORING_DATA": "Salvataggio dei dati...",
        "IMPORT_GEOMETRY": "Generazione rappresentazione grafica...",
        "IMPORT_GENERIC_OPERATION": "Aggiornametno del progetto...",
        "IMPORT_STORE_DB": "Salvataggio nel database...",
        "IMPORT_CHECKIN": "Completato",
        "IMPORT_WAITING": "In attesa",
        "IMPORT_ERROR": "Errore!"
    };
};

if (typeof window != "undefined") {
    window.translations_it = translations();
}