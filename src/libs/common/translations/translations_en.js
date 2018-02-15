var translations = function() {
    return {
        "IMPORT_DESERIALIZING": "Deserializing...",
        "IMPORT_INVERSE": "Generating inverse...",
        "IMPORT_STORING_DATA": "Storing data...",
        "IMPORT_GEOMETRY": "Generating geometry...",
        "IMPORT_GENERIC_OPERATION": "Updating project...",
        "IMPORT_STORE_DB": "Saving database...",
        "IMPORT_CHECKIN": "Done",
        "IMPORT_WAITING": "Waiting"
    };
};

if (typeof window != "undefined") {
    window.translations_en = translations();
}