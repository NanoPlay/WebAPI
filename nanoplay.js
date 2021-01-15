namespace("com.subnodal.nanoplay.webapi", function(exports) {
    var ble = require("com.subnodal.nanoplay.webapi.ble");

    exports.NotSupportedError = class extends Error {};

    exports.NanoPlay = class {
        constructor() {
            this.connection = new ble.Connection();

            this.version = null;
            this.versionNumber = null;
        }

        connect() {
            var thisScope = this;

            return this.connection.connect().then(function() {
                return thisScope.connection.evaluate(`[require("config").OS_VERSION, require("config").OS_VERNUM]`);
            }).then(function(versionInfo) {
                thisScope.version = versionInfo[0];
                thisScope.versionNumber = versionInfo[1];
            });
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
            return this.connection.evaluate(`new Date().getTime()`).then(function(timestamp) {
                return new Date(timestamp);
            });
        }

        setSystemDate(date = new Date()) {
            return this.connection.evaluate(`setTime(${date.getTime() / 1000});`);
        }

        uploadApp(code, manifest) {
            if (typeof(code) != "string") {
                throw new TypeError("Code must be a string");
            }

            if (typeof(manifest) == "string") {
                manifest = JSON.parse(manifest);
            }

            if (typeof(manifest) != "object") {
                throw new TypeError("Manifest must be an object");
            }

            if (manifest.name == undefined) {
                throw new TypeError("Manifest must include an app name");
            }

            var localAppName = manifest.name;
            
            if (typeof(manifest.name) == "object") {
                if (Object.keys(manifest.name).length == 0) {
                    throw new TypeError("Manifest must include an app name");
                }

                localAppName = manifest.name["en_GB"] || manifest.name[Object.keys(manifest.name)[0]];
            }

            if (typeof(localAppName) != "string") {
                throw new TypeError("Manifest must include an app name");
            }

            var thisScope = this;
            var id = manifest.id || localAppName.replace(/\W/g, "").toLowerCase().substring(0, 20);

            if (this.versionNumber != null && this.versionNumber < 2) {
                throw new NotSupportedError("Please update your NanoPlay to V0.2.2 or later");
            }

            return this.connection.evaluate([
                `clearTimeout(require("main").rootScreenLoop);`,
                `LED.write(require("config").properties.backlight);`,
                `Pixl.setLCDPower(true);`,
                `require("main").preventOpening();`,
                `require("display").clear();`,
                `require("display").drawCharsFromCell(require("l10n").translate("uploading"), 0, 1);`,
                `require("display").render();`
            ].join("")).then(function() {
                return thisScope.connection.evaluate([
                    `require("Storage").write(\`${id}.np\`, atob(\`${btoa(code)}\`));`,
                    `require("Storage").write(\`${id}.npm\`, atob(\`${btoa(JSON.stringify(manifest))}\`));`
                ].join(""));
            }).then(function() {
                return thisScope.connection.evaluate([
                    `require("Storage").compact();`,
                    `reset();`
                ].join(""));
            });
        }
    };
});