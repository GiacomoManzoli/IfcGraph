var Utils = {};

Utils.buildTableRow = function buildTableRow(cols, isHeader) {
    // cols è un'array di stringhe oppure un'array di oggetti
    // {name: "", localize: ""}
    var $row = $("<tr />");
    cols.forEach(function(c) {
        var $cell = (isHeader)? $(`<th />`): $(`<td />`);
        if (typeof c === "string") {
            $cell.text(c);
        } else {
            $cell.text(c.name);
            if (c.localize) {
                $cell.attr("data-localize", c.localize);            
            }
            if (c.class) {
                $cell.attr("class", c.class);
            }
        }
        $row.append($cell);
        
    });
    return $row;
};

Utils.getFullFileName = function getFullFileName(fileName, timestamp) {
    var date = new Date(timestamp);
    function tDD(x) { return (x < 10)? `0${x}` : `${x}`; } // ToDoubleDigit
    
    // Note:
    // 1. date.getDay() da il DayOfWeek, per avere il numero del giorno devo fare date.getDate()
    // 2. date.getMonth() parte da 0 -> gennaio.
    var fullFileName = `${date.getFullYear()}-${tDD(date.getMonth()+1)}-${tDD(date.getDate())}-${tDD(date.getHours())}-${tDD(date.getMinutes())}-${tDD(date.getSeconds())}-${fileName}`;
    return fullFileName;
};


// This method is called implicitly by JSON.stringify.
Map.prototype.toJSON = function() {
    var obj = {};
    for (var [key, value] of this)
        obj[key] = value;
    return obj;
};
