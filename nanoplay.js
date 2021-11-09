/*
    NanoPlay Web API

    Copyright (C) Subnodal Technologies. All Rights Reserved.

    https://nanoplay.subnodal.com
    Licenced by the Subnodal Open-Source Licence, which can be found at LICENCE.md.
*/

namespace("com.subnodal.nanoplay.webapi", function(exports) {
    var ble = require("com.subnodal.nanoplay.webapi.ble");
    var minifier = require("com.subnodal.nanoplay.webapi.minifier");
    var safety = require("com.subnodal.nanoplay.webapi.safety");

    exports.NotSupportedError = class extends Error {};

    exports.NanoPlay = class {
        constructor() {
            this.connection = new ble.Connection();

            this.version = null;
            this.versionNumber = null;
        }

        connect() {
            var thisScope = this;

            thisScope.connection.rxData = "";

            return this.connection.connect().then(function() {
                return thisScope.connection.evaluate(`[require("config").OS_VERSION, require("config").OS_VERNUM]`);
            }).then(function(versionInfo) {
                thisScope.version = versionInfo[0];
                thisScope.versionNumber = versionInfo[1];

                return new Promise(function(resolve, reject) {
                    setTimeout(function() {
                        thisScope.connection.rxData = "";

                        resolve();
                    }, 1000);
                });
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
            return this.connection.evaluate(`new Date().getTime();`).then(function(timestamp) {
                return new Date(timestamp);
            });
        }

        setSystemDate(date = new Date()) {
            return this.connection.evaluate(`setTime(${date.getTime() / 1000});`);
        }

        getApps() {
            var thisScope = this;

            return this.connection.evaluate(`require("Storage").list();`).then(function(list) {
                var appList = [];
                var promiseChain = Promise.resolve();

                for (var i = 0; i < list.length; i++) {
                    if (list[i].endsWith(".npm")) {
                        (function(i) {
                            promiseChain = promiseChain.then(function() {
                                return thisScope.connection.evaluate(`require("Storage").read(\`${list[i]}\`);`).then(function(data) {
                                    appList.push({
                                        id: list[i].split(".")[0],
                                        manifest: JSON.parse(data)
                                    });
                                });
                            });
                        })(i);
                    }
                }

                promiseChain = promiseChain.then(function() {
                    var apps = {};

                    for (var i = 0; i < appList.length; i++) {
                        apps[appList[i].id] = appList[i].manifest;
                    }

                    return apps;
                });

                return promiseChain;
            });
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

            if (this.versionNumber != null && this.versionNumber < 5) {
                throw new NotSupportedError("Please update your NanoPlay to V0.2.5 or later");
            }

            return minifier.minify(safety.makeSafe(code), {mangle: true}).then(function(minifiedResult) {
                code = `var global,require,start,loop,_shouldClose=false,_showStatusBar=false;${minifiedResult.code};function _status(){return{_shouldClose:!!_shouldClose,_showStatusBar:!!_showStatusBar}};[start,loop,_status]`;
            
                return thisScope.connection.communicate(";eval(\`" + [
                    `clearTimeout(require("main").rootScreenLoop);`,
                    `LED.write(require("config").properties.backlight);`,
                    `Pixl.setLCDPower(true);`,
                    `require("main").preventOpening();`,
                    `require("display").clear();`,
                    `require("display").drawCharsFromCell(require("l10n").translate("uploading"), 0, 1);`,
                    `require("ui").drawStatusBar();`,
                    `require("display").render();`
                ].join("") + "\`)\n");
            }).then(function() {
                return thisScope.connection.evaluate([
                    `require("Storage").write(\`${id}.np\`, atob(\`${btoa(code)}\`));`,
                    `require("Storage").write(\`${id}.npm\`, atob(\`${btoa(JSON.stringify(manifest))}\`));`
                ].join(""));
            }).then(function() {
                return thisScope.connection.evaluate([
                    `require("Storage").compact();`,
                    `reset();`
                ].join(""));
            }).then(function() {
                return Promise.resolve(id);
            });
        }

        removeApp(id) {
            return this.connection.evaluate([
                `clearTimeout(require("main").rootScreenLoop);`,
                `require("main").preventOpening();`,
                `require("Storage").erase(\`${id}.np\`);`,
                `require("Storage").erase(\`${id}.npm\`);`,
                `require("Storage").compact();`,
                `reset();`
            ].join(""));
        }

        getFreeStorage() {
            return this.connection.evaluate(`require("Storage").getFree()`);
        }

        getFreeMemory() {
            // `process.memory().free` returns free memory in 20-byte chunks
            return this.connection.evaluate(`process.memory().free`).then(function(data) {
                return data * 20;
            });
        }

        getScreenshot() {
            // Resolved promise returns a data URL, or `null` if sleeping
            return this.connection.evaluate(`g.asURL()`).then(function(data) {
                return Promise.resolve(data != undefined ? data : null);
            });
        }
    };
});