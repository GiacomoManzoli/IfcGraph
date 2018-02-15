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


// This method is called implicitly by JSON.stringify.
Map.prototype.toJSON = function() {
    var obj = {};
    for (var [key, value] of this)
        obj[key] = value;
    return obj;
};
