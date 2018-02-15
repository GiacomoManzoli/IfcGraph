class OmnisMock {

    constructor(address) {
        this.callbackObject = {};
        this.address = address;
        this.ws = null;
        //this.onLoad(); // deve essere chiamato da init a caricamento finito
    }


    onLoad() {
        if (this.callbackObject.onLoad) {
            this.callbackObject.onLoad();
        }
        this.ws = new WebSocket(this.address);

        var othis = this;

        this.ws.onopen = function() {
            console.log("OMOCK: onopen");
            if (othis.callbackObject.omnisOnWebSocketOpened)
            othis.callbackObject.omnisOnWebSocketOpened();
        };

        this.ws.onmessage = function(event) {
            //console.log("OMOCK: onmessage", event);

            var evData = JSON.parse(event.data);
            //console.log(evData);

            // Converte i dati in un oggetto con C1 C2... per indicare le varie colonne dell'array
            var dataOmnisFormat = {};
            for (var i = 0; i < evData.data.length; i++) {
                dataOmnisFormat[`C${i+1}`] = evData.data[i];
            }
            //console.log(dataOmnisFormat);
            var name = evData.name;
            if (othis.callbackObject[name]) {
                othis.callbackObject[name](dataOmnisFormat);
            }
        };

        this.ws.onclose = function() {
            if (othis.callbackObject.omnisOnWebSocketClosed)
            othis.callbackObject.omnisOnWebSocketClosed();
        };
    }

    sendControlEvent(data) {
        this.ws.send(JSON.stringify(data));
    }
}

var jOmnis = new OmnisMock('ws://localhost:40512');
console.log("jOmnis mock", jOmnis);