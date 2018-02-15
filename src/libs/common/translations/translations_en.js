var translations = function () {
    return {
        "EXPORT_WAITING": "Waiting",
        "EXPORT_ERROR": "Error!",
        "EXPORT_QUERY": "Querying...",
        "EXPORT_DOWNLOADING": "Downloading....",
        "EXPORT_DOWNLOAD_DONE": "Download completed",
        "EXPORT_SAVING_FILE": "Saving file...",
        "EXPORT_DONE": "Done",

        "IMPORT_DESERIALIZING": "Deserializing...",
        "IMPORT_INVERSE": "Generating inverse...",
        "IMPORT_STORING_DATA": "Storing data...",
        "IMPORT_GEOMETRY": "Generating geometry...",
        "IMPORT_GENERIC_OPERATION": "Updating project...",
        "IMPORT_STORE_DB": "Saving database...",
        "IMPORT_CHECKIN": "Done",
        "IMPORT_WAITING": "Waiting",
        "IMPORT_ERROR": "Error!"
    };
};

if (typeof window != "undefined") {
    window.translations_en = translations();
}