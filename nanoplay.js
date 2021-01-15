namespace("com.subnodal.nanoplay.webapi", function(exports) {
    var ble = require("com.subnodal.nanoplay.webapi.ble");

    exports.NanoPlay = class {
        constructor() {
            this.connection = new ble.Connection();
        }

        connect() {
            return this.connection.connect();
        }

        disconnect() {
            this.connection.disconnect();
        }

        get isConnected() {
            return this.connection.isOpen;
        }

        get name() {
            if (this.connection.bleDevice != null) {
                return this.connection.bleDevice.name;
            } else {
                return null;
            }
        }

        getSystemDate() {
            return this.connection.evaluate("new Date().getTime()").then(function(timestamp) {
                return new Date(timestamp);
            });
        }

        setSystemDate(date = new Date()) {
            return this.connection.evaluate(`setTime(${date.getTime() / 1000});`);
        }
    };
});